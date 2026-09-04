import React from 'react';
import { Typography } from '@/ui/components/core';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';
import type { ConversionModifiers } from '@/shared/types/conversionModifiers';
import {
  VIDEO_BITRATE_PRESETS,
  AUDIO_BITRATE_PRESETS,
  DEFAULT_VIDEO_BITRATE_OPTIONS,
  DEFAULT_AUDIO_BITRATE_OPTIONS,
  type BitratePresetData,
} from '@/core/knowledge/bitratePresets';

export interface BitrateCardProps {
  options: ConversionModifiers;
  onChange: (updated: Partial<ConversionModifiers>) => void;
  allowedOptions?: (string | number)[];
  warningMessage?: string;
}

export function BitrateCard({
  options,
  onChange,
  allowedOptions,
  warningMessage,
}: BitrateCardProps) {
  // Check if constrained by rules engine (e.g., audio only)
  const isAudioOnly = allowedOptions?.includes('audio_only');
  const isVideoOnly = allowedOptions?.includes('video_only');

  const showVideo = !isAudioOnly;
  const showAudio = !isVideoOnly;

  const currentVideoBitrate = options.videoBitrate || 'auto';
  const currentAudioBitrate = options.audioBitrate || 'auto';
  const isCustomVideo = currentVideoBitrate === 'custom' || Boolean(options.isCustomVideoBitrate);
  const isCustomAudio = currentAudioBitrate === 'custom' || Boolean(options.isCustomAudioBitrate);

  const videoPresets: BitratePresetData[] = DEFAULT_VIDEO_BITRATE_OPTIONS
    .filter((id) => VIDEO_BITRATE_PRESETS[id])
    .map((id) => VIDEO_BITRATE_PRESETS[id]);

  const audioPresets: BitratePresetData[] = DEFAULT_AUDIO_BITRATE_OPTIONS
    .filter((id) => AUDIO_BITRATE_PRESETS[id])
    .map((id) => AUDIO_BITRATE_PRESETS[id]);

  return (
    <div className="space-y-3 pt-0.5">
      {warningMessage && (
        <div className="flex items-center gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{warningMessage}</span>
        </div>
      )}

      {/* Seção Vídeo */}
      {showVideo && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Typography variant="caption" color="muted">
              Taxa de bits de vídeo:
            </Typography>
            <span className="text-[11px] font-mono text-primary font-medium">
              {isCustomVideo
                ? `${options.customVideoBitrateKbps || 2500} kbps`
                : (VIDEO_BITRATE_PRESETS[currentVideoBitrate]?.label || 'Automático')}
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
                  const val = Math.max(100, Math.min(100000, parseInt(e.target.value, 10) || 2500));
                  onChange({ videoBitrate: 'custom', isCustomVideoBitrate: true, customVideoBitrateKbps: val });
                }}
                className="w-24 rounded border border-primary bg-surface-raised px-2 py-0.5 text-xs text-foreground focus:outline-none font-mono"
              />
              <span className="text-[11px] text-muted-foreground font-mono">kbps (100 a 100000)</span>
            </div>
          )}
        </div>
      )}

      {/* Seção Áudio */}
      {showAudio && (
        <div className="space-y-1.5 pt-1 border-t border-border/40">
          <div className="flex items-center justify-between">
            <Typography variant="caption" color="muted">
              Taxa de bits de áudio:
            </Typography>
            <span className="text-[11px] font-mono text-primary font-medium">
              {isCustomAudio
                ? `${options.customAudioBitrateKbps || 192} kbps`
                : (AUDIO_BITRATE_PRESETS[currentAudioBitrate]?.label || 'Automático')}
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
                  const val = Math.max(32, Math.min(1024, parseInt(e.target.value, 10) || 192));
                  onChange({ audioBitrate: 'custom', isCustomAudioBitrate: true, customAudioBitrateKbps: val });
                }}
                className="w-24 rounded border border-primary bg-surface-raised px-2 py-0.5 text-xs text-foreground focus:outline-none font-mono"
              />
              <span className="text-[11px] text-muted-foreground font-mono">kbps (32 a 1024)</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
