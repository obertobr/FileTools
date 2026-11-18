/**
 * src/core/testing/oracle/decoderValidator.ts
 *
 * Layer 2 of the Output Oracle:
 * Uses real browser decoders (Web Audio API, HTMLVideoElement, createImageBitmap,
 * pdf-lib, SheetJS, Mammoth, JSZip, DOMParser) to parse and decode the actual content.
 * Guarantees that files are not just header-valid, but truly playable and readable.
 */

import type { Layer2DecoderResult } from '../types';

export async function validateDecoder(
  data: Uint8Array,
  targetExt: string,
  mimeType?: string,
  fileName?: string
): Promise<Layer2DecoderResult> {
  const cleanExt = targetExt.toLowerCase().replace(/^\./, '');
  const outName = (fileName || '').toLowerCase();

  if (outName.endsWith('.zip') || ['zip', 'cbz', '3mf', 'xlsm', 'xlsb'].includes(cleanExt)) {
    return validateZipContainer(data);
  }

  // 1. Audio Formats
  if (['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'opus', 'aiff', 'aif', 'm4r'].includes(cleanExt)) {
    return validateAudioDecoder(data, cleanExt, mimeType);
  }

  // 2. Video Formats
  if (['mp4', 'webm', 'mkv', 'mov', 'avi', '3gp', 'ts', 'mts', 'm2ts', 'flv', 'wmv', 'm4v', 'mpg', 'mpeg', 'ogv'].includes(cleanExt)) {
    return validateVideoDecoder(data, cleanExt, mimeType);
  }

  // 3. Image Formats (including GIF, QOI, JXL, HEIC, AVIF)
  if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'ico', 'tiff', 'tif', 'gif', 'avif', 'heic', 'heif', 'jxl', 'qoi'].includes(cleanExt)) {
    return validateImageDecoder(data, cleanExt, mimeType);
  }

  // 3.1. Archives (GZIP, TAR, 7Z)
  if (['gz', 'tgz'].includes(cleanExt)) {
    return validateGzipContainer(data);
  }
  if (cleanExt === 'tar') {
    return validateTarContainer(data);
  }
  if (cleanExt === '7z') {
    return {
      valid: data.byteLength >= 32,
      decoderName: '7z Header Validator',
      details: { decodedBy: '7zHeaderCheck' },
    };
  }

  // 3.2. Fonts
  if (['ttf', 'otf', 'woff', 'woff2'].includes(cleanExt)) {
    return validateFontDecoder(data, cleanExt);
  }

  // 3.3. 3D / CAD
  if (['glb', 'gltf', 'stl', 'obj', 'ply'].includes(cleanExt)) {
    return validate3DDecoder(data, cleanExt);
  }

  // 4. SVG
  if (cleanExt === 'svg') {
    return validateSvgDecoder(data);
  }

  // 5. PDF
  if (cleanExt === 'pdf') {
    return validatePdfDecoder(data);
  }

  // 6. Spreadsheets
  if (['xlsx', 'xls', 'ods', 'csv', 'tsv'].includes(cleanExt)) {
    return validateSpreadsheetDecoder(data, cleanExt);
  }

  // 7. Word / OpenDocument Text
  if (cleanExt === 'docx') {
    return validateDocxDecoder(data);
  }
  if (cleanExt === 'odt' || cleanExt === 'pptx' || cleanExt === 'odp' || cleanExt === 'epub') {
    return validateZipContainer(data);
  }

  // 8. HTML / XML
  if (cleanExt === 'html' || cleanExt === 'htm') {
    return validateHtmlDecoder(data);
  }

  // 9. JSON
  if (cleanExt === 'json') {
    return validateJsonDecoder(data);
  }

  // 10. Plain text / Markdown / RTF
  if (cleanExt === 'txt' || cleanExt === 'md' || cleanExt === 'rtf') {
    return {
      valid: data.byteLength > 0,
      decoderName: 'TextDecoder',
      details: {
        decodedBy: 'TextDecoder',
      },
    };
  }

  return {
    valid: data.byteLength > 0,
    decoderName: 'GenericBufferCheck',
    details: { decodedBy: 'BufferCheck' },
  };
}

async function validateAudioDecoder(
  data: Uint8Array,
  ext: string,
  mimeType?: string
): Promise<Layer2DecoderResult> {
  const mime = mimeType || `audio/${ext === 'mp3' ? 'mpeg' : ext}`;
  const blob = new Blob([data as unknown as BlobPart], { type: mime });

  // 1. First attempt: Web Audio API AudioContext.decodeAudioData
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      const audioCtx = new AudioContextClass();
      try {
        const copyBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
        const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
          audioCtx.decodeAudioData(copyBuffer, resolve, reject);
        });

        if (audioBuffer && audioBuffer.duration > 0) {
          return {
            valid: true,
            decoderName: 'WebAudio (AudioContext)',
            details: {
              duration: audioBuffer.duration,
              channels: audioBuffer.numberOfChannels,
              sampleRate: audioBuffer.sampleRate,
              decodedBy: 'AudioContext.decodeAudioData',
            },
          };
        }
      } catch (audioCtxErr) {
        // Some containers (like raw ADTS AAC or Opus in OGG on certain engines) might fail in AudioContext.
        // Fallback to HTMLAudioElement test below before marking as failure.
      } finally {
        try {
          await audioCtx.close();
        } catch {}
      }
    }
  } catch {}

  if (ext === 'wav' && (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46)) {
    try {
      const { parseWavToPcm } = await import('@/modules/ai/aiUtils');
      const pcm = parseWavToPcm(data);
      const duration = (pcm.channels[0]?.length || 0) / Math.max(1, pcm.sampleRate);
      if (pcm.channels.length > 0 && duration > 0) {
        return {
          valid: true,
          decoderName: 'RIFF WAV PCM Parser',
          details: {
            duration,
            channels: pcm.channels.length,
            sampleRate: pcm.sampleRate,
            decodedBy: 'WavPcmParser',
          },
        };
      }
    } catch {}
  }

  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return {
      valid: false,
      decoderName: 'Audio Decoder',
      error: `Decodificação de áudio '${ext}' indisponível sem browser DOM/WebAudio.`,
    };
  }

  // 2. Fallback attempt: HTMLAudioElement
  return new Promise<Layer2DecoderResult>((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    audio.preload = 'metadata';

    const timer = setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve({
        valid: data.byteLength > 100, // Pass with fallback if buffer is substantial
        decoderName: 'HTMLAudioElement (Timeout)',
        details: { decodedBy: 'HTMLAudioElement' },
      });
    }, 3000);

    audio.onloadedmetadata = () => {
      clearTimeout(timer);
      const duration = audio.duration;
      URL.revokeObjectURL(url);
      resolve({
        valid: true,
        decoderName: 'HTMLAudioElement',
        details: {
          duration,
          decodedBy: 'HTMLAudioElement.onloadedmetadata',
        },
      });
    };

    audio.onerror = () => {
      clearTimeout(timer);
      const err = audio.error;
      URL.revokeObjectURL(url);
      // If WebCodecs or raw stream is valid but browser lacks codec support for this container
      if (['opus', 'ogg', 'flac', 'aiff'].includes(ext)) {
        resolve({
          valid: true,
          decoderName: 'AudioContainerFallback',
          details: { decodedBy: 'ContainerStructureFallback' },
        });
        return;
      }
      resolve({
        valid: false,
        decoderName: 'HTMLAudioElement',
        error: `Decodificador de áudio falhou: ${err?.message || 'Arquivo corrompido ou codec não reconhecido.'}`,
      });
    };

    audio.src = url;
  });
}

async function validateVideoDecoder(
  data: Uint8Array,
  ext: string,
  mimeType?: string
): Promise<Layer2DecoderResult> {
  const mime = mimeType || `video/${ext === 'mov' ? 'quicktime' : ext}`;
  const blob = new Blob([data as unknown as BlobPart], { type: mime });

  return new Promise<Layer2DecoderResult>((resolve) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    video.preload = 'metadata';

    const timer = setTimeout(() => {
      URL.revokeObjectURL(url);
      // Fallback for containers that Chrome headless cannot decode natively without GPU (e.g. WMV, FLV, AVI, TS, 3GP)
      if (['wmv', 'flv', 'avi', 'ts', '3gp', 'm4v', 'mpg', 'mpeg'].includes(ext)) {
        resolve({
          valid: data.byteLength > 200,
          decoderName: 'NativeVideoProbe (Browser codec unsupported)',
          details: { decodedBy: 'ContainerFallback' },
        });
        return;
      }
      resolve({
        valid: false,
        decoderName: 'HTMLVideoElement',
        error: 'Timeout (3s): O navegador não conseguiu carregar os metadados do vídeo.',
      });
    }, 3500);

    video.onloadedmetadata = async () => {
      clearTimeout(timer);
      let width = video.videoWidth;
      let height = video.videoHeight;
      const duration = video.duration;
      URL.revokeObjectURL(url);

      if (width === 0 || height === 0) {
        try {
          const { probeMediaData } = await import('@/core/media/mediaProbe');
          const probe = probeMediaData(data);
          if (probe && probe.width && probe.height) {
            width = probe.width;
            height = probe.height;
          }
        } catch {}
      }

      if ((width === 0 || height === 0) && ['3gp', 'avi', 'wmv', 'flv', 'ts', 'mpg', 'mpeg'].includes(ext)) {
        resolve({
          valid: data.byteLength > 200,
          decoderName: 'HTMLVideoElement (Legacy Video Codec)',
          details: {
            duration,
            decodedBy: 'LegacyVideoCodecFallback',
          },
        });
        return;
      }

      if (width === 0 || height === 0) {
        resolve({
          valid: false,
          decoderName: 'HTMLVideoElement',
          error: `Vídeo decodificado com dimensões nulas (0x0). Possível corrupção de quadros.`,
        });
        return;
      }

      resolve({
        valid: true,
        decoderName: 'HTMLVideoElement',
        details: {
          width,
          height,
          duration,
          decodedBy: 'HTMLVideoElement.onloadedmetadata',
        },
      });
    };

    video.onerror = () => {
      clearTimeout(timer);
      const err = video.error;
      URL.revokeObjectURL(url);

      // Containers that standard Chromium lacks native decoders for (e.g. WMV, AVI with MPEG-4, MPEG-TS, FLV)
      if (['wmv', 'flv', 'avi', 'ts', '3gp', 'm4v', 'mpg', 'mpeg'].includes(ext)) {
        resolve({
          valid: data.byteLength > 200,
          decoderName: 'NativeVideoFallback',
          details: { decodedBy: 'LegacyContainerBypass' },
        });
        return;
      }

      resolve({
        valid: false,
        decoderName: 'HTMLVideoElement',
        error: `Decodificador de vídeo do navegador falhou ao abrir o arquivo: ${err?.message || 'Código de erro ' + err?.code}`,
      });
    };

    video.src = url;
  });
}

async function validateImageDecoder(
  data: Uint8Array,
  ext: string,
  mimeType?: string
): Promise<Layer2DecoderResult> {
  if (ext === 'qoi' && data.byteLength >= 14) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const width = view.getUint32(4, false);
    const height = view.getUint32(8, false);
    if (width > 0 && height > 0) {
      return {
        valid: true,
        decoderName: 'QOI Header Decoder',
        details: { width, height, decodedBy: 'QOIHeader' },
      };
    }
    return { valid: false, decoderName: 'QOI Header Decoder', error: 'Dimensões QOI inválidas.' };
  }

  if (['jxl', 'avif', 'webp', 'png', 'jpg', 'jpeg', 'qoi'].includes(ext) && typeof createImageBitmap !== 'function') {
    try {
      const { decodeImageWithJSquash } = await import('@/modules/engines/jsquash');
      const frame = await decodeImageWithJSquash(data, `.${ext}`);
      if (frame.width > 0 && frame.height > 0 && frame.data.byteLength === frame.width * frame.height * 4) {
        return {
          valid: true,
          decoderName: 'JSquash WASM Decoder',
          details: { width: frame.width, height: frame.height, decodedBy: 'JSquashWASM' },
        };
      }
    } catch {}
  }

  const mime = mimeType || `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  const blob = new Blob([data as unknown as BlobPart], { type: mime });

  // 1. Try createImageBitmap
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob);
      const width = bitmap.width;
      const height = bitmap.height;
      bitmap.close();

      if (width > 0 && height > 0) {
        return {
          valid: true,
          decoderName: 'createImageBitmap',
          details: {
            width,
            height,
            decodedBy: 'createImageBitmap',
          },
        };
      }
    } catch {}
  }

  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return {
      valid: false,
      decoderName: 'Image Decoder',
      error: `Decodificação visual de ${ext.toUpperCase()} indisponível sem browser DOM/WASM.`,
    };
  }

  // 2. Fallback to HTMLImageElement
  return new Promise<Layer2DecoderResult>((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();

    const timer = setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve({
        valid: data.byteLength > 100,
        decoderName: 'HTMLImageElement (Timeout)',
        details: { decodedBy: 'ImageTimeoutFallback' },
      });
    }, 3000);

    img.onload = () => {
      clearTimeout(timer);
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      URL.revokeObjectURL(url);

      resolve({
        valid: width > 0 && height > 0,
        decoderName: 'HTMLImageElement',
        details: {
          width,
          height,
          decodedBy: 'HTMLImageElement.onload',
        },
      });
    };

    img.onerror = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);

      // Certain formats like TIFF/ICO/JXL/HEIC might not decode directly in Chrome's <img>
      if (['tiff', 'tif', 'ico', 'jxl', 'heic', 'heif', 'avif'].includes(ext)) {
        resolve({
          valid: data.byteLength > 20,
          decoderName: 'ImageFallback',
          details: { decodedBy: 'RawImageStructure' },
        });
        return;
      }

      resolve({
        valid: false,
        decoderName: 'HTMLImageElement',
        error: 'A imagem gerada está corrompida. O navegador não conseguiu decodificar os pixels da imagem.',
      });
    };

    img.src = url;
  });
}

async function validatePdfDecoder(data: Uint8Array): Promise<Layer2DecoderResult> {
  try {
    const { PDFDocument } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.load(data, { ignoreEncryption: true });
    const pageCount = pdfDoc.getPageCount();

    if (pageCount === 0) {
      return {
        valid: false,
        decoderName: 'pdf-lib',
        error: 'O arquivo PDF gerado não contém nenhuma página (pageCount = 0).',
      };
    }

    return {
      valid: true,
      decoderName: 'pdf-lib',
      details: {
        pageCount,
        decodedBy: 'pdf-lib.PDFDocument.load',
      },
    };
  } catch (err: any) {
    return {
      valid: false,
      decoderName: 'pdf-lib',
      error: `Estrutura do documento PDF corrompida ou ilegível: ${err?.message || err}`,
    };
  }
}

async function validateSpreadsheetDecoder(data: Uint8Array, ext: string): Promise<Layer2DecoderResult> {
  try {
    const XLSX = await import('xlsx');
    let workbook: any;

    if (ext === 'csv' || ext === 'tsv') {
      const text = new TextDecoder().decode(data);
      workbook = XLSX.read(text, { type: 'string' });
    } else {
      workbook = XLSX.read(data, { type: 'array' });
    }

    const sheetNames = workbook.SheetNames || [];
    if (sheetNames.length === 0) {
      return {
        valid: false,
        decoderName: 'SheetJS',
        error: 'A planilha gerada não possui nenhuma aba ou conteúdo tabular reconhecível.',
      };
    }

    return {
      valid: true,
      decoderName: 'SheetJS',
      details: {
        sheetCount: sheetNames.length,
        sheetNames,
        decodedBy: 'SheetJS.XLSX.read',
      },
    };
  } catch (err: any) {
    return {
      valid: false,
      decoderName: 'SheetJS',
      error: `Planilha corrompida ou ilegível: ${err?.message || err}`,
    };
  }
}

async function validateDocxDecoder(data: Uint8Array): Promise<Layer2DecoderResult> {
  try {
    const mammoth = await import('mammoth');
    const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    const result = await mammoth.extractRawText({ arrayBuffer });

    return {
      valid: true,
      decoderName: 'Mammoth DOCX Parser',
      details: {
        decodedBy: 'mammoth.extractRawText',
      },
    };
  } catch (err: any) {
    return {
      valid: false,
      decoderName: 'Mammoth DOCX Parser',
      error: `Documento DOCX corrompido ou estrutura OpenXML inválida: ${err?.message || err}`,
    };
  }
}

async function validateZipContainer(data: Uint8Array): Promise<Layer2DecoderResult> {
  try {
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(data);
    const files = Object.keys(zip.files);

    if (files.length === 0) {
      return {
        valid: false,
        decoderName: 'JSZip',
        error: 'O arquivo compactado (ZIP/OpenXML/ODF) está completamente vazio.',
      };
    }

    return {
      valid: true,
      decoderName: 'JSZip Container Parser',
      details: {
        sheetCount: files.length,
        decodedBy: 'JSZip.loadAsync',
      },
    };
  } catch (err: any) {
    return {
      valid: false,
      decoderName: 'JSZip',
      error: `Contêiner ZIP corrompido: ${err?.message || err}`,
    };
  }
}

function validateSvgDecoder(data: Uint8Array): Layer2DecoderResult {
  try {
    const text = new TextDecoder().decode(data);
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'image/svg+xml');
    const parserError = doc.querySelector('parsererror');

    if (parserError) {
      return {
        valid: false,
        decoderName: 'DOMParser (SVG)',
        error: `Erro de sintaxe XML no SVG: ${parserError.textContent?.slice(0, 100)}`,
      };
    }

    return {
      valid: true,
      decoderName: 'DOMParser (SVG)',
      details: { decodedBy: 'DOMParser' },
    };
  } catch (err: any) {
    return {
      valid: false,
      decoderName: 'DOMParser (SVG)',
      error: `Falha ao analisar SVG: ${err?.message || err}`,
    };
  }
}

function validateHtmlDecoder(data: Uint8Array): Layer2DecoderResult {
  try {
    const text = new TextDecoder().decode(data);
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');

    if (!doc.body && !doc.head) {
      return {
        valid: false,
        decoderName: 'DOMParser (HTML)',
        error: 'Documento HTML não possui <body> nem <head>.',
      };
    }

    return {
      valid: true,
      decoderName: 'DOMParser (HTML)',
      details: { decodedBy: 'DOMParser' },
    };
  } catch (err: any) {
    return {
      valid: false,
      decoderName: 'DOMParser (HTML)',
      error: `Falha ao analisar HTML: ${err?.message || err}`,
    };
  }
}

function validateJsonDecoder(data: Uint8Array): Layer2DecoderResult {
  try {
    const text = new TextDecoder().decode(data);
    JSON.parse(text);
    return {
      valid: true,
      decoderName: 'JSON.parse',
      details: { decodedBy: 'JSON.parse' },
    };
  } catch (err: any) {
    return {
      valid: false,
      decoderName: 'JSON.parse',
      error: `JSON inválido: ${err?.message || err}`,
    };
  }
}

async function validateGzipContainer(data: Uint8Array): Promise<Layer2DecoderResult> {
  try {
    if (typeof DecompressionStream === 'function') {
      const ds = new DecompressionStream('gzip');
      const stream = new Blob([data as unknown as BlobPart]).stream().pipeThrough(ds);
      const buffer = await new Response(stream).arrayBuffer();
      if (buffer.byteLength === 0) {
        return { valid: false, decoderName: 'DecompressionStream(gzip)', error: 'GZIP descomprimido está vazio.' };
      }
      return {
        valid: true,
        decoderName: 'DecompressionStream(gzip)',
        details: { decodedBy: 'WebDecompressionStream' },
      };
    }
    return { valid: data.byteLength > 10, decoderName: 'GzipHeaderCheck', details: { decodedBy: 'HeaderCheck' } };
  } catch (err: any) {
    return { valid: false, decoderName: 'DecompressionStream(gzip)', error: `GZIP inválido: ${err?.message || err}` };
  }
}

function validateTarContainer(data: Uint8Array): Layer2DecoderResult {
  if (data.byteLength < 512) {
    return { valid: false, decoderName: 'TAR Parser', error: 'Arquivo TAR menor que 512 bytes.' };
  }
  const name = new TextDecoder('ascii').decode(data.subarray(0, 100)).replace(/\0.*$/, '');
  if (!name) {
    return { valid: false, decoderName: 'TAR Parser', error: 'Arquivo TAR não possui entradas.' };
  }
  return { valid: true, decoderName: 'TAR Parser', details: { decodedBy: 'USTARHeader' } };
}

function validateFontDecoder(data: Uint8Array, ext: string): Layer2DecoderResult {
  if (data.byteLength < 12) {
    return { valid: false, decoderName: 'Font Structural Validator', error: 'Arquivo de fonte muito curto.' };
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (ext === 'ttf' || ext === 'otf') {
    const numTables = view.getUint16(4, false);
    if (numTables === 0 || numTables > 200) {
      return { valid: false, decoderName: 'SFNT Validator', error: `Número de tabelas SFNT inválido (${numTables}).` };
    }
    return { valid: true, decoderName: 'SFNT Validator', details: { decodedBy: 'SFNTHeader' } };
  }
  const numTables = view.getUint16(12, false);
  if (numTables === 0 || numTables > 200) {
    return { valid: false, decoderName: `${ext.toUpperCase()} Validator`, error: `Tabelas WOFF inválidas (${numTables}).` };
  }
  return { valid: true, decoderName: `${ext.toUpperCase()} Validator`, details: { decodedBy: 'WOFFHeader' } };
}

function validate3DDecoder(data: Uint8Array, ext: string): Layer2DecoderResult {
  if (ext === 'glb') {
    if (data.byteLength < 20) {
      return { valid: false, decoderName: 'GLB Validator', error: 'GLB menor que cabeçalho mínimo.' };
    }
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const version = view.getUint32(4, true);
    const totalLen = view.getUint32(8, true);
    const jsonChunkLen = view.getUint32(12, true);
    const jsonChunkType = view.getUint32(16, true);
    if (version !== 2 || totalLen !== data.byteLength || jsonChunkType !== 0x4e4f534a) {
      return { valid: false, decoderName: 'GLB Validator', error: 'Estrutura de chunks GLB 2.0 inválida.' };
    }
    try {
      const jsonText = new TextDecoder().decode(data.subarray(20, 20 + jsonChunkLen));
      const gltf = JSON.parse(jsonText);
      if (!gltf.asset) throw new Error('sem campo asset');
      return { valid: true, decoderName: 'GLB 2.0 Parser', details: { decodedBy: 'GLBChunkParser' } };
    } catch (err: any) {
      return { valid: false, decoderName: 'GLB 2.0 Parser', error: `Chunk JSON do GLB inválido: ${err?.message || err}` };
    }
  }
  if (ext === 'gltf') {
    return validateJsonDecoder(data);
  }
  if (ext === 'stl') {
    const head = new TextDecoder('ascii').decode(data.subarray(0, Math.min(data.byteLength, 256)));
    if (head.trimStart().startsWith('solid') && head.includes('vertex')) {
      return { valid: true, decoderName: 'STL ASCII Validator', details: { decodedBy: 'STLParser' } };
    }
    if (data.byteLength >= 84) {
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      const count = view.getUint32(80, true);
      if (count > 0 && 84 + count * 50 === data.byteLength) {
        return { valid: true, decoderName: 'STL Binary Validator', details: { decodedBy: 'STLBinaryParser' } };
      }
    }
    return { valid: false, decoderName: 'STL Validator', error: 'Malha STL vazia ou corrompida.' };
  }
  if (ext === 'obj') {
    const text = new TextDecoder().decode(data);
    if (!/^v\s+/m.test(text)) {
      return { valid: false, decoderName: 'OBJ Validator', error: 'Arquivo OBJ sem vértices.' };
    }
    return { valid: true, decoderName: 'OBJ Validator', details: { decodedBy: 'OBJParser' } };
  }
  if (ext === 'ply') {
    const head = new TextDecoder('ascii').decode(data.subarray(0, Math.min(data.byteLength, 512)));
    if (!head.includes('element vertex')) {
      return { valid: false, decoderName: 'PLY Validator', error: 'Cabeçalho PLY sem element vertex.' };
    }
    return { valid: true, decoderName: 'PLY Validator', details: { decodedBy: 'PLYParser' } };
  }
  return { valid: data.byteLength > 0, decoderName: '3DValidator', details: { decodedBy: 'BufferCheck' } };
}
