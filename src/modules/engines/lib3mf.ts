import type { IModule, ExecutionContext } from '@/shared/types/module';
import type { ConversionModifiers } from '@/shared/types/conversionModifiers';
import { getMimeType } from '@/core/knowledge/mimeTypes';
import {
  parse3mfMeshes,
  parseGlbMeshes,
  serializeMeshesToFormat,
  type TriangleMesh,
} from './meshSerializer';

function parseStlMeshes(bytes: Uint8Array): TriangleMesh[] {
  const head = new TextDecoder('ascii').decode(bytes.subarray(0, Math.min(bytes.byteLength, 256)));
  if (head.trimStart().startsWith('solid') && head.includes('vertex')) {
    const text = new TextDecoder('utf-8').decode(bytes);
    const verts: number[] = [];
    const indices: number[] = [];
    const vRegex = /vertex\s+([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)\s+([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)\s+([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/g;
    let m: RegExpExecArray | null;
    let idx = 0;
    while ((m = vRegex.exec(text)) !== null) {
      verts.push(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));
      indices.push(idx++);
    }
    return [{ name: 'stl_model', positions: new Float32Array(verts), indices: new Uint32Array(indices) }];
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint32(80, true);
  const positions = new Float32Array(count * 9);
  const indices = new Uint32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const base = 84 + i * 50;
    for (let v = 0; v < 3; v++) {
      const off = base + 12 + v * 12;
      positions[i * 9 + v * 3] = view.getFloat32(off, true);
      positions[i * 9 + v * 3 + 1] = view.getFloat32(off + 4, true);
      positions[i * 9 + v * 3 + 2] = view.getFloat32(off + 8, true);
      indices[i * 3 + v] = i * 3 + v;
    }
  }
  return [{ name: 'stl_model', positions, indices }];
}

function parseObjMeshes(bytes: Uint8Array): TriangleMesh[] {
  const text = new TextDecoder('utf-8').decode(bytes);
  const verts: number[] = [];
  const indices: number[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith('v ')) {
      const parts = line.split(/\s+/);
      if (parts.length >= 4) {
        verts.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
      }
    } else if (line.startsWith('f ')) {
      const parts = line.split(/\s+/).slice(1);
      const faceIdx = parts.map((p) => parseInt(p.split('/')[0], 10) - 1);
      for (let i = 1; i + 1 < faceIdx.length; i++) {
        indices.push(faceIdx[0], faceIdx[i], faceIdx[i + 1]);
      }
    }
  }
  return [{ name: 'obj_model', positions: new Float32Array(verts), indices: new Uint32Array(indices) }];
}

function parsePlyMeshes(bytes: Uint8Array): TriangleMesh[] {
  const text = new TextDecoder('utf-8').decode(bytes);
  const lines = text.split(/\r?\n/);
  let vCount = 0;
  let fCount = 0;
  let headerEnd = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l.startsWith('element vertex ')) vCount = parseInt(l.split(/\s+/)[2], 10);
    else if (l.startsWith('element face ')) fCount = parseInt(l.split(/\s+/)[2], 10);
    else if (l === 'end_header') {
      headerEnd = i + 1;
      break;
    }
  }
  const positions = new Float32Array(vCount * 3);
  for (let i = 0; i < vCount; i++) {
    const p = (lines[headerEnd + i] || '').trim().split(/\s+/);
    positions[i * 3] = parseFloat(p[0] || '0');
    positions[i * 3 + 1] = parseFloat(p[1] || '0');
    positions[i * 3 + 2] = parseFloat(p[2] || '0');
  }
  const indices: number[] = [];
  for (let i = 0; i < fCount; i++) {
    const p = (lines[headerEnd + vCount + i] || '').trim().split(/\s+/).map(Number);
    const n = p[0] || 0;
    for (let j = 1; j + 1 < n; j++) {
      indices.push(p[1], p[1 + j], p[2 + j]);
    }
  }
  return [{ name: 'ply_model', positions, indices: new Uint32Array(indices) }];
}

export const Lib3mfModule: IModule = {
  manifest: {
    id: 'lib3mf',
    name: '3MF Engine (OPC / 3D Manufacturing Format)',
    version: '1.0.0',
    description: 'Leitura, validação e geração de pacotes 3MF (3D Manufacturing Format) para impressão 3D.',
    category: 'model3d',
    supportedModifiers: ['mesh_options'],
    supportedConversions: [
      {
        from: ['.3mf'],
        to: ['.stl', '.obj', '.glb', '.gltf', '.ply', '.3mf'],
        lossy: false,
        speedScore: 95,
        acceleration: 'cpu-singlethread',
        performanceNotes: 'Parser e empacotador nativo 3MF Core Specification OPC/XML',
      },
      {
        from: ['.stl', '.obj', '.glb', '.ply'],
        to: ['.3mf'],
        lossy: false,
        speedScore: 94,
        acceleration: 'cpu-singlethread',
        performanceNotes: 'Empacotamento direto de malhas 3D para 3MF',
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
      throw new Error('lib3mf module requires file/fileData, originalName, and targetFormat.');
    }

    const inputExt = ('.' + (originalName.split('.').pop() || '3mf')).toLowerCase();
    const targetExt = targetFormat.startsWith('.') ? targetFormat.toLowerCase() : '.' + targetFormat.toLowerCase();
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + targetExt;
    const mimeType = getMimeType(targetExt);

    context.onLog(`[lib3mf] Lendo malha 3D de ${originalName}...`);
    context.onProgress(25, 'Decodificando geometria 3MF...');

    const bytes = fileData || new Uint8Array(await (file as File | Blob).arrayBuffer());
    let meshes: TriangleMesh[];

    if (inputExt === '.3mf') meshes = parse3mfMeshes(bytes);
    else if (inputExt === '.stl') meshes = parseStlMeshes(bytes);
    else if (inputExt === '.obj') meshes = parseObjMeshes(bytes);
    else if (inputExt === '.ply') meshes = parsePlyMeshes(bytes);
    else if (inputExt === '.glb') meshes = parseGlbMeshes(bytes);
    else throw new Error(`[lib3mf] Formato de entrada não suportado: ${inputExt}`);

    context.onProgress(70, `Empacotando ${meshes.length} objeto(s) em ${targetExt.toUpperCase()}...`);
    const outputData = serializeMeshesToFormat(meshes, targetExt, {
      scale: modifiers.meshScale,
      asciiStl: modifiers.meshAsciiStl,
    });
    const outputBlob = new Blob([outputData.buffer as unknown as BlobPart], { type: mimeType });

    context.onProgress(100, 'Conversão 3MF concluída!');
    context.onLog(`[lib3mf] Sucesso: ${outputFileName} (${outputData.byteLength} bytes)`);

    return {
      outputData,
      outputBlob,
      outputFileName,
      outputSize: outputData.byteLength,
      mimeType,
    };
  },
};
