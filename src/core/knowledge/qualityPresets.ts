/**
 * src/core/knowledge/qualityPresets.ts
 *
 * Central Knowledge Base for video quality and CRF compression presets.
 * Pure static data contracts — zero UI or business logic dependencies.
 */

import type { QualityPreset, ConversionModifiers } from '@/shared/types/conversionModifiers';

export interface QualityPresetData {
  id: QualityPreset;
  label: string;
  desc: string;
  defaultCrf: number;
}

export const QUALITY_PRESETS: Record<QualityPreset, QualityPresetData> = {
  original: {
    id: 'original',
    label: 'Original',
    desc: 'Fidelidade máx.',
    defaultCrf: 18,
  },
  balanced: {
    id: 'balanced',
    label: 'Equilibrada',
    desc: 'Média (CRF 23)',
    defaultCrf: 23,
  },
  compressed: {
    id: 'compressed',
    label: 'Compacta',
    desc: 'Menor arquivo',
    defaultCrf: 28,
  },
  custom: {
    id: 'custom',
    label: 'Custom',
    desc: 'Definir CRF',
    defaultCrf: 23,
  },
};

export const DEFAULT_QUALITY_OPTIONS: QualityPreset[] = [
  'original',
  'balanced',
  'compressed',
  'custom',
];

/**
 * Pure helper to resolve the canonical numeric CRF value from conversion options.
 */
export function resolveQualityCrf(options?: ConversionModifiers): number {
  if (options?.targetCrf !== undefined) {
    return Number(options.targetCrf);
  }
  if (options?.customCrf !== undefined) {
    return Number(options.customCrf);
  }
  const preset = options?.qualityPreset || 'original';
  return QUALITY_PRESETS[preset]?.defaultCrf ?? 18;
}

