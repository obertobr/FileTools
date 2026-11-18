/**
 * src/modules/registry.ts
 *
 * Central registry for all conversion modules.
 * Manages engines, performance scoring, engine resolution, and dynamic conversion options.
 */
import type { IModule, ModuleManifest, AccelerationType } from '../shared/types/module';
import { FORMATS } from '../lib/formats';

import { RemuxModule } from './engines/remux';
import { MP4BoxModule } from './engines/mp4box';
import { MediabunnyModule } from './engines/mediabunny';
import { LameJSModule } from './engines/lamejs';
import { FFmpegMTModule } from './engines/ffmpeg-mt';
import { FFmpegModule } from './engines/ffmpeg';
import { MagickModule } from './engines/magick';
import { JSquashModule } from './engines/jsquash';
import { LibHeifModule } from './engines/libheif';
import { UtifModule } from './engines/utif';
import { ResvgModule } from './engines/resvg';
import { SvgoModule } from './engines/svgo';
import { FflateModule } from './engines/fflate';
import { ZipJSModule } from './engines/zip';
import { LibArchiveModule } from './engines/libarchive';
import { SevenZipModule } from './engines/7z';
import { PdfModule } from './engines/pdf';
import { PdfJSModule } from './engines/pdfjs';
import { MammothModule } from './engines/mammoth';
import { SheetJSModule } from './engines/sheetjs';
import { LibreOfficeModule } from './engines/libreoffice';
import { FoliateModule } from './engines/foliate';
import { FontEditorModule } from './engines/fonteditor';
import { WaWoff2Module } from './engines/wawoff2';
import { AssimpModule } from './engines/assimp';
import { OcctModule } from './engines/occt';
import { Lib3mfModule } from './engines/lib3mf';
import {
  AIBgRemoveModule,
  AIWhisperSttModule,
  AIDictionCoachModule,
  AITtsKokoroModule,
  AIUpscalerModule,
  AIOcrModule,
  AIAudioDenoiseModule,
  AIDepthMapModule,
} from './ai';

export const ModuleRegistry: Record<string, IModule> = {
  'stream-copy': RemuxModule,
  'mp4box': MP4BoxModule,
  'mediabunny': MediabunnyModule,
  'lamejs': LameJSModule,
  'ffmpeg-core-mt': FFmpegMTModule,
  'ffmpeg-core': FFmpegModule,
  'magick-wasm': MagickModule,
  'jsquash': JSquashModule,
  'libheif': LibHeifModule,
  'utif': UtifModule,
  'resvg': ResvgModule,
  'svgo': SvgoModule,
  'fflate': FflateModule,
  'zipjs': ZipJSModule,
  'libarchive': LibArchiveModule,
  '7z-wasm': SevenZipModule,
  'pdf-lib': PdfModule,
  'pdfjs': PdfJSModule,
  'mammoth': MammothModule,
  'sheetjs': SheetJSModule,
  'libreoffice': LibreOfficeModule,
  'foliate': FoliateModule,
  'fonteditor': FontEditorModule,
  'wawoff2': WaWoff2Module,
  'assimp': AssimpModule,
  'occt': OcctModule,
  'lib3mf': Lib3mfModule,
  'ai-bg-remove': AIBgRemoveModule,
  'ai-whisper-stt': AIWhisperSttModule,
  'ai-diction-coach': AIDictionCoachModule,
  'ai-tts-kokoro': AITtsKokoroModule,
  'ai-upscaler': AIUpscalerModule,
  'ai-ocr': AIOcrModule,
  'ai-audio-denoise': AIAudioDenoiseModule,
  'ai-depth-map': AIDepthMapModule,
};

export function getAllManifests(): ModuleManifest[] {
  return Object.values(ModuleRegistry).map((m) => m.manifest);
}

export function getModuleById(id: string): IModule | undefined {
  return ModuleRegistry[id];
}

/**
 * Infers an effective MIME type even if the browser reports empty string (common for MKV on Windows).
 */
export function getEffectiveMime(extWithDot: string, mime?: string): string {
  if (mime && mime.trim().length > 0 && mime !== 'application/octet-stream') {
    return mime.toLowerCase();
  }
  const cleanExt = extWithDot.replace('.', '').toUpperCase();
  const found = FORMATS.find(f => f.ext === cleanExt);
  if (found) {
    return `${found.category}/*`;
  }
  return '';
}

function matchesPattern(pattern: string, effectiveMime: string, normalizedExt: string): boolean {
  const p = pattern.toLowerCase();
  if (p.includes('*')) {
    const prefix = p.split('*')[0];
    return effectiveMime.startsWith(prefix);
  }
  return p === normalizedExt;
}

export interface PossibleConversion {
  moduleId: string;
  fromPattern: string;
  toExtensions: string[];
}

/**
 * Resolves which extensions a file can be converted to.
 */
export function resolvePossibleConversions(fileIdentifier: string, mimeType?: string): PossibleConversion[] {
  const results: PossibleConversion[] = [];
  
  let normalizedExt = fileIdentifier.toLowerCase();
  if (!normalizedExt.startsWith('.')) {
    normalizedExt = '.' + normalizedExt;
  }
  
  const effectiveMime = getEffectiveMime(normalizedExt, mimeType);

  for (const module of Object.values(ModuleRegistry)) {
    const manifest = module.manifest;
    if (manifest.category === 'ai') continue;
    
    for (const rule of manifest.supportedConversions) {
      const matchedPattern = rule.from.find(pattern => matchesPattern(pattern, effectiveMime, normalizedExt));

      if (matchedPattern) {
        results.push({
          moduleId: manifest.id,
          fromPattern: matchedPattern,
          toExtensions: rule.to,
        });
      }
    }
  }

  return results;
}

export interface EngineOption {
  moduleId: string;
  moduleName: string;
  version: string;
  speedScore: number; // 1 to 100
  acceleration: AccelerationType;
  performanceNotes: string;
  isRecommended: boolean;
}

/**
 * Resolves all available conversion engines for a specific (from -> to) pair.
 * Probes device and hardware capabilities via `module.isSupported()`
 * to ensure only truly compatible engines are presented to the user.
 */
export async function resolveAvailableEngines(
  sourceExt: string,
  targetFormat: string,
  mimeType?: string
): Promise<EngineOption[]> {
  let normalizedFrom = sourceExt.toLowerCase();
  if (!normalizedFrom.startsWith('.')) {
    normalizedFrom = '.' + normalizedFrom;
  }

  let normalizedTo = targetFormat.toLowerCase();
  if (!normalizedTo.startsWith('.')) {
    normalizedTo = '.' + normalizedTo;
  }

  const effectiveMime = getEffectiveMime(normalizedFrom, mimeType);
  const candidateEngines: EngineOption[] = [];

  for (const module of Object.values(ModuleRegistry)) {
    const manifest = module.manifest;
    if (manifest.category === 'ai') continue;

    for (const rule of manifest.supportedConversions) {
      // Check if rule supports target extension
      const supportsTarget = rule.to.some(ext => ext.toLowerCase() === normalizedTo);
      if (!supportsTarget) continue;

      // Check if rule supports source extension / inferred mime
      const matchesSource = rule.from.some(pattern => matchesPattern(pattern, effectiveMime, normalizedFrom));

      if (matchesSource) {
        // Probe hardware/browser support before including engine
        if (module.isSupported) {
          try {
            const isSupported = await module.isSupported({
              sourceExt: normalizedFrom,
              targetFormat: normalizedTo,
              mimeType: effectiveMime,
            });
            if (!isSupported) {
              continue;
            }
          } catch {
            continue;
          }
        }

        candidateEngines.push({
          moduleId: manifest.id,
          moduleName: manifest.name,
          version: manifest.version,
          speedScore: rule.speedScore ?? 50,
          acceleration: rule.acceleration ?? 'cpu-singlethread',
          performanceNotes: rule.performanceNotes ?? 'Processamento padrão',
          isRecommended: false,
        });
        break;
      }
    }
  }

  // Sort descending by speedScore (fastest first)
  candidateEngines.sort((a, b) => b.speedScore - a.speedScore);

  // Mark the top engine as recommended
  if (candidateEngines.length > 0) {
    candidateEngines[0].isRecommended = true;
  }

  return candidateEngines;
}
