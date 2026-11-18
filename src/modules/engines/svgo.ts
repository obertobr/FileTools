import type { IModule, ExecutionContext } from '@/shared/types/module';
import type { ConversionModifiers } from '@/shared/types/conversionModifiers';
import { getMimeType } from '@/core/knowledge/mimeTypes';

export const SvgoModule: IModule = {
  manifest: {
    id: 'svgo',
    name: 'SVGO (SVG Optimizer)',
    version: '4.1.0',
    description: 'Otimizador e minificador de gráficos vetoriais SVG mantendo precisão visual.',
    category: 'image',
    supportedModifiers: ['svg_optimize'],
    supportedConversions: [
      {
        from: ['.svg'],
        to: ['.svg'],
        lossy: false,
        speedScore: 98,
        acceleration: 'cpu-singlethread',
        performanceNotes: 'Otimização estrutural instantânea de paths e metadados SVG',
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
    const modifiers = (inputs.modifiers || inputs.options || {}) as ConversionModifiers & {
      svgMultipass?: boolean;
      svgFloatPrecision?: number;
      svgRemoveDimensions?: boolean;
    };

    if ((!file && !fileData) || !originalName) {
      throw new Error('SVGO module requires file/fileData and originalName.');
    }

    const outputFileName = originalName.replace(/\.[^.]+$/, '') + '.svg';
    const mimeType = getMimeType('.svg');

    context.onLog(`[SVGO] Otimizando ${originalName}...`);
    context.onProgress(30, 'Analisando e otimizando árvore SVG...');

    const bytes = fileData || new Uint8Array(await (file as File | Blob).arrayBuffer());
    const svgText = new TextDecoder().decode(bytes);
    const { optimize } = await import('svgo/browser');

    const precision = modifiers.svgFloatPrecision ?? 3;
    const plugins: any[] = [
      {
        name: 'preset-default',
        params: {
          overrides: {
            cleanupNumericValues: { floatPrecision: precision },
            convertPathData: { floatPrecision: precision },
          },
        },
      },
    ];

    if (modifiers.svgRemoveDimensions) {
      plugins.push('removeDimensions');
    }

    const result = optimize(svgText, {
      multipass: modifiers.svgMultipass ?? true,
      floatPrecision: precision,
      plugins,
    });

    const outputData = new TextEncoder().encode(result.data);
    const outputBlob = new Blob([outputData.buffer as unknown as BlobPart], { type: mimeType });

    context.onProgress(100, 'Otimização SVG concluída!');
    context.onLog(`[SVGO] Redução: ${bytes.byteLength} -> ${outputData.byteLength} bytes`);

    return {
      outputData,
      outputBlob,
      outputFileName,
      outputSize: outputData.byteLength,
      mimeType,
    };
  },
};
