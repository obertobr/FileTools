/**
 * src/modules/ffmpeg.ts
 *
 * FFmpeg WASM Single-Thread conversion engine (Reliable fallback).
 * Universal media processor without SharedArrayBuffer / COOP/COEP requirements.
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';
import type { FFFSType } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import type { IModule, ExecutionContext } from '@/shared/types/module';
import type { ConversionModifiers } from '@/shared/types/conversionModifiers';
import { categoryOfExtension } from '@/lib/formats';
import { resolveVideoCodecEncoder } from '@/core/knowledge/videoCodecs';
import { getAudioCodecFlags } from '@/core/knowledge/audioCodecs';
import { resolveColorSpaceArgs, resolvePixelFormatAndBitDepth } from '@/core/knowledge/colorPresets';
import { resolveQualityCrf } from '@/core/knowledge/qualityPresets';
import { getMimeType } from '@/core/knowledge/mimeTypes';


let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoaded = false;
let currentContext: ExecutionContext | null = null;

let totalDuration = 0;
let currentSpeed = '';

export function resetFFmpeg(): void {
  if (ffmpegInstance) {
    try {
      ffmpegInstance.terminate();
    } catch (_e) {
      /* noop */
    }
    ffmpegInstance = null;
    ffmpegLoaded = false;
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

async function getFFmpeg(context: ExecutionContext): Promise<FFmpeg> {
  currentContext = context;
  if (ffmpegInstance && ffmpegLoaded) return ffmpegInstance;

  resetFFmpeg();

  ffmpegInstance = new FFmpeg();

  ffmpegInstance.on('log', ({ message }) => {
    currentContext?.onLog(`[FFmpeg] ${message}`);

    if (message.includes('Duration:')) {
      const dur = parseDurationSeconds(message);
      if (dur && dur > 0) totalDuration = dur;
    }

    if (message.includes('time=')) {
      const currentTime = parseCurrentTimeSeconds(message);
      const speedMatch = message.match(/speed=\s*([\d.]+x)/);
      if (speedMatch) currentSpeed = speedMatch[1];

      if (currentTime !== null && totalDuration > 0 && currentContext) {
        const percent = Math.min(99, Math.max(1, Math.round((currentTime / totalDuration) * 100)));
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

function getConversionArgs(inputExt: string, outputExt: string, options?: ConversionModifiers): string[] {
  const from = inputExt.toLowerCase();
  const to = outputExt.toLowerCase();

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

  // Quality CRF tuning
  const crfVal = String(resolveQualityCrf(options));

  const { pixFmt, profileArgs, isCustom: hasCustomPixFmt } = resolvePixelFormatAndBitDepth(options);

  const getLibx264Args = () => [
    '-preset', 'fast',
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
      ...videoFpsArgs,
      ...videoScaleFilter,
      ...audioFlags,
    ];
  }


  // 1. GIF Output
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
        return ['-vn', '-an'];
      }
      if (selected.length === 1) {
        return [
          '-vn',
          '-map', `0:a:${selected[0]}`,
          ...getAudioCodecFlags(userAudioCodec || 'auto', to),
        ];
      }
      // Multiple tracks: mix with amix filter
      const filterInputs = selected.map((idx) => `[0:a:${idx}]`).join('');
      const amixFilter = `${filterInputs}amix=inputs=${selected.length}:duration=longest:dropout_transition=0[aout]`;
      return [
        '-filter_complex', amixFilter,
        '-map', '[aout]',
        '-vn',
        ...getAudioCodecFlags(userAudioCodec || 'auto', to),
      ];
    }
    return ['-vn', ...getAudioCodecFlags(userAudioCodec || 'auto', to)];
  }

  // 3. Audio to Audio Cross-Conversion
  if (audioExts.includes(from) && audioExts.includes(to)) {
    return [...getAudioCodecFlags(userAudioCodec || 'auto', to)];
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
      ...(effectiveVideoBitrate ? videoBitrateArgs : ['-b:v', '1.5M']),
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
      '-c:v', vCodec,
      ...(vCodec === 'libx264' ? getLibx264Args() : generalPixFmtArgs),
      ...videoBitrateArgs,
      ...colorSpaceArgs,
      ...videoScaleFilter,
      ...videoAudioFlags,
    ];
  }

  // 6. Video to AVI
  if (to === '.avi') {
    const vCodec = resolveVideoCodecEncoder(userVideoCodec, 'mpeg4');
    return [
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
      '-c:v', vCodec,
      ...(vCodec === 'libx265' ? ['-preset', 'fast'] : getLibx264Args()),
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


export const FFmpegModule: IModule = {
  manifest: {
    id: 'ffmpeg-core',
    name: 'FFmpeg WASM (Single-Thread)',
    version: '0.12.10',
    description: 'Motor de conversão de mídia local em CPU single-thread com alta compatibilidade.',
    category: 'video',
    supportedModifiers: [
      'video_codec',
      'audio_codec',
      'quality',
      'fps',
      'resolution',
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
        speedScore: 45,
        acceleration: 'cpu-singlethread',
        performanceNotes: 'Gera vídeo com tela preta e áudio original sincronizado em single-thread',
      },
      {
        from: ['image/*'],
        to: ['.mp4', '.mkv', '.webm', '.mov', '.avi', '.ts'],
        lossy: true,
        speedScore: 45,
        acceleration: 'cpu-singlethread',
        performanceNotes: 'Gera vídeo a partir de imagem estática em single-thread',
      },
      {
        from: ['video/*'],
        to: ['.mp4', '.mkv', '.webm', '.mov', '.avi', '.flv', '.wmv', '.3gp', '.ts', '.mpg', '.mpeg', '.vob', '.m4v', '.ogv'],
        lossy: true,
        speedScore: 45,
        acceleration: 'cpu-singlethread',
        performanceNotes: 'CPU single-thread padrão (seguro para baixa memória)',
      },
      {
        from: ['video/*'],
        to: ['.gif'],
        lossy: true,
        speedScore: 40,
        acceleration: 'cpu-singlethread',
        performanceNotes: 'Renderização de frames para GIF',
      },
      {
        from: ['video/*'],
        to: ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac', '.opus', '.wma', '.aiff', '.ac3', '.m4r'],
        lossy: true,
        speedScore: 50,
        acceleration: 'cpu-singlethread',
        performanceNotes: 'Extração de áudio de vídeos em single-thread',
      },
      {
        from: ['audio/*'],
        to: ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac', '.opus', '.wma', '.aiff', '.ac3', '.m4r'],
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

    const file = inputs.file as File | Blob | undefined;
    const fileData = inputs.fileData as Uint8Array | undefined;
    const originalName = inputs.originalName as string;
    const targetFormat = inputs.targetFormat as string;
    const options = (inputs.modifiers as ConversionModifiers) || (inputs.options as ConversionModifiers) || undefined;

    if ((!file && !fileData) || !originalName || !targetFormat) {
      throw new Error('FFmpeg module requires file (File/Blob) or fileData (Uint8Array), originalName, and targetFormat.');
    }

    const inputExt = '.' + originalName.split('.').pop()!.toLowerCase();
    const outputExt = '.' + targetFormat.replace(/^\.+/, '').toLowerCase();
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + outputExt;

    context.onLog(`[FFmpeg] Converting ${originalName} -> ${outputFileName}`);

    const ffmpeg = await getFFmpeg(context);
    let mountedWorkDir = false;
    const workDir = '/work';
    const fallbackInputPath = `input${inputExt}`;
    let inputPath = fallbackInputPath;
    const outputPath = `output${outputExt}`;

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
            const blobName = `input${inputExt}`;
            await ffmpeg.mount('WORKERFS' as FFFSType, {
              blobs: [{ name: blobName, data: targetFileOrBlob }],
            }, workDir);
            inputPath = `${workDir}/${blobName}`;
            mountedWorkDir = true;
          }

          context.onLog(`[FFmpeg] WORKERFS montado com sucesso em ${workDir} (Zero-RAM streaming).`);
        } catch (mountErr) {
          context.onLog(`[FFmpeg] WORKERFS indisponível (${mountErr}), utilizando gravação direta.`);
          mountedWorkDir = false;
        }
      }

      if (!mountedWorkDir) {
        inputPath = fallbackInputPath;
        context.onProgress(0, 'Carregando arquivo...');
        const dataToWrite: Uint8Array = fileData || new Uint8Array(await (file as File | Blob).arrayBuffer());
        await ffmpeg.writeFile(inputPath, dataToWrite);
      }

      const isImageToVideo = categoryOfExtension(inputExt) === 'image' && (categoryOfExtension(outputExt) === 'video' || outputExt === '.gif');
      const inputExtraFlags = isImageToVideo ? ['-loop', '1'] : [];
      const convArgs = getConversionArgs(inputExt, outputExt, options);
      const fullArgs = [...inputExtraFlags, '-i', inputPath, '-stats', ...convArgs, outputPath];

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

      const mimeType = getMimeType(outputExt);
      const outputBlob = new Blob([outputData.buffer as unknown as BlobPart], { type: mimeType });

      return {
        outputData: outputData,
        outputBlob: outputBlob,
        outputFileName: outputFileName,
        outputSize: outputData.byteLength,
        mimeType: mimeType,
      };
    } finally {
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
      currentContext = null;
    }
  },
};

