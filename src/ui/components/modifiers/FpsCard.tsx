import React from 'react';
import { Typography } from '@/ui/components/core';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';
import type { ConversionModifiers } from '@/shared/types/conversionModifiers';
import type { MediaProbeResult } from '@/core/media/mediaProbe';
import {
  FPS_PRESETS,
  DEFAULT_VIDEO_FPS_OPTIONS,
  type FpsPresetData,
} from '@/core/knowledge/fpsPresets';

export interface FpsCardProps {
  options: ConversionModifiers;
  onChange: (updated: Partial<ConversionModifiers>) => void;
  targetFormat?: string;
  probedMedia?: MediaProbeResult;
  allowedOptions?: (number | string)[];
  warningMessage?: string;
}

export function FpsCard({
  options,
  onChange,
  probedMedia,
  allowedOptions,
  warningMessage,
}: FpsCardProps) {
  const probedFps = probedMedia?.fps || options.probedMedia?.fps;

  // 1. Determine allowed options from props or default knowledge base
  const activeAllowed = allowedOptions && allowedOptions.length > 0
    ? allowedOptions.map(Number).filter((n) => !isNaN(n))
    : DEFAULT_VIDEO_FPS_OPTIONS;

  const isCustomFps = Boolean(options.isCustomFps);
  const defaultBaseFps = activeAllowed[0] || 30;
  const currentFps = options.customFps || (probedFps || defaultBaseFps);

  // 2. Build preset items from knowledge base
  const presets: { fps: number; label: string; desc: string; isNative?: boolean }[] = [];

  // Check if probedFps matches a preset or is non-standard
  const hasMatchingProbed = probedFps && activeAllowed.includes(probedFps);

  for (const fpsVal of activeAllowed) {
    const data: FpsPresetData | undefined = FPS_PRESETS[fpsVal];
    const isNative = probedFps === fpsVal;
    let label = data ? `${data.label} fps` : `${fpsVal} fps`;
    let desc = isNative ? 'Nativo do arquivo' : (fpsVal >= 60 ? 'Fluido' : 'Padrão');

    if (isNative) {
      label = `Original (${fpsVal} fps)`;
    }

    presets.push({
      fps: fpsVal,
      label,
      desc,
      isNative,
    });
  }

  // If non-standard probedFps is not in allowedOptions, prepend it as Original
  if (probedFps && !hasMatchingProbed) {
    presets.unshift({
      fps: probedFps,
      label: `Original (${probedFps} fps)`,
      desc: 'Nativo do arquivo',
      isNative: true,
    });
  }

  return (
    <div className="space-y-2 pt-0.5">
      {warningMessage && (
        <div className="flex items-start gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px]">
          <AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-amber-400" />
          <span>{warningMessage}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Typography variant="caption" color="muted">
          Quantidade de quadros exibidos por segundo:
        </Typography>
        <span className="text-[11px] font-mono text-primary font-medium">
          {!isCustomFps && currentFps === probedFps
            ? `Original (${currentFps} fps)`
            : `${currentFps} fps`}
        </span>
      </div>

      <div className={cn('grid gap-1.5', presets.length <= 4 ? 'grid-cols-5' : 'grid-cols-6')}>
        {presets.map((item) => {
          const isSelected = !isCustomFps && (
            options.customFps !== undefined
              ? options.customFps === item.fps
              : item.fps === (probedFps || defaultBaseFps)
          );

          return (
            <button
              key={item.fps}
              type="button"
              onClick={() => {
                onChange({ targetFps: item.fps, customFps: item.fps, gifFps: item.fps, isCustomFps: false });
              }}
              className={cn(
                'p-2 text-left rounded-md border transition-colors select-none',
                isSelected
                  ? 'border-primary bg-primary/10 text-foreground font-medium'
                  : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground'
              )}
            >
              <div className="text-[11px] font-medium text-foreground">{item.label}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</div>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => {
            const val = options.customFps || probedFps || defaultBaseFps;
            onChange({
              isCustomFps: true,
              targetFps: val,
              customFps: val,
              gifFps: val,
            });
          }}
          className={cn(
            'p-2 text-left rounded-md border transition-colors select-none',
            isCustomFps
              ? 'border-primary bg-primary/10 text-foreground font-medium'
              : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground'
          )}
        >
          <div className="text-[11px] font-medium text-foreground">Custom</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Definir fps</div>
        </button>
      </div>

      {isCustomFps && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[11px] text-muted-foreground">FPS personalizado:</span>
          <input
            type="number"
            min="1"
            max="120"
            value={options.customFps || defaultBaseFps}
            onChange={(e) => {
              const val = Math.max(1, Math.min(120, parseInt(e.target.value, 10) || 1));
              onChange({ targetFps: val, customFps: val, gifFps: val, isCustomFps: true });
            }}
            className="w-20 rounded border border-primary bg-surface-raised px-2 py-0.5 text-xs text-foreground focus:outline-none"
          />
          <span className="text-[11px] text-muted-foreground font-mono">fps (1 a 120)</span>
        </div>
      )}
    </div>
  );
}
