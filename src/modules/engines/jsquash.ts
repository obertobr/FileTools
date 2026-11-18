import type { IModule, ExecutionContext } from '@/shared/types/module';
import type { ConversionModifiers } from '@/shared/types/conversionModifiers';
import { getMimeType } from '@/core/knowledge/mimeTypes';

export interface RgbaFrame {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

function getOriginBase(): string {
  if (typeof window !== 'undefined' && window.location?.origin && !window.location.origin.startsWith('file:')) {
    return window.location.origin;
  }
  if (typeof self !== 'undefined' && (self as any).location?.origin && !(self as any).location.origin.startsWith('file:')) {
    return (self as any).location.origin;
  }
  return 'http://localhost:4321';
}

export function toImageDataLike(frame: RgbaFrame): ImageData {
  if (typeof ImageData !== 'undefined') {
    const copy = new Uint8ClampedArray(frame.data.byteLength);
    copy.set(frame.data);
    return new ImageData(copy, frame.width, frame.height);
  }
  return {
    data: frame.data,
    width: frame.width,
    height: frame.height,
    colorSpace: 'srgb',
  } as unknown as ImageData;
}

export function resizeRgbaBilinear(frame: RgbaFrame, targetW?: number, targetH?: number): RgbaFrame {
  let w = targetW && targetW > 0 ? Math.round(targetW) : 0;
  let h = targetH && targetH > 0 ? Math.round(targetH) : 0;
  if (!w && !h) return frame;
  if (w && !h) h = Math.max(1, Math.round((frame.height * w) / frame.width));
  if (h && !w) w = Math.max(1, Math.round((frame.width * h) / frame.height));
  if (w === frame.width && h === frame.height) return frame;

  const out = new Uint8ClampedArray(w * h * 4);
  const xRatio = frame.width / w;
  const yRatio = frame.height / h;

  for (let y = 0; y < h; y++) {
    const sy = Math.min(frame.height - 1, y * yRatio);
    const y0 = Math.floor(sy);
    const y1 = Math.min(frame.height - 1, y0 + 1);
    const dy = sy - y0;

    for (let x = 0; x < w; x++) {
      const sx = Math.min(frame.width - 1, x * xRatio);
      const x0 = Math.floor(sx);
      const x1 = Math.min(frame.width - 1, x0 + 1);
      const dx = sx - x0;

      const idx00 = (y0 * frame.width + x0) * 4;
      const idx10 = (y0 * frame.width + x1) * 4;
      const idx01 = (y1 * frame.width + x0) * 4;
      const idx11 = (y1 * frame.width + x1) * 4;
      const outIdx = (y * w + x) * 4;

      for (let c = 0; c < 4; c++) {
        const top = frame.data[idx00 + c] * (1 - dx) + frame.data[idx10 + c] * dx;
        const bot = frame.data[idx01 + c] * (1 - dx) + frame.data[idx11 + c] * dx;
        out[outIdx + c] = Math.round(top * (1 - dy) + bot * dy);
      }
    }
  }
  return { data: out, width: w, height: h };
}

export function flattenAlphaOnColor(frame: RgbaFrame, hexColor = '#ffffff'): RgbaFrame {
  const clean = hexColor.replace('#', '');
  const rBg = parseInt(clean.slice(0, 2) || 'ff', 16) || 255;
  const gBg = parseInt(clean.slice(2, 4) || 'ff', 16) || 255;
  const bBg = parseInt(clean.slice(4, 6) || 'ff', 16) || 255;
  const out = new Uint8ClampedArray(frame.data.length);
  for (let i = 0; i < frame.data.length; i += 4) {
    const a = frame.data[i + 3] / 255;
    out[i] = Math.round(frame.data[i] * a + rBg * (1 - a));
    out[i + 1] = Math.round(frame.data[i + 1] * a + gBg * (1 - a));
    out[i + 2] = Math.round(frame.data[i + 2] * a + bBg * (1 - a));
    out[i + 3] = 255;
  }
  return { data: out, width: frame.width, height: frame.height };
}

export function applyRgbaTransformAndBg(
  frame: RgbaFrame,
  options: Record<string, unknown>,
  isOpaqueTarget: boolean
): RgbaFrame {
  let result = frame;
  const flipH = Boolean(options.imageFlipH);
  const flipV = Boolean(options.imageFlipV);
  const rotate = Number(options.imageRotateDeg ?? options.imageRotate ?? 0);
  const grayscale = Boolean(options.imageGrayscale);

  if (flipH || flipV || rotate === 90 || rotate === 180 || rotate === 270) {
    const srcW = result.width;
    const srcH = result.height;
    const swapDims = rotate === 90 || rotate === 270;
    const dstW = swapDims ? srcH : srcW;
    const dstH = swapDims ? srcW : srcH;
    const dst = new Uint8ClampedArray(dstW * dstH * 4);

    for (let y = 0; y < srcH; y++) {
      for (let x = 0; x < srcW; x++) {
        const sx = flipH ? srcW - 1 - x : x;
        const sy = flipV ? srcH - 1 - y : y;
        let dx = x;
        let dy = y;
        if (rotate === 90) {
          dx = srcH - 1 - y;
          dy = x;
        } else if (rotate === 180) {
          dx = srcW - 1 - x;
          dy = srcH - 1 - y;
        } else if (rotate === 270) {
          dx = y;
          dy = srcW - 1 - x;
        }
        const sIdx = (sy * srcW + sx) * 4;
        const dIdx = (dy * dstW + dx) * 4;
        dst[dIdx] = result.data[sIdx];
        dst[dIdx + 1] = result.data[sIdx + 1];
        dst[dIdx + 2] = result.data[sIdx + 2];
        dst[dIdx + 3] = result.data[sIdx + 3];
      }
    }
    result = { data: dst, width: dstW, height: dstH };
  }

  if (grayscale) {
    const out = new Uint8ClampedArray(result.data.length);
    for (let i = 0; i < result.data.length; i += 4) {
      const lum = Math.round(0.299 * result.data[i] + 0.587 * result.data[i + 1] + 0.114 * result.data[i + 2]);
      out[i] = lum;
      out[i + 1] = lum;
      out[i + 2] = lum;
      out[i + 3] = result.data[i + 3];
    }
    result = { data: out, width: result.width, height: result.height };
  }

  const bgColor = typeof options.backgroundColor === 'string' && options.backgroundColor ? options.backgroundColor : undefined;
  if (bgColor || isOpaqueTarget) {
    result = flattenAlphaOnColor(result, bgColor || '#ffffff');
  }

  return result;
}

export function decodeQoiPure(bytes: Uint8Array): RgbaFrame {
  if (bytes.byteLength < 22 || bytes[0] !== 0x71 || bytes[1] !== 0x6f || bytes[2] !== 0x69 || bytes[3] !== 0x66) {
    throw new Error('[jSquash/QOI] Cabeçalho qoif inválido.');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(4, false);
  const height = view.getUint32(8, false);
  const pixelsLen = width * height * 4;
  const out = new Uint8ClampedArray(pixelsLen);
  const index = new Uint8Array(64 * 4);
  let r = 0, g = 0, b = 0, a = 255;
  let run = 0;
  let p = 14;
  const endLimit = bytes.byteLength - 8;

  for (let pxPos = 0; pxPos < pixelsLen; pxPos += 4) {
    if (run > 0) {
      run--;
    } else if (p < endLimit) {
      const b1 = bytes[p++];
      if (b1 === 0xfe) {
        r = bytes[p++]; g = bytes[p++]; b = bytes[p++];
      } else if (b1 === 0xff) {
        r = bytes[p++]; g = bytes[p++]; b = bytes[p++]; a = bytes[p++];
      } else if ((b1 & 0xc0) === 0x00) {
        const idx = (b1 & 0x3f) * 4;
        r = index[idx]; g = index[idx + 1]; b = index[idx + 2]; a = index[idx + 3];
      } else if ((b1 & 0xc0) === 0x40) {
        r = (r + ((b1 >> 4) & 0x03) - 2) & 0xff;
        g = (g + ((b1 >> 2) & 0x03) - 2) & 0xff;
        b = (b + (b1 & 0x03) - 2) & 0xff;
      } else if ((b1 & 0xc0) === 0x80) {
        const b2 = bytes[p++];
        const vg = (b1 & 0x3f) - 32;
        r = (r + vg - 8 + ((b2 >> 4) & 0x0f)) & 0xff;
        g = (g + vg) & 0xff;
        b = (b + vg - 8 + (b2 & 0x0f)) & 0xff;
      } else if ((b1 & 0xc0) === 0xc0) {
        run = b1 & 0x3f;
      }
      const hash = ((r * 3 + g * 5 + b * 7 + a * 11) & 63) * 4;
      index[hash] = r; index[hash + 1] = g; index[hash + 2] = b; index[hash + 3] = a;
    }
    out[pxPos] = r; out[pxPos + 1] = g; out[pxPos + 2] = b; out[pxPos + 3] = a;
  }
  return { data: out, width, height };
}

export function encodeQoiPure(frame: RgbaFrame): Uint8Array {
  const { data, width, height } = frame;
  const maxLen = 14 + width * height * 5 + 8;
  const out = new Uint8Array(maxLen);
  const view = new DataView(out.buffer);
  out[0] = 0x71; out[1] = 0x6f; out[2] = 0x69; out[3] = 0x66;
  view.setUint32(4, width, false);
  view.setUint32(8, height, false);
  out[12] = 4; out[13] = 0;

  const index = new Uint8Array(64 * 4);
  let rPrev = 0, gPrev = 0, bPrev = 0, aPrev = 255;
  let run = 0;
  let p = 14;
  const totalPx = width * height * 4;

  for (let pxPos = 0; pxPos < totalPx; pxPos += 4) {
    const r = data[pxPos], g = data[pxPos + 1], b = data[pxPos + 2], a = data[pxPos + 3];
    if (r === rPrev && g === gPrev && b === bPrev && a === aPrev) {
      run++;
      if (run === 62 || pxPos + 4 >= totalPx) {
        out[p++] = 0xc0 | (run - 1);
        run = 0;
      }
    } else {
      if (run > 0) {
        out[p++] = 0xc0 | (run - 1);
        run = 0;
      }
      const hash = ((r * 3 + g * 5 + b * 7 + a * 11) & 63) * 4;
      if (index[hash] === r && index[hash + 1] === g && index[hash + 2] === b && index[hash + 3] === a) {
        out[p++] = hash >> 2;
      } else {
        index[hash] = r; index[hash + 1] = g; index[hash + 2] = b; index[hash + 3] = a;
        if (a === aPrev) {
          const vr = ((r - rPrev + 128) & 0xff) - 128;
          const vg = ((g - gPrev + 128) & 0xff) - 128;
          const vb = ((b - bPrev + 128) & 0xff) - 128;
          const vg_r = vr - vg;
          const vg_b = vb - vg;
          if (vr > -3 && vr < 2 && vg > -3 && vg < 2 && vb > -3 && vb < 2) {
            out[p++] = 0x40 | ((vr + 2) << 4) | ((vg + 2) << 2) | (vb + 2);
          } else if (vg_r > -9 && vg_r < 8 && vg > -33 && vg < 32 && vg_b > -9 && vg_b < 8) {
            out[p++] = 0x80 | (vg + 32);
            out[p++] = ((vg_r + 8) << 4) | (vg_b + 8);
          } else {
            out[p++] = 0xfe; out[p++] = r; out[p++] = g; out[p++] = b;
          }
        } else {
          out[p++] = 0xff; out[p++] = r; out[p++] = g; out[p++] = b; out[p++] = a;
        }
      }
      rPrev = r; gPrev = g; bPrev = b; aPrev = a;
    }
  }
  out.set([0, 0, 0, 0, 0, 0, 0, 1], p);
  return out.subarray(0, p + 8);
}

const initialized = new Set<string>();

function isNodeOrJsdom(): boolean {
  return (
    typeof process !== 'undefined' &&
    Boolean(process.versions?.node) &&
    (typeof navigator === 'undefined' || /jsdom/i.test(navigator.userAgent))
  );
}

async function readLocalJsquashWasm(fileName: string): Promise<ArrayBuffer> {
  const fs = await import(/* @vite-ignore */ 'node:fs');
  const path = await import(/* @vite-ignore */ 'node:path');
  const buf = fs.readFileSync(path.resolve(process.cwd(), 'public/wasm/jsquash', fileName));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

async function jsquashOpts(wasmFile?: string): Promise<Record<string, unknown>> {
  if (wasmFile && isNodeOrJsdom()) {
    const wasmBinary = await readLocalJsquashWasm(wasmFile);
    return { wasmBinary };
  }
  const base = `${getOriginBase()}/wasm/jsquash/`;
  return { locateFile: (file: string) => `${base}${file}` };
}

async function initPngCodec(initFn: (arg?: any) => Promise<unknown>): Promise<void> {
  if (isNodeOrJsdom()) {
    const ab = await readLocalJsquashWasm('squoosh_png_bg.wasm');
    await initFn(new Uint8Array(ab));
  } else {
    await initFn(`${getOriginBase()}/wasm/jsquash/squoosh_png_bg.wasm`);
  }
}

export async function encodeRgbaWithJSquash(
  frame: RgbaFrame,
  targetExt: string,
  qualityValue = 85,
  bgColor?: string
): Promise<Uint8Array> {
  const ext = targetExt.startsWith('.') ? targetExt.toLowerCase() : `.${targetExt.toLowerCase()}`;
  const cleanFrame = ext === '.jpg' || ext === '.jpeg' ? flattenAlphaOnColor(frame, bgColor || '#ffffff') : frame;
  const imgData = toImageDataLike(cleanFrame);

  if (ext === '.qoi') {
    try {
      const qoiMod = await import('@jsquash/qoi');
      if (!initialized.has('qoi-enc')) {
        const enc = await import('@jsquash/qoi/encode.js');
        await enc.init(await jsquashOpts('qoi_enc.wasm'));
        initialized.add('qoi-enc');
      }
      return new Uint8Array(await qoiMod.encode(imgData));
    } catch {
      return encodeQoiPure(cleanFrame);
    }
  }

  if (ext === '.png') {
    const pngMod = await import('@jsquash/png');
    if (!initialized.has('png-enc')) {
      const enc = await import('@jsquash/png/encode.js');
      await initPngCodec(enc.init);
      initialized.add('png-enc');
    }
    return new Uint8Array(await pngMod.encode(imgData));
  }

  if (ext === '.jpg' || ext === '.jpeg') {
    const jpgMod = await import('@jsquash/jpeg');
    if (!initialized.has('jpg-enc')) {
      const enc = await import('@jsquash/jpeg/encode.js');
      await enc.init(await jsquashOpts('mozjpeg_enc.wasm'));
      initialized.add('jpg-enc');
    }
    return new Uint8Array(await jpgMod.encode(imgData, { quality: qualityValue }));
  }

  if (ext === '.webp') {
    const webpMod = await import('@jsquash/webp');
    if (!initialized.has('webp-enc')) {
      const enc = await import('@jsquash/webp/encode.js');
      await enc.init(await jsquashOpts('webp_enc.wasm'));
      initialized.add('webp-enc');
    }
    return new Uint8Array(await webpMod.encode(imgData, { quality: qualityValue }));
  }

  if (ext === '.avif') {
    const avifMod = await import('@jsquash/avif');
    if (!initialized.has('avif-enc')) {
      const enc = await import('@jsquash/avif/encode.js');
      await enc.init(await jsquashOpts('avif_enc.wasm'));
      initialized.add('avif-enc');
    }
    const quality = Math.max(1, Math.min(100, qualityValue));
    return new Uint8Array(await avifMod.encode(imgData, { quality, speed: 8 }));
  }

  if (ext === '.jxl') {
    const jxlMod = await import('@jsquash/jxl');
    if (!initialized.has('jxl-enc')) {
      const enc = await import('@jsquash/jxl/encode.js');
      await enc.init(await jsquashOpts('jxl_enc.wasm'));
      initialized.add('jxl-enc');
    }
    return new Uint8Array(await jxlMod.encode(imgData, { quality: qualityValue, effort: 3 }));
  }

  throw new Error(`[jSquash] Formato de saída não suportado: ${targetExt}`);
}

export async function decodeImageWithJSquash(bytes: Uint8Array, sourceExt: string): Promise<RgbaFrame> {
  const ext = sourceExt.startsWith('.') ? sourceExt.toLowerCase() : `.${sourceExt.toLowerCase()}`;
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

  if (ext === '.qoi') {
    try {
      const qoiMod = await import('@jsquash/qoi');
      if (!initialized.has('qoi-dec')) {
        const dec = await import('@jsquash/qoi/decode.js');
        await dec.init(await jsquashOpts('qoi_dec.wasm'));
        initialized.add('qoi-dec');
      }
      const res = await qoiMod.decode(ab);
      return { data: new Uint8ClampedArray(res.data), width: res.width, height: res.height };
    } catch {
      return decodeQoiPure(bytes);
    }
  }

  if (ext === '.png') {
    const pngMod = await import('@jsquash/png');
    if (!initialized.has('png-dec')) {
      const dec = await import('@jsquash/png/decode.js');
      await initPngCodec(dec.init);
      initialized.add('png-dec');
    }
    const res = await pngMod.decode(ab);
    return { data: new Uint8ClampedArray(res.data), width: res.width, height: res.height };
  }

  if (ext === '.jpg' || ext === '.jpeg') {
    const jpgMod = await import('@jsquash/jpeg');
    if (!initialized.has('jpg-dec')) {
      const dec = await import('@jsquash/jpeg/decode.js');
      await dec.init(await jsquashOpts('mozjpeg_dec.wasm'));
      initialized.add('jpg-dec');
    }
    const res = await jpgMod.decode(ab);
    return { data: new Uint8ClampedArray(res.data), width: res.width, height: res.height };
  }

  if (ext === '.webp') {
    const webpMod = await import('@jsquash/webp');
    if (!initialized.has('webp-dec')) {
      const dec = await import('@jsquash/webp/decode.js');
      await dec.init(await jsquashOpts('webp_dec.wasm'));
      initialized.add('webp-dec');
    }
    const res = await webpMod.decode(ab);
    return { data: new Uint8ClampedArray(res.data), width: res.width, height: res.height };
  }

  if (ext === '.avif') {
    const avifMod = await import('@jsquash/avif');
    if (!initialized.has('avif-dec')) {
      const dec = await import('@jsquash/avif/decode.js');
      await dec.init(await jsquashOpts('avif_dec.wasm'));
      initialized.add('avif-dec');
    }
    const res = await avifMod.decode(ab);
    if (!res) throw new Error('[jSquash] Falha ao decodificar AVIF.');
    return { data: new Uint8ClampedArray(res.data), width: res.width, height: res.height };
  }

  if (ext === '.jxl') {
    const jxlMod = await import('@jsquash/jxl');
    if (!initialized.has('jxl-dec')) {
      const dec = await import('@jsquash/jxl/decode.js');
      await dec.init(await jsquashOpts('jxl_dec.wasm'));
      initialized.add('jxl-dec');
    }
    const res = await jxlMod.decode(ab);
    if (!res) throw new Error('[jSquash] Falha ao decodificar JXL.');
    return { data: new Uint8ClampedArray(res.data), width: res.width, height: res.height };
  }

  throw new Error(`[jSquash] Formato de entrada não suportado: ${sourceExt}`);
}

export const JSquashModule: IModule = {
  manifest: {
    id: 'jsquash',
    name: 'jSquash Image Codecs (AVIF / JXL / QOI / WebP)',
    version: '2.1.1',
    description: 'Codecs WebAssembly modernos do projeto Squoosh (AVIF, JPEG XL, QOI, MozJPEG, WebP, OxiPNG).',
    category: 'image',
    supportedModifiers: ['quality', 'resolution', 'image_transform', 'background_color'],
    supportedConversions: [
      {
        from: ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.jxl', '.qoi'],
        to: ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.jxl', '.qoi'],
        lossy: true,
        speedScore: 88,
        acceleration: 'cpu-singlethread',
        performanceNotes: 'Codecs WASM especializados por formato com suporte a JPEG XL (JXL) e QOI',
      },
    ],
    inputs: [{ id: 'file', name: 'Input File', type: 'file_handle', required: true }],
    outputs: [{ id: 'file', name: 'Output File', type: 'file_handle', required: true }],
  },

  isSupported: () => true,

  execute: async (inputs, context: ExecutionContext) => {
    const file = inputs.file as File | Blob | undefined;
    const fileData = inputs.fileData as Uint8Array | undefined;
    const originalName = inputs.originalName as string;
    const targetFormat = inputs.targetFormat as string;
    const modifiers = (inputs.modifiers || inputs.options || {}) as ConversionModifiers & {
      quality?: number;
      backgroundColor?: string;
    };

    if ((!file && !fileData) || !originalName || !targetFormat) {
      throw new Error('jSquash requires file/fileData, originalName, and targetFormat.');
    }

    const inputExt = ('.' + (originalName.split('.').pop() || 'png')).toLowerCase();
    const targetExt = targetFormat.startsWith('.') ? targetFormat.toLowerCase() : '.' + targetFormat.toLowerCase();
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + targetExt;
    const mimeType = getMimeType(targetExt);

    context.onLog(`[jSquash] Decodificando ${originalName}...`);
    context.onProgress(20, 'Decodificando pixels da imagem...');

    const bytes = fileData || new Uint8Array(await (file as File | Blob).arrayBuffer());
    let frame = await decodeImageWithJSquash(bytes, inputExt);

    if (modifiers.targetWidth || modifiers.targetHeight) {
      context.onProgress(45, 'Redimensionando imagem...');
      frame = resizeRgbaBilinear(frame, modifiers.targetWidth, modifiers.targetHeight);
    }

    const isOpaqueTarget = targetExt === '.jpg' || targetExt === '.jpeg';
    frame = applyRgbaTransformAndBg(frame, modifiers as unknown as Record<string, unknown>, isOpaqueTarget);

    const q =
      typeof modifiers.quality === 'number'
        ? modifiers.quality
        : modifiers.qualityPreset === 'original'
        ? 96
        : modifiers.qualityPreset === 'compressed'
        ? 65
        : 85;

    context.onProgress(65, `Codificando para ${targetExt.toUpperCase()}...`);
    const outputData = await encodeRgbaWithJSquash(frame, targetExt, q, modifiers.backgroundColor);
    const outputBlob = new Blob([outputData.buffer as unknown as BlobPart], { type: mimeType });

    context.onProgress(100, 'Conversão concluída!');
    context.onLog(`[jSquash] Sucesso: ${outputFileName} (${outputData.byteLength} bytes)`);

    return {
      outputData,
      outputBlob,
      outputFileName,
      outputSize: outputData.byteLength,
      mimeType,
    };
  },
};
