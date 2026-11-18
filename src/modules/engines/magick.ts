/**
 * src/modules/engines/magick.ts
 *
 * Universal Image Processing and Conversion Engine powered by ImageMagick WASM (@imagemagick/magick-wasm).
 * Supports high-fidelity conversion across raster and vector formats (PNG, JPG, WEBP, TIFF, BMP, GIF, AVIF, HEIC, ICO, PDF).
 *
 * Adheres to:
 * - Pilar 1: Desacoplamento Canônico (Engines "Burras")
 * - Pilar 2: Retorno em outputBlob com MIME types canônicos
 */
import {
  ImageMagick,
  initializeImageMagick,
  MagickFormat,
  Density,
  DensityUnit,
  AlphaAction,
  MagickColor,
} from '@imagemagick/magick-wasm';
import type { IModule, ExecutionContext } from '@/shared/types/module';
import { getMimeType } from '@/core/knowledge/mimeTypes';

let magickLoaded = false;
let magickLoadingPromise: Promise<void> | null = null;

async function ensureMagickInitialized(context: ExecutionContext): Promise<void> {
  if (magickLoaded) return;
  if (magickLoadingPromise) return magickLoadingPromise;

  magickLoadingPromise = (async () => {
    context.onLog('[ImageMagick] Carregando binário WASM (/magick.wasm)...');
    context.onProgress(0, 'Carregando ImageMagick WASM...');

    const origin = typeof window !== 'undefined'
      ? window.location.origin
      : (typeof self !== 'undefined' && self.location ? self.location.origin : 'http://localhost:4321');
    const response = await fetch(`${origin}/magick.wasm`);
    if (!response.ok) {
      throw new Error(`Falha ao carregar /magick.wasm (status ${response.status})`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    await initializeImageMagick(bytes);

    magickLoaded = true;
    context.onLog('[ImageMagick] Inicializado com sucesso.');
  })();

  return magickLoadingPromise;
}

const EXT_TO_MAGICK_FORMAT: Record<string, MagickFormat> = {
  '.png': MagickFormat.Png,
  '.jpg': MagickFormat.Jpeg,
  '.jpeg': MagickFormat.Jpeg,
  '.webp': MagickFormat.WebP,
  '.tiff': MagickFormat.Tiff,
  '.tif': MagickFormat.Tiff,
  '.avif': MagickFormat.Avif,
  '.heic': MagickFormat.Heic,
  '.heif': MagickFormat.Heic,
  '.bmp': MagickFormat.Bmp,
  '.gif': MagickFormat.Gif,
  '.ico': MagickFormat.Ico,
  '.pdf': MagickFormat.Pdf,
  '.psd': MagickFormat.Psd,
  '.tga': MagickFormat.Tga,
  '.pnm': MagickFormat.Pnm,
  '.ppm': MagickFormat.Ppm,
  '.pgm': MagickFormat.Pgm,
  '.pbm': MagickFormat.Pbm,
  '.jp2': MagickFormat.Jp2,
  '.svg': MagickFormat.Svg,
};

export const MagickModule: IModule = {
  manifest: {
    id: 'magick-wasm',
    name: 'ImageMagick WASM',
    version: '0.0.43',
    description: 'Conversor universal de imagens de alta fidelidade via ImageMagick WebAssembly.',
    category: 'image',
    supportedModifiers: ['quality', 'resolution', 'image_dpi', 'image_transform', 'background_color'],
    supportedConversions: [
      {
        from: [
          '.png',
          '.jpg',
          '.jpeg',
          '.webp',
          '.tiff',
          '.tif',
          '.bmp',
          '.gif',
          '.heic',
          '.heif',
          '.avif',
          '.ico',
          '.psd',
          '.tga',
          '.pnm',
          '.ppm',
          '.pgm',
          '.pbm',
          '.jp2',
          '.svg',
        ],
        to: [
          '.png',
          '.jpg',
          '.jpeg',
          '.webp',
          '.tiff',
          '.tif',
          '.bmp',
          '.gif',
          '.avif',
          '.ico',
          '.pdf',
          '.psd',
          '.tga',
          '.pnm',
          '.ppm',
          '.pgm',
          '.pbm',
          '.jp2',
        ],
        lossy: true,
        speedScore: 90,
        acceleration: 'cpu-singlethread',
        performanceNotes: 'Processamento de imagem nativo em WebAssembly com suporte a transformações e metadados',
      },
    ],
    inputs: [
      { id: 'file', name: 'Input File', type: 'file_handle', required: true },
    ],
    outputs: [
      { id: 'file', name: 'Output File', type: 'file_handle', required: true },
    ],
  },

  isSupported: async () => true,

  execute: async (inputs, context: ExecutionContext) => {
    const file = inputs.file as File | Blob | undefined;
    const fileData = inputs.fileData as Uint8Array | undefined;
    const originalName = inputs.originalName as string;
    const targetFormat = inputs.targetFormat as string;
    const options = (inputs.modifiers as any) || (inputs.options as any) || undefined;

    if ((!file && !fileData) || !originalName || !targetFormat) {
      throw new Error('ImageMagick requer arquivo (File/Blob) ou fileData (Uint8Array), originalName e targetFormat.');
    }

    await ensureMagickInitialized(context);

    const inputBytes = fileData || new Uint8Array(await (file as File | Blob).arrayBuffer());
    const outputExt = targetFormat.startsWith('.') ? targetFormat.toLowerCase() : '.' + targetFormat.toLowerCase();
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + outputExt;
    const targetMagickFormat = EXT_TO_MAGICK_FORMAT[outputExt];

    if (!targetMagickFormat) {
      throw new Error(`Formato de destino '${outputExt}' não suportado pelo ImageMagick.`);
    }

    context.onLog(`[ImageMagick] Convertendo ${originalName} -> ${outputFileName} (${targetMagickFormat})...`);
    context.onProgress(25, 'Decodificando imagem...');

    return new Promise((resolve, reject) => {
      try {
        ImageMagick.read(inputBytes, (image) => {
          try {
            // Apply DPI / Density if specified (skip on AVIF/HEIC where libaom/libheif crashes in Magick WASM)
            const supportsDensity = outputExt !== '.avif' && outputExt !== '.heic';
            if (supportsDensity && options?.imageDpi && Number(options.imageDpi) > 0) {
              const dpi = Number(options.imageDpi);
              image.density = new Density(dpi, DensityUnit.PixelsPerInch);
              context.onLog(`[ImageMagick] Densidade configurada para ${dpi} DPI.`);
            }

            // Apply quality if specified (AVIF encoder crashes on quality 100 due to libaom chroma deltaq)
            if (options?.qualityPreset) {
              const q = options.qualityPreset;
              const val = q === 'original' ? 100 : (q === 'balanced' ? 85 : 70);
              image.quality = outputExt === '.avif' ? Math.min(99, val) : val;
            } else if (options?.quality) {
              const val = Math.max(1, Math.min(100, Number(options.quality) || 85));
              image.quality = outputExt === '.avif' ? Math.min(99, val) : val;
            }

            // Apply resolution scaling if specified
            if (options?.targetWidth && options.targetWidth > 0) {
              const targetH = options.targetHeight && options.targetHeight > 0 ? options.targetHeight : 0;
              image.resize(options.targetWidth, targetH);
            }

            // Apply image transforms (rotate, flip, grayscale, strip EXIF)
            if (options?.imageRotateDeg && Number(options.imageRotateDeg) !== 0) {
              image.rotate(Number(options.imageRotateDeg));
            }
            if (options?.imageFlipH) {
              image.flop();
            }
            if (options?.imageFlipV) {
              image.flip();
            }
            if (options?.imageGrayscale) {
              image.grayscale();
            }
            if (options?.imageStripMetadata) {
              image.strip();
            }
            if (options?.backgroundColor) {
              image.backgroundColor = new MagickColor(options.backgroundColor);
              if (outputExt === '.jpg' || outputExt === '.jpeg' || outputExt === '.bmp') {
                image.alpha(AlphaAction.Remove);
              }
            }

            context.onProgress(60, 'Codificando novo formato...');

            image.write(targetMagickFormat, (outputBytes) => {
              const result = new Uint8Array(outputBytes);
              const mimeType = getMimeType(outputExt);
              const outputBlob = new Blob([result.buffer], { type: mimeType });

              context.onProgress(100, 'Conversão de imagem concluída com sucesso!');
              context.onLog(`[ImageMagick] Sucesso: gerado ${outputFileName} (${(result.byteLength / 1024).toFixed(1)} KB)`);

              resolve({
                outputData: result,
                outputBlob,
                outputFileName,
                outputSize: result.byteLength,
                mimeType,
              });
            });
          } catch (processErr) {
            reject(processErr);
          }
        });
      } catch (readErr) {
        reject(readErr);
      }
    });
  },
};
