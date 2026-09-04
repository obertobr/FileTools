import React from 'react';
import { Typography } from '@/ui/components/core';
import { cn } from '@/lib/utils';
import type { ConversionModifiers, ResolutionScale } from '@/shared/types/conversionModifiers';
import type { MediaProbeResult } from '@/core/media/mediaProbe';

export interface ResolutionCardProps {
  options: ConversionModifiers;
  onChange: (updated: Partial<ConversionModifiers>) => void;
  isGif?: boolean;
  probedMedia?: MediaProbeResult;
}

export function ResolutionCard({ options, onChange, isGif, probedMedia }: ResolutionCardProps) {
  const currentScale = options.customScaleWidth !== undefined
    ? options.customScaleWidth
    : options.resolutionScale;
  const isCustomScale = Boolean(options.isCustomResolution);

  const nativeWidth = probedMedia?.width || options.probedMedia?.width;
  const nativeHeight = probedMedia?.height || options.probedMedia?.height;
  const nativeDimensionStr = nativeWidth && nativeHeight ? `${nativeWidth}x${nativeHeight}` : '';

  const presets: { id: ResolutionScale; label: string; desc: string; width: number }[] = isGif
    ? [
        { id: '320p', label: '320p', desc: 'Leve (320px)', width: 320 },
        { id: '480p', label: '480p', desc: 'Padrão (480px)', width: 480 },
        { id: '720p', label: '720p', desc: 'HD (720px)', width: 720 },
        { id: 'original', label: 'Original', desc: nativeDimensionStr ? `Nativo (${nativeDimensionStr})` : '100% nativo', width: 0 },
      ]
    : [
        { id: 'original', label: nativeDimensionStr ? `Original (${nativeDimensionStr})` : 'Original', desc: '100% nativo do arquivo', width: 0 },
        { id: '1080p', label: '1080p', desc: 'Full HD (1920px)', width: 1920 },
        { id: '720p', label: '720p', desc: 'HD (1280px)', width: 1280 },
        { id: '480p', label: '480p', desc: 'SD (854px)', width: 854 },
        { id: '320p', label: '320p', desc: 'Baixa (320px)', width: 320 },
      ];

  return (
    <div className="space-y-2 pt-0.5">
      <div className="flex items-center justify-between">
        <Typography variant="caption" color="muted">
          Dimensões e escala de renderização:
        </Typography>
        <span className="text-[11px] font-mono text-primary font-medium">
          {isCustomScale
            ? `${options.customScaleWidth}px`
            : options.resolutionScale === 'original'
            ? (nativeDimensionStr ? `Original (${nativeDimensionStr})` : 'Original (100%)')
            : String(options.resolutionScale)}
        </span>
      </div>

      <div className={cn('grid gap-1.5', isGif ? 'grid-cols-5' : 'grid-cols-6')}>
        {presets.map((preset) => {
          const isSelected = !isCustomScale && (options.resolutionScale || 'original') === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() =>
                onChange({
                  resolutionScale: preset.id,
                  isCustomResolution: false,
                  customScaleWidth: undefined,
                  gifScaleWidth: preset.width,
                })
              }
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

        <button
          type="button"
          onClick={() =>
            onChange({
              resolutionScale: 'custom',
              isCustomResolution: true,
              customScaleWidth: options.customScaleWidth || (isGif ? 480 : (nativeWidth || 1280)),
              gifScaleWidth: options.customScaleWidth || (isGif ? 480 : (nativeWidth || 1280)),
            })
          }
          className={cn(
            'p-2 text-left rounded-md border transition-colors select-none',
            isCustomScale
              ? 'border-primary bg-primary/10 text-foreground font-medium'
              : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground'
          )}
        >
          <div className="text-[11px] font-medium text-foreground">Custom</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Definir px</div>
        </button>
      </div>

      {isCustomScale && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[11px] text-muted-foreground">Largura em pixels:</span>
          <input
            type="number"
            min="100"
            max="3840"
            value={options.customScaleWidth || (isGif ? 480 : (nativeWidth || 1280))}
            onChange={(e) => {
              const val = Math.max(100, Math.min(3840, parseInt(e.target.value, 10) || 100));
              onChange({
                customScaleWidth: val,
                gifScaleWidth: val,
                isCustomResolution: true,
                resolutionScale: 'custom',
              });
            }}
            className="w-24 rounded border border-primary bg-surface-raised px-2 py-0.5 text-xs text-foreground focus:outline-none"
          />
          <span className="text-[11px] text-muted-foreground font-mono">px (altura calculada proporcionalmente)</span>
        </div>
      )}
    </div>
  );
}
