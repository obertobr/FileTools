import type { IModule, ExecutionContext } from '@/shared/types/module';
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

export const WaWoff2Module: IModule = {
  manifest: {
    id: 'wawoff2',
    name: 'wawoff2 (Google WOFF2 ↔ TTF)',
    version: '2.0.1',
    description: 'Compressor e descompressor nativo WOFF2 Brotli ↔ TTF em WebAssembly.',
    category: 'font',
    supportedModifiers: [],
    supportedConversions: [
      {
        from: ['.woff2'],
        to: ['.ttf'],
        lossy: false,
        speedScore: 96,
        acceleration: 'cpu-singlethread',
        performanceNotes: 'Descompressão Brotli WOFF2 direta para TrueType',
      },
      {
        from: ['.ttf'],
        to: ['.woff2'],
        lossy: false,
        speedScore: 96,
        acceleration: 'cpu-singlethread',
        performanceNotes: 'Compressão Brotli WOFF2 otimizada para web',
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

    if ((!file && !fileData) || !originalName || !targetFormat) {
      throw new Error('wawoff2 module requires file/fileData, originalName, and targetFormat.');
    }

    const inputExt = ('.' + (originalName.split('.').pop() || 'ttf')).toLowerCase();
    const targetExt = targetFormat.startsWith('.') ? targetFormat.toLowerCase() : '.' + targetFormat.toLowerCase();
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + targetExt;
    const mimeType = getMimeType(targetExt);

    context.onLog(`[wawoff2] Processando ${originalName} -> ${outputFileName}`);
    context.onProgress(25, 'Carregando codec WOFF2 Brotli...');

    const bytes = fileData || new Uint8Array(await (file as File | Blob).arrayBuffer());
    let outputData: Uint8Array;

    try {
      const w2Mod = await import('wawoff2');
      const w2 = (w2Mod as any).default || w2Mod;
      if (inputExt === '.ttf' && targetExt === '.woff2') {
        outputData = new Uint8Array(await w2.compress(bytes));
      } else if (inputExt === '.woff2' && targetExt === '.ttf') {
        outputData = new Uint8Array(await w2.decompress(bytes));
      } else {
        throw new Error(`Par ${inputExt} -> ${targetExt} não suportado pelo wawoff2.`);
      }
    } catch {
      const { woff2 } = await import('fonteditor-core');
      const isNodeOrJsdom =
        typeof process !== 'undefined' &&
        Boolean(process.versions?.node) &&
        (typeof navigator === 'undefined' || /jsdom/i.test(navigator.userAgent));
      if (!woff2.isInited()) {
        const wasmUrl = isNodeOrJsdom ? undefined : `${getOriginBase()}/wasm/fonteditor/woff2.wasm`;
        await woff2.init(wasmUrl as any);
      }
      const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      outputData =
        targetExt === '.woff2'
          ? new Uint8Array(woff2.encode(ab))
          : new Uint8Array(woff2.decode(ab));
    }

    const outputBlob = new Blob([outputData.buffer as unknown as BlobPart], { type: mimeType });
    context.onProgress(100, 'Conversão WOFF2 concluída!');
    context.onLog(`[wawoff2] Sucesso: ${outputFileName} (${outputData.byteLength} bytes)`);

    return {
      outputData,
      outputBlob,
      outputFileName,
      outputSize: outputData.byteLength,
      mimeType,
    };
  },
};
