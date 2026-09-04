/**
 * src/core/knowledge/resolutionPresets.ts
 *
 * Central Knowledge Base for resolution presets and dimensions.
 * Pure static data contracts — zero UI or business logic dependencies.
 */

import type { ResolutionScale } from '@/shared/types/conversionModifiers';

export interface ResolutionPresetData {
  id: ResolutionScale;
  label: string;
  desc: string;
  width: number;
  height?: number; // -2 for 16:9 proportional auto height, -1 for gif auto, or fixed px
}

export const RESOLUTION_PRESETS: Record<string, ResolutionPresetData> = {
  '1080p': {
    id: '1080p',
    label: '1080p',
    desc: 'Full HD (1920px)',
    width: 1920,
    height: -2,
  },
  '720p': {
    id: '720p',
    label: '720p',
    desc: 'HD (1280px)',
    width: 1280,
    height: -2,
  },
  '480p': {
    id: '480p',
    label: '480p',
    desc: 'SD (854px)',
    width: 854,
    height: -2,
  },
  '320p': {
    id: '320p',
    label: '320p',
    desc: 'Baixa (480px)',
    width: 480,
    height: -2,
  },
  'cif': {
    id: 'cif',
    label: 'CIF',
    desc: 'Padrão (352x288)',
    width: 352,
    height: 288,
  },
  'qcif': {
    id: 'qcif',
    label: 'QCIF',
    desc: 'Clássico (176x144)',
    width: 176,
    height: 144,
  },
  'sub-qcif': {
    id: 'sub-qcif',
    label: 'sub-QCIF',
    desc: 'Ultra-leve (128x96)',
    width: 128,
    height: 96,
  },
  'original': {
    id: 'original',
    label: 'Original',
    desc: '100% nativo do arquivo',
    width: 0,
  },
};

export const DEFAULT_VIDEO_RESOLUTIONS: string[] = ['1080p', '720p', '480p', '320p', 'custom'];
export const DEFAULT_GIF_RESOLUTIONS: string[] = ['720p', '480p', '320p', 'original', 'custom'];
export const CIF_RESOLUTIONS: string[] = ['cif', 'qcif', 'sub-qcif'];

/**
 * Returns preset data or a fallback preset representation.
 */
export function getResolutionPreset(id: string): ResolutionPresetData | undefined {
  return RESOLUTION_PRESETS[id];
}

/**
 * Pure helper to match raw probed width/height against standard resolution presets.
 */
export function findMatchingResolutionPreset(width?: number, height?: number): ResolutionPresetData | undefined {
  if (!width || !height) return undefined;
  if (width === 1920 || height === 1080) return RESOLUTION_PRESETS['1080p'];
  if (width === 1280 || height === 720) return RESOLUTION_PRESETS['720p'];
  if (width === 854 || height === 480) return RESOLUTION_PRESETS['480p'];
  if ((width === 480 && height === 320) || width === 320) return RESOLUTION_PRESETS['320p'];
  if (width === 352 && height === 288) return RESOLUTION_PRESETS['cif'];
  if (width === 176 && height === 144) return RESOLUTION_PRESETS['qcif'];
  if (width === 128 && height === 96) return RESOLUTION_PRESETS['sub-qcif'];
  return undefined;
}
