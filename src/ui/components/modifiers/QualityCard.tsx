import React from 'react';
import { Typography } from '@/ui/components/core';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';
import type { ConversionModifiers, QualityPreset } from '@/shared/types/conversionModifiers';
import {
  QUALITY_PRESETS,
  DEFAULT_QUALITY_OPTIONS,
  type QualityPresetData,
} from '@/core/knowledge/qualityPresets';

export interface QualityCardProps {
  options: ConversionModifiers;
  onChange: (updated: Partial<ConversionModifiers>) => void;
  allowedOptions?: (string | number)[];
  warningMessage?: string;
}

export function QualityCard({
  options,
  onChange,
  allowedOptions,
  warningMessage,
}: QualityCardProps) {
  const activeAllowed: QualityPreset[] = allowedOptions && allowedOptions.length > 0
    ? (allowedOptions.map(String) as QualityPreset[])
    : DEFAULT_QUALITY_OPTIONS;

  const currentPreset = options.qualityPreset || 'original';
  const isCustom = currentPreset === 'custom';

  const presets: QualityPresetData[] = activeAllowed
    .filter((id) => QUALITY_PRESETS[id])
    .map((id) => QUALITY_PRESETS[id]);

  let currentLabel = QUALITY_PRESETS[currentPreset]?.label || 'Original';
  if (isCustom) {
    currentLabel = `CRF ${options.customCrf ?? 23}`;
  } else if (currentPreset === 'compressed') {
    currentLabel = 'Econômica (CRF 28)';
  } else if (currentPreset === 'balanced') {
    currentLabel = 'Média (CRF 23)';
  } else if (currentPreset === 'original') {
    currentLabel = 'Original (Fidelidade Máxima)';
  }

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
          Nível de fidelidade visual:
        </Typography>
        <span className="text-[11px] font-mono text-primary font-medium">
          {currentLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {presets.map((preset) => {
          const isSelected = currentPreset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                const crfVal = preset.id === 'custom'
                  ? (options.customCrf ?? 23)
                  : preset.defaultCrf;
                onChange({
                  qualityPreset: preset.id,
                  targetCrf: crfVal,
                  isCustomQuality: preset.id === 'custom',
                  customCrf: preset.id === 'custom' ? (options.customCrf ?? 23) : undefined,
                });
              }}
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

      {isCustom && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[11px] text-muted-foreground">Fator CRF (0 a 51):</span>
          <input
            type="number"
            min="0"
            max="51"
            value={options.customCrf ?? 23}
            onChange={(e) => {
              const val = Math.max(0, Math.min(51, parseInt(e.target.value, 10) || 0));
              onChange({ customCrf: val, targetCrf: val });
            }}
            className="w-20 rounded border border-primary bg-surface-raised px-2 py-0.5 text-xs text-foreground focus:outline-none font-mono"
          />
          <span className="text-[11px] text-muted-foreground font-mono">
            (0 = lossless, 23 = padrão, 51 = máx compressão)
          </span>
        </div>
      )}
    </div>
  );
}
