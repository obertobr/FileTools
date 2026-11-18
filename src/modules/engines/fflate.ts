import {
  zipSync,
  unzipSync,
  gzipSync,
  gunzipSync,
  zlibSync,
  unzlibSync,
} from 'fflate';
import type { IModule, ExecutionContext } from '@/shared/types/module';
import type { ConversionModifiers } from '@/shared/types/conversionModifiers';
import { getMimeType } from '@/core/knowledge/mimeTypes';

export interface ArchiveEntry {
  name: string;
  data: Uint8Array;
}

export function parseTarEntries(tarBytes: Uint8Array): ArchiveEntry[] {
  const entries: ArchiveEntry[] = [];
  const decoder = new TextDecoder('utf-8');
  let offset = 0;

  while (offset + 512 <= tarBytes.byteLength) {
    const header = tarBytes.subarray(offset, offset + 512);
    let isZero = true;
    for (let i = 0; i < 512; i++) {
      if (header[i] !== 0) {
        isZero = false;
        break;
      }
    }
    if (isZero) break;

    const name = decoder.decode(header.subarray(0, 100)).replace(/\0.*$/, '');
    const prefix = decoder.decode(header.subarray(345, 500)).replace(/\0.*$/, '');
    const fullName = prefix ? `${prefix}/${name}` : name;
    const sizeOctal = decoder.decode(header.subarray(124, 136)).replace(/\0.*$/, '').trim();
    const size = parseInt(sizeOctal, 8) || 0;
    const typeFlag = String.fromCharCode(header[156] || 48);

    const dataStart = offset + 512;
    const dataEnd = Math.min(tarBytes.byteLength, dataStart + size);

    if ((typeFlag === '0' || typeFlag === '\0') && fullName && size >= 0) {
      entries.push({
        name: fullName,
        data: tarBytes.slice(dataStart, dataEnd),
      });
    }

    const paddedBlocks = Math.ceil(size / 512) * 512;
    offset = dataStart + paddedBlocks;
  }

  return entries;
}

export function buildTarArchive(entries: ArchiveEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];

  for (const entry of entries) {
    const cleanName = entry.name.replace(/^\/+/, '').slice(0, 99) || 'file.bin';
    const header = new Uint8Array(512);
    header.set(encoder.encode(cleanName), 0);
    header.set(encoder.encode('0000644\0'), 100);
    header.set(encoder.encode('0000000\0'), 108);
    header.set(encoder.encode('0000000\0'), 116);
    header.set(encoder.encode(entry.data.byteLength.toString(8).padStart(11, '0') + '\0'), 124);
    header.set(encoder.encode(Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + '\0'), 136);
    header.fill(0x20, 148, 156);
    header[156] = 48; // '0' regular file
    header.set(encoder.encode('ustar'), 257);
    header.set(encoder.encode('00'), 263);

    let sum = 0;
    for (let i = 0; i < 512; i++) sum += header[i];
    header.set(encoder.encode(sum.toString(8).padStart(6, '0') + '\0 '), 148);

    chunks.push(header);
    const padSize = Math.ceil(entry.data.byteLength / 512) * 512;
    const body = new Uint8Array(padSize);
    body.set(entry.data, 0);
    chunks.push(body);
  }

  chunks.push(new Uint8Array(1024));

  const total = chunks.reduce((acc, c) => acc + c.byteLength, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const chunk of chunks) {
    out.set(chunk, pos);
    pos += chunk.byteLength;
  }
  return out;
}

export function extractEntriesSimple(bytes: Uint8Array, sourceExt: string, originalName: string): ArchiveEntry[] {
  const ext = sourceExt.toLowerCase();
  if (ext === '.zip' || ext === '.cbz' || ext === '.epub') {
    const unzipped = unzipSync(bytes);
    return Object.entries(unzipped)
      .filter(([name, data]) => !name.endsWith('/') && data.byteLength >= 0)
      .map(([name, data]) => ({ name, data }));
  }
  if (ext === '.tgz' || originalName.toLowerCase().endsWith('.tar.gz')) {
    const tarBytes = gunzipSync(bytes);
    return parseTarEntries(tarBytes);
  }
  if (ext === '.gz') {
    const raw = gunzipSync(bytes);
    const innerName = originalName.replace(/\.gz$/i, '') || 'extracted.bin';
    if (innerName.toLowerCase().endsWith('.tar')) {
      return parseTarEntries(raw);
    }
    return [{ name: innerName, data: raw }];
  }
  if (ext === '.tar') {
    return parseTarEntries(bytes);
  }
  if (ext === '.deflate') {
    const raw = unzlibSync(bytes);
    return [{ name: originalName.replace(/\.deflate$/i, '') || 'extracted.bin', data: raw }];
  }
  return [{ name: originalName, data: bytes }];
}

export function packEntriesSimple(
  entries: ArchiveEntry[],
  targetExt: string,
  level: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 = 6
): Uint8Array {
  const ext = targetExt.toLowerCase();
  if (ext === '.zip') {
    const map: Record<string, Uint8Array> = {};
    for (const e of entries) map[e.name] = e.data;
    return zipSync(map, { level });
  }
  if (ext === '.tar') {
    return buildTarArchive(entries);
  }
  if (ext === '.tgz') {
    return gzipSync(buildTarArchive(entries), { level });
  }
  if (ext === '.gz') {
    const payload = entries.length === 1 ? entries[0].data : buildTarArchive(entries);
    return gzipSync(payload, { level });
  }
  if (ext === '.deflate') {
    const payload = entries.length === 1 ? entries[0].data : buildTarArchive(entries);
    return zlibSync(payload, { level });
  }
  throw new Error(`[fflate] Formato de saída não suportado: ${targetExt}`);
}

export const FflateModule: IModule = {
  manifest: {
    id: 'fflate',
    name: 'fflate (Streaming ZIP / GZIP / DEFLATE)',
    version: '0.8.3',
    description: 'Compactação e conversão ultrarrápida em memória para ZIP, GZIP, TGZ, TAR e DEFLATE.',
    category: 'archive',
    supportedModifiers: ['archive_compression'],
    supportedConversions: [
      {
        from: ['.zip', '.gz', '.tgz', '.tar', '.deflate'],
        to: ['.zip', '.gz', '.tgz', '.tar', '.deflate'],
        lossy: false,
        speedScore: 98,
        acceleration: 'cpu-singlethread',
        performanceNotes: 'Compressão e conversão direta de arquivos via fflate',
      },
      {
        from: ['image/*', 'document/*', 'audio/*', 'video/*', 'ebook/*', 'font/*', 'model3d/*', '.json'],
        to: ['.zip', '.gz', '.tgz', '.tar', '.deflate'],
        lossy: false,
        speedScore: 96,
        acceleration: 'cpu-singlethread',
        performanceNotes: 'Empacotamento instantâneo em ZIP/GZIP/TAR',
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
    };

    if ((!file && !fileData) || !originalName || !targetFormat) {
      throw new Error('fflate requires file/fileData, originalName, and targetFormat.');
    }

    const inputExt = ('.' + (originalName.split('.').pop() || 'bin')).toLowerCase();
    const targetExt = targetFormat.startsWith('.') ? targetFormat.toLowerCase() : '.' + targetFormat.toLowerCase();
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + targetExt;
    const mimeType = getMimeType(targetExt);

    context.onLog(`[fflate] Processando ${originalName} -> ${outputFileName}`);
    context.onProgress(20, 'Lendo conteúdo de entrada...');

    const bytes = fileData || new Uint8Array(await (file as File | Blob).arrayBuffer());
    const entries = extractEntriesSimple(bytes, inputExt, originalName);

    const rawLevel = modifiers.archiveCompressionLevel ?? 6;
    const level = Math.max(0, Math.min(9, Math.round(rawLevel))) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

    context.onProgress(60, `Compactando ${entries.length} entrada(s) (nível ${level})...`);
    const outputData = packEntriesSimple(entries, targetExt, level);
    const outputBlob = new Blob([outputData.buffer as unknown as BlobPart], { type: mimeType });

    context.onProgress(100, 'Arquivo compactado com sucesso!');
    context.onLog(`[fflate] Sucesso: ${outputFileName} (${outputData.byteLength} bytes)`);

    return {
      outputData,
      outputBlob,
      outputFileName,
      outputSize: outputData.byteLength,
      mimeType,
    };
  },
};
