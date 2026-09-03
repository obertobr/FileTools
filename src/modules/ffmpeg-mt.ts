/**
 * src/modules/ffmpeg-mt.ts
 *
 * FFmpeg Multi-Threaded WASM conversion engine.
 * Uses @ffmpeg/ffmpeg + @ffmpeg/core-mt with Web Workers and pthreads
 * to leverage CPU cores via SharedArrayBuffer.
 *
 * Includes memory-safe thread capping (max 4 pthreads) to prevent 32-bit WASM
 * 2GB linear heap exhaustion ("memory access out of bounds") on high-core CPUs.
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import type { IModule, ExecutionContext } from '@/shared/types/module';

let ffmpegMtInstance: FFmpeg | null = null;
let ffmpegMtLoaded = false;
let currentContext: ExecutionContext | null = null;

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

async function getFFmpegMT(context: ExecutionContext): Promise<FFmpeg> {
  currentContext = context;
  if (ffmpegMtInstance && ffmpegMtLoaded) return ffmpegMtInstance;

  // Always terminate any prior dead worker before spinning up
  resetFFmpegMT();

  ffmpegMtInstance = new FFmpeg();

  ffmpegMtInstance.on('log', ({ message }) => {
    currentContext?.onLog(`[FFmpeg MT] ${message}`);

    // Parse live encoding stats from FFmpeg output
    if (message.includes('time=') || message.includes('frame=')) {
      const timeMatch = message.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
      const speedMatch = message.match(/speed=\s*([\d.]+x)/);
      const frameMatch = message.match(/frame=\s*(\d+)/);

      const timeStr = timeMatch ? `tempo ${timeMatch[1]}` : '';
      const speedStr = speedMatch ? ` a ${speedMatch[1]}` : '';
      const frameStr = frameMatch ? `quadro ${frameMatch[1]}` : '';

      const detail = [frameStr, timeStr].filter(Boolean).join(' • ');
      if (detail && currentContext) {
        currentContext.onProgress(0, `Codificando multi-core (${detail}${speedStr})...`);
      }
    }
  });

  ffmpegMtInstance.on('progress', ({ progress, time }) => {
    const percent = Math.min(Math.round(progress * 100), 99);
    const timeSec = (time / 1_000_000).toFixed(1);
    if (percent > 0) {
      currentContext?.onProgress(percent, `Codificando multi-core... ${percent}% (${timeSec}s)`);
    } else {
      currentContext?.onProgress(0, `Codificando multi-core... (${timeSec}s processados)`);
    }
  });

  context.onLog('[FFmpeg MT] Carregando binários multi-thread (@ffmpeg/core-mt)...');
  context.onProgress(0, 'Carregando motor FFmpeg Multi-Thread...');

  const origin = typeof self !== 'undefined' && self.location ? self.location.origin : '';
  const coreURL = await toBlobURL(`${origin}/ffmpeg-core-mt/ffmpeg-core.js`, 'text/javascript');
  const wasmURL = await toBlobURL(`${origin}/ffmpeg-core-mt/ffmpeg-core.wasm`, 'application/wasm');
  const workerURL = await toBlobURL(`${origin}/ffmpeg-core-mt/ffmpeg-core.worker.js`, 'text/javascript');

  await ffmpegMtInstance.load({ coreURL, wasmURL, workerURL });

  ffmpegMtLoaded = true;
  const availableCores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
  const safeCores = Math.min(availableCores, 4);
  context.onLog(`[FFmpeg MT] Motor pronto! Paralelismo ativo (${safeCores} threads alocadas para segurança de memória WASM).`);
  return ffmpegMtInstance;
}

function getConversionArgs(inputExt: string, outputExt: string): string[] {
  const from = inputExt.toLowerCase();
  const to = outputExt.toLowerCase();

  // Safety: cap threads to 4 in WASM32 to avoid exhausting the 2GB shared memory pool
  const safeCores = typeof navigator !== 'undefined' ? Math.min(navigator.hardwareConcurrency || 4, 4) : 4;
  const mtFlags = ['-threads', String(safeCores)];

  if (to === '.gif') {
    return [...mtFlags, '-vf', 'fps=12,scale=480:-1:flags=lanczos', '-loop', '0'];
  }

  const videoExts = ['.mp4', '.mkv', '.webm', '.mov', '.avi', '.m4v'];
  const audioExts = ['.mp3', '.wav', '.ogg', '.m4a', '.flac'];

  if (videoExts.includes(from) && audioExts.includes(to)) {
    return [...mtFlags, '-vn'];
  }

  if (audioExts.includes(from) && audioExts.includes(to)) {
    if (to === '.mp3') return [...mtFlags, '-codec:a', 'libmp3lame', '-qscale:a', '2'];
    if (to === '.ogg') return [...mtFlags, '-codec:a', 'libvorbis', '-qscale:a', '5'];
    if (to === '.flac') return [...mtFlags, '-codec:a', 'flac'];
    if (to === '.m4a') return [...mtFlags, '-codec:a', 'aac', '-b:a', '192k'];
    return [...mtFlags];
  }

  // Fast WebM encoding with memory-friendly settings and fast Opus audio
  if (to === '.webm') {
    return [
      ...mtFlags,
      '-c:v', 'libvpx',
      '-deadline', 'realtime',
      '-cpu-used', '8',
      '-b:v', '1.5M',
      '-c:a', 'libopus',
      '-b:a', '128k',
      '-map', '0:v:0',
      '-map', '0:a:0?',
    ];
  }

  if (to === '.mkv') return ['-c', 'copy'];

  // Fast H.264 MP4 encoding
  if (to === '.mp4') {
    return [
      ...mtFlags,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '23',
      '-c:a', 'aac',
      '-movflags', '+faststart',
      '-map', '0:v:0',
      '-map', '0:a:0?',
    ];
  }

  return [...mtFlags];
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
    description: 'Conversão acelerada de áudio e vídeo utilizando múltiplos núcleos da CPU (multi-thread).',
    category: 'video',
    supportedConversions: [
      {
        from: ['video/*'],
        to: ['.mp4', '.mkv', '.webm'],
        lossy: true,
        speedScore: 75,
        acceleration: 'cpu-multithread',
        performanceNotes: 'Multi-core CPU via pthreads (threads seguras para RAM)',
      },
      {
        from: ['video/*'],
        to: ['.gif'],
        lossy: true,
        speedScore: 70,
        acceleration: 'cpu-multithread',
        performanceNotes: 'Renderização multi-core de frames para GIF',
      },
      {
        from: ['audio/*'],
        to: ['.mp3', '.wav', '.ogg', '.m4a', '.flac'],
        lossy: true,
        speedScore: 80,
        acceleration: 'cpu-multithread',
        performanceNotes: 'Encodificação paralela de áudio',
      },
    ],
    inputs: [
      { id: 'file', name: 'Input File', type: 'file_handle', required: true },
    ],
    outputs: [
      { id: 'file', name: 'Output File', type: 'file_handle', required: true },
    ],
  },

  isSupported: () => {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.MODE === 'test') {
      return true;
    }
    if (typeof window === 'undefined') return true;
    return typeof SharedArrayBuffer !== 'undefined' && Boolean((window as any).crossOriginIsolated);
  },

  execute: async (inputs, context) => {
    const fileData = inputs.fileData as Uint8Array;
    const originalName = inputs.originalName as string;
    const targetFormat = inputs.targetFormat as string;

    if (!fileData || !originalName || !targetFormat) {
      throw new Error('FFmpeg MT module requires fileData (Uint8Array), originalName, and targetFormat.');
    }

    const inputExt = '.' + originalName.split('.').pop()!.toLowerCase();
    const outputExt = targetFormat.startsWith('.') ? targetFormat.toLowerCase() : '.' + targetFormat.toLowerCase();
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + outputExt;

    context.onLog(`[FFmpeg MT] Iniciando conversão multi-threaded: ${originalName} -> ${outputFileName}`);

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
      context.onProgress(5, 'Gravando arquivo de entrada no sistema virtual...');
      await ffmpeg.writeFile(inputPath, fileData);

      const convArgs = getConversionArgs(inputExt, outputExt);
      const fullArgs = ['-i', inputPath, '-stats', ...convArgs, outputPath];

      context.onLog(`[FFmpeg MT] Executando: ffmpeg ${fullArgs.join(' ')}`);
      context.onProgress(0, 'Iniciando processamento em múltiplos núcleos...');

      const exitCode = await ffmpeg.exec(fullArgs);

      if (exitCode !== 0) {
        throw new Error(`FFmpeg MT finalizou com código de erro ${exitCode}. Verifique os logs para detalhes.`);
      }

      context.onProgress(95, 'Lendo arquivo de saída gerado...');
      const outputData = await ffmpeg.readFile(outputPath);

      if (typeof outputData === 'string') {
        throw new Error('Retorno inesperado do FFmpeg MT. Esperado Uint8Array.');
      }

      context.onProgress(100, 'Conversão concluída com sucesso!');
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
      const message = runErr instanceof Error ? runErr.message : String(runErr);
      if (message.includes('memory access out of bounds')) {
        throw new Error(
          'O arquivo é muito grande ou exigiu mais memória que o limite WebAssembly de 32 bits (2 GB). Para converter para MP4 use o motor "Remux Direto (Cópia Sem Perdas)" que é instantâneo e não consome memória.'
        );
      }
      throw runErr;
    } finally {
      try { await ffmpeg?.deleteFile(inputPath); } catch (_e) { /* noop */ }
      try { await ffmpeg?.deleteFile(outputPath); } catch (_e) { /* noop */ }
    }
  },
};
