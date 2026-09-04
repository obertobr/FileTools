/**
 * src/modules/ffmpeg-mt.ts
 *
 * FFmpeg Multi-Threaded WASM conversion engine.
 * Supports custom FPS, custom resolution scale, custom CRF quality,
 * dynamic thread optimizer, and real probed stream mapping.
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import type { IModule, ExecutionContext } from '@/shared/types/module';
import { getOptimalThreadProfile, type ThreadProfile } from '@/core/hardware/threadOptimizer';
import type { ConversionOptions } from '@/shared/types/conversionOptions';

let ffmpegMtInstance: FFmpeg | null = null;
let ffmpegMtLoaded = false;
let currentContext: ExecutionContext | null = null;

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

  resetFFmpegMT();

  ffmpegMtInstance = new FFmpeg();

  ffmpegMtInstance.on('log', ({ message }) => {
    currentContext?.onLog(`[FFmpeg MT] ${message}`);

    if (message.includes('Duration:')) {
      const dur = parseDurationSeconds(message);
      if (dur && dur > 0) currentTotalDuration = dur;
    }

    if (message.includes('time=')) {
      const currentTime = parseCurrentTimeSeconds(message);
      const speedMatch = message.match(/speed=\s*([\d.]+x)/);
      if (speedMatch) currentSpeed = speedMatch[1];

      if (currentTime !== null && currentTotalDuration > 0 && currentContext) {
        const percent = Math.min(99, Math.max(1, Math.round((currentTime / currentTotalDuration) * 100)));
        const speedTag = currentSpeed ? ` [spd:${currentSpeed}]` : '';
        currentContext.onProgress(percent, `Codificando vídeo... ${percent}%${speedTag}`);
      }
    }
  });

  ffmpegMtInstance.on('progress', ({ progress }) => {
    const percent = Math.min(99, Math.round(progress * 100));
    if (percent > 0 && currentContext) {
      const speedTag = currentSpeed ? ` [spd:${currentSpeed}]` : '';
      currentContext.onProgress(percent, `Codificando vídeo... ${percent}%${speedTag}`);
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
  return ffmpegMtInstance;
}

function getConversionArgs(
  inputExt: string,
  outputExt: string,
  profile: ThreadProfile,
  options?: ConversionOptions
): string[] {
  const from = inputExt.toLowerCase();
  const to = outputExt.toLowerCase();

  const encMtFlags = ['-threads', String(profile.encoderThreads)];

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

  // Quality CRF tuning (supports custom CRF)
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
    const fps = options?.customFps || options?.gifFps || 12;
    const scaleWidth = options?.customScaleWidth !== undefined ? options.customScaleWidth : (options?.gifScaleWidth ?? 480);
    const vfParts = [`fps=${fps}`];
    if (scaleWidth > 0) {
      vfParts.push(`scale=${scaleWidth}:-1:flags=lanczos`);
    } else {
      vfParts.push('flags=lanczos');
    }
    return [...encMtFlags, '-vf', vfParts.join(','), '-loop', '0'];
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

  if (to === '.webm') {
    const isMute = isAudioCategoryActive && (options?.selectedAudioTracks?.length === 0);
    const audioFlags = isMute ? ['-an'] : ['-c:a', 'libvorbis', ...audioMapFlags];
    return [
      '-c:v', 'libvpx',
      '-deadline', 'realtime',
      '-cpu-used', '8',
      '-threads', String(profile.encoderThreads),
      '-b:v', '2M',
      ...videoScaleFilter,
      ...audioFlags,
    ];
  }

  if (to === '.mkv') return ['-c', 'copy'];

  if (to === '.mp4') {
    const isMute = isAudioCategoryActive && (options?.selectedAudioTracks?.length === 0);
    const audioFlags = isMute ? ['-an'] : ['-c:a', 'aac', ...audioMapFlags];
    return [
      ...encMtFlags,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', crfVal,
      '-movflags', '+faststart',
      ...videoScaleFilter,
      ...audioFlags,
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
    description: 'Conversão acelerada de áudio e vídeo utilizando múltiplos núcleos da CPU (multi-thread).',
    category: 'video',
    supportedConversions: [
      {
        from: ['video/*'],
        to: ['.mp4', '.mkv', '.webm'],
        lossy: true,
        speedScore: 75,
        acceleration: 'cpu-multithread',
        performanceNotes: 'Multi-core CPU dinâmico (otimizado para o seu hardware)',
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
        speedScore: 70,
        acceleration: 'cpu-multithread',
        performanceNotes: 'Processamento multi-core de áudio',
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
    const options = (inputs.options as ConversionOptions) || undefined;

    if (!fileData || !originalName || !targetFormat) {
      throw new Error('FFmpeg MT module requires fileData (Uint8Array), originalName, and targetFormat.');
    }

    const inputExt = '.' + originalName.split('.').pop()!.toLowerCase();
    const outputExt = '.' + targetFormat.replace(/^\.+/, '').toLowerCase();
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + outputExt;

    // Detect hardware & calculate optimal threads
    const userMaxThreads = options?.customThreads || (options?.threadsMode === 'custom'
      ? options.userMaxThreads
      : (inputs.userMaxThreads ? Number(inputs.userMaxThreads) : undefined));

    const profile = getOptimalThreadProfile(outputExt, { userMaxThreads });
    context.onLog(`[FFmpeg MT] Hardware: ${profile.logicalCores} núcleos lógicos, ~${profile.deviceMemoryGb}GB RAM`);
    context.onLog(`[FFmpeg MT] Otimização: ${profile.description}`);
    if (options?.activeCategories?.includes('audio_tracks')) {
      context.onLog(`[FFmpeg MT] Faixas de áudio ativas: [${options.selectedAudioTracks.join(', ')}]`);
    }
    if (options?.activeCategories?.includes('quality')) {
      context.onLog(`[FFmpeg MT] Qualidade: ${options.customCrf !== undefined ? `CRF ${options.customCrf}` : options.qualityPreset}`);
    }
    context.onLog(`[FFmpeg MT] Iniciando conversão: ${originalName} -> ${outputFileName}`);

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

      const convArgs = getConversionArgs(inputExt, outputExt, profile, options);
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
        throw new Error(`FFmpeg MT finalizou com código de erro ${exitCode}. Verifique os logs para detalhes.`);
      }

      context.onProgress(98, 'Lendo arquivo de saída gerado...');
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
      resetFFmpegMT();
      const message = runErr instanceof Error ? (runErr.stack || runErr.message) : String(runErr);
      if (message.includes('memory access out of bounds')) {
        throw new Error(
          'O arquivo é muito grande ou exigiu mais memória que o limite WebAssembly de 32 bits (2 GB). Para converter para MP4 use o motor "Remux Direto (Cópia Sem Perdas)" que é instantâneo e não consome memória.'
        );
      }
      throw runErr;
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
  }
};
