import type { IModule, ExecutionContext } from '@/shared/types/module';
import type { ConversionModifiers } from '@/shared/types/conversionModifiers';
import { getMimeType } from '@/core/knowledge/mimeTypes';

function getOriginBase(): string {
  if (typeof window !== 'undefined' && window.location?.origin && !window.location.origin.startsWith('file:')) {
    return window.location.origin;
  }
  if (typeof self !== 'undefined' && (self as any).location?.origin && !(self as any).location.origin.startsWith('file:')) {
    return (self as any).location.origin;
  }
  return 'http://localhost:4321';
}

function toCodePoints(subsetText?: string): number[] | undefined {
  if (!subsetText || subsetText.trim().length === 0) return undefined;
  const set = new Set<number>();
  for (const ch of subsetText) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined) set.add(cp);
  }
  return set.size > 0 ? Array.from(set) : undefined;
}

export const FontEditorModule: IModule = {
  manifest: {
    id: 'fonteditor',
    name: 'FontEditor Core (TTF / OTF / WOFF / WOFF2 / EOT)',
    version: '2.6.3',
    description: 'Conversão e subsetting de fontes tipográficas (TTF, OTF, WOFF, WOFF2, EOT, SVG Font).',
    category: 'font',
    supportedModifiers: ['font_subset'],
    supportedConversions: [
      {
        from: ['.ttf', '.otf', '.woff', '.woff2', '.eot', '.svg'],
        to: ['.ttf', '.woff', '.woff2', '.eot', '.svg'],
        lossy: false,
        speedScore: 93,
        acceleration: 'cpu-singlethread',
        performanceNotes: 'Conversão vetorial de glifos e subsetting Unicode client-side',
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
      fontSubsetText?: string;
    };

    if ((!file && !fileData) || !originalName || !targetFormat) {
      throw new Error('fonteditor module requires file/fileData, originalName, and targetFormat.');
    }

    const inputExt = ('.' + (originalName.split('.').pop() || 'ttf')).toLowerCase();
    const targetExt = targetFormat.startsWith('.') ? targetFormat.toLowerCase() : '.' + targetFormat.toLowerCase();
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + targetExt;
    const mimeType = getMimeType(targetExt);

    const inputType = inputExt.slice(1) as 'ttf' | 'otf' | 'woff' | 'woff2' | 'eot' | 'svg';
    const targetType = targetExt.slice(1) as 'ttf' | 'woff' | 'woff2' | 'eot' | 'svg';

    context.onLog(`[fonteditor] Convertendo fonte ${originalName} -> ${outputFileName}...`);
    context.onProgress(20, 'Inicializando FontEditor Core...');

    const bytes = fileData || new Uint8Array(await (file as File | Blob).arrayBuffer());
    const { Font, woff2 } = await import('fonteditor-core');

    const isNodeOrJsdom =
      typeof process !== 'undefined' &&
      Boolean(process.versions?.node) &&
      (typeof navigator === 'undefined' || /jsdom/i.test(navigator.userAgent));

    if ((inputType === 'woff2' || targetType === 'woff2') && !woff2.isInited()) {
      let wasmLocation: string;
      if (isNodeOrJsdom) {
        const fs = await import(/* @vite-ignore */ 'node:fs');
        const path = await import(/* @vite-ignore */ 'node:path');
        const candidates = [
          path.resolve(process.cwd(), 'public/wasm/fonteditor/woff2.wasm'),
          path.resolve(process.cwd(), 'node_modules/fonteditor-core/woff2/woff2.wasm'),
        ];
        const found = candidates.find((p) => fs.existsSync(p));
        if (!found) {
          throw new Error('[fonteditor] woff2.wasm não encontrado em public/wasm/fonteditor/.');
        }
        const wasmBytes = fs.readFileSync(found);
        wasmLocation = `data:application/wasm;base64,${wasmBytes.toString('base64')}`;
      } else {
        wasmLocation = `${getOriginBase()}/wasm/fonteditor/woff2.wasm`;
      }
      await woff2.init(wasmLocation);
    }

    const subset = toCodePoints(modifiers.fontSubsetText);
    const inputPayload =
      inputType === 'svg'
        ? new TextDecoder().decode(bytes)
        : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

    context.onProgress(50, 'Analisando tabelas SFNT e glifos...');
    const font = Font.create(inputPayload as any, {
      type: inputType,
      ...(subset ? { subset } : {}),
    });

    context.onProgress(80, `Gerando fonte ${targetExt.toUpperCase()}...`);
    const written = font.write({ type: targetType, toBuffer: true } as any) as unknown;

    let outputData: Uint8Array;
    if (typeof written === 'string') {
      outputData = new TextEncoder().encode(written);
    } else if (written instanceof Uint8Array) {
      outputData = new Uint8Array(written);
    } else if (written instanceof ArrayBuffer) {
      outputData = new Uint8Array(written);
    } else {
      outputData = new Uint8Array(written as ArrayBuffer);
    }

    const outputBlob = new Blob([outputData.buffer as unknown as BlobPart], { type: mimeType });
    context.onProgress(100, 'Conversão de fonte concluída!');
    context.onLog(`[fonteditor] Sucesso: ${outputFileName} (${outputData.byteLength} bytes)`);

    return {
      outputData,
      outputBlob,
      outputFileName,
      outputSize: outputData.byteLength,
      mimeType,
    };
  },
};
