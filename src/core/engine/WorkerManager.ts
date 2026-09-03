/**
 * src/core/engine/WorkerManager.ts
 *
 * The main Orchestrator (Singleton).
 * Manages the lifecycle of conversion tasks, interacts with OPFS,
 * and communicates with the Web Worker via Comlink.
 *
 * IMPORTANT: Some modules like FFmpeg create their own internal workers.
 * For these modules, we execute directly on the main thread instead of
 * going through our Comlink worker (which would be a worker-in-worker scenario).
 */
import * as Comlink from 'comlink';
import { OPFSManager } from '../fs/OPFSManager';
import type { ConversionWorkerAPI } from '../workers/conversionWorker';
import type { ExecutionContext } from '@/shared/types/module';
import { getModuleById } from '@/modules/registry';

/** Modules that spawn their own workers and must run on the main thread */
const MAIN_THREAD_MODULES = new Set(['ffmpeg-core']);

export class WorkerManager {
  private static instance: WorkerManager;
  private sessionId: string;
  private worker: Worker | null = null;
  private workerAPI: Comlink.Remote<ConversionWorkerAPI> | null = null;
  private initialized = false;

  private constructor() {
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  public static getInstance(): WorkerManager {
    if (!WorkerManager.instance) {
      WorkerManager.instance = new WorkerManager();
    }
    return WorkerManager.instance;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    await OPFSManager.initialize(this.sessionId);

    this.worker = new Worker(new URL('../workers/conversionWorker.ts', import.meta.url), {
      type: 'module',
    });
    
    this.workerAPI = Comlink.wrap<ConversionWorkerAPI>(this.worker);

    const response = await this.workerAPI.ping();
    console.debug(`[WorkerManager] Worker connected: ${response}`);

    this.initialized = true;
  }

  public async convert(
    moduleId: string,
    inputs: Record<string, unknown>,
    onProgress: (percent: number, message?: string) => void,
    onLog: (message: string) => void
  ): Promise<Record<string, unknown>> {
    if (!this.initialized) {
      throw new Error('WorkerManager is not initialized.');
    }

    const hasSpace = await OPFSManager.checkQuota(500 * 1024 * 1024);
    if (!hasSpace) {
      throw new Error('Insufficient storage space in Origin Private File System.');
    }

    const taskId = `task_${Date.now()}`;
    const workspacePath = `${this.sessionId}/${taskId}`;

    try {
      await OPFSManager.createWorkspace(this.sessionId, taskId);

      const context: ExecutionContext = {
        workspacePath,
        onProgress,
        onLog,
      };

      // Decide execution path based on module type
      if (MAIN_THREAD_MODULES.has(moduleId)) {
        // Execute directly on main thread (module has its own worker)
        return await this.executeOnMainThread(moduleId, inputs, context);
      } else {
        // Execute via our Comlink worker
        return await this.executeOnWorker(moduleId, inputs, context);
      }
    } catch (err) {
      console.error(`[WorkerManager] Task ${taskId} failed:`, err);
      throw err;
    } finally {
      await OPFSManager.cleanupWorkspace(this.sessionId, taskId);
    }
  }

  /**
   * Execute module directly on the main thread.
   * Used for modules like FFmpeg that create their own internal workers.
   */
  private async executeOnMainThread(
    moduleId: string,
    inputs: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<Record<string, unknown>> {
    const module = getModuleById(moduleId);
    if (!module) {
      throw new Error(`Module '${moduleId}' not found in registry.`);
    }

    context.onLog(`[WorkerManager] Executing ${module.manifest.name} on main thread`);
    return await module.execute(inputs, context);
  }

  /**
   * Execute module via our Comlink Web Worker.
   * Used for lighter modules that don't need their own worker.
   */
  private async executeOnWorker(
    moduleId: string,
    inputs: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<Record<string, unknown>> {
    if (!this.workerAPI) {
      throw new Error('Worker API is not available.');
    }

    const proxyContext: ExecutionContext = {
      workspacePath: context.workspacePath,
      onProgress: Comlink.proxy(context.onProgress),
      onLog: Comlink.proxy(context.onLog),
    };

    return await this.workerAPI.executeTask(moduleId, inputs, proxyContext);
  }
}
