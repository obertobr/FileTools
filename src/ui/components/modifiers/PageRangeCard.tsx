import React from 'react';
import { Typography } from '@/ui/components/core';
import { cn } from '@/lib/utils';
import { AlertTriangle, BookOpen } from 'lucide-react';
import type { ConversionModifiers } from '@/shared/types/conversionModifiers';

export interface PageRangeCardProps {
  options: ConversionModifiers;
  onChange: (updated: Partial<ConversionModifiers>) => void;
  warningMessage?: string;
}

export function PageRangeCard({
  options,
  onChange,
  warningMessage,
}: PageRangeCardProps) {
  const currentRange = options.pageRange || 'all';
  const isCustom = options.isCustomPageRange || (currentRange !== 'all' && currentRange !== '1');

  const presets = [
    { id: 'all', label: 'Todas as páginas', desc: 'Converter documento integral' },
    { id: '1', label: 'Primeira página (Capa)', desc: 'Apenas a página 1' },
    { id: 'custom', label: 'Personalizado', desc: 'Definir intervalo (ex: 1-5, 1,3)' },
  ];

  return (
    <div className="space-y-2 pt-0.5">
      {warningMessage && (
        <div className="flex items-center gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{warningMessage}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Typography variant="caption" color="muted">
          Páginas a exportar / processar:
        </Typography>
        <span className="text-[11px] font-mono text-primary font-medium">
          {currentRange === 'all' ? 'Todas as páginas' : currentRange === '1' ? 'Página 1' : `Intervalo: ${currentRange}`}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
        {presets.map((preset) => {
          const isSelected = preset.id === 'custom' ? isCustom : (!isCustom && currentRange === preset.id);
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                if (preset.id === 'custom') {
                  onChange({
                    isCustomPageRange: true,
                    pageRange: currentRange === 'all' || currentRange === '1' ? '1-3' : currentRange,
                  });
                } else {
                  onChange({
                    isCustomPageRange: false,
                    pageRange: preset.id,
                  });
                }
              }}
              className={cn(
                'p-2 text-left rounded-md border transition-colors select-none',
                isSelected
                  ? 'border-primary bg-primary/10 text-foreground font-medium'
                  : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground'
              )}
            >
              <div className="text-[11px] font-medium text-foreground">{preset.label}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{preset.desc}</div>
            </button>
          );
        })}
      </div>

      {isCustom && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[11px] text-muted-foreground">Páginas ou intervalos:</span>
          <input
            type="text"
            placeholder="Ex: 1-5 ou 1,3,7"
            value={currentRange === 'all' ? '' : currentRange}
            onChange={(e) => {
              onChange({ pageRange: e.target.value });
            }}
            className="w-36 rounded border border-primary bg-surface-raised px-2 py-0.5 text-xs text-foreground focus:outline-none"
          />
          <span className="text-[10px] text-muted-foreground">Separe com hífen ou vírgula</span>
        </div>
      )}
    </div>
  );
}
