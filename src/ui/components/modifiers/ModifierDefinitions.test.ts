import { describe, expect, it } from 'vitest';
import {
  createModifierContext,
  DEFAULT_CONVERSION_MODIFIERS,
  type ModifierCategoryId,
} from '@/shared/types/conversionModifiers';
import { MODIFIER_DEFINITIONS } from './ModifierDefinitions';
import { MODIFIER_LABELS, checkEngineCompatibility } from '@/modules/engineCapabilities';

function isApplicable(
  id: ModifierCategoryId,
  sourceExt: string,
  targetExt: string
): boolean {
  const def = MODIFIER_DEFINITIONS.find((d) => d.id === id);
  if (!def) throw new Error(`Missing ModifierDefinition for ${id}`);
  const ctx = createModifierContext(targetExt, sourceExt, DEFAULT_CONVERSION_MODIFIERS);
  return def.isApplicable(ctx);
}

function isPinned(
  id: ModifierCategoryId,
  sourceExt: string,
  targetExt: string
): boolean {
  const def = MODIFIER_DEFINITIONS.find((d) => d.id === id);
  if (!def) return false;
  const ctx = createModifierContext(targetExt, sourceExt, DEFAULT_CONVERSION_MODIFIERS);
  if (!def.isApplicable(ctx)) return false;
  return typeof def.pinned === 'function' ? def.pinned(ctx) : Boolean(def.pinned);
}

describe('ModifierDefinitions & Business Rules', () => {
  it('registers human-readable labels for all defined modifier categories', () => {
    for (const def of MODIFIER_DEFINITIONS) {
      expect(MODIFIER_LABELS[def.id]).toBeTruthy();
    }
  });

  it('applies quality to lossy images and PDF, but excludes lossless PNG', () => {
    expect(isApplicable('quality', 'png', 'jpg')).toBe(true);
    expect(isApplicable('quality', 'png', 'webp')).toBe(true);
    expect(isApplicable('quality', 'png', 'avif')).toBe(true);
    expect(isApplicable('quality', 'png', 'jxl')).toBe(true);
    expect(isApplicable('quality', 'docx', 'pdf')).toBe(true);
    expect(isApplicable('quality', 'jpg', 'png')).toBe(false);
  });

  it('enforces implicit background_color on PNG -> JPG and hides it on PNG -> WEBP', () => {
    const bgDef = MODIFIER_DEFINITIONS.find((d) => d.id === 'background_color')!;
    const ctxPngToJpg = createModifierContext('jpg', 'png', DEFAULT_CONVERSION_MODIFIERS);
    expect(bgDef.isApplicable(ctxPngToJpg)).toBe(true);
    expect(bgDef.implicitRule?.(ctxPngToJpg).isImplicit).toBe(true);

    const ctxPngToWebp = createModifierContext('webp', 'png', DEFAULT_CONVERSION_MODIFIERS);
    expect(bgDef.isApplicable(ctxPngToWebp)).toBe(false);
  });

  it('pins svg_optimize only for SVG -> SVG conversions', () => {
    expect(isApplicable('svg_optimize', 'svg', 'svg')).toBe(true);
    expect(isPinned('svg_optimize', 'svg', 'svg')).toBe(true);
    expect(isApplicable('svg_optimize', 'svg', 'png')).toBe(false);
  });

  it('pins cad_tessellation on parametric CAD sources targeting 3D meshes', () => {
    expect(isApplicable('cad_tessellation', 'step', 'glb')).toBe(true);
    expect(isPinned('cad_tessellation', 'step', 'glb')).toBe(true);
    expect(isApplicable('cad_tessellation', 'obj', 'glb')).toBe(false);
    expect(isApplicable('mesh_options', 'obj', 'stl')).toBe(true);
  });

  it('applies archive_password, font_subset, page_range (ebook), and csv_delimiter accurately', () => {
    expect(isApplicable('archive_password', 'png', 'zip')).toBe(true);
    expect(isApplicable('archive_password', 'rar', 'tar')).toBe(true);
    expect(isApplicable('archive_password', 'tar', 'gz')).toBe(false);

    expect(isApplicable('font_subset', 'ttf', 'woff2')).toBe(true);
    expect(isApplicable('font_subset', 'ttf', 'png')).toBe(false);

    expect(isApplicable('page_range', 'epub', 'txt')).toBe(true);
    expect(isApplicable('page_range', 'pdf', 'png')).toBe(true);

    expect(isApplicable('csv_delimiter', 'csv', 'xlsx')).toBe(true);
    expect(isApplicable('csv_delimiter', 'xlsx', 'csv')).toBe(true);
    expect(isApplicable('csv_delimiter', 'docx', 'pdf')).toBe(false);
  });

  it('declares mutual exclusion between audio_tracks and audio_merge and implicit merge on video->audio', () => {
    const tracksDef = MODIFIER_DEFINITIONS.find((d) => d.id === 'audio_tracks')!;
    const mergeDef = MODIFIER_DEFINITIONS.find((d) => d.id === 'audio_merge')!;

    expect(tracksDef.mutuallyExclusiveWith).toContain('audio_merge');
    expect(mergeDef.mutuallyExclusiveWith).toContain('audio_tracks');

    const ctxVideoToAudio = createModifierContext('mp3', 'mp4', DEFAULT_CONVERSION_MODIFIERS);
    expect(mergeDef.isApplicable(ctxVideoToAudio)).toBe(true);
    expect(mergeDef.implicitRule?.(ctxVideoToAudio).isImplicit).toBe(true);
  });

  it('identifies incompatible modifiers via IoC manifest checkEngineCompatibility', () => {
    const compOk = checkEngineCompatibility('jsquash', {
      ...DEFAULT_CONVERSION_MODIFIERS,
      activeCategories: ['quality', 'image_transform'],
    });
    expect(compOk.isIncompatible).toBe(false);

    const compBad = checkEngineCompatibility('jsquash', {
      ...DEFAULT_CONVERSION_MODIFIERS,
      activeCategories: ['video_codec'],
    });
    expect(compBad.isIncompatible).toBe(true);
    expect(compBad.incompatibleModifiers).toContain('video_codec');
  });
});
