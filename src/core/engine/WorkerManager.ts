/**
 * src/core/engine/WorkerManager.ts
 *
 * The main Orchestrator (Singleton).
 * Manages the lifecycle of conversion tasks, interacts with OPFS,
 * and communicates with the Web Worker via Comlink.
 *
 * IMPORTANT: Modules in MAIN_THREAD_MODULES execute directly on the main thread
 * because they manage their own internal Web Workers or require window APIs (WebCodecs).
 *
 * Source of truth: docs/protocols/module-contract.md § 4
 */
import * as Comlink from 'comlink';
import { OPFSManager } from '../fs/OPFSManager';
import type { ConversionWorkerAPI } from '../workers/conversionWorker';
import type { ExecutionContext } from '@/shared/types/module';
import { getModuleById } from '@/modules/registry';

/** Modules that spawn their own workers or use native window APIs */
const MAIN_THREAD_MODULES = new Set(['ffmpeg-core', 'ffmpeg-core-mt', 'stream-copy', 'mp4box', 'mp4-muxer', 'webm-muxer']);

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
      await this.initialize();
    }

    const hasSpace = await OPFSManager.checkQuota(500 * 1024 * 1024);
    if (!hasSpace) {
      throw new Error('Espaço insuficiente no Origin Private File System.');
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

      // Execute explicitly on the requested engine (no automatic fallback)
      if (MAIN_THREAD_MODULES.has(moduleId)) {
        return await this.executeOnMainThread(moduleId, inputs, context);
      } else {
        return await this.executeOnWorker(moduleId, inputs, context);
      }
    } catch (err) {
      console.error(`[WorkerManager] Tarefa ${taskId} falhou com módulo '${moduleId}':`, err);
      throw err;
    } finally {
      await OPFSManager.cleanupWorkspace(this.sessionId, taskId);
    }
  }

  /**
   * Execute module directly on the main thread.
   */
  private async executeOnMainThread(
    moduleId: string,
    inputs: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<Record<string, unknown>> {
    const module = getModuleById(moduleId);
    if (!module) {
      throw new Error(`Módulo '${moduleId}' não encontrado no registro.`);
    }

    context.onLog(`[WorkerManager] Executando ${module.manifest.name} no thread principal`);
    return await module.execute(inputs, context);
  }

  /**
   * Execute module via our Comlink Web Worker.
   */
  private async executeOnWorker(
    moduleId: string,
    inputs: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<Record<string, unknown>> {
    if (!this.workerAPI) {
      throw new Error('Worker API não está disponível.');
    }

    return await this.workerAPI.executeTask(
      moduleId,
      inputs,
      context.workspacePath,
      Comlink.proxy(context.onProgress),
      Comlink.proxy(context.onLog)
    );
  }
}

