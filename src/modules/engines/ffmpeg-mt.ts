/**
 * src/modules/ffmpeg-mt.ts
 *
 * FFmpeg Multi-Threaded WASM conversion engine.
 * Supports comprehensive audio/video containers, codecs, custom FPS,
 * custom resolution scale, custom CRF quality, dynamic thread optimizer,
 * and real probed stream mapping.
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';
import type { FFFSType } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import type { IModule, ExecutionContext } from '@/shared/types/module';
import { getOptimalThreadProfile, type ThreadProfile } from '@/core/hardware/threadOptimizer';
import { categoryOfExtension } from '@/lib/formats';
import type { ConversionModifiers } from '@/shared/types/conversionModifiers';
import { resolveVideoCodecEncoder } from '@/core/knowledge/videoCodecs';
import { getAudioCodecFlags } from '@/core/knowledge/audioCodecs';
import { resolveColorSpaceArgs, resolvePixelFormatAndBitDepth } from '@/core/knowledge/colorPresets';
import { resolveQualityCrf } from '@/core/knowledge/qualityPresets';
import { getMimeType } from '@/core/knowledge/mimeTypes';


let ffmpegMtInstance: FFmpeg | null = null;
let ffmpegMtLoaded = false;
let currentContext: ExecutionContext | null = null;

let currentTotalDuration = 0;
let currentSpeed = '';

export function resetFFmpegMT(): void {
  if (ffmpegMtInstance) {
    const oldInstance = ffmpegMtInstance;
    ffmpegMtInstance = null;
    ffmpegMtLoaded = false;
    try {
      // Non-blocking fire-and-forget termination to prevent deadlock on pthread Atomics.wait
      setTimeout(() => {
        try {
          oldInstance.terminate();
        } catch (_e) {
          /* noop */
        }
      }, 0);
    } catch (_e) {
      /* noop */
    }
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

let cachedCoreURL: string | null = null;
let cachedWasmURL: string | null = null;
let cachedWorkerURL: string | null = null;

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
  if (!cachedCoreURL) {
    cachedCoreURL = await toBlobURL(`${origin}/ffmpeg-core-mt/ffmpeg-core.js`, 'text/javascript');
  }
  if (!cachedWasmURL) {
    cachedWasmURL = await toBlobURL(`${origin}/ffmpeg-core-mt/ffmpeg-core.wasm`, 'application/wasm');
  }
  if (!cachedWorkerURL) {
    cachedWorkerURL = await toBlobURL(`${origin}/ffmpeg-core-mt/ffmpeg-core.worker.js`, 'text/javascript');
  }

  await ffmpegMtInstance.load({
    coreURL: cachedCoreURL,
    wasmURL: cachedWasmURL,
    workerURL: cachedWorkerURL,
  });

  ffmpegMtLoaded = true;
  return ffmpegMtInstance;
}

function getConversionArgs(
  inputExt: string,
  outputExt: string,
  profile: ThreadProfile,
  options?: ConversionModifiers
): string[] {
  const from = inputExt.toLowerCase();
  const to = outputExt.toLowerCase();

  const encMtFlags = ['-threads', String(profile.encoderThreads)];

  // Audio track mapping or merging
  let audioMapFlags: string[];
  let audioMergeFilter: string[] = [];
  const isAudioCategoryActive = options?.activeCategories?.includes('audio_tracks');
  const isMergeActive = options?.activeCategories?.includes('audio_merge');

  if (isMergeActive) {
    const selected = options?.selectedAudioTracks ?? [];
    if (selected.length === 0) {
      audioMapFlags = ['-map', '0:v:0', '-an'];
    } else if (selected.length === 1) {
      audioMapFlags = ['-map', '0:v:0', '-map', `0:a:${selected[0]}?`];
    } else {
      const filterInputs = selected.map((idx) => `[0:a:${idx}]`).join('');
      const amixFilter = `${filterInputs}amix=inputs=${selected.length}:duration=longest:dropout_transition=0[aout]`;
      audioMergeFilter = ['-filter_complex', amixFilter];
      audioMapFlags = ['-map', '0:v:0', '-map', '[aout]'];
    }
  } else if (isAudioCategoryActive) {
    const selected = options?.selectedAudioTracks ?? [];
    if (selected.length === 0) {
      audioMapFlags = ['-map', '0:v:0', '-an'];
    } else {
      audioMapFlags = ['-map', '0:v:0', ...selected.flatMap((idx) => ['-map', `0:a:${idx}?`])];
    }
  } else {
    audioMapFlags = ['-map', '0:v:0', '-map', '0:a?'];
  }

  // Quality CRF tuning (supports custom CRF)
  const crfVal = String(resolveQualityCrf(options));

  // Optimal libx264 args for 32-bit WASM: uses slice-threading with the optimal/configured thread allocation
  // and respects pixel format and bit depth modifiers.
  const { pixFmt, profileArgs, isCustom: hasCustomPixFmt } = resolvePixelFormatAndBitDepth(options);

  const getLibx264Args = () => [
    '-threads', String(profile.encoderThreads),
    '-preset', 'ultrafast',
    '-crf', crfVal,
    '-pix_fmt', pixFmt,
    ...profileArgs,
  ];

  const generalPixFmtArgs = hasCustomPixFmt ? ['-pix_fmt', pixFmt] : [];

  // Bitrate handling
  const effectiveVideoBitrate = options?.activeCategories?.includes('bitrate')
    ? (options.isCustomVideoBitrate && options.customVideoBitrateKbps
        ? `${options.customVideoBitrateKbps}k`
        : (options.videoBitrate && options.videoBitrate !== 'auto' ? options.videoBitrate : undefined))
    : undefined;
  const videoBitrateArgs = effectiveVideoBitrate ? ['-b:v', effectiveVideoBitrate] : [];

  const effectiveAudioBitrate = options?.activeCategories?.includes('bitrate')
    ? (options.isCustomAudioBitrate && options.customAudioBitrateKbps
        ? `${options.customAudioBitrateKbps}k`
        : (options.audioBitrate && options.audioBitrate !== 'auto' ? options.audioBitrate : undefined))
    : undefined;

  // Color space handling
  const colorSpaceArgs = resolveColorSpaceArgs(options);

  // Video resolution scale filter: decoupled from preset labels by receiving canonical targetWidth and targetHeight
  let videoScaleFilter: string[] = [];
  if (options?.activeCategories?.includes('resolution')) {
    const width = options.targetWidth || options.customScaleWidth || options.gifScaleWidth;
    const height = options.targetHeight ?? -2;
    if (width && width > 0) {
      const w = width % 2 === 0 ? width : width - 1;
      const h = height > 0 ? (height % 2 === 0 ? height : height - 1) : height;
      videoScaleFilter = ['-vf', `scale=${w}:${h}`];
    }
  }

  // Video framerate (FPS) override: decoupled by receiving canonical targetFps
  let videoFpsArgs: string[] = [];
  if (options?.activeCategories?.includes('fps')) {
    const targetFps = options.targetFps || options.customFps || options.gifFps;
    if (targetFps && targetFps > 0) {
      videoFpsArgs = ['-r', String(targetFps)];
    }
  }

  // User codec overrides
  const userVideoCodec = options?.activeCategories?.includes('video_codec') ? options.videoCodec : undefined;
  const userAudioCodec = options?.activeCategories?.includes('audio_codec') ? options.audioCodec : undefined;

  const isImageToVideo = categoryOfExtension(from) === 'image' && (categoryOfExtension(to) === 'video' || to === '.gif');
  const isAudioToVideo = categoryOfExtension(from) === 'audio' && categoryOfExtension(to) === 'video';

  // Image to Video with custom duration
  if (isImageToVideo) {
    const duration = options?.videoDurationSeconds || 10;
    const vCodec = resolveVideoCodecEncoder(userVideoCodec, 'libx264');
    const scaleFilter = videoScaleFilter.length > 0 ? videoScaleFilter : ['-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2'];
    return [
      ...encMtFlags,
      '-c:v', vCodec,
      '-t', String(duration),
      ...(vCodec === 'libx264' ? getLibx264Args() : ['-pix_fmt', pixFmt]),
      ...videoBitrateArgs,
      ...colorSpaceArgs,
      ...scaleFilter,
    ];
  }

  // Audio to Video with black screen
  if (isAudioToVideo) {
    const vCodec = resolveVideoCodecEncoder(userVideoCodec, 'libx264');
    const audioFlags = getAudioCodecFlags(userAudioCodec || 'auto', to, undefined, effectiveAudioBitrate);
    return [
      ...encMtFlags,
      '-filter_complex', 'color=c=black:s=1280x720:r=30[v]',
      '-map', '[v]',
      '-map', '0:a:0?',
      '-c:v', vCodec,
      '-tune', 'stillimage',
      '-pix_fmt', pixFmt,
      '-shortest',
      ...(vCodec === 'libx264' ? getLibx264Args() : generalPixFmtArgs),
      ...videoBitrateArgs,
      ...colorSpaceArgs,
      ...videoScaleFilter,
      ...audioFlags,
    ];
  }


  // 1. GIF Output
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

  const videoExts = [
    '.mp4', '.mkv', '.webm', '.mov', '.avi', '.flv', '.wmv',
    '.3gp', '.ts', '.mpg', '.mpeg', '.vob', '.m4v', '.ogv'
  ];
  const audioExts = [
    '.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac',
    '.opus', '.wma', '.aiff', '.aif', '.ac3', '.m4r'
  ];

  // 2. Video to Audio Extraction (with optional track merge / selection)
  if (videoExts.includes(from) && audioExts.includes(to)) {
    const isMergeActive = options?.activeCategories?.includes('audio_merge');
    if (isMergeActive && options?.selectedAudioTracks) {
      const selected = options.selectedAudioTracks;
      if (selected.length === 0) {
        return [...encMtFlags, '-vn', '-an'];
      }
      if (selected.length === 1) {
        return [
          ...encMtFlags,
          '-vn',
          '-map', `0:a:${selected[0]}`,
          ...getAudioCodecFlags(userAudioCodec || 'auto', to),
        ];
      }
      // Multiple tracks: mix with amix filter
      const filterInputs = selected.map((idx) => `[0:a:${idx}]`).join('');
      const amixFilter = `${filterInputs}amix=inputs=${selected.length}:duration=longest:dropout_transition=0[aout]`;
      return [
        ...encMtFlags,
        '-filter_complex', amixFilter,
        '-map', '[aout]',
        '-vn',
        ...getAudioCodecFlags(userAudioCodec || 'auto', to),
      ];
    }
    return [...encMtFlags, '-vn', ...getAudioCodecFlags(userAudioCodec || 'auto', to)];
  }

  // 3. Audio to Audio Cross-Conversion
  if (audioExts.includes(from) && audioExts.includes(to)) {
    return [...encMtFlags, ...getAudioCodecFlags(userAudioCodec || 'auto', to)];
  }

  // Helper for video audio stream
  const isMute = (isAudioCategoryActive || isMergeActive) && (options?.selectedAudioTracks?.length === 0);

  let audioCodecArgs: string[] = [];
  const selectedAudioTracks = options?.selectedAudioTracks ?? [0];
  const isMultiTrack = isAudioCategoryActive && !isMergeActive && selectedAudioTracks.length > 1;
  const isPerTrackCodec = isMultiTrack && options?.syncAllAudioCodecs === false && options?.trackAudioCodecs;

  if (isPerTrackCodec) {
    audioCodecArgs = selectedAudioTracks.flatMap((trackIdx, outputStreamIdx) => {
      const trackCodec = options.trackAudioCodecs?.[trackIdx] || userAudioCodec || 'auto';
      return getAudioCodecFlags(trackCodec, to, outputStreamIdx, effectiveAudioBitrate);
    });
  } else {
    audioCodecArgs = getAudioCodecFlags(userAudioCodec || 'auto', to, undefined, effectiveAudioBitrate);
  }

  const videoAudioFlags = isMute
    ? ['-map', '0:v:0', '-an']
    : [...audioMergeFilter, ...audioMapFlags, ...audioCodecArgs];

  // 4. Video to WebM
  if (to === '.webm') {
    const vCodec = resolveVideoCodecEncoder(userVideoCodec, 'libvpx');
    if (vCodec === 'copy') return ['-c:v', 'copy', ...videoAudioFlags];
    return [
      '-c:v', vCodec,
      '-deadline', 'realtime',
      '-cpu-used', '8',
      '-threads', String(profile.encoderThreads),
      ...(effectiveVideoBitrate ? videoBitrateArgs : ['-b:v', '2M']),
      ...colorSpaceArgs,
      ...videoFpsArgs,
      ...videoScaleFilter,
      ...videoAudioFlags,
    ];
  }

  // 5. Video to MKV
  if (to === '.mkv') {
    const hasModifications = videoScaleFilter.length > 0
      || videoFpsArgs.length > 0
      || (userVideoCodec && userVideoCodec !== 'copy' && userVideoCodec !== 'auto')
      || (userAudioCodec && userAudioCodec !== 'auto')
      || isAudioCategoryActive || isMergeActive
      || videoBitrateArgs.length > 0
      || colorSpaceArgs.length > 0
      || hasCustomPixFmt;
    if (!hasModifications) {
      return ['-c', 'copy'];
    }
    const vCodec = resolveVideoCodecEncoder(userVideoCodec, 'libx264');
    return [
      ...encMtFlags,
      '-c:v', vCodec,
      ...(vCodec === 'libx264' ? getLibx264Args() : generalPixFmtArgs),
      ...videoBitrateArgs,
      ...colorSpaceArgs,
      ...videoFpsArgs,
      ...videoScaleFilter,
      ...videoAudioFlags,
    ];
  }

  // 6. Video to AVI
  if (to === '.avi') {
    const vCodec = resolveVideoCodecEncoder(userVideoCodec, 'mpeg4');
    return [
      ...encMtFlags,
      '-c:v', vCodec,
      ...(vCodec === 'libx264' ? getLibx264Args() : generalPixFmtArgs),
      ...videoBitrateArgs,
      ...colorSpaceArgs,
      ...videoFpsArgs,
      ...videoScaleFilter,
      ...videoAudioFlags,
    ];
  }

  // 7. Video to MOV
  if (to === '.mov') {
    const vCodec = resolveVideoCodecEncoder(userVideoCodec, 'libx264');
    return [
      ...encMtFlags,
      '-c:v', vCodec,
      ...(vCodec === 'libx264' ? getLibx264Args() : generalPixFmtArgs),
      '-movflags', '+faststart',
      ...videoBitrateArgs,
      ...colorSpaceArgs,
      ...videoFpsArgs,
      ...videoScaleFilter,
      ...videoAudioFlags,
    ];
  }

  // 8. Video to FLV
  if (to === '.flv') {
    const vCodec = resolveVideoCodecEncoder(userVideoCodec, 'flv');
    return [
      ...encMtFlags,
      '-c:v', vCodec,
      ...(vCodec === 'libx264' ? getLibx264Args() : generalPixFmtArgs),
      ...videoBitrateArgs,
      ...colorSpaceArgs,
      ...videoFpsArgs,
      ...videoScaleFilter,
      ...videoAudioFlags,
    ];
  }

  // 9. Video to WMV
  if (to === '.wmv') {
    return [
      ...encMtFlags,
      '-c:v', 'wmv2',
      ...videoBitrateArgs,
      ...colorSpaceArgs,
      ...videoFpsArgs,
      ...videoScaleFilter,
      ...videoAudioFlags,
    ];
  }

  // 10. Video to 3GP
  if (to === '.3gp') {
    const isCustomScale = videoScaleFilter.length > 0;
    let vCodec = 'h263';
    if (userVideoCodec && userVideoCodec !== 'auto') {
      vCodec = resolveVideoCodecEncoder(userVideoCodec, 'h263');
    } else if (isCustomScale) {
      vCodec = resolveVideoCodecEncoder(userVideoCodec, 'mpeg4');
    } else {
      vCodec = resolveVideoCodecEncoder(userVideoCodec, 'h263');
    }
    const scale = isCustomScale ? videoScaleFilter : ['-s', '176x144'];
    const fps = videoFpsArgs.length > 0 ? videoFpsArgs : ['-r', '15'];
    return [
      ...encMtFlags,
      '-c:v', vCodec,
      ...(vCodec === 'libx264' ? getLibx264Args() : generalPixFmtArgs),
      ...videoBitrateArgs,
      ...colorSpaceArgs,
      ...scale,
      ...fps,
      ...videoAudioFlags,
    ];
  }

  // 11. Video to TS
  if (to === '.ts') {
    const vCodec = resolveVideoCodecEncoder(userVideoCodec, 'libx264');
    return [
      ...encMtFlags,
      '-c:v', vCodec,
      ...(vCodec === 'libx264' ? getLibx264Args() : ['-preset', 'ultrafast']),
      '-f', 'mpegts',
      ...videoBitrateArgs,
      ...colorSpaceArgs,
      ...videoFpsArgs,
      ...videoScaleFilter,
      ...videoAudioFlags,
    ];
  }

  // 12. Video to MPG / MPEG / VOB
  if (to === '.mpg' || to === '.mpeg' || to === '.vob') {
    return [
      ...encMtFlags,
      '-c:v', 'mpeg2video',
      ...videoBitrateArgs,
      ...colorSpaceArgs,
      ...videoFpsArgs,
      ...videoScaleFilter,
      ...videoAudioFlags,
    ];
  }

  // 13. Video to OGV
  if (to === '.ogv') {
    return [
      '-threads', '1',
      '-c:v', 'libtheora',
      '-pix_fmt', pixFmt,
      ...videoBitrateArgs,
      ...colorSpaceArgs,
      ...videoFpsArgs,
      ...videoScaleFilter,
      ...videoAudioFlags,
    ];
  }

  // 14. Video to MP4 / M4V (Default)
  const vCodec = resolveVideoCodecEncoder(userVideoCodec, 'libx264');

  return [
    ...encMtFlags,
    '-c:v', vCodec,
    ...(vCodec === 'libx264' ? getLibx264Args() : generalPixFmtArgs),
    '-movflags', '+faststart',
    ...videoBitrateArgs,
    ...colorSpaceArgs,
    ...videoFpsArgs,
    ...videoScaleFilter,
    ...videoAudioFlags,
  ];
}


export const FFmpegMTModule: IModule = {
  manifest: {
    id: 'ffmpeg-core-mt',
    name: 'FFmpeg Multi-Thread',
    version: '0.12.10',
    description: 'Conversão acelerada de áudio e vídeo utilizando múltiplos núcleos da CPU (multi-thread).',
    category: 'video',
    supportedModifiers: [
      'video_codec',
      'audio_codec',
      'quality',
      'fps',
      'resolution',
      'threads',
      'audio_tracks',
      'audio_merge',
      'subtitles',
      'video_duration',
      'pixel_format',
      'bit_depth',
      'bitrate',
      'color_space',
    ],
    supportedConversions: [
      {
        from: ['audio/*'],
        to: ['.mp4', '.mkv', '.webm', '.mov', '.avi', '.ts'],
        lossy: true,
        speedScore: 65,
        acceleration: 'cpu-multithread',
        performanceNotes: 'Gera vídeo com tela preta e áudio original sincronizado',
      },
      {
        from: ['image/*'],
        to: ['.mp4', '.mkv', '.webm', '.mov', '.avi', '.ts'],
        lossy: true,
        speedScore: 65,
        acceleration: 'cpu-multithread',
        performanceNotes: 'Gera vídeo a partir de imagem estática com duração personalizada',
      },
      {
        from: ['video/*'],
        to: ['.mp4', '.mkv', '.webm', '.mov', '.avi', '.flv', '.wmv', '.3gp', '.ts', '.mpg', '.mpeg', '.vob', '.m4v', '.ogv'],
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
        from: ['video/*'],
        to: ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac', '.opus', '.wma', '.aiff', '.ac3', '.m4r'],
        lossy: true,
        speedScore: 75,
        acceleration: 'cpu-multithread',
        performanceNotes: 'Extração acelerada de áudio de vídeos multi-core',
      },
      {
        from: ['audio/*'],
        to: ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac', '.opus', '.wma', '.aiff', '.ac3', '.m4r'],
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

    const file = inputs.file as File | Blob | undefined;
    const fileData = inputs.fileData as Uint8Array | undefined;
    const originalName = inputs.originalName as string;
    const targetFormat = inputs.targetFormat as string;
    const options = (inputs.modifiers as ConversionModifiers) || (inputs.options as ConversionModifiers) || undefined;

    if ((!file && !fileData) || !originalName || !targetFormat) {
      throw new Error('FFmpeg MT module requires file (File/Blob) or fileData (Uint8Array), originalName, and targetFormat.');
    }

    const inputExt = '.' + originalName.split('.').pop()!.toLowerCase();
    const outputExt = '.' + targetFormat.replace(/^\.+/, '').toLowerCase();
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + outputExt;

    // Detect hardware & calculate optimal threads
    const userMaxThreads = (options?.threadsMode === 'custom' ? (options.customThreads ?? options.userMaxThreads) : undefined)
      || (inputs.userMaxThreads ? Number(inputs.userMaxThreads) : undefined)
      || (options?.customThreads ? Number(options.customThreads) : undefined);

    const profile = getOptimalThreadProfile(outputExt, { userMaxThreads });
    context.onLog(`[FFmpeg MT] Hardware: ${profile.logicalCores} núcleos lógicos, ~${profile.deviceMemoryGb}GB RAM`);
    context.onLog(`[FFmpeg MT] Otimização: ${profile.description}`);
    if (options?.activeCategories?.includes('audio_tracks')) {
      context.onLog(`[FFmpeg MT] Faixas de áudio ativas: [${options.selectedAudioTracks.join(', ')}]`);
    }
    if (options?.activeCategories?.includes('quality')) {
      context.onLog(`[FFmpeg MT] Qualidade: ${options.customCrf !== undefined ? `CRF ${options.customCrf}` : options.qualityPreset}`);
    }
    if (options?.activeCategories?.includes('video_codec') && options.videoCodec) {
      context.onLog(`[FFmpeg MT] Codec de vídeo selecionado: ${options.videoCodec}`);
    }
    if (options?.activeCategories?.includes('audio_codec') && options.audioCodec) {
      context.onLog(`[FFmpeg MT] Codec de áudio selecionado: ${options.audioCodec}`);
    }
    context.onLog(`[FFmpeg MT] Iniciando conversão: ${originalName} -> ${outputFileName}`);

    let ffmpeg: FFmpeg;
    try {
      ffmpeg = await getFFmpegMT(context);
    } catch (loadErr: any) {
      resetFFmpegMT();
      throw new Error(`Falha ao inicializar o motor FFmpeg MT: ${loadErr?.message || loadErr}`);
    }

    let mountedWorkDir = false;
    const workDir = '/work';
    const fallbackInputPath = `input_mt${inputExt}`;
    let inputPath = fallbackInputPath;
    const outputPath = `output_mt${outputExt}`;

    try {
      const targetFileOrBlob: File | Blob | null = file || (fileData ? new Blob([fileData as unknown as BlobPart]) : null);

      if (typeof ffmpeg.mount === 'function' && targetFileOrBlob) {
        try {
          try {
            await ffmpeg.createDir(workDir);
          } catch (_e) {
            /* noop if already exists */
          }

          if (typeof File !== 'undefined' && targetFileOrBlob instanceof File) {
            await ffmpeg.mount('WORKERFS' as FFFSType, {
              files: [targetFileOrBlob],
            }, workDir);
            inputPath = `${workDir}/${targetFileOrBlob.name}`;
            mountedWorkDir = true;
          } else {
            const blobName = `input_mt${inputExt}`;
            await ffmpeg.mount('WORKERFS' as FFFSType, {
              blobs: [{ name: blobName, data: targetFileOrBlob }],
            }, workDir);
            inputPath = `${workDir}/${blobName}`;
            mountedWorkDir = true;
          }

          context.onLog(`[FFmpeg MT] WORKERFS montado com sucesso em ${workDir} (Zero-RAM streaming).`);
        } catch (mountErr) {
          context.onLog(`[FFmpeg MT] WORKERFS indisponível (${mountErr}), utilizando gravação direta.`);
          mountedWorkDir = false;
        }
      }

      if (!mountedWorkDir) {
        inputPath = fallbackInputPath;
        context.onProgress(0, 'Gravando arquivo de entrada no sistema virtual...');
        const dataToWrite: Uint8Array = fileData || new Uint8Array(await (file as File | Blob).arrayBuffer());
        await ffmpeg.writeFile(inputPath, dataToWrite);
      }


      const isImageToVideo = categoryOfExtension(inputExt) === 'image' && (categoryOfExtension(outputExt) === 'video' || outputExt === '.gif');
      const inputExtraFlags = isImageToVideo ? ['-loop', '1'] : [];
      const convArgs = getConversionArgs(inputExt, outputExt, profile, options);
      const fullArgs = [
        '-threads', String(profile.decoderThreads),
        ...inputExtraFlags,
        '-i', inputPath,
        '-stats',
        ...convArgs,
        outputPath
      ];

      context.onLog(`[FFmpeg MT] Executando: ffmpeg ${fullArgs.join(' ')}`);
      context.onProgress(0, 'Iniciando processamento...');

      let abortError: Error | null = null;
      let lastActivityTime = Date.now();
      let startedEncoding = false;
      let checkInterval: any;
      let timer: any;

      const logListener = ({ message }: { message: string }) => {
        if (message.includes('Aborted()') || message.includes('abort(')) {
          abortError = new Error(`FFmpeg MT abortou: ${message}`);
        }
        if (message.includes('frame=') || message.includes('time=')) {
          startedEncoding = true;
          lastActivityTime = Date.now();
        } else if (startedEncoding) {
          // Any active log during container finalization/muxing updates the watchdog
          lastActivityTime = Date.now();
        }

        if (message.includes('Starting second pass') || message.includes('moving the moov atom')) {
          context.onProgress(99, 'Finalizando contêiner MP4 e organizando metadados (faststart)...');
        }
      };
      ffmpeg.on('log', logListener);

      const timeoutPromise = new Promise<number>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('Tempo limite excedido na execução do FFmpeg MT (timeout total de 120s).'));
        }, 120_000);
      });

      const abortPromise = new Promise<number>((_, reject) => {
        checkInterval = setInterval(() => {
          if (abortError) {
            clearInterval(checkInterval);
            reject(abortError);
          } else if (startedEncoding && (Date.now() - lastActivityTime > 10_000)) {
            clearInterval(checkInterval);
            reject(new Error('FFmpeg MT congelou: estagnação de quadros detectada (nenhum avanço por 10 segundos).'));
          }
        }, 200);
      });

      let exitCode: number;
      try {
        exitCode = await Promise.race([ffmpeg.exec(fullArgs), timeoutPromise, abortPromise]);
      } finally {
        ffmpeg.off('log', logListener);
        clearTimeout(timer);
        clearInterval(checkInterval);
      }

      if (exitCode !== 0) {
        throw new Error(`FFmpeg MT finalizou com código de erro ${exitCode}. Verifique os logs para detalhes.`);
      }

      context.onProgress(99, 'Lendo arquivo de saída gerado da memória...');
      const outputData = await ffmpeg.readFile(outputPath);

      if (typeof outputData === 'string') {
        throw new Error('Retorno inesperado do FFmpeg MT. Esperado Uint8Array.');
      }

      context.onProgress(100, 'Conversão concluída com sucesso!');
      context.onLog(`[FFmpeg MT] Arquivo gerado: ${outputFileName} (${(outputData.byteLength / 1024 / 1024).toFixed(2)} MB)`);

      const mimeType = getMimeType(outputExt);
      const outputBlob = new Blob([outputData.buffer as unknown as BlobPart], { type: mimeType });

      return {
        outputData: outputData,
        outputBlob: outputBlob,
        outputFileName: outputFileName,
        outputSize: outputData.byteLength,
        mimeType: mimeType,
      };
    } catch (runErr: any) {
      const message = runErr instanceof Error ? (runErr.stack || runErr.message) : String(runErr);
      if (message.includes('memory') || message.includes('abort') || message.includes('Aborted')) {
        resetFFmpegMT();
      }
      if (message.includes('memory access out of bounds')) {
        throw new Error(
          'O arquivo é muito grande ou exigiu mais memória que o limite WebAssembly de 32 bits (2 GB). Para converter para MP4 use o motor "Remux Direto (Cópia Sem Perdas)" que é instantâneo e não consome memória.'
        );
      }
      throw runErr;
    } finally {
      if (ffmpeg) {
        if (mountedWorkDir) {
          try {
            await ffmpeg.unmount(workDir);
          } catch (_e) {
            /* noop */
          }
          try {
            await ffmpeg.deleteDir(workDir);
          } catch (_e) {
            /* noop */
          }
        } else {
          try {
            await ffmpeg.deleteFile(inputPath);
          } catch (_e) {
            /* noop */
          }
        }
        try {
          await ffmpeg.deleteFile(outputPath);
        } catch (_e) {
          /* noop */
        }
      }
      currentContext = null;
    }

  }
};
