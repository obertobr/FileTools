import React, { useEffect, useMemo } from 'react';
import { Typography } from '@/ui/components/core';
import { cn } from '@/lib/utils';
import type { AudioCodecChoice, ConversionModifiers } from '@/shared/types/conversionModifiers';
import type { MediaProbeResult } from '@/core/media/mediaProbe';

export interface AudioCodecCardProps {
  options: ConversionModifiers;
  onChange: (updated: Partial<ConversionModifiers>) => void;
  targetFormat?: string;
  probedMedia?: MediaProbeResult;
}

function normalizeProbedCodec(rawCodec?: string): AudioCodecChoice {
  if (!rawCodec) return 'auto';
  const c = rawCodec.toLowerCase();
  if (c.includes('aac') || c.includes('mp4a')) return 'aac';
  if (c.includes('mp3') || c.includes('mpeg/l3') || c.includes('lame')) return 'mp3';
  if (c.includes('opus')) return 'opus';
  if (c.includes('vorbis')) return 'vorbis';
  if (c.includes('flac')) return 'flac';
  if (c.includes('pcm') || c.includes('wav')) return 'pcm';
  if (c.includes('ac3') || c.includes('ac-3') || c.includes('eac3')) return 'ac3';
  return 'auto';
}

export function AudioCodecCard({
  options,
  onChange,
  targetFormat,
  probedMedia,
}: AudioCodecCardProps) {
  const target = (targetFormat || '').toLowerCase().replace(/^\.+/, '');
  const audioStreams = probedMedia?.audioStreams || options.probedMedia?.audioStreams || [];
  const hasMultipleTracks = audioStreams.length > 1;

  const availableAudioCodecs = useMemo(() => {
    const all: { id: AudioCodecChoice; label: string; desc: string }[] = [
      { id: 'auto', label: 'Automático', desc: 'Padrão recomendado' },
      { id: 'mp3', label: 'MP3 (LAME)', desc: 'Universalmente compatível' },
      { id: 'aac', label: 'AAC', desc: 'Alta fidelidade e eficiência' },
      { id: 'opus', label: 'Opus (48kHz)', desc: 'Voz e música de ponta' },
      { id: 'vorbis', label: 'Ogg Vorbis', desc: 'Padrão livre e aberto' },
      { id: 'flac', label: 'FLAC (Lossless)', desc: 'Áudio sem perdas' },
      { id: 'pcm', label: 'PCM Linear (WAV)', desc: 'Sem compressão' },
      { id: 'ac3', label: 'AC-3 (Dolby)', desc: 'Cinema / surround' },
      { id: 'copy', label: 'Cópia (Passthrough)', desc: 'Sem recodificação' },
    ];
    if (target === 'mp3') return all.filter((c) => ['auto', 'mp3', 'copy'].includes(c.id));
    if (target === 'wav') return all.filter((c) => ['auto', 'pcm', 'copy'].includes(c.id));
    if (target === 'ogg') return all.filter((c) => ['auto', 'vorbis', 'opus', 'flac', 'copy'].includes(c.id));
    if (target === 'opus') return all.filter((c) => ['auto', 'opus', 'copy'].includes(c.id));
    if (target === 'flac') return all.filter((c) => ['auto', 'flac', 'copy'].includes(c.id));
    if (target === 'm4a' || target === 'aac' || target === 'm4r') return all.filter((c) => ['auto', 'aac', 'copy'].includes(c.id));
    if (target === 'ac3') return all.filter((c) => ['auto', 'ac3', 'copy'].includes(c.id));
    if (target === 'webm') return all.filter((c) => ['auto', 'vorbis', 'opus', 'copy'].includes(c.id));
    if (target === 'mp4' || target === 'mov' || target === 'm4v') return all.filter((c) => ['auto', 'aac', 'mp3', 'ac3', 'copy'].includes(c.id));
    return all;
  }, [target]);

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
      // If setting a track individually, global reflects the first track or mixed
      audioCodec: codec,
    });
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <Typography variant="caption" color="muted">
          Codificador de áudio para {target.toUpperCase()}:
        </Typography>
        <span className="text-[11px] font-mono text-primary font-medium">
          {syncAll
            ? (availableAudioCodecs.find((c) => c.id === options.audioCodec)?.label || 'Automático')
            : 'Personalizado por faixa'}
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
