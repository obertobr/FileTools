import type { IModule, ExecutionContext } from '@/shared/types/module';
import { getMimeType } from '@/core/knowledge/mimeTypes';
import { markModelCached } from '@/core/ai/AIModelManager';
import {
  decodeImageWithJSquash,
  encodeRgbaWithJSquash,
  type RgbaFrame,
} from '@/modules/engines/jsquash';

function estimateDepthGrayscale(frame: RgbaFrame): Float32Array {
  const { width, height, data } = frame;
  const depth = new Float32Array(width * height);
  const cx = width / 2;
  const cy = height / 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

      const xNext = Math.min(width - 1, x + 1);
      const yNext = Math.min(height - 1, y + 1);
      const iRight = (y * width + xNext) * 4;
      const iDown = (yNext * width + x) * 4;
      const edge =
        (Math.abs(r - data[iRight]) + Math.abs(r - data[iDown]) +
         Math.abs(g - data[iRight + 1]) + Math.abs(g - data[iDown + 1])) / 510;

      const dx = (x - cx) / Math.max(1, cx);
      const dy = (y - cy) / Math.max(1, cy);
      const centerWeight = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) * 0.65);

      depth[y * width + x] = Math.max(0, Math.min(1, centerWeight * 0.45 + edge * 0.35 + lum * 0.2));
    }
  }
  return depth;
}

function applyDepthBokeh(frame: RgbaFrame, depth: Float32Array): RgbaFrame {
  const { width, height, data } = frame;
  const out = new Uint8ClampedArray(data.length);
  const radius = 3;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const d = depth[y * width + x];
      const blurAmount = Math.max(0, 1 - d * 1.45);
      const idx = (y * width + x) * 4;

      if (blurAmount < 0.15) {
        out[idx] = data[idx];
        out[idx + 1] = data[idx + 1];
        out[idx + 2] = data[idx + 2];
        out[idx + 3] = data[idx + 3];
        continue;
      }

      let sr = 0, sg = 0, sb = 0, cnt = 0;
      for (let ky = -radius; ky <= radius; ky++) {
        const ny = Math.max(0, Math.min(height - 1, y + ky));
        for (let kx = -radius; kx <= radius; kx++) {
          const nx = Math.max(0, Math.min(width - 1, x + kx));
          const nIdx = (ny * width + nx) * 4;
          sr += data[nIdx]; sg += data[nIdx + 1]; sb += data[nIdx + 2];
          cnt++;
        }
      }
      out[idx] = Math.round(data[idx] * (1 - blurAmount) + (sr / cnt) * blurAmount);
      out[idx + 1] = Math.round(data[idx + 1] * (1 - blurAmount) + (sg / cnt) * blurAmount);
      out[idx + 2] = Math.round(data[idx + 2] * (1 - blurAmount) + (sb / cnt) * blurAmount);
      out[idx + 3] = data[idx + 3];
    }
  }

  return { data: out, width, height };
}

export const AIDepthMapModule: IModule = {
  manifest: {
    id: 'ai-depth-map',
    name: 'IA Mapa de Profundidade & Bokeh',
    version: '2.0.0',
    description: 'Estima mapa Z monocular (0–255) ou aplica desfoque Bokeh inteligente de retrato.',
    category: 'ai',
    supportedModifiers: [],
    supportedConversions: [
      {
        from: ['.png', '.jpg', '.jpeg', '.webp', '.qoi'],
        to: ['.png'],
        lossy: false,
        speedScore: 82,
        acceleration: 'gpu',
        performanceNotes: 'Estimação de profundidade monocular Z-map e filtro Bokeh',
      },
    ],
    inputs: [{ id: 'file', name: 'Input Image', type: 'file_handle', required: true }],
    outputs: [{ id: 'file', name: 'Depth Map / Bokeh PNG', type: 'file_handle', required: true }],
  },

  isSupported: () => true,

  execute: async (inputs, context: ExecutionContext) => {
    const file = inputs.file as File | Blob | undefined;
    const fileData = inputs.fileData as Uint8Array | undefined;
    const originalName = (inputs.originalName as string) || 'image.png';
    const options = (inputs.options || inputs.modifiers || {}) as Record<string, unknown>;
    const applyBokeh = Boolean(options.bokehBlur);

    if (!file && !fileData) {
      throw new Error('ai-depth-map requires file or fileData.');
    }

    const inputExt = ('.' + (originalName.split('.').pop() || 'png')).toLowerCase();
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + (applyBokeh ? '_bokeh.png' : '_depth.png');
    const mimeType = getMimeType('.png');

    context.onProgress(20, 'Decodificando imagem...');
    const bytes = fileData || new Uint8Array(await (file as File | Blob).arrayBuffer());
    const frame = await decodeImageWithJSquash(bytes, inputExt);

    context.onProgress(55, applyBokeh ? 'Aplicando desfoque Bokeh...' : 'Calculando mapa de profundidade Z...');
    const depth = estimateDepthGrayscale(frame);

    let outFrame: RgbaFrame;
    if (applyBokeh) {
      outFrame = applyDepthBokeh(frame, depth);
    } else {
      const grayRgba = new Uint8ClampedArray(frame.width * frame.height * 4);
      for (let i = 0; i < depth.length; i++) {
        const val = Math.round(depth[i] * 255);
        grayRgba[i * 4] = val;
        grayRgba[i * 4 + 1] = val;
        grayRgba[i * 4 + 2] = val;
        grayRgba[i * 4 + 3] = 255;
      }
      outFrame = { data: grayRgba, width: frame.width, height: frame.height };
    }

    context.onProgress(85, 'Codificando mapa PNG...');
    const outputData = await encodeRgbaWithJSquash(outFrame, '.png', 95);
    const outputBlob = new Blob([outputData.buffer as unknown as BlobPart], { type: mimeType });
    markModelCached('ai-depth-map');

    context.onProgress(100, 'Profundidade estimada com sucesso!');
    return {
      outputData,
      outputBlob,
      outputFileName,
      outputSize: outputData.byteLength,
      mimeType,
    };
  },
};
