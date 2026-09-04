/**
 * src/core/knowledge/audioCodecs.ts
 *
 * Central Knowledge Base for audio codecs and encoders.
 * Pure static data contracts and domain normalization functions.
 */

import type { AudioCodecChoice } from '@/shared/types/conversionModifiers';

export interface AudioCodecPresetData {
  id: AudioCodecChoice;
  label: string;
  desc: string;
  ffmpegEncoder: string;
}

export const AUDIO_CODEC_PRESETS: Record<AudioCodecChoice, AudioCodecPresetData> = {
  auto: {
    id: 'auto',
    label: 'Automático',
    desc: 'Padrão recomendado',
    ffmpegEncoder: '',
  },
  mp3: {
    id: 'mp3',
    label: 'MP3 (LAME)',
    desc: 'Universalmente compatível',
    ffmpegEncoder: 'libmp3lame',
  },
  aac: {
    id: 'aac',
    label: 'AAC',
    desc: 'Alta fidelidade e eficiência',
    ffmpegEncoder: 'aac',
  },
  opus: {
    id: 'opus',
    label: 'Opus (48kHz)',
    desc: 'Voz e música de ponta',
    ffmpegEncoder: 'libopus',
  },
  vorbis: {
    id: 'vorbis',
    label: 'Ogg Vorbis',
    desc: 'Padrão livre e aberto',
    ffmpegEncoder: 'libvorbis',
  },
  flac: {
    id: 'flac',
    label: 'FLAC (Lossless)',
    desc: 'Áudio sem perdas',
    ffmpegEncoder: 'flac',
  },
  pcm: {
    id: 'pcm',
    label: 'PCM Linear (WAV)',
    desc: 'Sem compressão',
    ffmpegEncoder: 'pcm_s16le',
  },
  ac3: {
    id: 'ac3',
    label: 'AC-3 (Dolby)',
    desc: 'Cinema / surround',
    ffmpegEncoder: 'ac3',
  },
  copy: {
    id: 'copy',
    label: 'Cópia (Passthrough)',
    desc: 'Sem recodificação',
    ffmpegEncoder: 'copy',
  },
};

export const DEFAULT_AUDIO_CODECS: AudioCodecChoice[] = [
  'auto',
  'mp3',
  'aac',
  'opus',
  'vorbis',
  'flac',
  'pcm',
  'ac3',
  'copy',
];

export function getAudioCodecPreset(id: AudioCodecChoice): AudioCodecPresetData | undefined {
  return AUDIO_CODEC_PRESETS[id];
}

/**
 * Pure helper to resolve the technical FFmpeg encoder name for an AudioCodecChoice.
 */
export function resolveAudioCodecEncoder(
  codec?: AudioCodecChoice | string,
  defaultEncoder: string = 'aac'
): string {
  if (!codec || codec === 'auto') return defaultEncoder;
  const preset = AUDIO_CODEC_PRESETS[codec as AudioCodecChoice];
  return preset?.ffmpegEncoder || (codec === 'copy' ? 'copy' : defaultEncoder);
}

/**
 * Domain normalization function: maps raw stream codec string (e.g. from ffprobe)
 * to standard AudioCodecChoice.
 */
export function normalizeProbedCodec(rawCodec?: string): AudioCodecChoice {
  if (!rawCodec) return 'auto';
  const c = rawCodec.toLowerCase();
  if (c.includes('aac') || c.includes('mp4a')) return 'aac';
  if (c.includes('mp3') || c.includes('mpeg/l3') || c.includes('lame')) return 'mp3';
  if (c.includes('opus')) return 'opus';
  if (c.includes('vorbis')) return 'vorbis';
  if (c.includes('flac')) return 'flac';
  if (c.includes('pcm') || c.includes('wav')) return 'pcm';
  if (c.includes('ac3') || c.includes('ac-3') || c.includes('eac3')) return 'ac3';
  return 'auto';
}

/**
 * Canonical helper for resolving FFmpeg audio codec arguments for any container and stream index.
 * Pure static knowledge logic decoupled from engines.
 */
export function getAudioCodecFlags(
  codec: AudioCodecChoice | string | undefined,
  targetExt: string,
  streamIdx?: number,
  customBitrate?: string
): string[] {
  const s = streamIdx !== undefined ? `:${streamIdx}` : '';
  const bArgs = customBitrate ? [`-b:a${s}`, customBitrate] : [];
  const ext = targetExt.toLowerCase();

  if (codec && codec !== 'auto') {
    if (codec === 'copy') return [`-c:a${s}`, 'copy'];
    if (codec === 'mp3') return [`-c:a${s}`, 'libmp3lame', `-qscale:a${s}`, '2', ...bArgs];
    if (codec === 'aac') return [`-c:a${s}`, 'aac', ...(bArgs.length > 0 ? bArgs : [`-b:a${s}`, '192k'])];
    if (codec === 'vorbis') return [`-c:a${s}`, 'libvorbis', `-qscale:a${s}`, '5', ...bArgs];
    if (codec === 'opus') return [`-c:a${s}`, 'libopus', `-ar${s}`, '48000', ...(bArgs.length > 0 ? bArgs : [`-b:a${s}`, '128k'])];
    if (codec === 'flac') return [`-c:a${s}`, 'flac'];
    if (codec === 'pcm') return [`-c:a${s}`, 'pcm_s16le'];
    if (codec === 'ac3') return [`-c:a${s}`, 'ac3', ...(bArgs.length > 0 ? bArgs : [`-b:a${s}`, '192k'])];
  }

  if (ext === '.mp3') return [`-c:a${s}`, 'libmp3lame', `-qscale:a${s}`, '2', ...bArgs];
  if (ext === '.wav') return [`-c:a${s}`, 'pcm_s16le'];
  if (ext === '.ogg') return [`-c:a${s}`, 'libvorbis', `-qscale:a${s}`, '5', ...bArgs];
  if (ext === '.flac') return [`-c:a${s}`, 'flac'];
  if (ext === '.m4a' || ext === '.aac') return [`-c:a${s}`, 'aac', ...(bArgs.length > 0 ? bArgs : [`-b:a${s}`, '192k'])];
  if (ext === '.opus') return [`-c:a${s}`, 'libopus', `-ar${s}`, '48000', ...(bArgs.length > 0 ? bArgs : [`-b:a${s}`, '128k'])];
  if (ext === '.wma') return [`-c:a${s}`, 'wmav2', ...(bArgs.length > 0 ? bArgs : [`-b:a${s}`, '128k'])];
  if (ext === '.aiff' || ext === '.aif') return [`-c:a${s}`, 'pcm_s16be'];
  if (ext === '.ac3') return [`-c:a${s}`, 'ac3', ...(bArgs.length > 0 ? bArgs : [`-b:a${s}`, '192k'])];
  if (ext === '.m4r') return [`-c:a${s}`, 'aac', ...(bArgs.length > 0 ? bArgs : [`-b:a${s}`, '192k']), '-f', 'ipod'];

  // Default container audio codec fallbacks
  if (ext === '.webm' || ext === '.ogv') return [`-c:a${s}`, 'libvorbis', ...bArgs];
  if (ext === '.avi') return [`-c:a${s}`, 'libmp3lame', ...bArgs];
  if (ext === '.wmv') return [`-c:a${s}`, 'wmav2', ...bArgs];
  if (ext === '.mpg' || ext === '.mpeg' || ext === '.vob') return [`-c:a${s}`, 'mp2', ...bArgs];
  return [`-c:a${s}`, 'aac', ...(bArgs.length > 0 ? bArgs : [`-b:a${s}`, '192k'])];
}

