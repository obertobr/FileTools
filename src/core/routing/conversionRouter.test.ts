import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findOptimalConversionRoutes, resolveReachableTargets } from './conversionRouter';
import { executeConversionRoute } from '@/core/engine/PipelineExecutor';
import { DEFAULT_CONVERSION_MODIFIERS } from '@/shared/types/conversionModifiers';
import { validateMagicBytes } from '@/core/testing/oracle/magicBytes';
import { validateDecoder } from '@/core/testing/oracle/decoderValidator';

const FIXTURES_DIR = path.resolve(process.cwd(), 'tests/fixtures');

function readFixture(name: string): Uint8Array {
  return new Uint8Array(fs.readFileSync(path.join(FIXTURES_DIR, name)));
}

describe('conversionRouter & PipelineExecutor (Multi-Stage)', () => {
  it('prefers direct 1-hop routes whenever available', async () => {
    const routes = await findOptimalConversionRoutes('PNG', 'WEBP');
    expect(routes.length).toBeGreaterThan(0);
    expect(routes[0].isMultiStage).toBe(false);
    expect(routes[0].hops).toHaveLength(1);
  });

  it('rejects incoherent cross-domain hops such as DOCX -> MP3', async () => {
    const routes = await findOptimalConversionRoutes('DOCX', 'MP3');
    expect(routes).toHaveLength(0);
  });

  it('discovers coherent 2-hop routes for Images, Archives and Ebooks', async () => {
    const svgToJxl = await findOptimalConversionRoutes('SVG', 'JXL');
    expect(svgToJxl.length).toBeGreaterThan(0);
    expect(svgToJxl[0].isMultiStage).toBe(true);
    expect(svgToJxl[0].hops.map((h) => h.toExt)).toEqual(['PNG', 'JXL']);

    const tiffToJxl = await findOptimalConversionRoutes('TIFF', 'JXL');
    expect(tiffToJxl.length).toBeGreaterThan(0);
    expect(tiffToJxl[0].isMultiStage).toBe(true);
    expect(tiffToJxl[0].hops.map((h) => h.toExt)).toEqual(['PNG', 'JXL']);

    const wimToTgz = await findOptimalConversionRoutes('WIM', 'TGZ');
    expect(wimToTgz.length).toBeGreaterThan(0);
    expect(wimToTgz[0].isMultiStage).toBe(true);
    expect(wimToTgz[0].hops[wimToTgz[0].hops.length - 1].toExt).toBe('TGZ');

    const fb2ToPdf = await findOptimalConversionRoutes('FB2', 'PDF');
    expect(fb2ToPdf.length).toBeGreaterThan(0);
    expect(fb2ToPdf[0].isMultiStage).toBe(true);
    expect(fb2ToPdf[0].hops[fb2ToPdf[0].hops.length - 1].toExt).toBe('PDF');
  });

  it('exposes multi-stage targets in resolveReachableTargets without polluting cross-domains', () => {
    const svgTargets = resolveReachableTargets('SVG');
    expect(svgTargets).toContain('PNG');
    expect(svgTargets).toContain('JXL');
    expect(svgTargets).toContain('QOI');
    expect(svgTargets).toContain('AVIF');
    expect(svgTargets).not.toContain('MP3');

    const stepTargets = resolveReachableTargets('STEP');
    expect(stepTargets).toContain('GLB');
    expect(stepTargets).toContain('STL');
    expect(stepTargets).not.toContain('MP3');
  });

  it('executes real 2-hop TIFF -> PNG -> JXL pipeline and validates output', async () => {
    const routes = await findOptimalConversionRoutes('TIFF', 'JXL');
    expect(routes.length).toBeGreaterThan(0);
    expect(routes[0].hops.map((h) => h.toExt)).toEqual(['PNG', 'JXL']);

    const tiffData = readFixture('sample.tiff');
    const tiffFile = new File([tiffData.buffer as unknown as BlobPart], 'sample.tiff', {
      type: 'image/tiff',
    });

    const logs: string[] = [];
    const progressValues: number[] = [];

    const result = await executeConversionRoute(
      routes[0],
      tiffFile,
      'sample.tiff',
      {
        ...DEFAULT_CONVERSION_MODIFIERS,
        activeCategories: ['quality'],
        qualityPreset: 'balanced',
      },
      (p) => progressValues.push(p),
      (msg) => logs.push(msg)
    );

    expect(result.stagesExecuted).toBe(2);
    expect(result.outputFileName).toBe('sample.jxl');
    expect(progressValues[progressValues.length - 1]).toBe(100);
    expect(logs.some((l) => l.includes('Etapa 1/2'))).toBe(true);
    expect(logs.some((l) => l.includes('Etapa 2/2'))).toBe(true);

    const outBytes = result.outputData!;
    expect(validateMagicBytes(outBytes, 'jxl').valid).toBe(true);
    expect((await validateDecoder(outBytes, 'jxl')).valid).toBe(true);
  });

  it('executes real 2-hop SVG -> PNG -> QOI pipeline and direct WOFF2 -> WOFF route', async () => {
    const svgRoutes = await findOptimalConversionRoutes('SVG', 'QOI');
    expect(svgRoutes.length).toBeGreaterThan(0);
    expect(svgRoutes[0].hops.map((h) => h.toExt)).toEqual(['PNG', 'QOI']);

    const svgData = readFixture('sample.svg');
    const svgFile = new File([svgData.buffer as unknown as BlobPart], 'sample.svg', {
      type: 'image/svg+xml',
    });
    const svgResult = await executeConversionRoute(
      svgRoutes[0],
      svgFile,
      'sample.svg',
      DEFAULT_CONVERSION_MODIFIERS,
      () => {},
      () => {}
    );
    expect(svgResult.stagesExecuted).toBe(2);
    expect(svgResult.outputFileName).toBe('sample.qoi');
    expect(validateMagicBytes(svgResult.outputData!, 'qoi').valid).toBe(true);
    expect((await validateDecoder(svgResult.outputData!, 'qoi')).valid).toBe(true);

    const woffRoutes = await findOptimalConversionRoutes('WOFF2', 'WOFF');
    expect(woffRoutes.length).toBeGreaterThan(0);

    const woff2Data = readFixture('sample.woff2');
    const woff2File = new File([woff2Data.buffer as unknown as BlobPart], 'sample.woff2', {
      type: 'font/woff2',
    });

    const result = await executeConversionRoute(
      woffRoutes[0],
      woff2File,
      'sample.woff2',
      DEFAULT_CONVERSION_MODIFIERS,
      () => {},
      () => {}
    );

    expect(result.outputFileName).toBe('sample.woff');
    expect(validateMagicBytes(result.outputData!, 'woff').valid).toBe(true);
    expect((await validateDecoder(result.outputData!, 'woff')).valid).toBe(true);
  });
});
