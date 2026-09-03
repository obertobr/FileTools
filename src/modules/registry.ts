/**
 * src/modules/registry.ts
 *
 * Central registry for all conversion modules.
 * This file acts as the source of truth for supported conversions and is used
 * by the UI to dynamically generate conversion options and by the SSG to generate SEO routes.
 */

import type { IModule, ConversionRule, ModuleManifest } from '@/shared/types/module';

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
  fromPattern: string;
  toExtensions: string[];
}

/**
 * Given a file extension (e.g., '.mp4', 'MP4', 'mp4') or MIME type (e.g., 'video/mp4'),
 * resolves which modules and output formats are supported.
 * 
 * Normalizes the input to handle both uppercase formats from the UI (e.g. 'MP4')
 * and dotted extensions (e.g. '.mp4').
 */
export function resolvePossibleConversions(fileIdentifier: string, mimeType?: string): PossibleConversion[] {
  const results: PossibleConversion[] = [];
  
  // Normalize the extension: 'MP4' -> '.mp4', '.MP4' -> '.mp4', 'mp4' -> '.mp4'
  let normalizedExt = fileIdentifier.toLowerCase();
  if (!normalizedExt.startsWith('.')) {
    normalizedExt = '.' + normalizedExt;
  }
  
  const normalizedMime = mimeType?.toLowerCase() || '';

  for (const module of Object.values(ModuleRegistry)) {
    const manifest = module.manifest;
    
    for (const rule of manifest.supportedConversions) {
      const matchedPattern = rule.from.find(pattern => {
        const patternLower = pattern.toLowerCase();
        
        if (patternLower.includes('*')) {
          // Wildcard MIME match: 'video/*' matches 'video/mp4'
          const prefix = patternLower.split('*')[0];
          return normalizedMime.startsWith(prefix);
        }
        
        // Exact extension match: '.docx' matches '.docx'
        return patternLower === normalizedExt;
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
