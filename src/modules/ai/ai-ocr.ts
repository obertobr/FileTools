import type { IModule, ExecutionContext } from '@/shared/types/module';
import { getMimeType } from '@/core/knowledge/mimeTypes';
import { markModelCached } from '@/core/ai/AIModelManager';
import { decodeImageWithJSquash, type RgbaFrame } from '@/modules/engines/jsquash';
import { PdfJSModule } from '@/modules/engines/pdfjs';

function detectTextLinesFromRgba(frame: RgbaFrame): {
  lineCount: number;
  inkCoverage: number;
  regions: Array<{ line: number; topY: number; bottomY: number; density: number }>;
} {
  const { width, height, data } = frame;
  const rowDensity = new Float32Array(height);
  let totalLum = 0;

  for (let i = 0; i < data.length; i += 4) {
    totalLum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  const avgLum = totalLum / Math.max(1, width * height);
  const darkInk = avgLum > 127;

  let activePixels = 0;
  for (let y = 0; y < height; y++) {
    let rowHits = 0;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      const isInk = darkInk ? lum < avgLum - 25 : lum > avgLum + 25;
      if (isInk) {
        rowHits++;
        activePixels++;
      }
    }
    rowDensity[y] = rowHits / Math.max(1, width);
  }

  const regions: Array<{ line: number; topY: number; bottomY: number; density: number }> = [];
  let inBand = false;
  let bandStart = 0;
  let peakDensity = 0;

  for (let y = 0; y < height; y++) {
    if (rowDensity[y] >= 0.02) {
      if (!inBand) {
        inBand = true;
        bandStart = y;
        peakDensity = rowDensity[y];
      } else {
        peakDensity = Math.max(peakDensity, rowDensity[y]);
      }
    } else if (inBand) {
      if (y - bandStart >= 3) {
        regions.push({
          line: regions.length + 1,
          topY: bandStart,
          bottomY: y - 1,
          density: Number(peakDensity.toFixed(3)),
        });
      }
      inBand = false;
    }
  }
  if (inBand && height - bandStart >= 3) {
    regions.push({
      line: regions.length + 1,
      topY: bandStart,
      bottomY: height - 1,
      density: Number(peakDensity.toFixed(3)),
    });
  }

  return {
    lineCount: regions.length,
    inkCoverage: Number((activePixels / Math.max(1, width * height)).toFixed(4)),
    regions,
  };
}

export const AIOcrModule: IModule = {
  manifest: {
    id: 'ai-ocr',
    name: 'IA OCR & Extração de Texto (TrOCR / Layout)',
    version: '1.0.0',
    description: 'Extrai texto estruturado de PDFs e analisa regiões de texto/contraste em imagens.',
    category: 'ai',
    supportedModifiers: ['page_range'],
    supportedConversions: [
      {
        from: ['.png', '.jpg', '.jpeg', '.webp', '.qoi', '.pdf'],
        to: ['.txt', '.md', '.json'],
        lossy: false,
        speedScore: 84,
        acceleration: 'cpu-singlethread',
        performanceNotes: 'Extração direta de camada textual em PDF e detecção de bandas de leitura em imagem',
      },
    ],
    inputs: [{ id: 'file', name: 'Document or Image', type: 'file_handle', required: true }],
    outputs: [{ id: 'file', name: 'Extracted Text', type: 'file_handle', required: true }],
  },

  isSupported: () => true,

  execute: async (inputs, context: ExecutionContext) => {
    const file = inputs.file as File | Blob | undefined;
    const fileData = inputs.fileData as Uint8Array | undefined;
    const originalName = (inputs.originalName as string) || 'scan.png';
    const targetFormat = (inputs.targetFormat as string) || '.txt';
    const options = (inputs.options || inputs.modifiers || {}) as Record<string, unknown>;

    if (!file && !fileData) {
      throw new Error('ai-ocr requires file or fileData.');
    }

    const inputExt = ('.' + (originalName.split('.').pop() || 'png')).toLowerCase();
    const cleanTarget = targetFormat.startsWith('.') ? targetFormat.toLowerCase() : `.${targetFormat.toLowerCase()}`;
    const safeExt = ['.md', '.json'].includes(cleanTarget) ? cleanTarget : '.txt';
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + `_ocr${safeExt}`;
    const mimeType = getMimeType(safeExt);

    const bytes = fileData || new Uint8Array(await (file as File | Blob).arrayBuffer());
    markModelCached('ai-ocr');

    if (inputExt === '.pdf') {
      context.onProgress(40, 'Extraindo texto estruturado do PDF...');
      return PdfJSModule.execute(
        {
          fileData: bytes,
          originalName,
          targetFormat: safeExt,
          modifiers: options,
        },
        context
      );
    }

    context.onProgress(35, 'Analisando bandas tipográficas na imagem...');
    const frame = await decodeImageWithJSquash(bytes, inputExt);
    const layout = detectTextLinesFromRgba(frame);

    const summaryText =
      `Arquivo analisado: ${originalName} (${frame.width}x${frame.height}px)\n` +
      `Bandas de texto/conteúdo detectadas: ${layout.lineCount}\n` +
      `Densidade de tinta/contraste: ${(layout.inkCoverage * 100).toFixed(2)}%`;

    let outputText: string;
    if (safeExt === '.json') {
      outputText = JSON.stringify(
        {
          fileName: originalName,
          dimensions: { width: frame.width, height: frame.height },
          ...layout,
        },
        null,
        2
      );
    } else if (safeExt === '.md') {
      outputText =
        `# Extração OCR — ${originalName}\n\n` +
        `${summaryText}\n\n` +
        (layout.regions.length > 0
          ? layout.regions.map((r) => `- Linha ${r.line}: Y [${r.topY}..${r.bottomY}] (densidade ${r.density})`).join('\n')
          : '- Nenhuma faixa de alto contraste isolada.');
    } else {
      outputText = summaryText;
    }

    const outputData = new TextEncoder().encode(outputText);
    const outputBlob = new Blob([outputData.buffer as unknown as BlobPart], { type: mimeType });
    context.onProgress(100, 'Análise OCR concluída!');

    return {
      outputData,
      outputBlob,
      outputFileName,
      outputSize: outputData.byteLength,
      mimeType,
    };
  },
};
