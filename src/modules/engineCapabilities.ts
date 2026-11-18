/**
 * src/modules/engineCapabilities.ts
 *
 * Engine capability and modifier compatibility engine.
 * Determines whether a conversion engine can execute a conversion
 * with the currently requested modifiers (e.g. framerate, resolution scaling,
 * quality presets, codec changes, audio mixing).
 *
 * Inversion of Control (IoC):
 * Capabilities belong to each module's ModuleManifest.supportedModifiers.
 * This file contains zero hardcoded engine rules.
 */

import type { ModifierCategoryId, ConversionModifiers } from '@/shared/types/conversionModifiers';
import { getModuleById } from '@/modules/registry';

export interface EngineIncompatibilityResult {
  isIncompatible: boolean;
  incompatibleModifiers: ModifierCategoryId[];
  incompatibleModifierNames: string[];
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
  pixel_format: 'Formato de Pixel',
  bit_depth: 'Profundidade de Cor',
  bitrate: 'Taxa de Bits (Bitrate)',
  color_space: 'Espaço de Cor',
  page_range: 'Intervalo de Páginas',
  pdf_compliance: 'Padrão PDF / Conformidade PDF/A',
  image_dpi: 'Resolução de Renderização (DPI)',
  audio_sample_rate: 'Taxa de Amostragem (Hz)',
  audio_channels: 'Canais de Áudio',
  audio_normalize: 'Normalização de Volume',
  media_trim: 'Corte Temporal (Trim)',
  image_transform: 'Rotação & Transformação',
  background_color: 'Cor de Fundo (Alpha)',
  archive_compression: 'Nível de Compressão',
  archive_password: 'Senha / Criptografia',
  svg_optimize: 'Otimização Vetorial SVG',
  font_subset: 'Subsetting de Glifos (Fonte)',
  cad_tessellation: 'Precisão de Malha CAD',
  mesh_options: 'Opções de Malha 3D',
  csv_delimiter: 'Delimitador & Planilha',
};

/**
 * Checks if an individual modifier category is incompatible with an engine.
 * Directly queries the engine's ModuleManifest.supportedModifiers.
 */
export function isModifierIncompatibleWithEngine(
  modifierId: ModifierCategoryId,
  engineId: string | null | undefined,
  _modifiers?: ConversionModifiers
): boolean {
  if (!engineId) return false;
  const moduleInstance = getModuleById(engineId);
  if (!moduleInstance?.manifest?.supportedModifiers) return false;

  return !moduleInstance.manifest.supportedModifiers.includes(modifierId);
}

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
    reason: `O motor selecionado não permite modificar: ${incompatibleModifierNames.join(', ')}. Este motor realiza apenas cópia de fluxo sem re-encodificação.`,
    recommendedEngineId: 'ffmpeg-core-mt',
    recommendedEngineName: 'FFmpeg Multi-Thread',
  };
}
