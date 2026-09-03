/**
 * src/shared/types/module.ts
 *
 * Core type contracts for the FileTools module system.
 * These types define the "IModule" interface that every conversion engine must implement.
 * They are designed to support the future Nodes/Graph system.
 *
 * Source of truth: docs/protocols/module-contract.md
 */

export type DataType = 'file_handle' | 'string' | 'number' | 'boolean' | 'enum';

export type AccelerationType = 'gpu' | 'cpu-multithread' | 'cpu-singlethread' | 'instant-copy';

export interface PortDefinition {
  id: string;
  name: string;
  type: DataType;
  required: boolean;
  /** Accepted MIME types or file extensions (e.g. 'video/*', '.mp4') */
  accepts?: string[];
  /** Enum options (for selects) */
  options?: string[];
  defaultValue?: unknown;
}

export interface ConversionRule {
  /** Source types: MIME wildcards (e.g. 'video/*') or extensions (e.g. '.docx') */
  from: string[];
  /** Output extensions (e.g. ['.mp4', '.mp3']) */
  to: string[];
  lossy?: boolean;
  /** Speed / performance score from 1 (slowest) to 100 (instant) for this specific conversion rule */
  speedScore?: number;
  /** Acceleration tier */
  acceleration?: AccelerationType;
  /** Brief description of performance and trade-offs */
  performanceNotes?: string;
}

export interface ModuleManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  category: 'video' | 'audio' | 'document' | 'image';
  /** Used for dynamic UI generation and SSG SEO route compilation */
  supportedConversions: ConversionRule[];
  inputs: PortDefinition[];
  outputs: PortDefinition[];
}

export interface ExecutionContext {
  onProgress: (percent: number, message?: string) => void;
  onLog: (message: string) => void;
  /** Isolated path in OPFS for this task: /opfs_root/sessions/{sessionId}/{taskId}/ */
  workspacePath: string;
}

export interface CapabilityCheckContext {
  sourceExt?: string;
  targetFormat?: string;
  mimeType?: string;
}

export interface IModule {
  manifest: ModuleManifest;
  /**
   * Optional capability probe.
   * Allows the engine to inspect client hardware, GPU codecs,
   * SharedArrayBuffer, etc., before declaring compatibility to the user.
   */
  isSupported?: (context?: CapabilityCheckContext) => Promise<boolean> | boolean;
  execute: (
    inputs: Record<string, unknown>,
    context: ExecutionContext,
  ) => Promise<Record<string, unknown>>;
}
