/**
 * src/modules/registry.ts
 *
 * Central registry for all conversion modules.
 * Manages engines, performance scoring, engine resolution, and dynamic conversion options.
 */
import type { IModule, ModuleManifest, AccelerationType } from '@/shared/types/module';
import { FORMATS } from '../lib/formats';

import { RemuxModule } from './remux';
import { WebCodecsModule } from './webcodecs';
import { FFmpegMTModule } from './ffmpeg-mt';
import { FFmpegModule } from './ffmpeg';
import { MagickModule } from './magick';
import { PdfModule } from './pdf';
import { MammothModule } from './mammoth';
import { SheetJSModule } from './sheetjs';

export const ModuleRegistry: Record<string, IModule> = {
  'stream-copy': RemuxModule,
  'webcodecs-gpu': WebCodecsModule,
  'ffmpeg-core-mt': FFmpegMTModule,
  'ffmpeg-core': FFmpegModule,
  'magick-wasm': MagickModule,
  'pdf-lib': PdfModule,
  'mammoth': MammothModule,
  'sheetjs': SheetJSModule,
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
