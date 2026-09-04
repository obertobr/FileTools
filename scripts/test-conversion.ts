/**
 * scripts/test-conversion.ts
 *
 * Scoped CLI Runner with Delta Debugging for FileTools Conversions.
 *
 * Usage:
 *   npx tsx scripts/test-conversion.ts --from=mkv --to=webm
 *   npx tsx scripts/test-conversion.ts --from=mkv --engine=ffmpeg-core-mt
 *   npx tsx scripts/test-conversion.ts --from=mkv
 *   npm run test:conversion -- --from=mkv --to=webm
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('@playwright/test');
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  runDeltaDebugging,
  getApplicableModifierPool,
  combineModifierPatches,
} from '../src/core/testing/deltaDebugger.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

interface CliArgs {
  from?: string;
  to?: string;
  engine?: string;
  file?: string;
  dd: boolean;
  all: boolean;
  verbose: boolean;
  videoCodec?: string;
  audioCodec?: string;
  resolution?: string;
  fps?: number;
  quality?: string;
  allOptions: boolean;
  baseline: boolean;
}

function parseCliArgs(): CliArgs {
  const args = process.argv.slice(2);
  const options: CliArgs = {
    dd: true,
    all: false,
    verbose: false,
    allOptions: false,
    baseline: false,
  };

  // Support both process.argv and npm_config_* environment variables
  // Note: npm expands '--to' to '--token-description' via npm_config_token_description
  if (process.env.npm_config_from) options.from = process.env.npm_config_from.toLowerCase().replace(/^\./, '');
  if (process.env.npm_config_to) options.to = process.env.npm_config_to.toLowerCase().replace(/^\./, '');
  if (process.env.npm_config_token_description) options.to = process.env.npm_config_token_description.toLowerCase().replace(/^\./, '');
  if (process.env.npm_config_target) options.to = process.env.npm_config_target.toLowerCase().replace(/^\./, '');
  if (process.env.npm_config_engine) options.engine = process.env.npm_config_engine;
  if (process.env.npm_config_file) options.file = process.env.npm_config_file;
  if (process.env.npm_config_baseline === 'true') options.baseline = true;
  if (process.env.npm_config_all === 'true') options.all = true;
  if (process.env.npm_config_all_options === 'true') options.allOptions = true;
  if (process.env.npm_config_verbose === 'true') options.verbose = true;
  if (process.env.npm_config_dd === 'false' || process.env.npm_config_no_dd === 'true') options.dd = false;

  for (const arg of args) {
    if (arg.startsWith('--from=')) options.from = arg.split('=')[1].toLowerCase().replace(/^\./, '');
    else if (arg.startsWith('--to=')) options.to = arg.split('=')[1].toLowerCase().replace(/^\./, '');
    else if (arg.startsWith('--target=')) options.to = arg.split('=')[1].toLowerCase().replace(/^\./, '');
    else if (arg.startsWith('--token-description=')) options.to = arg.split('=')[1].toLowerCase().replace(/^\./, '');
    else if (arg.startsWith('--engine=')) options.engine = arg.split('=')[1];
    else if (arg.startsWith('--file=')) options.file = arg.split('=')[1];
    else if (arg.startsWith('--video-codec=')) options.videoCodec = arg.split('=')[1];
    else if (arg.startsWith('--audio-codec=')) options.audioCodec = arg.split('=')[1];
    else if (arg.startsWith('--resolution=')) options.resolution = arg.split('=')[1];
    else if (arg.startsWith('--fps=')) options.fps = Number(arg.split('=')[1]);
    else if (arg.startsWith('--quality=')) options.quality = arg.split('=')[1];
    else if (arg === '--all-options') options.allOptions = true;
    else if (arg === '--baseline') options.baseline = true;
    else if (arg === '--no-dd') options.dd = false;
    else if (arg === '--all') options.all = true;
    else if (arg === '--verbose' || arg === '-v') options.verbose = true;
  }

  return options;
}

function selectFixtureForExt(ext: string, customPath?: string): string {
  if (customPath && fs.existsSync(customPath)) return customPath;

  const clean = ext.toLowerCase().replace(/^\./, '');
  const candidate = path.join(projectRoot, 'tests', 'fixtures', `sample.${clean}`);
  if (fs.existsSync(candidate)) return candidate;

  // Fallback to sample.mkv or sample.mp4
  const fallbackMkv = path.join(projectRoot, 'tests', 'fixtures', 'sample.mkv');
  if (fs.existsSync(fallbackMkv)) return fallbackMkv;

  throw new Error(`Nenhum arquivo de teste encontrado para a extensão '.${clean}'`);
}

async function main() {
  const options = parseCliArgs();

  console.log('\n======================================================');
  console.log('   FileTools - Delta Debugging Conversion Test Runner  ');
  console.log('======================================================\n');
  console.log(`Filtros: from=${options.from || '*'} | to=${options.to || '*'} | engine=${options.engine || '*'}`);
  console.log(`Delta Debugging: ${options.dd ? 'ATIVO (ddmin)' : 'DESATIVADO'}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Polyfill __name for esbuild/tsx browser evaluation
  await page.addInitScript(() => {
    (window as any).__name = (fn: any) => fn;
  });

  // Forward browser console logs if verbose
  if (options.verbose) {
    page.on('console', (msg) => console.log(`  [Browser] ${msg.text()}`));
  }

  // Navigate to warm up WASM context and load modules
  await page.goto('http://localhost:4321/converter/mkv-para-mp4');
  await page.locator('[data-hydrated="true"]').waitFor({ state: 'visible', timeout: 30_000 });

  // Ensure __name exists in the page window
  await page.evaluate(() => {
    (window as any).__name = (fn: any) => fn;
  });

  // Get matching conversion pairs and manifests inside browser
  const plan = await page.evaluate(({ fromFilter, toFilter, engineFilter, isAll }) => {
    return (async () => {
      const reg = await import('/src/modules/registry.ts');
      const convLib = await import('/src/lib/converters.ts');

      const allConvs = convLib.generateConverters(reg.getAllManifests());
      const manifests = reg.getAllManifests();

      const filtered = allConvs.filter((c) => {
        const matchFrom = !fromFilter || c.from.toLowerCase() === fromFilter;
        const matchTo = !toFilter || c.to.toLowerCase() === toFilter;
        return matchFrom && matchTo;
      });

      return {
        conversions: filtered.map((c) => ({ from: c.from.toLowerCase(), to: c.to.toLowerCase() })),
        manifests: manifests.map((m) => ({
          id: m.id,
          name: m.name,
          supportedModifiers: m.supportedModifiers || [],
        })),
      };
    })();
  }, {
    fromFilter: options.from,
    toFilter: options.to,
    engineFilter: options.engine,
    isAll: options.all,
  });

  if (plan.conversions.length === 0) {
    console.log('⚠️ Nenhuma conversão encontrada para os filtros especificados.');
    await browser.close();
    return;
  }

  console.log(`Total de pares encontrados para teste: ${plan.conversions.length}\n`);

  const results = [];

  for (const conv of plan.conversions) {
    const fixturePath = selectFixtureForExt(conv.from, options.file);
    const fileBase64 = fs.readFileSync(fixturePath).toString('base64');
    const originalName = path.basename(fixturePath);

    const targetEngine = options.engine || 'ffmpeg-core-mt';
    process.stdout.write(`• Testando [${conv.from.toUpperCase()} -> ${conv.to.toUpperCase()}] (${targetEngine})... `);

    let ddResult: any;
    let lastFrameTime = 0;
    let startedEncoding = false;
    let isStalled = false;
    let stallInterval: NodeJS.Timeout | null = null;
    let overallTimer: NodeJS.Timeout | null = null;

    const consoleHandler = (msg: any) => {
      const text = msg.text();
      if (options.verbose) {
        console.log(`  [Browser] ${text}`);
      }
      if (text.includes('frame=') || text.includes('time=')) {
        startedEncoding = true;
        lastFrameTime = Date.now();
      }
    };

    page.on('console', consoleHandler);

    try {
      await page.evaluate(async () => {
        (window as any).__name = (fn: any) => fn;
        try {
          const { resetFFmpegMT } = await import('/src/modules/engines/ffmpeg-mt.ts');
          resetFFmpegMT();
        } catch {}
      });

      const manifest = plan.manifests.find((m: any) => m.id === targetEngine);
      let pool = getApplicableModifierPool('.' + conv.from, '.' + conv.to, manifest);

      // Apply any specific option overrides from CLI
      if (options.videoCodec) {
        pool = pool.filter((p: any) => p.id !== 'video_codec');
        pool.push({
          id: 'video_codec',
          description: `Codec de vídeo customizado (${options.videoCodec})`,
          patch: { videoCodec: options.videoCodec },
        });
      }
      if (options.audioCodec) {
        pool = pool.filter((p: any) => p.id !== 'audio_codec');
        pool.push({
          id: 'audio_codec',
          description: `Codec de áudio customizado (${options.audioCodec})`,
          patch: { audioCodec: options.audioCodec },
        });
      }
      if (options.resolution) {
        pool = pool.filter((p: any) => p.id !== 'resolution');
        const res = options.resolution;
        const wMap: Record<string, { w: number; h?: number }> = {
          '1080p': { w: 1920, h: -2 },
          '720p': { w: 1280, h: -2 },
          '480p': { w: 854, h: -2 },
          '320p': { w: 480, h: -2 },
          'cif': { w: 352, h: 288 },
          'qcif': { w: 176, h: 144 },
          'sub-qcif': { w: 128, h: 96 },
        };
        const dims = wMap[res] || { w: parseInt(res, 10) || 1280, h: -2 };
        pool.push({
          id: 'resolution',
          description: `Resolução customizada (${res})`,
          patch: { resolutionScale: res, targetWidth: dims.w, targetHeight: dims.h },
        });
      }
      if (options.fps) {
        pool = pool.filter((p: any) => p.id !== 'fps');
        pool.push({
          id: 'fps',
          description: `FPS customizado (${options.fps})`,
          patch: { customFps: options.fps, targetFps: options.fps, isCustomFps: true },
        });
      }
      if (options.quality) {
        pool = pool.filter((p: any) => p.id !== 'quality');
        const q = options.quality;
        const crfVal = q === 'original' ? 18 : (q === 'balanced' ? 23 : (q === 'compressed' ? 28 : (parseInt(q, 10) || 23)));
        pool.push({
          id: 'quality',
          description: `Qualidade customizada (${q})`,
          patch: { qualityPreset: q, targetCrf: crfVal },
        });
      }

      const execute = async (modifiers: any, stageLabel?: string) => {
        if (stageLabel) {
          console.log(`\n  [DDmin] ${stageLabel}`);
        }
        try {
          return await page.evaluate(async ({
            fileBase64,
            originalName,
            toExt,
            engineId,
            modifiers,
          }) => {
            const { ModuleRegistry } = await import('/src/modules/registry.ts');
            const moduleInstance = ModuleRegistry[engineId];
            if (!moduleInstance) {
              return { success: false, error: `Motor '${engineId}' não encontrado no ModuleRegistry.`, logs: [] };
            }

            const binStr = atob(fileBase64);
            const u8 = new Uint8Array(binStr.length);
            for (let i = 0; i < binStr.length; i++) {
              u8[i] = binStr.charCodeAt(i);
            }

            const logs: string[] = [];
            try {
              const out = await moduleInstance.execute(
                {
                  fileData: u8,
                  originalName,
                  targetFormat: '.' + toExt,
                  modifiers,
                },
                {
                  onProgress: (p, msg) => {
                    if (msg) console.log(`[Progress ${p}%] ${msg}`);
                  },
                  onLog: (m: string) => {
                    logs.push(m);
                    console.log(m);
                  },
                  workspacePath: '/workspace',
                }
              );
              const ok = Boolean(out && (out.outputBlob || (out.outputData && out.outputData.byteLength > 0)));
              return { success: ok, logs: logs.slice(-6) };
            } catch (err) {
              return { success: false, error: String(err), logs: logs.slice(-6) };
            }
          }, {
            fileBase64,
            originalName,
            toExt: conv.to,
            engineId: targetEngine,
            modifiers,
          });
        } catch (err: any) {
          return { success: false, error: String(err?.message || err), logs: [] };
        }
      };

      const t0 = Date.now();
      let executionPromise: Promise<any>;

      if (options.baseline) {
        executionPromise = (async () => {
          const res = await execute({
            activeCategories: [],
            selectedAudioTracks: [],
            selectedSubtitleTracks: [],
            keepAllSubtitles: true,
          }, 'Baseline direto (sem modificadores)');
          return {
            from: conv.from,
            to: conv.to,
            engineId: targetEngine,
            status: res.success ? 'PASS' : 'FAIL_BASELINE',
            iterations: 1,
            maximalPassed: false,
            baselinePassed: res.success,
            error: res.error,
            logs: res.logs,
            durationMs: Date.now() - t0,
          };
        })();
      } else if (options.allOptions) {
        executionPromise = (async () => {
          const poolMods = combineModifierPatches(pool);
          const res = await execute(poolMods, 'Modificadores combinados totais');
          return {
            from: conv.from,
            to: conv.to,
            engineId: targetEngine,
            status: res.success ? 'PASS' : 'FAIL_BASELINE',
            iterations: 1,
            maximalPassed: res.success,
            error: res.error,
            logs: res.logs,
            durationMs: Date.now() - t0,
          };
        })();
      } else {
        executionPromise = runDeltaDebugging(conv.from, conv.to, targetEngine, pool, execute);
      }

      // Stall Watchdog in Node.js (10s threshold for heavy moov atom relocation)
      const stallPromise = new Promise((_, reject) => {
        stallInterval = setInterval(() => {
          if (startedEncoding && lastFrameTime > 0 && Date.now() - lastFrameTime > 10_000) {
            isStalled = true;
            if (stallInterval) clearInterval(stallInterval);
            reject(new Error('ESTAGNAÇÃO DE QUADROS (STALL): Motor FFmpeg travou sem emitir frames ou progresso por mais de 10 segundos.'));
          }
        }, 500);
      });

      // Overall hard timeout (120 seconds, unref'd so it doesn't block process exit)
      const overallTimeoutPromise = new Promise((_, reject) => {
        overallTimer = setTimeout(() => {
          reject(new Error('TIMEOUT TOTAL EXCEDIDO (120s): A conversão não completou no tempo limite.'));
        }, 120_000);
        overallTimer.unref?.();
      });

      ddResult = await Promise.race([executionPromise, stallPromise, overallTimeoutPromise]);
    } catch (err: any) {
      // Reload page to reset crashed/deadlocked WASM workers
      await page.reload();
      await page.locator('[data-hydrated="true"]').waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});

      ddResult = {
        from: conv.from,
        to: conv.to,
        engineId: targetEngine,
        status: 'FAIL_BASELINE',
        iterations: 1,
        maximalPassed: false,
        baselinePassed: false,
        error: String(err?.message || err),
        durationMs: 6000,
      };
    } finally {
      if (stallInterval) clearInterval(stallInterval);
      if (overallTimer) clearTimeout(overallTimer);
      page.off('console', consoleHandler);
    }

    results.push(ddResult);

    if (ddResult.status === 'PASS') {
      console.log(`✅ PASS (${ddResult.iterations} iteração, ${(ddResult.durationMs / 1000).toFixed(1)}s)`);
    } else if (ddResult.status === 'FAIL_BASELINE') {
      console.log(`🚨 FAIL NO BASELINE! (${ddResult.iterations} iterações)`);
      console.log(`     Erro: ${ddResult.error}`);
      if (ddResult.logs && ddResult.logs.length > 0) {
        console.log(`     Logs: ${ddResult.logs.join(' | ')}`);
      }
    } else if (ddResult.status === 'FAIL_SINGLETON') {
      const mod = ddResult.minimalFailingModifiers?.[0];
      console.log(`🎯 FALHA ISOLADA no modificador '${mod?.id}'! (${ddResult.iterations} iterações)`);
      console.log(`     Modificador: ${mod?.description}`);
      console.log(`     Erro: ${ddResult.error}`);
      if (ddResult.logs && ddResult.logs.length > 0) {
        console.log(`     Logs: ${ddResult.logs.join(' | ')}`);
      }
    } else if (ddResult.status === 'FAIL_INTERACTION') {
      const ids = ddResult.minimalFailingModifiers?.map((m: any) => m.id).join(' + ');
      console.log(`🎯 INTERAÇÃO CONFLITANTE isolada: [${ids}]! (${ddResult.iterations} iterações)`);
      console.log(`     Erro: ${ddResult.error}`);
      if (ddResult.logs && ddResult.logs.length > 0) {
        console.log(`     Logs: ${ddResult.logs.join(' | ')}`);
      }
    }
  }

  await browser.close();

  // Summary
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.length - passed;

  console.log('\n======================================================');
  console.log(`   Resumo dos Testes: ${passed} Aprovados, ${failed} Falhas (${results.length} total)`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Erro fatal no executor de testes de conversão:', err);
  process.exit(1);
});
