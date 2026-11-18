import type {
  GraphEdgeInstance,
  GraphNodeInstance,
  PortDataType,
} from './types';

const FILE_COMPATIBLE_TYPES = new Set<PortDataType>([
  'file',
  'video',
  'audio',
  'image',
  'subtitle',
  'text',
]);

export function isPortTypeCompatible(
  sourceType: PortDataType,
  targetType: PortDataType
): boolean {
  if (sourceType === targetType) return true;
  if (sourceType === 'batch' || targetType === 'batch') return false;
  if (sourceType === 'number' || targetType === 'number') return false;
  if (sourceType === 'boolean' || targetType === 'boolean') return false;

  if (sourceType === 'file' && FILE_COMPATIBLE_TYPES.has(targetType)) return true;
  if (targetType === 'file' && FILE_COMPATIBLE_TYPES.has(sourceType)) return true;
  return false;
}

export function detectGraphCycles(
  nodes: GraphNodeInstance[],
  edges: GraphEdgeInstance[]
): { hasCycle: boolean; cycleNodeIds: string[] } {
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    if (adj.has(e.source) && adj.has(e.target)) {
      adj.get(e.source)!.push(e.target);
    }
  }

  // 0 = unvisited, 1 = visiting, 2 = done
  const state = new Map<string, number>();
  const stack: string[] = [];
  let cycleNodes: string[] = [];

  function dfs(nodeId: string): boolean {
    state.set(nodeId, 1);
    stack.push(nodeId);

    for (const next of adj.get(nodeId) || []) {
      const st = state.get(next) || 0;
      if (st === 1) {
        const idx = stack.indexOf(next);
        cycleNodes = idx >= 0 ? stack.slice(idx) : [next, nodeId];
        return true;
      }
      if (st === 0 && dfs(next)) return true;
    }

    stack.pop();
    state.set(nodeId, 2);
    return false;
  }

  for (const n of nodes) {
    if ((state.get(n.id) || 0) === 0) {
      if (dfs(n.id)) {
        return { hasCycle: true, cycleNodeIds: cycleNodes };
      }
    }
  }

  return { hasCycle: false, cycleNodeIds: [] };
}

export function computeTopologicalOrder(
  nodes: GraphNodeInstance[],
  edges: GraphEdgeInstance[]
): string[] {
  const cycle = detectGraphCycles(nodes, edges);
  if (cycle.hasCycle) {
    throw new Error(
      `Ciclo detectado no grafo envolvendo os nodes: ${cycle.cycleNodeIds.join(' -> ')}`
    );
  }

  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const n of nodes) {
    inDegree.set(n.id, 0);
    adj.set(n.id, []);
  }

  for (const e of edges) {
    if (inDegree.has(e.target) && adj.has(e.source)) {
      adj.get(e.source)!.push(e.target);
      inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of adj.get(id) || []) {
      const nextDeg = (inDegree.get(next) || 0) - 1;
      inDegree.set(next, nextDeg);
      if (nextDeg === 0) queue.push(next);
    }
  }

  return order;
}

export function validateConnection(
  candidate: Omit<GraphEdgeInstance, 'id'>,
  nodes: GraphNodeInstance[],
  existingEdges: GraphEdgeInstance[]
): { valid: boolean; reason?: string } {
  if (candidate.source === candidate.target) {
    return { valid: false, reason: 'Não é permitido conectar um node a si mesmo.' };
  }

  const srcNode = nodes.find((n) => n.id === candidate.source);
  const dstNode = nodes.find((n) => n.id === candidate.target);
  if (!srcNode || !dstNode) {
    return { valid: false, reason: 'Node de origem ou destino inexistente.' };
  }

  const srcPort = srcNode.data.outputs.find((p) => p.id === candidate.sourceHandle);
  const dstPort = dstNode.data.inputs.find((p) => p.id === candidate.targetHandle);
  if (!srcPort || !dstPort) {
    return { valid: false, reason: 'Porta de conexão inválida.' };
  }

  if (!isPortTypeCompatible(srcPort.type, dstPort.type)) {
    return {
      valid: false,
      reason: `Tipos incompatíveis: saída '${srcPort.type}' não conecta em entrada '${dstPort.type}'.`,
    };
  }

  const hypothetical: GraphEdgeInstance[] = [
    ...existingEdges,
    { id: '__probe__', ...candidate },
  ];
  const cycle = detectGraphCycles(nodes, hypothetical);
  if (cycle.hasCycle) {
    return { valid: false, reason: 'Conexão rejeitada: criaria um ciclo no grafo DAG.' };
  }

  return { valid: true };
}
