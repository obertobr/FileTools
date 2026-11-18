import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { validateMagicBytes } from '@/core/testing/oracle/magicBytes';
import { validateDecoder } from '@/core/testing/oracle/decoderValidator';
import { LameJSModule } from './lamejs';
import { JSquashModule } from './jsquash';
import { UtifModule } from './utif';
import { ResvgModule } from './resvg';
import { SvgoModule } from './svgo';
import { FflateModule } from './fflate';
import { ZipJSModule } from './zip';
import { LibArchiveModule } from './libarchive';
import { SevenZipModule } from './7z';
import { FoliateModule } from './foliate';
import { FontEditorModule } from './fonteditor';
import { WaWoff2Module } from './wawoff2';
import { AssimpModule } from './assimp';
import { OcctModule } from './occt';
import { Lib3mfModule } from './lib3mf';
import { SheetJSModule } from './sheetjs';
import type { ExecutionContext } from '@/shared/types/module';

const fixturesDir = path.resolve(process.cwd(), 'tests/fixtures');

function readFixture(name: string): Uint8Array {
  return new Uint8Array(fs.readFileSync(path.join(fixturesDir, name)));
}

function makeCtx(): ExecutionContext {
  return {
    workspacePath: '/test/workspace',
    onProgress: () => {},
    onLog: () => {},
  };
}

describe('New Conversion Engines (Real Fixture Execution)', () => {
  it('LameJSModule converts WAV -> MP3 and OGG cleanly', async () => {
    const wav = readFixture('sample.wav');
    const mp3Res = await LameJSModule.execute(
      { fileData: wav, originalName: 'sample.wav', targetFormat: '.mp3' },
      makeCtx()
    );
    const mp3Bytes = mp3Res.outputData as Uint8Array;
    expect(validateMagicBytes(mp3Bytes, 'mp3').valid).toBe(true);

    const oggRes = await LameJSModule.execute(
      { fileData: wav, originalName: 'sample.wav', targetFormat: '.ogg' },
      makeCtx()
    );
    expect(validateMagicBytes(oggRes.outputData as Uint8Array, 'ogg').valid).toBe(true);
  });

  it('JSquashModule converts QOI roundtrip and Resvg/Svgo convert SVG', async () => {
    const qoi = readFixture('sample.qoi');
    const qoiRes = await JSquashModule.execute(
      { fileData: qoi, originalName: 'sample.qoi', targetFormat: '.qoi' },
      makeCtx()
    );
    expect(validateMagicBytes(qoiRes.outputData as Uint8Array, 'qoi').valid).toBe(true);

    const svg = readFixture('sample.svg');
    const svgoRes = await SvgoModule.execute(
      { fileData: svg, originalName: 'sample.svg', targetFormat: '.svg' },
      makeCtx()
    );
    const svgoBytes = svgoRes.outputData as Uint8Array;
    expect(validateMagicBytes(svgoBytes, 'svg').valid).toBe(true);
    expect(svgoBytes.byteLength).toBeLessThanOrEqual(svg.byteLength);

    const resvgRes = await ResvgModule.execute(
      { fileData: svg, originalName: 'sample.svg', targetFormat: '.png', modifiers: { targetWidth: 128 } },
      makeCtx()
    );
    expect(validateMagicBytes(resvgRes.outputData as Uint8Array, 'png').valid).toBe(true);
  });

  it('UtifModule converts QOI -> TIFF and TIFF -> TIFF', async () => {
    const tiff = readFixture('sample.tiff');
    const res = await UtifModule.execute(
      { fileData: tiff, originalName: 'sample.tiff', targetFormat: '.tiff' },
      makeCtx()
    );
    expect(validateMagicBytes(res.outputData as Uint8Array, 'tiff').valid).toBe(true);
  });

  it('Archive engines (fflate, zipjs, libarchive, 7z-wasm) convert ZIP/TAR/GZ/7Z', async () => {
    const zip = readFixture('sample.zip');
    const tar = readFixture('sample.tar');

    const fflateGz = await FflateModule.execute(
      { fileData: zip, originalName: 'sample.zip', targetFormat: '.tgz' },
      makeCtx()
    );
    expect(validateMagicBytes(fflateGz.outputData as Uint8Array, 'tgz').valid).toBe(true);

    const zipProtected = await ZipJSModule.execute(
      {
        fileData: zip,
        originalName: 'sample.zip',
        targetFormat: '.zip',
        modifiers: { archivePassword: 'secret', archiveCompressionLevel: 9 },
      },
      makeCtx()
    );
    expect(validateMagicBytes(zipProtected.outputData as Uint8Array, 'zip').valid).toBe(true);

    const libArchRes = await LibArchiveModule.execute(
      { fileData: tar, originalName: 'sample.tar', targetFormat: '.zip' },
      makeCtx()
    );
    expect(validateMagicBytes(libArchRes.outputData as Uint8Array, 'zip').valid).toBe(true);

    const sevenZRes = await SevenZipModule.execute(
      { fileData: zip, originalName: 'sample.zip', targetFormat: '.7z' },
      makeCtx()
    );
    const sevenZBytes = sevenZRes.outputData as Uint8Array;
    expect(validateMagicBytes(sevenZBytes, '7z').valid).toBe(true);

    const sevenZToZip = await SevenZipModule.execute(
      { fileData: sevenZBytes, originalName: 'sample.7z', targetFormat: '.zip' },
      makeCtx()
    );
    expect(validateMagicBytes(sevenZToZip.outputData as Uint8Array, 'zip').valid).toBe(true);
  });

  it('SheetJSModule supports XLSM and FODS, and FoliateModule converts EPUB/FB2/CBZ', async () => {
    const xlsx = readFixture('sample.xlsx');
    const xlsm = await SheetJSModule.execute(
      { fileData: xlsx, originalName: 'sample.xlsx', targetFormat: '.xlsm' },
      makeCtx()
    );
    expect(validateMagicBytes(xlsm.outputData as Uint8Array, 'xlsm').valid).toBe(true);

    const epub = readFixture('sample.epub');
    const epubMd = await FoliateModule.execute(
      { fileData: epub, originalName: 'sample.epub', targetFormat: '.md' },
      makeCtx()
    );
    const mdText = new TextDecoder().decode(epubMd.outputData as Uint8Array);
    expect(mdText).toContain('FileTools');

    const fb2 = readFixture('sample.fb2');
    const fb2Epub = await FoliateModule.execute(
      { fileData: fb2, originalName: 'sample.fb2', targetFormat: '.epub' },
      makeCtx()
    );
    expect(validateMagicBytes(fb2Epub.outputData as Uint8Array, 'epub').valid).toBe(true);

    const cbz = readFixture('sample.cbz');
    const cbzHtml = await FoliateModule.execute(
      { fileData: cbz, originalName: 'sample.cbz', targetFormat: '.html' },
      makeCtx()
    );
    expect(validateMagicBytes(cbzHtml.outputData as Uint8Array, 'html').valid).toBe(true);
  });

  it('FontEditorModule and WaWoff2Module convert TTF <-> WOFF <-> WOFF2 <-> EOT', async () => {
    const ttf = readFixture('sample.ttf');
    const woff2 = readFixture('sample.woff2');

    const ttfToWoff = await FontEditorModule.execute(
      { fileData: ttf, originalName: 'sample.ttf', targetFormat: '.woff' },
      makeCtx()
    );
    expect(validateMagicBytes(ttfToWoff.outputData as Uint8Array, 'woff').valid).toBe(true);

    const woff2ToTtf = await WaWoff2Module.execute(
      { fileData: woff2, originalName: 'sample.woff2', targetFormat: '.ttf' },
      makeCtx()
    );
    expect(validateMagicBytes(woff2ToTtf.outputData as Uint8Array, 'ttf').valid).toBe(true);
  });

  it('3D / CAD engines (assimp, occt, lib3mf) convert OBJ/STEP/3MF across GLB/STL/PLY/3MF', async () => {
    const obj = readFixture('sample.obj');
    const objToGlb = await AssimpModule.execute(
      { fileData: obj, originalName: 'sample.obj', targetFormat: '.glb' },
      makeCtx()
    );
    const glbBytes = objToGlb.outputData as Uint8Array;
    expect(validateMagicBytes(glbBytes, 'glb').valid).toBe(true);
    expect((await validateDecoder(glbBytes, 'glb')).valid).toBe(true);

    const step = readFixture('sample.step');
    const stepToStl = await OcctModule.execute(
      { fileData: step, originalName: 'sample.step', targetFormat: '.stl' },
      makeCtx()
    );
    const stlBytes = stepToStl.outputData as Uint8Array;
    expect(validateMagicBytes(stlBytes, 'stl').valid).toBe(true);
    expect((await validateDecoder(stlBytes, 'stl')).valid).toBe(true);

    const threeMf = readFixture('sample.3mf');
    const mfToObj = await Lib3mfModule.execute(
      { fileData: threeMf, originalName: 'sample.3mf', targetFormat: '.obj' },
      makeCtx()
    );
    expect(validateMagicBytes(mfToObj.outputData as Uint8Array, 'obj').valid).toBe(true);
  });
});
