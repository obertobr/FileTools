/**
 * src/modules/engineCapabilities.ts
 *
 * Engine capability and option compatibility engine.
 * Determines whether a conversion engine can execute a conversion
 * with the currently requested options (e.g. framerate, resolution scaling,
 * quality presets, codec changes, audio mixing).
 */

import type { ConfigCategoryId, ConversionOptions } from '@/shared/types/conversionOptions';

export interface EngineIncompatibilityResult {
  isIncompatible: boolean;
  incompatibleCategories: ConfigCategoryId[];
  incompatibleCategoryNames: string[];
  reason: string;
  recommendedEngineId?: string;
  recommendedEngineName?: string;
}

export const CATEGORY_LABELS: Record<ConfigCategoryId, string> = {
  fps: 'Taxa de Quadros (FPS)',
  resolution: 'Resolução e Escala',
  quality: 'Qualidade e Compressão',
  video_codec: 'Codec de Vídeo',
  audio_codec: 'Codec de Áudio',
  audio_merge: 'Unir Faixas de Áudio',
  video_duration: 'Duração do Vídeo',
  audio_tracks: 'Faixas de Áudio',
  subtitles: 'Legendas',
  threads: 'Desempenho / CPU',
};

/**
 * Checks if an individual option category is incompatible with an engine.
 */
export function isCategoryIncompatibleWithEngine(
  categoryId: ConfigCategoryId,
  engineId: string | null | undefined,
  _options?: ConversionOptions
): boolean {
  if (!engineId) return false;

  if (engineId === 'stream-copy') {
    // Stream copy (Remux) is strictly a bitstream repacker. It cannot transcode.
    if (categoryId === 'fps') return true;
    if (categoryId === 'quality') return true;
    if (categoryId === 'video_codec') return true;
    if (categoryId === 'audio_codec') return true;
    if (categoryId === 'audio_merge') return true;
    if (categoryId === 'video_duration') return true;
    if (categoryId === 'resolution') return true;
  }

  return false;
}

/**
 * Validates the active options against the selected engine.
 */
export function checkEngineCompatibility(
  engineId: string | null | undefined,
  options: ConversionOptions
): EngineIncompatibilityResult {
  if (!engineId) {
    return {
      isIncompatible: false,
      incompatibleCategories: [],
      incompatibleCategoryNames: [],
      reason: '',
    };
  }

  const active = options.activeCategories || [];
  const incompatibleCategories: ConfigCategoryId[] = [];

  for (const catId of active) {
    if (isCategoryIncompatibleWithEngine(catId, engineId, options)) {
      incompatibleCategories.push(catId);
    }
  }

  if (incompatibleCategories.length === 0) {
    return {
      isIncompatible: false,
      incompatibleCategories: [],
      incompatibleCategoryNames: [],
      reason: '',
    };
  }

  const incompatibleCategoryNames = incompatibleCategories.map(
    (c) => CATEGORY_LABELS[c] || c
  );

  return {
    isIncompatible: true,
    incompatibleCategories,
    incompatibleCategoryNames,
    reason: `O motor selecionado não permite modificar: ${incompatibleCategoryNames.join(', ')}. Este motor realiza apenas cópia de fluxo sem re-encodificação.`,
    recommendedEngineId: 'ffmpeg-core-mt',
    recommendedEngineName: 'FFmpeg Multi-Thread',
  };
}
