import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';
import { PDFDocument, rgb } from 'pdf-lib';
import JSZip from 'jszip';
import { Font, woff2 } from 'fonteditor-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../tests/fixtures');

if (!fs.existsSync(fixturesDir)) {
  fs.mkdirSync(fixturesDir, { recursive: true });
}

console.log('[Fixtures] Verificando e gerando amostras completas para 100% dos formatos...');

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

// -------------------------------------------------------------
// 1. Video Fixtures (Ultra-compact + Multi-track + Real Containers)
// -------------------------------------------------------------
// MP4 / H.264
runFFmpeg(
  '-f lavfi -i testsrc=size=64x64:rate=10 -f lavfi -i sine=frequency=440:duration=0.5 -t 0.5 -c:v libx264 -preset ultrafast -c:a aac -b:a 64k',
  'sample_compact.mp4'
);
runFFmpeg(
  '-f lavfi -i testsrc=size=64x64:rate=10 -f lavfi -i sine=frequency=440:duration=0.5 -t 0.5 -c:v libx264 -preset ultrafast -c:a aac -b:a 64k',
  'sample.mp4'
);

// WebM / VP8 / Vorbis
runFFmpeg(
  '-f lavfi -i testsrc=size=64x64:rate=10 -f lavfi -i sine=frequency=440:duration=0.5 -t 0.5 -c:v libvpx -deadline realtime -cpu-used 8 -b:v 200k -c:a libvorbis',
  'sample.webm'
);

// MKV Multi-track 1080p
runFFmpeg(
  '-f lavfi -i testsrc=size=1920x1080:rate=30 -f lavfi -i sine=frequency=440:duration=1.5 -f lavfi -i sine=frequency=880:duration=1.5 -f lavfi -i sine=frequency=1320:duration=1.5 -t 1.5 -map 0:v:0 -map 1:a:0 -map 2:a:0 -map 3:a:0 -metadata:s:a:0 title="TUDO" -metadata:s:a:1 title="MIC" -metadata:s:a:2 title="SISTEMA" -c:v libx264 -preset ultrafast -pix_fmt yuv420p -crf 18 -c:a aac -b:a 128k',
  'sample.mkv'
);
runFFmpeg(
  '-f lavfi -i testsrc=size=1920x1080:rate=30 -f lavfi -i sine=frequency=440:duration=1.5 -f lavfi -i sine=frequency=880:duration=1.5 -f lavfi -i sine=frequency=1320:duration=1.5 -t 1.5 -map 0:v:0 -map 1:a:0 -map 2:a:0 -map 3:a:0 -metadata:s:a:0 title="TUDO" -metadata:s:a:1 title="MIC" -metadata:s:a:2 title="SISTEMA" -c:v libx264 -preset ultrafast -pix_fmt yuv420p -crf 18 -c:a aac -b:a 128k',
  'sample_multitrack_1080p.mkv'
);

// 4K MKV
runFFmpeg(
  '-f lavfi -i testsrc=size=3840x2160:rate=30 -f lavfi -i sine=frequency=440:duration=1 -f lavfi -i sine=frequency=880:duration=1 -f lavfi -i sine=frequency=1320:duration=1 -t 1 -map 0:v:0 -map 1:a:0 -map 2:a:0 -map 3:a:0 -metadata:s:a:0 title="MASTER" -metadata:s:a:1 title="AUDIO1" -metadata:s:a:2 title="AUDIO2" -c:v libx264 -preset ultrafast -pix_fmt yuv420p -crf 20 -c:a aac -b:a 128k',
  'sample_4k_multitrack.mkv'
);

// MOV / Apple QuickTime (24 fps as expected by mediaProbe tests)
runFFmpeg(
  '-f lavfi -i testsrc=size=64x64:rate=24 -f lavfi -i sine=frequency=440:duration=0.5 -t 0.5 -c:v libx264 -preset ultrafast -c:a aac -b:a 64k',
  'sample.mov'
);

// AVI / MPEG-4 (30 fps with audio as expected by mediaProbe tests)
runFFmpeg(
  '-f lavfi -i testsrc=size=64x64:rate=30 -f lavfi -i sine=frequency=440:duration=0.5 -t 0.5 -c:v mpeg4 -q:v 5 -c:a mp3',
  'sample.avi'
);

// 3GP / H.263 + AAC
runFFmpeg(
  '-f lavfi -i testsrc=size=176x144:rate=10 -f lavfi -i sine=frequency=440:duration=0.5 -t 0.5 -c:v h263 -c:a aac -ar 8000 -ac 1',
  'sample.3gp'
);

// TS / MPEG-TS
runFFmpeg(
  '-f lavfi -i testsrc=size=64x64:rate=10 -f lavfi -i sine=frequency=440:duration=0.5 -t 0.5 -c:v libx264 -preset ultrafast -c:a aac -b:a 64k',
  'sample.ts'
);

// FLV / Flash Video (25 fps with audio as expected by mediaProbe tests)
runFFmpeg(
  '-f lavfi -i testsrc=size=64x64:rate=25 -f lavfi -i sine=frequency=440:duration=0.5 -t 0.5 -c:v flv -c:a mp3 -ar 22050',
  'sample.flv'
);

// WMV / Windows Media
runFFmpeg(
  '-f lavfi -i testsrc=size=64x64:rate=10 -f lavfi -i sine=frequency=440:duration=0.5 -t 0.5 -c:v wmv2 -c:a wmav2',
  'sample.wmv'
);

// M4V / iTunes Video
runFFmpeg(
  '-f lavfi -i testsrc=size=64x64:rate=10 -f lavfi -i sine=frequency=440:duration=0.5 -t 0.5 -c:v libx264 -preset ultrafast -c:a aac -b:a 64k',
  'sample.m4v'
);

// MPG / MPEG-1 Program Stream (30 fps as expected by mediaProbe tests)
runFFmpeg(
  '-f lavfi -i testsrc=size=64x64:rate=30 -f lavfi -i sine=frequency=440:duration=0.5 -t 0.5 -r 30 -c:v mpeg1video -c:a mp2',
  'sample.mpg'
);

// OGV / Theora (30 fps as expected by mediaProbe tests)
runFFmpeg(
  '-f lavfi -i testsrc=size=64x64:rate=30 -f lavfi -i sine=frequency=440:duration=0.5 -t 0.5 -c:v libtheora -c:a libvorbis',
  'sample.ogv'
);

// GIF Animated
runFFmpeg(
  '-f lavfi -i testsrc=size=64x64:rate=5 -t 0.5',
  'sample.gif'
);

// -------------------------------------------------------------
// 2. Audio Fixtures
// -------------------------------------------------------------
runFFmpeg('-f lavfi -i sine=frequency=440:duration=0.5 -t 0.5 -c:a libmp3lame -q:a 9', 'sample.mp3');
runFFmpeg('-f lavfi -i sine=frequency=440:duration=0.5 -t 0.5 -c:a pcm_s16le', 'sample.wav');
runFFmpeg('-f lavfi -i sine=frequency=440:duration=0.5 -t 0.5 -c:a flac', 'sample.flac');
runFFmpeg('-f lavfi -i sine=frequency=440:duration=0.5 -t 0.5 -c:a libvorbis -q:a 3', 'sample.ogg');
runFFmpeg('-f lavfi -i sine=frequency=440:duration=0.5 -t 0.5 -c:a aac -b:a 64k', 'sample.m4a');
runFFmpeg('-f lavfi -i sine=frequency=440:duration=0.5 -t 0.5 -c:a aac -b:a 64k', 'sample.aac');
runFFmpeg('-f lavfi -i sine=frequency=440:duration=0.5 -t 0.5 -c:a libopus -b:a 64k', 'sample.opus');
runFFmpeg('-f lavfi -i sine=frequency=440:duration=0.5 -t 0.5 -c:a wmav2 -b:a 64k', 'sample.wma');
runFFmpeg('-f lavfi -i sine=frequency=440:duration=0.5 -t 0.5 -c:a pcm_s16be', 'sample.aiff');
runFFmpeg('-f lavfi -i sine=frequency=440:duration=0.5 -t 0.5 -c:a aac -b:a 64k -f ipod', 'sample.m4r');

// -------------------------------------------------------------
// 3. Image Fixtures
// -------------------------------------------------------------
runFFmpeg('-f lavfi -i testsrc=size=64x64:rate=1 -frames:v 1', 'sample.png');
runFFmpeg('-f lavfi -i testsrc=size=64x64:rate=1 -frames:v 1 -q:v 5', 'sample.jpg');
runFFmpeg('-f lavfi -i testsrc=size=64x64:rate=1 -frames:v 1 -q:v 5', 'sample.jpeg');
runFFmpeg('-f lavfi -i testsrc=size=64x64:rate=1 -frames:v 1 -c:v libwebp', 'sample.webp');
runFFmpeg('-f lavfi -i testsrc=size=64x64:rate=1 -frames:v 1', 'sample.bmp');
runFFmpeg('-f lavfi -i testsrc=size=64x64:rate=1 -frames:v 1', 'sample.tiff');
runFFmpeg('-f lavfi -i testsrc=size=32x32:rate=1 -frames:v 1', 'sample.ico');

// SVG
const svgPath = path.join(fixturesDir, 'sample.svg');
if (!fs.existsSync(svgPath)) {
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#10b981"/>
  <circle cx="50" cy="50" r="30" fill="#ffffff"/>
  <text x="50" y="55" font-family="sans-serif" font-size="12" text-anchor="middle" fill="#10b981">FT</text>
</svg>`;
  fs.writeFileSync(svgPath, svgContent);
  console.log(`  ✔ Gerado: sample.svg (${(fs.statSync(svgPath).size / 1024).toFixed(1)} KB)`);
}

// -------------------------------------------------------------
// 4. Spreadsheets & Tabular Data (SheetJS)
// -------------------------------------------------------------
const xlsxPath = path.join(fixturesDir, 'sample.xlsx');
if (!fs.existsSync(xlsxPath)) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['ID', 'Nome', 'Valor', 'Status'],
    [1, 'Teste Alpha', 100, 'Ativo'],
    [2, 'Teste Beta', 250, 'Pendente'],
    [3, 'Teste Gamma', 300, 'Concluído'],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Dados');
  XLSX.writeFile(wb, xlsxPath);
  console.log(`  ✔ Gerado: sample.xlsx (${(fs.statSync(xlsxPath).size / 1024).toFixed(1)} KB)`);
}

const xlsPath = path.join(fixturesDir, 'sample.xls');
if (!fs.existsSync(xlsPath)) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([['ID', 'Nome'], [1, 'Antigo XLS']]);
  XLSX.utils.book_append_sheet(wb, ws, 'Planilha1');
  XLSX.writeFile(wb, xlsPath, { bookType: 'biff8' });
  console.log(`  ✔ Gerado: sample.xls (${(fs.statSync(xlsPath).size / 1024).toFixed(1)} KB)`);
}

const odsPath = path.join(fixturesDir, 'sample.ods');
if (!fs.existsSync(odsPath)) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([['ID', 'Calc'], [1, 'OpenDocument Spreadsheet']]);
  XLSX.utils.book_append_sheet(wb, ws, 'Planilha');
  XLSX.writeFile(wb, odsPath, { bookType: 'ods' });
  console.log(`  ✔ Gerado: sample.ods (${(fs.statSync(odsPath).size / 1024).toFixed(1)} KB)`);
}

const csvPath = path.join(fixturesDir, 'sample.csv');
if (!fs.existsSync(csvPath)) {
  fs.writeFileSync(csvPath, 'id,name,value\n1,Produto A,10.50\n2,Produto B,20.00\n');
  console.log(`  ✔ Gerado: sample.csv (${(fs.statSync(csvPath).size / 1024).toFixed(1)} KB)`);
}

const tsvPath = path.join(fixturesDir, 'sample.tsv');
if (!fs.existsSync(tsvPath)) {
  fs.writeFileSync(tsvPath, 'id\tname\tvalue\n1\tItem A\t100\n2\tItem B\t200\n');
  console.log(`  ✔ Gerado: sample.tsv (${(fs.statSync(tsvPath).size / 1024).toFixed(1)} KB)`);
}

const jsonPath = path.join(fixturesDir, 'sample.json');
if (!fs.existsSync(jsonPath)) {
  fs.writeFileSync(jsonPath, JSON.stringify([
    { id: 1, name: 'Alice', role: 'Admin' },
    { id: 2, name: 'Bob', role: 'User' }
  ], null, 2));
  console.log(`  ✔ Gerado: sample.json (${(fs.statSync(jsonPath).size / 1024).toFixed(1)} KB)`);
}

const txtPath = path.join(fixturesDir, 'sample.txt');
if (!fs.existsSync(txtPath)) {
  fs.writeFileSync(txtPath, 'FileTools Sample Plain Text File.\nEsta é uma linha de teste.\nLinha final.\n');
  console.log(`  ✔ Gerado: sample.txt (${(fs.statSync(txtPath).size / 1024).toFixed(1)} KB)`);
}

const htmlPath = path.join(fixturesDir, 'sample.html');
if (!fs.existsSync(htmlPath)) {
  fs.writeFileSync(htmlPath, `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>FileTools Teste</title></head>
<body>
  <h1>Documento HTML de Teste</h1>
  <p>Este é um parágrafo de exemplo com <strong>texto em negrito</strong>.</p>
</body>
</html>`);
  console.log(`  ✔ Gerado: sample.html (${(fs.statSync(htmlPath).size / 1024).toFixed(1)} KB)`);
}

const mdPath = path.join(fixturesDir, 'sample.md');
if (!fs.existsSync(mdPath)) {
  fs.writeFileSync(mdPath, '# FileTools Teste Markdown\n\nEste é um documento de teste em Markdown.\n\n- Item 1\n- Item 2\n');
  console.log(`  ✔ Gerado: sample.md (${(fs.statSync(mdPath).size / 1024).toFixed(1)} KB)`);
}

// -------------------------------------------------------------
// 5. Multi-Page PDF Document (3 Pages)
// -------------------------------------------------------------
async function generatePdf(filePath, numPages = 3) {
  const pdfDoc = await PDFDocument.create();
  for (let i = 1; i <= numPages; i++) {
    const page = pdfDoc.addPage([400, 400]);
    page.drawText(`FileTools Documento PDF - Pagina ${i} de ${numPages}`, {
      x: 30,
      y: 350,
      size: 14,
      color: rgb(0.1, 0.1, 0.1),
    });
    page.drawRectangle({
      x: 30,
      y: 100,
      width: 340,
      height: 200,
      borderColor: rgb(0.1, 0.6, 0.4),
      borderWidth: 2,
    });
  }
  const bytes = await pdfDoc.save();
  fs.writeFileSync(filePath, bytes);
}

const pdfPath = path.join(fixturesDir, 'sample.pdf');
const multipagePdfPath = path.join(fixturesDir, 'sample_multipage.pdf');
// Always overwrite sample.pdf and sample_multipage.pdf with real 3-page document to ensure multi-page assertions work!
await generatePdf(pdfPath, 3);
await generatePdf(multipagePdfPath, 3);
console.log(`  ✔ Gerado: sample.pdf (Multi-página: 3 páginas) (${(fs.statSync(pdfPath).size / 1024).toFixed(1)} KB)`);
console.log(`  ✔ Gerado: sample_multipage.pdf (Multi-página: 3 páginas) (${(fs.statSync(multipagePdfPath).size / 1024).toFixed(1)} KB)`);

// -------------------------------------------------------------
// 6. Word Document (sample.docx) via JSZip
// -------------------------------------------------------------
const docxPath = path.join(fixturesDir, 'sample.docx');
if (!fs.existsSync(docxPath)) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>FileTools Sample DOCX Document</w:t></w:r></w:p>
    <w:p><w:r><w:t>Este é um parágrafo de teste com formatação OpenXML nativa.</w:t></w:r></w:p>
  </w:body>
</w:document>`);
  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(docxPath, buf);
  console.log(`  ✔ Gerado: sample.docx (${(fs.statSync(docxPath).size / 1024).toFixed(1)} KB)`);
}

// -------------------------------------------------------------
// 7. OpenDocument Text (sample.odt) via JSZip
// -------------------------------------------------------------
const odtPath = path.join(fixturesDir, 'sample.odt');
if (!fs.existsSync(odtPath)) {
  const zip = new JSZip();
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' });
  zip.file('META-INF/manifest.xml', `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">
  <manifest:file-entry manifest:full-path="/" manifest:version="1.3" manifest:media-type="application/vnd.oasis.opendocument.text"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`);
  zip.file('content.xml', `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.3">
  <office:body>
    <office:text>
      <text:p>FileTools Sample ODT Document</text:p>
      <text:p>Texto de exemplo em formato OpenDocument puro.</text:p>
    </office:text>
  </office:body>
</office:document-content>`);
  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(odtPath, buf);
  console.log(`  ✔ Gerado: sample.odt (${(fs.statSync(odtPath).size / 1024).toFixed(1)} KB)`);
}

// -------------------------------------------------------------
// 8. PowerPoint (sample.pptx) via JSZip
// -------------------------------------------------------------
const pptxPath = path.join(fixturesDir, 'sample.pptx');
if (!fs.existsSync(pptxPath)) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`);
  zip.file('ppt/presentation.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst>
</p:presentation>`);
  zip.file('ppt/_rels/presentation.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
</Relationships>`);
  zip.file('ppt/slides/slide1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
</p:sld>`);
  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(pptxPath, buf);
  console.log(`  ✔ Gerado: sample.pptx (${(fs.statSync(pptxPath).size / 1024).toFixed(1)} KB)`);
}

// -------------------------------------------------------------
// 9. OpenDocument Presentation (sample.odp) via JSZip
// -------------------------------------------------------------
const odpPath = path.join(fixturesDir, 'sample.odp');
if (!fs.existsSync(odpPath)) {
  const zip = new JSZip();
  zip.file('mimetype', 'application/vnd.oasis.opendocument.presentation', { compression: 'STORE' });
  zip.file('META-INF/manifest.xml', `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">
  <manifest:file-entry manifest:full-path="/" manifest:version="1.3" manifest:media-type="application/vnd.oasis.opendocument.presentation"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`);
  zip.file('content.xml', `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" office:version="1.3">
  <office:body>
    <office:presentation>
      <draw:page draw:name="page1"/>
    </office:presentation>
  </office:body>
</office:document-content>`);
  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(odpPath, buf);
  console.log(`  ✔ Gerado: sample.odp (${(fs.statSync(odpPath).size / 1024).toFixed(1)} KB)`);
}

// -------------------------------------------------------------
// 10. Rich Text Format (sample.rtf)
// -------------------------------------------------------------
const rtfPath = path.join(fixturesDir, 'sample.rtf');
if (!fs.existsSync(rtfPath)) {
  const rtfContent = '{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Courier;}}\\f0\\fs24 FileTools Sample RTF Document\\par This is a test paragraph.}';
  fs.writeFileSync(rtfPath, rtfContent);
  console.log(`  ✔ Gerado: sample.rtf (${(fs.statSync(rtfPath).size / 1024).toFixed(1)} KB)`);
}

// -------------------------------------------------------------
// 11. Archives (ZIP, GZ, TAR, CBZ)
// -------------------------------------------------------------
const zipPath = path.join(fixturesDir, 'sample.zip');
if (!fs.existsSync(zipPath)) {
  const zip = new JSZip();
  zip.file('hello.txt', 'FileTools Archive Sample Content\n');
  zip.file('nested/data.json', JSON.stringify({ project: 'FileTools', ok: true }));
  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(zipPath, buf);
  console.log(`  ✔ Gerado: sample.zip (${(fs.statSync(zipPath).size / 1024).toFixed(1)} KB)`);
}

const gzPath = path.join(fixturesDir, 'sample.gz');
if (!fs.existsSync(gzPath)) {
  const gzBuf = zlib.gzipSync(Buffer.from('FileTools GZIP Sample Content\nLine 2\n', 'utf8'));
  fs.writeFileSync(gzPath, gzBuf);
  console.log(`  ✔ Gerado: sample.gz (${(fs.statSync(gzPath).size / 1024).toFixed(1)} KB)`);
}

const tarPath = path.join(fixturesDir, 'sample.tar');
if (!fs.existsSync(tarPath)) {
  const payload = Buffer.from('FileTools TAR Sample Content\n', 'utf8');
  const header = Buffer.alloc(512, 0);
  header.write('sample.txt', 0, 'ascii');
  header.write('0000644\0', 100, 'ascii');
  header.write('0000000\0', 108, 'ascii');
  header.write('0000000\0', 116, 'ascii');
  header.write(payload.length.toString(8).padStart(11, '0') + '\0', 124, 'ascii');
  header.write(Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + '\0', 136, 'ascii');
  header.fill(0x20, 148, 156);
  header.write('0', 156, 'ascii');
  header.write('ustar', 257, 'ascii');
  header.write('00', 263, 'ascii');
  let sum = 0;
  for (let i = 0; i < 512; i++) sum += header[i];
  header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 'ascii');
  const paddedPayload = Buffer.alloc(512, 0);
  payload.copy(paddedPayload);
  const trailer = Buffer.alloc(1024, 0);
  fs.writeFileSync(tarPath, Buffer.concat([header, paddedPayload, trailer]));
  console.log(`  ✔ Gerado: sample.tar (${(fs.statSync(tarPath).size / 1024).toFixed(1)} KB)`);
}

// -------------------------------------------------------------
// 12. Extra Images (QOI, TGA, PNM)
// -------------------------------------------------------------
const qoiPath = path.join(fixturesDir, 'sample.qoi');
if (!fs.existsSync(qoiPath)) {
  // 2x2 RGBA QOI image
  const qoiBuf = Buffer.alloc(14 + 4 * 5 + 8);
  qoiBuf.write('qoif', 0, 'ascii');
  qoiBuf.writeUInt32BE(2, 4);
  qoiBuf.writeUInt32BE(2, 8);
  qoiBuf[12] = 4;
  qoiBuf[13] = 0;
  let off = 14;
  const pixels = [
    [16, 185, 129, 255],
    [255, 255, 255, 255],
    [255, 255, 255, 255],
    [16, 185, 129, 255],
  ];
  for (const [r, g, b, a] of pixels) {
    qoiBuf[off++] = 0xff;
    qoiBuf[off++] = r;
    qoiBuf[off++] = g;
    qoiBuf[off++] = b;
    qoiBuf[off++] = a;
  }
  qoiBuf[qoiBuf.length - 1] = 0x01;
  fs.writeFileSync(qoiPath, qoiBuf);
  console.log(`  ✔ Gerado: sample.qoi (${(fs.statSync(qoiPath).size / 1024).toFixed(1)} KB)`);
}

const tgaPath = path.join(fixturesDir, 'sample.tga');
if (!fs.existsSync(tgaPath)) {
  const hdr = Buffer.alloc(18, 0);
  hdr[2] = 2; // uncompressed true-color
  hdr.writeUInt16LE(2, 12);
  hdr.writeUInt16LE(2, 14);
  hdr[16] = 32;
  const px = Buffer.from([129, 185, 16, 255, 255, 255, 255, 255, 255, 255, 255, 255, 129, 185, 16, 255]);
  fs.writeFileSync(tgaPath, Buffer.concat([hdr, px]));
  console.log(`  ✔ Gerado: sample.tga (${(fs.statSync(tgaPath).size / 1024).toFixed(1)} KB)`);
}

// -------------------------------------------------------------
// 13. Ebooks (EPUB, FB2, CBZ) & Subtitles (SRT, VTT)
// -------------------------------------------------------------
const epubPath = path.join(fixturesDir, 'sample.epub');
if (!fs.existsSync(epubPath)) {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`
  );
  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>FileTools Sample Ebook</dc:title><dc:creator>FileTools</dc:creator></metadata><manifest><item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="ch1"/></spine></package>`
  );
  zip.file(
    'OEBPS/chapter1.xhtml',
    `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Capítulo 1</title></head><body><h1>FileTools EPUB</h1><p>Conteúdo de teste para conversão de ebook.</p></body></html>`
  );
  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(epubPath, buf);
  console.log(`  ✔ Gerado: sample.epub (${(fs.statSync(epubPath).size / 1024).toFixed(1)} KB)`);
}

const fb2Path = path.join(fixturesDir, 'sample.fb2');
if (!fs.existsSync(fb2Path)) {
  fs.writeFileSync(
    fb2Path,
    `<?xml version="1.0" encoding="utf-8"?><FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><description><title-info><book-title>FileTools FB2</book-title></title-info></description><body><section><title><p>Capítulo 1</p></title><p>Texto de teste em FictionBook 2.</p></section></body></FictionBook>`
  );
  console.log(`  ✔ Gerado: sample.fb2 (${(fs.statSync(fb2Path).size / 1024).toFixed(1)} KB)`);
}

const cbzPath = path.join(fixturesDir, 'sample.cbz');
if (!fs.existsSync(cbzPath)) {
  const pngSample = path.join(fixturesDir, 'sample.png');
  const zip = new JSZip();
  if (fs.existsSync(pngSample)) {
    zip.file('page_001.png', fs.readFileSync(pngSample));
  }
  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(cbzPath, buf);
  console.log(`  ✔ Gerado: sample.cbz (${(fs.statSync(cbzPath).size / 1024).toFixed(1)} KB)`);
}

const srtPath = path.join(fixturesDir, 'sample.srt');
if (!fs.existsSync(srtPath)) {
  fs.writeFileSync(srtPath, '1\n00:00:00,000 --> 00:00:01,500\nFileTools Teste de Legenda\n');
  console.log(`  ✔ Gerado: sample.srt (${(fs.statSync(srtPath).size / 1024).toFixed(1)} KB)`);
}

const vttPath = path.join(fixturesDir, 'sample.vtt');
if (!fs.existsSync(vttPath)) {
  fs.writeFileSync(vttPath, 'WEBVTT\n\n00:00:00.000 --> 00:00:01.500\nFileTools Teste WebVTT\n');
  console.log(`  ✔ Gerado: sample.vtt (${(fs.statSync(vttPath).size / 1024).toFixed(1)} KB)`);
}

// -------------------------------------------------------------
// 14. 3D / CAD Fixtures (OBJ, STL, PLY, GLTF, GLB, 3MF, STEP)
// -------------------------------------------------------------
const objPath = path.join(fixturesDir, 'sample.obj');
if (!fs.existsSync(objPath)) {
  fs.writeFileSync(objPath, '# FileTools Cube\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n');
  console.log(`  ✔ Gerado: sample.obj (${(fs.statSync(objPath).size / 1024).toFixed(1)} KB)`);
}

const stlPath = path.join(fixturesDir, 'sample.stl');
if (!fs.existsSync(stlPath)) {
  const stlBuf = Buffer.alloc(84 + 50, 0);
  stlBuf.write('FileTools Binary STL', 0, 'ascii');
  stlBuf.writeUInt32LE(1, 80);
  // normal (0,0,1), v1(0,0,0), v2(1,0,0), v3(0,1,0)
  stlBuf.writeFloatLE(1, 84 + 8);
  stlBuf.writeFloatLE(1, 84 + 24);
  stlBuf.writeFloatLE(1, 84 + 40);
  fs.writeFileSync(stlPath, stlBuf);
  console.log(`  ✔ Gerado: sample.stl (${(fs.statSync(stlPath).size / 1024).toFixed(1)} KB)`);
}

const plyPath = path.join(fixturesDir, 'sample.ply');
if (!fs.existsSync(plyPath)) {
  fs.writeFileSync(
    plyPath,
    'ply\nformat ascii 1.0\nelement vertex 3\nproperty float x\nproperty float y\nproperty float z\nelement face 1\nproperty list uchar int vertex_indices\nend_header\n0 0 0\n1 0 0\n0 1 0\n3 0 1 2\n'
  );
  console.log(`  ✔ Gerado: sample.ply (${(fs.statSync(plyPath).size / 1024).toFixed(1)} KB)`);
}

const glbPath = path.join(fixturesDir, 'sample.glb');
const gltfPath = path.join(fixturesDir, 'sample.gltf');
if (!fs.existsSync(glbPath) || !fs.existsSync(gltfPath)) {
  // Single triangle: 3 float32 positions (36 bytes) + 3 uint16 indices padded to 4 bytes (8 bytes) = 44 bytes
  const binBuf = Buffer.alloc(44, 0);
  binBuf.writeFloatLE(0, 0); binBuf.writeFloatLE(0, 4); binBuf.writeFloatLE(0, 8);
  binBuf.writeFloatLE(1, 12); binBuf.writeFloatLE(0, 16); binBuf.writeFloatLE(0, 20);
  binBuf.writeFloatLE(0, 24); binBuf.writeFloatLE(1, 28); binBuf.writeFloatLE(0, 32);
  binBuf.writeUInt16LE(0, 36); binBuf.writeUInt16LE(1, 38); binBuf.writeUInt16LE(2, 40);

  const gltfJsonObj = {
    asset: { version: '2.0', generator: 'FileTools' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] },
      { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36 },
      { buffer: 0, byteOffset: 36, byteLength: 6 },
    ],
    buffers: [{ byteLength: 44 }],
  };

  if (!fs.existsSync(gltfPath)) {
    const embedded = structuredClone(gltfJsonObj);
    embedded.buffers = [{ uri: `data:application/octet-stream;base64,${binBuf.toString('base64')}`, byteLength: 44 }];
    fs.writeFileSync(gltfPath, JSON.stringify(embedded, null, 2));
    console.log(`  ✔ Gerado: sample.gltf (${(fs.statSync(gltfPath).size / 1024).toFixed(1)} KB)`);
  }

  if (!fs.existsSync(glbPath)) {
    let jsonStr = JSON.stringify(gltfJsonObj);
    while (Buffer.byteLength(jsonStr, 'utf8') % 4 !== 0) jsonStr += ' ';
    const jsonBuf = Buffer.from(jsonStr, 'utf8');
    const totalLen = 12 + 8 + jsonBuf.length + 8 + binBuf.length;
    const glb = Buffer.alloc(totalLen);
    glb.write('glTF', 0, 'ascii');
    glb.writeUInt32LE(2, 4);
    glb.writeUInt32LE(totalLen, 8);
    glb.writeUInt32LE(jsonBuf.length, 12);
    glb.writeUInt32LE(0x4e4f534a, 16);
    jsonBuf.copy(glb, 20);
    const binHeaderOff = 20 + jsonBuf.length;
    glb.writeUInt32LE(binBuf.length, binHeaderOff);
    glb.writeUInt32LE(0x004e4942, binHeaderOff + 4);
    binBuf.copy(glb, binHeaderOff + 8);
    fs.writeFileSync(glbPath, glb);
    console.log(`  ✔ Gerado: sample.glb (${(fs.statSync(glbPath).size / 1024).toFixed(1)} KB)`);
  }
}

const threemfPath = path.join(fixturesDir, 'sample.3mf');
if (!fs.existsSync(threemfPath)) {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>`
  );
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`
  );
  zip.file(
    '3D/3dmodel.model',
    `<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources><object id="1" type="model"><mesh><vertices><vertex x="0" y="0" z="0"/><vertex x="10" y="0" z="0"/><vertex x="0" y="10" z="0"/><vertex x="0" y="0" z="10"/></vertices><triangles><triangle v1="0" v2="2" v3="1"/><triangle v1="0" v2="1" v3="3"/><triangle v1="0" v2="3" v3="2"/><triangle v1="1" v2="2" v3="3"/></triangles></mesh></object></resources><build><item objectid="1"/></build></model>`
  );
  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(threemfPath, buf);
  console.log(`  ✔ Gerado: sample.3mf (${(fs.statSync(threemfPath).size / 1024).toFixed(1)} KB)`);
}

const stepPath = path.join(fixturesDir, 'sample.step');
const validStep = [
  'ISO-10303-21;',
  'HEADER;',
  "FILE_DESCRIPTION(('Box'),'2;1');",
  "FILE_NAME('box.step','2026-01-01T00:00:00',('FT'),('FT'),'','','');",
  "FILE_SCHEMA(('CONFIG_CONTROL_DESIGN'));",
  'ENDSEC;',
  'DATA;',
  "#10=APPLICATION_CONTEXT('mechanical');",
  "#11=PRODUCT_DEFINITION_SHAPE('','',#12);",
  "#12=PRODUCT_DEFINITION('','',#13,#14);",
  "#13=PRODUCT_DEFINITION_FORMATION('','',#15);",
  "#14=PRODUCT_DEFINITION_CONTEXT('',#10,'design');",
  "#15=PRODUCT('B','B','',(#16));",
  "#16=PRODUCT_CONTEXT('',#10,'mechanical');",
  "#20=SHAPE_DEFINITION_REPRESENTATION(#11,#21);",
  "#21=ADVANCED_BREP_SHAPE_REPRESENTATION('B',(#30,#31),#22);",
  "#22=(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#23))GLOBAL_UNIT_ASSIGNED_CONTEXT((#24,#25,#26))REPRESENTATION_CONTEXT('','3D'));",
  "#23=UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-7),#24,'','');",
  '#24=(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.));',
  '#25=(NAMED_UNIT(*)PLANE_ANGLE_UNIT()SI_UNIT($,.RADIAN.));',
  '#26=(NAMED_UNIT(*)SI_UNIT($,.STERADIAN.)SOLID_ANGLE_UNIT());',
  "#30=AXIS2_PLACEMENT_3D('',#100,#101,#102);",
  "#31=FACETED_BREP('B',#40);",
  "#40=CLOSED_SHELL('',(#50,#51,#52,#53));",
  "#50=FACE_SURFACE('',(#70),#60,.T.);",
  "#51=FACE_SURFACE('',(#71),#61,.T.);",
  "#52=FACE_SURFACE('',(#72),#62,.T.);",
  "#53=FACE_SURFACE('',(#73),#63,.T.);",
  "#60=PLANE('',#110);",
  "#61=PLANE('',#111);",
  "#62=PLANE('',#112);",
  "#63=PLANE('',#113);",
  "#70=FACE_OUTER_BOUND('',#80,.T.);",
  "#71=FACE_OUTER_BOUND('',#81,.T.);",
  "#72=FACE_OUTER_BOUND('',#82,.T.);",
  "#73=FACE_OUTER_BOUND('',#83,.T.);",
  "#80=POLY_LOOP('',(#90,#91,#92));",
  "#81=POLY_LOOP('',(#90,#92,#93));",
  "#82=POLY_LOOP('',(#90,#93,#91));",
  "#83=POLY_LOOP('',(#91,#93,#92));",
  "#90=CARTESIAN_POINT('',(0.,0.,0.));",
  "#91=CARTESIAN_POINT('',(10.,0.,0.));",
  "#92=CARTESIAN_POINT('',(0.,10.,0.));",
  "#93=CARTESIAN_POINT('',(0.,0.,10.));",
  "#100=CARTESIAN_POINT('',(0.,0.,0.));",
  "#101=DIRECTION('',(0.,0.,1.));",
  "#102=DIRECTION('',(1.,0.,0.));",
  "#110=AXIS2_PLACEMENT_3D('',#90,#101,#102);",
  "#111=AXIS2_PLACEMENT_3D('',#90,#102,#101);",
  "#112=AXIS2_PLACEMENT_3D('',#90,#114,#101);",
  "#113=AXIS2_PLACEMENT_3D('',#91,#115,#116);",
  "#114=DIRECTION('',(0.,1.,0.));",
  "#115=DIRECTION('',(0.577350269,0.577350269,0.577350269));",
  "#116=DIRECTION('',(-0.707106781,0.707106781,0.));",
  'ENDSEC;',
  'END-ISO-10303-21;',
].join('\n');
fs.writeFileSync(stepPath, validStep);
console.log(`  ✔ Gerado: sample.step (${(fs.statSync(stepPath).size / 1024).toFixed(1)} KB)`);

// -------------------------------------------------------------
// 15. Font Fixtures (TTF, WOFF, WOFF2, EOT)
// -------------------------------------------------------------
const ttfPath = path.join(fixturesDir, 'sample.ttf');
const woffPath = path.join(fixturesDir, 'sample.woff');
const woff2Path = path.join(fixturesDir, 'sample.woff2');
const eotPath = path.join(fixturesDir, 'sample.eot');
if (!fs.existsSync(ttfPath) || !fs.existsSync(woffPath) || !fs.existsSync(woff2Path) || !fs.existsSync(eotPath)) {
  const font = Font.create();
  const data = font.get();
  data.name = {
    fontFamily: 'FileTools',
    fontSubFamily: 'Regular',
    uniqueSubFamily: 'FileTools',
    fullName: 'FileTools Regular',
    version: '1.0',
    postScriptName: 'FileTools-Regular',
  };
  data.glyf = [
    {
      name: '.notdef',
      advanceWidth: 500,
      leftSideBearing: 0,
      contours: [[{ x: 0, y: 0, onCurve: true }, { x: 400, y: 0, onCurve: true }, { x: 400, y: 700, onCurve: true }, { x: 0, y: 700, onCurve: true }]],
    },
    {
      name: 'A',
      unicode: [65],
      advanceWidth: 600,
      leftSideBearing: 50,
      contours: [[{ x: 50, y: 0, onCurve: true }, { x: 300, y: 700, onCurve: true }, { x: 550, y: 0, onCurve: true }]],
    },
  ];
  font.set(data);
  if (!woff2.isInited()) await woff2.init();
  for (const [fPath, fType] of [
    [ttfPath, 'ttf'],
    [woffPath, 'woff'],
    [woff2Path, 'woff2'],
    [eotPath, 'eot'],
  ]) {
    if (!fs.existsSync(fPath)) {
      const buf = font.write({ type: fType, toBuffer: true });
      fs.writeFileSync(fPath, Buffer.from(buf));
      console.log(`  ✔ Gerado: ${path.basename(fPath)} (${(fs.statSync(fPath).size / 1024).toFixed(1)} KB)`);
    }
  }
}

console.log('[Fixtures] Todas as amostras de teste estão prontas!');
