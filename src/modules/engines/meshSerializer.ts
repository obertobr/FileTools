import { unzipSync, zipSync } from 'fflate';

export interface TriangleMesh {
  name?: string;
  positions: Float32Array;
  normals?: Float32Array;
  indices: Uint32Array;
}

export function mergeMeshes(meshes: TriangleMesh[]): TriangleMesh {
  let totalPos = 0;
  let totalIdx = 0;
  let hasAllNormals = meshes.length > 0;

  for (const m of meshes) {
    totalPos += m.positions.length;
    totalIdx += m.indices.length;
    if (!m.normals || m.normals.length !== m.positions.length) {
      hasAllNormals = false;
    }
  }

  const positions = new Float32Array(totalPos);
  const normals = hasAllNormals ? new Float32Array(totalPos) : undefined;
  const indices = new Uint32Array(totalIdx);

  let posOffset = 0;
  let idxOffset = 0;
  let vertexBase = 0;

  for (const m of meshes) {
    positions.set(m.positions, posOffset);
    if (normals && m.normals) {
      normals.set(m.normals, posOffset);
    }
    for (let i = 0; i < m.indices.length; i++) {
      indices[idxOffset + i] = m.indices[i] + vertexBase;
    }
    posOffset += m.positions.length;
    idxOffset += m.indices.length;
    vertexBase += Math.floor(m.positions.length / 3);
  }

  return { name: meshes[0]?.name || 'mesh', positions, normals, indices };
}

export function scaleMesh(mesh: TriangleMesh, factor: number): TriangleMesh {
  if (!factor || factor === 1) return mesh;
  const scaled = new Float32Array(mesh.positions.length);
  for (let i = 0; i < mesh.positions.length; i++) {
    scaled[i] = mesh.positions[i] * factor;
  }
  return { ...mesh, positions: scaled };
}

export function computeBounds(positions: Float32Array): { min: [number, number, number]; max: [number, number, number] } {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let c = 0; c < 3; c++) {
      const v = positions[i + c];
      if (v < min[c]) min[c] = v;
      if (v > max[c]) max[c] = v;
    }
  }
  if (positions.length === 0) {
    return { min: [0, 0, 0], max: [0, 0, 0] };
  }
  return { min, max };
}

export function parseGlbMeshes(glbBytes: Uint8Array): TriangleMesh[] {
  if (glbBytes.byteLength < 20) throw new Error('[3D] GLB inválido ou truncado.');
  const view = new DataView(glbBytes.buffer, glbBytes.byteOffset, glbBytes.byteLength);
  const magic = view.getUint32(0, true);
  if (magic !== 0x46546c67) throw new Error('[3D] Magic bytes glTF inválidos no GLB.');

  const jsonLen = view.getUint32(12, true);
  const jsonText = new TextDecoder().decode(glbBytes.subarray(20, 20 + jsonLen));
  const gltf = JSON.parse(jsonText);

  let binOffset = 20 + jsonLen;
  let binBytes: Uint8Array = new Uint8Array(0);
  if (binOffset + 8 <= glbBytes.byteLength) {
    const binLen = view.getUint32(binOffset, true);
    const binType = view.getUint32(binOffset + 4, true);
    if (binType === 0x004e4942) {
      binBytes = glbBytes.subarray(binOffset + 8, binOffset + 8 + binLen);
    }
  }

  const readAccessor = (accessorIdx: number): Float32Array | Uint32Array | Uint16Array => {
    const acc = gltf.accessors[accessorIdx];
    const bv = gltf.bufferViews[acc.bufferView];
    const byteOffset = (bv.byteOffset || 0) + (acc.byteOffset || 0);
    const compCount = acc.type === 'VEC3' ? 3 : acc.type === 'VEC2' ? 2 : 1;
    const total = acc.count * compCount;
    const sub = binBytes.subarray(byteOffset, byteOffset + total * 4);
    const aligned = new Uint8Array(total * 4);

    if (acc.componentType === 5126) {
      aligned.set(binBytes.subarray(byteOffset, byteOffset + total * 4));
      return new Float32Array(aligned.buffer);
    }
    if (acc.componentType === 5125) {
      aligned.set(binBytes.subarray(byteOffset, byteOffset + total * 4));
      return new Uint32Array(aligned.buffer);
    }
    if (acc.componentType === 5123) {
      const u16 = new Uint8Array(total * 2);
      u16.set(binBytes.subarray(byteOffset, byteOffset + total * 2));
      return new Uint16Array(u16.buffer);
    }
    if (acc.componentType === 5121) {
      const out = new Uint32Array(total);
      for (let i = 0; i < total; i++) out[i] = binBytes[byteOffset + i];
      return out;
    }
    const copy = new Uint8Array(sub.byteLength);
    copy.set(sub);
    return new Float32Array(copy.buffer);
  };

  const result: TriangleMesh[] = [];
  for (const mesh of gltf.meshes || []) {
    for (const prim of mesh.primitives || []) {
      if (prim.attributes?.POSITION === undefined) continue;
      const positions = readAccessor(prim.attributes.POSITION) as Float32Array;
      const normals =
        prim.attributes.NORMAL !== undefined ? (readAccessor(prim.attributes.NORMAL) as Float32Array) : undefined;
      let indices: Uint32Array;
      if (prim.indices !== undefined) {
        const rawIdx = readAccessor(prim.indices);
        indices = rawIdx instanceof Uint32Array ? rawIdx : Uint32Array.from(rawIdx);
      } else {
        const vCount = Math.floor(positions.length / 3);
        indices = new Uint32Array(vCount);
        for (let i = 0; i < vCount; i++) indices[i] = i;
      }
      result.push({ name: mesh.name, positions, normals, indices });
    }
  }
  return result;
}

export function serializeToGlb(meshes: TriangleMesh[]): Uint8Array {
  const merged = mergeMeshes(meshes);
  const posBytes = new Uint8Array(merged.positions.buffer, merged.positions.byteOffset, merged.positions.byteLength);
  const idxBytes = new Uint8Array(merged.indices.buffer, merged.indices.byteOffset, merged.indices.byteLength);
  const normBytes = merged.normals
    ? new Uint8Array(merged.normals.buffer, merged.normals.byteOffset, merged.normals.byteLength)
    : null;

  const pad4 = (n: number) => (4 - (n % 4)) % 4;
  const posPad = pad4(posBytes.byteLength);
  const normOffset = posBytes.byteLength + posPad;
  const normPad = normBytes ? pad4(normBytes.byteLength) : 0;
  const idxOffset = normBytes ? normOffset + normBytes.byteLength + normPad : normOffset;
  const idxPad = pad4(idxBytes.byteLength);
  const binLen = idxOffset + idxBytes.byteLength + idxPad;

  const binBuf = new Uint8Array(binLen);
  binBuf.set(posBytes, 0);
  if (normBytes) binBuf.set(normBytes, normOffset);
  binBuf.set(idxBytes, idxOffset);

  const { min, max } = computeBounds(merged.positions);
  const vCount = Math.floor(merged.positions.length / 3);

  const accessors: any[] = [
    { bufferView: 0, componentType: 5126, count: vCount, type: 'VEC3', min, max },
  ];
  const bufferViews: any[] = [{ buffer: 0, byteOffset: 0, byteLength: posBytes.byteLength }];
  const attributes: Record<string, number> = { POSITION: 0 };

  if (normBytes) {
    accessors.push({ bufferView: bufferViews.length, componentType: 5126, count: vCount, type: 'VEC3' });
    bufferViews.push({ buffer: 0, byteOffset: normOffset, byteLength: normBytes.byteLength });
    attributes.NORMAL = accessors.length - 1;
  }

  const idxAccIdx = accessors.length;
  accessors.push({ bufferView: bufferViews.length, componentType: 5125, count: merged.indices.length, type: 'SCALAR' });
  bufferViews.push({ buffer: 0, byteOffset: idxOffset, byteLength: idxBytes.byteLength });

  const gltf = {
    asset: { version: '2.0', generator: 'FileTools MeshSerializer' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ name: merged.name || 'Model', primitives: [{ attributes, indices: idxAccIdx }] }],
    accessors,
    bufferViews,
    buffers: [{ byteLength: binLen }],
  };

  let jsonStr = JSON.stringify(gltf);
  while (new TextEncoder().encode(jsonStr).byteLength % 4 !== 0) jsonStr += ' ';
  const jsonBytes = new TextEncoder().encode(jsonStr);

  const totalLen = 12 + 8 + jsonBytes.byteLength + 8 + binBuf.byteLength;
  const out = new Uint8Array(totalLen);
  const view = new DataView(out.buffer);
  out.set([0x67, 0x6c, 0x54, 0x46], 0);
  view.setUint32(4, 2, true);
  view.setUint32(8, totalLen, true);
  view.setUint32(12, jsonBytes.byteLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.set(jsonBytes, 20);

  const binHdrOff = 20 + jsonBytes.byteLength;
  view.setUint32(binHdrOff, binBuf.byteLength, true);
  view.setUint32(binHdrOff + 4, 0x004e4942, true);
  out.set(binBuf, binHdrOff + 8);
  return out;
}

export function serializeToGltfEmbedded(meshes: TriangleMesh[]): Uint8Array {
  const glb = serializeToGlb(meshes);
  const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  const jsonLen = view.getUint32(12, true);
  const gltf = JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + jsonLen)));
  const binOff = 20 + jsonLen;
  const binLen = view.getUint32(binOff, true);
  const bin = glb.subarray(binOff + 8, binOff + 8 + binLen);
  let b64 = '';
  for (let i = 0; i < bin.length; i += 0x8000) {
    b64 += String.fromCharCode(...bin.subarray(i, i + 0x8000));
  }
  const encoded = typeof btoa === 'function' ? btoa(b64) : Buffer.from(bin).toString('base64');
  gltf.buffers = [{ uri: `data:application/octet-stream;base64,${encoded}`, byteLength: bin.byteLength }];
  return new TextEncoder().encode(JSON.stringify(gltf, null, 2));
}

export function serializeToObj(meshes: TriangleMesh[]): Uint8Array {
  const merged = mergeMeshes(meshes);
  const lines: string[] = ['# Generated by FileTools'];
  for (let i = 0; i < merged.positions.length; i += 3) {
    lines.push(`v ${merged.positions[i]} ${merged.positions[i + 1]} ${merged.positions[i + 2]}`);
  }
  if (merged.normals) {
    for (let i = 0; i < merged.normals.length; i += 3) {
      lines.push(`vn ${merged.normals[i]} ${merged.normals[i + 1]} ${merged.normals[i + 2]}`);
    }
  }
  for (let i = 0; i < merged.indices.length; i += 3) {
    const a = merged.indices[i] + 1;
    const b = merged.indices[i + 1] + 1;
    const c = merged.indices[i + 2] + 1;
    if (merged.normals) {
      lines.push(`f ${a}//${a} ${b}//${b} ${c}//${c}`);
    } else {
      lines.push(`f ${a} ${b} ${c}`);
    }
  }
  return new TextEncoder().encode(lines.join('\n') + '\n');
}

export function serializeToStl(meshes: TriangleMesh[], ascii = false): Uint8Array {
  const merged = mergeMeshes(meshes);
  const triCount = Math.floor(merged.indices.length / 3);
  const p = merged.positions;

  if (ascii) {
    const lines: string[] = ['solid FileToolsModel'];
    for (let i = 0; i < triCount; i++) {
      const ia = merged.indices[i * 3] * 3;
      const ib = merged.indices[i * 3 + 1] * 3;
      const ic = merged.indices[i * 3 + 2] * 3;
      const ux = p[ib] - p[ia], uy = p[ib + 1] - p[ia + 1], uz = p[ib + 2] - p[ia + 2];
      const vx = p[ic] - p[ia], vy = p[ic + 1] - p[ia + 1], vz = p[ic + 2] - p[ia + 2];
      let nx = uy * vz - uz * vy;
      let ny = uz * vx - ux * vz;
      let nz = ux * vy - uy * vx;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;
      lines.push(`  facet normal ${nx} ${ny} ${nz}`);
      lines.push('    outer loop');
      lines.push(`      vertex ${p[ia]} ${p[ia + 1]} ${p[ia + 2]}`);
      lines.push(`      vertex ${p[ib]} ${p[ib + 1]} ${p[ib + 2]}`);
      lines.push(`      vertex ${p[ic]} ${p[ic + 1]} ${p[ic + 2]}`);
      lines.push('    endloop');
      lines.push('  endfacet');
    }
    lines.push('endsolid FileToolsModel');
    return new TextEncoder().encode(lines.join('\n') + '\n');
  }

  const out = new Uint8Array(84 + triCount * 50);
  const hdr = new TextEncoder().encode('FileTools Binary STL');
  out.set(hdr, 0);
  const view = new DataView(out.buffer);
  view.setUint32(80, triCount, true);

  for (let i = 0; i < triCount; i++) {
    const ia = merged.indices[i * 3] * 3;
    const ib = merged.indices[i * 3 + 1] * 3;
    const ic = merged.indices[i * 3 + 2] * 3;
    const ux = p[ib] - p[ia], uy = p[ib + 1] - p[ia + 1], uz = p[ib + 2] - p[ia + 2];
    const vx = p[ic] - p[ia], vy = p[ic + 1] - p[ia + 1], vz = p[ic + 2] - p[ia + 2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;

    const base = 84 + i * 50;
    view.setFloat32(base, nx, true);
    view.setFloat32(base + 4, ny, true);
    view.setFloat32(base + 8, nz, true);
    view.setFloat32(base + 12, p[ia], true);
    view.setFloat32(base + 16, p[ia + 1], true);
    view.setFloat32(base + 20, p[ia + 2], true);
    view.setFloat32(base + 24, p[ib], true);
    view.setFloat32(base + 28, p[ib + 1], true);
    view.setFloat32(base + 32, p[ib + 2], true);
    view.setFloat32(base + 36, p[ic], true);
    view.setFloat32(base + 40, p[ic + 1], true);
    view.setFloat32(base + 44, p[ic + 2], true);
  }
  return out;
}

export function serializeToPly(meshes: TriangleMesh[]): Uint8Array {
  const merged = mergeMeshes(meshes);
  const vCount = Math.floor(merged.positions.length / 3);
  const fCount = Math.floor(merged.indices.length / 3);
  const lines: string[] = [
    'ply',
    'format ascii 1.0',
    `element vertex ${vCount}`,
    'property float x',
    'property float y',
    'property float z',
    `element face ${fCount}`,
    'property list uchar int vertex_indices',
    'end_header',
  ];
  for (let i = 0; i < merged.positions.length; i += 3) {
    lines.push(`${merged.positions[i]} ${merged.positions[i + 1]} ${merged.positions[i + 2]}`);
  }
  for (let i = 0; i < merged.indices.length; i += 3) {
    lines.push(`3 ${merged.indices[i]} ${merged.indices[i + 1]} ${merged.indices[i + 2]}`);
  }
  return new TextEncoder().encode(lines.join('\n') + '\n');
}

export function parse3mfMeshes(bytes: Uint8Array): TriangleMesh[] {
  const files = unzipSync(bytes);
  const modelEntry = Object.keys(files).find((k) => k.toLowerCase().endsWith('.model'));
  if (!modelEntry) throw new Error('[lib3mf] Arquivo 3D/3dmodel.model não encontrado no pacote 3MF.');
  const xml = new TextDecoder('utf-8').decode(files[modelEntry]);
  const meshes: TriangleMesh[] = [];
  const meshRegex = /<mesh[^>]*>([\s\S]*?)<\/mesh>/gi;
  let m: RegExpExecArray | null;
  let idx = 0;

  while ((m = meshRegex.exec(xml)) !== null) {
    const block = m[1];
    const verts: number[] = [];
    const tris: number[] = [];
    const vRegex = /<vertex\b([^>]+)\/?>/gi;
    let vm: RegExpExecArray | null;
    while ((vm = vRegex.exec(block)) !== null) {
      const attrs = vm[1];
      const x = parseFloat(attrs.match(/x=["']([^"']+)["']/i)?.[1] || '0');
      const y = parseFloat(attrs.match(/y=["']([^"']+)["']/i)?.[1] || '0');
      const z = parseFloat(attrs.match(/z=["']([^"']+)["']/i)?.[1] || '0');
      verts.push(x, y, z);
    }
    const tRegex = /<triangle\b([^>]+)\/?>/gi;
    let tm: RegExpExecArray | null;
    while ((tm = tRegex.exec(block)) !== null) {
      const attrs = tm[1];
      const v1 = parseInt(attrs.match(/v1=["']([^"']+)["']/i)?.[1] || '0', 10);
      const v2 = parseInt(attrs.match(/v2=["']([^"']+)["']/i)?.[1] || '0', 10);
      const v3 = parseInt(attrs.match(/v3=["']([^"']+)["']/i)?.[1] || '0', 10);
      tris.push(v1, v2, v3);
    }
    if (verts.length > 0 && tris.length > 0) {
      meshes.push({
        name: `3mf_object_${++idx}`,
        positions: new Float32Array(verts),
        indices: new Uint32Array(tris),
      });
    }
  }

  if (meshes.length === 0) throw new Error('[lib3mf] Nenhuma malha encontrada no modelo 3MF.');
  return meshes;
}

export function serializeTo3mf(meshes: TriangleMesh[]): Uint8Array {
  const objectsXml: string[] = [];
  const buildItems: string[] = [];

  meshes.forEach((mesh, idx) => {
    const objId = idx + 1;
    const verts: string[] = [];
    for (let i = 0; i < mesh.positions.length; i += 3) {
      verts.push(`<vertex x="${mesh.positions[i]}" y="${mesh.positions[i + 1]}" z="${mesh.positions[i + 2]}"/>`);
    }
    const tris: string[] = [];
    for (let i = 0; i < mesh.indices.length; i += 3) {
      tris.push(`<triangle v1="${mesh.indices[i]}" v2="${mesh.indices[i + 1]}" v3="${mesh.indices[i + 2]}"/>`);
    }
    objectsXml.push(
      `<object id="${objId}" type="model"><mesh><vertices>${verts.join('')}</vertices><triangles>${tris.join('')}</triangles></mesh></object>`
    );
    buildItems.push(`<item objectid="${objId}"/>`);
  });

  const modelXml = `<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources>${objectsXml.join(
    ''
  )}</resources><build>${buildItems.join('')}</build></model>`;
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>`;
  const relsXml = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`;

  const enc = new TextEncoder();
  return zipSync({
    '[Content_Types].xml': enc.encode(contentTypesXml),
    '_rels/.rels': enc.encode(relsXml),
    '3D/3dmodel.model': enc.encode(modelXml),
  });
}

export function serializeMeshesToFormat(
  meshes: TriangleMesh[],
  targetExt: string,
  options?: { scale?: number; asciiStl?: boolean }
): Uint8Array {
  const scaled = options?.scale && options.scale !== 1 ? meshes.map((m) => scaleMesh(m, options.scale!)) : meshes;
  const ext = targetExt.startsWith('.') ? targetExt.toLowerCase() : `.${targetExt.toLowerCase()}`;
  switch (ext) {
    case '.glb':
      return serializeToGlb(scaled);
    case '.gltf':
      return serializeToGltfEmbedded(scaled);
    case '.obj':
      return serializeToObj(scaled);
    case '.stl':
      return serializeToStl(scaled, Boolean(options?.asciiStl));
    case '.ply':
      return serializeToPly(scaled);
    case '.3mf':
      return serializeTo3mf(scaled);
    default:
      throw new Error(`[MeshSerializer] Formato 3D de saída não suportado: ${targetExt}`);
  }
}
