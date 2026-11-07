import * as mammoth from 'mammoth';
import type { IModule } from '@/shared/types/module';
import { getMimeType } from '@/core/knowledge/mimeTypes';

export const MammothModule: IModule = {
  manifest: {
    id: 'mammoth',
    name: 'Mammoth DOCX',
    version: '1.12.2',
    description: 'Extrator e conversor local de arquivos DOCX para HTML, TXT e Markdown (MD).',
    category: 'document',
    supportedModifiers: [],
    supportedConversions: [
      { from: ['.docx'], to: ['.html', '.txt', '.md'], lossy: true, speedScore: 92 },
    ],
    inputs: [
      { id: 'file', name: 'Input File', type: 'file_handle', required: true }
    ],
    outputs: [
      { id: 'file', name: 'Output File', type: 'file_handle', required: true }
    ]
  },
  execute: async (inputs, context) => {
    const file = inputs.file as File | Blob | undefined;
    const fileData = inputs.fileData as Uint8Array | undefined;
    const originalName = inputs.originalName as string;
    const targetFormat = inputs.targetFormat as string;

    if ((!file && !fileData) || !originalName || !targetFormat) {
      throw new Error('Mammoth module requires file (File/Blob) or fileData (Uint8Array), originalName, and targetFormat.');
    }

    context.onLog(`[Mammoth] Lendo arquivo DOCX: ${originalName}`);
    context.onProgress(20, 'Carregando documento DOCX...');

    const targetExt = '.' + targetFormat.replace(/^\.+/, '').toLowerCase();
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + targetExt;

    // mammoth supports arrayBuffer: ArrayBuffer
    let arrayBuffer: ArrayBuffer;
    if (file) {
      arrayBuffer = await file.arrayBuffer();
    } else {
      arrayBuffer = fileData!.buffer.slice(
        fileData!.byteOffset,
        fileData!.byteOffset + fileData!.byteLength
      ) as ArrayBuffer;
    }

    context.onProgress(60, `Convertendo documento para ${targetExt.toUpperCase()}...`);

    let outputText = '';
    const mimeType = getMimeType(targetExt);

    if (targetExt === '.html') {
      const result = await mammoth.convertToHtml({ arrayBuffer });
      const title = originalName.replace(/\.[^.]+$/, '');
      outputText = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 2rem auto; padding: 0 1rem; color: #222; }
    img { max-width: 100%; height: auto; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #ddd; padding: 8px; }
  </style>
</head>
<body>
${result.value}
</body>
</html>`;
    } else if (targetExt === '.md') {
      const mammothWithMarkdown = mammoth as unknown as {
        convertToMarkdown: (options: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string; messages: unknown[] }>;
      };
      const result = await mammothWithMarkdown.convertToMarkdown({ arrayBuffer });
      outputText = result.value;
    } else {
      const result = await mammoth.extractRawText({ arrayBuffer });
      outputText = result.value;
    }

    const outputData = new TextEncoder().encode(outputText);
    const outputBlob = new Blob([outputData.buffer as unknown as BlobPart], { type: mimeType });

    context.onProgress(100, 'Conversão concluída com sucesso!');
    context.onLog(`[Mammoth] Concluído: ${outputFileName} (${outputData.byteLength} bytes)`);

    return {
      outputData,
      outputBlob,
      outputFileName,
      outputSize: outputData.byteLength,
      mimeType,
    };
  }
};
