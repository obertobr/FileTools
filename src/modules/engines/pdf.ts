import { PDFDocument } from 'pdf-lib';
import type { IModule } from '@/shared/types/module';

export const PdfModule: IModule = {
  manifest: {
    id: 'pdf-lib',
    name: 'PDF Tools',
    version: '1.17.1',
    description: 'Ferramentas de conversão de imagens para PDF com pdf-lib.',
    category: 'document',
    supportedModifiers: [],
    supportedConversions: [
      { from: ['.jpg', '.jpeg', '.png'], to: ['.pdf'], lossy: false, speedScore: 90 },
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

    if ((!file && !fileData) || !originalName) {
      throw new Error('PDF module requires file (File/Blob) or fileData (Uint8Array) and originalName.');
    }

    context.onLog(`[pdf-lib] Criando documento PDF a partir de ${originalName}`);
    context.onProgress(20, 'Inicializando documento PDF...');

    const data = fileData || new Uint8Array(await (file as File | Blob).arrayBuffer());
    const pdfDoc = await PDFDocument.create();
    const ext = originalName.slice(originalName.lastIndexOf('.')).toLowerCase();

    context.onProgress(50, 'Embutindo imagem...');
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

    context.onProgress(80, 'Salvando bytes do PDF...');
    const pdfBytes = await pdfDoc.save();
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
