import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Play,
  Square,
  Download,
  Upload,
  Plus,
  Trash2,
  Workflow,
  Sparkles,
  FileUp,
  CheckCircle2,
  AlertCircle,
  Loader2,
  DatabaseZap,
} from 'lucide-react';
import { Button, Card, Badge, Typography } from '@/ui/components/core';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/formats';
import {
  GraphEngine,
  exportFtGraph,
  importFtGraph,
} from '@/core/graph/GraphEngine';
import { validateConnection } from '@/core/graph/GraphValidator';
import type {
  GraphEdgeInstance,
  GraphNodeData,
  GraphNodeInstance,
  NodeArtifactPayload,
  NodeRunStatus,
  PortDataType,
} from '@/core/graph/types';
import {
  GRAPH_TEMPLATES,
  NODE_PALETTE_PRESETS,
} from '@/modules/nodes';
import { getAllManifests } from '@/modules/registry';

type FlowNodeData = GraphNodeData & Record<string, unknown>;
type FlowNode = Node<FlowNodeData>;

interface RuntimeContextValue {
  filesByNode: Record<string, File>;
  outputsByNode: Record<string, Record<string, NodeArtifactPayload>>;
  statusByNode: Record<string, { status: NodeRunStatus; progress: number; message?: string }>;
  onSelectFile: (nodeId: string, file: File) => void;
  onUpdateConfig: (nodeId: string, patch: Partial<GraphNodeData>) => void;
  onDeleteNode: (nodeId: string) => void;
}

const NodeRuntimeCtx = createContext<RuntimeContextValue>({
  filesByNode: {},
  outputsByNode: {},
  statusByNode: {},
  onSelectFile: () => {},
  onUpdateConfig: () => {},
  onDeleteNode: () => {},
});

const PORT_COLOR_MAP: Record<PortDataType, string> = {
  file: '#94a3b8',
  video: '#38bdf8',
  audio: '#f59e0b',
  image: '#10b981',
  batch: '#a855f7',
  subtitle: '#ec4899',
  text: '#60a5fa',
  number: '#eab308',
  boolean: '#22c55e',
};

function CustomPipelineNode({ id, data }: NodeProps<FlowNode>) {
  const {
    filesByNode,
    outputsByNode,
    statusByNode,
    onSelectFile,
    onUpdateConfig,
    onDeleteNode,
  } = useContext(NodeRuntimeCtx);

  const st = statusByNode[id];
  const nodeOutputMap = outputsByNode[id];
  const firstOutput = nodeOutputMap ? Object.values(nodeOutputMap)[0] : undefined;
  const attachedFile = filesByNode[id];
  const allManifests = useMemo(() => getAllManifests(), []);

  const downloadOutput = () => {
    if (!firstOutput) return;
    const blob =
      firstOutput.file instanceof Blob
        ? firstOutput.file
        : new Blob([(firstOutput.data || new Uint8Array()).buffer as unknown as BlobPart], {
            type: firstOutput.mimeType,
          });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = firstOutput.fileName || 'pipeline_output';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div
      className={cn(
        'min-w-[235px] max-w-[270px] rounded-md border bg-surface text-foreground shadow-md transition-colors',
        st?.status === 'running' && 'border-primary ring-1 ring-primary/40',
        st?.status === 'done' && 'border-emerald-500/70',
        st?.status === 'cached' && 'border-sky-500/60',
        st?.status === 'error' && 'border-destructive',
        !st && 'border-border'
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-raised px-2.5 py-1.5 rounded-t-md">
        <div className="flex items-center gap-1.5 min-w-0">
          {data.kind === 'ai' && <Sparkles className="size-3.5 text-primary shrink-0" />}
          <span className="truncate text-[12px] font-semibold">{data.label}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {st?.status === 'running' && <Loader2 className="size-3.5 animate-spin text-primary" />}
          {st?.status === 'done' && <CheckCircle2 className="size-3.5 text-emerald-400" />}
          {st?.status === 'cached' && <DatabaseZap className="size-3.5 text-sky-400" />}
          {st?.status === 'error' && <AlertCircle className="size-3.5 text-destructive" />}
          <button
            type="button"
            onClick={() => onDeleteNode(id)}
            className="text-muted-foreground hover:text-destructive transition-colors"
            title="Remover node"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>

      <div className="p-2.5 space-y-2 text-[11px]">
        {data.inputs.length > 0 && (
          <div className="space-y-1">
            {data.inputs.map((port) => (
              <div key={port.id} className="relative flex items-center pl-2">
                <Handle
                  type="target"
                  position={Position.Left}
                  id={port.id}
                  style={{
                    background: PORT_COLOR_MAP[port.type] || '#94a3b8',
                    width: 10,
                    height: 10,
                    left: -15,
                  }}
                />
                <span className="text-muted-foreground">
                  {port.label}{' '}
                  <span className="font-mono text-[9px] opacity-75">({port.type})</span>
                </span>
              </div>
            ))}
          </div>
        )}

        {data.kind === 'input' && (
          <label className="flex flex-col gap-1 cursor-pointer rounded border border-dashed border-border p-1.5 hover:border-primary/60">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <FileUp className="size-3.5 text-primary shrink-0" />
              <span className="truncate font-medium text-foreground">
                {attachedFile ? attachedFile.name : 'Selecionar arquivo...'}
              </span>
            </div>
            {attachedFile && (
              <span className="font-mono text-[10px] text-muted-foreground">
                {formatBytes(attachedFile.size)}
              </span>
            )}
            <input
              type="file"
              accept={(data.config?.accept as string) || undefined}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onSelectFile(id, f);
              }}
            />
          </label>
        )}

        {(data.kind === 'converter' || data.kind === 'ai' || data.kind === 'batch-processor') && (
          <div className="space-y-1.5 nodrag">
            <select
              value={data.moduleId || ''}
              onChange={(e) =>
                onUpdateConfig(id, {
                  moduleId: e.target.value,
                  config: { ...(data.config || {}), moduleId: e.target.value },
                })
              }
              className="w-full rounded border border-border bg-surface-raised px-1.5 py-1 text-[11px]"
            >
              {allManifests
                .filter((m) => (data.kind === 'ai' ? m.category === 'ai' : data.kind === 'converter' ? m.category !== 'ai' : true))
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Saída:</span>
              <input
                type="text"
                value={data.targetFormat || '.png'}
                onChange={(e) =>
                  onUpdateConfig(id, {
                    targetFormat: e.target.value,
                    config: { ...(data.config || {}), targetFormat: e.target.value },
                  })
                }
                className="w-20 rounded border border-border bg-surface-raised px-1.5 py-0.5 font-mono text-[11px]"
              />
            </div>
          </div>
        )}

        {data.kind === 'periodic-overlay' && (
          <div className="grid grid-cols-2 gap-1.5 nodrag">
            <label className="text-[10px] text-muted-foreground">
              Intervalo (s)
              <input
                type="number"
                min={0.5}
                step={0.5}
                value={Number(data.config?.intervalSeconds ?? 5)}
                onChange={(e) =>
                  onUpdateConfig(id, {
                    config: { ...(data.config || {}), intervalSeconds: Number(e.target.value) },
                  })
                }
                className="mt-0.5 w-full rounded border border-border bg-surface-raised px-1.5 py-0.5 text-[11px] text-foreground"
              />
            </label>
            <label className="text-[10px] text-muted-foreground">
              Duração (s)
              <input
                type="number"
                min={0.2}
                step={0.2}
                value={Number(data.config?.durationSeconds ?? 1)}
                onChange={(e) =>
                  onUpdateConfig(id, {
                    config: { ...(data.config || {}), durationSeconds: Number(e.target.value) },
                  })
                }
                className="mt-0.5 w-full rounded border border-border bg-surface-raised px-1.5 py-0.5 text-[11px] text-foreground"
              />
            </label>
          </div>
        )}

        {(data.kind === 'video-to-frames' || data.kind === 'frames-to-video') && (
          <div className="flex items-center justify-between gap-2 nodrag">
            <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
              FPS:
              <input
                type="number"
                min={1}
                max={30}
                value={Number(data.config?.fps ?? 2)}
                onChange={(e) =>
                  onUpdateConfig(id, {
                    config: { ...(data.config || {}), fps: Number(e.target.value) },
                  })
                }
                className="w-14 rounded border border-border bg-surface-raised px-1 py-0.5 text-[11px] text-foreground"
              />
            </label>
            {data.kind === 'frames-to-video' && (
              <select
                value={String(data.config?.targetFormat || data.targetFormat || '.mp4')}
                onChange={(e) =>
                  onUpdateConfig(id, {
                    targetFormat: e.target.value,
                    config: { ...(data.config || {}), targetFormat: e.target.value },
                  })
                }
                className="rounded border border-border bg-surface-raised px-1 py-0.5 font-mono text-[10px]"
              >
                <option value=".mp4">.mp4</option>
                <option value=".gif">.gif</option>
              </select>
            )}
          </div>
        )}

        {data.outputs.length > 0 && (
          <div className="space-y-1 pt-0.5">
            {data.outputs.map((port) => (
              <div key={port.id} className="relative flex items-center justify-end pr-2">
                <span className="text-muted-foreground">
                  <span className="font-mono text-[9px] opacity-75">({port.type})</span>{' '}
                  {port.label}
                </span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={port.id}
                  style={{
                    background: PORT_COLOR_MAP[port.type] || '#94a3b8',
                    width: 10,
                    height: 10,
                    right: -15,
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {st && (
          <div className="pt-1 border-t border-border/60 space-y-1">
            {st.status === 'running' && (
              <div className="h-1 w-full overflow-hidden rounded-full bg-surface-raised">
                <div className="h-full bg-primary transition-all" style={{ width: `${st.progress}%` }} />
              </div>
            )}
            {st.message && (
              <div className="truncate text-[10px] text-muted-foreground" title={st.message}>
                {st.message}
              </div>
            )}
          </div>
        )}

        {firstOutput && (
          <Button
            size="sm"
            variant={data.kind === 'output' ? 'primary' : 'secondary'}
            onClick={downloadOutput}
            leftIcon={<Download className="size-3" />}
            className="w-full h-7 text-[11px]"
          >
            {firstOutput.kind === 'batch'
              ? `Lote (${firstOutput.batchItems?.length || 0} arquivos)`
              : `Baixar ${firstOutput.fileName}`}
          </Button>
        )}
      </div>
    </div>
  );
}

const nodeTypes = { customNode: CustomPipelineNode };

function docToFlow(templateIndex = 0) {
  const doc = GRAPH_TEMPLATES[templateIndex].graph;
  const flowNodes: FlowNode[] = doc.nodes.map((n) => ({
    id: n.id,
    type: 'customNode',
    position: n.position,
    data: { ...n.data } as FlowNodeData,
  }));
  const flowEdges: Edge[] = doc.edges.map((e) => ({
    id: e.id,
    source: e.source,
    sourceHandle: e.sourceHandle,
    target: e.target,
    targetHandle: e.targetHandle,
    animated: true,
  }));
  return { name: doc.metadata.name, flowNodes, flowEdges };
}

export function NodeEditorWorkspace() {
  const initial = useMemo(() => docToFlow(0), []);
  const [graphName, setGraphName] = useState(initial.name);
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(initial.flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.flowEdges);

  const [filesByNode, setFilesByNode] = useState<Record<string, File>>({});
  const [outputsByNode, setOutputsByNode] = useState<Record<string, Record<string, NodeArtifactPayload>>>({});
  const [statusByNode, setStatusByNode] = useState<Record<string, { status: NodeRunStatus; progress: number; message?: string }>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const engineRef = useRef<GraphEngine>(new GraphEngine());
  const abortRef = useRef<AbortController | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const toDomainNodes = useCallback(
    (list: FlowNode[]): GraphNodeInstance[] =>
      list.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
    []
  );

  const toDomainEdges = useCallback(
    (list: Edge[]): GraphEdgeInstance[] =>
      list.map((e) => ({
        id: e.id,
        source: e.source,
        sourceHandle: e.sourceHandle || 'out',
        target: e.target,
        targetHandle: e.targetHandle || 'in',
      })),
    []
  );

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;
      const check = validateConnection(
        {
          source: params.source,
          sourceHandle: params.sourceHandle || 'out',
          target: params.target,
          targetHandle: params.targetHandle || 'in',
        },
        toDomainNodes(nodes),
        toDomainEdges(edges)
      );

      if (!check.valid) {
        setBannerError(check.reason || 'Conexão inválida entre portas.');
        return;
      }

      setBannerError(null);
      setEdges((eds) => addEdge({ ...params, animated: true }, eds));
    },
    [nodes, edges, setEdges, toDomainNodes, toDomainEdges]
  );

  const onSelectFile = useCallback((nodeId: string, file: File) => {
    setFilesByNode((prev) => ({ ...prev, [nodeId]: file }));
  }, []);

  const onUpdateConfig = useCallback(
    (nodeId: string, patch: Partial<GraphNodeData>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, ...patch } as FlowNodeData } : n
        )
      );
    },
    [setNodes]
  );

  const onDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    },
    [setNodes, setEdges]
  );

  function loadTemplate(templateId: string) {
    const idx = GRAPH_TEMPLATES.findIndex((t) => t.id === templateId);
    if (idx < 0) return;
    const loaded = docToFlow(idx);
    setGraphName(loaded.name);
    setNodes(loaded.flowNodes);
    setEdges(loaded.flowEdges);
    setFilesByNode({});
    setOutputsByNode({});
    setStatusByNode({});
    setBannerError(null);
    engineRef.current.clearCache();
  }

  function addPaletteNode(kind: string) {
    const preset = NODE_PALETTE_PRESETS.find((p) => p.kind === kind);
    if (!preset) return;
    const newId = `${kind}_${Date.now().toString(36).slice(-4)}`;
    const newNode: FlowNode = {
      id: newId,
      type: 'customNode',
      position: { x: 180 + (nodes.length % 4) * 70, y: 90 + (nodes.length % 4) * 55 },
      data: { ...preset.createData() } as FlowNodeData,
    };
    setNodes((nds) => [...nds, newNode]);
  }

  async function executePipeline() {
    setBannerError(null);
    setIsRunning(true);
    setLogs([]);
    setStatusByNode({});
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const result = await engineRef.current.executeGraph(
        toDomainNodes(nodes),
        toDomainEdges(edges),
        filesByNode,
        {
          onNodeStatus: (nodeId, status, progress = 0, message) => {
            setStatusByNode((prev) => ({ ...prev, [nodeId]: { status, progress, message } }));
          },
          onLog: (nodeId, msg) => {
            setLogs((prev) => [...prev.slice(-80), `[${nodeId}] ${msg}`]);
          },
        },
        ctrl.signal
      );
      setOutputsByNode(result.nodeOutputs);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
  }

  function handleExportGraph() {
    const doc = exportFtGraph(graphName, toDomainNodes(nodes), toDomainEdges(edges));
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${graphName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.ftgraph`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function handleImportGraph(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const doc = importFtGraph(text);
      setGraphName(doc.metadata.name);
      setNodes(
        doc.nodes.map((n) => ({
          id: n.id,
          type: 'customNode',
          position: n.position,
          data: { ...n.data } as FlowNodeData,
        }))
      );
      setEdges(
        doc.edges.map((ed) => ({
          id: ed.id,
          source: ed.source,
          sourceHandle: ed.sourceHandle,
          target: ed.target,
          targetHandle: ed.targetHandle,
          animated: true,
        }))
      );
      setOutputsByNode({});
      setStatusByNode({});
      setBannerError(null);
      engineRef.current.clearCache();
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : String(err));
    } finally {
      e.target.value = '';
    }
  }

  const runtimeValue = useMemo(
    () => ({
      filesByNode,
      outputsByNode,
      statusByNode,
      onSelectFile,
      onUpdateConfig,
      onDeleteNode,
    }),
    [filesByNode, outputsByNode, statusByNode, onSelectFile, onUpdateConfig, onDeleteNode]
  );

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Workflow className="size-4 text-primary" />
            <Typography variant="h1" as="h1">
              Editor Visual Baseado em Nodes
            </Typography>
          </div>
          <Typography variant="caption" color="muted" className="mt-0.5 block">
            Conecte conversores WASM, composição temporal de vídeo, processamento em lote e IAs locais em DAGs modulares.
          </Typography>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Carregar template"
            onChange={(e) => e.target.value && loadTemplate(e.target.value)}
            defaultValue=""
            className="h-8 rounded-md border border-border bg-surface px-2.5 text-[12px] text-foreground"
          >
            <option value="" disabled>Templates prontos...</option>
            {GRAPH_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Download className="size-3.5" />}
            onClick={handleExportGraph}
          >
            Exportar .ftgraph
          </Button>

          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Upload className="size-3.5" />}
            onClick={() => importInputRef.current?.click()}
          >
            Importar
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept=".ftgraph,.json"
            onChange={handleImportGraph}
            className="hidden"
          />

          {isRunning ? (
            <Button
              size="sm"
              variant="destructive"
              leftIcon={<Square className="size-3.5" />}
              onClick={() => abortRef.current?.abort()}
            >
              Parar
            </Button>
          ) : (
            <Button
              size="sm"
              variant="primary"
              leftIcon={<Play className="size-3.5" />}
              onClick={executePipeline}
            >
              Executar Grafo
            </Button>
          )}
        </div>
      </header>

      {bannerError && (
        <Card variant="alert-destructive" className="p-2.5 flex items-center justify-between gap-2">
          <Typography variant="caption" color="destructive">
            {bannerError}
          </Typography>
          <button
            type="button"
            onClick={() => setBannerError(null)}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            Fechar
          </button>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <Card variant="raised" className="lg:col-span-3 p-3 space-y-2 max-h-[620px] overflow-y-auto">
          <div className="flex items-center justify-between">
            <Typography variant="h3">Paleta de Nodes</Typography>
            <Badge size="sm" variant="outline">{nodes.length} nodes</Badge>
          </div>
          <div className="grid gap-1.5">
            {NODE_PALETTE_PRESETS.map((preset) => (
              <button
                key={preset.kind}
                type="button"
                onClick={() => addPaletteNode(preset.kind)}
                className="text-left rounded border border-border bg-surface p-2 hover:border-primary/50 hover:bg-surface-raised transition-colors"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[12px] font-medium text-foreground">{preset.title}</span>
                  <Plus className="size-3.5 text-primary shrink-0" />
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                  {preset.description}
                </p>
              </button>
            ))}
          </div>
        </Card>

        <div className="lg:col-span-9 h-[620px] rounded-md border border-border bg-background overflow-hidden">
          <NodeRuntimeCtx.Provider value={runtimeValue}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              fitView
            >
              <Background gap={18} size={1} />
              <Controls />
              <MiniMap pannable zoomable />
            </ReactFlow>
          </NodeRuntimeCtx.Provider>
        </div>
      </div>

      {logs.length > 0 && (
        <div className="rounded-md border border-border bg-black/75 p-2.5 font-mono text-[11px] text-zinc-300 max-h-32 overflow-y-auto">
          {logs.map((l, idx) => (
            <div key={idx}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}
