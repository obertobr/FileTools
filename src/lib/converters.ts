/**
 * src/lib/converters.ts
 *
 * Dynamic conversion generator for FileTools.
 * Derives all valid from->to converters dynamically from registered
 * ModuleManifest.supportedConversions and FORMATS.
 *
 * Single Source of Truth for:
 * 1. Astro SSG route paths (/converter/[from]-para-[to])
 * 2. Converter Catalog UI (/converter)
 * 3. Search and format lookup helpers
 */

import { FORMATS, categoryOfExtension, type Category } from './formats';
import { getAllManifests } from '@/modules/registry';
import type { ModuleManifest } from '@/shared/types/module';

export interface Converter {
  from: string;
  to: string;
  category: Category;
  slug: string;
  description: string;
}

/**
 * Dynamically generates all unique conversion pairs from registered module manifests.
 */
export function generateConverters(
  manifests: ModuleManifest[] = getAllManifests(),
  formats = FORMATS
): Converter[] {
  const convertersMap = new Map<string, Converter>();

  for (const manifest of manifests) {
    for (const rule of manifest.supportedConversions) {
      for (const fromType of rule.from) {
        let validFroms: string[] = [];

        if (fromType.includes('*')) {
          const category = fromType.split('/')[0].toLowerCase();
          validFroms = formats
            .filter((f) => f.category === category)
            .map((f) => f.ext.toUpperCase().replace('.', ''));
        } else {
          validFroms = [fromType.toUpperCase().replace('.', '')];
        }

        for (const from of validFroms) {
          for (const toExt of rule.to) {
            const to = toExt.toUpperCase().replace('.', '');
            if (from !== to) {
              const slug = `${from.toLowerCase()}-para-${to.toLowerCase()}`;
              if (!convertersMap.has(slug)) {
                const targetCategory = categoryOfExtension(to);
                convertersMap.set(slug, {
                  from,
                  to,
                  category: targetCategory,
                  slug,
                  description: `Converter ${from} para ${to}`,
                });
              }
            }
          }
        }
      }
    }
  }

  return Array.from(convertersMap.values());
}

export const CONVERTERS: Converter[] = generateConverters();

export function findConverter(slug: string): Converter | undefined {
  return CONVERTERS.find((c) => c.slug === slug);
}

export function findConverterByFromTo(from: string, to: string): Converter | undefined {
  return CONVERTERS.find(
    (c) => c.from.toLowerCase() === from.toLowerCase() && c.to.toLowerCase() === to.toLowerCase()
  );
}

export function getTargetsForSource(sourceExt: string): Converter[] {
  return CONVERTERS.filter((c) => c.from.toLowerCase() === sourceExt.toLowerCase());
}
