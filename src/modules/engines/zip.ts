import type { IModule, ExecutionContext } from '@/shared/types/module';
import type { ConversionModifiers } from '@/shared/types/conversionModifiers';
import { getMimeType } from '@/core/knowledge/mimeTypes';

export const ZipJSModule: IModule = {
  manifest: {
    id: 'zipjs',
    name: 'zip.js (ZIP64 & AES Encryption)',
    version: '2.25.0',
    description: 'Motor ZIP streaming com suporte a ZIP64, criptografia AES-256 com senha e Deflate64.',
    category: 'archive',
    supportedModifiers: ['archive_compression', 'archive_password'],
    supportedConversions: [
      {
        from: ['.zip', '.cbz', '.epub'],
        to: ['.zip'],
        lossy: false,
        speedScore: 93,
        acceleration: 'cpu-singlethread',
        performanceNotes: 'ZIP64 com suporte a criptografia/descriptografia AES-256',
      },
      {
        from: ['image/*', 'document/*', 'audio/*', 'video/*', 'ebook/*', 'font/*', 'model3d/*', '.json'],
        to: ['.zip'],
        lossy: false,
        speedScore: 91,
        acceleration: 'cpu-singlethread',
        performanceNotes: 'Empacotamento ZIP64 protegido por senha opcional',
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
    const modifiers = (inputs.modifiers || inputs.options || {}) as ConversionModifiers & {
      archiveCompressionLevel?: number;
      archivePassword?: string;
    };

    if ((!file && !fileData) || !originalName) {
      throw new Error('zip.js requires file/fileData and originalName.');
    }

    const inputExt = ('.' + (originalName.split('.').pop() || 'bin')).toLowerCase();
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + '.zip';
    const mimeType = getMimeType('.zip');

    const {
      configure,
      Uint8ArrayReader,
      Uint8ArrayWriter,
      ZipReader,
      ZipWriter,
    } = await import('@zip.js/zip.js');

    configure({ useWebWorkers: false });

    const level = Math.max(0, Math.min(9, Math.round(modifiers.archiveCompressionLevel ?? 6)));
    const password = modifiers.archivePassword?.trim() || undefined;

    context.onLog(`[zip.js] Processando ${originalName} (ZIP64${password ? ', AES' : ''})...`);
    context.onProgress(20, 'Preparando fluxo ZIP64...');

    const bytes = fileData || new Uint8Array(await (file as File | Blob).arrayBuffer());
    const writer = new Uint8ArrayWriter();
    const zipWriter = new ZipWriter(writer, {
      level,
      zip64: true,
      password,
    });

    if (['.zip', '.cbz', '.epub'].includes(inputExt)) {
      const zipReader = new ZipReader(new Uint8ArrayReader(bytes));
      const entries = await zipReader.getEntries();
      context.onProgress(40, `Reempacotando ${entries.length} entradas...`);

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (!entry.directory && entry.getData) {
          const data = await entry.getData(
            new Uint8ArrayWriter(),
            entry.encrypted && password ? { password } : undefined
          );
          await zipWriter.add(entry.filename, new Uint8ArrayReader(data), { level, password });
        }
        context.onProgress(40 + Math.round(((i + 1) / Math.max(1, entries.length)) * 50), `Processando ${entry.filename}...`);
      }
      await zipReader.close();
    } else {
      await zipWriter.add(originalName, new Uint8ArrayReader(bytes), { level, password });
    }

    const outputData = new Uint8Array(await zipWriter.close());
    const outputBlob = new Blob([outputData.buffer as unknown as BlobPart], { type: mimeType });

    context.onProgress(100, 'Arquivo ZIP gerado com sucesso!');
    context.onLog(`[zip.js] Sucesso: ${outputFileName} (${outputData.byteLength} bytes)`);

    return {
      outputData,
      outputBlob,
      outputFileName,
      outputSize: outputData.byteLength,
      mimeType,
    };
  },
};
