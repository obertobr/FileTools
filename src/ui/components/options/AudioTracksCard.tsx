import React from 'react';
import { CheckSquare, Square, Info, Loader2 } from 'lucide-react';
import { Badge, Typography } from '@/ui/components/core';
import { cn } from '@/lib/utils';
import type { MediaProbeResult } from '@/core/media/mediaProbe';

export interface AudioTracksCardProps {
  selectedTracks: number[];
  onChange: (tracks: number[]) => void;
  probedMedia?: MediaProbeResult;
}

export function AudioTracksCard({ selectedTracks, onChange, probedMedia }: AudioTracksCardProps) {
  // If still probing, display a non-blocking loading state
  if (!probedMedia) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-md border border-border bg-surface-raised/40 text-[11px] text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin text-primary shrink-0" />
        <span>Inspecionando faixas de áudio do contêiner...</span>
      </div>
    );
  }

  const realAudioStreams = probedMedia.audioStreams;

  // Real detection: No audio streams present in the file
  if (realAudioStreams.length === 0) {
    return (
      <div className="p-3 rounded-md border border-border bg-surface-raised/40 space-y-1.5 text-center">
        <div className="flex justify-center text-muted-foreground">
          <Info className="size-4 text-primary" />
        </div>
        <Typography variant="body" className="font-medium text-xs text-foreground">
          Nenhuma faixa de áudio encontrada
        </Typography>
        <Typography variant="caption" color="muted" className="block text-[11px]">
          Este arquivo não possui canais de áudio. O vídeo é mudo.
        </Typography>
      </div>
    );
  }

  function toggleTrack(index: number) {
    const exists = selectedTracks.includes(index);
    const next = exists ? selectedTracks.filter((i) => i !== index) : [...selectedTracks, index].sort((a, b) => a - b);
    onChange(next);
  }

  function selectAll() {
    onChange(realAudioStreams.map((_, idx) => idx));
  }

  function deselectAll() {
    onChange([]);
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          {realAudioStreams.length} {realAudioStreams.length === 1 ? 'faixa real detectada' : 'faixas reais detectadas'}. Todas selecionadas por padrão:
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={selectAll}
            className="text-[10px] text-primary hover:underline font-medium"
          >
            Selecionar Todas
          </button>
          <span className="text-border text-xs">•</span>
          <button
            type="button"
            onClick={deselectAll}
            className="text-[10px] text-muted-foreground hover:text-foreground font-medium"
          >
            Desmarcar Todas
          </button>
        </div>
      </div>

      {/* Lista Vertical de Faixas Reais */}
      <div className="space-y-1.5">
        {realAudioStreams.map((stream, idx) => {
          const isChecked = selectedTracks.includes(idx);
          return (
            <div
              key={idx}
              role="button"
              tabIndex={0}
              onClick={() => toggleTrack(idx)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleTrack(idx);
                }
              }}
              className={cn(
                'flex items-center justify-between p-2 rounded-md border transition-all select-none cursor-pointer',
                isChecked
                  ? 'border-primary/50 bg-primary/5 text-foreground'
                  : 'border-border bg-surface-raised/40 text-muted-foreground hover:border-border-strong'
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={cn('text-primary shrink-0', !isChecked && 'text-muted-foreground')}>
                  {isChecked ? <CheckSquare className="size-4" /> : <Square className="size-4" />}
                </span>
                <div className="min-w-0">
                  <div className={cn('text-[12px] font-medium', isChecked && 'text-foreground')}>
                    Faixa {idx + 1}{stream.title ? `: ${stream.title}` : ''}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    Stream #{stream.streamIndex || idx + 1}{stream.codec ? ` • ${stream.codec}` : ''}{stream.language ? ` [${stream.language}]` : ''}
                  </div>
                </div>
              </div>

              <Badge
                variant={isChecked ? 'primary' : 'default'}
                size="sm"
                className="text-[10px] shrink-0"
              >
                {isChecked ? 'Incluída' : 'Descartada'}
              </Badge>
            </div>
          );
        })}
      </div>

      {selectedTracks.length === 0 && (
        <div className="p-2 rounded border border-destructive/30 bg-destructive-subtle/20 text-[11px] text-destructive flex items-center gap-1.5">
          <Info className="size-3.5 shrink-0" />
          <span>Atenção: Nenhuma faixa selecionada. O arquivo final ficará mudo (sem áudio).</span>
        </div>
      )}
    </div>
  );
}
