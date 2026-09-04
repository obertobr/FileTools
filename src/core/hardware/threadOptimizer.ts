/**
 * src/core/hardware/threadOptimizer.ts
 *
 * Detects client hardware capabilities (logical CPU cores, device memory)
 * and dynamically calculates the optimal thread allocation per codec
 * to maximize encoding speed while strictly respecting the 32-bit WASM memory ceiling.
 */

export interface ThreadProfile {
  logicalCores: number;
  deviceMemoryGb: number;
  decoderThreads: number;
  encoderThreads: number;
  description: string;
}

export interface ThreadOptimizerOptions {
  userMaxThreads?: number;
}

export function getOptimalThreadProfile(
  targetFormat: string,
  options?: ThreadOptimizerOptions
): ThreadProfile {
  const logicalCores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
  const deviceMemoryGb = typeof navigator !== 'undefined' && 'deviceMemory' in navigator
    ? (navigator as any).deviceMemory || 4
    : 4;

  const userCap = options?.userMaxThreads ? Math.max(1, Math.min(options.userMaxThreads, logicalCores)) : undefined;
  const to = targetFormat.toLowerCase();

  let decoderThreads: number;
  let encoderThreads: number;
  let description: string;

  if (to === '.webm') {
    // VP8 with capped decoder threads (1 to 2) can safely utilize 2 to 4 encoder threads in WASM
    decoderThreads = userCap ? Math.min(userCap, 2) : Math.min(Math.max(1, Math.floor(logicalCores / 4)), 2);
    encoderThreads = userCap ? Math.min(userCap, 4) : Math.min(logicalCores, 4);
    description = `VP8 Multi-Core Realtime (decodificador: ${decoderThreads} threads, codificador: ${encoderThreads} threads)`;
  } else if (to === '.mp4' || to === '.mkv' || to === '.mov' || to === '.ts') {
    // libx264 with slice-threading in 32-bit WASM runs safest and fastest capped at 4 threads, avoiding pthread pool starvation
    decoderThreads = userCap ? Math.min(userCap, 2) : Math.min(Math.max(1, Math.floor(logicalCores / 4)), 2);
    encoderThreads = userCap ? Math.min(userCap, 4) : Math.min(logicalCores, 4);
    description = `libx264 Slice-Threaded Multi-Core (decodificador: ${decoderThreads} threads, codificador: ${encoderThreads} threads)`;
  } else if (to === '.gif') {
    decoderThreads = userCap ? Math.min(userCap, 2) : Math.min(logicalCores, 2);
    encoderThreads = userCap ? Math.min(userCap, 4) : Math.min(logicalCores, 4);
    description = `Renderizador GIF Multi-Core (${encoderThreads} threads)`;
  } else {
    // Audio or general
    decoderThreads = userCap ? Math.min(userCap, 2) : Math.min(logicalCores, 2);
    encoderThreads = userCap ? Math.min(userCap, 4) : Math.min(logicalCores, 4);
    description = `Multi-Core Geral (${encoderThreads} threads)`;
  }

  return {
    logicalCores,
    deviceMemoryGb,
    decoderThreads,
    encoderThreads,
    description,
  };
}
