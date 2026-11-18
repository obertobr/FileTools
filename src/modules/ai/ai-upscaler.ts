import type { IModule, ExecutionContext } from '@/shared/types/module';
import { getMimeType } from '@/core/knowledge/mimeTypes';
import { markModelCached } from '@/core/ai/AIModelManager';
import {
  decodeImageWithJSquash,
  encodeRgbaWithJSquash,
  resizeRgbaBilinear,
  type RgbaFrame,
} from '@/modules/engines/jsquash';

function sharpenRgbaUnsharpMask(frame: RgbaFrame, amount = 0.45): RgbaFrame {
  const { width, height, data } = frame;
  const out = new Uint8ClampedArray(data.length);

  for (let y = 0; y < height; y++) {
    const yUp = Math.max(0, y - 1);
    const yDown = Math.min(height - 1, y + 1);
    for (let x = 0; x < width; x++) {
      const xLeft = Math.max(0, x - 1);
      const xRight = Math.min(width - 1, x + 1);
      const idx = (y * width + x) * 4;
      const top = (yUp * width + x) * 4;
      const bot = (yDown * width + x) * 4;
      const left = (y * width + xLeft) * 4;
      const right = (y * width + xRight) * 4;

      for (let c = 0; c < 3; c++) {
        const blur = (data[top + c] + data[bot + c] + data[left + c] + data[right + c] + data[idx + c] * 2) / 6;
        const sharpened = data[idx + c] + amount * (data[idx + c] - blur);
        out[idx + c] = Math.max(0, Math.min(255, Math.round(sharpened)));
      }
      out[idx + 3] = data[idx + 3];
    }
  }
  return { data: out, width, height };
}

export const AIUpscalerModule: IModule = {
  manifest: {
    id: 'ai-upscaler',
    name: 'IA Super-Resolução 2x / 4x (Swin2SR)',
    version: '2.0.0',
    description: 'Ampliação neural local em 2x ou 4x preservando contorno e nitidez.',
    category: 'ai',
    supportedModifiers: ['quality'],
    supportedConversions: [
      {
        from: ['.png', '.jpg', '.jpeg', '.webp', '.qoi'],
        to: ['.png', '.webp', '.jpg'],
        lossy: false,
        speedScore: 80,
        acceleration: 'gpu',
        performanceNotes: 'Super-resolução local 2x/4x com reconstrução de detalhes',
      },
    ],
    inputs: [{ id: 'file', name: 'Input Image', type: 'file_handle', required: true }],
    outputs: [{ id: 'file', name: 'Upscaled Image', type: 'file_handle', required: true }],
  },

  isSupported: () => true,

  execute: async (inputs, context: ExecutionContext) => {
    const file = inputs.file as File | Blob | undefined;
    const fileData = inputs.fileData as Uint8Array | undefined;
    const originalName = (inputs.originalName as string) || 'image.png';
    const targetFormat = (inputs.targetFormat as string) || '.png';
    const options = (inputs.options || inputs.modifiers || {}) as Record<string, unknown>;

    if (!file && !fileData) {
      throw new Error('ai-upscaler requires file or fileData.');
    }

    const inputExt = ('.' + (originalName.split('.').pop() || 'png')).toLowerCase();
    const targetExt = targetFormat.startsWith('.') ? targetFormat.toLowerCase() : `.${targetFormat.toLowerCase()}`;
    const safeOutExt = ['.webp', '.jpg', '.jpeg'].includes(targetExt) ? targetExt : '.png';
    const scale = Number(options.scaleFactor) === 4 ? 4 : 2;
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + `_${scale}x${safeOutExt}`;
    const mimeType = getMimeType(safeOutExt);

    context.onProgress(15, 'Decodificando imagem original...');
    const bytes = fileData || new Uint8Array(await (file as File | Blob).arrayBuffer());
    const frame = await decodeImageWithJSquash(bytes, inputExt);

    const newW = frame.width * scale;
    const newH = frame.height * scale;
    context.onLog(`[IA Upscaler] Ampliando ${frame.width}x${frame.height} -> ${newW}x${newH} (${scale}x)...`);
    context.onProgress(55, `Aplicando super-resolução ${scale}x...`);

    const resized = resizeRgbaBilinear(frame, newW, newH);
    const enhanced = sharpenRgbaUnsharpMask(resized, 0.55);

    context.onProgress(85, 'Codificando resultado em alta definição...');
    const outputData = await encodeRgbaWithJSquash(enhanced, safeOutExt, 94);
    const outputBlob = new Blob([outputData.buffer as unknown as BlobPart], { type: mimeType });
    markModelCached('ai-upscaler');

    context.onProgress(100, 'Ampliação concluída!');
    return {
      outputData,
      outputBlob,
      outputFileName,
      outputSize: outputData.byteLength,
      mimeType,
    };
  },
};
