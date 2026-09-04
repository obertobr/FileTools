/**
 * src/core/knowledge/videoCodecs.ts
 *
 * Central Knowledge Base for video codecs and encoders.
 * Pure static data contracts — zero UI or business logic dependencies.
 */

import type { VideoCodecChoice } from '@/shared/types/conversionModifiers';

export interface VideoCodecPresetData {
  id: VideoCodecChoice;
  label: string;
  desc: string;
  ffmpegEncoder: string;
}

export const VIDEO_CODEC_PRESETS: Record<VideoCodecChoice, VideoCodecPresetData> = {
  auto: {
    id: 'auto',
    label: 'Automático',
    desc: 'Ideal para o contêiner',
    ffmpegEncoder: '',
  },
  h264: {
    id: 'h264',
    label: 'H.264 / AVC',
    desc: 'Compatibilidade total (rápido)',
    ffmpegEncoder: 'libx264',
  },
  hevc: {
    id: 'hevc',
    label: 'H.265 / HEVC',
    desc: 'Alta eficiência de compressão',
    ffmpegEncoder: 'libx265',
  },
  vp8: {
    id: 'vp8',
    label: 'VP8',
    desc: 'Padrão aberto WebM',
    ffmpegEncoder: 'libvpx',
  },
  vp9: {
    id: 'vp9',
    label: 'VP9',
    desc: 'Alta definição WebM/MKV',
    ffmpegEncoder: 'libvpx-vp9',
  },
  mpeg4: {
    id: 'mpeg4',
    label: 'MPEG-4',
    desc: 'Compatibilidade com AVI/legados',
    ffmpegEncoder: 'mpeg4',
  },
  h263: {
    id: 'h263',
    label: 'H.263',
    desc: 'Padrão 3GPP clássico (CIF/QCIF)',
    ffmpegEncoder: 'h263',
  },
  theora: {
    id: 'theora',
    label: 'Theora',
    desc: 'Codec livre para Ogg',
    ffmpegEncoder: 'libtheora',
  },
  copy: {
    id: 'copy',
    label: 'Cópia (Passthrough)',
    desc: 'Instantâneo sem perda',
    ffmpegEncoder: 'copy',
  },
};

export const DEFAULT_VIDEO_CODECS: VideoCodecChoice[] = [
  'auto',
  'h264',
  'hevc',
  'vp8',
  'vp9',
  'mpeg4',
  'h263',
  'theora',
  'copy',
];

export function getVideoCodecPreset(id: VideoCodecChoice): VideoCodecPresetData | undefined {
  return VIDEO_CODEC_PRESETS[id];
}

/**
 * Pure helper to resolve the technical FFmpeg encoder name for a VideoCodecChoice.
 */
export function resolveVideoCodecEncoder(
  codec?: VideoCodecChoice | string,
  defaultEncoder: string = 'libx264'
): string {
  if (!codec || codec === 'auto') return defaultEncoder;
  const preset = VIDEO_CODEC_PRESETS[codec as VideoCodecChoice];
  return preset?.ffmpegEncoder || (codec === 'copy' ? 'copy' : defaultEncoder);
}

