import React from 'react';
import { Typography } from '@/ui/components/core';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';
import type { ConversionModifiers, BitDepthChoice } from '@/shared/types/conversionModifiers';
import {
  BIT_DEPTH_PRESETS,
  DEFAULT_BIT_DEPTHS,
  type BitDepthPresetData,
} from '@/core/knowledge/colorPresets';

export interface BitDepthCardProps {
  options: ConversionModifiers;
  onChange: (updated: Partial<ConversionModifiers>) => void;
  allowedOptions?: (string | number)[];
  warningMessage?: string;
}

export function BitDepthCard({
  options,
  onChange,
  allowedOptions,
  warningMessage,
}: BitDepthCardProps) {
  const currentDepth = options.bitDepth || 'auto';

  const activeAllowed: BitDepthChoice[] = allowedOptions && allowedOptions.length > 0
    ? (allowedOptions.map(String) as BitDepthChoice[])
    : DEFAULT_BIT_DEPTHS;

  const presets: BitDepthPresetData[] = activeAllowed
    .filter((id) => BIT_DEPTH_PRESETS[id])
    .map((id) => BIT_DEPTH_PRESETS[id]);

  const currentLabel = BIT_DEPTH_PRESETS[currentDepth]?.label || 'Automático';

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
          Profundidade de cor (bits por canal):
        </Typography>
        <span className="text-[11px] font-mono text-primary font-medium">
          {currentLabel}
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
