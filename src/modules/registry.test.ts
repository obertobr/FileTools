import { describe, it, expect } from 'vitest';
import { resolvePossibleConversions, resolveAvailableEngines } from './registry';

describe('Module Registry', () => {
  it('resolves specific file extensions correctly (case insensitive)', () => {
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
    const results = resolvePossibleConversions('MP4', 'video/mp4');
    expect(results.length).toBeGreaterThan(0);
    const ffmpeg = results.find(r => r.moduleId === 'ffmpeg-core');
    expect(ffmpeg).toBeDefined();
    expect(ffmpeg?.toExtensions).toContain('.mp4');
    expect(ffmpeg?.toExtensions).toContain('.gif');
  });

  it('resolves MKV even if browser provides empty MIME type', () => {
    const results = resolvePossibleConversions('MKV', '');
    expect(results.length).toBeGreaterThan(0);
    const allMtExts = results.filter(r => r.moduleId === 'ffmpeg-core-mt').flatMap(r => r.toExtensions);
    expect(allMtExts).toContain('.mp4');
    expect(allMtExts).toContain('.gif');
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

  describe('Engine Selection and Performance Ranking', () => {
    it('resolves multiple engines for MP4 -> WebM, sorted by speedScore descending', async () => {
      const engines = await resolveAvailableEngines('MP4', 'WEBM', 'video/mp4');
      
      expect(engines.length).toBeGreaterThanOrEqual(2);
      expect(engines[0].isRecommended).toBe(true);

      for (let i = 0; i < engines.length - 1; i++) {
        expect(engines[i].speedScore).toBeGreaterThanOrEqual(engines[i + 1].speedScore);
      }

      const mtEngine = engines.find(e => e.moduleId === 'ffmpeg-core-mt');
      const stEngine = engines.find(e => e.moduleId === 'ffmpeg-core');

      expect(mtEngine).toBeDefined();
      expect(stEngine).toBeDefined();
      expect(mtEngine!.speedScore).toBeGreaterThan(stEngine!.speedScore);
    });

    it('resolves FFmpeg MT for MKV -> GIF and Stream-Copy (Remux) for MKV -> MP4', async () => {
      const gifEngines = await resolveAvailableEngines('MKV', 'GIF', '');
      expect(gifEngines.length).toBeGreaterThanOrEqual(2);
      expect(gifEngines[0].moduleId).toBe('ffmpeg-core-mt');
      expect(gifEngines[0].acceleration).toBe('cpu-multithread');

      const mp4Engines = await resolveAvailableEngines('MKV', 'MP4', '');
      expect(mp4Engines.length).toBeGreaterThanOrEqual(2);
      // Remux (Stream Copy) is the #1 recommended for MKV -> MP4 (99 pts)
      expect(mp4Engines[0].moduleId).toBe('stream-copy');
      expect(mp4Engines[0].isRecommended).toBe(true);
      expect(mp4Engines[0].acceleration).toBe('instant-copy');

      // FFmpeg MT is also available as full re-encoding alternative
      const mtEngine = mp4Engines.find(e => e.moduleId === 'ffmpeg-core-mt');
      expect(mtEngine).toBeDefined();
    });

    it('does NOT include WebCodecs for formats it cannot demux (e.g. MKV)', async () => {
      const engines = await resolveAvailableEngines('MKV', 'WEBM', '');
      expect(engines.find(e => e.moduleId === 'webcodecs-gpu')).toBeUndefined();
    });

    it('returns empty array if no engine can perform the conversion', async () => {
      const engines = await resolveAvailableEngines('DOCX', 'MP3');
      expect(engines).toHaveLength(0);
    });
  });
});
