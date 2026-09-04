import * as XLSX from 'xlsx';
import type { IModule } from '@/shared/types/module';

export const SheetJSModule: IModule = {
  manifest: {
    id: 'sheetjs',
    name: 'SheetJS',
    version: '0.18.5',
    description: 'Conversor local e ultrarrápido de planilhas Excel (XLSX, XLS, ODS, CSV, JSON).',
    category: 'document',
    supportedModifiers: [],
    supportedConversions: [
      { from: ['.xlsx', '.xls', '.ods'], to: ['.csv', '.json'], lossy: true, speedScore: 95 },
      { from: ['.csv'], to: ['.xlsx', '.json'], lossy: false, speedScore: 95 },
      { from: ['.json'], to: ['.csv', '.xlsx'], lossy: false, speedScore: 95 },
    ],
    inputs: [
      { id: 'file', name: 'Input File', type: 'file_handle', required: true }
    ],
    outputs: [
      { id: 'file', name: 'Output File', type: 'file_handle', required: true }
    ]
  },
  execute: async (inputs, context) => {
    const fileData = inputs.fileData as Uint8Array;
    const originalName = inputs.originalName as string;
    const targetFormat = inputs.targetFormat as string;

    context.onLog(`[SheetJS] Lendo planilha: ${originalName}`);
    context.onProgress(20, 'Carregando dados da planilha...');

    const workbook = XLSX.read(fileData, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    context.onProgress(60, 'Gerando arquivo de saída...');
    const targetExt = '.' + targetFormat.replace(/^\.+/, '').toLowerCase();
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + targetExt;

    let outputData: Uint8Array;
    let mimeType = 'text/plain';

    if (targetExt === '.csv') {
      const csvString = XLSX.utils.sheet_to_csv(worksheet);
      outputData = new TextEncoder().encode(csvString);
      mimeType = 'text/csv';
    } else if (targetExt === '.json') {
      const json = XLSX.utils.sheet_to_json(worksheet);
      outputData = new TextEncoder().encode(JSON.stringify(json, null, 2));
      mimeType = 'application/json';
    } else if (targetExt === '.xlsx') {
      const wbOut = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      outputData = new Uint8Array(wbOut);
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else {
      throw new Error(`Formato de destino não suportado: ${targetExt}`);
    }

    context.onProgress(100, 'Conversão concluída!');
    context.onLog(`[SheetJS] Sucesso: ${outputFileName} (${outputData.byteLength} bytes)`);

    return {
      outputData,
      outputFileName,
      outputSize: outputData.byteLength,
      mimeType,
    };
  }
};
