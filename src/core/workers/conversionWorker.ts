import * as Comlink from 'comlink';
import type { ExecutionContext } from '../../shared/types/module';
import { getModuleById } from '../../modules/registry';

export interface ConversionWorkerAPI {
  ping: () => string;
  executeTask: (
    moduleId: string,
    inputs: Record<string, unknown>,
    workspacePath: string,
    onProgress: (percent: number, message?: string) => void,
    onLog: (message: string) => void
  ) => Promise<Record<string, unknown>>;
}

const workerAPI: ConversionWorkerAPI = {
  ping: () => 'pong',

  executeTask: async (moduleId, inputs, workspacePath, onProgress, onLog) => {
    const module = getModuleById(moduleId);
    
    if (!module) {
      throw new Error(`Module with ID '${moduleId}' not found in registry.`);
    }

    const context: ExecutionContext = {
      workspacePath,
      onProgress,
      onLog,
    };

    context.onLog(`[Worker] Started task for module: ${module.manifest.name}`);
    
    try {
      const result = await module.execute(inputs, context);
      context.onLog(`[Worker] Finished task successfully.`);
      return result;
    } catch (err) {
      context.onLog(`[Worker] Failed task: ${err}`);
      throw err;
    }
  },
};

Comlink.expose(workerAPI);
