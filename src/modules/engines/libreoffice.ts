/**
 * src/modules/engines/libreoffice.ts
 *
 * LibreOffice Technology WebAssembly Conversion Engine.
 * Powered by @matbee/libreoffice-converter running LibreOffice C++ Core
 * inside dedicated background Web Workers.
 *
 * Adheres to:
 * - Pilar 1: Desacoplamento Canônico (IModule)
 * - Pilar 2: Zero-RAM Streaming / OPFS (outputBlob canônico)
 */

import type { IModule, ExecutionContext } from '@/shared/types/module';
import type { ConversionModifiers, PdfComplianceChoice } from '@/shared/types/conversionModifiers';
import { getMimeType } from '@/core/knowledge/mimeTypes';

let browserConverterInstance: any = null;
let browserConverterInitPromise: Promise<any> | null = null;

async function getBrowserConverter(context: ExecutionContext): Promise<any> {
  if (browserConverterInstance && browserConverterInstance.isReady()) {
    return browserConverterInstance;
  }

  if (browserConverterInitPromise) {
    return browserConverterInitPromise;
  }

  browserConverterInitPromise = (async () => {
    context.onLog('[LibreOffice WASM] Inicializando ambiente Web Worker...');
    context.onProgress(10, 'Carregando núcleo LibreOffice WASM...');

    const { WorkerBrowserConverter } = await import('@matbee/libreoffice-converter/browser');

    const converter = new WorkerBrowserConverter({
      sofficeJs: '/wasm/libreoffice/soffice.js',
      sofficeWasm: '/wasm/libreoffice/soffice.wasm',
      sofficeData: '/wasm/libreoffice/soffice.data',
      sofficeWorkerJs: '/wasm/libreoffice/soffice.worker.js',
      browserWorkerJs: '/wasm/libreoffice/browser.worker.global.js',
      verbose: false,
    });

    context.onProgress(25, 'Compilando e inicializando LOK...');
    await converter.initialize();
    context.onLog('[LibreOffice WASM] Motor inicializado e pronto para conversões.');

    browserConverterInstance = converter;
    return converter;
  })();

  try {
    return await browserConverterInitPromise;
  } finally {
    browserConverterInitPromise = null;
  }
}

function parsePageRangeToIndices(pageRange?: string): { pageIndex?: number; pages?: number[] } {
  if (!pageRange || pageRange === 'all') return {};

  const clean = pageRange.trim();
  if (/^\d+$/.test(clean)) {
    const p = Math.max(0, parseInt(clean, 10) - 1);
    return { pageIndex: p };
  }

  if (clean.includes('-')) {
    const [startStr, endStr] = clean.split('-');
    const start = Math.max(0, (parseInt(startStr, 10) || 1) - 1);
    const end = Math.max(start, (parseInt(endStr, 10) || 1) - 1);
    const pages: number[] = [];
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return { pages };
  }

  if (clean.includes(',')) {
    const parts = clean.split(',').map((s) => (parseInt(s.trim(), 10) || 1) - 1);
    const valid = parts.filter((n) => n >= 0);
    return valid.length > 0 ? { pages: valid } : {};
  }

  return {};
}

function mapPdfaLevel(compliance?: PdfComplianceChoice): 'PDF/A-1b' | 'PDF/A-2b' | 'PDF/A-3b' | undefined {
  if (compliance === 'pdfa-1b') return 'PDF/A-1b';
  if (compliance === 'pdfa-2b') return 'PDF/A-2b';
  if (compliance === 'pdfa-3b') return 'PDF/A-3b';
  return undefined;
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

function parseStoredZip(data: Uint8Array): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let offset = 0;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  while (offset + 30 <= data.byteLength) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) break; // Not a local file header (PK\x03\x04)

    const compression = view.getUint16(offset + 8, true);
    const compSize = view.getUint32(offset + 18, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);

    const nameStart = offset + 30;
    if (nameStart + nameLen > data.byteLength) break;
    const nameBytes = data.subarray(nameStart, nameStart + nameLen);
    const name = new TextDecoder().decode(nameBytes);

    const dataStart = nameStart + nameLen + extraLen;
    if (dataStart + compSize > data.byteLength) break;

    if (compression === 0) {
      entries.push({
        name,
        data: data.subarray(dataStart, dataStart + compSize),
      });
    }

    offset = dataStart + compSize;
  }

  return entries;
}

export const LibreOfficeModule: IModule = {
  manifest: {
    id: 'libreoffice',
    name: 'LibreOffice WASM',
    version: '2.7.2',
    description: 'Suíte universal de documentos de escritório de alta fidelidade compilada em WebAssembly.',
    category: 'document',
    supportedModifiers: ['page_range', 'pdf_compliance', 'image_dpi', 'quality'],
    supportedConversions: [
      // Documentos de Texto (Writer)
      {
        from: ['.doc', '.docx', '.odt', '.rtf', '.txt', '.html', '.htm', '.epub'],
        to: ['.pdf', '.docx', '.doc', '.odt', '.rtf', '.txt', '.png'],
        lossy: false,
        speedScore: 82,
        acceleration: 'cpu-multithread',
        performanceNotes: 'Conversão nativa LibreOfficeKit com preservação total de fontes e layout',
      },
      // Planilhas (Calc)
      {
        from: ['.xls', '.xlsx', '.ods', '.csv'],
        to: ['.pdf', '.xlsx', '.xls', '.ods', '.csv', '.html', '.png'],
        lossy: false,
        speedScore: 82,
        acceleration: 'cpu-multithread',
        performanceNotes: 'Cálculo de fórmulas e renderização tabular de alta fidelidade',
      },
      // Apresentações (Impress)
      {
        from: ['.ppt', '.pptx', '.odp'],
        to: ['.pdf', '.pptx', '.ppt', '.odp', '.png', '.svg'],
        lossy: false,
        speedScore: 80,
        acceleration: 'cpu-multithread',
        performanceNotes: 'Renderização de slides vetoriais e gráficos nativos',
      },
      // Desenhos & Gráficos / Documentos PDF (Draw)
      {
        from: ['.odg', '.pdf'],
        to: ['.pdf', '.png', '.svg'],
        lossy: false,
        speedScore: 80,
        acceleration: 'cpu-multithread',
        performanceNotes: 'Manipulação e exportação vetorial de desenhos e documentos PDF no LibreOffice Draw',
      },
    ],
    inputs: [{ id: 'file', name: 'Input File', type: 'file_handle', required: true }],
    outputs: [{ id: 'file', name: 'Output File', type: 'file_handle', required: true }],
  },

  isSupported: async () => true,

  execute: async (inputs: Record<string, unknown>, context: ExecutionContext) => {
    const file = inputs.file as File | Blob | undefined;
    const fileData = inputs.fileData as Uint8Array | undefined;
    const originalName = (inputs.originalName as string) || 'document.docx';
    const targetFormat = (inputs.targetFormat as string) || '.pdf';
    const modifiers = (inputs.modifiers as ConversionModifiers) || {};

    if (!file && !fileData) {
      throw new Error('LibreOffice requer um arquivo de entrada válido (File, Blob ou fileData).');
    }

    const cleanSourceExt = originalName.slice(originalName.lastIndexOf('.') + 1).toLowerCase();
    const cleanTargetExt = targetFormat.replace(/^\./, '').toLowerCase();
    let outputFileName = originalName.replace(/\.[^.]+$/, '') + '.' + cleanTargetExt;

    context.onLog(`[LibreOffice WASM] Preparando conversão de ${originalName} -> ${outputFileName}...`);
    context.onProgress(15, 'Lendo arquivo de entrada...');

    const inputBytes = fileData || new Uint8Array(await (file as File | Blob).arrayBuffer());
    const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
    let resultData: Uint8Array;
    let resultMime: string = getMimeType('.' + cleanTargetExt);

    const isImageOutput = ['png', 'svg'].includes(cleanTargetExt);
    const pdfa = mapPdfaLevel(modifiers.pdfCompliance);
    const pdfQuality = modifiers.pdfQuality ?? (modifiers.qualityPreset === 'original' ? 100 : modifiers.qualityPreset === 'compressed' ? 70 : 90);
    const dpi = modifiers.imageDpi || 150;
    const { pageIndex, pages } = parsePageRangeToIndices(modifiers.pageRange);

    // Native direct LibreOffice conversion (Purity: zero hidden multi-engine chaining)
    context.onProgress(40, 'Processando documento no LibreOffice WASM...');
    const conversionOptions: any = {
      outputFormat: cleanTargetExt,
    };

    if (cleanTargetExt === 'pdf') {
      conversionOptions.pdf = {
        quality: pdfQuality,
        ...(pdfa ? { pdfaLevel: pdfa } : {}),
      };
    }

    if (isImageOutput) {
      conversionOptions.image = {
        dpi,
        ...(modifiers.targetWidth ? { width: modifiers.targetWidth } : {}),
        ...(modifiers.targetHeight ? { height: modifiers.targetHeight } : {}),
        ...(pageIndex !== undefined ? { pageIndex } : {}),
        ...(pages !== undefined ? { pages } : {}),
      };
    }

    if (isBrowser) {
      const converter = await getBrowserConverter(context);
      context.onProgress(60, 'Convertendo no Web Worker isolado...');
      const result = await converter.convert(inputBytes, conversionOptions, originalName);
      resultData = result.data;
      if (result.mimeType) {
        resultMime = result.mimeType;
      }
    } else {
      const { convertDocument } = await import('@matbee/libreoffice-converter');
      const wasmPath = './node_modules/@matbee/libreoffice-converter/wasm';
      context.onProgress(60, 'Convertendo via LibreOffice Subprocess...');
      const result = await convertDocument(inputBytes, conversionOptions, { wasmPath, verbose: false });
      resultData = result.data;
      if (result.mimeType) {
        resultMime = result.mimeType;
      }
    }

    // Inspect if output is a ZIP archive generated for multi-page image exports
    const isZipArchive =
      resultData.length >= 4 &&
      resultData[0] === 0x50 &&
      resultData[1] === 0x4B &&
      resultData[2] === 0x03 &&
      resultData[3] === 0x04;

    if (isImageOutput && isZipArchive) {
      const entries = parseStoredZip(resultData);
      const isSinglePageRequested = pageIndex !== undefined || (modifiers.pageRange && /^\d+$/.test(modifiers.pageRange.trim()));

      if (isSinglePageRequested && entries.length > 0) {
        const targetIdx = pageIndex ?? 0;
        const selectedEntry = entries[targetIdx] || entries[0];
        resultData = selectedEntry.data;
        outputFileName = originalName.replace(/\.[^.]+$/, '') + '.' + cleanTargetExt;
        resultMime = getMimeType('.' + cleanTargetExt);
        context.onLog(`[LibreOffice WASM] Página ${targetIdx + 1} extraída do documento multi-páginas (${(resultData.byteLength / 1024).toFixed(1)} KB).`);
      } else {
        // Full multi-page export: package as valid .zip archive
        outputFileName = originalName.replace(/\.[^.]+$/, '') + '.zip';
        resultMime = 'application/zip';
        context.onLog(`[LibreOffice WASM] Documento com múltiplas páginas detectado (${entries.length || 'várias'} páginas). Exportado como pacote ZIP: ${outputFileName}`);
      }
    }

    context.onProgress(90, 'Gerando arquivo de saída...');
    const outputBlob = new Blob([resultData.buffer as unknown as BlobPart], { type: resultMime });

    context.onProgress(100, 'Conversão de documento concluída!');
    context.onLog(`[LibreOffice WASM] Concluído com sucesso: ${outputFileName} (${(resultData.byteLength / 1024).toFixed(1)} KB)`);

    return {
      outputData: resultData,
      outputBlob,
      outputFileName,
      outputSize: resultData.byteLength,
      mimeType: resultMime,
    };
  },
};
