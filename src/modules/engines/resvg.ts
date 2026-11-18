import type { IModule, ExecutionContext } from '@/shared/types/module';
import type { ConversionModifiers } from '@/shared/types/conversionModifiers';
import { getMimeType } from '@/core/knowledge/mimeTypes';
import { applyRgbaTransformAndBg, decodeImageWithJSquash, encodeRgbaWithJSquash } from './jsquash';

let resvgInitPromise: Promise<void> | null = null;

async function ensureResvgInitialized(context: ExecutionContext): Promise<void> {
  if (resvgInitPromise) return resvgInitPromise;

  resvgInitPromise = (async () => {
    const { initWasm } = await import('@resvg/resvg-wasm');
    context.onLog('[resvg] Inicializando @resvg/resvg-wasm...');

    const isNodeOrJsdom =
      typeof process !== 'undefined' &&
      Boolean(process.versions?.node) &&
      (typeof navigator === 'undefined' || /jsdom/i.test(navigator.userAgent));

    if (isNodeOrJsdom) {
      const fs = await import('fs');
      const path = await import('path');
      const wasmPath = path.resolve(process.cwd(), 'public/wasm/resvg/index_bg.wasm');
      const wasmBuf = fs.readFileSync(wasmPath);
      await initWasm(wasmBuf);
      return;
    }

    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : typeof self !== 'undefined' && (self as any).location?.origin
        ? (self as any).location.origin
        : 'http://localhost:4321';

    const resp = await fetch(`${origin}/wasm/resvg/index_bg.wasm`);
    if (!resp.ok) {
      throw new Error(`[resvg] Falha ao carregar /wasm/resvg/index_bg.wasm (${resp.status})`);
    }
    await initWasm(await resp.arrayBuffer());
  })();

  return resvgInitPromise;
}

export const ResvgModule: IModule = {
  manifest: {
    id: 'resvg',
    name: 'resvg WASM (SVG Rasterizer)',
    version: '2.6.2',
    description: 'Motor Rust/WASM de renderização vetorial SVG de altíssima fidelidade para PNG, WebP e JPEG.',
    category: 'image',
    supportedModifiers: ['resolution', 'image_dpi', 'quality', 'image_transform', 'background_color'],
    supportedConversions: [
      {
        from: ['.svg'],
        to: ['.png', '.webp', '.jpg', '.jpeg'],
        lossy: false,
        speedScore: 94,
        acceleration: 'cpu-singlethread',
        performanceNotes: 'Rasterização vetorial SVG nativa em Rust WASM',
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
      throw new Error('resvg module requires file/fileData, originalName, and targetFormat.');
    }

    const targetExt = targetFormat.startsWith('.') ? targetFormat.toLowerCase() : '.' + targetFormat.toLowerCase();
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + targetExt;
    const mimeType = getMimeType(targetExt);

    await ensureResvgInitialized(context);
    const { Resvg } = await import('@resvg/resvg-wasm');

    context.onProgress(35, 'Renderizando vetor SVG...');
    const bytes = fileData || new Uint8Array(await (file as File | Blob).arrayBuffer());

    const opts: Record<string, unknown> = {};
    if (modifiers.imageDpi && Number(modifiers.imageDpi) > 0) {
      opts.dpi = Number(modifiers.imageDpi);
    }
    if (modifiers.targetWidth && modifiers.targetWidth > 0) {
      opts.fitTo = { mode: 'width', value: modifiers.targetWidth };
    } else if (modifiers.targetHeight && modifiers.targetHeight > 0) {
      opts.fitTo = { mode: 'height', value: modifiers.targetHeight };
    }
    if (modifiers.backgroundColor) {
      opts.background = modifiers.backgroundColor;
    } else if (targetExt === '.jpg' || targetExt === '.jpeg') {
      opts.background = '#ffffff';
    }

    const resvg = new Resvg(bytes, opts);
    const rendered = resvg.render();
    const pngBytes = new Uint8Array(rendered.asPng());
    rendered.free();

    const hasTransform = Boolean(
      modifiers.imageRotateDeg || modifiers.imageFlipH || modifiers.imageFlipV || modifiers.imageGrayscale
    );

    let outputData: Uint8Array;
    if (targetExt === '.png' && !hasTransform) {
      outputData = pngBytes;
    } else {
      context.onProgress(70, `Convertendo para ${targetExt.toUpperCase()}...`);
      let frame = await decodeImageWithJSquash(pngBytes, '.png');
      if (hasTransform) {
        frame = applyRgbaTransformAndBg(frame, modifiers as unknown as Record<string, unknown>, false);
      }
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
    context.onProgress(100, 'Renderização SVG concluída!');
    context.onLog(`[resvg] Sucesso: ${outputFileName} (${outputData.byteLength} bytes)`);

    return {
      outputData,
      outputBlob,
      outputFileName,
      outputSize: outputData.byteLength,
      mimeType,
    };
  },
};
