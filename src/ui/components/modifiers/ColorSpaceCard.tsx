import React from 'react';
import { Typography } from '@/ui/components/core';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';
import type { ConversionModifiers, ColorSpaceChoice } from '@/shared/types/conversionModifiers';
import {
  COLOR_SPACE_PRESETS,
  DEFAULT_COLOR_SPACES,
  type ColorSpacePresetData,
} from '@/core/knowledge/colorPresets';

export interface ColorSpaceCardProps {
  options: ConversionModifiers;
  onChange: (updated: Partial<ConversionModifiers>) => void;
  allowedOptions?: (string | number)[];
  warningMessage?: string;
}

export function ColorSpaceCard({
  options,
  onChange,
  allowedOptions,
  warningMessage,
}: ColorSpaceCardProps) {
  const currentSpace = options.colorSpace || 'auto';

  const activeAllowed: ColorSpaceChoice[] = allowedOptions && allowedOptions.length > 0
    ? (allowedOptions.map(String) as ColorSpaceChoice[])
    : DEFAULT_COLOR_SPACES;

  const presets: ColorSpacePresetData[] = activeAllowed
    .filter((id) => COLOR_SPACE_PRESETS[id])
    .map((id) => COLOR_SPACE_PRESETS[id]);

  const currentLabel = COLOR_SPACE_PRESETS[currentSpace]?.label || 'Automático';

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
          Espaço de cor, primárias e matriz:
        </Typography>
        <span className="text-[11px] font-mono text-primary font-medium">
          {currentLabel}
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
