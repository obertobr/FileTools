// @ts-nocheck
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { probeMediaData } from './mediaProbe';
import {
  isModifierIncompatibleWithEngine,
  checkEngineCompatibility,
} from '@/modules/engineCapabilities';
import type { ConversionModifiers } from '@/shared/types/conversionModifiers';

describe('Media Probe & Container Support', () => {
  const fixturesDir = path.resolve(process.cwd(), 'tests/fixtures');

  it('probes real MKV video (1080p, 30fps) with native dimensions and framerate', () => {
    const filePath = path.join(fixturesDir, '2025-03-31 23-44-55.mkv');
    const buf = fs.readFileSync(filePath);
    const result = probeMediaData(new Uint8Array(buf));

    expect(result.format).toBe('mkv');
    expect(result.fps).toBe(30);
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
    expect(result.videoStreams.length).toBeGreaterThan(0);
    expect(result.audioStreams.length).toBeGreaterThan(0);
  });

  it('probes sample MP4 video with native dimensions and framerate', () => {
    const filePath = path.join(fixturesDir, 'sample.mp4');
    const buf = fs.readFileSync(filePath);
    const result = probeMediaData(new Uint8Array(buf));

    expect(result.format).toBe('mp4');
    expect(result.fps).toBe(10);
    expect(result.width).toBe(64);
    expect(result.height).toBe(64);
  });

  it('probes sample AVI video with native dimensions, framerate, and audio track', () => {
    const filePath = path.join(fixturesDir, 'sample.avi');
    if (!fs.existsSync(filePath)) return;
    const buf = fs.readFileSync(filePath);
    const result = probeMediaData(new Uint8Array(buf));

    expect(result.format).toBe('avi');
    expect(result.fps).toBe(30);
    expect(result.width).toBe(64);
    expect(result.height).toBe(64);
    expect(result.videoStreams.length).toBe(1);
    expect(result.audioStreams.length).toBe(1);
  });

  it('probes sample MOV video with native dimensions and framerate', () => {
    const filePath = path.join(fixturesDir, 'sample.mov');
    if (!fs.existsSync(filePath)) return;
    const buf = fs.readFileSync(filePath);
    const result = probeMediaData(new Uint8Array(buf));

    expect(result.format).toBe('mov');
    expect(result.fps).toBe(24);
    expect(result.width).toBe(64);
    expect(result.height).toBe(64);
  });

  it('probes sample FLV video with native dimensions and framerate', () => {
    const filePath = path.join(fixturesDir, 'sample.flv');
    if (!fs.existsSync(filePath)) return;
    const buf = fs.readFileSync(filePath);
    const result = probeMediaData(new Uint8Array(buf));

    expect(result.format).toBe('flv');
    expect(result.fps).toBe(25);
    expect(result.width).toBe(64);
    expect(result.height).toBe(64);
    expect(result.videoStreams.length).toBe(1);
    expect(result.audioStreams.length).toBe(1);
  });

  it('probes sample MPG video with native dimensions and framerate', () => {
    const filePath = path.join(fixturesDir, 'sample.mpg');
    if (!fs.existsSync(filePath)) return;
    const buf = fs.readFileSync(filePath);
    const result = probeMediaData(new Uint8Array(buf));

    expect(result.format).toBe('mpg');
    expect(result.fps).toBe(30);
    expect(result.width).toBe(64);
    expect(result.height).toBe(64);
  });

  it('probes sample OGV video with native dimensions and framerate', () => {
    const filePath = path.join(fixturesDir, 'sample.ogv');
    if (!fs.existsSync(filePath)) return;
    const buf = fs.readFileSync(filePath);
    const result = probeMediaData(new Uint8Array(buf));

    expect(result.format).toBe('ogv');
    expect(result.fps).toBe(30);
    expect(result.width).toBe(64);
    expect(result.height).toBe(64);
  });

  it('probes sample WAV audio with channel count and sample rate', () => {
    const filePath = path.join(fixturesDir, 'sample.wav');
    const buf = fs.readFileSync(filePath);
    const result = probeMediaData(new Uint8Array(buf));

    expect(result.format).toBe('wav');
    expect(result.audioStreams.length).toBe(1);
    expect(result.audioStreams[0].channels).toBeDefined();
    expect(result.audioStreams[0].sampleRate).toBeDefined();
  });

  it('probes sample MP3 audio', () => {
    const filePath = path.join(fixturesDir, 'sample.mp3');
    const buf = fs.readFileSync(filePath);
    const result = probeMediaData(new Uint8Array(buf));

    expect(result.format).toBe('mp3');
    expect(result.audioStreams.length).toBe(1);
  });

  it('probes sample PNG image with dimensions', () => {
    const filePath = path.join(fixturesDir, 'sample.png');
    const buf = fs.readFileSync(filePath);
    const result = probeMediaData(new Uint8Array(buf));

    expect(result.format).toBe('image');
    expect(result.width).toBe(64);
    expect(result.height).toBe(64);
  });

  it('probes sample JPG image with dimensions', () => {
    const filePath = path.join(fixturesDir, 'sample.jpg');
    const buf = fs.readFileSync(filePath);
    const result = probeMediaData(new Uint8Array(buf));

    expect(result.format).toBe('image');
    expect(result.width).toBe(64);
    expect(result.height).toBe(64);
  });

  it('detects stream-copy incompatibility with transcoding options', () => {
    expect(isModifierIncompatibleWithEngine('fps', 'stream-copy')).toBe(true);
    expect(isModifierIncompatibleWithEngine('resolution', 'stream-copy')).toBe(true);
    expect(isModifierIncompatibleWithEngine('quality', 'stream-copy')).toBe(true);
    expect(isModifierIncompatibleWithEngine('video_codec', 'stream-copy')).toBe(true);
    expect(isModifierIncompatibleWithEngine('audio_merge', 'stream-copy')).toBe(true);

    // Threads or audio_tracks are not incompatible
    expect(isModifierIncompatibleWithEngine('threads', 'stream-copy')).toBe(false);
    expect(isModifierIncompatibleWithEngine('audio_tracks', 'stream-copy')).toBe(false);

    // Transcoder engines (ffmpeg) are compatible with all options
    expect(isModifierIncompatibleWithEngine('fps', 'ffmpeg-core-mt')).toBe(false);
    expect(isModifierIncompatibleWithEngine('fps', 'ffmpeg-core')).toBe(false);
  });

  it('validates active options against stream-copy engine', () => {
    const options: ConversionModifiers = {
      activeCategories: ['fps', 'resolution'],
      selectedAudioTracks: [0],
      selectedSubtitleTracks: [],
      keepAllSubtitles: true,
      resolutionScale: '720p',
      customFps: 10,
    };

    const res = checkEngineCompatibility('stream-copy', options);
    expect(res.isIncompatible).toBe(true);
    expect(res.incompatibleCategories).toContain('fps');
    expect(res.incompatibleCategories).toContain('resolution');
    expect(res.recommendedEngineId).toBe('ffmpeg-core-mt');

    // With compatible engine
    const resMt = checkEngineCompatibility('ffmpeg-core-mt', options);
    expect(resMt.isIncompatible).toBe(false);
  });
});
