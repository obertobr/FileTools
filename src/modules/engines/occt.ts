import type { IModule, ExecutionContext } from '@/shared/types/module';
import type { ConversionModifiers } from '@/shared/types/conversionModifiers';
import { getMimeType } from '@/core/knowledge/mimeTypes';
import { serializeMeshesToFormat, type TriangleMesh } from './meshSerializer';

function getOriginBase(): string {
  if (typeof window !== 'undefined' && window.location?.origin && !window.location.origin.startsWith('file:')) {
    return window.location.origin;
  }
  if (typeof self !== 'undefined' && (self as any).location?.origin && !(self as any).location.origin.startsWith('file:')) {
    return (self as any).location.origin;
  }
  return 'http://localhost:4321';
}

let occtPromise: Promise<any> | null = null;

async function getOcctInstance() {
  if (occtPromise) return occtPromise;
  occtPromise = (async () => {
    const mod = await import('occt-import-js');
    const factory = (mod as any).default || mod;
    const origin = getOriginBase();

    const isNodeOrJsdom =
      typeof process !== 'undefined' &&
      Boolean(process.versions?.node) &&
      (typeof navigator === 'undefined' || /jsdom/i.test(navigator.userAgent));

    if (isNodeOrJsdom) {
      const fs = await import('fs');
      const path = await import('path');
      const wasmBinary = fs.readFileSync(path.resolve(process.cwd(), 'public/wasm/occt/occt-import-js.wasm'));
      return await factory({
        wasmBinary: wasmBinary.buffer.slice(wasmBinary.byteOffset, wasmBinary.byteOffset + wasmBinary.byteLength),
      });
    }

    return await factory({
      locateFile: (file: string) => (file.endsWith('.wasm') ? `${origin}/wasm/occt/occt-import-js.wasm` : file),
    });
  })();
  return occtPromise;
}

export const OcctModule: IModule = {
  manifest: {
    id: 'occt',
    name: 'OpenCASCADE (occt-import-js CAD)',
    version: '0.0.23',
    description: 'Tesselação paramétrica de modelos CAD B-Rep (STEP, STP, IGES, IGS, BREP) para malhas 3D.',
    category: 'model3d',
    supportedModifiers: ['cad_tessellation', 'mesh_options'],
    supportedConversions: [
      {
        from: ['.step', '.stp', '.iges', '.igs', '.brep'],
        to: ['.glb', '.gltf', '.obj', '.stl', '.ply', '.3mf'],
        lossy: true,
        speedScore: 85,
        acceleration: 'cpu-singlethread',
        performanceNotes: 'Tesselação CAD B-Rep OpenCASCADE em WebAssembly',
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
      cadQuality?: 'draft' | 'standard' | 'fine';
      meshScale?: number;
      meshAsciiStl?: boolean;
    };

    if ((!file && !fileData) || !originalName || !targetFormat) {
      throw new Error('OCCT module requires file/fileData, originalName, and targetFormat.');
    }

    const inputExt = ('.' + (originalName.split('.').pop() || 'step')).toLowerCase();
    const targetExt = targetFormat.startsWith('.') ? targetFormat.toLowerCase() : '.' + targetFormat.toLowerCase();
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + targetExt;
    const mimeType = getMimeType(targetExt);

    context.onLog(`[OCCT] Carregando modelo CAD ${originalName}...`);
    context.onProgress(20, 'Inicializando OpenCASCADE WASM...');

    const bytes = fileData || new Uint8Array(await (file as File | Blob).arrayBuffer());
    const occt = await getOcctInstance();

    const deflectionMap = {
      draft: { linearDeflection: 0.01, angularDeflection: 0.8 },
      standard: { linearDeflection: 0.002, angularDeflection: 0.5 },
      fine: { linearDeflection: 0.0005, angularDeflection: 0.25 },
    };
    const preset = deflectionMap[modifiers.cadQuality || 'standard'] || deflectionMap.standard;
    const importParams = {
      linearUnit: 'millimeter',
      linearDeflectionType: 'bounding_box_ratio',
      ...preset,
    };

    context.onProgress(50, 'Tesselando geometria B-Rep...');
    let res: any;
    if (inputExt === '.step' || inputExt === '.stp') {
      res = occt.ReadStepFile(bytes, importParams);
    } else if (inputExt === '.iges' || inputExt === '.igs') {
      res = occt.ReadIgesFile(bytes, importParams);
    } else {
      res = occt.ReadBrepFile(bytes, importParams);
    }

    if (!res?.success || !res.meshes || res.meshes.length === 0) {
      throw new Error(`[OCCT] Não foi possível extrair sólidos/malhas de ${originalName}.`);
    }

    const meshes: TriangleMesh[] = res.meshes.map((m: any, i: number) => ({
      name: m.name || `cad_body_${i + 1}`,
      positions: new Float32Array(m.attributes.position.array),
      normals: m.attributes.normal ? new Float32Array(m.attributes.normal.array) : undefined,
      indices: new Uint32Array(m.index.array),
    }));

    context.onProgress(80, `Exportando ${meshes.length} sólido(s) para ${targetExt.toUpperCase()}...`);
    const outputData = serializeMeshesToFormat(meshes, targetExt, {
      scale: modifiers.meshScale,
      asciiStl: modifiers.meshAsciiStl,
    });
    const outputBlob = new Blob([outputData.buffer as unknown as BlobPart], { type: mimeType });

    context.onProgress(100, 'Conversão CAD concluída!');
    context.onLog(`[OCCT] Sucesso: ${outputFileName} (${outputData.byteLength} bytes)`);

    return {
      outputData,
      outputBlob,
      outputFileName,
      outputSize: outputData.byteLength,
      mimeType,
    };
  },
};
