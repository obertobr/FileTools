/**
 * src/modules/registry.ts
 *
 * Central registry for all conversion modules.
 * This file acts as the source of truth for supported conversions and is used
 * by the UI to dynamically generate conversion options and by the SSG to generate SEO routes.
 */

import type { IModule, ConversionRule, ModuleManifest } from '@/shared/types/module';

// We will import the actual modules later. For now, we will dynamically or statically
// map the available engines.
import { FFmpegModule } from './ffmpeg';
import { MagickModule } from './magick';
import { PdfModule } from './pdf';
import { MammothModule } from './mammoth';
import { SheetJSModule } from './sheetjs';

export const ModuleRegistry: Record<string, IModule> = {
  'ffmpeg-core': FFmpegModule,
  'magick-wasm': MagickModule,
  'pdf-lib': PdfModule,
  'mammoth': MammothModule,
  'sheetjs': SheetJSModule,
};

/**
 * Returns a list of all manifests. Used primarily by the SSG route generator.
 */
export function getAllManifests(): ModuleManifest[] {
  return Object.values(ModuleRegistry).map((m) => m.manifest);
}

/**
 * Returns a specific module by its ID.
 */
export function getModuleById(id: string): IModule | undefined {
  return ModuleRegistry[id];
}

export interface PossibleConversion {
  moduleId: string;
  fromPattern: string; // The specific pattern that matched the file
  toExtensions: string[]; // Possible output extensions
}

/**
 * Given a file extension (e.g., '.mp4') or MIME type (e.g., 'video/mp4'),
 * resolves which modules and output formats are supported.
 * 
 * @param fileIdentifier Extension (e.g. '.mp4') or MIME type
 */
export function resolvePossibleConversions(fileIdentifier: string): PossibleConversion[] {
  const identifierLower = fileIdentifier.toLowerCase();
  const results: PossibleConversion[] = [];

  for (const module of Object.values(ModuleRegistry)) {
    const manifest = module.manifest;
    
    for (const rule of manifest.supportedConversions) {
      // Check if any of the 'from' rules match our file identifier
      const matchedPattern = rule.from.find(pattern => {
        if (pattern.includes('*')) {
          // Wildcard match, e.g., 'video/*' matches 'video/mp4'
          const prefix = pattern.split('*')[0];
          return identifierLower.startsWith(prefix);
        }
        return pattern === identifierLower;
      });

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
