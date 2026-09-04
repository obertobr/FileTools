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
  targetFormat?: string;
  videoCodec?: string;
}

export function ResolutionCard({
  options,
  onChange,
  isGif,
  probedMedia,
  targetFormat,
  videoCodec,
}: ResolutionCardProps) {
  const currentTarget = (targetFormat || '').toLowerCase().replace(/^\.+/, '');
  const activeCodec = videoCodec || options.videoCodec || 'auto';
  const is3GPH263 = (currentTarget === '3gp' && (activeCodec === 'h263' || activeCodec === 'auto')) || activeCodec === 'h263';

  const isCustomScale = Boolean(options.isCustomResolution) && !is3GPH263;
  const isProportional = options.isCustomResolutionProportional !== false;

  const nativeWidth = probedMedia?.width || options.probedMedia?.width;
  const nativeHeight = probedMedia?.height || options.probedMedia?.height;
  const nativeDimensionStr = nativeWidth && nativeHeight ? `${nativeWidth}x${nativeHeight}` : '';

  // Determine if native dimensions directly match a standard preset
  let matchingNativePresetId: ResolutionScale | null = null;
  if (nativeWidth && nativeHeight) {
    if (nativeWidth === 1920 || nativeHeight === 1080) matchingNativePresetId = '1080p';
    else if (nativeWidth === 1280 || nativeHeight === 720) matchingNativePresetId = '720p';
    else if (nativeWidth === 854 || nativeHeight === 480) matchingNativePresetId = '480p';
    else if ((nativeWidth === 480 && nativeHeight === 320) || nativeWidth === 320) matchingNativePresetId = '320p';
    else if (nativeWidth === 352 && nativeHeight === 288) matchingNativePresetId = 'cif';
    else if (nativeWidth === 176 && nativeHeight === 144) matchingNativePresetId = 'qcif';
    else if (nativeWidth === 128 && nativeHeight === 96) matchingNativePresetId = 'sub-qcif';
  }

  // Base presets
  let presets: { id: ResolutionScale; label: string; desc: string; width: number; height?: number; isNative?: boolean }[] = [];

  if (is3GPH263) {
    presets = [
      {
        id: 'cif',
        label: matchingNativePresetId === 'cif' ? 'CIF (Nativo)' : 'CIF',
        desc: matchingNativePresetId === 'cif' ? 'Nativo (352x288)' : 'Padrão (352x288)',
        width: 352,
        height: 288,
        isNative: matchingNativePresetId === 'cif',
      },
      {
        id: 'qcif',
        label: matchingNativePresetId === 'qcif' ? 'QCIF (Nativo)' : 'QCIF',
        desc: matchingNativePresetId === 'qcif' ? 'Nativo (176x144)' : 'Clássico (176x144)',
        width: 176,
        height: 144,
        isNative: matchingNativePresetId === 'qcif',
      },
      {
        id: 'sub-qcif',
        label: matchingNativePresetId === 'sub-qcif' ? 'sub-QCIF (Nativo)' : 'sub-QCIF',
        desc: matchingNativePresetId === 'sub-qcif' ? 'Nativo (128x96)' : 'Ultra-leve (128x96)',
        width: 128,
        height: 96,
        isNative: matchingNativePresetId === 'sub-qcif',
      },
    ];
  } else if (isGif) {
    presets = [
      { id: '320p', label: '320p', desc: 'Leve (320px)', width: 320, height: -1 },
      { id: '480p', label: '480p', desc: 'Padrão (480px)', width: 480, height: -1 },
      { id: '720p', label: '720p', desc: 'HD (720px)', width: 720, height: -1 },
    ];
    if (!matchingNativePresetId || !['320p', '480p', '720p'].includes(matchingNativePresetId)) {
      presets.push({
        id: 'original',
        label: nativeDimensionStr ? `Original (${nativeDimensionStr})` : 'Original',
        desc: '100% nativo',
        width: 0,
        isNative: true,
      });
    }
  } else {
    // Video presets: 1080p, 720p, 480p, 320p
    const standardPresets: { id: ResolutionScale; label: string; desc: string; width: number; height?: number }[] = [
      { id: '1080p', label: '1080p', desc: 'Full HD (1920px)', width: 1920, height: -2 },
      { id: '720p', label: '720p', desc: 'HD (1280px)', width: 1280, height: -2 },
      { id: '480p', label: '480p', desc: 'SD (854px)', width: 854, height: -2 },
      { id: '320p', label: '320p', desc: 'Baixa (480px)', width: 480, height: -2 },
    ];

    // If native doesn't match standard 1080p/720p/480p/320p (e.g. 4K, 1440p, square, etc.), show Original first
    if (!matchingNativePresetId) {
      presets.push({
        id: 'original',
        label: nativeDimensionStr ? `Original (${nativeDimensionStr})` : 'Original',
        desc: '100% nativo do arquivo',
        width: 0,
        isNative: true,
      });
    }

    // Add standard presets, annotating the native one if matched
    for (const p of standardPresets) {
      const isNative = matchingNativePresetId === p.id;
      presets.push({
        ...p,
        label: isNative ? `${p.label} (Nativo)` : p.label,
        desc: isNative ? (nativeDimensionStr ? `Nativo (${nativeDimensionStr})` : 'Nativo do arquivo') : p.desc,
        isNative,
      });
    }
  }

  // Auto-sync: if native dimensions match a standard preset and user hasn't explicitly chosen custom or another preset, sync to that preset
  React.useEffect(() => {
    if (matchingNativePresetId && options.resolutionScale === 'original' && !options.isCustomResolution) {
      const match = presets.find((p) => p.id === matchingNativePresetId);
      if (match && match.width > 0) {
        onChange({
          resolutionScale: matchingNativePresetId,
          targetWidth: match.width,
          targetHeight: match.height !== undefined ? match.height : -2,
        });
      }
    }
  }, [matchingNativePresetId]);

  // Selected preset resolution scale:
  // If resolutionScale is 'original' and native matches 1080p, 1080p is selected!
  const effectiveSelectedId = (options.resolutionScale === 'original' && matchingNativePresetId)
    ? matchingNativePresetId
    : (options.resolutionScale || (matchingNativePresetId || (is3GPH263 ? 'qcif' : 'original')));

  return (
    <div className="space-y-2 pt-0.5">
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

      <div className={cn('grid gap-1.5', is3GPH263 ? 'grid-cols-3' : (isGif ? 'grid-cols-4' : 'grid-cols-5'))}>
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

        {!is3GPH263 && (
          <button
            type="button"
            onClick={() => {
              const defaultW = options.customScaleWidth || (isGif ? 480 : (nativeWidth || 1280));
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

      {is3GPH263 && (
        <div className="rounded-md border border-primary/20 bg-primary/5 p-2 text-[11px] text-muted-foreground">
          💡 <strong className="text-foreground">Sintonia de Codec:</strong> O codec legado <strong>H.263</strong> aceita estritamente resoluções padronizadas CIF, QCIF e sub-QCIF. Para resoluções HD (720p/1080p) ou customizadas, selecione o codec <strong>MPEG-4</strong> no modificador de Codec de Vídeo.
        </div>
      )}

      {isCustomScale && (
        <div className="space-y-2 pt-1 border-t border-border/40">
          <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-foreground">
            <input
              type="checkbox"
              checked={isProportional}
              onChange={(e) => {
                const prop = e.target.checked;
                const w = options.customScaleWidth || (isGif ? 480 : (nativeWidth || 1280));
                const h = prop ? -2 : (options.customScaleHeight || (nativeHeight || 720));
                onChange({
                  isCustomResolutionProportional: prop,
                  customScaleWidth: w,
                  customScaleHeight: prop ? undefined : (h > 0 ? h : 720),
                  targetWidth: w,
                  targetHeight: h,
                  isCustomResolution: true,
                  resolutionScale: 'custom',
                });
              }}
              className="rounded border-border text-primary focus:ring-primary size-3.5"
            />
            <span>Manter proporção (altura calculada automaticamente)</span>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">Largura:</span>
              <input
                type="number"
                min="100"
                max="3840"
                value={options.customScaleWidth || (isGif ? 480 : (nativeWidth || 1280))}
                onChange={(e) => {
                  const val = Math.max(100, Math.min(3840, parseInt(e.target.value, 10) || 100));
                  const h = isProportional ? -2 : (options.customScaleHeight || (nativeHeight || 720));
                  onChange({
                    targetWidth: val,
                    targetHeight: h,
                    customScaleWidth: val,
                    gifScaleWidth: val,
                    isCustomResolution: true,
                    resolutionScale: 'custom',
                  });
                }}
                className="w-20 rounded border border-primary bg-surface-raised px-2 py-0.5 text-xs text-foreground focus:outline-none"
              />
              <span className="text-[11px] text-muted-foreground font-mono">px</span>
            </div>

            {!isProportional && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">Altura:</span>
                <input
                  type="number"
                  min="100"
                  max="2160"
                  value={options.customScaleHeight || (nativeHeight || 720)}
                  onChange={(e) => {
                    const val = Math.max(100, Math.min(2160, parseInt(e.target.value, 10) || 100));
                    onChange({
                      targetHeight: val,
                      customScaleHeight: val,
                      isCustomResolution: true,
                      resolutionScale: 'custom',
                    });
                  }}
                  className="w-20 rounded border border-primary bg-surface-raised px-2 py-0.5 text-xs text-foreground focus:outline-none"
                />
                <span className="text-[11px] text-muted-foreground font-mono">px</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
