/**
 * src/modules/ffmpeg.ts
 *
 * FFmpeg WASM conversion engine (Single-Thread).
 * Uses @ffmpeg/ffmpeg 0.12 with standard @ffmpeg/core.
 * High compatibility fallback engine running on single CPU thread.
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import type { IModule, ExecutionContext } from '@/shared/types/module';

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoaded = false;
let currentContext: ExecutionContext | null = null;
let totalDuration = 0;
let currentSpeed = '';

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

async function getFFmpeg(context: ExecutionContext): Promise<FFmpeg> {
  currentContext = context;
  if (ffmpegInstance && ffmpegLoaded) return ffmpegInstance;

  ffmpegInstance = new FFmpeg();

  ffmpegInstance.on('log', ({ message }) => {
    currentContext?.onLog(`[FFmpeg] ${message}`);

    if (message.includes('Duration:')) {
      const dur = parseDurationSeconds(message);
      if (dur && dur > 0) totalDuration = dur;
    }

    if (message.includes('time=')) {
      const cur = parseCurrentTimeSeconds(message);
      const speedMatch = message.match(/speed=\s*([\d.]+x)/);
      if (speedMatch) currentSpeed = speedMatch[1];

      if (cur !== null && totalDuration > 0 && currentContext) {
        const percent = Math.min(99, Math.max(1, Math.round((cur / totalDuration) * 100)));
        const speedTag = currentSpeed ? ` [spd:${currentSpeed}]` : '';
        currentContext.onProgress(percent, `Codificando... ${percent}%${speedTag}`);
      }
    }
  });

  ffmpegInstance.on('progress', ({ progress }) => {
    const percent = Math.min(99, Math.round(progress * 100));
    if (percent > 0 && currentContext) {
      const speedTag = currentSpeed ? ` [spd:${currentSpeed}]` : '';
      currentContext.onProgress(percent, `Codificando... ${percent}%${speedTag}`);
    }
  });

  context.onLog('[FFmpeg] Carregando ffmpeg-core.wasm...');
  context.onProgress(0, 'Carregando motor FFmpeg...');

  const origin = typeof self !== 'undefined' && self.location ? self.location.origin : '';
  const coreURL = await toBlobURL(`${origin}/ffmpeg-core.js`, 'text/javascript');
  const wasmURL = await toBlobURL(`${origin}/ffmpeg-core.wasm`, 'application/wasm');

  await ffmpegInstance.load({ coreURL, wasmURL });

  ffmpegLoaded = true;
  context.onLog('[FFmpeg] Motor carregado com sucesso.');
  return ffmpegInstance;
}

function getConversionArgs(inputExt: string, outputExt: string): string[] {
  const from = inputExt.toLowerCase();
  const to = outputExt.toLowerCase();

  if (to === '.gif') {
    return ['-vf', 'fps=10,scale=480:-1:flags=lanczos', '-loop', '0'];
  }

  const videoExts = ['.mp4', '.mkv', '.webm', '.mov', '.avi', '.m4v'];
  const audioExts = ['.mp3', '.wav', '.ogg', '.m4a', '.flac'];

  if (videoExts.includes(from) && audioExts.includes(to)) {
    return ['-vn'];
  }

  if (audioExts.includes(from) && audioExts.includes(to)) {
    if (to === '.mp3') return ['-codec:a', 'libmp3lame', '-qscale:a', '2'];
    if (to === '.ogg') return ['-codec:a', 'libvorbis', '-qscale:a', '5'];
    if (to === '.flac') return ['-codec:a', 'flac'];
    if (to === '.m4a') return ['-codec:a', 'aac', '-b:a', '192k'];
    return [];
  }

  if (to === '.webm') return ['-c:v', 'libvpx', '-b:v', '1M', '-c:a', 'libvorbis'];
  if (to === '.mkv') return ['-c', 'copy'];
  if (to === '.mp4') return ['-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac'];

  return [];
}

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    '.mp4': 'video/mp4', '.mkv': 'video/x-matroska', '.webm': 'video/webm',
    '.gif': 'image/gif', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
    '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.flac': 'audio/flac',
  };
  return map[ext] || 'application/octet-stream';
}

export const FFmpegModule: IModule = {
  manifest: {
    id: 'ffmpeg-core',
    name: 'FFmpeg WASM (Single-Thread)',
    version: '0.12.10',
    description: 'Motor de conversão de mídia local em CPU single-thread com alta compatibilidade.',
    category: 'video',
    supportedConversions: [
      {
        from: ['video/*'],
        to: ['.mp4', '.mkv', '.webm', '.gif'],
        lossy: true,
        speedScore: 45,
        acceleration: 'cpu-singlethread',
        performanceNotes: 'CPU single-thread padrão (seguro para baixa memória)',
      },
      {
        from: ['audio/*'],
        to: ['.mp3', '.wav', '.ogg', '.m4a', '.flac'],
        lossy: true,
        speedScore: 50,
        acceleration: 'cpu-singlethread',
        performanceNotes: 'CPU single-thread para áudio',
      },
    ],
    inputs: [
      { id: 'file', name: 'Input File', type: 'file_handle', required: true },
    ],
    outputs: [
      { id: 'file', name: 'Output File', type: 'file_handle', required: true },
    ],
  },

  execute: async (inputs, context) => {
    currentContext = context;
    totalDuration = 0;
    currentSpeed = '';

    const fileData = inputs.fileData as Uint8Array;
    const originalName = inputs.originalName as string;
    const targetFormat = inputs.targetFormat as string;

    if (!fileData || !originalName || !targetFormat) {
      throw new Error('FFmpeg module requires fileData (Uint8Array), originalName, and targetFormat.');
    }

    const inputExt = '.' + originalName.split('.').pop()!.toLowerCase();
    const outputExt = '.' + targetFormat.replace(/^\.+/, '').toLowerCase();
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + outputExt;

    context.onLog(`[FFmpeg] Converting ${originalName} -> ${outputFileName}`);

    const ffmpeg = await getFFmpeg(context);
    const inputPath = `input${inputExt}`;
    const outputPath = `output${outputExt}`;

    try {
      context.onProgress(0, 'Carregando arquivo...');
      await ffmpeg.writeFile(inputPath, fileData);

      const convArgs = getConversionArgs(inputExt, outputExt);
      const fullArgs = ['-i', inputPath, '-stats', ...convArgs, outputPath];

      context.onLog(`[FFmpeg] Executing: ffmpeg ${fullArgs.join(' ')}`);
      context.onProgress(0, 'Processando...');

      const exitCode = await ffmpeg.exec(fullArgs);

      if (exitCode !== 0) {
        throw new Error(`FFmpeg finalizou com código de erro ${exitCode}. Verifique os logs para detalhes.`);
      }

      context.onProgress(98, 'Finalizando...');
      const outputData = await ffmpeg.readFile(outputPath);

      if (typeof outputData === 'string') {
        throw new Error('Retorno inesperado do FFmpeg. Esperado Uint8Array.');
      }

      context.onProgress(100, 'Conversão concluída!');
      context.onLog(`[FFmpeg] Sucesso: ${outputFileName} (${outputData.byteLength} bytes)`);

      return {
        outputData: outputData,
        outputFileName: outputFileName,
        outputSize: outputData.byteLength,
        mimeType: getMimeType(outputExt),
      };
    } finally {
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
  },
};
