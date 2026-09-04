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
  { ext: 'MP4', label: 'Universal video format (H.264/AAC)', category: 'video' },
  { ext: 'WEBM', label: 'Modern web video format (VP8/VP9)', category: 'video' },
  { ext: 'MKV', label: 'Matroska multimedia container', category: 'video' },
  { ext: 'AVI', label: 'Audio Video Interleave container', category: 'video' },
  { ext: 'MOV', label: 'Apple QuickTime container', category: 'video' },
  { ext: 'FLV', label: 'Adobe Flash Video container', category: 'video' },
  { ext: 'WMV', label: 'Windows Media Video format', category: 'video' },
  { ext: '3GP', label: '3GPP mobile multimedia container', category: 'video' },
  { ext: 'TS', label: 'MPEG-2 Transport Stream', category: 'video' },
  { ext: 'MPG', label: 'MPEG-1 / MPEG-2 Program Stream', category: 'video' },
  { ext: 'MPEG', label: 'MPEG video format', category: 'video' },
  { ext: 'VOB', label: 'DVD Video Object container', category: 'video' },
  { ext: 'M4V', label: 'Apple iTunes video container', category: 'video' },
  { ext: 'OGV', label: 'Ogg Theora video container', category: 'video' },
  { ext: 'GIF', label: 'Animated GIF image sequence', category: 'video' },

  // Audio
  { ext: 'MP3', label: 'MPEG Audio Layer III', category: 'audio' },
  { ext: 'WAV', label: 'Uncompressed PCM waveform audio', category: 'audio' },
  { ext: 'FLAC', label: 'Free Lossless Audio Codec', category: 'audio' },
  { ext: 'OGG', label: 'Ogg Vorbis audio container', category: 'audio' },
  { ext: 'M4A', label: 'MPEG-4 Audio container (AAC/ALAC)', category: 'audio' },
  { ext: 'AAC', label: 'Advanced Audio Coding stream', category: 'audio' },
  { ext: 'OPUS', label: 'Opus interactive low-latency audio', category: 'audio' },
  { ext: 'WMA', label: 'Windows Media Audio', category: 'audio' },
  { ext: 'AIFF', label: 'Audio Interchange File Format', category: 'audio' },
  { ext: 'AC3', label: 'Dolby Digital AC-3 stream', category: 'audio' },
  { ext: 'M4R', label: 'iPhone ringtone format (AAC)', category: 'audio' },

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
    // --- FFmpeg (Audio to Video with Black Screen) ---
  conv('MP3', 'MP4', 'video', 'Convert MP3 audio to MP4 video with black screen'),
  conv('WAV', 'MP4', 'video', 'Convert WAV audio to MP4 video with black screen'),
  conv('FLAC', 'MP4', 'video', 'Convert FLAC audio to MP4 video with black screen'),
  conv('M4A', 'MP4', 'video', 'Convert M4A audio to MP4 video with black screen'),
  conv('OGG', 'MP4', 'video', 'Convert OGG audio to MP4 video with black screen'),
  conv('AAC', 'MP4', 'video', 'Convert AAC audio to MP4 video with black screen'),
  conv('OPUS', 'MP4', 'video', 'Convert Opus audio to MP4 video with black screen'),
  conv('MP3', 'WEBM', 'video', 'Convert MP3 audio to WebM video with black screen'),
  conv('WAV', 'WEBM', 'video', 'Convert WAV audio to WebM video with black screen'),
  conv('MP3', 'MKV', 'video', 'Convert MP3 audio to MKV video with black screen'),

  // --- FFmpeg (Image to Video with Custom Duration) ---
  conv('PNG', 'MP4', 'video', 'Convert static PNG image to MP4 video'),
  conv('JPG', 'MP4', 'video', 'Convert static JPG image to MP4 video'),
  conv('JPEG', 'MP4', 'video', 'Convert static JPEG image to MP4 video'),
  conv('WEBP', 'MP4', 'video', 'Convert static WebP image to MP4 video'),
  conv('PNG', 'WEBM', 'video', 'Convert static PNG image to WebM video'),
  conv('JPG', 'WEBM', 'video', 'Convert static JPG image to WebM video'),
  conv('PNG', 'MKV', 'video', 'Convert static PNG image to MKV video'),
  conv('JPG', 'MKV', 'video', 'Convert static JPG image to MKV video'),

  // --- FFmpeg (Video Cross-Conversions) ---
  conv('MKV', 'MP4', 'video', 'Convert MKV container to MP4'),
  conv('MOV', 'MP4', 'video', 'Convert MOV video to MP4'),
  conv('AVI', 'MP4', 'video', 'Convert legacy AVI video to MP4'),
  conv('WEBM', 'MP4', 'video', 'Convert WebM video to MP4'),
  conv('FLV', 'MP4', 'video', 'Convert FLV video to MP4'),
  conv('WMV', 'MP4', 'video', 'Convert WMV video to MP4'),
  conv('3GP', 'MP4', 'video', 'Convert 3GP mobile video to MP4'),
  conv('TS', 'MP4', 'video', 'Convert MPEG-TS stream to MP4'),
  conv('MPG', 'MP4', 'video', 'Convert MPEG video to MP4'),
  conv('MPEG', 'MP4', 'video', 'Convert MPEG video to MP4'),
  conv('VOB', 'MP4', 'video', 'Convert DVD VOB video to MP4'),
  conv('M4V', 'MP4', 'video', 'Convert Apple M4V video to MP4'),
  conv('OGV', 'MP4', 'video', 'Convert OGV video to MP4'),

  conv('MP4', 'WEBM', 'video', 'Convert MP4 video to WebM'),
  conv('MKV', 'WEBM', 'video', 'Convert MKV video to WebM'),
  conv('MOV', 'WEBM', 'video', 'Convert MOV video to WebM'),
  conv('AVI', 'WEBM', 'video', 'Convert AVI video to WebM'),
  conv('FLV', 'WEBM', 'video', 'Convert FLV video to WebM'),
  conv('WMV', 'WEBM', 'video', 'Convert WMV video to WebM'),
  conv('TS', 'WEBM', 'video', 'Convert TS stream to WebM'),

  conv('MP4', 'MKV', 'video', 'Convert MP4 video to MKV'),
  conv('WEBM', 'MKV', 'video', 'Convert WebM video to MKV'),
  conv('MOV', 'MKV', 'video', 'Convert MOV video to MKV'),
  conv('AVI', 'MKV', 'video', 'Convert AVI video to MKV'),
  conv('FLV', 'MKV', 'video', 'Convert FLV video to MKV'),
  conv('WMV', 'MKV', 'video', 'Convert WMV video to MKV'),
  conv('TS', 'MKV', 'video', 'Convert TS stream to MKV'),

  conv('MP4', 'GIF', 'video', 'Convert MP4 video to animated GIF'),
  conv('MKV', 'GIF', 'video', 'Convert MKV video to animated GIF'),
  conv('WEBM', 'GIF', 'video', 'Convert WebM video to animated GIF'),
  conv('MOV', 'GIF', 'video', 'Convert MOV video to animated GIF'),
  conv('AVI', 'GIF', 'video', 'Convert AVI video to animated GIF'),
  conv('FLV', 'GIF', 'video', 'Convert FLV video to animated GIF'),
  conv('WMV', 'GIF', 'video', 'Convert WMV video to animated GIF'),

  conv('MP4', 'MOV', 'video', 'Convert MP4 video to MOV'),
  conv('MKV', 'MOV', 'video', 'Convert MKV video to MOV'),
  conv('WEBM', 'MOV', 'video', 'Convert WebM video to MOV'),
  conv('AVI', 'MOV', 'video', 'Convert AVI video to MOV'),

  conv('MP4', 'AVI', 'video', 'Convert MP4 video to AVI'),
  conv('MKV', 'AVI', 'video', 'Convert MKV video to AVI'),
  conv('MOV', 'AVI', 'video', 'Convert MOV video to AVI'),

  // --- FFmpeg (Video to Audio Extraction) ---
  conv('MP4', 'MP3', 'audio', 'Extract MP3 audio from MP4 video'),
  conv('MKV', 'MP3', 'audio', 'Extract MP3 audio from MKV video'),
  conv('WEBM', 'MP3', 'audio', 'Extract MP3 audio from WebM video'),
  conv('MOV', 'MP3', 'audio', 'Extract MP3 audio from MOV video'),
  conv('AVI', 'MP3', 'audio', 'Extract MP3 audio from AVI video'),
  conv('FLV', 'MP3', 'audio', 'Extract MP3 audio from FLV video'),
  conv('WMV', 'MP3', 'audio', 'Extract MP3 audio from WMV video'),
  conv('TS', 'MP3', 'audio', 'Extract MP3 audio from TS stream'),
  conv('3GP', 'MP3', 'audio', 'Extract MP3 audio from 3GP video'),

  conv('MP4', 'WAV', 'audio', 'Extract uncompressed WAV audio from MP4'),
  conv('MKV', 'WAV', 'audio', 'Extract uncompressed WAV audio from MKV'),
  conv('WEBM', 'WAV', 'audio', 'Extract uncompressed WAV audio from WebM'),
  conv('MOV', 'WAV', 'audio', 'Extract uncompressed WAV audio from MOV'),

  conv('MP4', 'M4A', 'audio', 'Extract M4A audio from MP4 video'),
  conv('MKV', 'M4A', 'audio', 'Extract M4A audio from MKV video'),
  conv('WEBM', 'OGG', 'audio', 'Extract OGG Vorbis audio from WebM'),
  conv('MP4', 'FLAC', 'audio', 'Extract lossless FLAC audio from MP4'),
  conv('MKV', 'FLAC', 'audio', 'Extract lossless FLAC audio from MKV'),
  conv('MP4', 'AAC', 'audio', 'Extract AAC audio stream from MP4'),
  conv('MKV', 'AAC', 'audio', 'Extract AAC audio stream from MKV'),
  conv('WEBM', 'OPUS', 'audio', 'Extract Opus audio stream from WebM'),

  // --- FFmpeg (Audio Cross-Conversions) ---
  conv('MP3', 'WAV', 'audio', 'Convert MP3 audio to WAV'),
  conv('WAV', 'MP3', 'audio', 'Convert WAV audio to MP3'),
  conv('FLAC', 'MP3', 'audio', 'Convert FLAC audio to MP3'),
  conv('M4A', 'MP3', 'audio', 'Convert M4A audio to MP3'),
  conv('OGG', 'MP3', 'audio', 'Convert OGG audio to MP3'),
  conv('AAC', 'MP3', 'audio', 'Convert AAC audio to MP3'),
  conv('OPUS', 'MP3', 'audio', 'Convert Opus audio to MP3'),
  conv('WMA', 'MP3', 'audio', 'Convert WMA audio to MP3'),
  conv('AIFF', 'MP3', 'audio', 'Convert AIFF audio to MP3'),
  conv('AC3', 'MP3', 'audio', 'Convert AC3 audio to MP3'),

  conv('MP3', 'FLAC', 'audio', 'Convert MP3 audio to FLAC'),
  conv('WAV', 'FLAC', 'audio', 'Convert WAV audio to lossless FLAC'),
  conv('OGG', 'FLAC', 'audio', 'Convert OGG audio to FLAC'),
  conv('M4A', 'FLAC', 'audio', 'Convert M4A audio to FLAC'),
  conv('AAC', 'FLAC', 'audio', 'Convert AAC audio to FLAC'),

  conv('MP3', 'OGG', 'audio', 'Convert MP3 audio to OGG Vorbis'),
  conv('WAV', 'OGG', 'audio', 'Convert WAV audio to OGG Vorbis'),
  conv('FLAC', 'OGG', 'audio', 'Convert FLAC audio to OGG Vorbis'),
  conv('M4A', 'OGG', 'audio', 'Convert M4A audio to OGG Vorbis'),

  conv('MP3', 'M4A', 'audio', 'Convert MP3 audio to M4A (AAC)'),
  conv('WAV', 'M4A', 'audio', 'Convert WAV audio to M4A (AAC)'),
  conv('FLAC', 'M4A', 'audio', 'Convert FLAC audio to M4A (AAC)'),
  conv('OGG', 'M4A', 'audio', 'Convert OGG audio to M4A (AAC)'),
  conv('M4A', 'WAV', 'audio', 'Convert M4A audio to WAV'),

  conv('MP3', 'AAC', 'audio', 'Convert MP3 audio to AAC'),
  conv('WAV', 'AAC', 'audio', 'Convert WAV audio to AAC'),
  conv('FLAC', 'AAC', 'audio', 'Convert FLAC audio to AAC'),

  conv('MP3', 'OPUS', 'audio', 'Convert MP3 audio to Opus'),
  conv('WAV', 'OPUS', 'audio', 'Convert WAV audio to Opus'),
  conv('OGG', 'OPUS', 'audio', 'Convert OGG audio to Opus'),

  conv('WAV', 'AIFF', 'audio', 'Convert WAV audio to AIFF'),
  conv('AIFF', 'WAV', 'audio', 'Convert AIFF audio to WAV'),
  conv('WAV', 'WMA', 'audio', 'Convert WAV audio to WMA'),
  conv('M4A', 'M4R', 'audio', 'Convert M4A audio to iPhone Ringtone (M4R)'),
  conv('MP3', 'M4R', 'audio', 'Convert MP3 audio to iPhone Ringtone (M4R)'),

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
  const e = ext.toLowerCase().replace(/^\./, '');
  if (['mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v', 'flv', 'wmv', '3gp', 'ts', 'mts', 'm2ts', 'mpg', 'mpeg', 'vob', 'ogv', 'rm', 'asf'].includes(e)) return 'video';
  if (['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'opus', 'wma', 'aiff', 'aif', 'ac3', 'm4r', 'caf', 'voc', 'wv'].includes(e)) return 'audio';
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
