/**
 * src/core/testing/oracle/modifierAuditor.ts
 *
 * Layer 3 of the Output Oracle:
 * Performs rigorous auditing on every requested modifier to ensure the engine
 * did not silently ignore or discard user settings (e.g. framerate, resolution,
 * page range, video duration, audio merge).
 */

import type {
  ConversionModifiers,
  ModifierCategoryId,
} from '@/shared/types/conversionModifiers';
import type {
  Layer3ModifierAuditResult,
  DecodedMediaDetails,
  ModifierAuditFailure,
} from '../types';
import { probeMediaData } from '@/core/media/mediaProbe';

export function auditModifiers(
  data: Uint8Array,
  targetExt: string,
  modifiers: ConversionModifiers | undefined,
  decodedDetails?: DecodedMediaDetails,
  outFileName?: string
): Layer3ModifierAuditResult {
  if (!modifiers) {
    return {
      valid: true,
      auditedModifiers: [],
      failures: [],
    };
  }

  const cleanExt = targetExt.toLowerCase().replace(/^\./, '');
  const active = modifiers.activeCategories || [];
  const failures: ModifierAuditFailure[] = [];
  const audited: ModifierCategoryId[] = [];

  // Probe media bytes to get container-level metadata
  let probe = probeMediaData(data);

  // 1. Audit Resolution & Scale
  if (
    active.includes('resolution') &&
    (cleanExt === 'gif' || ['mp4', 'webm', 'mkv', 'mov', 'avi', 'ts', '3gp', 'm4v'].includes(cleanExt))
  ) {
    audited.push('resolution');
    let expectedW = modifiers.targetWidth;
    if (!expectedW && modifiers.customScaleWidth) expectedW = modifiers.customScaleWidth;
    if (!expectedW && modifiers.resolutionScale && modifiers.resolutionScale !== 'original') {
      const scaleMap: Record<string, number> = {
        '1080p': 1920,
        '720p': 1280,
        '480p': 854,
        '360p': 640,
        '320p': 480,
        'cif': 352,
        'qcif': 176,
        'sub-qcif': 128,
      };
      expectedW = scaleMap[modifiers.resolutionScale.toLowerCase()];
    }

    if (expectedW && expectedW > 0) {
      const actualW = decodedDetails?.width || probe?.width;
      if (actualW !== undefined && Math.abs(actualW - expectedW) > 2) {
        failures.push({
          id: 'resolution',
          expected: expectedW,
          actual: actualW,
          reason: `A largura do vídeo gerado (${actualW}px) não corresponde à solicitada (${expectedW}px). O motor ignorou a escala ou manteve dimensões originais.`,
        });
      }
    }
  }

  // 2. Audit Framerate (FPS)
  if (
    active.includes('fps') &&
    (cleanExt === 'gif' || ['mp4', 'webm', 'mkv', 'mov', 'avi', 'ts', '3gp', 'm4v'].includes(cleanExt))
  ) {
    audited.push('fps');
    const expectedFps = modifiers.targetFps || (modifiers.isCustomFps ? modifiers.customFps : undefined);
    if (expectedFps && expectedFps > 0) {
      const actualFps = probe?.fps;
      if (actualFps !== undefined && Math.abs(actualFps - expectedFps) > 1.5) {
        failures.push({
          id: 'fps',
          expected: expectedFps,
          actual: actualFps,
          reason: `A taxa de quadros (${actualFps} fps) difere da solicitada (${expectedFps} fps).`,
        });
      }
    }
  }

  // 3. Audit Video Duration (Image -> Video)
  if (active.includes('video_duration') && modifiers.videoDurationSeconds && modifiers.videoDurationSeconds > 0) {
    audited.push('video_duration');
    const expectedDur = modifiers.videoDurationSeconds;
    const actualDur = decodedDetails?.duration;
    if (actualDur !== undefined && actualDur > 0) {
      // Tolerate up to 1 second variance due to container timestamp rounding / keyframes
      if (Math.abs(actualDur - expectedDur) > 1.2) {
        failures.push({
          id: 'video_duration',
          expected: expectedDur,
          actual: Math.round(actualDur * 10) / 10,
          reason: `Duração do vídeo gerado (${actualDur.toFixed(1)}s) não corresponde à duração solicitada (${expectedDur}s).`,
        });
      }
    }
  }

  // 4. Audit Page Range (Documents and PDFs)
  if (active.includes('page_range') && modifiers.pageRange) {
    audited.push('page_range');
    const range = String(modifiers.pageRange).trim();

    if (cleanExt === 'pdf' && decodedDetails?.pageCount !== undefined) {
      if (range === '1' && decodedDetails.pageCount !== 1) {
        failures.push({
          id: 'page_range',
          expected: '1 página',
          actual: `${decodedDetails.pageCount} páginas`,
          reason: `O PDF gerado possui ${decodedDetails.pageCount} páginas, mas foi solicitado apenas a primeira página (pageRange: '1').`,
        });
      }
    } else if (cleanExt === 'png') {
      // If converting multi-page document to PNG with pageRange: '1', the output must be a single PNG image (NOT a ZIP archive)
      const isZip = (outFileName || '').endsWith('.zip') || (data.byteLength >= 4 && data[0] === 0x50 && data[1] === 0x4b);
      if (range === '1' && isZip) {
        failures.push({
          id: 'page_range',
          expected: 'Arquivo de imagem .png puro (página 1)',
          actual: 'Arquivo compactado .zip com múltiplas páginas',
          reason: `O motor retornou um contêiner ZIP contendo todas as páginas em vez de extrair exclusivamente a página 1 solicitada.`,
        });
      }
    }
  }

  // 5. Audit PDF/A Compliance
  if (active.includes('pdf_compliance') && modifiers.pdfCompliance && cleanExt === 'pdf') {
    audited.push('pdf_compliance');
    // Inspect raw PDF bytes for PDF/A identification in XMP metadata or GTS flags
    const textSample = new TextDecoder('latin1').decode(data.subarray(0, Math.min(data.byteLength, 100_000)));
    const hasPdfa =
      textSample.includes('pdfaid:part') ||
      textSample.includes('GTS_PDFA') ||
      textSample.includes('PDF/A') ||
      textSample.includes('http://www.aiim.org/pdfa/ns/id/');

    if (!hasPdfa) {
      failures.push({
        id: 'pdf_compliance',
        expected: `Metadados de conformidade ${modifiers.pdfCompliance.toUpperCase()}`,
        actual: 'PDF padrão sem namespace PDF/A',
        reason: `O arquivo PDF não contém as marcas de conformidade arquivística ISO PDF/A solicitadas (${modifiers.pdfCompliance}).`,
      });
    }
  }

  // 6. Audit Audio Merge
  if (active.includes('audio_merge')) {
    audited.push('audio_merge');
    if (probe && probe.audioStreams.length > 1) {
      failures.push({
        id: 'audio_merge',
        expected: '1 faixa de áudio unificada (mixada via amix)',
        actual: `${probe.audioStreams.length} faixas de áudio discretas`,
        reason: 'O motor não mesclou as faixas de áudio; as faixas originais foram mantidas separadas.',
      });
    }
  }

  return {
    valid: failures.length === 0,
    auditedModifiers: audited,
    failures,
    error: failures.length > 0 ? failures.map((f) => `[${f.id}] ${f.reason}`).join(' | ') : undefined,
  };
}
