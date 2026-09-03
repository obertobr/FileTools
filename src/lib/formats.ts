/**
 * FileTools — Format & Converter Definitions
 * Migrated from design-template and extended for the IModule registry.
 *
 * NOTE: This is the UI-layer representation of formats.
 * The authoritative source of truth for what is *actually* supported
 * at runtime comes from the module manifests in src/modules/registry.ts.
 * The CONVERTERS array here is used for SSG route generation and the
 * catalog UI — it should mirror the module manifests.
 */

export type Category = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other';

export const CATEGORIES: { id: Category | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'video', label: 'Video' },
  { id: 'audio', label: 'Audio' },
  { id: 'image', label: 'Image' },
  { id: 'document', label: 'Document' },
  { id: 'archive', label: 'Archive' },
  { id: 'other', label: 'Other' },
];

export type Format = {
  ext: string;
  label: string;
  category: Category;
};

export const FORMATS: Format[] = [
  // Video
  { ext: 'MP4', label: 'Universal video format', category: 'video' },
  { ext: 'WEBM', label: 'Web video format', category: 'video' },
  { ext: 'MKV', label: 'Multimedia container', category: 'video' },
  { ext: 'AVI', label: 'Legacy video format', category: 'video' },
  { ext: 'MOV', label: 'QuickTime container', category: 'video' },
  { ext: 'GIF', label: 'Animated image', category: 'video' },
  // Audio
  { ext: 'MP3', label: 'Compressed audio', category: 'audio' },
  { ext: 'WAV', label: 'Uncompressed audio', category: 'audio' },
  { ext: 'FLAC', label: 'Lossless audio', category: 'audio' },
  { ext: 'OGG', label: 'Open audio container', category: 'audio' },
  { ext: 'M4A', label: 'AAC audio container', category: 'audio' },
  // Image
  { ext: 'PNG', label: 'Lossless raster image', category: 'image' },
  { ext: 'JPG', label: 'Compressed raster image', category: 'image' },
  { ext: 'WEBP', label: 'Modern web image', category: 'image' },
  { ext: 'AVIF', label: 'Next-gen web image', category: 'image' },
  { ext: 'TIFF', label: 'High-quality raster', category: 'image' },
  { ext: 'HEIC', label: 'Apple image format', category: 'image' },
  // Document
  { ext: 'PDF', label: 'Portable document', category: 'document' },
  { ext: 'DOCX', label: 'Word document', category: 'document' },
  { ext: 'TXT', label: 'Plain text', category: 'document' },
  { ext: 'HTML', label: 'Web page markup', category: 'document' },
  { ext: 'XLSX', label: 'Excel spreadsheet', category: 'document' },
  { ext: 'ODS', label: 'OpenDocument spreadsheet', category: 'document' },
  // Other / Data
  { ext: 'JSON', label: 'Structured data', category: 'other' },
  { ext: 'CSV', label: 'Tabular data', category: 'other' },
];

export type Converter = {
  from: string;
  to: string;
  category: Category;
  /** Route slug: used in /converter/[from]-para-[to] */
  slug: string;
  description: string;
};

function conv(from: string, to: string, category: Category, description: string): Converter {
  return {
    from,
    to,
    category,
    // PT-BR slug convention per ARCHITECTURE.MD routing spec
    slug: `${from.toLowerCase()}-para-${to.toLowerCase()}`,
    description,
  };
}

/**
 * Master list of supported conversions.
 * Must stay in sync with module manifests in src/modules/registry.ts.
 * This list drives SSG route generation AND the catalog UI.
 */
export const CONVERTERS: Converter[] = [
  // --- FFmpeg.wasm (Video/Audio) ---
  conv('MOV', 'MP4', 'video', 'Convert MOV video to MP4'),
  conv('MKV', 'MP4', 'video', 'Convert MKV container to MP4'),
  conv('AVI', 'MP4', 'video', 'Convert legacy AVI video to MP4'),
  conv('MP4', 'WEBM', 'video', 'Convert MP4 video to WebM'),
  conv('MP4', 'MKV', 'video', 'Convert MP4 video to MKV'),
  conv('MP4', 'GIF', 'video', 'Convert MP4 video to animated GIF'),
  conv('MOV', 'WEBM', 'video', 'Convert MOV video to WebM'),
  conv('WEBM', 'MP4', 'video', 'Convert WebM video to MP4'),
  conv('MP3', 'WAV', 'audio', 'Convert MP3 audio to WAV'),
  conv('WAV', 'MP3', 'audio', 'Convert WAV audio to MP3'),
  conv('FLAC', 'MP3', 'audio', 'Convert FLAC audio to MP3'),
  conv('M4A', 'MP3', 'audio', 'Convert M4A audio to MP3'),
  conv('OGG', 'MP3', 'audio', 'Convert OGG audio to MP3'),
  conv('MP4', 'MP3', 'audio', 'Extract audio from MP4 video'),
  // --- Magick.wasm (Image) ---
  conv('PNG', 'JPG', 'image', 'Convert PNG image to JPG'),
  conv('JPG', 'PNG', 'image', 'Convert JPG image to PNG'),
  conv('WEBP', 'JPG', 'image', 'Convert WebP image to JPG'),
  conv('JPG', 'WEBP', 'image', 'Convert JPG image to WebP'),
  conv('PNG', 'WEBP', 'image', 'Convert PNG image to WebP'),
  conv('WEBP', 'PNG', 'image', 'Convert WebP image to PNG'),
  conv('TIFF', 'JPG', 'image', 'Convert TIFF image to JPG'),
  conv('JPG', 'TIFF', 'image', 'Convert JPG image to TIFF'),
  conv('HEIC', 'JPG', 'image', 'Convert HEIC photo to JPG'),
  conv('HEIC', 'PNG', 'image', 'Convert HEIC photo to PNG'),
  conv('AVIF', 'JPG', 'image', 'Convert AVIF image to JPG'),
  conv('JPG', 'AVIF', 'image', 'Convert JPG image to AVIF'),
  // --- pdf-lib (PDF) ---
  conv('JPG', 'PDF', 'document', 'Combine JPG images into a PDF'),
  conv('PNG', 'PDF', 'document', 'Combine PNG images into a PDF'),
  conv('PDF', 'JPG', 'document', 'Export PDF pages as JPG images'),
  conv('PDF', 'PNG', 'document', 'Export PDF pages as PNG images'),
  // --- mammoth.js (DOCX) ---
  conv('DOCX', 'TXT', 'document', 'Extract plain text from DOCX document'),
  conv('DOCX', 'HTML', 'document', 'Convert DOCX document to HTML'),
  // --- SheetJS (Spreadsheet) ---
  conv('XLSX', 'CSV', 'document', 'Convert Excel spreadsheet to CSV'),
  conv('XLSX', 'JSON', 'document', 'Convert Excel spreadsheet to JSON'),
  conv('ODS', 'CSV', 'document', 'Convert ODS spreadsheet to CSV'),
  conv('CSV', 'XLSX', 'document', 'Convert CSV data to Excel spreadsheet'),
  conv('CSV', 'JSON', 'other', 'Convert CSV rows to JSON'),
  conv('JSON', 'CSV', 'other', 'Flatten JSON data into CSV'),
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function findConverter(slug: string): Converter | undefined {
  return CONVERTERS.find((c) => c.slug === slug);
}

export function findConverterByFromTo(from: string, to: string): Converter | undefined {
  return CONVERTERS.find(
    (c) => c.from.toLowerCase() === from.toLowerCase() && c.to.toLowerCase() === to.toLowerCase(),
  );
}

/** Return all valid output formats for a given source extension */
export function getTargetsForSource(sourceExt: string): Converter[] {
  return CONVERTERS.filter((c) => c.from.toLowerCase() === sourceExt.toLowerCase());
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

export function categoryOfExtension(ext: string): Category {
  const e = ext.toLowerCase();
  if (['mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v'].includes(e)) return 'video';
  if (['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac'].includes(e)) return 'audio';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif', 'bmp', 'tiff', 'heic'].includes(e))
    return 'image';
  if (['pdf', 'docx', 'doc', 'txt', 'md', 'rtf', 'html', 'xlsx', 'ods'].includes(e))
    return 'document';
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(e)) return 'archive';
  return 'other';
}

export function describeFile(name: string): { ext: string; category: Category; kind: string } {
  const ext = name.includes('.') ? name.split('.').pop()!.toUpperCase() : 'FILE';
  const category = categoryOfExtension(ext);
  const noun =
    category === 'other' ? 'file' : category === 'document' ? 'document' : `${category}`;
  return { ext, category, kind: `${ext} ${noun}` };
}
