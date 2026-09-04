import React from 'react';
import { CheckSquare, Square, Info } from 'lucide-react';
import { Badge, Typography } from '@/ui/components/core';
import { cn } from '@/lib/utils';
import type { MediaProbeResult } from '@/core/media/mediaProbe';

export interface SubtitlesCardProps {
  selectedTracks: number[];
  onChange: (tracks: number[]) => void;
  probedMedia?: MediaProbeResult;
}

export function SubtitlesCard({ selectedTracks, onChange, probedMedia }: SubtitlesCardProps) {
  const realSubtitles = probedMedia?.subtitleStreams || [];
  const hasNoSubtitles = probedMedia && realSubtitles.length === 0;

  function toggleTrack(index: number) {
    const exists = selectedTracks.includes(index);
    const next = exists ? selectedTracks.filter((i) => i !== index) : [...selectedTracks, index].sort((a, b) => a - b);
    onChange(next);
  }

  function selectAll() {
    onChange(realSubtitles.map((_, idx) => idx));
  }

  function deselectAll() {
    onChange([]);
  }

  if (hasNoSubtitles) {
    return (
      <div className="p-3 rounded-md border border-border bg-surface-raised/40 space-y-1.5 text-center">
        <div className="flex justify-center text-muted-foreground">
          <Info className="size-4 text-primary" />
        </div>
        <Typography variant="body" className="font-medium text-xs text-foreground">
          Nenhuma faixa de legenda encontrada
        </Typography>
        <Typography variant="caption" color="muted" className="block text-[11px]">
          Este arquivo não possui legendas embutidas no contêiner. Nenhuma ação de legenda é necessária.
        </Typography>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          {realSubtitles.length} {realSubtitles.length === 1 ? 'legenda detectada' : 'legendas detectadas'}. Gerencie quais deseja preservar:
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={selectAll}
            className="text-[10px] text-primary hover:underline font-medium"
          >
            Manter Todas
          </button>
          <span className="text-border text-xs">•</span>
          <button
            type="button"
            onClick={deselectAll}
            className="text-[10px] text-muted-foreground hover:text-foreground font-medium"
          >
            Remover Todas
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        {realSubtitles.map((sub, idx) => {
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
                    {sub.title || `Legenda ${idx + 1}`}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    Stream #{sub.streamIndex || idx + 1}{sub.language ? ` • ${sub.language}` : ''}{sub.codec ? ` • ${sub.codec}` : ''}
                  </div>
                </div>
              </div>

              <Badge
                variant={isChecked ? 'primary' : 'default'}
                size="sm"
                className="text-[10px] shrink-0"
              >
                {isChecked ? 'Preservar' : 'Ignorar'}
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}
