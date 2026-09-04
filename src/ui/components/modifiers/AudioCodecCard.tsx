import React, { useEffect } from 'react';
import { Typography } from '@/ui/components/core';
import { cn } from '@/lib/utils';
import type { AudioCodecChoice, ConversionModifiers } from '@/shared/types/conversionModifiers';
import type { MediaProbeResult } from '@/core/media/mediaProbe';
import { AlertTriangle } from 'lucide-react';
import {
  AUDIO_CODEC_PRESETS,
  DEFAULT_AUDIO_CODECS,
  normalizeProbedCodec,
  type AudioCodecPresetData,
} from '@/core/knowledge/audioCodecs';

export interface AudioCodecCardProps {
  options: ConversionModifiers;
  onChange: (updated: Partial<ConversionModifiers>) => void;
  probedMedia?: MediaProbeResult;
  allowedOptions?: (string | number)[];
  warningMessage?: string;
}

export function AudioCodecCard({
  options,
  onChange,
  probedMedia,
  allowedOptions,
  warningMessage,
}: AudioCodecCardProps) {
  const audioStreams = probedMedia?.audioStreams || options.probedMedia?.audioStreams || [];
  const hasMultipleTracks = audioStreams.length > 1;

  // 1. Determine active allowed options directly from props or knowledge base
  const activeAllowed: AudioCodecChoice[] = allowedOptions && allowedOptions.length > 0
    ? (allowedOptions.map(String) as AudioCodecChoice[])
    : DEFAULT_AUDIO_CODECS;

  const availableAudioCodecs: AudioCodecPresetData[] = activeAllowed
    .filter((id) => AUDIO_CODEC_PRESETS[id])
    .map((id) => AUDIO_CODEC_PRESETS[id]);

  // Initial detection: if multiple tracks, check if all have the same probed codec
  useEffect(() => {
    if (audioStreams.length > 0 && (!options.trackAudioCodecs || Object.keys(options.trackAudioCodecs).length === 0)) {
      const initialMap: Record<number, AudioCodecChoice> = {};
      const detectedSet = new Set<AudioCodecChoice>();

      audioStreams.forEach((stream, idx) => {
        const detected = normalizeProbedCodec(stream.codec);
        initialMap[idx] = detected;
        if (detected !== 'auto') detectedSet.add(detected);
      });

      const allSame = detectedSet.size <= 1;
      const commonCodec = detectedSet.size === 1 ? Array.from(detectedSet)[0] : (options.audioCodec || 'auto');

      onChange({
        trackAudioCodecs: initialMap,
        syncAllAudioCodecs: allSame,
        audioCodec: commonCodec,
      });
    }
  }, [audioStreams, options.trackAudioCodecs]);

  const syncAll = options.syncAllAudioCodecs !== false;

  function handleSetGlobalCodec(codec: AudioCodecChoice) {
    const updatedMap: Record<number, AudioCodecChoice> = {};
    audioStreams.forEach((_, idx) => {
      updatedMap[idx] = codec;
    });
    onChange({
      audioCodec: codec,
      trackAudioCodecs: updatedMap,
    });
  }

  function handleSetTrackCodec(trackIndex: number, codec: AudioCodecChoice) {
    const nextMap = { ...(options.trackAudioCodecs || {}), [trackIndex]: codec };
    onChange({
      trackAudioCodecs: nextMap,
      audioCodec: codec,
    });
  }

  const currentGlobalLabel = availableAudioCodecs.find((c) => c.id === options.audioCodec)?.label || 'Automático';

  return (
    <div className="space-y-2.5">
      {warningMessage && (
        <div className="flex items-start gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px]">
          <AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-amber-400" />
          <span>{warningMessage}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Typography variant="caption" color="muted">
          Codificador de áudio:
        </Typography>
        <span className="text-[11px] font-mono text-primary font-medium">
          {syncAll ? currentGlobalLabel : 'Personalizado por faixa'}
        </span>
      </div>

      {hasMultipleTracks && (
        <div className="flex items-center justify-between p-2 rounded-md border border-border bg-surface-raised/40">
          <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-foreground font-medium">
            <input
              type="checkbox"
              checked={syncAll}
              onChange={(e) => {
                const nextSync = e.target.checked;
                const currentGlobal = options.audioCodec || 'auto';
                if (nextSync) {
                  const updatedMap: Record<number, AudioCodecChoice> = {};
                  audioStreams.forEach((_, idx) => {
                    updatedMap[idx] = currentGlobal;
                  });
                  onChange({ syncAllAudioCodecs: true, trackAudioCodecs: updatedMap });
                } else {
                  onChange({ syncAllAudioCodecs: false });
                }
              }}
              className="rounded border-border text-primary focus:ring-primary size-3.5"
            />
            <span>Sincronizar todas as faixas (mesmo codec para todas)</span>
          </label>
          <span className="text-[10px] text-muted-foreground font-mono">
            {audioStreams.length} faixas detectadas
          </span>
        </div>
      )}

      {/* Global selector when syncAll is true or single track */}
      {(!hasMultipleTracks || syncAll) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {availableAudioCodecs.map((codec) => {
            const isSelected = (options.audioCodec || 'auto') === codec.id;
            return (
              <button
                key={codec.id}
                type="button"
                onClick={() => handleSetGlobalCodec(codec.id)}
                className={cn(
                  'p-2 text-left rounded-md border transition-colors select-none',
                  isSelected
                    ? 'border-primary bg-primary/10 text-foreground font-medium'
                    : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground'
                )}
              >
                <div className="text-[11px] font-medium text-foreground">{codec.label}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{codec.desc}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* Per-track selector when has multiple tracks and syncAll is false */}
      {hasMultipleTracks && !syncAll && (
        <div className="space-y-2 border-t border-border/40 pt-2">
          {audioStreams.map((stream, idx) => {
            const currentTrackCodec = options.trackAudioCodecs?.[idx] || normalizeProbedCodec(stream.codec);
            return (
              <div key={idx} className="p-2 rounded-md border border-border bg-surface-raised/30 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-medium text-foreground">
                    Faixa {idx + 1}{stream.title ? `: ${stream.title}` : ''}
                    {stream.codec ? (
                      <span className="ml-1.5 text-[10px] text-muted-foreground font-mono">
                        (origem: {stream.codec})
                      </span>
                    ) : null}
                  </div>
                  <span className="text-[10px] font-mono text-primary font-semibold uppercase">
                    {currentTrackCodec}
                  </span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1">
                  {availableAudioCodecs.map((codec) => {
                    const isSelected = currentTrackCodec === codec.id;
                    return (
                      <button
                        key={codec.id}
                        type="button"
                        onClick={() => handleSetTrackCodec(idx, codec.id)}
                        className={cn(
                          'px-1.5 py-1 text-center rounded border transition-colors select-none text-[10px] font-medium',
                          isSelected
                            ? 'border-primary bg-primary/10 text-primary font-semibold'
                            : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {codec.label.split(' ')[0]}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
