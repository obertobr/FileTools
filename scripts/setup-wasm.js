import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyFileSafe(src, dest, label) {
  if (!fs.existsSync(src)) {
    console.warn(`[setup-wasm] Arquivo fonte não encontrado: ${src}`);
    return false;
  }
  const destDir = path.dirname(dest);
  ensureDir(destDir);

  if (!fs.existsSync(dest) || fs.statSync(dest).size !== fs.statSync(src).size) {
    console.log(`[setup-wasm] Copiando ${label || path.basename(dest)}...`);
    fs.copyFileSync(src, dest);
  }
  return true;
}

// 1. Setup LibreOffice WASM
const libreOfficeTargetDir = path.join(rootDir, 'public', 'wasm', 'libreoffice');
ensureDir(libreOfficeTargetDir);

const libreOfficeSourceWasmDir = path.join(rootDir, 'node_modules', '@matbee', 'libreoffice-converter', 'wasm');
const libreOfficeSourceDistDir = path.join(rootDir, 'node_modules', '@matbee', 'libreoffice-converter', 'dist');

if (fs.existsSync(libreOfficeSourceWasmDir)) {
  const files = [
    { src: path.join(libreOfficeSourceWasmDir, 'soffice.js'), dest: path.join(libreOfficeTargetDir, 'soffice.js') },
    { src: path.join(libreOfficeSourceWasmDir, 'soffice.wasm'), dest: path.join(libreOfficeTargetDir, 'soffice.wasm') },
    { src: path.join(libreOfficeSourceWasmDir, 'soffice.data'), dest: path.join(libreOfficeTargetDir, 'soffice.data') },
    { src: path.join(libreOfficeSourceWasmDir, 'soffice.worker.js'), dest: path.join(libreOfficeTargetDir, 'soffice.worker.js') },
    { src: path.join(libreOfficeSourceDistDir, 'browser.worker.global.js'), dest: path.join(libreOfficeTargetDir, 'browser.worker.global.js') },
  ];

  for (const { src, dest } of files) {
    copyFileSafe(src, dest, `LibreOffice ${path.basename(dest)}`);
  }
  console.log('[setup-wasm] LibreOffice WASM configurado em public/wasm/libreoffice/');
} else {
  console.warn('[setup-wasm] node_modules/@matbee/libreoffice-converter não encontrado. Execute npm install primeiro.');
}

// 2. Setup FFmpeg ST & MT
const ffmpegStSrc = path.join(rootDir, 'node_modules', '@ffmpeg', 'core', 'dist', 'esm');
if (fs.existsSync(ffmpegStSrc)) {
  fs.cpSync(ffmpegStSrc, path.join(rootDir, 'public'), { recursive: true });
}

const ffmpegMtSrc = path.join(rootDir, 'node_modules', '@ffmpeg', 'core-mt', 'dist', 'esm');
if (fs.existsSync(ffmpegMtSrc)) {
  fs.cpSync(ffmpegMtSrc, path.join(rootDir, 'public', 'ffmpeg-core-mt'), { recursive: true });
}

// 3. Setup ImageMagick
const magickSrc = path.join(rootDir, 'node_modules', '@imagemagick', 'magick-wasm', 'dist', 'x86', 'magick.wasm');
if (fs.existsSync(magickSrc)) {
  copyFileSafe(magickSrc, path.join(rootDir, 'public', 'magick.wasm'), 'ImageMagick magick.wasm');
}

console.log('[setup-wasm] Todos os binários WASM estão prontos.');
