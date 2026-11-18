export type { Converter } from './converters';

/**
 * FileTools — Format Definitions
 *
 * NOTE: This file defines the recognized formats and category detection.
 * Dynamic conversion pairs are derived automatically in src/lib/converters.ts
 * from ModuleManifest.supportedConversions in the registry.
 */

export type Category =
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'archive'
  | 'ebook'
  | 'font'
  | 'model3d'
  | 'other';

export const CATEGORIES: { id: Category | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'video', label: 'Video' },
  { id: 'audio', label: 'Audio' },
  { id: 'image', label: 'Image' },
  { id: 'document', label: 'Document' },
  { id: 'archive', label: 'Archive' },
  { id: 'ebook', label: 'Ebook' },
  { id: 'font', label: 'Font' },
  { id: 'model3d', label: '3D / CAD' },
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
  { ext: 'MTS', label: 'AVCHD / MPEG-2 Transport Stream', category: 'video' },
  { ext: 'M2TS', label: 'Blu-ray BDAV MPEG-2 Transport Stream', category: 'video' },
  { ext: 'MPG', label: 'MPEG-1 / MPEG-2 Program Stream', category: 'video' },
  { ext: 'MPEG', label: 'MPEG video format', category: 'video' },
  { ext: 'VOB', label: 'DVD Video Object container', category: 'video' },
  { ext: 'M4V', label: 'Apple iTunes video container', category: 'video' },
  { ext: 'OGV', label: 'Ogg Theora video container', category: 'video' },
  { ext: 'RM', label: 'RealMedia video container', category: 'video' },
  { ext: 'ASF', label: 'Advanced Systems Format container', category: 'video' },
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
  { ext: 'AIF', label: 'Audio Interchange File Format', category: 'audio' },
  { ext: 'AC3', label: 'Dolby Digital AC-3 stream', category: 'audio' },
  { ext: 'M4R', label: 'iPhone ringtone format (AAC)', category: 'audio' },

  // Image
  { ext: 'PNG', label: 'Portable Network Graphics (lossless)', category: 'image' },
  { ext: 'JPG', label: 'JPEG image (lossy)', category: 'image' },
  { ext: 'JPEG', label: 'JPEG image (lossy)', category: 'image' },
  { ext: 'WEBP', label: 'Modern web image (lossy/lossless)', category: 'image' },
  { ext: 'TIFF', label: 'Tagged Image File Format', category: 'image' },
  { ext: 'TIF', label: 'Tagged Image File Format', category: 'image' },
  { ext: 'HEIC', label: 'High Efficiency Image Container', category: 'image' },
  { ext: 'HEIF', label: 'High Efficiency Image Format', category: 'image' },
  { ext: 'AVIF', label: 'AV1 Image File Format', category: 'image' },
  { ext: 'JXL', label: 'JPEG XL next-generation image format', category: 'image' },
  { ext: 'QOI', label: 'Quite OK Image Format (lossless)', category: 'image' },
  { ext: 'SVG', label: 'Scalable Vector Graphics', category: 'image' },
  { ext: 'BMP', label: 'Bitmap Image File', category: 'image' },
  { ext: 'ICO', label: 'Windows Icon File', category: 'image' },
  { ext: 'PSD', label: 'Adobe Photoshop Document', category: 'image' },
  { ext: 'TGA', label: 'Truevision TARGA Raster Image', category: 'image' },
  { ext: 'DNG', label: 'Adobe Digital Negative RAW', category: 'image' },
  { ext: 'CR2', label: 'Canon RAW Version 2', category: 'image' },
  { ext: 'NEF', label: 'Nikon Electronic Format RAW', category: 'image' },
  { ext: 'PNM', label: 'Portable Anymap Image', category: 'image' },
  { ext: 'PPM', label: 'Portable Pixmap Image', category: 'image' },
  { ext: 'PGM', label: 'Portable Graymap Image', category: 'image' },
  { ext: 'PBM', label: 'Portable Bitmap Image', category: 'image' },
  { ext: 'JP2', label: 'JPEG 2000 Image', category: 'image' },

  // Document & Spreadsheet
  { ext: 'PDF', label: 'Portable Document Format', category: 'document' },
  { ext: 'DOCX', label: 'Microsoft Word OpenXML Document', category: 'document' },
  { ext: 'DOC', label: 'Microsoft Word 97-2003 Document', category: 'document' },
  { ext: 'ODT', label: 'OpenDocument Text Document', category: 'document' },
  { ext: 'RTF', label: 'Rich Text Format Document', category: 'document' },
  { ext: 'XLSX', label: 'Microsoft Excel OpenXML Spreadsheet', category: 'document' },
  { ext: 'XLSM', label: 'Microsoft Excel Macro-Enabled Spreadsheet', category: 'document' },
  { ext: 'XLSB', label: 'Microsoft Excel Binary Spreadsheet', category: 'document' },
  { ext: 'XLS', label: 'Microsoft Excel Binary Spreadsheet (97-2003)', category: 'document' },
  { ext: 'ODS', label: 'OpenDocument Spreadsheet', category: 'document' },
  { ext: 'FODS', label: 'Flat XML OpenDocument Spreadsheet', category: 'document' },
  { ext: 'CSV', label: 'Comma-Separated Values', category: 'document' },
  { ext: 'TSV', label: 'Tab-Separated Values', category: 'document' },
  { ext: 'DIF', label: 'Data Interchange Format Spreadsheet', category: 'document' },
  { ext: 'SYLK', label: 'Symbolic Link Spreadsheet', category: 'document' },
  { ext: 'DBF', label: 'dBase Database Table', category: 'document' },
  { ext: 'PPTX', label: 'Microsoft PowerPoint OpenXML Presentation', category: 'document' },
  { ext: 'PPT', label: 'Microsoft PowerPoint 97-2003 Presentation', category: 'document' },
  { ext: 'ODP', label: 'OpenDocument Presentation', category: 'document' },
  { ext: 'ODG', label: 'OpenDocument Drawing', category: 'document' },
  { ext: 'TXT', label: 'Plain Text', category: 'document' },
  { ext: 'HTML', label: 'HyperText Markup Language', category: 'document' },
  { ext: 'XHTML', label: 'Extensible HyperText Markup Language', category: 'document' },
  { ext: 'MD', label: 'Markdown Document', category: 'document' },
  { ext: 'SRT', label: 'SubRip Subtitle File', category: 'document' },
  { ext: 'VTT', label: 'WebVTT Subtitle File', category: 'document' },

  // Ebooks
  { ext: 'EPUB', label: 'Electronic Publication E-book', category: 'ebook' },
  { ext: 'MOBI', label: 'Mobipocket E-book Format', category: 'ebook' },
  { ext: 'AZW', label: 'Amazon Kindle E-book', category: 'ebook' },
  { ext: 'AZW3', label: 'Amazon Kindle Format 8 (KF8)', category: 'ebook' },
  { ext: 'KF8', label: 'Kindle Format 8 E-book', category: 'ebook' },
  { ext: 'FB2', label: 'FictionBook XML E-book', category: 'ebook' },
  { ext: 'CBZ', label: 'Comic Book ZIP Archive', category: 'ebook' },

  // Archives
  { ext: 'ZIP', label: 'ZIP Compressed Archive', category: 'archive' },
  { ext: '7Z', label: '7-Zip Compressed Archive', category: 'archive' },
  { ext: 'RAR', label: 'RAR Compressed Archive', category: 'archive' },
  { ext: 'TAR', label: 'Unix Tape Archive', category: 'archive' },
  { ext: 'GZ', label: 'GZIP Compressed File', category: 'archive' },
  { ext: 'TGZ', label: 'GZIP Compressed TAR Archive', category: 'archive' },
  { ext: 'BZ2', label: 'BZIP2 Compressed File', category: 'archive' },
  { ext: 'TBZ2', label: 'BZIP2 Compressed TAR Archive', category: 'archive' },
  { ext: 'XZ', label: 'XZ / LZMA2 Compressed File', category: 'archive' },
  { ext: 'TXZ', label: 'XZ Compressed TAR Archive', category: 'archive' },
  { ext: 'DEFLATE', label: 'Raw Deflate Compressed Stream', category: 'archive' },
  { ext: 'ISO', label: 'ISO 9660 Optical Disc Image', category: 'archive' },
  { ext: 'DMG', label: 'Apple Disk Image', category: 'archive' },
  { ext: 'CAB', label: 'Windows Cabinet Archive', category: 'archive' },
  { ext: 'WIM', label: 'Windows Imaging Format Archive', category: 'archive' },
  { ext: 'CPIO', label: 'CPIO Archive Format', category: 'archive' },
  { ext: 'AR', label: 'Unix Archive Format', category: 'archive' },
  { ext: 'LZH', label: 'LZH / LHA Compressed Archive', category: 'archive' },
  { ext: 'Z', label: 'Unix Compress Archive', category: 'archive' },
  { ext: 'RPM', label: 'Red Hat Package Manager Archive', category: 'archive' },
  { ext: 'DEB', label: 'Debian Software Package Archive', category: 'archive' },
  { ext: 'VHD', label: 'Virtual Hard Disk Image', category: 'archive' },
  { ext: 'VMDK', label: 'VMware Virtual Machine Disk', category: 'archive' },
  { ext: 'QCOW2', label: 'QEMU Copy-On-Write Disk Image', category: 'archive' },

  // Fonts
  { ext: 'TTF', label: 'TrueType Font', category: 'font' },
  { ext: 'OTF', label: 'OpenType Font', category: 'font' },
  { ext: 'WOFF', label: 'Web Open Font Format 1.0', category: 'font' },
  { ext: 'WOFF2', label: 'Web Open Font Format 2.0', category: 'font' },
  { ext: 'EOT', label: 'Embedded OpenType Font', category: 'font' },

  // 3D / CAD
  { ext: 'GLB', label: 'Binary glTF 2.0 3D Asset', category: 'model3d' },
  { ext: 'GLTF', label: 'GL Transmission Format 3D Scene', category: 'model3d' },
  { ext: 'OBJ', label: 'Wavefront OBJ 3D Geometry', category: 'model3d' },
  { ext: 'FBX', label: 'Autodesk FBX 3D Exchange', category: 'model3d' },
  { ext: 'STL', label: 'Stereolithography 3D Mesh', category: 'model3d' },
  { ext: 'PLY', label: 'Polygon File Format / Stanford Triangle', category: 'model3d' },
  { ext: '3DS', label: 'Autodesk 3D Studio Mesh', category: 'model3d' },
  { ext: 'DAE', label: 'COLLADA Digital Asset Exchange', category: 'model3d' },
  { ext: 'DXF', label: 'AutoCAD Drawing Exchange Format', category: 'model3d' },
  { ext: '3MF', label: '3D Manufacturing Format', category: 'model3d' },
  { ext: 'X3D', label: 'Extensible 3D Graphics XML', category: 'model3d' },
  { ext: 'STEP', label: 'ISO 10303 CAD B-Rep Model', category: 'model3d' },
  { ext: 'STP', label: 'ISO 10303 CAD B-Rep Model', category: 'model3d' },
  { ext: 'IGES', label: 'Initial Graphics Exchange Specification', category: 'model3d' },
  { ext: 'IGS', label: 'Initial Graphics Exchange Specification', category: 'model3d' },
  { ext: 'BREP', label: 'OpenCASCADE Boundary Representation', category: 'model3d' },

  // Other
  { ext: 'JSON', label: 'JavaScript Object Notation', category: 'other' },
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
  if (
    ['mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v', 'flv', 'wmv', '3gp', 'ts', 'mts', 'm2ts', 'mpg', 'mpeg', 'vob', 'ogv', 'rm', 'asf', 'gif'].includes(
      e
    )
  )
    return 'video';
  if (['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'opus', 'wma', 'aiff', 'aif', 'ac3', 'm4r', 'caf', 'voc', 'wv', 'pcm'].includes(e))
    return 'audio';
  if (
    ['png', 'jpg', 'jpeg', 'webp', 'svg', 'avif', 'bmp', 'tiff', 'tif', 'heic', 'heif', 'ico', 'jxl', 'qoi', 'psd', 'tga', 'dng', 'cr2', 'nef', 'arw', 'pnm', 'ppm', 'pgm', 'pbm', 'jp2'].includes(
      e
    )
  )
    return 'image';
  if (
    ['pdf', 'docx', 'doc', 'odt', 'txt', 'md', 'rtf', 'html', 'htm', 'xhtml', 'xlsx', 'xlsm', 'xlsb', 'xls', 'ods', 'fods', 'csv', 'tsv', 'dif', 'sylk', 'dbf', 'ppt', 'pptx', 'odp', 'odg', 'srt', 'vtt'].includes(
      e
    )
  )
    return 'document';
  if (['epub', 'mobi', 'azw', 'azw3', 'kf8', 'fb2', 'cbz'].includes(e)) return 'ebook';
  if (
    ['zip', 'tar', 'gz', 'tgz', 'bz2', 'tbz2', 'xz', 'txz', 'deflate', 'lzma', 'rar', '7z', 'iso', 'dmg', 'cab', 'wim', 'cpio', 'ar', 'lzh', 'z', 'rpm', 'deb', 'arj', 'vhd', 'vhdx', 'vdi', 'vmdk', 'qcow2'].includes(
      e
    )
  )
    return 'archive';
  if (['ttf', 'otf', 'woff', 'woff2', 'eot'].includes(e)) return 'font';
  if (['obj', 'fbx', 'stl', 'ply', '3ds', 'dae', 'gltf', 'glb', 'dxf', '3mf', 'x3d', 'blend', 'step', 'stp', 'iges', 'igs', 'brep'].includes(e))
    return 'model3d';
  return 'other';
}

export function describeFile(name: string): { ext: string; category: Category; kind: string } {
  const ext = name.includes('.') ? name.split('.').pop()!.toUpperCase() : 'FILE';
  const category = categoryOfExtension(ext);
  const noun =
    category === 'other' ? 'file' : category === 'document' ? 'document' : `${category}`;
  return { ext, category, kind: `${ext} ${noun}` };
}
