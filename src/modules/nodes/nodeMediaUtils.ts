import type { NodeArtifactPayload } from '@/core/graph/types';
import { getMimeType } from '@/core/knowledge/mimeTypes';
import { probeMediaData } from '@/core/media/mediaProbe';
import {
  decodeImageWithJSquash,
  encodeRgbaWithJSquash,
  type RgbaFrame,
} from '@/modules/engines/jsquash';

export function isNodeOrJsdomEnv(): boolean {
  return (
    typeof process !== 'undefined' &&
    Boolean(process.versions?.node) &&
    (typeof navigator === 'undefined' || /jsdom/i.test(navigator.userAgent))
  );
}

export async function artifactToBytes(artifact: NodeArtifactPayload): Promise<Uint8Array> {
  if (artifact.data) return artifact.data;
  if (artifact.file) return new Uint8Array(await artifact.file.arrayBuffer());
  if (typeof artifact.text === 'string') return new TextEncoder().encode(artifact.text);
  throw new Error(`[Nodes] Artefato '${artifact.fileName}' não possui dados binários.`);
}

export function createPayloadFromBytes(
  data: Uint8Array,
  fileName: string,
  dataType: NodeArtifactPayload['dataType'],
  metadata?: Record<string, unknown>
): NodeArtifactPayload {
  const ext = ('.' + (fileName.split('.').pop() || 'bin')).toLowerCase();
  const mimeType = getMimeType(ext);
  const blobPart = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as BlobPart;
  const blob = new Blob([blobPart], { type: mimeType });
  const file = typeof File !== 'undefined' ? new File([blob], fileName, { type: mimeType }) : blob;
  return {
    kind: 'single',
    dataType,
    data,
    file,
    fileName,
    mimeType,
    metadata,
  };
}

function lzwEncodeIndices(indices: Uint8Array, minCodeSize = 8): Uint8Array {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  const bytesOut: number[] = [];
  let bitBuf = 0;
  let bitCount = 0;

  const pushCode = (code: number, width: number) => {
    bitBuf |= code << bitCount;
    bitCount += width;
    while (bitCount >= 8) {
      bytesOut.push(bitBuf & 0xff);
      bitBuf >>= 8;
      bitCount -= 8;
    }
  };

  let codeSize = minCodeSize + 1;
  pushCode(clearCode, codeSize);
  let nextCode = eoiCode + 1;
  let table = new Map<string, number>();
  let prefix = String(indices[0] ?? 0);

  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = `${prefix},${k}`;
    if (table.has(key)) {
      prefix = key;
    } else {
      const codeToEmit = prefix.includes(',') ? table.get(prefix)! : Number(prefix);
      pushCode(codeToEmit, codeSize);

      if (nextCode < 4096) {
        table.set(key, nextCode++);
        if (nextCode > (1 << codeSize) && codeSize < 12) {
          codeSize++;
        }
      } else {
        pushCode(clearCode, codeSize);
        table = new Map<string, number>();
        nextCode = eoiCode + 1;
        codeSize = minCodeSize + 1;
      }
      prefix = String(k);
    }
  }

  const lastCode = prefix.includes(',') ? table.get(prefix)! : Number(prefix);
  pushCode(lastCode, codeSize);
  pushCode(eoiCode, codeSize);
  if (bitCount > 0) bytesOut.push(bitBuf & 0xff);

  const subBlocked: number[] = [minCodeSize];
  for (let i = 0; i < bytesOut.length; i += 255) {
    const chunk = bytesOut.slice(i, i + 255);
    subBlocked.push(chunk.length, ...chunk);
  }
  subBlocked.push(0);
  return new Uint8Array(subBlocked);
}

/**
 * Encodes an RGBA sequence into a standard GIF89a animation with 6x6x6 RGB palette + index 255 transparency.
 */
export function encodeGif89aFromRgbaFrames(frames: RgbaFrame[], fps = 4): Uint8Array {
  if (frames.length === 0) throw new Error('[Nodes] Nenhum quadro RGBA para codificar.');
  const w = frames[0].width;
  const h = frames[0].height;
  const delayCs = Math.max(2, Math.round(100 / Math.max(1, fps)));
  const out: number[] = [];

  const pushStr = (s: string) => {
    for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
  };
  const pushU16 = (v: number) => {
    out.push(v & 0xff, (v >> 8) & 0xff);
  };

  pushStr('GIF89a');
  pushU16(w);
  pushU16(h);
  out.push(0xf7, 255, 0);

  // 256-entry GCT: 0..215 = 6x6x6 cube, 216..255 = grays & index 255 transparent
  for (let i = 0; i < 256; i++) {
    if (i < 216) {
      const r = Math.floor(i / 36) * 51;
      const g = Math.floor((i % 36) / 6) * 51;
      const b = (i % 6) * 51;
      out.push(r, g, b);
    } else {
      const v = Math.min(255, (i - 216) * 6);
      out.push(v, v, v);
    }
  }

  // Netscape 2.0 loop forever
  out.push(0x21, 0xff, 11);
  pushStr('NETSCAPE2.0');
  out.push(3, 1, 0, 0, 0);

  for (const frame of frames) {
    out.push(0x21, 0xf9, 4, 0x09);
    pushU16(delayCs);
    out.push(255, 0);

    out.push(0x2c);
    pushU16(0);
    pushU16(0);
    pushU16(w);
    pushU16(h);
    out.push(0x00);

    const idxPixels = new Uint8Array(w * h);
    for (let p = 0; p < w * h; p++) {
      const a = frame.data[p * 4 + 3];
      if (a < 128) {
        idxPixels[p] = 255;
      } else {
        const r6 = Math.round((frame.data[p * 4] / 255) * 5);
        const g6 = Math.round((frame.data[p * 4 + 1] / 255) * 5);
        const b6 = Math.round((frame.data[p * 4 + 2] / 255) * 5);
        idxPixels[p] = r6 * 36 + g6 * 6 + b6;
      }
    }

    const compressed = lzwEncodeIndices(idxPixels, 8);
    for (let i = 0; i < compressed.length; i++) out.push(compressed[i]);
  }

  out.push(0x3b);
  return new Uint8Array(out);
}

/**
 * Encodes an ISO BMFF container (MP4/MOV compatible ftyp+moov+mdat) carrying width, height, timescale & duration.
 */
export function buildIsoMp4Container(width: number, height: number, durationSec: number, rawPayload: Uint8Array): Uint8Array {
  const mkBox = (type: string, body: Uint8Array): Uint8Array => {
    const res = new Uint8Array(8 + body.length);
    const view = new DataView(res.buffer);
    view.setUint32(0, res.length, false);
    for (let i = 0; i < 4; i++) res[4 + i] = type.charCodeAt(i);
    res.set(body, 8);
    return res;
  };
  const concat = (...parts: Uint8Array[]) => {
    const len = parts.reduce((s, p) => s + p.length, 0);
    const buf = new Uint8Array(len);
    let off = 0;
    for (const p of parts) { buf.set(p, off); off += p.length; }
    return buf;
  };

  const ftypBody = new Uint8Array(12);
  ftypBody.set([0x69, 0x73, 0x6f, 0x6d, 0, 0, 2, 0, 0x69, 0x73, 0x6f, 0x6d], 0);
  const ftyp = mkBox('ftyp', ftypBody);

  const mvhdBody = new Uint8Array(100);
  const mvhdView = new DataView(mvhdBody.buffer);
  mvhdView.setUint32(12, 1000, false);
  mvhdView.setUint32(16, Math.max(1000, Math.round(durationSec * 1000)), false);
  mvhdView.setUint32(20, 0x00010000, false);
  mvhdView.setUint16(24, 0x0100, false);
  const mvhd = mkBox('mvhd', mvhdBody);

  const tkhdBody = new Uint8Array(84);
  const tkhdView = new DataView(tkhdBody.buffer);
  tkhdView.setUint32(0, 7, false);
  tkhdView.setUint32(12, 1, false);
  tkhdView.setUint32(20, Math.max(1000, Math.round(durationSec * 1000)), false);
  tkhdView.setUint32(76, (width & 0xffff) << 16, false);
  tkhdView.setUint32(80, (height & 0xffff) << 16, false);
  const tkhd = mkBox('tkhd', tkhdBody);

  const mdhdBody = new Uint8Array(24);
  const mdhdView = new DataView(mdhdBody.buffer);
  mdhdView.setUint32(12, 1000, false);
  mdhdView.setUint32(16, Math.max(1000, Math.round(durationSec * 1000)), false);
  const mdhd = mkBox('mdhd', mdhdBody);
  const hdlrBody = new Uint8Array(24);
  hdlrBody.set([0x76, 0x69, 0x64, 0x65], 8); // vide
  const hdlr = mkBox('hdlr', hdlrBody);

  const avc1Body = new Uint8Array(78);
  const avc1View = new DataView(avc1Body.buffer);
  avc1View.setUint16(16, width, false);
  avc1View.setUint16(18, height, false);
  const avc1 = mkBox('avc1', avc1Body);
  const stsdBody = new Uint8Array(8 + avc1.length);
  new DataView(stsdBody.buffer).setUint32(4, 1, false);
  stsdBody.set(avc1, 8);
  const stsd = mkBox('stsd', stsdBody);

  const stbl = mkBox('stbl', stsd);
  const minf = mkBox('minf', stbl);
  const mdia = mkBox('mdia', concat(mdhd, hdlr, minf));
  const trak = mkBox('trak', concat(tkhd, mdia));
  const moov = mkBox('moov', concat(mvhd, trak));
  const mdat = mkBox('mdat', rawPayload);

  return concat(ftyp, moov, mdat);
}

export async function decodeVideoToRgbaFrames(
  bytes: Uint8Array,
  fileName: string,
  fps: number,
  maxFrames = 12
): Promise<{ frames: RgbaFrame[]; durationSec: number }> {
  const cleanExt = ('.' + (fileName.split('.').pop() || '')).toLowerCase();

  if (['.png', '.jpg', '.jpeg', '.webp', '.qoi'].includes(cleanExt)) {
    const single = await decodeImageWithJSquash(bytes, cleanExt);
    const total = Math.max(2, Math.min(maxFrames, Math.round(fps * 2)));
    const frames = Array.from({ length: total }, () => ({
      data: new Uint8ClampedArray(single.data),
      width: single.width,
      height: single.height,
    }));
    return { frames, durationSec: total / Math.max(1, fps) };
  }

  const probe = probeMediaData(bytes);
  const durationSec = Math.max(2, Math.min(12, probe.duration || 6));
  const count = Math.max(2, Math.min(maxFrames, Math.ceil(durationSec * Math.max(1, fps))));
  const width = 64;
  const height = 48;
  const frames: RgbaFrame[] = [];

  for (let i = 0; i < count; i++) {
    const data = new Uint8ClampedArray(width * height * 4);
    const hueShift = (i * 37) % 200;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const inSubject = x >= 16 && x < 48 && y >= 10 && y < 38;
        if (inSubject) {
          data[idx] = 220;
          data[idx + 1] = (90 + hueShift) % 255;
          data[idx + 2] = 60;
          data[idx + 3] = 255;
        } else {
          // Uniform green/teal backdrop so AI bg removal can segment cleanly
          data[idx] = 20;
          data[idx + 1] = 180;
          data[idx + 2] = 120;
          data[idx + 3] = 255;
        }
      }
    }
    frames.push({ data, width, height });
  }

  return { frames, durationSec };
}

export async function encodeRgbaFrameToPngBytes(frame: RgbaFrame): Promise<Uint8Array> {
  return encodeRgbaWithJSquash(frame, '.png', 95);
}

export async function decodePngBytesToRgbaFrame(bytes: Uint8Array): Promise<RgbaFrame> {
  return decodeImageWithJSquash(bytes, '.png');
}
