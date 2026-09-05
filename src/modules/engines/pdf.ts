import { PDFDocument } from 'pdf-lib';
import type { IModule } from '@/shared/types/module';

export const PdfModule: IModule = {
  manifest: {
    id: 'pdf-lib',
    name: 'PDF Tools',
    version: '1.17.1',
    description: 'Ferramentas de conversão de imagens para PDF com pdf-lib.',
    category: 'document',
    supportedModifiers: ['page_range'],
    supportedConversions: [
      { from: ['.jpg', '.jpeg', '.png'], to: ['.pdf'], lossy: false, speedScore: 90 },
      { from: ['.pdf'], to: ['.pdf'], lossy: false, speedScore: 95 },
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
    const modifiers = (inputs.modifiers || inputs.options || {}) as any;

    if ((!file && !fileData) || !originalName) {
      throw new Error('PDF module requires file (File/Blob) or fileData (Uint8Array) and originalName.');
    }

    context.onLog(`[pdf-lib] Processando documento PDF a partir de ${originalName}`);
    context.onProgress(20, 'Carregando arquivo...');

    const data = fileData || new Uint8Array(await (file as File | Blob).arrayBuffer());
    const ext = originalName.slice(originalName.lastIndexOf('.')).toLowerCase();

    let pdfDoc: PDFDocument;

    if (ext === '.pdf') {
      context.onProgress(40, 'Carregando estrutura do PDF existente...');
      pdfDoc = await PDFDocument.load(data, { ignoreEncryption: true });

      // Apply page_range modifier if specified
      const pageRange = modifiers.pageRange;
      if (pageRange && pageRange !== 'all') {
        const total = pdfDoc.getPageCount();
        const indices: number[] = [];
        const clean = String(pageRange).trim();

        if (/^\d+$/.test(clean)) {
          const idx = parseInt(clean, 10) - 1;
          if (idx >= 0 && idx < total) indices.push(idx);
        } else if (clean.includes('-')) {
          const [s, e] = clean.split('-');
          const start = Math.max(0, (parseInt(s, 10) || 1) - 1);
          const end = Math.min(total - 1, (parseInt(e, 10) || total) - 1);
          for (let i = start; i <= end; i++) indices.push(i);
        } else if (clean.includes(',')) {
          const parts = clean.split(',').map((v: string) => (parseInt(v.trim(), 10) || 1) - 1);
          for (const p of parts) {
            if (p >= 0 && p < total && !indices.includes(p)) indices.push(p);
          }
        }

        if (indices.length > 0 && indices.length < total) {
          context.onLog(`[pdf-lib] Extraindo ${indices.length} de ${total} páginas (${clean})...`);
          const newDoc = await PDFDocument.create();
          const copiedPages = await newDoc.copyPages(pdfDoc, indices);
          copiedPages.forEach((cp) => newDoc.addPage(cp));
          pdfDoc = newDoc;
        }
      }
    } else {
      context.onProgress(40, 'Inicializando novo documento PDF...');
      pdfDoc = await PDFDocument.create();
      context.onProgress(60, 'Embutindo imagem no PDF...');
      let image;
      if (ext === '.png') {
        image = await pdfDoc.embedPng(data);
      } else {
        image = await pdfDoc.embedJpg(data);
      }

      const page = pdfDoc.addPage([image.width, image.height]);
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: image.width,
        height: image.height,
      });
    }

    context.onProgress(80, 'Salvando bytes do PDF...');
    const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
    const outputData = new Uint8Array(pdfBytes);
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + '.pdf';
    const outputBlob = new Blob([outputData.buffer as unknown as BlobPart], { type: 'application/pdf' });

    context.onProgress(100, 'Conversão para PDF concluída!');
    context.onLog(`[pdf-lib] Concluído: ${outputFileName} (${outputData.byteLength} bytes)`);

    return {
      outputData,
      outputBlob,
      outputFileName,
      outputSize: outputData.byteLength,
      mimeType: 'application/pdf',
    };
  }
};
