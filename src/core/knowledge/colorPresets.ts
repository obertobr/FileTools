/**
 * src/core/knowledge/colorPresets.ts
 *
 * Central Knowledge Base for color formats, pixel formats, bit depth, and color spaces.
 * Pure static data contracts — zero UI or business logic dependencies.
 */

import type {
  PixelFormatChoice,
  BitDepthChoice,
  ColorSpaceChoice,
  ConversionModifiers,
} from '@/shared/types/conversionModifiers';

export interface PixelFormatPresetData {
  id: PixelFormatChoice;
  label: string;
  desc: string;
}

export interface BitDepthPresetData {
  id: BitDepthChoice;
  label: string;
  desc: string;
}

export interface ColorSpacePresetData {
  id: ColorSpaceChoice;
  label: string;
  desc: string;
  ffmpegArgs: string[];
}


export const PIXEL_FORMAT_PRESETS: Record<PixelFormatChoice, PixelFormatPresetData> = {
  auto: {
    id: 'auto',
    label: 'Automático',
    desc: 'Padrão recomendado',
  },
  yuv420p: {
    id: 'yuv420p',
    label: 'YUV 4:2:0 (8-bit)',
    desc: 'Universal (Web / Celular / TV)',
  },
  yuv422p: {
    id: 'yuv422p',
    label: 'YUV 4:2:2',
    desc: 'Alta fidelidade de croma',
  },
  yuv444p: {
    id: 'yuv444p',
    label: 'YUV 4:4:4',
    desc: 'Sem subamostragem cromática',
  },
  yuv420p10le: {
    id: 'yuv420p10le',
    label: 'YUV 4:2:0 (10-bit)',
    desc: 'HDR e gradientes suaves',
  },
  yuv422p10le: {
    id: 'yuv422p10le',
    label: 'YUV 4:2:2 (10-bit)',
    desc: 'Edição profissional 10-bit',
  },
  yuv444p10le: {
    id: 'yuv444p10le',
    label: 'YUV 4:4:4 (10-bit)',
    desc: 'Mastering HDR completo',
  },
  yuv420p12le: {
    id: 'yuv420p12le',
    label: 'YUV 4:2:0 (12-bit)',
    desc: 'Cinema digital Dolby Vision',
  },
  yuv422p12le: {
    id: 'yuv422p12le',
    label: 'YUV 4:2:2 (12-bit)',
    desc: 'Estúdio e arquivamento 12-bit',
  },
  yuv444p12le: {
    id: 'yuv444p12le',
    label: 'YUV 4:4:4 (12-bit)',
    desc: 'Fidelidade absoluta sem perdas',
  },
  rgb24: {
    id: 'rgb24',
    label: 'RGB 24-bit',
    desc: 'RGB puro sem matriz YUV',
  },
  gray: {
    id: 'gray',
    label: 'Escala de Cinza',
    desc: 'Preto e branco ultra-leve',
  },
  gray10le: {
    id: 'gray10le',
    label: 'Escala Cinza 10-bit',
    desc: 'P&B com alta precisão tonal',
  },
  gray12le: {
    id: 'gray12le',
    label: 'Escala Cinza 12-bit',
    desc: 'P&B científico/médico',
  },
};

export const DEFAULT_PIXEL_FORMATS: PixelFormatChoice[] = [
  'auto',
  'yuv420p',
  'yuv422p',
  'yuv444p',
  'yuv420p10le',
  'rgb24',
  'gray',
];

export const BIT_DEPTH_PRESETS: Record<BitDepthChoice, BitDepthPresetData> = {
  auto: {
    id: 'auto',
    label: 'Automático',
    desc: 'Padrão do codec',
  },
  '8bit': {
    id: '8bit',
    label: '8-bit (SDR)',
    desc: '16.7M cores • Máxima compatibilidade',
  },
  '10bit': {
    id: '10bit',
    label: '10-bit (HDR)',
    desc: '1.07B cores • Evita color banding em gradientes',
  },
  '12bit': {
    id: '12bit',
    label: '12-bit (Master)',
    desc: 'Masterização profissional / cinema',
  },
};

export const DEFAULT_BIT_DEPTHS: BitDepthChoice[] = ['auto', '8bit', '10bit', '12bit'];

export const COLOR_SPACE_PRESETS: Record<ColorSpaceChoice, ColorSpacePresetData> = {
  auto: {
    id: 'auto',
    label: 'Automático',
    desc: 'Preserva espaço original',
    ffmpegArgs: [],
  },
  bt709: {
    id: 'bt709',
    label: 'Rec. 709 (HD / Web)',
    desc: 'Padrão universal HDTV e internet SDR',
    ffmpegArgs: ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709'],
  },
  bt2020: {
    id: 'bt2020',
    label: 'Rec. 2020 (4K / HDR)',
    desc: 'Ampla gama de cores (Wide Color Gamut)',
    ffmpegArgs: ['-colorspace', 'bt2020nc', '-color_primaries', 'bt2020', '-color_trc', 'arib-std-b67'],
  },
  smpte170m: {
    id: 'smpte170m',
    label: 'Rec. 601 (NTSC)',
    desc: 'Definição padrão analógica NTSC',
    ffmpegArgs: ['-colorspace', 'smpte170m', '-color_primaries', 'smpte170m', '-color_trc', 'smpte170m'],
  },
  bt470bg: {
    id: 'bt470bg',
    label: 'Rec. 601 (PAL)',
    desc: 'Definição padrão PAL / 625 linhas',
    ffmpegArgs: ['-colorspace', 'bt470bg', '-color_primaries', 'bt470bg', '-color_trc', 'bt470bg'],
  },
  srgb: {
    id: 'srgb',
    label: 'sRGB',
    desc: 'Monitores de PC e gráficos',
    ffmpegArgs: ['-colorspace', 'iec61966-2-1', '-color_primaries', 'bt709', '-color_trc', 'iec61966-2-1'],
  },
};

export const DEFAULT_COLOR_SPACES: ColorSpaceChoice[] = [
  'auto',
  'bt709',
  'bt2020',
  'smpte170m',
  'bt470bg',
  'srgb',
];

/**
 * Pure helper to resolve FFmpeg color space arguments from conversion modifiers.
 */
export function resolveColorSpaceArgs(options?: ConversionModifiers): string[] {
  if (!options?.activeCategories?.includes('color_space') || !options.colorSpace || options.colorSpace === 'auto') {
    return [];
  }
  const preset = COLOR_SPACE_PRESETS[options.colorSpace];
  return preset ? [...preset.ffmpegArgs] : [];
}

/**
 * Pure helper to resolve canonical pixel format, profile arguments, and custom status
 * from conversion modifiers.
 */
export function resolvePixelFormatAndBitDepth(options?: ConversionModifiers): {
  pixFmt: string;
  profileArgs: string[];
  isCustom: boolean;
} {
  const isPixFmtActive = options?.activeCategories?.includes('pixel_format');
  const isBitDepthActive = options?.activeCategories?.includes('bit_depth');

  const rawPixFmt = isPixFmtActive && options?.pixelFormat && options.pixelFormat !== 'auto'
    ? options.pixelFormat
    : 'yuv420p';
  const rawBitDepth = isBitDepthActive && options?.bitDepth && options.bitDepth !== 'auto'
    ? options.bitDepth
    : '8bit';

  let chosenFmt = rawPixFmt;
  if (rawBitDepth === '10bit') {
    if (chosenFmt === 'yuv420p') chosenFmt = 'yuv420p10le';
    else if (chosenFmt === 'yuv422p') chosenFmt = 'yuv422p10le';
    else if (chosenFmt === 'yuv444p') chosenFmt = 'yuv444p10le';
    else if (chosenFmt === 'gray') chosenFmt = 'gray10le';
  } else if (rawBitDepth === '12bit') {
    if (chosenFmt === 'yuv420p') chosenFmt = 'yuv420p12le';
    else if (chosenFmt === 'yuv422p') chosenFmt = 'yuv422p12le';
    else if (chosenFmt === 'yuv444p') chosenFmt = 'yuv444p12le';
    else if (chosenFmt === 'gray') chosenFmt = 'gray12le';
  }

  const profileArgs: string[] = [];
  if (rawBitDepth === '10bit') {
    profileArgs.push('-profile:v', 'high10');
  }

  const isCustom = Boolean(
    (isPixFmtActive && options?.pixelFormat && options.pixelFormat !== 'auto') ||
    (isBitDepthActive && options?.bitDepth && options.bitDepth !== 'auto')
  );

  return {
    pixFmt: chosenFmt,
    profileArgs,
    isCustom,
  };
}

