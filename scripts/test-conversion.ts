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
}

function parseCliArgs(): CliArgs {
  const args = process.argv.slice(2);
  const options: CliArgs = {
    dd: true,
    all: false,
    verbose: false,
    allOptions: false,
  };

  // Support both process.argv and npm_config_* environment variables
  if (process.env.npm_config_from) options.from = process.env.npm_config_from.toLowerCase().replace(/^\./, '');
  if (process.env.npm_config_to) options.to = process.env.npm_config_to.toLowerCase().replace(/^\./, '');
  if (process.env.npm_config_engine) options.engine = process.env.npm_config_engine;
  if (process.env.npm_config_file) options.file = process.env.npm_config_file;

  for (const arg of args) {
    if (arg.startsWith('--from=')) options.from = arg.split('=')[1].toLowerCase().replace(/^\./, '');
    else if (arg.startsWith('--to=')) options.to = arg.split('=')[1].toLowerCase().replace(/^\./, '');
    else if (arg.startsWith('--engine=')) options.engine = arg.split('=')[1];
    else if (arg.startsWith('--file=')) options.file = arg.split('=')[1];
    else if (arg.startsWith('--video-codec=')) options.videoCodec = arg.split('=')[1];
    else if (arg.startsWith('--audio-codec=')) options.audioCodec = arg.split('=')[1];
    else if (arg.startsWith('--resolution=')) options.resolution = arg.split('=')[1];
    else if (arg.startsWith('--fps=')) options.fps = Number(arg.split('=')[1]);
    else if (arg.startsWith('--quality=')) options.quality = arg.split('=')[1];
    else if (arg === '--all-options') options.allOptions = true;
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

    const ddResult = await page.evaluate(async ({
      fileBase64,
      originalName,
      fromExt,
      toExt,
      engineId,
      runDD,
      optionOverrides,
      allOptions,
    }) => {
      (window as any).__name = (fn: any) => fn;

      const { ModuleRegistry } = await import('/src/modules/registry.ts');
      const { resetFFmpegMT } = await import('/src/modules/ffmpeg-mt.ts');
      const {
        runDeltaDebugging,
        getApplicableModifierPool,
      } = await import('/src/core/testing/deltaDebugger.ts');

      resetFFmpegMT();

      const moduleInstance = ModuleRegistry[engineId];
      if (!moduleInstance) {
        return {
          from: fromExt,
          to: toExt,
          engineId,
          status: 'FAIL_BASELINE',
          iterations: 1,
          maximalPassed: false,
          error: `Motor '${engineId}' não encontrado no ModuleRegistry.`,
          durationMs: 0,
        };
      }

      let pool = getApplicableModifierPool('.' + fromExt, '.' + toExt, moduleInstance.manifest);

      // Apply any specific option overrides from CLI
      if (optionOverrides.videoCodec) {
        pool = pool.filter((p: any) => p.id !== 'video_codec');
        pool.push({
          id: 'video_codec',
          description: `Codec de vídeo customizado (${optionOverrides.videoCodec})`,
          patch: { videoCodec: optionOverrides.videoCodec },
        });
      }
      if (optionOverrides.audioCodec) {
        pool = pool.filter((p: any) => p.id !== 'audio_codec');
        pool.push({
          id: 'audio_codec',
          description: `Codec de áudio customizado (${optionOverrides.audioCodec})`,
          patch: { audioCodec: optionOverrides.audioCodec },
        });
      }
      if (optionOverrides.resolution) {
        pool = pool.filter((p: any) => p.id !== 'resolution');
        pool.push({
          id: 'resolution',
          description: `Resolução customizada (${optionOverrides.resolution})`,
          patch: { resolutionScale: optionOverrides.resolution },
        });
      }
      if (optionOverrides.fps) {
        pool = pool.filter((p: any) => p.id !== 'fps');
        pool.push({
          id: 'fps',
          description: `FPS customizado (${optionOverrides.fps})`,
          patch: { customFps: optionOverrides.fps, isCustomFps: true },
        });
      }
      if (optionOverrides.quality) {
        pool = pool.filter((p: any) => p.id !== 'quality');
        pool.push({
          id: 'quality',
          description: `Qualidade customizada (${optionOverrides.quality})`,
          patch: { qualityPreset: optionOverrides.quality },
        });
      }

      // Convert base64 back to Uint8Array inside browser
      const binStr = atob(fileBase64);
      const u8File = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) {
        u8File[i] = binStr.charCodeAt(i);
      }

      const execute = async (modifiers: any) => {
        const u8 = new Uint8Array(u8File);
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
              onProgress: () => {},
              onLog: (m: string) => logs.push(m),
              workspacePath: '/workspace',
            }
          );
          const ok = Boolean(out && out.outputData && out.outputData.byteLength > 0);
          return { success: ok, logs: logs.slice(-6) };
        } catch (err) {
          return { success: false, error: String(err), logs: logs.slice(-6) };
        }
      };

      if (!runDD) {
        // Simple direct test
        const poolMods = (await import('/src/core/testing/deltaDebugger.ts')).combineModifierPatches(pool);
        const res = await execute(poolMods);
        return {
          from: fromExt,
          to: toExt,
          engineId,
          status: res.success ? 'PASS' : 'FAIL_BASELINE',
          iterations: 1,
          maximalPassed: res.success,
          error: res.error,
          logs: res.logs,
          durationMs: 0,
        };
      }

      return await runDeltaDebugging(fromExt, toExt, engineId, pool, execute);
    }, {
      fileBase64,
      originalName,
      fromExt: conv.from,
      toExt: conv.to,
      engineId: targetEngine,
      runDD: options.dd,
      optionOverrides: {
        videoCodec: options.videoCodec,
        audioCodec: options.audioCodec,
        resolution: options.resolution,
        fps: options.fps,
        quality: options.quality,
      },
      allOptions: options.allOptions,
    });

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
}

main().catch((err) => {
  console.error('\n❌ Erro fatal no executor de testes de conversão:', err);
  process.exit(1);
});
