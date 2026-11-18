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

async function createSevenZipInstance() {
  const mod = await import('7z-wasm');
  const factory = (mod as any).default || mod;
  const origin = getOriginBase();

  const isNodeOrJsdom =
    typeof process !== 'undefined' &&
    Boolean(process.versions?.node) &&
    (typeof navigator === 'undefined' || /jsdom/i.test(navigator.userAgent));

  if (isNodeOrJsdom) {
    const fs = await import('fs');
    const path = await import('path');
    const wasmBinary = fs.readFileSync(path.resolve(process.cwd(), 'public/wasm/7z/7zz.wasm'));
    return await factory({
      wasmBinary: wasmBinary.buffer.slice(wasmBinary.byteOffset, wasmBinary.byteOffset + wasmBinary.byteLength),
      noExitRuntime: true,
    });
  }

  return await factory({
    locateFile: (file: string) => (file.endsWith('.wasm') ? `${origin}/wasm/7z/7zz.wasm` : file),
    noExitRuntime: true,
  });
}

const ARCHIVE_ONLY_INPUTS = new Set([
  '.7z',
  '.zip',
  '.rar',
  '.tar',
  '.gz',
  '.bz2',
  '.xz',
  '.wim',
  '.iso',
  '.dmg',
  '.cab',
  '.msi',
  '.cpio',
  '.arj',
  '.lzh',
  '.z',
  '.vhd',
  '.vhdx',
  '.vdi',
  '.vmdk',
  '.qcow2',
]);

const SEVEN_ZIP_TYPE_MAP: Record<string, string> = {
  '.7z': '7z',
  '.zip': 'zip',
  '.tar': 'tar',
  '.gz': 'gzip',
  '.bz2': 'bzip2',
  '.xz': 'xz',
  '.wim': 'wim',
};

function rmTreeRecursive(FS: any, dirPath: string): void {
  try {
    const items: string[] = FS.readdir(dirPath);
    for (const item of items) {
      if (item === '.' || item === '..') continue;
      const full = `${dirPath}/${item}`;
      const stat = FS.stat(full);
      if (FS.isDir(stat.mode)) {
        rmTreeRecursive(FS, full);
        FS.rmdir(full);
      } else {
        FS.unlink(full);
      }
    }
  } catch {
    // ignore cleanup errors
  }
}

export const SevenZipModule: IModule = {
  manifest: {
    id: '7z-wasm',
    name: '7-Zip WASM (7zz)',
    version: '1.2.0',
    description: 'Motor oficial 7-Zip WebAssembly para 7Z, ZIP, RAR, TAR, WIM, ISO, DMG, CAB e imagens de disco.',
    category: 'archive',
    supportedModifiers: ['archive_compression', 'archive_password'],
    supportedConversions: [
      {
        from: [
          '.7z',
          '.zip',
          '.rar',
          '.tar',
          '.gz',
          '.bz2',
          '.xz',
          '.wim',
          '.iso',
          '.dmg',
          '.cab',
          '.msi',
          '.cpio',
          '.arj',
          '.lzh',
          '.z',
          '.vhd',
          '.vhdx',
          '.vdi',
          '.vmdk',
          '.qcow2',
        ],
        to: ['.7z', '.zip', '.tar', '.gz', '.bz2', '.xz', '.wim'],
        lossy: false,
        speedScore: 89,
        acceleration: 'cpu-singlethread',
        performanceNotes: 'Núcleo C++ 7zz compilado para WebAssembly com suporte a AES-256',
      },
      {
        from: ['image/*', 'document/*', 'audio/*', 'video/*', 'ebook/*', 'font/*', 'model3d/*', '.json'],
        to: ['.7z', '.bz2', '.xz', '.wim'],
        lossy: false,
        speedScore: 87,
        acceleration: 'cpu-singlethread',
        performanceNotes: 'Compressão LZMA2 / BZIP2 / WIM de alta taxa via 7-Zip',
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
      throw new Error('7z-wasm requires file/fileData, originalName, and targetFormat.');
    }

    const inputExt = ('.' + (originalName.split('.').pop() || '7z')).toLowerCase();
    const targetExt = targetFormat.startsWith('.') ? targetFormat.toLowerCase() : '.' + targetFormat.toLowerCase();
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + targetExt;
    const mimeType = getMimeType(targetExt);

    const typeFlag = SEVEN_ZIP_TYPE_MAP[targetExt];
    if (!typeFlag) {
      throw new Error(`[7z-wasm] Formato de saída não suportado: ${targetExt}`);
    }

    context.onLog(`[7z-wasm] Inicializando 7-Zip WASM para ${originalName} -> ${outputFileName}`);
    context.onProgress(15, 'Carregando 7-Zip WASM...');

    const bytes = fileData || new Uint8Array(await (file as File | Blob).arrayBuffer());
    const sevenZip = await createSevenZipInstance();
    const FS = sevenZip.FS;
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const workRoot = `/${jobId}`;
    const extractDir = `${workRoot}/extracted`;
    const inFilePath = `${workRoot}/${originalName.replace(/[/\\]/g, '_')}`;
    const outFilePath = `${workRoot}/output${targetExt}`;

    try {
      FS.mkdir(workRoot);
      FS.mkdir(extractDir);
      FS.writeFile(inFilePath, bytes);

      const password = modifiers.archivePassword?.trim();
      const level = Math.max(0, Math.min(9, Math.round(modifiers.archiveCompressionLevel ?? 5)));

      if (ARCHIVE_ONLY_INPUTS.has(inputExt)) {
        context.onProgress(40, 'Extraindo arquivo compactado...');
        const extractArgs = ['x', inFilePath, `-o${extractDir}`, '-y'];
        if (password) extractArgs.push(`-p${password}`);
        sevenZip.callMain(extractArgs);

        const extractedEntries = FS.readdir(extractDir).filter((n: string) => n !== '.' && n !== '..');
        if (extractedEntries.length === 0) {
          throw new Error(`[7z-wasm] Nenhum conteúdo extraído de ${originalName}.`);
        }

        context.onProgress(70, `Compactando para ${targetExt.toUpperCase()}...`);
        const packArgs = ['a', `-t${typeFlag}`, `-mx=${level}`, outFilePath, `${extractDir}/*`, '-y'];
        if (password && (targetExt === '.7z' || targetExt === '.zip')) {
          packArgs.push(`-p${password}`);
          if (targetExt === '.7z') packArgs.push('-mhe=on');
        }
        sevenZip.callMain(packArgs);
      } else {
        context.onProgress(60, `Compactando ${originalName} em ${targetExt.toUpperCase()}...`);
        const packArgs = ['a', `-t${typeFlag}`, `-mx=${level}`, outFilePath, inFilePath, '-y'];
        if (password && (targetExt === '.7z' || targetExt === '.zip')) {
          packArgs.push(`-p${password}`);
          if (targetExt === '.7z') packArgs.push('-mhe=on');
        }
        sevenZip.callMain(packArgs);
      }

      const outputData = new Uint8Array(FS.readFile(outFilePath));
      if (outputData.byteLength === 0) {
        throw new Error('[7z-wasm] Arquivo de saída gerado está vazio.');
      }

      const outputBlob = new Blob([outputData.buffer as unknown as BlobPart], { type: mimeType });
      context.onProgress(100, 'Compactação concluída!');
      context.onLog(`[7z-wasm] Sucesso: ${outputFileName} (${outputData.byteLength} bytes)`);

      return {
        outputData,
        outputBlob,
        outputFileName,
        outputSize: outputData.byteLength,
        mimeType,
      };
    } finally {
      rmTreeRecursive(FS, workRoot);
      try {
        FS.rmdir(workRoot);
      } catch {
        // ignore
      }
    }
  },
};
