import type { IModule, ExecutionContext } from '@/shared/types/module';
import type { ConversionModifiers } from '@/shared/types/conversionModifiers';
import { getMimeType } from '@/core/knowledge/mimeTypes';
import { parseGlbMeshes, serializeMeshesToFormat } from './meshSerializer';

function getOriginBase(): string {
  if (typeof window !== 'undefined' && window.location?.origin && !window.location.origin.startsWith('file:')) {
    return window.location.origin;
  }
  if (typeof self !== 'undefined' && (self as any).location?.origin && !(self as any).location.origin.startsWith('file:')) {
    return (self as any).location.origin;
  }
  return 'http://localhost:4321';
}

async function getAssimpInstance() {
  const mod = await import('assimpjs');
  const factory = (mod as any).default || mod;
  const origin = getOriginBase();

  const isNodeOrJsdom =
    typeof process !== 'undefined' &&
    Boolean(process.versions?.node) &&
    (typeof navigator === 'undefined' || /jsdom/i.test(navigator.userAgent));

  if (isNodeOrJsdom) {
    const fs = await import('fs');
    const path = await import('path');
    const wasmBinary = fs.readFileSync(path.resolve(process.cwd(), 'public/wasm/assimp/assimpjs.wasm'));
    return await factory({
      wasmBinary: wasmBinary.buffer.slice(wasmBinary.byteOffset, wasmBinary.byteOffset + wasmBinary.byteLength),
    });
  }

  return await factory({
    locateFile: (file: string) => (file.endsWith('.wasm') ? `${origin}/wasm/assimp/assimpjs.wasm` : file),
  });
}

export const AssimpModule: IModule = {
  manifest: {
    id: 'assimp',
    name: 'AssimpJS (3D / Malhas Universais)',
    version: '0.0.10',
    description: 'Motor Open Asset Import Library WASM para OBJ, FBX, STL, PLY, 3DS, DAE, GLTF, GLB, DXF, 3MF e X3D.',
    category: 'model3d',
    supportedModifiers: ['mesh_options'],
    supportedConversions: [
      {
        from: ['.obj', '.fbx', '.stl', '.ply', '.3ds', '.dae', '.gltf', '.glb', '.dxf', '.3mf', '.x3d'],
        to: ['.glb', '.gltf', '.obj', '.stl', '.ply', '.3mf', '.json'],
        lossy: false,
        speedScore: 90,
        acceleration: 'cpu-singlethread',
        performanceNotes: 'Importação C++ Assimp WASM + serialização geométrica direta',
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
      meshScale?: number;
      meshAsciiStl?: boolean;
    };

    if ((!file && !fileData) || !originalName || !targetFormat) {
      throw new Error('AssimpJS requires file/fileData, originalName, and targetFormat.');
    }

    const targetExt = targetFormat.startsWith('.') ? targetFormat.toLowerCase() : '.' + targetFormat.toLowerCase();
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + targetExt;
    const mimeType = getMimeType(targetExt);

    context.onLog(`[AssimpJS] Carregando modelo 3D ${originalName}...`);
    context.onProgress(20, 'Inicializando AssimpJS WASM...');

    const bytes = fileData || new Uint8Array(await (file as File | Blob).arrayBuffer());
    const ajs = await getAssimpInstance();
    const fileList = new ajs.FileList();
    fileList.AddFile(originalName, bytes);

    let outputData: Uint8Array;

    if (targetExt === '.json') {
      context.onProgress(60, 'Exportando árvore AssimpJSON...');
      const res = ajs.ConvertFileList(fileList, 'assjson');
      if (!res.IsSuccess() || res.FileCount() === 0) {
        throw new Error(`[AssimpJS] Falha ao converter ${originalName}: ${res.GetErrorCode()}`);
      }
      outputData = new Uint8Array(res.GetFile(0).GetContent());
    } else {
      context.onProgress(55, 'Convertendo cena para glTF 2.0 binário...');
      const res = ajs.ConvertFileList(fileList, 'glb2');
      if (!res.IsSuccess() || res.FileCount() === 0) {
        throw new Error(`[AssimpJS] Falha ao importar ${originalName}: ${res.GetErrorCode()}`);
      }
      const glbBytes = new Uint8Array(res.GetFile(0).GetContent());

      if (targetExt === '.glb' && (!modifiers.meshScale || modifiers.meshScale === 1)) {
        outputData = glbBytes;
      } else {
        context.onProgress(80, `Serializando malha para ${targetExt.toUpperCase()}...`);
        const meshes = parseGlbMeshes(glbBytes);
        outputData = serializeMeshesToFormat(meshes, targetExt, {
          scale: modifiers.meshScale,
          asciiStl: modifiers.meshAsciiStl,
        });
      }
    }

    const outputBlob = new Blob([outputData.buffer as unknown as BlobPart], { type: mimeType });
    context.onProgress(100, 'Conversão 3D concluída!');
    context.onLog(`[AssimpJS] Sucesso: ${outputFileName} (${outputData.byteLength} bytes)`);

    return {
      outputData,
      outputBlob,
      outputFileName,
      outputSize: outputData.byteLength,
      mimeType,
    };
  },
};
