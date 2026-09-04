import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../tests/fixtures');

test.describe('Delta Debugging (DDmin) Conversion Testing Engine', () => {
  test('executes targeted MKV -> WebM conversion with full modifier stack via FFmpeg MT', async ({ page }) => {
    test.setTimeout(45_000);

    await page.goto('/converter/mkv-para-mp4');
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'visible' });

    const fixturePath = path.join(fixturesDir, 'sample.mkv');
    const fileBytes = Array.from(fs.readFileSync(fixturePath));

    const ddResult = await page.evaluate(async ({ fileBytes }) => {
      const { ModuleRegistry } = await import('/src/modules/registry.ts');
      const { resetFFmpegMT } = await import('/src/modules/ffmpeg-mt.ts');
      const {
        runDeltaDebugging,
        getApplicableModifierPool,
      } = await import('/src/core/testing/deltaDebugger.ts');

      resetFFmpegMT();
      const ffmpegMt = ModuleRegistry['ffmpeg-core-mt'];
      const pool = getApplicableModifierPool('.mkv', '.webm', ffmpegMt.manifest);

      const result = await runDeltaDebugging(
        'mkv',
        'webm',
        'ffmpeg-core-mt',
        pool,
        async (modifiers) => {
          resetFFmpegMT();
          const u8 = new Uint8Array([...fileBytes]);
          const logs: string[] = [];

          try {
            const out = await ffmpegMt.execute(
              {
                fileData: u8,
                originalName: 'sample.mkv',
                targetFormat: '.webm',
                modifiers,
              },
              {
                onProgress: () => {},
                onLog: (m: string) => logs.push(m),
                workspacePath: '/workspace',
              }
            );
            const ok = Boolean(out && out.outputData && out.outputData.byteLength > 0);
            return { success: ok, logs };
          } catch (err) {
            return { success: false, error: String(err), logs };
          }
        }
      );

      return result;
    }, { fileBytes });

    console.log('MKV -> WebM DDmin Result:', ddResult);
    expect(ddResult.status).toBe('PASS');
    expect(ddResult.maximalPassed).toBe(true);
  });

  test('DDmin accurately isolates minimal failing modifier when a simulated conflict occurs', async ({ page }) => {
    await page.goto('/converter/mkv-para-mp4');
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'visible' });

    const result = await page.evaluate(async () => {
      const { runDeltaDebugging } = await import('/src/core/testing/deltaDebugger.ts');

      const mockPool = [
        { id: 'fps' as const, description: 'FPS 24', patch: { customFps: 24 } },
        { id: 'resolution' as const, description: 'Resolution 720p', patch: { resolutionScale: '720p' as const } },
        { id: 'quality' as const, description: 'Quality Balanced', patch: { qualityPreset: 'balanced' as const } },
        { id: 'audio_codec' as const, description: 'Incompatible Codec', patch: { audioCodec: 'vorbis' as const } },
      ];

      // Simulated engine that fails whenever 'audio_codec' is in activeCategories
      const mockExecute = async (modifiers: any) => {
        if (modifiers.activeCategories?.includes('audio_codec')) {
          return { success: false, error: 'Vorbis audio codec unsupported for target container' };
        }
        return { success: true };
      };

      return await runDeltaDebugging('mkv', 'mp4', 'mock-engine', mockPool, mockExecute);
    });

    expect(result.status).toBe('FAIL_SINGLETON');
    expect(result.minimalFailingModifiers?.[0]?.id).toBe('audio_codec');
    expect(result.error).toContain('Vorbis audio codec unsupported');
  });
});
