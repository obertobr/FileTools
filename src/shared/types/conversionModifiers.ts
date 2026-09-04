/**
 * src/shared/types/conversionModifiers.ts
 *
 * Strongly-typed modifiers for media conversion (Modifier Stack).
 * Zero mock data: real probed streams, unified modular stack.
 */

import type { MediaProbeResult } from '@/core/media/mediaProbe';

export type ModifierCategoryId =
  | 'fps'
  | 'resolution'
  | 'audio_tracks'
  | 'audio_merge'
  | 'subtitles'
  | 'threads'
  | 'quality'
  | 'video_codec'
  | 'audio_codec'
  | 'video_duration';

export type QualityPreset = 'original' | 'balanced' | 'compressed' | 'custom';

export type ResolutionScale = 'original' | '1080p' | '720p' | '480p' | '320p' | 'cif' | 'qcif' | 'sub-qcif' | 'custom';

export type VideoCodecChoice =
  | 'auto'
  | 'h264'
  | 'hevc'
  | 'vp8'
  | 'vp9'
  | 'mpeg4'
  | 'h263'
  | 'theora'
  | 'copy';

export type AudioCodecChoice =
  | 'auto'
  | 'mp3'
  | 'aac'
  | 'vorbis'
  | 'opus'
  | 'flac'
  | 'pcm'
  | 'ac3'
  | 'copy';

export interface ConversionModifiers {
  // Stack of active modifier categories
  activeCategories: ModifierCategoryId[];

  // Audio Tracks (Multi-select for video output, or merge selection for audio output)
  selectedAudioTracks: number[];

  // Subtitles (Multi-select, from real probed streams)
  selectedSubtitleTracks: number[];
  keepAllSubtitles: boolean;

  // Performance / Threads
  threadsMode?: 'auto' | 'custom';
  userMaxThreads?: number;
  customThreads?: number;
  isCustomThreads?: boolean;

  // Video Quality & Scale (targetCrf decouples quality preset from engine internals)
  qualityPreset?: QualityPreset;
  targetCrf?: number;
  customCrf?: number;
  isCustomQuality?: boolean;

  // Framerate (FPS) (targetFps decouples framerate from engine internals)
  gifFps?: number;
  targetFps?: number;
  customFps?: number;
  isCustomFps?: boolean;

  // Resolution (Canonical dimensions decouple modifiers from specific engine implementations)
  resolutionScale?: ResolutionScale;
  targetWidth?: number;
  targetHeight?: number;
  customScaleWidth?: number;
  isCustomResolution?: boolean;
  gifScaleWidth?: number;

  // Codecs
  videoCodec?: VideoCodecChoice;
  audioCodec?: AudioCodecChoice;

  // Video Duration (for Image -> Video)
  videoDurationSeconds?: number;
  isCustomDuration?: boolean;

  // Probed media streams (real file metadata - NEVER mocked)
  probedMedia?: MediaProbeResult;
}

export const DEFAULT_CONVERSION_MODIFIERS: ConversionModifiers = {
  activeCategories: [],
  selectedAudioTracks: [],
  selectedSubtitleTracks: [],
  keepAllSubtitles: true,
  threadsMode: 'auto',
  qualityPreset: 'original',
  resolutionScale: 'original',
  videoCodec: 'auto',
  audioCodec: 'auto',
  videoDurationSeconds: 10,
  gifFps: 12,
  gifScaleWidth: 480,
};
