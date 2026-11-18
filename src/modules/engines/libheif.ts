import type { IModule, ExecutionContext } from '@/shared/types/module';
import type { ConversionModifiers } from '@/shared/types/conversionModifiers';
import { getMimeType } from '@/core/knowledge/mimeTypes';
import { applyRgbaTransformAndBg, encodeRgbaWithJSquash, resizeRgbaBilinear, type RgbaFrame } from './jsquash';

export const LibHeifModule: IModule = {
  manifest: {
    id: 'libheif',
    name: 'libheif WASM (HEIC / HEIF / AVIF)',
    version: '1.23.5',
    description: 'Decodificador especializado em imagens Apple HEIC, HEIF e AVIF em WebAssembly.',
    category: 'image',
    supportedModifiers: ['quality', 'resolution', 'image_transform', 'background_color'],
    supportedConversions: [
      {
        from: ['.heic', '.heif', '.avif'],
        to: ['.png', '.jpg', '.jpeg', '.webp'],
        lossy: true,
        speedScore: 92,
        acceleration: 'cpu-singlethread',
        performanceNotes: 'Decodificação nativa libheif WASM com preservação de resolução original',
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
      throw new Error('libheif module requires file/fileData, originalName, and targetFormat.');
    }

    const targetExt = targetFormat.startsWith('.') ? targetFormat.toLowerCase() : '.' + targetFormat.toLowerCase();
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + targetExt;
    const mimeType = getMimeType(targetExt);

    context.onLog(`[libheif] Decodificando ${originalName}...`);
    context.onProgress(20, 'Inicializando libheif WASM...');

    const bytes = fileData || new Uint8Array(await (file as File | Blob).arrayBuffer());
    const libheifMod = await import('libheif-js/wasm-bundle.js');
    const libheif = (libheifMod as any).default || libheifMod;
    const decoder = new libheif.HeifDecoder();
    const images = decoder.decode(bytes);
    if (!images || images.length === 0) {
      throw new Error('[libheif] Nenhuma imagem encontrada no contêiner HEIF/HEIC.');
    }

    const image = images[0];
    const width = image.get_width();
    const height = image.get_height();
    const rgba = new Uint8ClampedArray(width * height * 4);

    context.onProgress(50, `Extraindo imagem ${width}x${height}...`);

    await new Promise<void>((resolve, reject) => {
      image.display({ data: rgba, width, height }, (displayData: unknown) => {
        if (!displayData) reject(new Error('[libheif] Falha ao decodificar quadro RGBA.'));
        else resolve();
      });
    });

    let frame: RgbaFrame = { data: rgba, width, height };
    if (modifiers.targetWidth || modifiers.targetHeight) {
      frame = resizeRgbaBilinear(frame, modifiers.targetWidth, modifiers.targetHeight);
    }
    frame = applyRgbaTransformAndBg(
      frame,
      modifiers as unknown as Record<string, unknown>,
      targetExt === '.jpg' || targetExt === '.jpeg'
    );

    const q =
      typeof modifiers.quality === 'number'
        ? modifiers.quality
        : modifiers.qualityPreset === 'original'
        ? 95
        : modifiers.qualityPreset === 'compressed'
        ? 70
        : 85;

    context.onProgress(75, `Codificando para ${targetExt.toUpperCase()}...`);
    const outputData = await encodeRgbaWithJSquash(frame, targetExt, q, modifiers.backgroundColor);
    const outputBlob = new Blob([outputData.buffer as unknown as BlobPart], { type: mimeType });

    context.onProgress(100, 'Conversão HEIC/HEIF concluída!');
    context.onLog(`[libheif] Sucesso: ${outputFileName} (${outputData.byteLength} bytes)`);

    return {
      outputData,
      outputBlob,
      outputFileName,
      outputSize: outputData.byteLength,
      mimeType,
    };
  },
};
