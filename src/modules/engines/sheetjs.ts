import * as XLSX from 'xlsx';
import type { IModule } from '@/shared/types/module';
import { getMimeType } from '@/core/knowledge/mimeTypes';

export const SheetJSModule: IModule = {
  manifest: {
    id: 'sheetjs',
    name: 'SheetJS',
    version: '0.18.5',
    description: 'Conversor local e ultrarrápido de planilhas e dados estruturados (XLSX, XLS, ODS, CSV, TSV, TXT, JSON, HTML).',
    category: 'document',
    supportedModifiers: [],
    supportedConversions: [
      {
        from: ['.xlsx', '.xls', '.ods', '.csv', '.tsv', '.txt', '.json', '.html', '.htm'],
        to: ['.xlsx', '.xls', '.ods', '.csv', '.tsv', '.txt', '.json', '.html'],
        lossy: false,
        speedScore: 95
      },
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
      throw new Error('SheetJS module requires file (File/Blob) or fileData (Uint8Array), originalName, and targetFormat.');
    }

    context.onLog(`[SheetJS] Lendo planilha/documento: ${originalName}`);
    context.onProgress(20, 'Carregando dados da planilha...');

    const data = fileData || new Uint8Array(await (file as File | Blob).arrayBuffer());
    const inputExt = '.' + (originalName.split('.').pop() || '').toLowerCase();
    const targetExt = '.' + targetFormat.replace(/^\.+/, '').toLowerCase();
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + targetExt;

    context.onProgress(40, 'Decodificando conteúdo estruturado...');

    let workbook: XLSX.WorkBook;

    if (inputExt === '.json') {
      try {
        const jsonText = new TextDecoder().decode(data);
        const parsed = JSON.parse(jsonText);
        const ws = Array.isArray(parsed)
          ? XLSX.utils.json_to_sheet(parsed)
          : XLSX.utils.json_to_sheet([parsed]);
        workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, ws, 'Sheet1');
      } catch (err: unknown) {
        throw new Error(`Falha ao ler JSON estruturado: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else if (inputExt === '.html' || inputExt === '.htm') {
      const htmlText = new TextDecoder().decode(data);
      try {
        workbook = XLSX.read(htmlText, { type: 'string' });
        if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('Nenhuma tabela (<table>) encontrada no documento HTML.');
        }
      } catch (err: unknown) {
        throw new Error(`O arquivo HTML não contém dados tabulares legíveis pelo SheetJS: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else if (inputExt === '.csv' || inputExt === '.tsv' || inputExt === '.txt') {
      const text = new TextDecoder().decode(data);
      workbook = XLSX.read(text, { type: 'string' });
    } else {
      workbook = XLSX.read(data, { type: 'array' });
    }

    context.onProgress(60, `Convertendo planilha para ${targetExt.toUpperCase()}...`);

    const firstSheetName = (workbook?.SheetNames && workbook.SheetNames.length > 0) ? workbook.SheetNames[0] : 'Sheet1';
    const worksheet = (workbook?.Sheets && workbook.Sheets[firstSheetName]) || XLSX.utils.aoa_to_sheet([]);

    let outputData: Uint8Array;
    const mimeType = getMimeType(targetExt);

    switch (targetExt) {
      case '.csv': {
        const csvString = XLSX.utils.sheet_to_csv(worksheet);
        outputData = new TextEncoder().encode(csvString);
        break;
      }
      case '.tsv': {
        const tsvString = XLSX.utils.sheet_to_csv(worksheet, { FS: '\t' });
        outputData = new TextEncoder().encode(tsvString);
        break;
      }
      case '.txt': {
        const txtString = XLSX.utils.sheet_to_txt(worksheet);
        outputData = new TextEncoder().encode(txtString);
        break;
      }
      case '.json': {
        const json = XLSX.utils.sheet_to_json(worksheet);
        outputData = new TextEncoder().encode(JSON.stringify(json, null, 2));
        break;
      }
      case '.html': {
        const htmlString = XLSX.utils.sheet_to_html(worksheet);
        outputData = new TextEncoder().encode(htmlString);
        break;
      }
      case '.xlsx': {
        const wbOut = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        outputData = new Uint8Array(wbOut);
        break;
      }
      case '.xls': {
        const wbOut = XLSX.write(workbook, { bookType: 'biff8', type: 'array' });
        outputData = new Uint8Array(wbOut);
        break;
      }
      case '.ods': {
        const wbOut = XLSX.write(workbook, { bookType: 'ods', type: 'array' });
        outputData = new Uint8Array(wbOut);
        break;
      }
      default:
        throw new Error(`Formato de destino não suportado pelo SheetJS: ${targetExt}`);
    }

    const outputBlob = new Blob([outputData.buffer as unknown as BlobPart], { type: mimeType });

    context.onProgress(100, 'Conversão concluída!');
    context.onLog(`[SheetJS] Sucesso: ${outputFileName} (${outputData.byteLength} bytes)`);

    return {
      outputData,
      outputBlob,
      outputFileName,
      outputSize: outputData.byteLength,
      mimeType,
    };
  }
};
