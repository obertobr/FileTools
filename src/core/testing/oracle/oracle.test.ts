import { describe, it, expect } from 'vitest';
import { validateMagicBytes } from './magicBytes';
import { validateDecoder } from './decoderValidator';
import { auditModifiers } from './modifierAuditor';
import { DEFAULT_CONVERSION_MODIFIERS, type ConversionModifiers } from '@/shared/types/conversionModifiers';

describe('Layer 1: Magic Bytes Validator', () => {
  it('validates authentic PNG signature (\\x89PNG)', () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    const res = validateMagicBytes(pngBytes, 'png');
    expect(res.valid).toBe(true);
    expect(res.detectedSignature).toBeDefined();
  });

  it('rejects corrupted PNG that contains ZIP signature (LibreOffice multipage bug)', () => {
    // PK\x03\x04
    const zipBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
    const res = validateMagicBytes(zipBytes, 'png');
    expect(res.valid).toBe(false);
    expect(res.error).toContain('não possui assinatura válida (\\x89PNG)');
  });

  it('validates authentic PDF header (%PDF-)', () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
    const res = validateMagicBytes(pdfBytes, 'pdf');
    expect(res.valid).toBe(true);
  });

  it('validates authentic JPEG SOI (FF D8 FF)', () => {
    const jpgBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const res = validateMagicBytes(jpgBytes, 'jpg');
    expect(res.valid).toBe(true);
  });

  it('validates EBML header for MKV and WEBM (1A 45 DF A3)', () => {
    const ebmlBytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x93, 0x42, 0x82, 0x88]);
    expect(validateMagicBytes(ebmlBytes, 'mkv').valid).toBe(true);
    expect(validateMagicBytes(ebmlBytes, 'webm').valid).toBe(true);
  });

  it('validates ISO-BMFF box (ftyp at offset 4)', () => {
    // 00 00 00 20 66 74 79 70 69 73 6F 6D
    const mp4Bytes = new Uint8Array([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
    expect(validateMagicBytes(mp4Bytes, 'mp4').valid).toBe(true);
    expect(validateMagicBytes(mp4Bytes, 'mov').valid).toBe(true);
  });

  it('rejects raw audio bitstream pretending to be M4A without ISO-BMFF container', () => {
    const rawAacBytes = new Uint8Array([0xff, 0xf1, 0x50, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const res = validateMagicBytes(rawAacBytes, 'm4a');
    expect(res.valid).toBe(false);
    expect(res.error).toContain('não possui a caixa ftyp');
  });

  it('rejects 0-byte buffer', () => {
    const res = validateMagicBytes(new Uint8Array(0), 'mp4');
    expect(res.valid).toBe(false);
    expect(res.error).toContain('0 bytes');
  });

  it('validates archive signatures (7z, gz, bz2, xz)', () => {
    expect(validateMagicBytes(new Uint8Array([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0x00]), '7z').valid).toBe(true);
    expect(validateMagicBytes(new Uint8Array([0x1f, 0x8b, 0x08, 0x00]), 'gz').valid).toBe(true);
    expect(validateMagicBytes(new Uint8Array([0x42, 0x5a, 0x68, 0x39]), 'bz2').valid).toBe(true);
    expect(validateMagicBytes(new Uint8Array([0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00]), 'xz').valid).toBe(true);
  });

  it('validates next-gen image signatures (jxl, qoi)', () => {
    expect(validateMagicBytes(new Uint8Array([0xff, 0x0a, 0x00, 0x00]), 'jxl').valid).toBe(true);
    const qoi = new Uint8Array(14);
    qoi.set([0x71, 0x6f, 0x69, 0x66]);
    qoi[7] = 1;
    qoi[11] = 1;
    expect(validateMagicBytes(qoi, 'qoi').valid).toBe(true);
  });

  it('validates font signatures (ttf, otf, woff, woff2)', () => {
    expect(validateMagicBytes(new Uint8Array([0x00, 0x01, 0x00, 0x00, 0x00, 0x0c]), 'ttf').valid).toBe(true);
    expect(validateMagicBytes(new Uint8Array([0x4f, 0x54, 0x54, 0x4f, 0x00, 0x0c]), 'otf').valid).toBe(true);
    expect(validateMagicBytes(new Uint8Array([0x77, 0x4f, 0x46, 0x46, 0x00]), 'woff').valid).toBe(true);
    expect(validateMagicBytes(new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0x00]), 'woff2').valid).toBe(true);
  });

  it('validates 3D/CAD and subtitle signatures (glb, stl, step, srt, vtt)', async () => {
    const jsonChunk = new TextEncoder().encode('{"asset":{"version":"2.0"}} ');
    const glb = new Uint8Array(20 + jsonChunk.length);
    const view = new DataView(glb.buffer);
    glb.set([0x67, 0x6c, 0x54, 0x46], 0);
    view.setUint32(4, 2, true);
    view.setUint32(8, glb.length, true);
    view.setUint32(12, jsonChunk.length, true);
    view.setUint32(16, 0x4e4f534a, true);
    glb.set(jsonChunk, 20);
    expect(validateMagicBytes(glb, 'glb').valid).toBe(true);
    expect((await validateDecoder(glb, 'glb')).valid).toBe(true);

    const stl = new Uint8Array(84 + 50);
    new DataView(stl.buffer).setUint32(80, 1, true);
    expect(validateMagicBytes(stl, 'stl').valid).toBe(true);
    expect((await validateDecoder(stl, 'stl')).valid).toBe(true);

    expect(validateMagicBytes(new TextEncoder().encode('ISO-10303-21;\nHEADER;'), 'step').valid).toBe(true);
    expect(validateMagicBytes(new TextEncoder().encode('1\n00:00:00,000 --> 00:00:01,000\nOi\n'), 'srt').valid).toBe(true);
    expect(validateMagicBytes(new TextEncoder().encode('WEBVTT\n\n00:00.000 --> 00:01.000\nOi\n'), 'vtt').valid).toBe(true);
  });
});

describe('Layer 3: Modifier Effect Auditor', () => {
  it('detects resolution mismatch when engine ignores scale modifier', () => {
    const mockData = new Uint8Array(100);
    const modifiers: ConversionModifiers = {
      ...DEFAULT_CONVERSION_MODIFIERS,
      activeCategories: ['resolution'],
      resolutionScale: '720p',
      targetWidth: 1280,
      targetHeight: 720,
    };

    // Engine output has width 1920 (kept native 1080p instead of 1280)
    const audit = auditModifiers(mockData, 'mp4', modifiers, {
      width: 1920,
      height: 1080,
      decodedBy: 'mock',
    });

    expect(audit.valid).toBe(false);
    expect(audit.failures.length).toBe(1);
    expect(audit.failures[0].id).toBe('resolution');
    expect(audit.failures[0].expected).toBe(1280);
    expect(audit.failures[0].actual).toBe(1920);
  });

  it('passes resolution audit when decoded width matches target within tolerance', () => {
    const mockData = new Uint8Array(100);
    const modifiers: ConversionModifiers = {
      ...DEFAULT_CONVERSION_MODIFIERS,
      activeCategories: ['resolution'],
      resolutionScale: '720p',
      targetWidth: 1280,
      targetHeight: 720,
    };

    const audit = auditModifiers(mockData, 'mp4', modifiers, {
      width: 1280,
      height: 720,
      decodedBy: 'mock',
    });

    expect(audit.valid).toBe(true);
    expect(audit.failures).toHaveLength(0);
  });

  it('detects page range mismatch when PDF has multiple pages but 1 was requested', () => {
    const mockData = new Uint8Array(100);
    const modifiers: ConversionModifiers = {
      ...DEFAULT_CONVERSION_MODIFIERS,
      activeCategories: ['page_range'],
      pageRange: '1',
    };

    const audit = auditModifiers(mockData, 'pdf', modifiers, {
      pageCount: 3,
      decodedBy: 'pdf-lib',
    });

    expect(audit.valid).toBe(false);
    expect(audit.failures[0].id).toBe('page_range');
    expect(audit.failures[0].actual).toBe('3 páginas');
  });

  it('detects video duration mismatch when requested duration was not applied', () => {
    const mockData = new Uint8Array(100);
    const modifiers: ConversionModifiers = {
      ...DEFAULT_CONVERSION_MODIFIERS,
      activeCategories: ['video_duration'],
      videoDurationSeconds: 5,
    };

    const audit = auditModifiers(mockData, 'mp4', modifiers, {
      duration: 10,
      decodedBy: 'video',
    });

    expect(audit.valid).toBe(false);
    expect(audit.failures[0].id).toBe('video_duration');
  });
});
