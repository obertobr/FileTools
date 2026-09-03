import { describe, it, expect } from 'vitest';
import { resolvePossibleConversions } from './registry';

describe('Module Registry', () => {
  it('resolves specific file extensions correctly', () => {
    const results = resolvePossibleConversions('.docx');
    
    expect(results.length).toBeGreaterThan(0);
    const mammoth = results.find(r => r.moduleId === 'mammoth');
    expect(mammoth).toBeDefined();
    expect(mammoth?.toExtensions).toContain('.html');
    expect(mammoth?.toExtensions).toContain('.txt');
  });

  it('resolves wildcards correctly (e.g. video/*)', () => {
    // If a user drops a file of type "video/mp4", it should match "video/*"
    const results = resolvePossibleConversions('video/mp4');
    
    expect(results.length).toBeGreaterThan(0);
    const ffmpeg = results.find(r => r.moduleId === 'ffmpeg-core');
    expect(ffmpeg).toBeDefined();
    expect(ffmpeg?.toExtensions).toContain('.mp4');
    expect(ffmpeg?.toExtensions).toContain('.gif');
  });

  it('returns empty array for unsupported formats', () => {
    const results = resolvePossibleConversions('.xyz_unsupported');
    expect(results).toHaveLength(0);
  });
});
