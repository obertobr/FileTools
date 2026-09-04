import type { IModule } from '@/shared/types/module';

export const MammothModule: IModule = {
  manifest: {
    id: 'mammoth',
    name: 'Mammoth DOCX',
    version: '1.12.2',
    description: 'Extrator de texto e HTML de arquivos DOCX.',
    category: 'document',
    supportedModifiers: [],
    supportedConversions: [
      { from: ['.docx'], to: ['.txt', '.html'], lossy: true },
    ],
    inputs: [
      { id: 'file', name: 'Input File', type: 'file_handle', required: true }
    ],
    outputs: [
      { id: 'file', name: 'Output File', type: 'file_handle', required: true }
    ]
  },
  execute: async (inputs, context) => {
    context.onLog('Executing Mammoth placeholder');
    return { success: true };
  }
};
