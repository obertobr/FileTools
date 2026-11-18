import type { IModule, ExecutionContext } from '@/shared/types/module';
import type { ConversionModifiers } from '@/shared/types/conversionModifiers';
import { getMimeType } from '@/core/knowledge/mimeTypes';
import {
  extractEntriesSimple,
  packEntriesSimple,
  type ArchiveEntry,
} from './fflate';

let archiveInitialized = false;

function getOriginBase(): string {
  if (typeof window !== 'undefined' && window.location?.origin && !window.location.origin.startsWith('file:')) {
    return window.location.origin;
  }
  return 'http://localhost:4321';
}

export const LibArchiveModule: IModule = {
  manifest: {
    id: 'libarchive',
    name: 'libarchive.js (RAR / TAR / ISO / DEB / RPM)',
    version: '2.0.2',
    description: 'Leitura e conversão universal de arquivos compactados Unix/Linux, RAR, ISO, CAB, CPIO e DEB.',
    category: 'archive',
    supportedModifiers: ['archive_compression', 'archive_password'],
    supportedConversions: [
      {
        from: [
          '.tar',
          '.tar.gz',
          '.tgz',
          '.tar.bz2',
          '.tbz2',
          '.tar.xz',
          '.txz',
          '.gz',
          '.bz2',
          '.xz',
          '.lzma',
          '.z',
          '.lzh',
          '.cab',
          '.cpio',
          '.ar',
          '.iso',
          '.rpm',
          '.deb',
          '.rar',
          '.7z',
          '.zip',
        ],
        to: ['.zip', '.tar', '.tgz', '.gz'],
        lossy: false,
        speedScore: 86,
        acceleration: 'cpu-singlethread',
        performanceNotes: 'Extração multi-formato via libarchive WebAssembly',
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
      archiveCompressionLevel?: number;
      archivePassword?: string;
    };

    if ((!file && !fileData) || !originalName || !targetFormat) {
      throw new Error('libarchive requires file/fileData, originalName, and targetFormat.');
    }

    const inputExt = ('.' + (originalName.split('.').pop() || 'tar')).toLowerCase();
    const targetExt = targetFormat.startsWith('.') ? targetFormat.toLowerCase() : '.' + targetFormat.toLowerCase();
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + targetExt;
    const mimeType = getMimeType(targetExt);

    context.onLog(`[libarchive] Abrindo arquivo ${originalName}...`);
    context.onProgress(20, 'Extraindo entradas do arquivo compactado...');

    let entries: ArchiveEntry[] = [];
    const bytes = fileData || new Uint8Array(await (file as File | Blob).arrayBuffer());

    const canUseWorker = typeof Worker !== 'undefined' && typeof window !== 'undefined';
    if (canUseWorker) {
      try {
        const { Archive } = await import('libarchive.js');
        if (!archiveInitialized) {
          Archive.init({ workerUrl: `${getOriginBase()}/wasm/libarchive/worker-bundle.js` });
          archiveInitialized = true;
        }
        const blobFile =
          file instanceof File
            ? file
            : new File([bytes as unknown as BlobPart], originalName, { type: 'application/octet-stream' });
        const archive = await Archive.open(blobFile);
        if (modifiers.archivePassword) {
          await archive.usePassword(modifiers.archivePassword);
        }
        const extracted = await archive.extractFiles();
        const flatten = async (obj: Record<string, any>, prefix = ''): Promise<void> => {
          for (const [k, v] of Object.entries(obj)) {
            const p = prefix ? `${prefix}/${k}` : k;
            if (v instanceof File || v instanceof Blob) {
              entries.push({ name: p, data: new Uint8Array(await v.arrayBuffer()) });
            } else if (v && typeof v === 'object') {
              await flatten(v, p);
            }
          }
        };
        await flatten(extracted);
        await archive.close();
      } catch (err) {
        context.onLog(`[libarchive] Fallback parser direto (${err instanceof Error ? err.message : String(err)})`);
        entries = extractEntriesSimple(bytes, inputExt, originalName);
      }
    } else {
      entries = extractEntriesSimple(bytes, inputExt, originalName);
    }

    if (entries.length === 0) {
      throw new Error(`[libarchive] Nenhuma entrada extraída de ${originalName}.`);
    }

    const level = Math.max(0, Math.min(9, Math.round(modifiers.archiveCompressionLevel ?? 6))) as
      | 0
      | 1
      | 2
      | 3
      | 4
      | 5
      | 6
      | 7
      | 8
      | 9;

    context.onProgress(70, `Empacotando ${entries.length} arquivo(s) em ${targetExt.toUpperCase()}...`);
    const outputData = packEntriesSimple(entries, targetExt, level);
    const outputBlob = new Blob([outputData.buffer as unknown as BlobPart], { type: mimeType });

    context.onProgress(100, 'Conversão de arquivo concluída!');
    context.onLog(`[libarchive] Sucesso: ${outputFileName} (${outputData.byteLength} bytes)`);

    return {
      outputData,
      outputBlob,
      outputFileName,
      outputSize: outputData.byteLength,
      mimeType,
    };
  },
};
