import React from 'react';
import { Typography } from '@/ui/components/core';
import { cn } from '@/lib/utils';
import type { ConversionOptions } from '@/shared/types/conversionOptions';

export interface FpsCardProps {
  options: ConversionOptions;
  onChange: (updated: Partial<ConversionOptions>) => void;
}

export function FpsCard({ options, onChange }: FpsCardProps) {
  const currentFps = options.customFps || options.gifFps || 12;
  const isCustomFps = Boolean(options.isCustomFps);

  return (
    <div className="space-y-2 pt-0.5">
      <div className="flex items-center justify-between">
        <Typography variant="caption" color="muted">
          Quantidade de quadros exibidos por segundo:
        </Typography>
        <span className="text-[11px] font-mono text-primary font-medium">
          {currentFps} fps
        </span>
      </div>

      <div className="grid grid-cols-6 gap-1.5">
        {[
          { value: 10, label: '10' },
          { value: 12, label: '12' },
          { value: 15, label: '15' },
          { value: 24, label: '24' },
          { value: 30, label: '30' },
        ].map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange({ gifFps: item.value, customFps: undefined, isCustomFps: false })}
            className={cn(
              'px-1.5 py-1 text-[11px] rounded border transition-colors select-none text-center font-medium',
              !isCustomFps && (options.gifFps || 12) === item.value
                ? 'border-primary bg-primary/10 text-primary font-semibold'
                : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground'
            )}
          >
            {item.label}
          </button>
        ))}

        <button
          type="button"
          onClick={() => onChange({ isCustomFps: true, customFps: options.customFps || options.gifFps || 18 })}
          className={cn(
            'px-1.5 py-1 text-[11px] rounded border transition-colors select-none text-center font-medium',
            isCustomFps
              ? 'border-primary bg-primary/10 text-primary font-semibold'
              : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground'
          )}
        >
          Custom
        </button>
      </div>

      {isCustomFps && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[11px] text-muted-foreground">FPS personalizado:</span>
          <input
            type="number"
            min="1"
            max="120"
            value={options.customFps || 18}
            onChange={(e) => {
              const val = Math.max(1, Math.min(120, parseInt(e.target.value, 10) || 1));
              onChange({ customFps: val, gifFps: val, isCustomFps: true });
            }}
            className="w-20 rounded border border-primary bg-surface-raised px-2 py-0.5 text-xs text-foreground focus:outline-none"
          />
          <span className="text-[11px] text-muted-foreground font-mono">fps (1 a 120)</span>
        </div>
      )}
    </div>
  );
}
