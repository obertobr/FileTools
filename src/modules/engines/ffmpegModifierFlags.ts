import type { ConversionModifiers } from '@/shared/types/conversionModifiers';

export function extractFfmpegInputTrimFlags(options?: ConversionModifiers): string[] {
  if (!options?.activeCategories?.includes('media_trim')) return [];
  const flags: string[] = [];
  if (typeof options.trimStartSeconds === 'number' && options.trimStartSeconds > 0) {
    flags.push('-ss', String(options.trimStartSeconds));
  }
  if (typeof options.trimEndSeconds === 'number' && options.trimEndSeconds > 0) {
    flags.push('-to', String(options.trimEndSeconds));
  }
  return flags;
}

export function extractFfmpegExtraOutputFlags(options?: ConversionModifiers, argsSoFar: string[] = []): string[] {
  if (!options?.activeCategories) return [];
  if (argsSoFar.includes('-an')) return [];

  const flags: string[] = [];
  if (options.activeCategories.includes('audio_sample_rate') && options.audioSampleRate && options.audioSampleRate > 0) {
    flags.push('-ar', String(options.audioSampleRate));
  }
  if (options.activeCategories.includes('audio_channels') && options.audioChannels) {
    flags.push('-ac', String(options.audioChannels));
  }
  if (
    options.activeCategories.includes('audio_normalize') &&
    options.audioNormalize &&
    options.audioNormalize !== 'off' &&
    !argsSoFar.includes('-filter_complex')
  ) {
    flags.push(
      '-af',
      options.audioNormalize === 'ebu-r128' ? 'loudnorm=I=-14:LRA=11:TP=-1.5' : 'dynaudnorm'
    );
  }
  return flags;
}
