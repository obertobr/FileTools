import type { IModule } from '@/shared/types/module';

export const SheetJSModule: IModule = {
  manifest: {
    id: 'sheetjs',
    name: 'SheetJS',
    version: '0.18.5',
    description: 'Leitor e gravador de planilhas Excel.',
    category: 'document',
    supportedConversions: [
      { from: ['.xlsx', '.xls', '.ods'], to: ['.csv', '.json'], lossy: true },
      { from: ['.csv'], to: ['.xlsx', '.json'], lossy: false },
      { from: ['.json'], to: ['.csv', '.xlsx'], lossy: false },
    ],
    inputs: [
      { id: 'file', name: 'Input File', type: 'file_handle', required: true }
    ],
    outputs: [
      { id: 'file', name: 'Output File', type: 'file_handle', required: true }
    ]
  },
  execute: async (inputs, context) => {
    context.onLog('Executing SheetJS placeholder');
    return { success: true };
  }
};
