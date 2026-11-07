import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';
import { PDFDocument, rgb } from 'pdf-lib';
import JSZip from 'jszip';

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

console.log('[Fixtures] Todas as amostras de teste estão prontas!');
