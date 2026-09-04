import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';
import { PDFDocument, rgb } from 'pdf-lib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../tests/fixtures');

if (!fs.existsSync(fixturesDir)) {
  fs.mkdirSync(fixturesDir, { recursive: true });
}

console.log('[Fixtures] Verificando e gerando amostras ultra-leves para testes...');

function runFFmpeg(args, outputFile) {
  const target = path.join(fixturesDir, outputFile);
  if (fs.existsSync(target)) {
    console.log(`  - ${outputFile} já existe (${(fs.statSync(target).size / 1024).toFixed(1)} KB). Pulando.`);
    return;
  }
  const cmd = `ffmpeg -y ${args} "${target}"`;
  try {
    execSync(cmd, { stdio: 'pipe' });
    console.log(`  ✔ Gerado: ${outputFile} (${(fs.statSync(target).size / 1024).toFixed(1)} KB)`);
  } catch (err) {
    console.error(`  ✖ Falha ao gerar ${outputFile}:`, err.message);
  }
}

// 1. Ultra-compact Baseline Video Files (0.5s, 64x64 resolution, 10 fps)
runFFmpeg(
  '-f lavfi -i testsrc=size=64x64:rate=10 -f lavfi -i sine=frequency=440:duration=0.5 -t 0.5 -c:v libx264 -preset ultrafast -c:a aac -b:a 64k',
  'sample_compact.mp4'
);

runFFmpeg(
  '-f lavfi -i testsrc=size=64x64:rate=10 -f lavfi -i sine=frequency=440:duration=0.5 -t 0.5 -c:v libx264 -preset ultrafast -c:a aac -b:a 64k',
  'sample.mp4'
);

runFFmpeg(
  '-f lavfi -i testsrc=size=64x64:rate=10 -f lavfi -i sine=frequency=440:duration=0.5 -t 0.5 -c:v libvpx -deadline realtime -cpu-used 8 -b:v 200k -c:a libvorbis',
  'sample.webm'
);

// 2. Realistic Multi-Track 1080p Video File (1.5s, 1920x1080, 30 fps, 3 faixas AAC separadas)
// Replicates the exact architectural characteristics of screen capture software (OBS, Shadowplay):
// 1080p resolution, multi-stream parallel AAC audio tracks, testing thread and memory stress.
runFFmpeg(
  '-f lavfi -i testsrc=size=1920x1080:rate=30 -f lavfi -i sine=frequency=440:duration=1.5 -f lavfi -i sine=frequency=880:duration=1.5 -f lavfi -i sine=frequency=1320:duration=1.5 -t 1.5 -map 0:v:0 -map 1:a:0 -map 2:a:0 -map 3:a:0 -metadata:s:a:0 title="TUDO" -metadata:s:a:1 title="MIC" -metadata:s:a:2 title="SISTEMA" -c:v libx264 -preset ultrafast -pix_fmt yuv420p -crf 18 -c:a aac -b:a 128k',
  'sample.mkv'
);

runFFmpeg(
  '-f lavfi -i testsrc=size=1920x1080:rate=30 -f lavfi -i sine=frequency=440:duration=1.5 -f lavfi -i sine=frequency=880:duration=1.5 -f lavfi -i sine=frequency=1320:duration=1.5 -t 1.5 -map 0:v:0 -map 1:a:0 -map 2:a:0 -map 3:a:0 -metadata:s:a:0 title="TUDO" -metadata:s:a:1 title="MIC" -metadata:s:a:2 title="SISTEMA" -c:v libx264 -preset ultrafast -pix_fmt yuv420p -crf 18 -c:a aac -b:a 128k',
  'sample_multitrack_1080p.mkv'
);

// 3. Ultra-Heavy 4K Multi-Track Video File (1.0s, 3840x2160, 30 fps, 3 faixas AAC)
// Stresses the maximum ceiling of 32-bit WebAssembly frame buffers and macroblock scheduling.
runFFmpeg(
  '-f lavfi -i testsrc=size=3840x2160:rate=30 -f lavfi -i sine=frequency=440:duration=1 -f lavfi -i sine=frequency=880:duration=1 -f lavfi -i sine=frequency=1320:duration=1 -t 1 -map 0:v:0 -map 1:a:0 -map 2:a:0 -map 3:a:0 -metadata:s:a:0 title="MASTER" -metadata:s:a:1 title="AUDIO1" -metadata:s:a:2 title="AUDIO2" -c:v libx264 -preset ultrafast -pix_fmt yuv420p -crf 20 -c:a aac -b:a 128k',
  'sample_4k_multitrack.mkv'
);

// 3. Ultra-compact Audio Files (0.5s duration)
runFFmpeg('-f lavfi -i sine=frequency=440:duration=0.5 -t 0.5 -c:a libmp3lame -q:a 9', 'sample.mp3');
runFFmpeg('-f lavfi -i sine=frequency=440:duration=0.5 -t 0.5 -c:a pcm_s16le', 'sample.wav');

// 4. Ultra-compact Image Files (64x64 pixels)
runFFmpeg('-f lavfi -i testsrc=size=64x64:rate=1 -frames:v 1', 'sample.png');
runFFmpeg('-f lavfi -i testsrc=size=64x64:rate=1 -frames:v 1 -q:v 5', 'sample.jpg');

// 5. Spreadsheets (sample.xlsx using SheetJS)
const xlsxPath = path.join(fixturesDir, 'sample.xlsx');
if (!fs.existsSync(xlsxPath)) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['ID', 'Nome', 'Valor'],
    [1, 'Teste A', 100],
    [2, 'Teste B', 250],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Dados');
  XLSX.writeFile(wb, xlsxPath);
  console.log(`  ✔ Gerado: sample.xlsx (${(fs.statSync(xlsxPath).size / 1024).toFixed(1)} KB)`);
} else {
  console.log(`  - sample.xlsx já existe. Pulando.`);
}

// 6. Documentos PDF (sample.pdf using pdf-lib)
const pdfPath = path.join(fixturesDir, 'sample.pdf');
if (!fs.existsSync(pdfPath)) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([200, 200]);
  page.drawText('FileTools Teste PDF', { x: 20, y: 150, size: 14, color: rgb(0, 0, 0) });
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(pdfPath, pdfBytes);
  console.log(`  ✔ Gerado: sample.pdf (${(fs.statSync(pdfPath).size / 1024).toFixed(1)} KB)`);
} else {
  console.log(`  - sample.pdf já existe. Pulando.`);
}

console.log('[Fixtures] Concluído com sucesso!');
