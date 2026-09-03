/**
 * src/modules/ffmpeg-mt.ts
 *
 * FFmpeg Multi-Threaded WASM conversion engine.
 * Uses @ffmpeg/ffmpeg + @ffmpeg/core-mt with Web Workers and pthreads
 * to leverage CPU cores via SharedArrayBuffer.
 *
 * Integrates dynamic hardware thread optimization (threadOptimizer.ts)
 * and real-time percentage progress calculation from media duration.
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import type { IModule, ExecutionContext } from '@/shared/types/module';
import { getOptimalThreadProfile, type ThreadProfile } from '@/core/hardware/threadOptimizer';

let ffmpegMtInstance: FFmpeg | null = null;
let ffmpegMtLoaded = false;
let currentContext: ExecutionContext | null = null;

// Track active conversion metrics
let currentTotalDuration = 0;
let currentSpeed = '';

export function resetFFmpegMT(): void {
  if (ffmpegMtInstance) {
    try {
      ffmpegMtInstance.terminate();
    } catch (_e) {
      /* noop */
    }
    ffmpegMtInstance = null;
    ffmpegMtLoaded = false;
  }
}

function parseDurationSeconds(message: string): number | null {
  const durMatch = message.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
  if (!durMatch) return null;
  const h = parseInt(durMatch[1], 10);
  const m = parseInt(durMatch[2], 10);
  const s = parseInt(durMatch[3], 10);
  const cs = parseInt(durMatch[4], 10);
  return h * 3600 + m * 60 + s + cs / 100;
}

function parseCurrentTimeSeconds(message: string): number | null {
  const timeMatch = message.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
  if (!timeMatch) return null;
  const h = parseInt(timeMatch[1], 10);
  const m = parseInt(timeMatch[2], 10);
  const s = parseInt(timeMatch[3], 10);
  const cs = parseInt(timeMatch[4], 10);
  return h * 3600 + m * 60 + s + cs / 100;
}

async function getFFmpegMT(context: ExecutionContext): Promise<FFmpeg> {
  currentContext = context;
  if (ffmpegMtInstance && ffmpegMtLoaded) return ffmpegMtInstance;

  // Always terminate any prior dead worker before spinning up
  resetFFmpegMT();

  ffmpegMtInstance = new FFmpeg();

  ffmpegMtInstance.on('log', ({ message }) => {
    currentContext?.onLog(`[FFmpeg MT] ${message}`);

    // Parse media total duration
    if (message.includes('Duration:')) {
      const dur = parseDurationSeconds(message);
      if (dur && dur > 0) {
        currentTotalDuration = dur;
      }
    }

    // Parse live encoding time and speed
    if (message.includes('time=')) {
      const currentTime = parseCurrentTimeSeconds(message);
      const speedMatch = message.match(/speed=\s*([\d.]+x)/);
      if (speedMatch) {
        currentSpeed = speedMatch[1];
      }

      if (currentTime !== null && currentTotalDuration > 0 && currentContext) {
        const percent = Math.min(99, Math.max(1, Math.round((currentTime / currentTotalDuration) * 100)));
        const speedTag = currentSpeed ? ` [spd:${currentSpeed}]` : '';
        currentContext.onProgress(percent, `Codificando v�deo... ${percent}%${speedTag}`);
      }
    }
  });

  ffmpegMtInstance.on('progress', ({ progress }) => {
    const percent = Math.min(99, Math.round(progress * 100));
    if (percent > 0 && currentContext) {
      const speedTag = currentSpeed ? ` [spd:${currentSpeed}]` : '';
      currentContext.onProgress(percent, `Codificando v�deo... ${percent}%${speedTag}`);
    }
  });

  context.onLog('[FFmpeg MT] Carregando bin�rios multi-thread (@ffmpeg/core-mt)...');
  context.onProgress(0, 'Carregando motor FFmpeg Multi-Thread...');

  const origin = typeof self !== 'undefined' && self.location ? self.location.origin : '';
  const coreURL = await toBlobURL(`${origin}/ffmpeg-core-mt/ffmpeg-core.js`, 'text/javascript');
  const wasmURL = await toBlobURL(`${origin}/ffmpeg-core-mt/ffmpeg-core.wasm`, 'application/wasm');
  const workerURL = await toBlobURL(`${origin}/ffmpeg-core-mt/ffmpeg-core.worker.js`, 'text/javascript');

  await ffmpegMtInstance.load({ coreURL, wasmURL, workerURL });

  ffmpegMtLoaded = true;
  return ffmpegMtInstance;
}

function getConversionArgs(inputExt: string, outputExt: string, profile: ThreadProfile): string[] {
  const from = inputExt.toLowerCase();
  const to = outputExt.toLowerCase();

  const encMtFlags = ['-threads', String(profile.encoderThreads)];

  if (to === '.gif') {
    return [...encMtFlags, '-vf', 'fps=12,scale=480:-1:flags=lanczos', '-loop', '0'];
  }

  const videoExts = ['.mp4', '.mkv', '.webm', '.mov', '.avi', '.m4v'];
  const audioExts = ['.mp3', '.wav', '.ogg', '.m4a', '.flac'];

  if (videoExts.includes(from) && audioExts.includes(to)) {
    return [...encMtFlags, '-vn'];
  }

  if (audioExts.includes(from) && audioExts.includes(to)) {
    if (to === '.mp3') return [...encMtFlags, '-codec:a', 'libmp3lame', '-qscale:a', '2'];
    if (to === '.ogg') return [...encMtFlags, '-codec:a', 'libvorbis', '-qscale:a', '5'];
    if (to === '.flac') return [...encMtFlags, '-codec:a', 'flac'];
    if (to === '.m4a') return [...encMtFlags, '-codec:a', 'aac', '-b:a', '192k'];
    return [...encMtFlags];
  }

  // Fast WebM encoding with memory-friendly settings and fast Vorbis audio
  if (to === '.webm') {
    return [
      '-c:v', 'libvpx',
      '-deadline', 'realtime',
      '-cpu-used', '8',
      '-threads', String(profile.encoderThreads),
      '-b:v', '1.5M',
      '-c:a', 'libvorbis',
      '-map', '0:v:0',
      '-map', '0:a:0?',
    ];
  }

  if (to === '.mkv') return ['-c', 'copy'];

  // Fast H.264 MP4 encoding leveraging all available multi-core threads
  if (to === '.mp4') {
    return [
      ...encMtFlags,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '23',
      '-c:a', 'aac',
      '-movflags', '+faststart',
      '-map', '0:v:0',
      '-map', '0:a:0?',
    ];
  }

  return [...encMtFlags];
}

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    '.mp4': 'video/mp4', '.mkv': 'video/x-matroska', '.webm': 'video/webm',
    '.gif': 'image/gif', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
    '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.flac': 'audio/flac',
  };
  return map[ext] || 'application/octet-stream';
}

export const FFmpegMTModule: IModule = {
  manifest: {
    id: 'ffmpeg-core-mt',
    name: 'FFmpeg Multi-Thread',
    version: '0.12.10',
    description: 'Convers�o acelerada de �udio e v�deo utilizando m�ltiplos n�cleos da CPU (multi-thread).',
    category: 'video',
    supportedConversions: [
      {
        from: ['video/*'],
        to: ['.mp4', '.mkv', '.webm'],
        lossy: true,
        speedScore: 75,
        acceleration: 'cpu-multithread',
        performanceNotes: 'Multi-core CPU din�mico (otimizado para o seu hardware)',
      },
      {
        from: ['video/*'],
        to: ['.gif'],
        lossy: true,
        speedScore: 70,
        acceleration: 'cpu-multithread',
        performanceNotes: 'Renderiza��o multi-core de frames para GIF',
      },
      {
        from: ['audio/*'],
        to: ['.mp3', '.wav', '.ogg', '.m4a', '.flac'],
        lossy: true,
        speedScore: 70,
        acceleration: 'cpu-multithread',
        performanceNotes: 'Processamento multi-core de �udio',
      },
    ],
    inputs: [
      { id: 'file', name: 'Input File', type: 'file_handle', required: true }
    ],
    outputs: [
      { id: 'file', name: 'Output File', type: 'file_handle', required: true }
    ]
  },

  isSupported: () => {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.MODE === 'test') return true;
    if (typeof window === 'undefined') return true;
    return typeof SharedArrayBuffer !== 'undefined' && Boolean((window as any).crossOriginIsolated);
  },

  execute: async (inputs, context) => {
    currentContext = context;
    currentTotalDuration = 0;
    currentSpeed = '';

    const fileData = inputs.fileData as Uint8Array;
    const originalName = inputs.originalName as string;
    const targetFormat = inputs.targetFormat as string;

    if (!fileData || !originalName || !targetFormat) {
      throw new Error('FFmpeg MT module requires fileData (Uint8Array), originalName, and targetFormat.');
    }

    const inputExt = '.' + originalName.split('.').pop()!.toLowerCase();
    const outputExt = '.' + targetFormat.replace(/^\.+/, '').toLowerCase();
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + outputExt;

    // Detect hardware & calculate optimal threads
    const userMaxThreads = inputs.userMaxThreads ? Number(inputs.userMaxThreads) : undefined;
    const profile = getOptimalThreadProfile(outputExt, { userMaxThreads });
    context.onLog(`[FFmpeg MT] Hardware: ${profile.logicalCores} n�cleos l�gicos, ~${profile.deviceMemoryGb}GB RAM`);
    context.onLog(`[FFmpeg MT] Otimiza��o: ${profile.description}`);
    context.onLog(`[FFmpeg MT] Iniciando convers�o: ${originalName} -> ${outputFileName}`);

    let ffmpeg: FFmpeg;
    try {
      ffmpeg = await getFFmpegMT(context);
    } catch (loadErr: any) {
      resetFFmpegMT();
      throw new Error(`Falha ao inicializar o motor FFmpeg MT: ${loadErr?.message || loadErr}`);
    }

    const inputPath = `input_mt${inputExt}`;
    const outputPath = `output_mt${outputExt}`;

    try {
      context.onProgress(0, 'Gravando arquivo de entrada no sistema virtual...');
      await ffmpeg.writeFile(inputPath, fileData);

      const convArgs = getConversionArgs(inputExt, outputExt, profile);
      const fullArgs = [
        '-threads', String(profile.decoderThreads),
        '-i', inputPath,
        '-stats',
        ...convArgs,
        outputPath
      ];

      context.onLog(`[FFmpeg MT] Executando: ffmpeg ${fullArgs.join(' ')}`);
      context.onProgress(0, 'Iniciando processamento...');

      const exitCode = await ffmpeg.exec(fullArgs);

      if (exitCode !== 0) {
        throw new Error(`FFmpeg MT finalizou com c�digo de erro ${exitCode}. Verifique os logs para detalhes.`);
      }

      context.onProgress(98, 'Lendo arquivo de sa�da gerado...');
      const outputData = await ffmpeg.readFile(outputPath);

      if (typeof outputData === 'string') {
        throw new Error('Retorno inesperado do FFmpeg MT. Esperado Uint8Array.');
      }

      context.onProgress(100, 'Convers�o conclu�da com sucesso!');
      context.onLog(`[FFmpeg MT] Arquivo gerado: ${outputFileName} (${(outputData.byteLength / 1024 / 1024).toFixed(2)} MB)`);

      return {
        outputData: outputData,
        outputFileName: outputFileName,
        outputSize: outputData.byteLength,
        mimeType: getMimeType(outputExt),
      };
    } catch (runErr: any) {
      // If WebAssembly ran out of memory or crashed, terminate worker to prevent dirty state
      resetFFmpegMT();
      const message = runErr instanceof Error ? (runErr.stack || runErr.message) : String(runErr);
      if (message.includes('memory access out of bounds')) {
        throw new Error(
          'O arquivo � muito grande ou exigiu mais mem�ria que o limite WebAssembly de 32 bits (2 GB). Para converter para MP4 use o motor "Remux Direto (C�pia Sem Perdas)" que � instant�neo e n�o consome mem�ria.'
        );
      }
      throw runErr;
    } finally {
      // Best-effort cleanup of virtual files to keep MEMFS memory clean
      try {
        await ffmpeg.deleteFile(inputPath);
      } catch (_e) {
        /* noop */
      }
      try {
        await ffmpeg.deleteFile(outputPath);
      } catch (_e) {
        /* noop */
      }
      currentContext = null;
    }
  }
};
