/**
 * src/modules/ffmpeg.ts
 *
 * FFmpeg WASM conversion engine (Single-Thread).
 * Supports custom FPS, custom resolution scale, custom CRF quality,
 * and real probed stream mapping.
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import type { IModule, ExecutionContext } from '@/shared/types/module';
import type { ConversionOptions } from '@/shared/types/conversionOptions';

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

function getConversionArgs(inputExt: string, outputExt: string, options?: ConversionOptions): string[] {
  const from = inputExt.toLowerCase();
  const to = outputExt.toLowerCase();

  // Audio track mapping
  let audioMapFlags: string[];
  const isAudioCategoryActive = options?.activeCategories?.includes('audio_tracks');

  if (isAudioCategoryActive) {
    const selected = options?.selectedAudioTracks ?? [];
    if (selected.length === 0) {
      audioMapFlags = ['-an'];
    } else {
      audioMapFlags = ['-map', '0:v:0', ...selected.flatMap((idx) => ['-map', `0:a:${idx}?`])];
    }
  } else {
    audioMapFlags = ['-map', '0:v:0', '-map', '0:a?'];
  }

  // Quality CRF tuning
  const crfMap: Record<string, string> = {
    original: '18',
    balanced: '23',
    compressed: '28',
  };
  const crfVal = options?.customCrf !== undefined
    ? String(options.customCrf)
    : (crfMap[options?.qualityPreset || 'original'] || '18');

  // Video resolution scale filter
  let videoScaleFilter: string[] = [];
  if (options?.activeCategories?.includes('resolution')) {
    if (options.isCustomResolution && options.customScaleWidth) {
      videoScaleFilter = ['-vf', `scale=${options.customScaleWidth}:-2`];
    } else if (options.resolutionScale === '1080p') {
      videoScaleFilter = ['-vf', 'scale=1920:-2'];
    } else if (options.resolutionScale === '720p') {
      videoScaleFilter = ['-vf', 'scale=1280:-2'];
    } else if (options.resolutionScale === '480p') {
      videoScaleFilter = ['-vf', 'scale=854:-2'];
    }
  }

  if (to === '.gif') {
    const fps = options?.customFps || options?.gifFps || 10;
    const scaleWidth = options?.customScaleWidth !== undefined ? options.customScaleWidth : (options?.gifScaleWidth ?? 480);
    const vfParts = [`fps=${fps}`];
    if (scaleWidth > 0) {
      vfParts.push(`scale=${scaleWidth}:-1:flags=lanczos`);
    } else {
      vfParts.push('flags=lanczos');
    }
    return ['-vf', vfParts.join(','), '-loop', '0'];
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

  if (to === '.webm') {
    const isMute = isAudioCategoryActive && (options?.selectedAudioTracks?.length === 0);
    const audioFlags = isMute ? ['-an'] : ['-c:a', 'libvorbis', ...audioMapFlags];
    return ['-c:v', 'libvpx', '-b:v', '1.5M', ...videoScaleFilter, ...audioFlags];
  }

  if (to === '.mkv') return ['-c', 'copy'];

  if (to === '.mp4') {
    const isMute = isAudioCategoryActive && (options?.selectedAudioTracks?.length === 0);
    const audioFlags = isMute ? ['-an'] : ['-c:a', 'aac', ...audioMapFlags];
    return ['-c:v', 'libx264', '-preset', 'fast', '-crf', crfVal, ...videoScaleFilter, ...audioFlags];
  }

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
    const options = (inputs.options as ConversionOptions) || undefined;

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

      const convArgs = getConversionArgs(inputExt, outputExt, options);
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
