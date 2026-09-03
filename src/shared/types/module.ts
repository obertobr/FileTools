/**
 * src/shared/types/module.ts
 *
 * Core type contracts for the FileTools module system.
 * These types define the "IModule" interface that every conversion engine must implement.
 * They are designed to support the future Nodes/Graph system.
 *
 * ⚠️  DO NOT MODIFY without updating all module implementations.
 *
 * Source of truth: docs/ARCHITECTURE.MD § 3.1
 */

export type DataType = 'file_handle' | 'string' | 'number' | 'boolean' | 'enum';

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

export interface IModule {
  manifest: ModuleManifest;
  execute: (
    inputs: Record<string, unknown>,
    context: ExecutionContext,
  ) => Promise<Record<string, unknown>>;
}
