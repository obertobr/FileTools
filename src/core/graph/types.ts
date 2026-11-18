export type PortDataType =
  | 'file'
  | 'video'
  | 'audio'
  | 'image'
  | 'batch'
  | 'text'
  | 'subtitle'
  | 'number'
  | 'boolean';

export interface NodePortSchema {
  id: string;
  label: string;
  type: PortDataType;
  required?: boolean;
}

export type GraphNodeKind =
  | 'input'
  | 'output'
  | 'converter'
  | 'ai'
  | 'video-to-frames'
  | 'frames-to-video'
  | 'periodic-overlay'
  | 'burn-subtitles'
  | 'batch-processor';

export type NodeRunStatus = 'idle' | 'running' | 'cached' | 'done' | 'error';

export interface NodeArtifactPayload {
  kind: 'single' | 'batch';
  dataType: PortDataType;
  file?: File | Blob;
  data?: Uint8Array;
  fileName: string;
  mimeType: string;
  text?: string;
  opfsPath?: string;
  batchItems?: NodeArtifactPayload[];
  metadata?: Record<string, unknown>;
  hash?: string;
}

export interface GraphNodeData {
  kind: GraphNodeKind;
  label: string;
  description?: string;
  moduleId?: string;
  targetFormat?: string;
  config: Record<string, unknown>;
  inputs: NodePortSchema[];
  outputs: NodePortSchema[];
  status?: NodeRunStatus;
  progress?: number;
  statusMessage?: string;
  error?: string;
}

export interface GraphNodeInstance {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: GraphNodeData;
}

export interface GraphEdgeInstance {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
}

export interface FtGraphDocument {
  version: '1.0.0';
  metadata: {
    name: string;
    createdAt: string;
    updatedAt: string;
  };
  nodes: GraphNodeInstance[];
  edges: GraphEdgeInstance[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}

export interface NodeExecutionContext {
  sessionId: string;
  graphExecutionId: string;
  nodeId: string;
  signal: AbortSignal;
  onProgress: (progress: number, message?: string) => void;
  onLog: (message: string) => void;
  writeOpfsArtifact: (fileName: string, bytes: Uint8Array) => Promise<string | undefined>;
}

export type ModularNodeExecutor = (
  inputsByPort: Record<string, NodeArtifactPayload | undefined>,
  config: Record<string, unknown>,
  context: NodeExecutionContext
) => Promise<Record<string, NodeArtifactPayload>>;
