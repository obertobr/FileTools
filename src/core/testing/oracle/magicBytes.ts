/**
 * src/core/testing/oracle/magicBytes.ts
 *
 * Layer 1 of the Output Oracle:
 * Validates the raw binary signature (Magic Bytes) and container header
 * of the generated output bytes to guarantee format integrity and detect
 * misnamed containers (e.g. ZIP named as PNG, raw bitstream without ftyp box).
 */

import type { Layer1MagicBytesResult } from '../types';

export function validateMagicBytes(
  data: Uint8Array,
  targetExt: string,
  fileName?: string
): Layer1MagicBytesResult {
  if (!data || data.byteLength === 0) {
    return {
      valid: false,
      error: 'Buffer de saída está completamente vazio (0 bytes).',
    };
  }

  const cleanExt = targetExt.toLowerCase().replace(/^\./, '');
  const outName = (fileName || '').toLowerCase();

  // If the user explicitly requested a .zip
  if (cleanExt === 'zip') {
    return checkZip(data, 'ZIP');
  }

  // CRITICAL PRODUCTION CHECK:
  // ConvertPanel.tsx (line 294) computes the downloaded file name purely from `target`:
  //   const outputName = file.name.replace(/\.[^.]+$/, '') + '.' + target;
  // It completely ignores `result.outputFileName`!
  // So if an engine returns a ZIP archive (`PK\x03\x04`) or sets `outputFileName: "...zip"`
  // when the user requested `.png` or `.svg`, the user's browser downloads a ZIP file with a `.png` extension!
  // When an engine packages multiple pages into a ZIP container (e.g. LibreOffice multipage PDF/DOCX -> PNG)
  // ConvertPanel.tsx now respects result.outputFileName and downloads it as .zip
  if (outName.endsWith('.zip')) {
    return checkZip(data, 'ZIP');
  }

  switch (cleanExt) {
    case 'png':
      return checkPng(data);
    case 'jpg':
    case 'jpeg':
      return checkJpeg(data);
    case 'pdf':
      return checkPdf(data);
    case 'gif':
      return checkGif(data);
    case 'webp':
      return checkWebp(data);
    case 'bmp':
      return checkBmp(data);
    case 'tiff':
    case 'tif':
      return checkTiff(data);
    case 'ico':
      return checkIco(data);
    case 'svg':
      return checkSvg(data);
    case 'jxl':
      return checkJxl(data);
    case 'qoi':
      return checkQoi(data);
    case 'psd':
      return checkPsd(data);
    case 'tga':
      return checkTga(data);
    case 'pnm':
    case 'ppm':
    case 'pgm':
    case 'pbm':
      return checkPnm(data, cleanExt.toUpperCase());
    case 'jp2':
      return checkJp2(data);
    case 'heic':
    case 'heif':
    case 'avif':
      return checkIsoBmffImage(data, cleanExt.toUpperCase());

    // Archives
    case '7z':
      return check7z(data);
    case 'gz':
    case 'tgz':
      return checkGzip(data);
    case 'bz2':
    case 'tbz2':
      return checkBz2(data);
    case 'xz':
    case 'txz':
      return checkXz(data);
    case 'rar':
      return checkRar(data);
    case 'tar':
      return checkTar(data);
    case 'deflate':
      return checkDeflate(data);

    // Fonts
    case 'woff':
      return checkWoff(data);
    case 'woff2':
      return checkWoff2(data);
    case 'ttf':
      return checkTtf(data);
    case 'otf':
      return checkOtf(data);
    case 'eot':
      return checkEot(data);

    // 3D / CAD
    case 'glb':
      return checkGlb(data);
    case 'gltf':
      return checkGltf(data);
    case 'stl':
      return checkStl(data);
    case 'obj':
      return checkObj(data);
    case 'ply':
      return checkPly(data);
    case '3mf':
    case 'cbz':
    case 'xlsm':
    case 'xlsb':
      return checkZip(data, cleanExt.toUpperCase());
    case 'fb2':
    case 'x3d':
    case 'dae':
    case 'fods':
    case 'xhtml':
      return checkXmlDocument(data, cleanExt.toUpperCase());
    case 'step':
    case 'stp':
      return checkStep(data);
    case 'iges':
    case 'igs':
      return checkIges(data);
    case 'brep':
      return checkBrep(data);
    case 'mobi':
    case 'azw':
    case 'azw3':
    case 'kf8':
      return checkMobi(data, cleanExt.toUpperCase());

    // Subtitles
    case 'srt':
      return checkSrt(data);
    case 'vtt':
      return checkVtt(data);

    // Audio
    case 'mp3':
      return checkMp3(data);
    case 'wav':
      return checkRiff(data, 'WAVE', 'WAV');
    case 'flac':
      return checkFlac(data);
    case 'ogg':
    case 'opus':
      return checkOgg(data, cleanExt.toUpperCase());
    case 'm4a':
    case 'm4r':
    case 'aac':
      return checkIsoBmffOrAdts(data, cleanExt);
    case 'wma':
      return checkAsf(data, 'WMA');
    case 'aiff':
    case 'aif':
      return checkFormAiff(data);

    // Video
    case 'mp4':
    case 'mov':
    case 'm4v':
    case '3gp':
      return checkIsoBmff(data, cleanExt.toUpperCase());
    case 'mkv':
    case 'webm':
      return checkEbml(data, cleanExt.toUpperCase());
    case 'avi':
      return checkRiff(data, 'AVI ', 'AVI');
    case 'ts':
      return checkTs(data);
    case 'flv':
      return checkFlv(data);
    case 'wmv':
      return checkAsf(data, 'WMV');
    case 'mpg':
    case 'mpeg':
    case 'vob':
      return checkMpegPs(data);

    // Office Documents & Spreadsheets (Zip-based OpenXML and ODF)
    case 'docx':
    case 'xlsx':
    case 'pptx':
    case 'odt':
    case 'ods':
    case 'odp':
    case 'epub':
      return checkZip(data, cleanExt.toUpperCase());
    case 'xls':
    case 'doc':
    case 'ppt':
      return checkOle2Compound(data, cleanExt.toUpperCase());
    case 'rtf':
      return checkRtf(data);

    // Text & Structured Data
    case 'html':
    case 'htm':
      return checkHtml(data);
    case 'json':
      return checkJson(data);
    case 'csv':
    case 'tsv':
    case 'txt':
    case 'md':
      return checkPlainText(data, cleanExt.toUpperCase());

    default:
      // Unknown or arbitrary extension: require at least non-zero length
      return {
        valid: data.byteLength > 0,
        detectedSignature: `Tamanho: ${data.byteLength} bytes`,
      };
  }
}

function checkPng(data: Uint8Array): Layer1MagicBytesResult {
  if (
    data.byteLength >= 8 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47 &&
    data[4] === 0x0d &&
    data[5] === 0x0a &&
    data[6] === 0x1a &&
    data[7] === 0x0a
  ) {
    return { valid: true, detectedSignature: '\\x89PNG\\r\\n\\x1a\\n' };
  }
  return {
    valid: false,
    expectedSignature: '89 50 4E 47 (\\x89PNG)',
    detectedSignature: hexSlice(data, 8),
    error: 'Arquivo PNG não possui assinatura válida (\\x89PNG). O arquivo pode estar corrompido ou ser um contêiner ZIP disfarçado.',
  };
}

function checkJpeg(data: Uint8Array): Layer1MagicBytesResult {
  if (data.byteLength >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return { valid: true, detectedSignature: 'FF D8 FF (JPEG SOI)' };
  }
  return {
    valid: false,
    expectedSignature: 'FF D8 FF',
    detectedSignature: hexSlice(data, 3),
    error: 'Arquivo JPEG não inicia com a assinatura SOI (FF D8 FF).',
  };
}

function checkPdf(data: Uint8Array): Layer1MagicBytesResult {
  // %PDF- (0x25, 0x50, 0x44, 0x46)
  if (
    data.byteLength >= 5 &&
    data[0] === 0x25 &&
    data[1] === 0x50 &&
    data[2] === 0x44 &&
    data[3] === 0x46 &&
    data[4] === 0x2d
  ) {
    return { valid: true, detectedSignature: '%PDF-' };
  }
  return {
    valid: false,
    expectedSignature: '25 50 44 46 2D (%PDF-)',
    detectedSignature: hexSlice(data, 5),
    error: 'Arquivo PDF não possui assinatura de cabeçalho válida (%PDF-).',
  };
}

function checkGif(data: Uint8Array): Layer1MagicBytesResult {
  if (
    data.byteLength >= 6 &&
    data[0] === 0x47 &&
    data[1] === 0x49 &&
    data[2] === 0x46 &&
    data[3] === 0x38 &&
    (data[4] === 0x37 || data[4] === 0x39) &&
    data[5] === 0x61
  ) {
    return { valid: true, detectedSignature: `GIF8${String.fromCharCode(data[4])}a` };
  }
  return {
    valid: false,
    expectedSignature: 'GIF87a / GIF89a',
    detectedSignature: hexSlice(data, 6),
    error: 'Arquivo GIF não possui assinatura válida (GIF87a / GIF89a).',
  };
}

function checkWebp(data: Uint8Array): Layer1MagicBytesResult {
  // RIFF....WEBP
  if (
    data.byteLength >= 12 &&
    data[0] === 0x52 &&
    data[1] === 0x49 &&
    data[2] === 0x46 &&
    data[3] === 0x46 &&
    data[8] === 0x57 &&
    data[9] === 0x45 &&
    data[10] === 0x42 &&
    data[11] === 0x50
  ) {
    return { valid: true, detectedSignature: 'RIFF....WEBP' };
  }
  return {
    valid: false,
    expectedSignature: 'RIFF....WEBP',
    detectedSignature: hexSlice(data, 12),
    error: 'Arquivo WEBP não possui cabeçalho RIFF/WEBP válido.',
  };
}

function checkBmp(data: Uint8Array): Layer1MagicBytesResult {
  if (data.byteLength >= 2 && data[0] === 0x42 && data[1] === 0x4d) {
    return { valid: true, detectedSignature: 'BM' };
  }
  return {
    valid: false,
    expectedSignature: '42 4D (BM)',
    detectedSignature: hexSlice(data, 2),
    error: 'Arquivo BMP não possui assinatura BM.',
  };
}

function checkTiff(data: Uint8Array): Layer1MagicBytesResult {
  const isLe = data[0] === 0x49 && data[1] === 0x49 && data[2] === 0x2a && data[3] === 0x00;
  const isBe = data[0] === 0x4d && data[1] === 0x4d && data[2] === 0x00 && data[3] === 0x2a;
  if (data.byteLength >= 4 && (isLe || isBe)) {
    return { valid: true, detectedSignature: isLe ? 'II*\\0 (Little-Endian TIFF)' : 'MM\\0* (Big-Endian TIFF)' };
  }
  return {
    valid: false,
    expectedSignature: 'II*\\0 ou MM\\0*',
    detectedSignature: hexSlice(data, 4),
    error: 'Arquivo TIFF não possui assinatura válida de endianness.',
  };
}

function checkIco(data: Uint8Array): Layer1MagicBytesResult {
  if (data.byteLength >= 4 && data[0] === 0x00 && data[1] === 0x00 && data[2] === 0x01 && data[3] === 0x00) {
    return { valid: true, detectedSignature: '00 00 01 00 (ICO header)' };
  }
  return {
    valid: false,
    expectedSignature: '00 00 01 00',
    detectedSignature: hexSlice(data, 4),
    error: 'Arquivo ICO não possui cabeçalho de ícone válido.',
  };
}

function checkSvg(data: Uint8Array): Layer1MagicBytesResult {
  const text = new TextDecoder().decode(data.subarray(0, Math.min(data.byteLength, 512))).trim();
  if (text.includes('<svg') || text.includes('<?xml')) {
    return { valid: true, detectedSignature: '<svg> XML' };
  }
  return {
    valid: false,
    expectedSignature: 'XML com tag <svg>',
    detectedSignature: text.slice(0, 30),
    error: 'Arquivo SVG não contém tag <svg> ou declaração XML válida.',
  };
}

function checkMp3(data: Uint8Array): Layer1MagicBytesResult {
  // ID3 tag or MPEG sync word 0xFFE0
  if (data.byteLength >= 3 && data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33) {
    return { valid: true, detectedSignature: 'ID3 (ID3v2 tag)' };
  }
  if (data.byteLength >= 2 && data[0] === 0xff && (data[1] & 0xe0) === 0xe0) {
    return { valid: true, detectedSignature: 'MPEG Frame Sync (FF Ex)' };
  }
  return {
    valid: false,
    expectedSignature: 'ID3 ou MPEG Sync (FF Ex)',
    detectedSignature: hexSlice(data, 4),
    error: 'Arquivo MP3 não possui tag ID3 nem frame sync MPEG válido.',
  };
}

function checkFlac(data: Uint8Array): Layer1MagicBytesResult {
  if (data.byteLength >= 4 && data[0] === 0x66 && data[1] === 0x4c && data[2] === 0x61 && data[3] === 0x43) {
    return { valid: true, detectedSignature: 'fLaC' };
  }
  return {
    valid: false,
    expectedSignature: '66 4C 61 43 (fLaC)',
    detectedSignature: hexSlice(data, 4),
    error: 'Arquivo FLAC não possui cabeçalho fLaC.',
  };
}

function checkOgg(data: Uint8Array, label: string): Layer1MagicBytesResult {
  if (data.byteLength >= 4 && data[0] === 0x4f && data[1] === 0x67 && data[2] === 0x67 && data[3] === 0x53) {
    return { valid: true, detectedSignature: 'OggS' };
  }
  return {
    valid: false,
    expectedSignature: '4F 67 67 53 (OggS)',
    detectedSignature: hexSlice(data, 4),
    error: `Arquivo ${label} não possui assinatura de página OggS.`,
  };
}

function checkRiff(data: Uint8Array, subType: string, label: string): Layer1MagicBytesResult {
  if (
    data.byteLength >= 12 &&
    data[0] === 0x52 &&
    data[1] === 0x49 &&
    data[2] === 0x46 &&
    data[3] === 0x46
  ) {
    const sub = String.fromCharCode(data[8], data[9], data[10], data[11]);
    if (sub === subType) {
      return { valid: true, detectedSignature: `RIFF....${subType}` };
    }
  }
  return {
    valid: false,
    expectedSignature: `RIFF....${subType}`,
    detectedSignature: hexSlice(data, 12),
    error: `Arquivo ${label} não possui cabeçalho RIFF com subtipo ${subType}.`,
  };
}

function checkFormAiff(data: Uint8Array): Layer1MagicBytesResult {
  if (
    data.byteLength >= 12 &&
    data[0] === 0x46 &&
    data[1] === 0x4f &&
    data[2] === 0x52 &&
    data[3] === 0x4d &&
    data[8] === 0x41 &&
    data[9] === 0x49 &&
    data[10] === 0x46 &&
    data[11] === 0x46
  ) {
    return { valid: true, detectedSignature: 'FORM....AIFF' };
  }
  return {
    valid: false,
    expectedSignature: 'FORM....AIFF',
    detectedSignature: hexSlice(data, 12),
    error: 'Arquivo AIFF não possui cabeçalho FORM/AIFF válido.',
  };
}

function checkAsf(data: Uint8Array, label: string): Layer1MagicBytesResult {
  // ASF Header Object GUID: 30 26 B2 75 8E 66 CF 11 A6 D9 00 AA 00 62 CE 6C
  if (
    data.byteLength >= 16 &&
    data[0] === 0x30 &&
    data[1] === 0x26 &&
    data[2] === 0xb2 &&
    data[3] === 0x75 &&
    data[4] === 0x8e &&
    data[5] === 0x66 &&
    data[6] === 0xcf &&
    data[7] === 0x11
  ) {
    return { valid: true, detectedSignature: 'ASF Header GUID' };
  }
  return {
    valid: false,
    expectedSignature: 'ASF Header GUID (30 26 B2 75...)',
    detectedSignature: hexSlice(data, 8),
    error: `Arquivo ${label} não possui assinatura ASF/WM válida.`,
  };
}

function checkIsoBmff(data: Uint8Array, label: string): Layer1MagicBytesResult {
  if (data.byteLength < 8) {
    return { valid: false, error: `Arquivo ${label} muito curto para contêiner ISO-BMFF.` };
  }
  // Check for ftyp at offset 4
  const hasFtyp = data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70;
  if (hasFtyp) {
    const majorBrand = String.fromCharCode(data[8] || 0, data[9] || 0, data[10] || 0, data[11] || 0);
    return { valid: true, detectedSignature: `ISO-BMFF ftyp (${majorBrand})` };
  }
  // Alternate top-level atoms: moov, mdat, free, wide
  const atom = String.fromCharCode(data[4], data[5], data[6], data[7]);
  if (['moov', 'mdat', 'free', 'wide'].includes(atom)) {
    return { valid: true, detectedSignature: `ISO-BMFF top-level atom (${atom})` };
  }

  return {
    valid: false,
    expectedSignature: 'ISO-BMFF caixa ftyp no offset 4',
    detectedSignature: hexSlice(data, 8),
    error: `Arquivo ${label} não possui a caixa ftyp nem atom ISO-BMFF válido no cabeçalho.`,
  };
}

function checkIsoBmffOrAdts(data: Uint8Array, ext: string): Layer1MagicBytesResult {
  // If extension is .aac, it could be raw ADTS stream (0xFFF1 or 0xFFF9) OR an ISO-BMFF container
  if (ext === 'aac') {
    if (data.byteLength >= 2 && data[0] === 0xff && (data[1] & 0xf6) === 0xf0) {
      return { valid: true, detectedSignature: 'ADTS AAC Sync Word (FF Fx)' };
    }
  }
  return checkIsoBmff(data, ext.toUpperCase());
}

function checkEbml(data: Uint8Array, label: string): Layer1MagicBytesResult {
  if (data.byteLength >= 4 && data[0] === 0x1a && data[1] === 0x45 && data[2] === 0xdf && data[3] === 0xa3) {
    return { valid: true, detectedSignature: '1A 45 DF A3 (EBML)' };
  }
  return {
    valid: false,
    expectedSignature: '1A 45 DF A3 (EBML)',
    detectedSignature: hexSlice(data, 4),
    error: `Arquivo ${label} não possui cabeçalho EBML válido.`,
  };
}

function checkTs(data: Uint8Array): Layer1MagicBytesResult {
  // MPEG-TS packet sync byte is 0x47 every 188 bytes
  if (data.byteLength >= 188 && data[0] === 0x47) {
    return { valid: true, detectedSignature: 'MPEG-TS Sync Byte (0x47)' };
  }
  return {
    valid: false,
    expectedSignature: '0x47 no offset 0 (MPEG-TS)',
    detectedSignature: hexSlice(data, 4),
    error: 'Arquivo MPEG-TS não inicia com o sync byte 0x47.',
  };
}

function checkFlv(data: Uint8Array): Layer1MagicBytesResult {
  if (data.byteLength >= 3 && data[0] === 0x46 && data[1] === 0x4c && data[2] === 0x56) {
    return { valid: true, detectedSignature: 'FLV' };
  }
  return {
    valid: false,
    expectedSignature: '46 4C 56 (FLV)',
    detectedSignature: hexSlice(data, 4),
    error: 'Arquivo FLV não possui assinatura FLV.',
  };
}

function checkMpegPs(data: Uint8Array): Layer1MagicBytesResult {
  // MPEG Program Stream Pack Header: 00 00 01 BA
  if (data.byteLength >= 4 && data[0] === 0x00 && data[1] === 0x00 && data[2] === 0x01 && data[3] === 0xba) {
    return { valid: true, detectedSignature: 'MPEG-PS Pack Header (00 00 01 BA)' };
  }
  return {
    valid: false,
    expectedSignature: '00 00 01 BA',
    detectedSignature: hexSlice(data, 4),
    error: 'Arquivo MPEG não possui pack header 00 00 01 BA.',
  };
}

function checkZip(data: Uint8Array, label: string): Layer1MagicBytesResult {
  // PK\x03\x04 (0x50, 0x4B, 0x03, 0x04) or empty zip PK\x05\x06 (0x50, 0x4B, 0x05, 0x06)
  if (
    data.byteLength >= 4 &&
    data[0] === 0x50 &&
    data[1] === 0x4b &&
    (data[2] === 0x03 || data[2] === 0x05) &&
    (data[3] === 0x04 || data[3] === 0x06)
  ) {
    return { valid: true, detectedSignature: 'PK\\x03\\x04 (ZIP container)' };
  }
  return {
    valid: false,
    expectedSignature: '50 4B 03 04 (PK\\x03\\x04)',
    detectedSignature: hexSlice(data, 4),
    error: `Documento ${label} não possui assinatura ZIP/OpenXML/ODF válida (PK\\x03\\x04). O arquivo pode estar vazio ou corrompido.`,
  };
}

function checkOle2Compound(data: Uint8Array, label: string): Layer1MagicBytesResult {
  // OLE2 Compound File Header: D0 CF 11 E0 A1 B1 1A E1
  if (
    data.byteLength >= 8 &&
    data[0] === 0xd0 &&
    data[1] === 0xcf &&
    data[2] === 0x11 &&
    data[3] === 0xe0 &&
    data[4] === 0xa1 &&
    data[5] === 0xb1 &&
    data[6] === 0x1a &&
    data[7] === 0xe1
  ) {
    return { valid: true, detectedSignature: 'OLE2 Compound Document' };
  }
  return {
    valid: false,
    expectedSignature: 'D0 CF 11 E0 A1 B1 1A E1 (OLE2)',
    detectedSignature: hexSlice(data, 8),
    error: `Arquivo ${label} binário antigo não possui assinatura OLE2 Compound Document.`,
  };
}

function checkRtf(data: Uint8Array): Layer1MagicBytesResult {
  const text = new TextDecoder().decode(data.subarray(0, Math.min(data.byteLength, 64)));
  if (text.startsWith('{\\rtf')) {
    return { valid: true, detectedSignature: '{\\rtf' };
  }
  return {
    valid: false,
    expectedSignature: '{\\rtf',
    detectedSignature: text.slice(0, 10),
    error: 'Arquivo RTF não inicia com a tag {\\rtf.',
  };
}

function checkHtml(data: Uint8Array): Layer1MagicBytesResult {
  const text = new TextDecoder().decode(data.subarray(0, Math.min(data.byteLength, 256))).trim().toLowerCase();
  if (text.includes('<html') || text.includes('<!doctype') || text.includes('<body') || text.includes('<head')) {
    return { valid: true, detectedSignature: 'HTML document' };
  }
  return {
    valid: false,
    expectedSignature: '<!DOCTYPE html> ou <html>',
    detectedSignature: text.slice(0, 30),
    error: 'Arquivo HTML não contém tags HTML ou declaração DOCTYPE.',
  };
}

function checkJson(data: Uint8Array): Layer1MagicBytesResult {
  try {
    const text = new TextDecoder().decode(data).trim();
    if (!text.startsWith('{') && !text.startsWith('[')) {
      return { valid: false, error: 'JSON não inicia com { ou [.' };
    }
    JSON.parse(text);
    return { valid: true, detectedSignature: 'Valid JSON string' };
  } catch (err) {
    return { valid: false, error: `JSON malformado ou inválido: ${err}` };
  }
}

function checkPlainText(data: Uint8Array, label: string): Layer1MagicBytesResult {
  // Check that content is valid UTF-8 and contains printable text
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(data);
    return { valid: text.length > 0, detectedSignature: `Texto UTF-8 (${text.length} chars)` };
  } catch {
    return {
      valid: false,
      error: `Arquivo ${label} contém bytes binários inválidos para texto plano UTF-8.`,
    };
  }
}

function hexSlice(data: Uint8Array, len: number): string {
  const slice = data.subarray(0, Math.min(data.byteLength, len));
  return Array.from(slice)
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
}

function checkJxl(data: Uint8Array): Layer1MagicBytesResult {
  if (data.byteLength >= 2 && data[0] === 0xff && data[1] === 0x0a) {
    return { valid: true, detectedSignature: 'FF 0A (JXL Codestream)' };
  }
  if (
    data.byteLength >= 12 &&
    data[0] === 0x00 &&
    data[1] === 0x00 &&
    data[2] === 0x00 &&
    data[3] === 0x0c &&
    data[4] === 0x4a &&
    data[5] === 0x58 &&
    data[6] === 0x4c &&
    data[7] === 0x20
  ) {
    return { valid: true, detectedSignature: '00 00 00 0C JXL  (ISO-BMFF JXL)' };
  }
  return {
    valid: false,
    expectedSignature: 'FF 0A ou container JXL',
    detectedSignature: hexSlice(data, 12),
    error: 'Arquivo JPEG XL (JXL) não possui assinatura válida.',
  };
}

function checkQoi(data: Uint8Array): Layer1MagicBytesResult {
  if (data.byteLength >= 14 && data[0] === 0x71 && data[1] === 0x6f && data[2] === 0x69 && data[3] === 0x66) {
    return { valid: true, detectedSignature: 'qoif' };
  }
  return {
    valid: false,
    expectedSignature: '71 6F 69 66 (qoif)',
    detectedSignature: hexSlice(data, 4),
    error: 'Arquivo QOI não possui cabeçalho qoif válido.',
  };
}

function checkPsd(data: Uint8Array): Layer1MagicBytesResult {
  if (data.byteLength >= 4 && data[0] === 0x38 && data[1] === 0x42 && data[2] === 0x50 && data[3] === 0x53) {
    return { valid: true, detectedSignature: '8BPS' };
  }
  return {
    valid: false,
    expectedSignature: '38 42 50 53 (8BPS)',
    detectedSignature: hexSlice(data, 4),
    error: 'Arquivo PSD não possui assinatura 8BPS.',
  };
}

function checkTga(data: Uint8Array): Layer1MagicBytesResult {
  if (data.byteLength >= 18 && [1, 2, 3, 9, 10, 11].includes(data[2])) {
    return { valid: true, detectedSignature: `TGA type=${data[2]}` };
  }
  return {
    valid: false,
    expectedSignature: 'Cabeçalho TGA (18 bytes, imageType válido)',
    detectedSignature: hexSlice(data, 18),
    error: 'Arquivo TGA inválido.',
  };
}

function checkPnm(data: Uint8Array, label: string): Layer1MagicBytesResult {
  if (data.byteLength >= 3 && data[0] === 0x50 && data[1] >= 0x31 && data[1] <= 0x36) {
    return { valid: true, detectedSignature: `P${String.fromCharCode(data[1])}` };
  }
  return {
    valid: false,
    expectedSignature: 'P1..P6',
    detectedSignature: hexSlice(data, 4),
    error: `Arquivo ${label} não possui cabeçalho PNM válido.`,
  };
}

function checkJp2(data: Uint8Array): Layer1MagicBytesResult {
  if (
    (data.byteLength >= 12 && data[4] === 0x6a && data[5] === 0x50 && data[6] === 0x20 && data[7] === 0x20) ||
    (data.byteLength >= 4 && data[0] === 0xff && data[1] === 0x4f && data[2] === 0xff && data[3] === 0x51)
  ) {
    return { valid: true, detectedSignature: 'JP2 / J2K' };
  }
  return {
    valid: false,
    expectedSignature: 'JP2 Signature Box ou FF 4F FF 51',
    detectedSignature: hexSlice(data, 12),
    error: 'Arquivo JPEG 2000 não possui assinatura válida.',
  };
}

function checkIsoBmffImage(data: Uint8Array, label: string): Layer1MagicBytesResult {
  if (data.byteLength >= 12 && data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70) {
    const brand = String.fromCharCode(data[8], data[9], data[10], data[11]);
    return { valid: true, detectedSignature: `ISO-BMFF ftyp (${brand})` };
  }
  return {
    valid: false,
    expectedSignature: 'ISO-BMFF ftyp (avif/heic/mif1)',
    detectedSignature: hexSlice(data, 12),
    error: `Imagem ${label} não possui caixa ISO-BMFF ftyp válida.`,
  };
}

function check7z(data: Uint8Array): Layer1MagicBytesResult {
  if (
    data.byteLength >= 6 &&
    data[0] === 0x37 &&
    data[1] === 0x7a &&
    data[2] === 0xbc &&
    data[3] === 0xaf &&
    data[4] === 0x27 &&
    data[5] === 0x1c
  ) {
    return { valid: true, detectedSignature: '37 7A BC AF 27 1C (7z)' };
  }
  return {
    valid: false,
    expectedSignature: '37 7A BC AF 27 1C',
    detectedSignature: hexSlice(data, 6),
    error: 'Arquivo 7Z não possui assinatura válida.',
  };
}

function checkGzip(data: Uint8Array): Layer1MagicBytesResult {
  if (data.byteLength >= 2 && data[0] === 0x1f && data[1] === 0x8b) {
    return { valid: true, detectedSignature: '1F 8B (GZIP)' };
  }
  return {
    valid: false,
    expectedSignature: '1F 8B',
    detectedSignature: hexSlice(data, 4),
    error: 'Arquivo GZIP não possui assinatura 1F 8B.',
  };
}

function checkBz2(data: Uint8Array): Layer1MagicBytesResult {
  if (data.byteLength >= 3 && data[0] === 0x42 && data[1] === 0x5a && data[2] === 0x68) {
    return { valid: true, detectedSignature: '42 5A 68 (BZh)' };
  }
  return {
    valid: false,
    expectedSignature: '42 5A 68 (BZh)',
    detectedSignature: hexSlice(data, 4),
    error: 'Arquivo BZIP2 não possui assinatura BZh.',
  };
}

function checkXz(data: Uint8Array): Layer1MagicBytesResult {
  if (
    data.byteLength >= 6 &&
    data[0] === 0xfd &&
    data[1] === 0x37 &&
    data[2] === 0x7a &&
    data[3] === 0x58 &&
    data[4] === 0x5a &&
    data[5] === 0x00
  ) {
    return { valid: true, detectedSignature: 'FD 37 7A 58 5A 00 (XZ)' };
  }
  return {
    valid: false,
    expectedSignature: 'FD 37 7A 58 5A 00',
    detectedSignature: hexSlice(data, 6),
    error: 'Arquivo XZ não possui assinatura válida.',
  };
}

function checkRar(data: Uint8Array): Layer1MagicBytesResult {
  if (
    data.byteLength >= 6 &&
    data[0] === 0x52 &&
    data[1] === 0x61 &&
    data[2] === 0x72 &&
    data[3] === 0x21 &&
    data[4] === 0x1a &&
    data[5] === 0x07
  ) {
    return { valid: true, detectedSignature: 'Rar!' };
  }
  return {
    valid: false,
    expectedSignature: '52 61 72 21 1A 07 (Rar!)',
    detectedSignature: hexSlice(data, 6),
    error: 'Arquivo RAR não possui assinatura válida.',
  };
}

function checkTar(data: Uint8Array): Layer1MagicBytesResult {
  if (data.byteLength >= 512) {
    const ustar = String.fromCharCode(data[257], data[258], data[259], data[260], data[261]);
    if (ustar === 'ustar') {
      return { valid: true, detectedSignature: 'ustar (POSIX TAR)' };
    }
    const storedChecksum = parseInt(
      new TextDecoder('ascii').decode(data.subarray(148, 156)).replace(/\0.*$/, '').trim(),
      8
    );
    if (!Number.isNaN(storedChecksum)) {
      let sum = 0;
      for (let i = 0; i < 512; i++) {
        sum += i >= 148 && i < 156 ? 32 : data[i];
      }
      if (sum === storedChecksum) {
        return { valid: true, detectedSignature: 'TAR V7 Checksum' };
      }
    }
  }
  return {
    valid: false,
    expectedSignature: 'Cabeçalho TAR de 512 bytes (ustar/checksum)',
    detectedSignature: hexSlice(data, 8),
    error: 'Arquivo TAR não possui cabeçalho válido.',
  };
}

function checkDeflate(data: Uint8Array): Layer1MagicBytesResult {
  if (data.byteLength >= 2) {
    const isZlib = (data[0] & 0x0f) === 8 && (((data[0] << 8) | data[1]) % 31 === 0);
    return {
      valid: true,
      detectedSignature: isZlib ? 'ZLIB/Deflate stream' : `Deflate stream (${data.byteLength} bytes)`,
    };
  }
  return { valid: false, error: 'Fluxo Deflate muito curto.' };
}

function checkWoff(data: Uint8Array): Layer1MagicBytesResult {
  if (data.byteLength >= 4 && data[0] === 0x77 && data[1] === 0x4f && data[2] === 0x46 && data[3] === 0x46) {
    return { valid: true, detectedSignature: 'wOFF' };
  }
  return { valid: false, expectedSignature: 'wOFF', detectedSignature: hexSlice(data, 4), error: 'Arquivo WOFF inválido.' };
}

function checkWoff2(data: Uint8Array): Layer1MagicBytesResult {
  if (data.byteLength >= 4 && data[0] === 0x77 && data[1] === 0x4f && data[2] === 0x46 && data[3] === 0x32) {
    return { valid: true, detectedSignature: 'wOF2' };
  }
  return { valid: false, expectedSignature: 'wOF2', detectedSignature: hexSlice(data, 4), error: 'Arquivo WOFF2 inválido.' };
}

function checkTtf(data: Uint8Array): Layer1MagicBytesResult {
  const isSfnt = data.byteLength >= 4 && data[0] === 0x00 && data[1] === 0x01 && data[2] === 0x00 && data[3] === 0x00;
  const isTrue = data.byteLength >= 4 && data[0] === 0x74 && data[1] === 0x72 && data[2] === 0x75 && data[3] === 0x65;
  if (isSfnt || isTrue) {
    return { valid: true, detectedSignature: isSfnt ? '00 01 00 00 (TTF)' : 'true (Apple TTF)' };
  }
  return { valid: false, expectedSignature: '00 01 00 00 ou true', detectedSignature: hexSlice(data, 4), error: 'Arquivo TTF inválido.' };
}

function checkOtf(data: Uint8Array): Layer1MagicBytesResult {
  if (data.byteLength >= 4 && data[0] === 0x4f && data[1] === 0x54 && data[2] === 0x54 && data[3] === 0x4f) {
    return { valid: true, detectedSignature: 'OTTO (OpenType CFF)' };
  }
  // SFNT TrueType outlines can also exist in .otf containers
  if (data.byteLength >= 4 && data[0] === 0x00 && data[1] === 0x01 && data[2] === 0x00 && data[3] === 0x00) {
    return { valid: true, detectedSignature: '00 01 00 00 (OpenType SFNT)' };
  }
  return { valid: false, expectedSignature: '4F 54 54 4F (OTTO)', detectedSignature: hexSlice(data, 4), error: 'Arquivo OTF inválido.' };
}

function checkEot(data: Uint8Array): Layer1MagicBytesResult {
  if (data.byteLength >= 36 && data[34] === 0x4c && data[35] === 0x50) {
    return { valid: true, detectedSignature: '4C 50 (EOT)' };
  }
  return { valid: false, expectedSignature: 'EOT magic LP no offset 34', detectedSignature: hexSlice(data, 4), error: 'Arquivo EOT inválido.' };
}

function checkGlb(data: Uint8Array): Layer1MagicBytesResult {
  if (data.byteLength >= 12 && data[0] === 0x67 && data[1] === 0x6c && data[2] === 0x54 && data[3] === 0x46) {
    return { valid: true, detectedSignature: 'glTF (Binary GLB)' };
  }
  return { valid: false, expectedSignature: '67 6C 54 46 (glTF)', detectedSignature: hexSlice(data, 4), error: 'Arquivo GLB não inicia com glTF.' };
}

function checkGltf(data: Uint8Array): Layer1MagicBytesResult {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(data));
    if (parsed && typeof parsed === 'object' && parsed.asset) {
      return { valid: true, detectedSignature: `glTF JSON v${parsed.asset.version || '?'}` };
    }
    return { valid: false, error: 'glTF JSON não possui campo asset.' };
  } catch (err) {
    return { valid: false, error: `glTF JSON inválido: ${err}` };
  }
}

function checkStl(data: Uint8Array): Layer1MagicBytesResult {
  const head = new TextDecoder('ascii').decode(data.subarray(0, Math.min(data.byteLength, 256)));
  if (head.trimStart().startsWith('solid') && head.includes('facet')) {
    return { valid: true, detectedSignature: 'STL ASCII (solid)' };
  }
  if (data.byteLength >= 84) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const numTriangles = view.getUint32(80, true);
    if (84 + numTriangles * 50 === data.byteLength) {
      return { valid: true, detectedSignature: `STL Binary (${numTriangles} triangles)` };
    }
  }
  return {
    valid: false,
    expectedSignature: 'STL ASCII (solid) ou Binary STL (84 + N*50 bytes)',
    detectedSignature: hexSlice(data, 16),
    error: 'Arquivo STL inválido ou tamanho inconsistente com contagem de triângulos.',
  };
}

function checkObj(data: Uint8Array): Layer1MagicBytesResult {
  const text = new TextDecoder().decode(data.subarray(0, Math.min(data.byteLength, 4096)));
  if (/^v\s+-?\d/m.test(text) || text.includes('\nv ')) {
    return { valid: true, detectedSignature: 'Wavefront OBJ (vertices)' };
  }
  return { valid: false, error: 'Arquivo OBJ não contém definições de vértices (v ).' };
}

function checkPly(data: Uint8Array): Layer1MagicBytesResult {
  const head = new TextDecoder('ascii').decode(data.subarray(0, Math.min(data.byteLength, 64)));
  if (head.startsWith('ply')) {
    return { valid: true, detectedSignature: 'ply' };
  }
  return { valid: false, expectedSignature: 'ply', detectedSignature: head.slice(0, 16), error: 'Arquivo PLY não inicia com ply.' };
}

function checkXmlDocument(data: Uint8Array, label: string): Layer1MagicBytesResult {
  const text = new TextDecoder().decode(data.subarray(0, Math.min(data.byteLength, 512))).trim();
  if (text.startsWith('<?xml') || text.startsWith('<')) {
    return { valid: true, detectedSignature: `${label} XML` };
  }
  return { valid: false, expectedSignature: '<?xml ou tag XML', detectedSignature: text.slice(0, 30), error: `Arquivo ${label} não é um XML válido.` };
}

function checkStep(data: Uint8Array): Layer1MagicBytesResult {
  const text = new TextDecoder('ascii').decode(data.subarray(0, Math.min(data.byteLength, 256)));
  if (text.includes('ISO-10303-21')) {
    return { valid: true, detectedSignature: 'ISO-10303-21 (STEP)' };
  }
  return { valid: false, expectedSignature: 'ISO-10303-21', detectedSignature: text.slice(0, 32), error: 'Arquivo STEP não possui cabeçalho ISO-10303-21.' };
}

function checkIges(data: Uint8Array): Layer1MagicBytesResult {
  const text = new TextDecoder('ascii').decode(data.subarray(0, Math.min(data.byteLength, 256)));
  if (data.byteLength >= 80 && text.includes('S      1')) {
    return { valid: true, detectedSignature: 'IGES Start Section' };
  }
  return { valid: false, error: 'Arquivo IGES inválido.' };
}

function checkBrep(data: Uint8Array): Layer1MagicBytesResult {
  const text = new TextDecoder('ascii').decode(data.subarray(0, Math.min(data.byteLength, 128)));
  if (text.includes('DBRep_DrawableShape') || text.includes('CASCADE')) {
    return { valid: true, detectedSignature: 'OpenCASCADE BREP' };
  }
  return { valid: false, error: 'Arquivo BREP não possui cabeçalho OpenCASCADE.' };
}

function checkMobi(data: Uint8Array, label: string): Layer1MagicBytesResult {
  if (data.byteLength >= 68) {
    const id = String.fromCharCode(...data.subarray(60, 68));
    if (id === 'BOOKMOBI' || id === 'TEXtREAd') {
      return { valid: true, detectedSignature: `PalmDB (${id})` };
    }
  }
  return { valid: false, expectedSignature: 'BOOKMOBI', detectedSignature: hexSlice(data, 12), error: `Ebook ${label} inválido.` };
}

function checkSrt(data: Uint8Array): Layer1MagicBytesResult {
  const text = new TextDecoder('utf-8').decode(data);
  if (text.includes('-->')) {
    return { valid: true, detectedSignature: 'SRT subtitle timestamps' };
  }
  return { valid: false, error: 'Arquivo SRT não contém timestamps válidos (-->).' };
}

function checkVtt(data: Uint8Array): Layer1MagicBytesResult {
  const text = new TextDecoder('utf-8').decode(data.subarray(0, Math.min(data.byteLength, 64))).trim();
  if (text.startsWith('WEBVTT')) {
    return { valid: true, detectedSignature: 'WEBVTT' };
  }
  return { valid: false, expectedSignature: 'WEBVTT', detectedSignature: text.slice(0, 16), error: 'Arquivo VTT não inicia com WEBVTT.' };
}
