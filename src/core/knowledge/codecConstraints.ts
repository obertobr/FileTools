/**
 * src/core/knowledge/codecConstraints.ts
 *
 * Central Knowledge Base for media codecs, containers, and format constraints.
 * Pure static data contracts — zero business logic or UI dependencies.
 */

export interface CodecConstraint {
  id: string;
  allowedResolutions?: string[];
  mutuallyExclusiveWith?: string[];
  implicitFilters?: string[];
  warningMessage?: string;
}

export interface ContainerConstraint {
  id: string;
  defaultVideoCodec?: string;
  defaultAudioCodec?: string;
  allowedVideoCodecs?: string[];
  allowedAudioCodecs?: string[];
  videoWarningMessage?: string;
  audioWarningMessage?: string;
}

/**
 * Technical constraints imposed by specific video codecs (e.g. H.263 resolution limits).
 */
export const VIDEO_CODEC_CONSTRAINTS: Record<string, CodecConstraint> = {
  'h263': {
    id: 'h263',
    allowedResolutions: ['cif', 'qcif', 'sub-qcif'],
    warningMessage: 'O codec H.263 limita a resolução a padrões CIF (CIF, QCIF, SUB-QCIF). Escolha MPEG-4 para resoluções HD.',
  },
};

/**
 * Container constraints defining allowed video/audio codecs and default codecs per format.
 */
export const CONTAINER_CONSTRAINTS: Record<string, ContainerConstraint> = {
  '3gp': {
    id: '3gp',
    defaultVideoCodec: 'h263',
    defaultAudioCodec: 'aac',
    allowedVideoCodecs: ['auto', 'h263', 'mpeg4', 'h264', 'copy'],
    allowedAudioCodecs: ['auto', 'aac', 'copy'],
  },
  'webm': {
    id: 'webm',
    defaultVideoCodec: 'vp8',
    defaultAudioCodec: 'opus',
    allowedVideoCodecs: ['auto', 'vp8', 'vp9', 'copy'],
    allowedAudioCodecs: ['auto', 'opus', 'vorbis', 'copy'],
    videoWarningMessage: 'Contêiner WebM suporta estritamente codecs VP8 ou VP9.',
    audioWarningMessage: 'Contêiner WebM suporta apenas Opus ou Vorbis.',
  },
  'mp4': {
    id: 'mp4',
    defaultVideoCodec: 'h264',
    defaultAudioCodec: 'aac',
    allowedVideoCodecs: ['auto', 'h264', 'hevc', 'mpeg4', 'copy'],
    allowedAudioCodecs: ['auto', 'aac', 'mp3', 'ac3', 'copy'],
  },
  'mov': {
    id: 'mov',
    defaultVideoCodec: 'h264',
    defaultAudioCodec: 'aac',
    allowedVideoCodecs: ['auto', 'h264', 'hevc', 'mpeg4', 'copy'],
    allowedAudioCodecs: ['auto', 'aac', 'mp3', 'ac3', 'copy'],
  },
  'mkv': {
    id: 'mkv',
    defaultVideoCodec: 'h264',
    defaultAudioCodec: 'aac',
    allowedVideoCodecs: ['auto', 'h264', 'hevc', 'vp8', 'vp9', 'mpeg4', 'theora', 'copy'],
    allowedAudioCodecs: ['auto', 'aac', 'mp3', 'opus', 'vorbis', 'flac', 'pcm', 'ac3', 'copy'],
  },
  'avi': {
    id: 'avi',
    defaultVideoCodec: 'mpeg4',
    defaultAudioCodec: 'mp3',
    allowedVideoCodecs: ['auto', 'mpeg4', 'h264', 'copy'],
    allowedAudioCodecs: ['auto', 'mp3', 'pcm', 'ac3', 'copy'],
  },
  'ogv': {
    id: 'ogv',
    defaultVideoCodec: 'theora',
    defaultAudioCodec: 'vorbis',
    allowedVideoCodecs: ['auto', 'theora', 'copy'],
    allowedAudioCodecs: ['auto', 'vorbis', 'opus', 'flac', 'copy'],
  },
  'm4v': {
    id: 'm4v',
    defaultVideoCodec: 'h264',
    defaultAudioCodec: 'aac',
    allowedVideoCodecs: ['auto', 'h264', 'hevc', 'mpeg4', 'copy'],
    allowedAudioCodecs: ['auto', 'aac', 'mp3', 'ac3', 'copy'],
  },
  'ts': {
    id: 'ts',
    defaultVideoCodec: 'h264',
    defaultAudioCodec: 'aac',
    allowedVideoCodecs: ['auto', 'h264', 'hevc', 'copy'],
    allowedAudioCodecs: ['auto', 'aac', 'mp3', 'ac3', 'copy'],
  },
  'flv': {
    id: 'flv',
    defaultVideoCodec: 'h264',
    defaultAudioCodec: 'aac',
    allowedVideoCodecs: ['auto', 'h264', 'copy'],
    allowedAudioCodecs: ['auto', 'aac', 'mp3', 'copy'],
  },
  'mpg': {
    id: 'mpg',
    defaultVideoCodec: 'mpeg4',
    defaultAudioCodec: 'mp3',
    allowedVideoCodecs: ['auto', 'mpeg4', 'copy'],
    allowedAudioCodecs: ['auto', 'mp3', 'copy'],
  },
  'mpeg': {
    id: 'mpeg',
    defaultVideoCodec: 'mpeg4',
    defaultAudioCodec: 'mp3',
    allowedVideoCodecs: ['auto', 'mpeg4', 'copy'],
    allowedAudioCodecs: ['auto', 'mp3', 'copy'],
  },
  'vob': {
    id: 'vob',
    defaultVideoCodec: 'mpeg4',
    defaultAudioCodec: 'ac3',
    allowedVideoCodecs: ['auto', 'mpeg4', 'copy'],
    allowedAudioCodecs: ['auto', 'ac3', 'pcm', 'mp3', 'copy'],
  },
  'wmv': {
    id: 'wmv',
    defaultVideoCodec: 'mpeg4',
    defaultAudioCodec: 'mp3',
    allowedVideoCodecs: ['auto', 'copy'],
    allowedAudioCodecs: ['auto', 'copy'],
  },
  'mp3': {
    id: 'mp3',
    defaultAudioCodec: 'mp3',
    allowedAudioCodecs: ['auto', 'mp3', 'copy'],
  },
  'aac': {
    id: 'aac',
    defaultAudioCodec: 'aac',
    allowedAudioCodecs: ['auto', 'aac', 'copy'],
  },
  'm4a': {
    id: 'm4a',
    defaultAudioCodec: 'aac',
    allowedAudioCodecs: ['auto', 'aac', 'copy'],
  },
  'm4r': {
    id: 'm4r',
    defaultAudioCodec: 'aac',
    allowedAudioCodecs: ['auto', 'aac', 'copy'],
  },
  'wav': {
    id: 'wav',
    defaultAudioCodec: 'pcm',
    allowedAudioCodecs: ['auto', 'pcm', 'copy'],
  },
  'ogg': {
    id: 'ogg',
    defaultAudioCodec: 'vorbis',
    allowedAudioCodecs: ['auto', 'vorbis', 'opus', 'flac', 'copy'],
  },
  'opus': {
    id: 'opus',
    defaultAudioCodec: 'opus',
    allowedAudioCodecs: ['auto', 'opus', 'copy'],
  },
  'flac': {
    id: 'flac',
    defaultAudioCodec: 'flac',
    allowedAudioCodecs: ['auto', 'flac', 'copy'],
  },
  'ac3': {
    id: 'ac3',
    defaultAudioCodec: 'ac3',
    allowedAudioCodecs: ['auto', 'ac3', 'copy'],
  },
};

/**
 * Resolves the effective video codec for a given target format and user codec selection.
 * If user codec is undefined or 'auto', uses container's default video codec (e.g. 3GP -> H.263).
 */
export function getEffectiveVideoCodec(targetFormat: string, userCodec?: string): string | undefined {
  if (userCodec && userCodec !== 'auto') {
    return userCodec;
  }
  const cleanExt = (targetFormat || '').toLowerCase().replace(/^\.+/, '');
  return CONTAINER_CONSTRAINTS[cleanExt]?.defaultVideoCodec;
}

/**
 * Retrieves the video codec constraint for the effective codec.
 */
export function getVideoCodecConstraint(targetFormat: string, userCodec?: string): CodecConstraint | undefined {
  const effectiveCodec = getEffectiveVideoCodec(targetFormat, userCodec);
  if (!effectiveCodec) return undefined;
  return VIDEO_CODEC_CONSTRAINTS[effectiveCodec];
}

/**
 * Retrieves container codec constraints.
 */
export function getContainerConstraint(targetFormat: string): ContainerConstraint | undefined {
  const cleanExt = (targetFormat || '').toLowerCase().replace(/^\.+/, '');
  return CONTAINER_CONSTRAINTS[cleanExt];
}
