/**
 * src/core/engine/WorkerManager.ts
 *
 * The main Orchestrator (Singleton).
 * Manages the lifecycle of conversion tasks, interacts with OPFS,
 * and communicates with the Web Worker via Comlink.
 */
import * as Comlink from 'comlink';
import { OPFSManager } from '../fs/OPFSManager';
import type { ConversionWorkerAPI } from '../workers/conversionWorker';
import type { ExecutionContext } from '@/shared/types/module';

export class WorkerManager {
  private static instance: WorkerManager;
  private sessionId: string;
  private worker: Worker | null = null;
  private workerAPI: Comlink.Remote<ConversionWorkerAPI> | null = null;
  private initialized = false;

  private constructor() {
    // Generate a unique session ID for the current browser tab lifecycle
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  public static getInstance(): WorkerManager {
    if (!WorkerManager.instance) {
      WorkerManager.instance = new WorkerManager();
    }
    return WorkerManager.instance;
  }

  /**
   * Initializes the manager. Should be called when the app shell mounts.
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;

    // 1. Initialize OPFS (Janitor cleans up old sessions)
    await OPFSManager.initialize(this.sessionId);

    // 2. Spawn the Web Worker
    this.worker = new Worker(new URL('../workers/conversionWorker.ts', import.meta.url), {
      type: 'module',
    });
    
    // 3. Wrap with Comlink
    this.workerAPI = Comlink.wrap<ConversionWorkerAPI>(this.worker);

    // 4. Test connection
    const response = await this.workerAPI.ping();
    console.debug(`[WorkerManager] Worker connected: ${response}`);

    this.initialized = true;
  }

  /**
   * Executes a conversion task.
   */
  public async convert(
    moduleId: string,
    inputs: Record<string, unknown>, // usually references to filenames
    onProgress: (percent: number, message?: string) => void,
    onLog: (message: string) => void
  ): Promise<Record<string, unknown>> {
    if (!this.initialized || !this.workerAPI) {
      throw new Error('WorkerManager is not initialized.');
    }

    // Check OPFS Quota (e.g., require at least 500MB free for safety)
    const hasSpace = await OPFSManager.checkQuota(500 * 1024 * 1024);
    if (!hasSpace) {
      throw new Error('Insufficient storage space in Origin Private File System.');
    }

    const taskId = `task_${Date.now()}`;
    const workspacePath = `${this.sessionId}/${taskId}`;

    try {
      // 1. Create OPFS Workspace
      await OPFSManager.createWorkspace(this.sessionId, taskId);
      
      // Note: User files (from drag & drop) should be written to this workspace
      // by the UI layer *before* calling convert, OR we can pass File objects
      // here and write them. For now, we assume inputs contains what the module needs.

      // 2. Prepare context with Comlink Proxy for callbacks
      const context: ExecutionContext = {
        workspacePath,
        onProgress: Comlink.proxy(onProgress),
        onLog: Comlink.proxy(onLog),
      };

      // 3. Execute task in Worker
      const result = await this.workerAPI.executeTask(moduleId, inputs, context);
      
      return result;
    } catch (err) {
      console.error(`[WorkerManager] Task ${taskId} failed:`, err);
      throw err;
    } finally {
      // 4. Clean up OPFS Workspace
      await OPFSManager.cleanupWorkspace(this.sessionId, taskId);
    }
  }
}
