import { describe, it, expect } from 'vitest';
import {
  runDeltaDebugging,
  combineModifierPatches,
  getApplicableModifierPool,
  type ModifierPatch,
} from './deltaDebugger';

describe('Delta Debugger (DDmin)', () => {
  it('combines patches correctly and deduplicates activeCategories', () => {
    const patches: ModifierPatch[] = [
      { id: 'fps', description: 'FPS 24', patch: { customFps: 24 } },
      { id: 'resolution', description: '720p', patch: { resolutionScale: '720p' } },
    ];

    const combined = combineModifierPatches(patches);
    expect(combined.activeCategories).toEqual(['fps', 'resolution']);
    expect(combined.customFps).toBe(24);
    expect(combined.resolutionScale).toBe('720p');
  });

  it('builds valid modifier pool respecting engine manifest supportedModifiers', () => {
    const pool = getApplicableModifierPool('.mkv', '.webm', {
      id: 'mock-engine',
      name: 'Mock Engine',
      version: '1.0',
      description: 'Mock',
      category: 'video',
      supportedModifiers: ['fps', 'resolution'],
      supportedConversions: [],
      inputs: [],
      outputs: [],
    });

    expect(pool.map((p) => p.id)).toEqual(['fps', 'resolution']);
  });

  it('returns PASS in 2 iterations when baseline and maximal modifiers both succeed', async () => {
    const pool: ModifierPatch[] = [
      { id: 'fps', description: 'FPS', patch: { customFps: 24 } },
      { id: 'resolution', description: 'Res', patch: { resolutionScale: '720p' } },
      { id: 'quality', description: 'Quality', patch: { qualityPreset: 'balanced' } },
    ];

    let callCount = 0;
    const res = await runDeltaDebugging('mkv', 'webm', 'engine-mock', pool, async () => {
      callCount++;
      return { success: true };
    });

    expect(res.status).toBe('PASS');
    expect(res.baselinePassed).toBe(true);
    expect(res.maximalPassed).toBe(true);
    expect(res.iterations).toBe(2);
    expect(callCount).toBe(2);
  });

  it('detects FAIL_BASELINE when baseline conversion without modifiers fails', async () => {
    const pool: ModifierPatch[] = [
      { id: 'fps', description: 'FPS', patch: { customFps: 24 } },
      { id: 'resolution', description: 'Res', patch: { resolutionScale: '720p' } },
    ];

    const res = await runDeltaDebugging('mkv', 'broken', 'engine-mock', pool, async (mods) => {
      // Both maximal and baseline fail
      return { success: false, error: 'Container not supported by encoder' };
    });

    expect(res.status).toBe('FAIL_BASELINE');
    expect(res.baselinePassed).toBe(false);
    expect(res.error).toContain('Container not supported');
  });

  it('isolates FAIL_SINGLETON when a single specific modifier causes failure', async () => {
    const pool: ModifierPatch[] = [
      { id: 'fps', description: 'FPS', patch: { customFps: 24 } },
      { id: 'resolution', description: 'Resolution', patch: { resolutionScale: '720p' } },
      { id: 'video_codec', description: 'Bad Codec', patch: { videoCodec: 'theora' } },
      { id: 'threads', description: 'Threads', patch: { customThreads: 4 } },
    ];

    const res = await runDeltaDebugging('mkv', 'mp4', 'engine-mock', pool, async (mods) => {
      // Fails whenever video_codec is present
      if (mods.activeCategories.includes('video_codec')) {
        return { success: false, error: 'Codec theora not valid for MP4' };
      }
      return { success: true };
    });

    expect(res.status).toBe('FAIL_SINGLETON');
    expect(res.minimalFailingModifiers?.length).toBe(1);
    expect(res.minimalFailingModifiers?.[0].id).toBe('video_codec');
    expect(res.error).toContain('Codec theora not valid');
  });

  it('isolates FAIL_INTERACTION when a pair of modifiers interacts to cause failure', async () => {
    const pool: ModifierPatch[] = [
      { id: 'fps', description: 'FPS', patch: { customFps: 24 } },
      { id: 'resolution', description: 'Resolution', patch: { resolutionScale: '720p' } },
      { id: 'audio_merge', description: 'Audio Merge', patch: { selectedAudioTracks: [0, 1] } },
      { id: 'threads', description: 'Threads', patch: { customThreads: 4 } },
    ];

    const res = await runDeltaDebugging('mkv', 'webm', 'engine-mock', pool, async (mods) => {
      // Fails ONLY when BOTH resolution and audio_merge are active simultaneously
      if (mods.activeCategories.includes('resolution') && mods.activeCategories.includes('audio_merge')) {
        return { success: false, error: 'Filter graph conflict between scale and amix' };
      }
      return { success: true };
    });

    expect(res.status).toBe('FAIL_INTERACTION');
    const failingIds = res.minimalFailingModifiers?.map((m) => m.id).sort();
    expect(failingIds).toEqual(['audio_merge', 'resolution']);
    expect(res.error).toContain('Filter graph conflict');
  });
});
