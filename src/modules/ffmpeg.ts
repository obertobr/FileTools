/**
 * src/modules/ffmpeg.ts
 *
 * FFmpeg WASM Single-Thread conversion engine (Reliable fallback).
 * Universal media processor without SharedArrayBuffer / COOP/COEP requirements.
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import type { IModule, ExecutionContext } from '../shared/types/module';
import type { ConversionModifiers } from '../shared/types/conversionModifiers';
import { categoryOfExtension } from '../lib/formats';

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
  const crfMap: Record<string, string> = {
    original: '18',
    balanced: '23',
    compressed: '28',
  };
  const crfVal = options?.targetCrf !== undefined
    ? String(options.targetCrf)
    : (options?.customCrf !== undefined
      ? String(options.customCrf)
      : (crfMap[options?.qualityPreset || 'original'] || '18'));

  const { pixFmt, profileArgs, isCustom: hasCustomPixFmt } = getPixelFormatAndBitDepth(options);

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
  const colorSpaceArgs = getColorSpaceArgs(options);

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
    const vCodec = userVideoCodec === 'vp8' ? 'libvpx' : (userVideoCodec === 'vp9' ? 'libvpx-vp9' : (userVideoCodec === 'hevc' ? 'libx265' : 'libx264'));
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

  // Audio encoder helper
  function getAudioCodecFlags(codec: string, audioExt: string, streamIdx?: number): string[] {
    const s = streamIdx !== undefined ? `:${streamIdx}` : '';
    const bArgs = effectiveAudioBitrate ? [`-b:a${s}`, effectiveAudioBitrate] : [];

    if (codec && codec !== 'auto') {
      if (codec === 'copy') return [`-c:a${s}`, 'copy'];
      if (codec === 'mp3') return [`-c:a${s}`, 'libmp3lame', `-qscale:a${s}`, '2', ...bArgs];
      if (codec === 'aac') return [`-c:a${s}`, 'aac', ...(bArgs.length > 0 ? bArgs : [`-b:a${s}`, '192k'])];
      if (codec === 'vorbis') return [`-c:a${s}`, 'libvorbis', `-qscale:a${s}`, '5', ...bArgs];
      if (codec === 'opus') return [`-c:a${s}`, 'libopus', `-ar${s}`, '48000', ...(bArgs.length > 0 ? bArgs : [`-b:a${s}`, '128k'])];
      if (codec === 'flac') return [`-c:a${s}`, 'flac'];
      if (codec === 'pcm') return [`-c:a${s}`, 'pcm_s16le'];
      if (codec === 'ac3') return [`-c:a${s}`, 'ac3', ...(bArgs.length > 0 ? bArgs : [`-b:a${s}`, '192k'])];
    }

    if (audioExt === '.mp3') return [`-c:a${s}`, 'libmp3lame', `-qscale:a${s}`, '2', ...bArgs];
    if (audioExt === '.wav') return [`-c:a${s}`, 'pcm_s16le'];
    if (audioExt === '.ogg') return [`-c:a${s}`, 'libvorbis', `-qscale:a${s}`, '5', ...bArgs];
    if (audioExt === '.flac') return [`-c:a${s}`, 'flac'];
    if (audioExt === '.m4a' || audioExt === '.aac') return [`-c:a${s}`, 'aac', ...(bArgs.length > 0 ? bArgs : [`-b:a${s}`, '192k'])];
    if (audioExt === '.opus') return [`-c:a${s}`, 'libopus', `-ar${s}`, '48000', ...(bArgs.length > 0 ? bArgs : [`-b:a${s}`, '128k'])];
    if (audioExt === '.wma') return [`-c:a${s}`, 'wmav2', ...(bArgs.length > 0 ? bArgs : [`-b:a${s}`, '128k'])];
    if (audioExt === '.aiff' || audioExt === '.aif') return [`-c:a${s}`, 'pcm_s16be'];
    if (audioExt === '.ac3') return [`-c:a${s}`, 'ac3', ...(bArgs.length > 0 ? bArgs : [`-b:a${s}`, '192k'])];
    if (audioExt === '.m4r') return [`-c:a${s}`, 'aac', ...(bArgs.length > 0 ? bArgs : [`-b:a${s}`, '192k']), '-f', 'ipod'];

    // Default container audio codec fallbacks
    if (audioExt === '.webm' || audioExt === '.ogv') return [`-c:a${s}`, 'libvorbis', ...bArgs];
    if (audioExt === '.avi') return [`-c:a${s}`, 'libmp3lame', ...bArgs];
    if (audioExt === '.wmv') return [`-c:a${s}`, 'wmav2', ...bArgs];
    if (audioExt === '.mpg' || audioExt === '.mpeg' || audioExt === '.vob') return [`-c:a${s}`, 'mp2', ...bArgs];
    return [`-c:a${s}`, 'aac', ...(bArgs.length > 0 ? bArgs : [`-b:a${s}`, '192k'])];
  }

  // Audio to Video with black screen
  if (isAudioToVideo) {
    const vCodec = userVideoCodec === 'vp8' ? 'libvpx' : (userVideoCodec === 'vp9' ? 'libvpx-vp9' : (userVideoCodec === 'hevc' ? 'libx265' : 'libx264'));
    const audioFlags = getAudioCodecFlags(userAudioCodec || 'auto', to);
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
      return getAudioCodecFlags(trackCodec, to, outputStreamIdx);
    });
  } else {
    audioCodecArgs = getAudioCodecFlags(userAudioCodec || 'auto', to);
  }

  const videoAudioFlags = isMute
    ? ['-map', '0:v:0', '-an']
    : [...audioMergeFilter, ...audioMapFlags, ...audioCodecArgs];

  // 4. Video to WebM
  if (to === '.webm') {
    const vCodec = 'libvpx';
    if (userVideoCodec === 'copy') return ['-c:v', 'copy', ...videoAudioFlags];
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
    let vCodec = 'libx264';
    if (userVideoCodec === 'hevc') vCodec = 'libx265';
    if (userVideoCodec === 'vp8') vCodec = 'libvpx';
    if (userVideoCodec === 'vp9') vCodec = 'libvpx-vp9';
    if (userVideoCodec === 'copy') vCodec = 'copy';
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
    let vCodec = 'mpeg4';
    if (userVideoCodec === 'h264') vCodec = 'libx264';
    if (userVideoCodec === 'copy') vCodec = 'copy';
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
    let vCodec = 'libx264';
    if (userVideoCodec === 'hevc') vCodec = 'libx265';
    if (userVideoCodec === 'copy') vCodec = 'copy';
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
    let vCodec = 'flv';
    if (userVideoCodec === 'h264') vCodec = 'libx264';
    if (userVideoCodec === 'copy') vCodec = 'copy';
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
      // Prioritize preserving user's explicit codec choice
      vCodec = userVideoCodec === 'mpeg4' ? 'mpeg4' : (userVideoCodec === 'h264' ? 'libx264' : 'h263');
    } else if (isCustomScale) {
      // Automatic fallback to mpeg4 only when user hasn't explicitly chosen h263
      vCodec = 'mpeg4';
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
    return [
      '-c:v', userVideoCodec === 'hevc' ? 'libx265' : 'libx264',
      ...(userVideoCodec === 'hevc' ? ['-preset', 'fast'] : getLibx264Args()),
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
  let vCodec = 'libx264';
  if (userVideoCodec === 'hevc') vCodec = 'libx265';
  if (userVideoCodec === 'mpeg4') vCodec = 'mpeg4';
  if (userVideoCodec === 'copy') vCodec = 'copy';

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

function getPixelFormatAndBitDepth(options?: ConversionModifiers): {
  pixFmt: string;
  profileArgs: string[];
  isCustom: boolean;
} {
  const isPixFmtActive = options?.activeCategories?.includes('pixel_format');
  const isBitDepthActive = options?.activeCategories?.includes('bit_depth');

  const rawPixFmt = isPixFmtActive && options?.pixelFormat && options.pixelFormat !== 'auto'
    ? options.pixelFormat
    : 'yuv420p';
  const rawBitDepth = isBitDepthActive && options?.bitDepth && options.bitDepth !== 'auto'
    ? options.bitDepth
    : '8bit';

  let chosenFmt = rawPixFmt;
  if (rawBitDepth === '10bit') {
    if (chosenFmt === 'yuv420p') chosenFmt = 'yuv420p10le';
    else if (chosenFmt === 'yuv422p') chosenFmt = 'yuv422p10le';
    else if (chosenFmt === 'yuv444p') chosenFmt = 'yuv444p10le';
    else if (chosenFmt === 'gray') chosenFmt = 'gray10le';
  } else if (rawBitDepth === '12bit') {
    if (chosenFmt === 'yuv420p') chosenFmt = 'yuv420p12le';
    else if (chosenFmt === 'yuv422p') chosenFmt = 'yuv422p12le';
    else if (chosenFmt === 'yuv444p') chosenFmt = 'yuv444p12le';
    else if (chosenFmt === 'gray') chosenFmt = 'gray12le';
  }

  const profileArgs: string[] = [];
  if (rawBitDepth === '10bit') {
    profileArgs.push('-profile:v', 'high10');
  }

  const isCustom = Boolean(
    (isPixFmtActive && options?.pixelFormat && options.pixelFormat !== 'auto') ||
    (isBitDepthActive && options?.bitDepth && options.bitDepth !== 'auto')
  );

  return {
    pixFmt: chosenFmt,
    profileArgs,
    isCustom,
  };
}

function getColorSpaceArgs(options?: ConversionModifiers): string[] {
  if (!options?.activeCategories?.includes('color_space') || !options.colorSpace || options.colorSpace === 'auto') {
    return [];
  }
  switch (options.colorSpace) {
    case 'bt709':
      return ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709'];
    case 'bt2020':
      return ['-colorspace', 'bt2020nc', '-color_primaries', 'bt2020', '-color_trc', 'arib-std-b67'];
    case 'smpte170m':
      return ['-colorspace', 'smpte170m', '-color_primaries', 'smpte170m', '-color_trc', 'smpte170m'];
    case 'bt470bg':
      return ['-colorspace', 'bt470bg', '-color_primaries', 'bt470bg', '-color_trc', 'bt470bg'];
    case 'srgb':
      return ['-colorspace', 'iec61966-2-1', '-color_primaries', 'bt709', '-color_trc', 'iec61966-2-1'];
    default:
      return [];
  }
}

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.mkv': 'video/x-matroska',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.flv': 'video/x-flv',
    '.wmv': 'video/x-ms-wmv',
    '.3gp': 'video/3gpp',
    '.ts': 'video/mp2t',
    '.mpg': 'video/mpeg',
    '.mpeg': 'video/mpeg',
    '.vob': 'video/dvd',
    '.m4v': 'video/x-m4v',
    '.ogv': 'video/ogg',
    '.gif': 'image/gif',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.opus': 'audio/opus',
    '.wma': 'audio/x-ms-wma',
    '.aiff': 'audio/aiff',
    '.aif': 'audio/aiff',
    '.ac3': 'audio/ac3',
    '.m4r': 'audio/x-m4r',
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

    const fileData = inputs.fileData as Uint8Array;
    const originalName = inputs.originalName as string;
    const targetFormat = inputs.targetFormat as string;
    const options = (inputs.modifiers as ConversionModifiers) || (inputs.options as ConversionModifiers) || undefined;

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
