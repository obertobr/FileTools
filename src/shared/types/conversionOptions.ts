/**
 * src/shared/types/conversionOptions.ts
 *
 * Strongly-typed options for media conversion.
 * Zero mock data: real probed streams, unified modular stack.
 */

import type { MediaProbeResult } from '@/core/media/mediaProbe';

export type ConfigCategoryId =
  | 'fps'
  | 'resolution'
  | 'audio_tracks'
  | 'subtitles'
  | 'threads'
  | 'quality'
  | 'video_codec';

export type QualityPreset = 'original' | 'balanced' | 'compressed' | 'custom';

export type ResolutionScale = 'original' | '1080p' | '720p' | '480p' | '320p' | 'custom';

export type VideoCodecChoice = 'auto' | 'h264' | 'vp8' | 'vp9' | 'copy';

export interface ConversionOptions {
  // Stack of active categories
  activeCategories: ConfigCategoryId[];

  // Audio Tracks (Multi-select, all selected by default from real probed streams)
  selectedAudioTracks: number[];

  // Subtitles (Multi-select, from real probed streams)
  selectedSubtitleTracks: number[];
  keepAllSubtitles: boolean;

  // Performance / Threads
  threadsMode?: 'auto' | 'custom';
  userMaxThreads?: number;
  customThreads?: number;
  isCustomThreads?: boolean;

  // Video Quality & Scale
  qualityPreset?: QualityPreset;
  customCrf?: number;
  isCustomQuality?: boolean;

  // Framerate (FPS)
  gifFps?: number;
  customFps?: number;
  isCustomFps?: boolean;

  // Resolution
  resolutionScale?: ResolutionScale;
  customScaleWidth?: number;
  isCustomResolution?: boolean;
  gifScaleWidth?: number;

  // Codecs
  videoCodec?: VideoCodecChoice;

  // Probed media streams (real file metadata - NEVER mocked)
  probedMedia?: MediaProbeResult;
}

export const DEFAULT_CONVERSION_OPTIONS: ConversionOptions = {
  activeCategories: [],
  selectedAudioTracks: [],
  selectedSubtitleTracks: [],
  keepAllSubtitles: true,
  threadsMode: 'auto',
  qualityPreset: 'original',
  resolutionScale: '480p',
  videoCodec: 'auto',
  gifFps: 12,
  gifScaleWidth: 480,
};
