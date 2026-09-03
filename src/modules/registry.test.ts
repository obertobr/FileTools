import { describe, it, expect } from 'vitest';
import { resolvePossibleConversions } from './registry';

describe('Module Registry', () => {
  it('resolves specific file extensions correctly (case insensitive)', () => {
    // Test with uppercase no-dot (as UI sends it)
    const results = resolvePossibleConversions('DOCX');
    
    expect(results.length).toBeGreaterThan(0);
    const mammoth = results.find(r => r.moduleId === 'mammoth');
    expect(mammoth).toBeDefined();
    expect(mammoth?.toExtensions).toContain('.html');
    expect(mammoth?.toExtensions).toContain('.txt');
  });

  it('resolves with dotted lowercase extensions', () => {
    const results = resolvePossibleConversions('.docx');
    expect(results.length).toBeGreaterThan(0);
  });

  it('resolves wildcards correctly using MIME type', () => {
    // FFmpeg uses 'video/*' patterns, so we need to pass MIME type
    const results = resolvePossibleConversions('MP4', 'video/mp4');
    
    expect(results.length).toBeGreaterThan(0);
    const ffmpeg = results.find(r => r.moduleId === 'ffmpeg-core');
    expect(ffmpeg).toBeDefined();
    expect(ffmpeg?.toExtensions).toContain('.mp4');
    expect(ffmpeg?.toExtensions).toContain('.gif');
  });

  it('resolves audio MIME types', () => {
    const results = resolvePossibleConversions('MP3', 'audio/mpeg');
    expect(results.length).toBeGreaterThan(0);
    const ffmpeg = results.find(r => r.moduleId === 'ffmpeg-core');
    expect(ffmpeg).toBeDefined();
    expect(ffmpeg?.toExtensions).toContain('.wav');
  });

  it('returns empty array for unsupported formats', () => {
    const results = resolvePossibleConversions('.xyz_unsupported');
    expect(results).toHaveLength(0);
  });
});
