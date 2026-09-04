import React from 'react';
import { Typography } from '@/ui/components/core';
import { cn } from '@/lib/utils';
import type { ConversionModifiers, BitDepthChoice } from '@/shared/types/conversionModifiers';

export interface BitDepthCardProps {
  options: ConversionModifiers;
  onChange: (updated: Partial<ConversionModifiers>) => void;
}

export function BitDepthCard({ options, onChange }: BitDepthCardProps) {
  const currentDepth = options.bitDepth || 'auto';

  const presets: { id: BitDepthChoice; label: string; desc: string }[] = [
    { id: 'auto', label: 'Automático', desc: 'Padrão do codec' },
    { id: '8bit', label: '8-bit (SDR)', desc: '16.7M cores • Máxima compatibilidade' },
    { id: '10bit', label: '10-bit (HDR)', desc: '1.07B cores • Evita color banding em gradientes' },
    { id: '12bit', label: '12-bit (Master)', desc: 'Masterização profissional / cinema' },
  ];

  return (
    <div className="space-y-2 pt-0.5">
      <div className="flex items-center justify-between">
        <Typography variant="caption" color="muted">
          Profundidade de cor (bits por canal):
        </Typography>
        <span className="text-[11px] font-mono text-primary font-medium">
          {presets.find((p) => p.id === currentDepth)?.label || 'Automático'}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {presets.map((preset) => {
          const isSelected = currentDepth === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onChange({ bitDepth: preset.id })}
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
