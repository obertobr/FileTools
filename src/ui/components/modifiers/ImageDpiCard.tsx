import React from 'react';
import { Typography } from '@/ui/components/core';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';
import type { ConversionModifiers, ImageDpiChoice } from '@/shared/types/conversionModifiers';

export interface ImageDpiCardProps {
  options: ConversionModifiers;
  onChange: (updated: Partial<ConversionModifiers>) => void;
  warningMessage?: string;
}

export function ImageDpiCard({
  options,
  onChange,
  warningMessage,
}: ImageDpiCardProps) {
  const currentDpi: ImageDpiChoice = (options.imageDpi as ImageDpiChoice) || 150;

  const presets: { id: ImageDpiChoice; label: string; desc: string; badge?: string }[] = [
    { id: 72, label: '72 DPI', desc: 'Web e telas rápidas (menor tamanho)' },
    { id: 150, label: '150 DPI', desc: 'Resolução padrão balanceada', badge: 'Padrão' },
    { id: 300, label: '300 DPI', desc: 'Alta definição para impressão', badge: 'Impressão' },
    { id: 600, label: '600 DPI', desc: 'Ultra alta nitidez e detalhes finos', badge: 'Ultra' },
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
          Densidade de renderização da imagem:
        </Typography>
        <span className="text-[11px] font-mono text-primary font-medium">
          {currentDpi} DPI
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {presets.map((preset) => {
          const isSelected = currentDpi === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                onChange({ imageDpi: preset.id });
              }}
              className={cn(
                'p-2 text-left rounded-md border transition-colors select-none relative',
                isSelected
                  ? 'border-primary bg-primary/10 text-foreground font-medium'
                  : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-medium text-foreground">{preset.label}</div>
                {preset.badge && (
                  <span className="text-[8px] px-1 py-0.2 rounded bg-primary/20 text-primary font-mono font-normal">
                    {preset.badge}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{preset.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
