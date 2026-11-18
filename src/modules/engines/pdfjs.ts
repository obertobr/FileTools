import { zipSync } from 'fflate';
import type { IModule, ExecutionContext } from '@/shared/types/module';
import type { ConversionModifiers } from '@/shared/types/conversionModifiers';
import { getMimeType } from '@/core/knowledge/mimeTypes';
import { encodeRgbaWithJSquash } from './jsquash';

function getOriginBase(): string {
  if (typeof window !== 'undefined' && window.location?.origin && !window.location.origin.startsWith('file:')) {
    return window.location.origin;
  }
  return 'http://localhost:4321';
}

function parsePageIndices(pageRange: string | undefined, totalPages: number): number[] {
  if (!pageRange || pageRange.trim().toLowerCase() === 'all') {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const clean = pageRange.trim();
  const pages: number[] = [];
  for (const part of clean.split(',')) {
    const trimmed = part.trim();
    if (trimmed.includes('-')) {
      const [s, e] = trimmed.split('-');
      const start = Math.max(1, parseInt(s, 10) || 1);
      const end = Math.min(totalPages, parseInt(e, 10) || totalPages);
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }
    } else {
      const p = parseInt(trimmed, 10);
      if (p >= 1 && p <= totalPages && !pages.includes(p)) {
        pages.push(p);
      }
    }
  }
  return pages.length > 0 ? pages : [1];
}

export const PdfJSModule: IModule = {
  manifest: {
    id: 'pdfjs',
    name: 'PDF.js (Leitura, Renderização e Extração)',
    version: '6.5.438',
    description: 'Motor Mozilla PDF.js para renderização raster multi-DPI e extração textual estruturada de PDFs.',
    category: 'document',
    supportedModifiers: ['page_range', 'image_dpi', 'quality'],
    supportedConversions: [
      {
        from: ['.pdf'],
        to: ['.png', '.jpg', '.jpeg', '.webp', '.txt', '.md', '.json'],
        lossy: false,
        speedScore: 91,
        acceleration: 'cpu-singlethread',
        performanceNotes: 'Renderização de páginas em alta resolução e extração de texto via Mozilla PDF.js',
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
    };

    if ((!file && !fileData) || !originalName || !targetFormat) {
      throw new Error('PDF.js module requires file/fileData, originalName, and targetFormat.');
    }

    const targetExt = targetFormat.startsWith('.') ? targetFormat.toLowerCase() : '.' + targetFormat.toLowerCase();
    const baseName = originalName.replace(/\.[^.]+$/, '');
    const mimeType = getMimeType(targetExt);

    context.onLog(`[PDF.js] Carregando documento PDF: ${originalName}`);
    context.onProgress(15, 'Inicializando Mozilla PDF.js...');

    const bytes = fileData || new Uint8Array(await (file as File | Blob).arrayBuffer());
    const isNodeOrJsdom =
      typeof process !== 'undefined' &&
      Boolean(process.versions?.node) &&
      (typeof navigator === 'undefined' || /jsdom/i.test(navigator.userAgent));

    const pdfjsLib = isNodeOrJsdom
      ? await import('pdfjs-dist/legacy/build/pdf.mjs')
      : await import('pdfjs-dist');
    const origin = getOriginBase();

    if (isNodeOrJsdom) {
      const path = await import(/* @vite-ignore */ 'node:path');
      const { pathToFileURL } = await import(/* @vite-ignore */ 'node:url');
      const workerPath = path.resolve(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
      pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
    } else if (typeof window !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `${origin}/wasm/pdfjs/pdf.worker.min.mjs`;
    }

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(bytes),
      useSystemFonts: true,
      disableFontFace: isNodeOrJsdom || typeof document === 'undefined',
    });
    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;
    const targetPages = parsePageIndices(modifiers.pageRange, totalPages);

    context.onProgress(35, `Processando ${targetPages.length} de ${totalPages} página(s)...`);

    if (['.txt', '.md', '.json'].includes(targetExt)) {
      const extractedPages: Array<{ page: number; text: string }> = [];
      for (let i = 0; i < targetPages.length; i++) {
        const pageNum = targetPages[i];
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => (typeof item.str === 'string' ? item.str : ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        extractedPages.push({ page: pageNum, text: pageText });
        context.onProgress(35 + Math.round(((i + 1) / targetPages.length) * 55), `Extraindo texto página ${pageNum}...`);
      }

      let textOutput = '';
      if (targetExt === '.json') {
        textOutput = JSON.stringify({ fileName: originalName, totalPages, pages: extractedPages }, null, 2);
      } else if (targetExt === '.md') {
        textOutput = extractedPages.map((p) => `## Página ${p.page}\n\n${p.text}`).join('\n\n---\n\n');
      } else {
        textOutput = extractedPages.map((p) => p.text).join('\n\n');
      }

      const outputData = new TextEncoder().encode(textOutput);
      const outputFileName = `${baseName}${targetExt}`;
      const outputBlob = new Blob([outputData.buffer as unknown as BlobPart], { type: mimeType });

      context.onProgress(100, 'Extração concluída!');
      return {
        outputData,
        outputBlob,
        outputFileName,
        outputSize: outputData.byteLength,
        mimeType,
      };
    }

    const dpi = Number(modifiers.imageDpi || modifiers.customImageDpi || 150);
    const scale = Math.max(0.5, Math.min(8, dpi / 72));
    const quality =
      typeof modifiers.quality === 'number'
        ? modifiers.quality
        : modifiers.qualityPreset === 'original'
        ? 95
        : modifiers.qualityPreset === 'compressed'
        ? 70
        : 85;

    const renderedFiles: Record<string, Uint8Array> = {};
    for (let i = 0; i < targetPages.length; i++) {
      const pageNum = targetPages[i];
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const width = Math.max(1, Math.round(viewport.width));
      const height = Math.max(1, Math.round(viewport.height));

      let canvas: HTMLCanvasElement | OffscreenCanvas;
      if (typeof document !== 'undefined') {
        const el = document.createElement('canvas');
        el.width = width;
        el.height = height;
        canvas = el;
      } else if (typeof OffscreenCanvas !== 'undefined') {
        canvas = new OffscreenCanvas(width, height);
      } else {
        throw new Error('[PDF.js] Renderização raster requer ambiente com Canvas/OffscreenCanvas.');
      }

      const ctx = canvas.getContext('2d') as any;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      await page.render({ canvasContext: ctx, viewport, canvas: canvas as any }).promise;

      const imgData = ctx.getImageData(0, 0, width, height);
      const encoded = await encodeRgbaWithJSquash(
        { data: new Uint8ClampedArray(imgData.data), width, height },
        targetExt,
        quality,
        '#ffffff'
      );
      renderedFiles[`page_${pageNum}${targetExt}`] = encoded;
      context.onProgress(35 + Math.round(((i + 1) / targetPages.length) * 55), `Renderizada página ${pageNum}...`);
    }

    const names = Object.keys(renderedFiles);
    if (names.length === 1) {
      const outputData = renderedFiles[names[0]];
      const outputFileName = `${baseName}${targetExt}`;
      const outputBlob = new Blob([outputData.buffer as unknown as BlobPart], { type: mimeType });
      context.onProgress(100, 'Renderização concluída!');
      return {
        outputData,
        outputBlob,
        outputFileName,
        outputSize: outputData.byteLength,
        mimeType,
      };
    }

    const zipBytes = zipSync(renderedFiles, { level: 0 });
    const outputFileName = `${baseName}_pages.zip`;
    const outputBlob = new Blob([zipBytes.buffer as unknown as BlobPart], { type: 'application/zip' });
    context.onProgress(100, 'Renderização multi-página concluída!');

    return {
      outputData: zipBytes,
      outputBlob,
      outputFileName,
      outputSize: zipBytes.byteLength,
      mimeType: 'application/zip',
    };
  },
};
