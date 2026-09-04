import React from 'react';
import { Typography } from '@/ui/components/core';
import { cn } from '@/lib/utils';
import type { ConversionModifiers, ColorSpaceChoice } from '@/shared/types/conversionModifiers';

export interface ColorSpaceCardProps {
  options: ConversionModifiers;
  onChange: (updated: Partial<ConversionModifiers>) => void;
}

export function ColorSpaceCard({ options, onChange }: ColorSpaceCardProps) {
  const currentSpace = options.colorSpace || 'auto';

  const presets: { id: ColorSpaceChoice; label: string; desc: string }[] = [
    { id: 'auto', label: 'Automático', desc: 'Preserva espaço original' },
    { id: 'bt709', label: 'Rec. 709 (HD / Web)', desc: 'Padrão universal HDTV e internet SDR' },
    { id: 'bt2020', label: 'Rec. 2020 (4K / HDR)', desc: 'Ampla gama de cores (Wide Color Gamut)' },
    { id: 'smpte170m', label: 'Rec. 601 (NTSC)', desc: 'Definição padrão analógica NTSC' },
    { id: 'bt470bg', label: 'Rec. 601 (PAL)', desc: 'Definição padrão PAL / 625 linhas' },
    { id: 'srgb', label: 'sRGB', desc: 'Monitores de PC e gráficos' },
  ];

  return (
    <div className="space-y-2 pt-0.5">
      <div className="flex items-center justify-between">
        <Typography variant="caption" color="muted">
          Espaço de cor, primárias e matriz:
        </Typography>
        <span className="text-[11px] font-mono text-primary font-medium">
          {presets.find((p) => p.id === currentSpace)?.label || 'Automático'}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {presets.map((preset) => {
          const isSelected = currentSpace === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onChange({ colorSpace: preset.id })}
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
