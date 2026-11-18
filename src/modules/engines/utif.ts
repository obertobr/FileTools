import type { IModule, ExecutionContext } from '@/shared/types/module';
import type { ConversionModifiers } from '@/shared/types/conversionModifiers';
import { getMimeType } from '@/core/knowledge/mimeTypes';
import {
  applyRgbaTransformAndBg,
  decodeImageWithJSquash,
  encodeRgbaWithJSquash,
  resizeRgbaBilinear,
  type RgbaFrame,
} from './jsquash';

export const UtifModule: IModule = {
  manifest: {
    id: 'utif',
    name: 'UTIF.js (TIFF & Camera RAW)',
    version: '4.1.0',
    description: 'Leitor e codificador TIFF/TIF e arquivos RAW baseados em TIFF (DNG, CR2, NEF).',
    category: 'image',
    supportedModifiers: ['quality', 'resolution', 'image_transform', 'background_color'],
    supportedConversions: [
      {
        from: ['.tiff', '.tif', '.dng', '.cr2', '.nef'],
        to: ['.png', '.jpg', '.jpeg', '.webp', '.tiff', '.tif'],
        lossy: false,
        speedScore: 91,
        acceleration: 'cpu-singlethread',
        performanceNotes: 'Decodificação TIFF e RAW IFD diretamente em memória',
      },
      {
        from: ['.png', '.jpg', '.jpeg', '.webp', '.qoi'],
        to: ['.tiff', '.tif'],
        lossy: false,
        speedScore: 91,
        acceleration: 'cpu-singlethread',
        performanceNotes: 'Empacotamento TIFF uncompressed RGBA',
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
      throw new Error('UTIF module requires file/fileData, originalName, and targetFormat.');
    }

    const inputExt = ('.' + (originalName.split('.').pop() || 'tiff')).toLowerCase();
    const targetExt = targetFormat.startsWith('.') ? targetFormat.toLowerCase() : '.' + targetFormat.toLowerCase();
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + targetExt;
    const mimeType = getMimeType(targetExt);

    context.onLog(`[UTIF] Processando ${originalName} -> ${outputFileName}`);
    context.onProgress(20, 'Decodificando imagem/IFDs...');

    const bytes = fileData || new Uint8Array(await (file as File | Blob).arrayBuffer());
    const utifMod = await import('utif2');
    const UTIF = (utifMod as any).default || utifMod;

    let frame: RgbaFrame;

    if (['.tiff', '.tif', '.dng', '.cr2', '.nef'].includes(inputExt)) {
      const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const ifds = UTIF.decode(ab);
      if (!ifds || ifds.length === 0) {
        throw new Error('[UTIF] Nenhum IFD de imagem válido encontrado no arquivo.');
      }
      // Select the highest-resolution IFD (covers RAW previews and full frames)
      let bestIfd = ifds[0];
      let bestArea = 0;
      for (const ifd of ifds) {
        const w = Number(ifd.t256?.[0] || ifd.width || 0);
        const h = Number(ifd.t257?.[0] || ifd.height || 0);
        if (w * h > bestArea) {
          bestArea = w * h;
          bestIfd = ifd;
        }
      }
      UTIF.decodeImage(ab, bestIfd);
      const rgba = UTIF.toRGBA8(bestIfd);
      frame = {
        data: new Uint8ClampedArray(rgba),
        width: bestIfd.width,
        height: bestIfd.height,
      };
    } else {
      frame = await decodeImageWithJSquash(bytes, inputExt);
    }

    if (modifiers.targetWidth || modifiers.targetHeight) {
      frame = resizeRgbaBilinear(frame, modifiers.targetWidth, modifiers.targetHeight);
    }
    frame = applyRgbaTransformAndBg(
      frame,
      modifiers as unknown as Record<string, unknown>,
      targetExt === '.jpg' || targetExt === '.jpeg'
    );

    context.onProgress(65, `Codificando para ${targetExt.toUpperCase()}...`);
    let outputData: Uint8Array;

    if (targetExt === '.tiff' || targetExt === '.tif') {
      const tiffBuffer = UTIF.encodeImage(new Uint8Array(frame.data), frame.width, frame.height);
      outputData = new Uint8Array(tiffBuffer);
    } else {
      const q =
        typeof modifiers.quality === 'number'
          ? modifiers.quality
          : modifiers.qualityPreset === 'original'
          ? 95
          : modifiers.qualityPreset === 'compressed'
          ? 70
          : 85;
      outputData = await encodeRgbaWithJSquash(frame, targetExt, q, modifiers.backgroundColor);
    }

    const outputBlob = new Blob([outputData.buffer as unknown as BlobPart], { type: mimeType });
    context.onProgress(100, 'Conversão TIFF concluída!');
    context.onLog(`[UTIF] Sucesso: ${outputFileName} (${outputData.byteLength} bytes)`);

    return {
      outputData,
      outputBlob,
      outputFileName,
      outputSize: outputData.byteLength,
      mimeType,
    };
  },
};
