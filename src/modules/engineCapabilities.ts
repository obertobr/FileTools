/**
 * src/modules/engineCapabilities.ts
 *
 * Engine capability and modifier compatibility engine.
 * Determines whether a conversion engine can execute a conversion
 * with the currently requested modifiers (e.g. framerate, resolution scaling,
 * quality presets, codec changes, audio mixing).
 */

import type { ModifierCategoryId, ConversionModifiers } from '@/shared/types/conversionModifiers';

export interface EngineIncompatibilityResult {
  isIncompatible: boolean;
  incompatibleModifiers: ModifierCategoryId[];
  incompatibleModifierNames: string[];
  // Compatibility aliases
  incompatibleCategories: ModifierCategoryId[];
  incompatibleCategoryNames: string[];
  reason: string;
  recommendedEngineId?: string;
  recommendedEngineName?: string;
}

export const MODIFIER_LABELS: Record<ModifierCategoryId, string> = {
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

// Compatibility export
export const CATEGORY_LABELS = MODIFIER_LABELS;

/**
 * Checks if an individual modifier category is incompatible with an engine.
 */
export function isModifierIncompatibleWithEngine(
  modifierId: ModifierCategoryId,
  engineId: string | null | undefined,
  _modifiers?: ConversionModifiers
): boolean {
  if (!engineId) return false;

  if (engineId === 'stream-copy') {
    // Stream copy (Remux) is strictly a bitstream repacker. It cannot transcode.
    if (modifierId === 'fps') return true;
    if (modifierId === 'quality') return true;
    if (modifierId === 'video_codec') return true;
    if (modifierId === 'audio_codec') return true;
    if (modifierId === 'audio_merge') return true;
    if (modifierId === 'video_duration') return true;
    if (modifierId === 'resolution') return true;
  }

  return false;
}

// Compatibility export
export const isCategoryIncompatibleWithEngine = isModifierIncompatibleWithEngine;

/**
 * Validates the active modifiers against the selected engine.
 */
export function checkEngineCompatibility(
  engineId: string | null | undefined,
  modifiers: ConversionModifiers
): EngineIncompatibilityResult {
  if (!engineId) {
    return {
      isIncompatible: false,
      incompatibleModifiers: [],
      incompatibleModifierNames: [],
      incompatibleCategories: [],
      incompatibleCategoryNames: [],
      reason: '',
    };
  }

  const active = modifiers.activeCategories || [];
  const incompatibleModifiers: ModifierCategoryId[] = [];

  for (const modId of active) {
    if (isModifierIncompatibleWithEngine(modId, engineId, modifiers)) {
      incompatibleModifiers.push(modId);
    }
  }

  if (incompatibleModifiers.length === 0) {
    return {
      isIncompatible: false,
      incompatibleModifiers: [],
      incompatibleModifierNames: [],
      incompatibleCategories: [],
      incompatibleCategoryNames: [],
      reason: '',
    };
  }

  const incompatibleModifierNames = incompatibleModifiers.map(
    (c) => MODIFIER_LABELS[c] || c
  );

  return {
    isIncompatible: true,
    incompatibleModifiers,
    incompatibleModifierNames,
    incompatibleCategories: incompatibleModifiers,
    incompatibleCategoryNames: incompatibleModifierNames,
    reason: `O motor selecionado não permite modificar: ${incompatibleModifierNames.join(', ')}. Este motor realiza apenas cópia de fluxo sem re-encodificação.`,
    recommendedEngineId: 'ffmpeg-core-mt',
    recommendedEngineName: 'FFmpeg Multi-Thread',
  };
}
