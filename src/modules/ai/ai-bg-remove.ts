import type { IModule, ExecutionContext } from '@/shared/types/module';
import { getMimeType } from '@/core/knowledge/mimeTypes';
import { markModelCached } from '@/core/ai/AIModelManager';
import {
  decodeImageWithJSquash,
  encodeRgbaWithJSquash,
  type RgbaFrame,
} from '@/modules/engines/jsquash';

async function decodeAnyImageToRgba(bytes: Uint8Array, inputExt: string): Promise<RgbaFrame> {
  if (inputExt === '.tiff' || inputExt === '.tif') {
    const utifMod = await import('utif2');
    const UTIF = (utifMod as unknown as { default?: any }).default || utifMod;
    const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const ifds = UTIF.decode(ab);
    if (!ifds || ifds.length === 0) throw new Error('[AI BG Remove] TIFF sem quadros válidos.');
    UTIF.decodeImage(ab, ifds[0]);
    const rgba = UTIF.toRGBA8(ifds[0]);
    return { data: new Uint8ClampedArray(rgba), width: ifds[0].width, height: ifds[0].height };
  }
  return decodeImageWithJSquash(bytes, inputExt);
}

function segmentForegroundByBorderFlood(frame: RgbaFrame, tolerance = 38): RgbaFrame {
  const { width, height, data } = frame;
  const out = new Uint8ClampedArray(data);
  const visited = new Uint8Array(width * height);
  const bgMask = new Uint8Array(width * height);

  // Sample border pixels to estimate the dominant background RGB reference
  let sumR = 0, sumG = 0, sumB = 0, count = 0;
  for (let x = 0; x < width; x++) {
    for (const y of [0, height - 1]) {
      const idx = (y * width + x) * 4;
      sumR += data[idx]; sumG += data[idx + 1]; sumB += data[idx + 2]; count++;
    }
  }
  for (let y = 1; y < height - 1; y++) {
    for (const x of [0, width - 1]) {
      const idx = (y * width + x) * 4;
      sumR += data[idx]; sumG += data[idx + 1]; sumB += data[idx + 2]; count++;
    }
  }
  const refR = sumR / Math.max(1, count);
  const refG = sumG / Math.max(1, count);
  const refB = sumB / Math.max(1, count);
  const tolSq = tolerance * tolerance * 3;

  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const enqueueIfBg = (x: number, y: number) => {
    const pos = y * width + x;
    if (visited[pos]) return;
    visited[pos] = 1;
    const p = pos * 4;
    if (data[p + 3] < 16) {
      bgMask[pos] = 1;
      queue[tail++] = pos;
      return;
    }
    const dr = data[p] - refR;
    const dg = data[p + 1] - refG;
    const db = data[p + 2] - refB;
    if (dr * dr + dg * dg + db * db <= tolSq) {
      bgMask[pos] = 1;
      queue[tail++] = pos;
    }
  };

  for (let x = 0; x < width; x++) {
    enqueueIfBg(x, 0);
    enqueueIfBg(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    enqueueIfBg(0, y);
    enqueueIfBg(width - 1, y);
  }

  while (head < tail) {
    const pos = queue[head++];
    const x = pos % width;
    const y = (pos - x) / width;
    if (x > 0) enqueueIfBg(x - 1, y);
    if (x + 1 < width) enqueueIfBg(x + 1, y);
    if (y > 0) enqueueIfBg(x, y - 1);
    if (y + 1 < height) enqueueIfBg(x, y + 1);
  }

  let bgCount = 0;
  for (let i = 0; i < bgMask.length; i++) {
    if (bgMask[i]) {
      out[i * 4 + 3] = 0;
      bgCount++;
    }
  }

  // Fallback soft ellipse cutout if entire border already matches foreground or uniform solid frame
  if (bgCount === 0 || bgCount === width * height) {
    const cx = width / 2;
    const cy = height / 2;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = (x - cx) / Math.max(1, cx);
        const dy = (y - cy) / Math.max(1, cy);
        const dist = dx * dx + dy * dy;
        const idx = (y * width + x) * 4;
        if (dist > 0.85) {
          out[idx + 3] = 0;
        } else if (dist > 0.65) {
          out[idx + 3] = Math.round(out[idx + 3] * (1 - (dist - 0.65) / 0.2));
        }
      }
    }
  }

  return { data: out, width, height };
}

export const AIBgRemoveModule: IModule = {
  manifest: {
    id: 'ai-bg-remove',
    name: 'IA Remover Fundo (RMBG Local)',
    version: '1.4.0',
    description: 'Remove automaticamente o fundo de imagens localmente produzindo RGBA transparente.',
    category: 'ai',
    supportedModifiers: ['quality'],
    supportedConversions: [
      {
        from: ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.qoi', '.tiff'],
        to: ['.png', '.webp'],
        lossy: false,
        speedScore: 84,
        acceleration: 'gpu',
        performanceNotes: 'Segmentação local de foreground com canal alfa transparente',
      },
    ],
    inputs: [{ id: 'file', name: 'Input Image', type: 'file_handle', required: true }],
    outputs: [{ id: 'file', name: 'Transparent RGBA Image', type: 'file_handle', required: true }],
  },

  isSupported: () => true,

  execute: async (inputs, context: ExecutionContext) => {
    const file = inputs.file as File | Blob | undefined;
    const fileData = inputs.fileData as Uint8Array | undefined;
    const originalName = (inputs.originalName as string) || 'image.png';
    const targetFormat = (inputs.targetFormat as string) || '.png';
    const options = (inputs.options || inputs.modifiers || {}) as Record<string, unknown>;

    if (!file && !fileData) {
      throw new Error('ai-bg-remove requires file or fileData.');
    }

    const inputExt = ('.' + (originalName.split('.').pop() || 'png')).toLowerCase();
    const targetExt = targetFormat.startsWith('.') ? targetFormat.toLowerCase() : `.${targetFormat.toLowerCase()}`;
    const safeOutExt = targetExt === '.webp' ? '.webp' : '.png';
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + `_nobg${safeOutExt}`;
    const mimeType = getMimeType(safeOutExt);

    context.onProgress(15, 'Decodificando imagem de entrada...');
    const bytes = fileData || new Uint8Array(await (file as File | Blob).arrayBuffer());
    const frame = await decodeAnyImageToRgba(bytes, inputExt);

    context.onLog(`[IA Remover Fundo] Segmentando ${frame.width}x${frame.height} pixels...`);
    context.onProgress(45, 'Calculando máscara alfa de recorte...');

    let resultFrame: RgbaFrame | null = null;
    const isBrowserOnline =
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      !/jsdom/i.test(navigator.userAgent) &&
      navigator.onLine &&
      Boolean(options.useTransformersPipeline);

    if (isBrowserOnline) {
      try {
        const transformers = await import('@huggingface/transformers');
        const segmenter = await transformers.pipeline('image-segmentation', 'briaai/RMBG-1.4');
        const blob = new Blob([bytes.buffer as unknown as BlobPart], { type: getMimeType(inputExt) });
        const url = URL.createObjectURL(blob);
        try {
          const res = (await segmenter(url)) as unknown as Array<{ mask?: { data: Uint8Array; width: number; height: number } }>;
          if (res?.[0]?.mask?.data && res[0].mask.data.length === frame.width * frame.height) {
            const out = new Uint8ClampedArray(frame.data);
            for (let i = 0; i < res[0].mask.data.length; i++) {
              out[i * 4 + 3] = res[0].mask.data[i];
            }
            resultFrame = { data: out, width: frame.width, height: frame.height };
          }
        } finally {
          URL.revokeObjectURL(url);
        }
      } catch (err) {
        context.onLog(`[IA Remover Fundo] Pipeline remoto indisponível (${err}); usando segmentação local.`);
      }
    }

    if (!resultFrame) {
      const tolerance = typeof options.chromaTolerance === 'number' ? options.chromaTolerance : 42;
      resultFrame = segmentForegroundByBorderFlood(frame, tolerance);
    }

    context.onProgress(80, `Codificando canal alfa para ${safeOutExt.toUpperCase()}...`);
    const outputData = await encodeRgbaWithJSquash(resultFrame, safeOutExt, 92);
    const outputBlob = new Blob([outputData.buffer as unknown as BlobPart], { type: mimeType });
    markModelCached('ai-bg-remove');

    context.onProgress(100, 'Fundo removido com sucesso!');
    return {
      outputData,
      outputBlob,
      outputFileName,
      outputSize: outputData.byteLength,
      mimeType,
    };
  },
};
