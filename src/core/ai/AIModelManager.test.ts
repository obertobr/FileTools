import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AI_MODELS_CATALOG,
  detectAIBackend,
  markModelCached,
  listCachedModels,
  deleteCachedModel,
  clearAllModelCaches,
} from './AIModelManager';
import { getModuleById, resolveAvailableEngines } from '@/modules/registry';
import { decodeImageWithJSquash } from '@/modules/engines/jsquash';
import { validateMagicBytes } from '@/core/testing/oracle/magicBytes';
import { validateDecoder } from '@/core/testing/oracle/decoderValidator';
import type { ExecutionContext } from '@/shared/types/module';

const FIXTURES_DIR = path.resolve(process.cwd(), 'tests/fixtures');

function readFixture(name: string): Uint8Array {
  return new Uint8Array(fs.readFileSync(path.join(FIXTURES_DIR, name)));
}

function makeCtx(): ExecutionContext {
  return {
    workspacePath: '/test/ai',
    onProgress: () => {},
    onLog: () => {},
  };
}

describe('Local AI Subsystem & 8 AI Modules', () => {
  it('detects hardware backend and manages model cache lifecycle cleanly', async () => {
    const hw = await detectAIBackend();
    expect(['webgpu', 'wasm']).toContain(hw.backend);
    expect(typeof hw.simdSupported).toBe('boolean');

    await clearAllModelCaches();
    expect(listCachedModels()).toHaveLength(0);

    markModelCached('ai-bg-remove', 1024 * 1024);
    expect(listCachedModels().some((m) => m.modelId === 'ai-bg-remove')).toBe(true);

    await deleteCachedModel('ai-bg-remove');
    expect(listCachedModels().some((m) => m.modelId === 'ai-bg-remove')).toBe(false);
  });

  it('keeps standard resolveAvailableEngines free of AI modules while exposing all 8 via getModuleById', async () => {
    expect(AI_MODELS_CATALOG).toHaveLength(8);
    for (const entry of AI_MODELS_CATALOG) {
      const mod = getModuleById(entry.id);
      expect(mod).toBeDefined();
      expect(mod?.manifest.category).toBe('ai');
    }

    const txtToWavEngines = await resolveAvailableEngines('TXT', 'WAV');
    expect(txtToWavEngines.find((e) => e.moduleId === 'ai-tts-kokoro')).toBeUndefined();
  });

  it('runs ai-bg-remove producing valid RGBA PNG with transparent pixels', async () => {
    const png = readFixture('sample.png');
    const mod = getModuleById('ai-bg-remove')!;
    const res = await mod.execute(
      { fileData: png, originalName: 'sample.png', targetFormat: '.png' },
      makeCtx()
    );
    const out = res.outputData as Uint8Array;
    expect(validateMagicBytes(out, 'png').valid).toBe(true);

    const frame = await decodeImageWithJSquash(out, '.png');
    let hasTransparent = false;
    for (let i = 3; i < frame.data.length; i += 4) {
      if (frame.data[i] === 0) {
        hasTransparent = true;
        break;
      }
    }
    expect(hasTransparent).toBe(true);
  });

  it('runs ai-upscaler 2x and exactly doubles width & height', async () => {
    const png = readFixture('sample.png');
    const orig = await decodeImageWithJSquash(png, '.png');
    const mod = getModuleById('ai-upscaler')!;
    const res = await mod.execute(
      {
        fileData: png,
        originalName: 'sample.png',
        targetFormat: '.png',
        options: { scaleFactor: 2 },
      },
      makeCtx()
    );
    const out = res.outputData as Uint8Array;
    expect(validateMagicBytes(out, 'png').valid).toBe(true);

    const up = await decodeImageWithJSquash(out, '.png');
    expect(up.width).toBe(orig.width * 2);
    expect(up.height).toBe(orig.height * 2);
  });

  it('runs ai-depth-map in both depth Z-map and Bokeh blur modes', async () => {
    const png = readFixture('sample.png');
    const mod = getModuleById('ai-depth-map')!;

    const depthRes = await mod.execute(
      { fileData: png, originalName: 'sample.png', targetFormat: '.png' },
      makeCtx()
    );
    expect(validateMagicBytes(depthRes.outputData as Uint8Array, 'png').valid).toBe(true);

    const bokehRes = await mod.execute(
      { fileData: png, originalName: 'sample.png', targetFormat: '.png', options: { bokehBlur: true } },
      makeCtx()
    );
    expect(validateMagicBytes(bokehRes.outputData as Uint8Array, 'png').valid).toBe(true);
  });

  it('runs ai-audio-denoise producing valid clean WAV audio', async () => {
    const wav = readFixture('sample.wav');
    const mod = getModuleById('ai-audio-denoise')!;
    const res = await mod.execute(
      { fileData: wav, originalName: 'sample.wav', targetFormat: '.wav' },
      makeCtx()
    );
    const out = res.outputData as Uint8Array;
    expect(validateMagicBytes(out, 'wav').valid).toBe(true);
    expect((await validateDecoder(out, 'wav')).valid).toBe(true);
  });

  it('runs ai-whisper-stt generating synchronized SRT and VTT subtitles', async () => {
    const wav = readFixture('sample.wav');
    const mod = getModuleById('ai-whisper-stt')!;
    const srtRes = await mod.execute(
      {
        fileData: wav,
        originalName: 'sample.wav',
        targetFormat: '.srt',
        options: { hintText: 'Teste local Whisper legendado' },
      },
      makeCtx()
    );
    const srtText = new TextDecoder().decode(srtRes.outputData as Uint8Array);
    expect(srtText).toContain('-->');
    expect(srtText).toContain('Teste');

    const vttRes = await mod.execute(
      { fileData: wav, originalName: 'sample.wav', targetFormat: '.vtt' },
      makeCtx()
    );
    const vttText = new TextDecoder().decode(vttRes.outputData as Uint8Array);
    expect(vttText.startsWith('WEBVTT')).toBe(true);
  });

  it('runs ai-diction-coach generating prosody & clarity JSON report', async () => {
    const wav = readFixture('sample.wav');
    const mod = getModuleById('ai-diction-coach')!;
    const res = await mod.execute(
      {
        fileData: wav,
        originalName: 'sample.wav',
        targetFormat: '.json',
        options: { referenceText: 'Olá mundo teste' },
      },
      makeCtx()
    );
    const parsed = JSON.parse(new TextDecoder().decode(res.outputData as Uint8Array));
    expect(parsed.durationSec).toBeGreaterThan(0);
    expect(parsed.clarityScore).toBeGreaterThanOrEqual(15);
    expect(Array.isArray(parsed.recommendations)).toBe(true);
    expect(parsed.referenceMatchRatio).toBeGreaterThan(0);
  });

  it('runs ai-tts-kokoro synthesizing valid WAV & MP3 speech from text', async () => {
    const mod = getModuleById('ai-tts-kokoro')!;
    const wavRes = await mod.execute(
      {
        originalName: 'script.txt',
        targetFormat: '.wav',
        options: { promptText: 'Olá FileTools teste de voz local.', voice: 'pt-br', speed: 1.0 },
      },
      makeCtx()
    );
    const wavBytes = wavRes.outputData as Uint8Array;
    expect(validateMagicBytes(wavBytes, 'wav').valid).toBe(true);
    expect(wavBytes.byteLength).toBeGreaterThan(10000);

    const mp3Res = await mod.execute(
      {
        originalName: 'script.txt',
        targetFormat: '.mp3',
        options: { promptText: 'Olá FileTools MP3', voice: 'en-us' },
      },
      makeCtx()
    );
    expect(validateMagicBytes(mp3Res.outputData as Uint8Array, 'mp3').valid).toBe(true);
  });

  it('runs ai-ocr extracting structured metrics from image and text from PDF', async () => {
    const png = readFixture('sample.png');
    const mod = getModuleById('ai-ocr')!;
    const imgRes = await mod.execute(
      { fileData: png, originalName: 'sample.png', targetFormat: '.json' },
      makeCtx()
    );
    const parsed = JSON.parse(new TextDecoder().decode(imgRes.outputData as Uint8Array));
    expect(parsed.dimensions.width).toBeGreaterThan(0);

    const pdf = readFixture('sample.pdf');
    const pdfRes = await mod.execute(
      { fileData: pdf, originalName: 'sample.pdf', targetFormat: '.txt' },
      makeCtx()
    );
    expect((pdfRes.outputData as Uint8Array).byteLength).toBeGreaterThan(0);
  });
});
