/**
 * src/core/testing/deltaDebugger.ts
 *
 * Automated Delta Debugging (DDmin) engine for FileTools conversions.
 * Tests conversions with the maximum possible valid modifiers and,
 * upon encountering any failure, systematically isolates the minimal
 * set of modifiers (or baseline container incompatibility) causing the error.
 *
 * Inspired by Andreas Zeller's DDmin algorithm (simplifying and isolating failure-inducing inputs).
 */

import type {
  ConversionModifiers,
  ModifierCategoryId,
} from '@/shared/types/conversionModifiers';
import { categoryOfExtension } from '@/lib/formats';
import type { ModuleManifest } from '@/shared/types/module';

export interface ModifierPatch {
  id: ModifierCategoryId;
  description: string;
  patch: Partial<ConversionModifiers>;
}

export interface DDminResult {
  from: string;
  to: string;
  engineId: string;
  status: 'PASS' | 'FAIL_BASELINE' | 'FAIL_SINGLETON' | 'FAIL_INTERACTION';
  iterations: number;
  maximalPassed: boolean;
  baselinePassed?: boolean;
  minimalFailingModifiers?: ModifierPatch[];
  error?: string;
  logs?: string[];
  durationMs: number;
}

/**
 * Combines an array of modifier patches into a full ConversionModifiers object.
 */
export function combineModifierPatches(
  patches: ModifierPatch[],
  baseOverrides: Partial<ConversionModifiers> = {}
): ConversionModifiers {
  const activeCategories: ModifierCategoryId[] = [];
  const merged: ConversionModifiers = {
    activeCategories,
    selectedAudioTracks: [0],
    selectedSubtitleTracks: [0],
    keepAllSubtitles: true,
    threadsMode: 'auto',
    qualityPreset: 'original',
    resolutionScale: 'original',
    videoCodec: 'auto',
    audioCodec: 'auto',
    videoDurationSeconds: 10,
    gifFps: 12,
    gifScaleWidth: 480,
    ...baseOverrides,
  };

  for (const item of patches) {
    Object.assign(merged, item.patch);
    if (!activeCategories.includes(item.id)) {
      activeCategories.push(item.id);
    }
  }

  merged.activeCategories = activeCategories;
  return merged;
}

/**
 * Builds the pool of valid, non-trivial modifier stress patches
 * applicable to a given conversion pair and engine manifest.
 */
export function getApplicableModifierPool(
  fromExt: string,
  toExt: string,
  manifest?: ModuleManifest
): ModifierPatch[] {
  const from = fromExt.toLowerCase().replace(/^\./, '');
  const to = toExt.toLowerCase().replace(/^\./, '');
  const fromCat = categoryOfExtension(from);
  const toCat = categoryOfExtension(to);
  const isVideoOutput = toCat === 'video';
  const isAudioOutput = toCat === 'audio';
  const isGifOutput = to === 'gif';

  const supportedMods = manifest?.supportedModifiers ?? [
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
  ];

  const pool: ModifierPatch[] = [];

  const isSupported = (id: ModifierCategoryId) => supportedMods.includes(id);

  // 1. Video Duration (Image -> Video only)
  if (fromCat === 'image' && isVideoOutput && isSupported('video_duration')) {
    pool.push({
      id: 'video_duration',
      description: 'Duração do vídeo gerado (5s)',
      patch: { videoDurationSeconds: 5, isCustomDuration: true },
    });
  }

  // 2. Framerate (FPS)
  if ((isVideoOutput || isGifOutput) && isSupported('fps')) {
    pool.push({
      id: 'fps',
      description: isGifOutput ? 'Taxa de quadros do GIF (15 fps)' : 'Taxa de quadros customizada (24 fps)',
      patch: isGifOutput ? { gifFps: 15 } : { customFps: 24, isCustomFps: true },
    });
  }

  // 3. Resolution and Scale
  if ((isVideoOutput || isGifOutput) && isSupported('resolution')) {
    pool.push({
      id: 'resolution',
      description: isGifOutput ? 'Escala do GIF (largura 320px)' : 'Resolução 720p',
      patch: isGifOutput ? { gifScaleWidth: 320 } : { resolutionScale: '720p' },
    });
  }

  // 4. Quality (Video only)
  if (isVideoOutput && isSupported('quality')) {
    pool.push({
      id: 'quality',
      description: 'Preset de qualidade balanceada',
      patch: { qualityPreset: 'balanced' },
    });
  }

  // 5. Threads / Multiprocessing
  if (isSupported('threads')) {
    pool.push({
      id: 'threads',
      description: 'Alocação customizada de 4 threads',
      patch: { threadsMode: 'custom', customThreads: 4, isCustomThreads: true },
    });
  }

  // 6. Audio Tracks Selection (Video -> Video)
  if (isVideoOutput && !isGifOutput && isSupported('audio_tracks')) {
    pool.push({
      id: 'audio_tracks',
      description: 'Manter primeira faixa de áudio ([0])',
      patch: { selectedAudioTracks: [0] },
    });
  }

  // 7. Audio Merge (Mix all tracks)
  if ((isAudioOutput || (isVideoOutput && !isGifOutput)) && isSupported('audio_merge')) {
    pool.push({
      id: 'audio_merge',
      description: 'Mesclar faixas de áudio ativas ([0])',
      patch: { selectedAudioTracks: [0] },
    });
  }

  // 8. Subtitles (Containers that support subtitles)
  if (['mp4', 'mkv', 'webm', 'mov', 'ts'].includes(to) && isSupported('subtitles')) {
    pool.push({
      id: 'subtitles',
      description: 'Gerenciar legendas com preservação ativa',
      patch: { selectedSubtitleTracks: [0], keepAllSubtitles: true },
    });
  }

  // 9. Video Codec
  if (isVideoOutput && isSupported('video_codec')) {
    pool.push({
      id: 'video_codec',
      description: 'Codec de vídeo compatível com o contêiner',
      patch: { videoCodec: 'auto' },
    });
  }

  // 10. Audio Codec
  if ((isVideoOutput || isAudioOutput) && !isGifOutput && isSupported('audio_codec')) {
    pool.push({
      id: 'audio_codec',
      description: 'Codec de áudio compatível com o contêiner',
      patch: { audioCodec: 'auto' },
    });
  }

  return pool;
}

/**
 * Executes Delta Debugging (DDmin) on a specific conversion target.
 *
 * Steps:
 * 1. Test maximal modifiers set (C_max). If it passes, early exit with PASS.
 * 2. If C_max fails, test baseline (C = empty). If baseline fails, report FAIL_BASELINE.
 * 3. If baseline passes, test 1-minimal singletons. If any single modifier fails, report FAIL_SINGLETON.
 * 4. If all singletons pass, run binary partition bisection on partitions and complements.
 */
export async function runDeltaDebugging(
  fromExt: string,
  toExt: string,
  engineId: string,
  pool: ModifierPatch[],
  executeConversion: (modifiers: ConversionModifiers) => Promise<{
    success: boolean;
    error?: string;
    logs?: string[];
  }>
): Promise<DDminResult> {
  const startTime = Date.now();
  let iterations = 0;

  // 1. Stage 1: Maximal Modifiers Stress Test (Fast-path)
  iterations++;
  const maximalModifiers = combineModifierPatches(pool);
  const maxRes = await executeConversion(maximalModifiers);

  if (maxRes.success) {
    return {
      from: fromExt,
      to: toExt,
      engineId,
      status: 'PASS',
      iterations,
      maximalPassed: true,
      durationMs: Date.now() - startTime,
    };
  }

  const initialError = maxRes.error;
  const initialLogs = maxRes.logs;

  // 2. Stage 2: Baseline Sanity Test (0 modifiers)
  iterations++;
  const baselineModifiers: ConversionModifiers = {
    activeCategories: [],
    selectedAudioTracks: [],
    selectedSubtitleTracks: [],
    keepAllSubtitles: true,
  };
  const baseRes = await executeConversion(baselineModifiers);

  if (!baseRes.success) {
    return {
      from: fromExt,
      to: toExt,
      engineId,
      status: 'FAIL_BASELINE',
      iterations,
      maximalPassed: false,
      baselinePassed: false,
      error: baseRes.error || initialError,
      logs: baseRes.logs || initialLogs,
      durationMs: Date.now() - startTime,
    };
  }

  // 3. Stage 3: Singleton 1-Minimal Checks
  for (const mod of pool) {
    iterations++;
    const singleMod = combineModifierPatches([mod]);
    const singleRes = await executeConversion(singleMod);

    if (!singleRes.success) {
      return {
        from: fromExt,
        to: toExt,
        engineId,
        status: 'FAIL_SINGLETON',
        iterations,
        maximalPassed: false,
        baselinePassed: true,
        minimalFailingModifiers: [mod],
        error: singleRes.error || initialError,
        logs: singleRes.logs || initialLogs,
        durationMs: Date.now() - startTime,
      };
    }
  }

  // 4. Stage 4: Recursive Partition Bisection (DDmin)
  let currentSet = [...pool];
  let n = 2;
  let lastError = initialError;
  let lastLogs = initialLogs;

  while (currentSet.length >= 2) {
    const subsetSize = Math.ceil(currentSet.length / n);
    const subsets: ModifierPatch[][] = [];
    for (let i = 0; i < currentSet.length; i += subsetSize) {
      subsets.push(currentSet.slice(i, i + subsetSize));
    }

    let reduced = false;

    // Test each partition
    for (const sub of subsets) {
      iterations++;
      const res = await executeConversion(combineModifierPatches(sub));
      if (!res.success) {
        currentSet = sub;
        n = 2;
        reduced = true;
        lastError = res.error;
        lastLogs = res.logs;
        break;
      }
    }

    if (!reduced) {
      // Test each complement
      for (const sub of subsets) {
        const complement = currentSet.filter((item) => !sub.includes(item));
        if (complement.length === 0) continue;

        iterations++;
        const res = await executeConversion(combineModifierPatches(complement));
        if (!res.success) {
          currentSet = complement;
          n = Math.max(n - 1, 2);
          reduced = true;
          lastError = res.error;
          lastLogs = res.logs;
          break;
        }
      }
    }

    if (!reduced) {
      if (n < currentSet.length) {
        n = Math.min(currentSet.length, 2 * n);
      } else {
        break;
      }
    }
  }

  return {
    from: fromExt,
    to: toExt,
    engineId,
    status: 'FAIL_INTERACTION',
    iterations,
    maximalPassed: false,
    baselinePassed: true,
    minimalFailingModifiers: currentSet,
    error: lastError,
    logs: lastLogs,
    durationMs: Date.now() - startTime,
  };
}
