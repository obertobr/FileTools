import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const fixturesDir = path.resolve(rootDir, 'tests/fixtures');

// 1. Ensure test fixtures exist
const sampleFiles = ['sample.mp4', 'sample.mkv', 'sample.webm', 'sample.wav', 'sample_1080p.mkv'];
const hasFixtures = sampleFiles.every(f => fs.existsSync(path.join(fixturesDir, f)));

if (!hasFixtures) {
  console.log('⚡ [FileTools Test Runner] Amostras ausentes. Gerando fixtures ultra-compactas...');
  execSync('node scripts/generate-fixtures.js', { stdio: 'inherit', cwd: rootDir });
}

// 2. Map implemented active modules & benchmark targets
const MODULE_MAP = {
  'remux': 'e2e/modules/remux.spec.ts',
  'stream-copy': 'e2e/modules/remux.spec.ts',
  'ffmpeg-mt': 'e2e/modules/ffmpeg-mt.spec.ts',
  'ffmpeg': 'e2e/modules/ffmpeg.spec.ts',
  'ffmpeg-core': 'e2e/modules/ffmpeg.spec.ts',
  'user-file': 'e2e/test-user-file.spec.ts',
  'benchmark': 'e2e/test-user-file.spec.ts',
  'all': 'e2e/modules/',
};

const target = (process.argv[2] || 'all').toLowerCase().trim();
const specTarget = MODULE_MAP[target];

if (!specTarget) {
  console.error(`\n❌ Módulo não suportado ou ainda não implementado: "${target}"`);
  console.log(`\nMódulos implementados e disponíveis para teste isolado:`);
  console.log(`  - npm run test:module -- remux       (Testa Stream Copy instantâneo)`);
  console.log(`  - npm run test:module -- ffmpeg-mt   (Testa FFmpeg Multi-Thread 1080p WebM)`);
  console.log(`  - npm run test:module -- ffmpeg      (Testa FFmpeg Single-Thread padrão)`);
  console.log(`  - npm run test:module -- user-file   (Executa teste com seu arquivo real 1080p 38s)`);
  console.log(`  - npm run test:module -- all         (Executa todos os módulos implementados)\n`);
  process.exit(1);
}

console.log(`\n🚀 [FileTools Test Runner] Executando testes para o módulo: [${target}]`);
console.log(`   Arquivo de teste: ${specTarget}\n`);

const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const args = ['playwright', 'test', specTarget, '--reporter=list'];

const runner = spawn(cmd, args, { stdio: 'inherit', cwd: rootDir, shell: true });

runner.on('close', (code) => {
  if (code === 0) {
    console.log(`\n✔ [FileTools Test Runner] Teste do módulo [${target}] APROVADO com sucesso!\n`);
  } else {
    console.error(`\n✖ [FileTools Test Runner] Falha no teste do módulo [${target}] (código ${code}).\n`);
  }
  process.exit(code || 0);
});
