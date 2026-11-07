/**
 * src/core/testing/productionRunner.ts
 *
 * Production-faithful Conversion Runner.
 * Executes conversions through the EXACT same pathway as the end user on the page:
 *   1. Instantiates a native browser File instance.
 *   2. Invokes WorkerManager (Singleton), creating an isolated OPFS workspace with quota check.
 *   3. Dispatches via Comlink Web Worker for worker modules, or Main Thread for MAIN_THREAD_MODULES.
 *   4. Validates the output through the 3-Layer Output Oracle.
 *   5. Automatically cleans up OPFS session directories.
 */

import { WorkerManager } from '@/core/engine/WorkerManager';
import type { ConversionModifiers } from '@/shared/types/conversionModifiers';
import { getMimeType } from '@/core/knowledge/mimeTypes';
import { validateOutput } from './oracle';
import type { OracleValidationResult, FailureLayer } from './types';

export interface ProductionRunParams {
  fileData: Uint8Array;
  originalName: string;
  toExt: string;
  engineId: string;
  modifiers?: ConversionModifiers;
  onProgress?: (percent: number, message?: string) => void;
  onLog?: (message: string) => void;
}

export interface ProductionRunResult {
  success: boolean;
  outputData?: Uint8Array;
  outputFileName?: string;
  mimeType?: string;
  outputSize?: number;
  oracleResult?: OracleValidationResult;
  failedLayer?: FailureLayer;
  error?: string;
  logs: string[];
}

export async function runProductionConversion(
  params: ProductionRunParams
): Promise<ProductionRunResult> {
  const { fileData, originalName, toExt, engineId, modifiers, onProgress, onLog } = params;
  const logs: string[] = [];

  const handleLog = (msg: string) => {
    logs.push(msg);
    if (onLog) onLog(msg);
  };

  const handleProgress = (p: number, msg?: string) => {
    if (onProgress) onProgress(p, msg);
  };

  const cleanToExt = toExt.toLowerCase().replace(/^\./, '');
  const inputExt = originalName.slice(originalName.lastIndexOf('.')).toLowerCase();
  const inputMime = getMimeType(inputExt);

  // 1. Construct real native browser File instance (mimics user dropzone upload)
  const file = new File([fileData], originalName, { type: inputMime });

  try {
    // 2. Initialize and invoke the actual production WorkerManager singleton
    const manager = WorkerManager.getInstance();
    await manager.initialize();

    handleLog(`[ProductionRunner] Executando ${engineId} via WorkerManager (OPFS + Threads)...`);

    const result = await manager.convert(
      engineId,
      {
        file,
        targetFormat: '.' + cleanToExt,
        originalName,
        options: modifiers,
        modifiers,
        userMaxThreads:
          modifiers?.threadsMode === 'custom'
            ? modifiers.customThreads ?? modifiers.userMaxThreads
            : undefined,
      },
      handleProgress,
      handleLog
    );

    if (!result || (!result.outputBlob && !result.outputData)) {
      return {
        success: false,
        failedLayer: 'EXECUTION',
        error: `O motor '${engineId}' finalizou sem erro, mas não retornou dados de saída (outputBlob/outputData nulo).`,
        logs: logs.slice(-10),
      };
    }

    // 3. Extract output bytes
    let outputData: Uint8Array;
    let mimeType = (result.mimeType as string) || getMimeType('.' + cleanToExt);
    const outputFileName = (result.outputFileName as string) || originalName.replace(/\.[^.]+$/, '') + '.' + cleanToExt;

    if (result.outputBlob instanceof Blob) {
      outputData = new Uint8Array(await result.outputBlob.arrayBuffer());
      if (result.outputBlob.type) mimeType = result.outputBlob.type;
    } else {
      outputData = result.outputData as Uint8Array;
    }

    if (outputData.byteLength === 0) {
      return {
        success: false,
        failedLayer: 1,
        error: `O arquivo de saída gerado pelo motor '${engineId}' possui 0 bytes.`,
        logs: logs.slice(-10),
      };
    }

    // 4. Run Deep 3-Layer Output Oracle
    const oracleResult = await validateOutput(
      outputData,
      cleanToExt,
      modifiers,
      mimeType,
      outputFileName
    );

    if (!oracleResult.valid) {
      let failedLayer: FailureLayer = 1;
      if (oracleResult.layer1.valid && !oracleResult.layer2.valid) {
        failedLayer = 2;
      } else if (oracleResult.layer1.valid && oracleResult.layer2.valid && !oracleResult.layer3.valid) {
        failedLayer = 3;
      }

      return {
        success: false,
        outputData,
        outputFileName,
        mimeType,
        outputSize: outputData.byteLength,
        oracleResult,
        failedLayer,
        error: oracleResult.error,
        logs: logs.slice(-10),
      };
    }

    return {
      success: true,
      outputData,
      outputFileName,
      mimeType,
      outputSize: outputData.byteLength,
      oracleResult,
      logs: logs.slice(-10),
    };
  } catch (err: any) {
    const errorMsg = err instanceof Error ? (err.stack || err.message) : String(err);
    return {
      success: false,
      failedLayer: 'EXECUTION',
      error: errorMsg,
      logs: logs.slice(-10),
    };
  }
}
