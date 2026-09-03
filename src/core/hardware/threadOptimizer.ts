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
    // VP8 with capped decoder threads (2 to 4) can safely utilize 2 to 4 encoder threads in WASM
    decoderThreads = userCap ? Math.min(userCap, 4) : Math.min(Math.max(2, Math.floor(logicalCores / 2)), 4);
    encoderThreads = userCap ? userCap : (logicalCores >= 8 ? 4 : 2);
    description = `VP8 Multi-Core Realtime (decodificador: ${decoderThreads} threads, codificador: ${encoderThreads} threads)`;
  } else if (to === '.mp4') {
    // libx264 supports slice-threading safely in WASM up to userCap or 8 threads on modern multi-core CPUs.
    decoderThreads = userCap ? Math.min(userCap, 4) : Math.min(Math.max(2, Math.floor(logicalCores / 2)), 4);
    encoderThreads = userCap ? userCap : Math.min(logicalCores, 8);
    description = `libx264 Multi-Core (decodificador: ${decoderThreads} threads, codificador: ${encoderThreads} threads)`;
  } else if (to === '.gif') {
    decoderThreads = userCap ? userCap : Math.min(logicalCores, 4);
    encoderThreads = userCap ? userCap : Math.min(logicalCores, 4);
    description = `Renderizador GIF Multi-Core (${encoderThreads} threads)`;
  } else {
    // Audio or general
    decoderThreads = userCap ? userCap : Math.min(logicalCores, 4);
    encoderThreads = userCap ? userCap : Math.min(logicalCores, 4);
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
