import { zipSync } from 'fflate';
import type {
  FtGraphDocument,
  GraphEdgeInstance,
  GraphNodeInstance,
  NodeArtifactPayload,
  NodeExecutionContext,
  NodeRunStatus,
} from './types';
import { computeTopologicalOrder } from './GraphValidator';
import { getModuleById } from '@/modules/registry';
import { MODULAR_NODE_EXECUTORS, artifactToBytes, createPayloadFromBytes } from '@/modules/nodes';
import { DEFAULT_CONVERSION_MODIFIERS } from '@/shared/types/conversionModifiers';
import { getMimeType } from '@/core/knowledge/mimeTypes';

export interface NodeCacheEntry {
  cacheKey: string;
  outputsByPort: Record<string, NodeArtifactPayload>;
}

export interface GraphExecutionCallbacks {
  onNodeStatus?: (nodeId: string, status: NodeRunStatus, progress?: number, message?: string) => void;
  onLog?: (nodeId: string, message: string) => void;
}

export interface GraphExecutionResult {
  executionId: string;
  nodeOutputs: Record<string, Record<string, NodeArtifactPayload>>;
  finalOutputs: Record<string, NodeArtifactPayload>;
  cachedNodeIds: string[];
  executedNodeIds: string[];
}

function quickDigest(bytes: Uint8Array): string {
  let h = 2166136261;
  const step = Math.max(1, Math.floor(bytes.byteLength / 64));
  for (let i = 0; i < bytes.byteLength; i += step) {
    h ^= bytes[i];
    h = Math.imul(h, 16777619);
  }
  return `${bytes.byteLength}:${(h >>> 0).toString(16)}`;
}

async function computePayloadHash(payload: NodeArtifactPayload): Promise<string> {
  if (payload.hash) return payload.hash;
  if (payload.kind === 'batch' && payload.batchItems) {
    const sub = await Promise.all(payload.batchItems.map((b) => computePayloadHash(b)));
    payload.hash = `batch:${sub.join(',')}`;
    return payload.hash;
  }
  if (payload.data) {
    payload.hash = `${payload.fileName}:${quickDigest(payload.data)}`;
    return payload.hash;
  }
  if (payload.file) {
    payload.hash = `${payload.fileName}:${payload.file.size}`;
    return payload.hash;
  }
  payload.hash = `${payload.fileName}:text:${payload.text?.length || 0}`;
  return payload.hash;
}

async function stageOpfsBytes(
  sessionId: string,
  executionId: string,
  nodeId: string,
  fileName: string,
  bytes: Uint8Array
): Promise<string | undefined> {
  const path = `/sessions/${sessionId}/${executionId}/nodes/${nodeId}/${fileName}`;
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.getDirectory) {
      const root = await navigator.storage.getDirectory();
      const sRoot = await root.getDirectoryHandle('sessions', { create: true });
      const sess = await sRoot.getDirectoryHandle(sessionId, { create: true });
      const execDir = await sess.getDirectoryHandle(executionId, { create: true });
      const nodesDir = await execDir.getDirectoryHandle('nodes', { create: true });
      const nodeDir = await nodesDir.getDirectoryHandle(nodeId, { create: true });
      const fileHandle = await nodeDir.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(bytes as unknown as BufferSource);
      await writable.close();
      return path;
    }
  } catch {
    // Graceful memory fallback when OPFS writable handle is unavailable
  }
  return undefined;
}

export class GraphEngine {
  private cache = new Map<string, NodeCacheEntry>();
  private sessionId = `session_${Date.now()}`;

  clearCache(): void {
    this.cache.clear();
  }

  async executeGraph(
    nodes: GraphNodeInstance[],
    edges: GraphEdgeInstance[],
    runtimeInputs: Record<string, File | Blob | Uint8Array | NodeArtifactPayload>,
    callbacks: GraphExecutionCallbacks = {},
    signal?: AbortSignal
  ): Promise<GraphExecutionResult> {
    const abortCtrl = new AbortController();
    if (signal) {
      if (signal.aborted) abortCtrl.abort();
      else signal.addEventListener('abort', () => abortCtrl.abort(), { once: true });
    }

    const order = computeTopologicalOrder(nodes, edges);
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const outputsByNode: Record<string, Record<string, NodeArtifactPayload>> = {};
    const finalOutputs: Record<string, NodeArtifactPayload> = {};
    const cachedNodeIds: string[] = [];
    const executedNodeIds: string[] = [];

    for (const nodeId of order) {
      if (abortCtrl.signal.aborted) {
        throw new DOMException('Pipeline cancelado pelo usuário.', 'AbortError');
      }

      const node = nodeMap.get(nodeId)!;
      const incomingEdges = edges.filter((e) => e.target === nodeId);
      const inputsByPort: Record<string, NodeArtifactPayload | undefined> = {};
      const inputSignatureParts: string[] = [];

      for (const edge of incomingEdges) {
        const srcOut = outputsByNode[edge.source]?.[edge.sourceHandle];
        if (srcOut) {
          inputsByPort[edge.targetHandle] = srcOut;
          inputSignatureParts.push(`${edge.targetHandle}=${await computePayloadHash(srcOut)}`);
        }
      }

      if (node.data.kind === 'input') {
        const raw = runtimeInputs[nodeId];
        if (raw) {
          if (typeof (raw as NodeArtifactPayload).kind === 'string') {
            inputSignatureParts.push(`raw=${await computePayloadHash(raw as NodeArtifactPayload)}`);
          } else if (raw instanceof Uint8Array) {
            inputSignatureParts.push(`raw=${quickDigest(raw)}`);
          } else {
            const fName = (raw as File).name || 'input.bin';
            inputSignatureParts.push(`raw=${fName}:${(raw as Blob).size}`);
          }
        }
      }

      const cacheKey = JSON.stringify({
        kind: node.data.kind,
        moduleId: node.data.moduleId || null,
        targetFormat: node.data.targetFormat || null,
        config: node.data.config || {},
        inputs: inputSignatureParts.sort(),
      });

      const cached = this.cache.get(nodeId);
      if (cached && cached.cacheKey === cacheKey) {
        outputsByNode[nodeId] = cached.outputsByPort;
        cachedNodeIds.push(nodeId);
        callbacks.onNodeStatus?.(nodeId, 'cached', 100, 'Resultado reutilizado do cache');
        if (node.data.kind === 'output' && cached.outputsByPort.out) {
          finalOutputs[nodeId] = cached.outputsByPort.out;
        }
        continue;
      }

      callbacks.onNodeStatus?.(nodeId, 'running', 0, 'Iniciando...');
      const ctx: NodeExecutionContext = {
        sessionId: this.sessionId,
        graphExecutionId: executionId,
        nodeId,
        signal: abortCtrl.signal,
        onProgress: (p, msg) => callbacks.onNodeStatus?.(nodeId, 'running', p, msg),
        onLog: (msg) => callbacks.onLog?.(nodeId, msg),
        writeOpfsArtifact: (fileName, bytes) => stageOpfsBytes(this.sessionId, executionId, nodeId, fileName, bytes),
      };

      try {
        let nodeOut: Record<string, NodeArtifactPayload> = {};

        if (node.data.kind === 'input') {
          const raw = runtimeInputs[nodeId];
          if (!raw) {
            throw new Error(`Arquivo de entrada não fornecido para o node '${node.data.label}'.`);
          }
          if (typeof (raw as NodeArtifactPayload).kind === 'string') {
            nodeOut = { out: raw as NodeArtifactPayload };
          } else if (raw instanceof Uint8Array) {
            const name = String(node.data.config?.fileName || 'input.bin');
            const outType = node.data.outputs[0]?.type || 'file';
            nodeOut = { out: createPayloadFromBytes(raw, name, outType) };
          } else {
            const f = raw as File | Blob;
            const bytes = new Uint8Array(await f.arrayBuffer());
            const name = (f as File).name || String(node.data.config?.fileName || 'input.bin');
            const outType = node.data.outputs[0]?.type || 'file';
            nodeOut = { out: createPayloadFromBytes(bytes, name, outType) };
          }
        } else if (node.data.kind === 'output') {
          const incoming = inputsByPort.in;
          if (!incoming) {
            throw new Error(`Node de saída '${node.data.label}' não recebeu arquivo conectado.`);
          }
          if (incoming.kind === 'batch' && incoming.batchItems) {
            const zipEntries: Record<string, Uint8Array> = {};
            for (let i = 0; i < incoming.batchItems.length; i++) {
              const item = incoming.batchItems[i];
              zipEntries[item.fileName || `item_${i}.bin`] = await artifactToBytes(item);
            }
            const zipBytes = zipSync(zipEntries, { level: 6 });
            const bundle = createPayloadFromBytes(zipBytes, `${node.id}_lote.zip`, 'file', {
              itemCount: incoming.batchItems.length,
            });
            bundle.batchItems = incoming.batchItems;
            nodeOut = { out: bundle };
            finalOutputs[nodeId] = bundle;
          } else {
            nodeOut = { out: incoming };
            finalOutputs[nodeId] = incoming;
          }
        } else if (node.data.kind === 'converter' || node.data.kind === 'ai') {
          const incoming = inputsByPort.in;
          const modId = node.data.moduleId;
          if (!modId) {
            throw new Error(`Módulo não configurado no node '${node.data.label}'.`);
          }
          const mod = getModuleById(modId);
          if (!mod) {
            throw new Error(`Módulo '${modId}' não encontrado no registro.`);
          }
          const bytes = incoming ? await artifactToBytes(incoming) : undefined;
          const targetFormat = node.data.targetFormat || '.png';
          const modifiers = {
            ...DEFAULT_CONVERSION_MODIFIERS,
            ...(node.data.config || {}),
          };
          const res = await mod.execute(
            {
              file: incoming?.file,
              fileData: bytes,
              originalName: incoming?.fileName || 'input.txt',
              targetFormat,
              options: modifiers,
              modifiers,
            },
            {
              workspacePath: `/sessions/${this.sessionId}/${executionId}/nodes/${nodeId}`,
              onProgress: ctx.onProgress,
              onLog: ctx.onLog,
            }
          );
          const outBytes = res.outputData
            ? (res.outputData as Uint8Array)
            : new Uint8Array(await (res.outputBlob as Blob).arrayBuffer());
          const outFileName = (res.outputFileName as string) || `output${targetFormat}`;
          const opfsPath = await ctx.writeOpfsArtifact(outFileName, outBytes);
          const outPort = node.data.outputs[0]?.id || 'out';
          const outType = node.data.outputs[0]?.type || 'file';
          const payload = createPayloadFromBytes(outBytes, outFileName, outType, {
            moduleId: modId,
            mimeType: (res.mimeType as string) || getMimeType(targetFormat),
          });
          if (opfsPath) payload.opfsPath = opfsPath;
          nodeOut = { [outPort]: payload };
        } else {
          const executor = MODULAR_NODE_EXECUTORS[node.data.kind];
          if (!executor) {
            throw new Error(`Executor não implementado para tipo de node '${node.data.kind}'.`);
          }
          nodeOut = await executor(inputsByPort, node.data.config || {}, ctx);
        }

        outputsByNode[nodeId] = nodeOut;
        for (const payload of Object.values(nodeOut)) {
          await computePayloadHash(payload);
        }
        this.cache.set(nodeId, { cacheKey, outputsByPort: nodeOut });
        executedNodeIds.push(nodeId);
        callbacks.onNodeStatus?.(nodeId, 'done', 100, 'Concluído');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        callbacks.onNodeStatus?.(nodeId, 'error', 0, msg);
        throw err;
      }
    }

    return {
      executionId,
      nodeOutputs: outputsByNode,
      finalOutputs,
      cachedNodeIds,
      executedNodeIds,
    };
  }
}

export function exportFtGraph(
  name: string,
  nodes: GraphNodeInstance[],
  edges: GraphEdgeInstance[],
  viewport = { x: 0, y: 0, zoom: 1 }
): FtGraphDocument {
  const sanitizedNodes: GraphNodeInstance[] = nodes.map((n) => ({
    id: n.id,
    type: n.type || 'customNode',
    position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
    data: {
      kind: n.data.kind,
      label: n.data.label,
      description: n.data.description,
      moduleId: n.data.moduleId,
      targetFormat: n.data.targetFormat,
      config: { ...(n.data.config || {}) },
      inputs: n.data.inputs,
      outputs: n.data.outputs,
    },
  }));

  const sanitizedEdges: GraphEdgeInstance[] = edges.map((e) => ({
    id: e.id,
    source: e.source,
    sourceHandle: e.sourceHandle,
    target: e.target,
    targetHandle: e.targetHandle,
  }));

  return {
    version: '1.0.0',
    metadata: {
      name: name.trim() || 'Pipeline FileTools',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    nodes: sanitizedNodes,
    edges: sanitizedEdges,
    viewport,
  };
}

export function importFtGraph(json: string): FtGraphDocument {
  const parsed = JSON.parse(json) as Partial<FtGraphDocument>;
  if (!parsed || parsed.version !== '1.0.0' || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
    throw new Error('Arquivo .ftgraph inválido ou versão incompatível.');
  }
  return parsed as FtGraphDocument;
}
