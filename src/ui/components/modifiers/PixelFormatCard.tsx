import React from 'react';
import { Typography } from '@/ui/components/core';
import { cn } from '@/lib/utils';
import type { ConversionModifiers, PixelFormatChoice } from '@/shared/types/conversionModifiers';

export interface PixelFormatCardProps {
  options: ConversionModifiers;
  onChange: (updated: Partial<ConversionModifiers>) => void;
}

export function PixelFormatCard({ options, onChange }: PixelFormatCardProps) {
  const currentFormat = options.pixelFormat || 'auto';

  const presets: { id: PixelFormatChoice; label: string; desc: string }[] = [
    { id: 'auto', label: 'Automático', desc: 'Padrão recomendado' },
    { id: 'yuv420p', label: 'YUV 4:2:0 (8-bit)', desc: 'Universal (Web / Celular / TV)' },
    { id: 'yuv422p', label: 'YUV 4:2:2', desc: 'Alta fidelidade de croma' },
    { id: 'yuv444p', label: 'YUV 4:4:4', desc: 'Sem subamostragem cromática' },
    { id: 'yuv420p10le', label: 'YUV 4:2:0 (10-bit)', desc: 'HDR e gradientes suaves' },
    { id: 'rgb24', label: 'RGB 24-bit', desc: 'RGB puro sem matriz YUV' },
    { id: 'gray', label: 'Escala de Cinza', desc: 'Preto e branco ultra-leve' },
  ];

  return (
    <div className="space-y-2 pt-0.5">
      <div className="flex items-center justify-between">
        <Typography variant="caption" color="muted">
          Formato de pixel e amostragem de cores:
        </Typography>
        <span className="text-[11px] font-mono text-primary font-medium">
          {presets.find((p) => p.id === currentFormat)?.label || 'Automático'}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {presets.map((preset) => {
          const isSelected = currentFormat === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onChange({ pixelFormat: preset.id })}
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
    </div>
  );
}
