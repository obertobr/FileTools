/**
 * src/shared/types/conversionModifiers.ts
 *
 * Strongly-typed modifiers for media conversion (Modifier Stack).
 * Zero mock data: real probed streams, unified modular stack.
 */

import type { ElementType } from 'react';
import type { MediaProbeResult } from '@/core/media/mediaProbe';
import { categoryOfExtension, type Category } from '@/lib/formats';

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
  | 'video_duration'
  | 'pixel_format'
  | 'bit_depth'
  | 'bitrate'
  | 'color_space';

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

export type PixelFormatChoice =
  | 'auto'
  | 'yuv420p'
  | 'yuv422p'
  | 'yuv444p'
  | 'yuv420p10le'
  | 'yuv422p10le'
  | 'yuv444p10le'
  | 'yuv420p12le'
  | 'yuv422p12le'
  | 'yuv444p12le'
  | 'rgb24'
  | 'gray'
  | 'gray10le'
  | 'gray12le';

export type BitDepthChoice =
  | 'auto'
  | '8bit'
  | '10bit'
  | '12bit';

export type ColorSpaceChoice =
  | 'auto'
  | 'bt709'
  | 'bt2020'
  | 'smpte170m'
  | 'bt470bg'
  | 'srgb';

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
  customScaleHeight?: number;
  isCustomResolutionProportional?: boolean;
  isCustomResolution?: boolean;
  gifScaleWidth?: number;

  // Codecs
  videoCodec?: VideoCodecChoice;
  audioCodec?: AudioCodecChoice;
  syncAllAudioCodecs?: boolean;
  trackAudioCodecs?: Record<number, AudioCodecChoice>;

  // Pixel Format
  pixelFormat?: PixelFormatChoice;

  // Bit Depth
  bitDepth?: BitDepthChoice;

  // Bitrate (Target / Max)
  videoBitrate?: string;
  customVideoBitrateKbps?: number;
  isCustomVideoBitrate?: boolean;
  audioBitrate?: string;
  customAudioBitrateKbps?: number;
  isCustomAudioBitrate?: boolean;

  // Color Space
  colorSpace?: ColorSpaceChoice;

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
  pixelFormat: 'auto',
  bitDepth: 'auto',
  videoBitrate: 'auto',
  audioBitrate: 'auto',
  colorSpace: 'auto',
  isCustomResolutionProportional: true,
  syncAllAudioCodecs: true,
  trackAudioCodecs: {},
  videoDurationSeconds: 10,
  gifFps: 12,
  gifScaleWidth: 480,
};

export interface ModifierContext {
  sourceExt: string;
  targetExt: string;
  sourceCategory: Category;
  targetCategory: Category;
  currentValues: ConversionModifiers;
  activeModifiers: ModifierCategoryId[];
  sourceProbe?: MediaProbeResult;
}

export interface ImplicitRuleResult {
  isImplicit: boolean;
  lockedValue?: any;
  reason?: string;
}

export interface DerivedOptionsResult {
  allowedOptions?: (string | number)[];
  warningMessage?: string;
}

export interface ModifierDefinition {
  id: ModifierCategoryId;
  title: string;
  description: string;
  icon: ElementType;
  pinned?: boolean | ((ctx: ModifierContext) => boolean);

  // 1. Aplicabilidade Base: Faz sentido mostrar isso para essa conversão?
  isApplicable: (ctx: ModifierContext) => boolean;

  // 2. Exclusão Mútua: Quais modificadores NÃO podem coexistir com este?
  mutuallyExclusiveWith?: ModifierCategoryId[];

  // 3. Trava Implícita (Force On): Deve ser ativado obrigatoriamente e travado?
  implicitRule?: (ctx: ModifierContext) => ImplicitRuleResult;

  // 4. Derivação de Opções (Synergy): O modificador adapta suas opções
  // com base no que os outros modificadores estão fazendo.
  deriveOptions?: (ctx: ModifierContext) => DerivedOptionsResult;
}

export function createModifierContext(
  targetFormat: string,
  sourceExt: string,
  currentValues: ConversionModifiers,
  sourceProbe?: MediaProbeResult
): ModifierContext {
  const cleanTarget = (targetFormat || '').toLowerCase().replace(/^\.+/, '');
  const cleanSource = (sourceExt || '').toLowerCase().replace(/^\.+/, '');
  return {
    sourceExt: cleanSource,
    targetExt: cleanTarget,
    sourceCategory: categoryOfExtension(cleanSource),
    targetCategory: categoryOfExtension(cleanTarget),
    currentValues,
    activeModifiers: currentValues?.activeCategories || [],
    sourceProbe,
  };
}
