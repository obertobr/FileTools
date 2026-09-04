import React, { useEffect } from 'react';
import { Typography } from '@/ui/components/core';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';
import type { ConversionModifiers, ResolutionScale } from '@/shared/types/conversionModifiers';
import type { MediaProbeResult } from '@/core/media/mediaProbe';
import {
  RESOLUTION_PRESETS,
  DEFAULT_VIDEO_RESOLUTIONS,
  findMatchingResolutionPreset,
  type ResolutionPresetData,
} from '@/core/knowledge/resolutionPresets';

export interface ResolutionCardProps {
  options: ConversionModifiers;
  onChange: (updated: Partial<ConversionModifiers>) => void;
  isGif?: boolean;
  probedMedia?: MediaProbeResult;
  targetFormat?: string;
  videoCodec?: string;
  allowedOptions?: (string | number)[];
  warningMessage?: string;
}

export function ResolutionCard({
  options,
  onChange,
  probedMedia,
  allowedOptions,
  warningMessage,
}: ResolutionCardProps) {
  // 1. Determine active allowed options from props or default knowledge base
  const activeAllowed = allowedOptions && allowedOptions.length > 0
    ? allowedOptions.map(String)
    : DEFAULT_VIDEO_RESOLUTIONS;

  const isCustomAllowed = activeAllowed.includes('custom');
  const isCustomScale = Boolean(options.isCustomResolution) && isCustomAllowed;
  const isProportional = options.isCustomResolutionProportional !== false;

  const nativeWidth = probedMedia?.width || options.probedMedia?.width;
  const nativeHeight = probedMedia?.height || options.probedMedia?.height;
  const nativeDimensionStr = nativeWidth && nativeHeight ? `${nativeWidth}x${nativeHeight}` : '';

  // 2. Identify if native dimension matches a known preset in the knowledge base
  const matchingNativePreset = findMatchingResolutionPreset(nativeWidth, nativeHeight);
  const matchingNativePresetId: ResolutionScale | null = matchingNativePreset?.id ?? null;

  // 3. Build UI preset buttons directly by mapping allowedOptions against RESOLUTION_PRESETS
  const presetKeys = activeAllowed.filter((key) => key !== 'custom' && RESOLUTION_PRESETS[key]);

  const presets = presetKeys.map((key) => {
    const data: ResolutionPresetData = RESOLUTION_PRESETS[key];
    const isNative = matchingNativePresetId === data.id;
    let label = data.label;
    let desc = data.desc;

    if (key === 'original' && nativeDimensionStr) {
      label = `Original (${nativeDimensionStr})`;
      desc = '100% nativo do arquivo';
    } else if (isNative) {
      label = `${data.label} (Nativo)`;
      desc = nativeDimensionStr ? `Nativo (${nativeDimensionStr})` : 'Nativo do arquivo';
    }

    return {
      ...data,
      label,
      desc,
      isNative,
    };
  });

  // 4. Auto-sync if native matches a preset and user hasn't customized
  useEffect(() => {
    if (matchingNativePresetId && options.resolutionScale === 'original' && !options.isCustomResolution) {
      const match = presets.find((p) => p.id === matchingNativePresetId);
      if (match && match.width > 0) {
        onChange({
          resolutionScale: matchingNativePresetId,
          targetWidth: match.width,
          targetHeight: match.height,
        });
      }
    }
  }, [matchingNativePresetId]);

  // Selected preset resolution scale:
  const firstPresetId = presets[0]?.id || 'original';
  const effectiveSelectedId = (options.resolutionScale === 'original' && matchingNativePresetId)
    ? matchingNativePresetId
    : (options.resolutionScale || (matchingNativePresetId || firstPresetId));

  return (
    <div className="space-y-2 pt-0.5">
      {/* Aviso preventivo enviado pelo Motor de Regras */}
      {warningMessage && (
        <div className="flex items-start gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px]">
          <AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-amber-400" />
          <span>{warningMessage}</span>
        </div>
      )}

      {/* Rótulo de dimensões ativas */}
      <div className="flex items-center justify-between">
        <Typography variant="caption" color="muted">
          Dimensões e escala de renderização:
        </Typography>
        <span className="text-[11px] font-mono text-primary font-medium">
          {isCustomScale
            ? (isProportional
                ? `${options.customScaleWidth || 1280}px (proporcional)`
                : `${options.customScaleWidth || 1280}x${options.customScaleHeight || 720}px`)
            : effectiveSelectedId === 'original'
            ? (nativeDimensionStr ? `Original (${nativeDimensionStr})` : 'Original (100%)')
            : String(effectiveSelectedId)}
        </span>
      </div>

      {/* Grid Dinâmico de Presets — puramente baseado em presets do Dicionário */}
      <div className={cn('grid gap-1.5', presets.length <= 3 ? 'grid-cols-3' : (presets.length <= 4 ? 'grid-cols-4' : 'grid-cols-5'))}>
        {presets.map((preset) => {
          const isSelected = !isCustomScale && effectiveSelectedId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() =>
                onChange({
                  resolutionScale: preset.id,
                  targetWidth: preset.width > 0 ? preset.width : undefined,
                  targetHeight: preset.height !== undefined ? preset.height : (preset.width > 0 ? -2 : undefined),
                  isCustomResolution: false,
                  customScaleWidth: preset.width > 0 ? preset.width : undefined,
                  customScaleHeight: preset.height && preset.height > 0 ? preset.height : undefined,
                  gifScaleWidth: preset.width > 0 ? preset.width : undefined,
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

        {isCustomAllowed && (
          <button
            type="button"
            onClick={() => {
              const defaultW = options.customScaleWidth || (nativeWidth || 1280);
              const defaultH = options.customScaleHeight || (nativeHeight || 720);
              onChange({
                resolutionScale: 'custom',
                targetWidth: defaultW,
                targetHeight: isProportional ? -2 : defaultH,
                isCustomResolution: true,
                customScaleWidth: defaultW,
                customScaleHeight: isProportional ? undefined : defaultH,
                isCustomResolutionProportional: isProportional,
                gifScaleWidth: defaultW,
              });
            }}
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
        )}
      </div>

      {/* Painel de Escala Customizada */}
      {isCustomScale && (
        <div className="space-y-2 pt-1 border-t border-border/40">
          <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-foreground">
            <input
              type="checkbox"
              checked={isProportional}
              onChange={(e) => {
                const nextProportional = e.target.checked;
                const w = options.customScaleWidth || 1280;
                const h = options.customScaleHeight || 720;
                onChange({
                  isCustomResolutionProportional: nextProportional,
                  targetWidth: w,
                  targetHeight: nextProportional ? -2 : h,
                  customScaleWidth: w,
                  customScaleHeight: nextProportional ? undefined : h,
                  gifScaleWidth: w,
                });
              }}
              className="rounded border-border text-primary focus:ring-0 size-3.5"
            />
            <span>Manter proporção (altura calculada automaticamente)</span>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground shrink-0">Largura:</span>
              <input
                type="number"
                min="16"
                max="7680"
                step="2"
                value={options.customScaleWidth || 1280}
                onChange={(e) => {
                  const val = Math.max(16, parseInt(e.target.value, 10) || 1280);
                  onChange({
                    customScaleWidth: val,
                    targetWidth: val,
                    gifScaleWidth: val,
                  });
                }}
                className="w-full rounded border border-primary bg-surface-raised px-2 py-1 text-xs text-foreground focus:outline-none"
              />
              <span className="text-[11px] text-muted-foreground">px</span>
            </div>

            {!isProportional && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground shrink-0">Altura:</span>
                <input
                  type="number"
                  min="16"
                  max="4320"
                  step="2"
                  value={options.customScaleHeight || 720}
                  onChange={(e) => {
                    const val = Math.max(16, parseInt(e.target.value, 10) || 720);
                    onChange({
                      customScaleHeight: val,
                      targetHeight: val,
                    });
                  }}
                  className="w-full rounded border border-primary bg-surface-raised px-2 py-1 text-xs text-foreground focus:outline-none"
                />
                <span className="text-[11px] text-muted-foreground">px</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
