import React from 'react';
import { Typography } from '@/ui/components/core';
import { cn } from '@/lib/utils';
import type { ConversionModifiers } from '@/shared/types/conversionModifiers';
import { categoryOfExtension } from '@/lib/formats';

export interface BitrateCardProps {
  options: ConversionModifiers;
  onChange: (updated: Partial<ConversionModifiers>) => void;
  targetFormat?: string;
}

export function BitrateCard({ options, onChange, targetFormat }: BitrateCardProps) {
  const targetExt = targetFormat ? (targetFormat.startsWith('.') ? targetFormat : '.' + targetFormat) : '';
  const isVideo = categoryOfExtension(targetExt) === 'video';
  const hasAudio = categoryOfExtension(targetExt) === 'audio' || isVideo;

  const currentVideoBitrate = options.videoBitrate || 'auto';
  const currentAudioBitrate = options.audioBitrate || 'auto';
  const isCustomVideo = currentVideoBitrate === 'custom' || Boolean(options.isCustomVideoBitrate);
  const isCustomAudio = currentAudioBitrate === 'custom' || Boolean(options.isCustomAudioBitrate);

  const videoPresets = [
    { id: 'auto', label: 'Automático', desc: 'VBR equilibrado' },
    { id: '1M', label: '1.0 Mbps', desc: 'Ultra-leve' },
    { id: '2.5M', label: '2.5 Mbps', desc: '720p HD' },
    { id: '5M', label: '5.0 Mbps', desc: '1080p padrão' },
    { id: '8M', label: '8.0 Mbps', desc: '1080p 60fps' },
    { id: '15M', label: '15 Mbps', desc: 'Máx. fidelidade' },
    { id: 'custom', label: 'Custom', desc: 'Definir kbps' },
  ];

  const audioPresets = [
    { id: 'auto', label: 'Automático', desc: 'Padrão (192k)' },
    { id: '96k', label: '96 kbps', desc: 'Voz / Podcasting' },
    { id: '128k', label: '128 kbps', desc: 'Padrão web' },
    { id: '192k', label: '192 kbps', desc: 'Alta qualidade' },
    { id: '256k', label: '256 kbps', desc: 'Fidelidade elevada' },
    { id: '320k', label: '320 kbps', desc: 'Máximo estéreo' },
    { id: 'custom', label: 'Custom', desc: 'Definir kbps' },
  ];

  return (
    <div className="space-y-3 pt-0.5">
      {/* Seção Vídeo */}
      {isVideo && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Typography variant="caption" color="muted">
              Taxa de bits de vídeo:
            </Typography>
            <span className="text-[11px] font-mono text-primary font-medium">
              {isCustomVideo
                ? `${options.customVideoBitrateKbps || 2500} kbps`
                : (videoPresets.find((p) => p.id === currentVideoBitrate)?.label || 'Automático')}
            </span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-7 gap-1">
            {videoPresets.map((preset) => {
              const isSelected = isCustomVideo ? preset.id === 'custom' : currentVideoBitrate === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    if (preset.id === 'custom') {
                      const val = options.customVideoBitrateKbps || 2500;
                      onChange({
                        videoBitrate: 'custom',
                        isCustomVideoBitrate: true,
                        customVideoBitrateKbps: val,
                      });
                    } else {
                      onChange({
                        videoBitrate: preset.id,
                        isCustomVideoBitrate: false,
                        customVideoBitrateKbps: undefined,
                      });
                    }
                  }}
                  className={cn(
                    'p-1.5 text-left rounded border transition-colors select-none',
                    isSelected
                      ? 'border-primary bg-primary/10 text-foreground font-medium'
                      : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground'
                  )}
                >
                  <div className="text-[10px] font-medium text-foreground">{preset.label}</div>
                  <div className="text-[9px] text-muted-foreground truncate">{preset.desc}</div>
                </button>
              );
            })}
          </div>

          {isCustomVideo && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] text-muted-foreground">Taxa de bits de vídeo customizada:</span>
              <input
                type="number"
                min="100"
                max="100000"
                step="100"
                value={options.customVideoBitrateKbps || 2500}
                onChange={(e) => {
                  const val = Math.max(100, Math.min(100000, parseInt(e.target.value, 10) || 100));
                  onChange({
                    customVideoBitrateKbps: val,
                    videoBitrate: `${val}k`,
                    isCustomVideoBitrate: true,
                  });
                }}
                className="w-24 rounded border border-primary bg-surface-raised px-2 py-0.5 text-xs text-foreground focus:outline-none"
              />
              <span className="text-[11px] text-muted-foreground font-mono">kbps (ex: 2500 = 2.5 Mbps)</span>
            </div>
          )}
        </div>
      )}

      {/* Seção Áudio */}
      {hasAudio && (
        <div className="space-y-1.5 border-t border-border/40 pt-2">
          <div className="flex items-center justify-between">
            <Typography variant="caption" color="muted">
              Taxa de bits de áudio:
            </Typography>
            <span className="text-[11px] font-mono text-primary font-medium">
              {isCustomAudio
                ? `${options.customAudioBitrateKbps || 192} kbps`
                : (audioPresets.find((p) => p.id === currentAudioBitrate)?.label || 'Automático')}
            </span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-7 gap-1">
            {audioPresets.map((preset) => {
              const isSelected = isCustomAudio ? preset.id === 'custom' : currentAudioBitrate === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    if (preset.id === 'custom') {
                      const val = options.customAudioBitrateKbps || 192;
                      onChange({
                        audioBitrate: 'custom',
                        isCustomAudioBitrate: true,
                        customAudioBitrateKbps: val,
                      });
                    } else {
                      onChange({
                        audioBitrate: preset.id,
                        isCustomAudioBitrate: false,
                        customAudioBitrateKbps: undefined,
                      });
                    }
                  }}
                  className={cn(
                    'p-1.5 text-left rounded border transition-colors select-none',
                    isSelected
                      ? 'border-primary bg-primary/10 text-foreground font-medium'
                      : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground'
                  )}
                >
                  <div className="text-[10px] font-medium text-foreground">{preset.label}</div>
                  <div className="text-[9px] text-muted-foreground truncate">{preset.desc}</div>
                </button>
              );
            })}
          </div>

          {isCustomAudio && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] text-muted-foreground">Taxa de bits de áudio customizada:</span>
              <input
                type="number"
                min="32"
                max="1024"
                step="16"
                value={options.customAudioBitrateKbps || 192}
                onChange={(e) => {
                  const val = Math.max(32, Math.min(1024, parseInt(e.target.value, 10) || 32));
                  onChange({
                    customAudioBitrateKbps: val,
                    audioBitrate: `${val}k`,
                    isCustomAudioBitrate: true,
                  });
                }}
                className="w-20 rounded border border-primary bg-surface-raised px-2 py-0.5 text-xs text-foreground focus:outline-none"
              />
              <span className="text-[11px] text-muted-foreground font-mono">kbps (32 a 1024 kbps)</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
