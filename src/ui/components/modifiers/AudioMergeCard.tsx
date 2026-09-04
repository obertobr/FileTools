import React, { useRef, useEffect } from 'react';
import { Layers, Info, CheckSquare, Square, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { Badge, Typography } from '@/ui/components/core';
import { cn } from '@/lib/utils';
import type { MediaProbeResult } from '@/core/media/mediaProbe';

export interface AudioMergeCardProps {
  selectedTracks: number[];
  onChange: (tracks: number[]) => void;
  probedMedia?: MediaProbeResult;
  targetFormat?: string;
  isLocked?: boolean;
  lockReason?: string;
  warningMessage?: string;
}

export function AudioMergeCard({
  selectedTracks,
  onChange,
  probedMedia,
  isLocked,
  lockReason,
  warningMessage,
}: AudioMergeCardProps) {

  // If still probing, display a non-blocking loading state
  if (!probedMedia) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-md border border-border bg-surface-raised/40 text-[11px] text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin text-primary shrink-0" />
        <span>Inspecionando faixas de áudio do arquivo de origem...</span>
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
          O arquivo de origem não possui canais de áudio para mesclar.
        </Typography>
      </div>
    );
  }

  // Por padrão, selecionar todas as faixas na primeira renderização se nenhuma estiver selecionada
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current && realAudioStreams.length > 0) {
      initializedRef.current = true;
      if (selectedTracks.length === 0) {
        onChange(realAudioStreams.map((_, idx) => idx));
      }
    }
  }, [realAudioStreams, selectedTracks, onChange]);

  function handleToggleTrack(index: number) {
    const exists = selectedTracks.includes(index);
    const next = exists
      ? selectedTracks.filter((i) => i !== index)
      : [...selectedTracks, index].sort((a, b) => a - b);
    onChange(next);
  }

  function selectAll() {
    onChange(realAudioStreams.map((_, idx) => idx));
  }

  function selectOnlyFirst() {
    onChange([0]);
  }

  function deselectAll() {
    onChange([]);
  }

  const isMultiple = selectedTracks.length > 1;
  const isSingle = selectedTracks.length === 1;
  const isNone = selectedTracks.length === 0;

  return (
    <div className="space-y-3">
      {isLocked && (
        <div className="p-2.5 rounded-lg border border-primary/40 bg-primary/10 flex items-center gap-2.5 text-primary text-[11px] font-medium">
          <Info className="size-4 text-primary shrink-0" />
          <span>{lockReason || 'Obrigatório para esta conversão.'}</span>
        </div>
      )}

      {warningMessage && (
        <div className="p-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 flex items-start gap-2.5 text-amber-300 text-[11px]">
          <AlertTriangle className="size-4 text-amber-400 shrink-0 mt-0.5" />
          <span>{warningMessage}</span>
        </div>
      )}

      {/* Banner Informativo Dinâmico */}
      {isMultiple && (
        <div className="p-2.5 rounded-lg border border-primary/40 bg-primary/5 flex items-start gap-2.5">
          <Layers className="size-4 text-primary shrink-0 mt-0.5" />
          <div className="space-y-0.5 min-w-0">
            <div className="text-[12px] font-semibold text-foreground flex items-center gap-1.5">
              Mixagem Ativada ({selectedTracks.length} faixas combinadas)
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Todas as faixas marcadas abaixo serão mixadas em um único fluxo de áudio no arquivo final.
            </p>
          </div>
        </div>
      )}

      {isSingle && (
        <div className="p-2.5 rounded-lg border border-sky-500/40 bg-sky-500/5 flex items-start gap-2.5">
          <CheckCircle2 className="size-4 text-sky-500 shrink-0 mt-0.5" />
          <div className="space-y-0.5 min-w-0">
            <div className="text-[12px] font-semibold text-foreground flex items-center gap-1.5">
              Extração Direta (Faixa {selectedTracks[0] + 1})
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Apenas esta faixa selecionada fará parte do arquivo final, sem mixagem.
            </p>
          </div>
        </div>
      )}

      {isNone && (
        <div className="p-2.5 rounded-lg border border-destructive/40 bg-destructive/10 flex items-start gap-2.5">
          <AlertTriangle className="size-4 text-destructive shrink-0 mt-0.5" />
          <div className="space-y-0.5 min-w-0">
            <div className="text-[12px] font-semibold text-destructive">
              Nenhuma faixa selecionada
            </div>
            <p className="text-[11px] text-destructive/80 leading-relaxed">
              O arquivo final será gerado mudo (sem áudio). Selecione ao menos 1 faixa.
            </p>
          </div>
        </div>
      )}

      {/* Ações Rápidas de Seleção */}
      <div className="flex items-center justify-between pt-0.5">
        <span className="text-[11px] text-muted-foreground font-medium">
          {realAudioStreams.length} {realAudioStreams.length === 1 ? 'faixa disponível' : 'faixas disponíveis'}:
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={selectAll}
            className="text-[10px] text-primary hover:underline font-medium"
          >
            Mixar Todas
          </button>
          <span className="text-border text-xs">|</span>
          <button
            type="button"
            onClick={selectOnlyFirst}
            className="text-[10px] text-muted-foreground hover:text-foreground font-medium"
          >
            Apenas 1ª Faixa
          </button>
          <span className="text-border text-xs">|</span>
          <button
            type="button"
            onClick={deselectAll}
            className="text-[10px] text-muted-foreground hover:text-foreground font-medium"
          >
            Desmarcar
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
              onClick={() => handleToggleTrack(idx)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleToggleTrack(idx);
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
                    Faixa {idx + 1}{stream.title ? `: ${stream.title}` : (idx === 0 ? ' (Áudio Principal)' : '')}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    Stream #{stream.streamIndex || idx + 1}
                    {stream.codec ? ` • ${stream.codec}` : ''}
                    {stream.language ? ` [${stream.language}]` : ''}
                  </div>
                </div>
              </div>

              <Badge
                variant={isChecked ? 'primary' : 'default'}
                size="sm"
                className="text-[10px] shrink-0"
              >
                {isChecked ? (isMultiple ? 'Mixar' : 'Extrair') : 'Ignorada'}
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}
