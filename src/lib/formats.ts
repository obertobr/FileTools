export type { Converter } from './converters';

/**
 * FileTools — Format Definitions
 *
 * NOTE: This file defines the recognized formats and category detection.
 * Dynamic conversion pairs are derived automatically in src/lib/converters.ts
 * from ModuleManifest.supportedConversions in the registry.
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
  { ext: 'PNG', label: 'Portable Network Graphics (lossless)', category: 'image' },
  { ext: 'JPG', label: 'JPEG image (lossy)', category: 'image' },
  { ext: 'JPEG', label: 'JPEG image (lossy)', category: 'image' },
  { ext: 'WEBP', label: 'Modern web image (lossy/lossless)', category: 'image' },
  { ext: 'TIFF', label: 'Tagged Image File Format', category: 'image' },
  { ext: 'HEIC', label: 'High Efficiency Image Container', category: 'image' },
  { ext: 'AVIF', label: 'AV1 Image File Format', category: 'image' },
  { ext: 'SVG', label: 'Scalable Vector Graphics', category: 'image' },
  { ext: 'BMP', label: 'Bitmap Image File', category: 'image' },
  { ext: 'ICO', label: 'Windows Icon File', category: 'image' },

  // Document
  { ext: 'PDF', label: 'Portable Document Format', category: 'document' },
  { ext: 'DOCX', label: 'Microsoft Word OpenXML Document', category: 'document' },
  { ext: 'DOC', label: 'Microsoft Word 97-2003 Document', category: 'document' },
  { ext: 'ODT', label: 'OpenDocument Text Document', category: 'document' },
  { ext: 'RTF', label: 'Rich Text Format Document', category: 'document' },
  { ext: 'XLSX', label: 'Microsoft Excel OpenXML Spreadsheet', category: 'document' },
  { ext: 'XLS', label: 'Microsoft Excel Binary Spreadsheet (97-2003)', category: 'document' },
  { ext: 'ODS', label: 'OpenDocument Spreadsheet', category: 'document' },
  { ext: 'CSV', label: 'Comma-Separated Values', category: 'document' },
  { ext: 'PPTX', label: 'Microsoft PowerPoint OpenXML Presentation', category: 'document' },
  { ext: 'PPT', label: 'Microsoft PowerPoint 97-2003 Presentation', category: 'document' },
  { ext: 'ODP', label: 'OpenDocument Presentation', category: 'document' },
  { ext: 'ODG', label: 'OpenDocument Drawing', category: 'document' },
  { ext: 'EPUB', label: 'Electronic Publication E-book', category: 'document' },
  { ext: 'JSON', label: 'JavaScript Object Notation', category: 'other' },
  { ext: 'TXT', label: 'Plain Text', category: 'document' },
  { ext: 'HTML', label: 'HyperText Markup Language', category: 'document' },
  { ext: 'MD', label: 'Markdown Document', category: 'document' },
];

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
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif', 'bmp', 'tiff', 'heic', 'ico'].includes(e))
    return 'image';
  if (['pdf', 'docx', 'doc', 'txt', 'md', 'rtf', 'html', 'xlsx', 'xls', 'ods', 'csv', 'ppt', 'pptx', 'odp', 'odg', 'epub'].includes(e))
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
