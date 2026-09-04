/**
 * src/core/knowledge/bitratePresets.ts
 *
 * Central Knowledge Base for video and audio bitrate presets.
 * Pure static data contracts — zero UI or business logic dependencies.
 */

import type { ConversionModifiers } from '@/shared/types/conversionModifiers';

export interface BitratePresetData {
  id: string;
  label: string;
  desc: string;
}

export const VIDEO_BITRATE_PRESETS: Record<string, BitratePresetData> = {
  auto: {
    id: 'auto',
    label: 'Automático',
    desc: 'VBR equilibrado',
  },
  '1M': {
    id: '1M',
    label: '1.0 Mbps',
    desc: 'Ultra-leve',
  },
  '2.5M': {
    id: '2.5M',
    label: '2.5 Mbps',
    desc: '720p HD',
  },
  '5M': {
    id: '5M',
    label: '5.0 Mbps',
    desc: '1080p padrão',
  },
  '8M': {
    id: '8M',
    label: '8.0 Mbps',
    desc: '1080p 60fps',
  },
  '15M': {
    id: '15M',
    label: '15 Mbps',
    desc: 'Máx. fidelidade',
  },
  custom: {
    id: 'custom',
    label: 'Custom',
    desc: 'Definir kbps',
  },
};

export const DEFAULT_VIDEO_BITRATE_OPTIONS: string[] = [
  'auto',
  '1M',
  '2.5M',
  '5M',
  '8M',
  '15M',
  'custom',
];

export const AUDIO_BITRATE_PRESETS: Record<string, BitratePresetData> = {
  auto: {
    id: 'auto',
    label: 'Automático',
    desc: 'Padrão (192k)',
  },
  '96k': {
    id: '96k',
    label: '96 kbps',
    desc: 'Voz / Podcasting',
  },
  '128k': {
    id: '128k',
    label: '128 kbps',
    desc: 'Padrão web',
  },
  '192k': {
    id: '192k',
    label: '192 kbps',
    desc: 'Alta qualidade',
  },
  '256k': {
    id: '256k',
    label: '256 kbps',
    desc: 'Fidelidade elevada',
  },
  '320k': {
    id: '320k',
    label: '320 kbps',
    desc: 'Máximo estéreo',
  },
  custom: {
    id: 'custom',
    label: 'Custom',
    desc: 'Definir kbps',
  },
};

export const DEFAULT_AUDIO_BITRATE_OPTIONS: string[] = [
  'auto',
  '96k',
  '128k',
  '192k',
  '256k',
  '320k',
  'custom',
];

/**
 * Resolves the numeric target bitrate (in bits/sec) for WebCodecs GPU encoding.
 */
export function resolveWebCodecsBitrate(options?: ConversionModifiers): number {
  if (options?.activeCategories?.includes('bitrate')) {
    if (options.isCustomVideoBitrate && options.customVideoBitrateKbps) {
      return options.customVideoBitrateKbps * 1000;
    }
    if (options.videoBitrate && options.videoBitrate !== 'auto') {
      const num = parseFloat(options.videoBitrate.replace(/M$/i, ''));
      if (!isNaN(num)) return Math.round(num * 1_000_000);
    }
  }
  const preset = options?.qualityPreset || 'balanced';
  switch (preset) {
    case 'original':
      return 6_000_000;
    case 'compressed':
      return 1_200_000;
    case 'balanced':
    default:
      return 2_500_000;
  }
}

