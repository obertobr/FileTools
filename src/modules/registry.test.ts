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
    const allStExts = results.filter(r => r.moduleId === 'ffmpeg-core').flatMap(r => r.toExtensions);
    expect(allStExts).toContain('.mp4');
    expect(allStExts).toContain('.gif');
    expect(allStExts).toContain('.mov');
    expect(allStExts).toContain('.avi');
    expect(allStExts).toContain('.flv');
    expect(allStExts).toContain('.wmv');
  });

  it('resolves MKV even if browser provides empty MIME type', () => {
    const results = resolvePossibleConversions('MKV', '');
    expect(results.length).toBeGreaterThan(0);
    const allMtExts = results.filter(r => r.moduleId === 'ffmpeg-core-mt').flatMap(r => r.toExtensions);
    expect(allMtExts).toContain('.mp4');
    expect(allMtExts).toContain('.gif');
    expect(allMtExts).toContain('.webm');
    expect(allMtExts).toContain('.mp3');
  });

  it('resolves audio MIME types and cross conversions', () => {
    const results = resolvePossibleConversions('MP3', 'audio/mpeg');
    expect(results.length).toBeGreaterThan(0);
    const allAudioExts = results.filter(r => r.moduleId === 'ffmpeg-core').flatMap(r => r.toExtensions);
    expect(allAudioExts).toContain('.wav');
    expect(allAudioExts).toContain('.ogg');
    expect(allAudioExts).toContain('.flac');
    expect(allAudioExts).toContain('.aac');
    expect(allAudioExts).toContain('.opus');
  });

  it('resolves video to audio extraction targets', () => {
    const results = resolvePossibleConversions('MP4', 'video/mp4');
    const mtRules = results.filter(r => r.moduleId === 'ffmpeg-core-mt');
    const allTargets = mtRules.flatMap(r => r.toExtensions);
    expect(allTargets).toContain('.mp3');
    expect(allTargets).toContain('.wav');
    expect(allTargets).toContain('.flac');
    expect(allTargets).toContain('.aac');
    expect(allTargets).toContain('.opus');
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

    it('resolves engines for video-to-audio extraction (MKV -> MP3, MP4 -> AAC)', async () => {
      const mkvToMp3 = await resolveAvailableEngines('MKV', 'MP3');
      expect(mkvToMp3.length).toBeGreaterThanOrEqual(2);
      expect(mkvToMp3[0].moduleId).toBe('ffmpeg-core-mt');
      expect(mkvToMp3[0].acceleration).toBe('cpu-multithread');

      const mp4ToAac = await resolveAvailableEngines('MP4', 'AAC');
      expect(mp4ToAac.length).toBeGreaterThanOrEqual(2);
      expect(mp4ToAac[0].moduleId).toBe('mp4box');
      expect(mp4ToAac.find(e => e.moduleId === 'ffmpeg-core-mt')).toBeDefined();
    });

    it('resolves engines for new audio conversions (WAV -> OPUS, FLAC -> M4A)', async () => {
      const wavToOpus = await resolveAvailableEngines('WAV', 'OPUS');
      expect(wavToOpus.length).toBeGreaterThanOrEqual(2);
      expect(wavToOpus[0].moduleId).toBe('ffmpeg-core-mt');

      const flacToM4a = await resolveAvailableEngines('FLAC', 'M4A');
      expect(flacToM4a.length).toBeGreaterThanOrEqual(2);
    });

    it('resolves engines for expanded video containers (WMV -> MP4, FLV -> WEBM, 3GP -> MP4)', async () => {
      const wmvToMp4 = await resolveAvailableEngines('WMV', 'MP4');
      expect(wmvToMp4.length).toBeGreaterThanOrEqual(2);
      expect(wmvToMp4[0].moduleId).toBe('ffmpeg-core-mt');

      const flvToWebm = await resolveAvailableEngines('FLV', 'WEBM');
      expect(flvToWebm.length).toBeGreaterThanOrEqual(2);

      const threeGpToMp4 = await resolveAvailableEngines('3GP', 'MP4');
      expect(threeGpToMp4.length).toBeGreaterThanOrEqual(2);
    });

    it('resolves engines for Audio to Video with black screen (MP3 -> MP4, WAV -> WEBM)', async () => {
      const mp3ToMp4 = await resolveAvailableEngines('MP3', 'MP4', 'audio/mpeg');
      expect(mp3ToMp4.length).toBeGreaterThanOrEqual(2);
      expect(mp3ToMp4[0].moduleId).toBe('ffmpeg-core-mt');

      const wavToWebm = await resolveAvailableEngines('WAV', 'WEBM', 'audio/wav');
      expect(wavToWebm.length).toBeGreaterThanOrEqual(2);
      expect(wavToWebm[0].moduleId).toBe('ffmpeg-core-mt');
    });

    it('resolves engines for Image to Video (PNG -> MP4, JPG -> WEBM)', async () => {
      const pngToMp4 = await resolveAvailableEngines('PNG', 'MP4', 'image/png');
      expect(pngToMp4.length).toBeGreaterThanOrEqual(2);
      expect(pngToMp4[0].moduleId).toBe('ffmpeg-core-mt');

      const jpgToWebm = await resolveAvailableEngines('JPG', 'WEBM', 'image/jpeg');
      expect(jpgToWebm.length).toBeGreaterThanOrEqual(2);
      expect(jpgToWebm[0].moduleId).toBe('ffmpeg-core-mt');
    });

    it('does NOT include MP4Box for formats it cannot demux (e.g. MKV)', async () => {
      const engines = await resolveAvailableEngines('MKV', 'WEBM', '');
      expect(engines.find(e => e.moduleId === 'mp4box')).toBeUndefined();
    });

    it('resolves Mediabunny for WebCodecs accelerated conversions (MP4 -> WEBM, MKV -> MP4, MP4 -> MP4)', async () => {
      const webmEngines = await resolveAvailableEngines('MP4', 'WEBM', 'video/mp4');
      expect(webmEngines.find(e => e.moduleId === 'mediabunny')).toBeDefined();

      const mkvToMp4Engines = await resolveAvailableEngines('MKV', 'MP4');
      expect(mkvToMp4Engines.find(e => e.moduleId === 'mediabunny')).toBeDefined();

      const mp4Engines = await resolveAvailableEngines('MP4', 'MP4', 'video/mp4');
      expect(mp4Engines.find(e => e.moduleId === 'mediabunny')).toBeDefined();

      const m4aEngines = await resolveAvailableEngines('MP4', 'M4A', 'video/mp4');
      expect(m4aEngines.find(e => e.moduleId === 'mp4box')).toBeDefined();
      expect(m4aEngines.find(e => e.moduleId === 'mediabunny')).toBeDefined();
    });

    it('returns empty array if no engine can perform the conversion', async () => {
      const engines = await resolveAvailableEngines('DOCX', 'MP3');
      expect(engines).toHaveLength(0);
    });

    it('resolves PdfModule for image-to-pdf and pdf-to-pdf', async () => {
      const jpgToPdf = await resolveAvailableEngines('JPG', 'PDF');
      expect(jpgToPdf.find(e => e.moduleId === 'pdf-lib')).toBeDefined();

      const pngToPdf = await resolveAvailableEngines('PNG', 'PDF');
      expect(pngToPdf.find(e => e.moduleId === 'pdf-lib')).toBeDefined();

      const pdfToPdf = await resolveAvailableEngines('PDF', 'PDF');
      expect(pdfToPdf.find(e => e.moduleId === 'pdf-lib')).toBeDefined();
    });

    it('resolves MammothModule for DOCX -> HTML, TXT, and MD', async () => {
      const docxToHtml = await resolveAvailableEngines('DOCX', 'HTML');
      expect(docxToHtml.find(e => e.moduleId === 'mammoth')).toBeDefined();

      const docxToTxt = await resolveAvailableEngines('DOCX', 'TXT');
      expect(docxToTxt.find(e => e.moduleId === 'mammoth')).toBeDefined();

      const docxToMd = await resolveAvailableEngines('DOCX', 'MD');
      expect(docxToMd.find(e => e.moduleId === 'mammoth')).toBeDefined();
    });

    it('resolves SheetJSModule across spreadsheets (XLSX, XLS, ODS, CSV, TSV, JSON, HTML)', async () => {
      const xlsxToCsv = await resolveAvailableEngines('XLSX', 'CSV');
      expect(xlsxToCsv.find(e => e.moduleId === 'sheetjs')).toBeDefined();

      const csvToXlsx = await resolveAvailableEngines('CSV', 'XLSX');
      expect(csvToXlsx.find(e => e.moduleId === 'sheetjs')).toBeDefined();

      const odsToXls = await resolveAvailableEngines('ODS', 'XLS');
      expect(odsToXls.find(e => e.moduleId === 'sheetjs')).toBeDefined();

      const jsonToCsv = await resolveAvailableEngines('JSON', 'CSV');
      expect(jsonToCsv.find(e => e.moduleId === 'sheetjs')).toBeDefined();

      const xlsxToHtml = await resolveAvailableEngines('XLSX', 'HTML');
      expect(xlsxToHtml.find(e => e.moduleId === 'sheetjs')).toBeDefined();
    });

    it('resolves MagickModule for image conversions including PDF and WebP', async () => {
      const pngToWebp = await resolveAvailableEngines('PNG', 'WEBP', 'image/png');
      expect(pngToWebp.find(e => e.moduleId === 'magick-wasm')).toBeDefined();

      const jpgToBmp = await resolveAvailableEngines('JPG', 'BMP', 'image/jpeg');
      expect(jpgToBmp.find(e => e.moduleId === 'magick-wasm')).toBeDefined();

      const pngToPdf = await resolveAvailableEngines('PNG', 'PDF', 'image/png');
      expect(pngToPdf.find(e => e.moduleId === 'magick-wasm')).toBeDefined();
    });
  });
});
