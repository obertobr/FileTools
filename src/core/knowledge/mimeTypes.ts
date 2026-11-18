/**
 * src/core/knowledge/mimeTypes.ts
 *
 * Central Knowledge Base for MIME types.
 * Single source of truth across all modules, engines, and workers.
 */

export const MIME_TYPE_MAP: Record<string, string> = {
  // Video
  '.mp4': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.flv': 'video/x-flv',
  '.wmv': 'video/x-ms-wmv',
  '.3gp': 'video/3gpp',
  '.ts': 'video/mp2t',
  '.mts': 'video/mp2t',
  '.m2ts': 'video/mp2t',
  '.mpg': 'video/mpeg',
  '.mpeg': 'video/mpeg',
  '.vob': 'video/dvd',
  '.m4v': 'video/x-m4v',
  '.ogv': 'video/ogg',
  '.rm': 'application/vnd.rn-realmedia',
  '.asf': 'video/x-ms-asf',

  // Audio
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.opus': 'audio/opus',
  '.wma': 'audio/x-ms-wma',
  '.aiff': 'audio/aiff',
  '.aif': 'audio/aiff',
  '.ac3': 'audio/ac3',
  '.m4r': 'audio/x-m4r',
  '.pcm': 'audio/L16',

  // Image
  '.gif': 'image/gif',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.jxl': 'image/jxl',
  '.qoi': 'image/qoi',
  '.psd': 'image/vnd.adobe.photoshop',
  '.tga': 'image/x-tga',
  '.dng': 'image/x-adobe-dng',
  '.cr2': 'image/x-canon-cr2',
  '.nef': 'image/x-nikon-nef',
  '.pnm': 'image/x-portable-anymap',
  '.ppm': 'image/x-portable-pixmap',
  '.pgm': 'image/x-portable-graymap',
  '.pbm': 'image/x-portable-bitmap',
  '.jp2': 'image/jp2',

  // Documents & Subtitles
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.txt': 'text/plain',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.xhtml': 'application/xhtml+xml',
  '.md': 'text/markdown',
  '.rtf': 'application/rtf',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.odp': 'application/vnd.oasis.opendocument.presentation',
  '.odg': 'application/vnd.oasis.opendocument.graphics',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.srt': 'application/x-subrip',
  '.vtt': 'text/vtt',

  // Spreadsheets & Data
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
  '.xlsb': 'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
  '.xls': 'application/vnd.ms-excel',
  '.csv': 'text/csv',
  '.tsv': 'text/tab-separated-values',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.fods': 'application/vnd.oasis.opendocument.spreadsheet-flat-xml',
  '.dif': 'application/x-dif',
  '.sylk': 'text/sylk',
  '.dbf': 'application/x-dbf',
  '.json': 'application/json',

  // Ebooks
  '.epub': 'application/epub+zip',
  '.mobi': 'application/x-mobipocket-ebook',
  '.azw': 'application/vnd.amazon.ebook',
  '.azw3': 'application/vnd.amazon.mobi8-ebook',
  '.kf8': 'application/vnd.amazon.mobi8-ebook',
  '.fb2': 'application/x-fictionbook+xml',
  '.cbz': 'application/vnd.comicbook+zip',

  // Archives
  '.zip': 'application/zip',
  '.7z': 'application/x-7z-compressed',
  '.rar': 'application/vnd.rar',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  '.tgz': 'application/gzip',
  '.bz2': 'application/x-bzip2',
  '.tbz2': 'application/x-bzip2',
  '.xz': 'application/x-xz',
  '.txz': 'application/x-xz',
  '.deflate': 'application/zlib',
  '.iso': 'application/x-iso9660-image',
  '.dmg': 'application/x-apple-diskimage',
  '.cab': 'application/vnd.ms-cab-compressed',
  '.wim': 'application/x-ms-wim',
  '.cpio': 'application/x-cpio',
  '.ar': 'application/x-archive',
  '.lzh': 'application/x-lzh-compressed',
  '.z': 'application/x-compress',
  '.rpm': 'application/x-rpm',
  '.deb': 'application/vnd.debian.binary-package',

  // Fonts
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',

  // 3D / CAD
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.obj': 'model/obj',
  '.fbx': 'application/octet-stream',
  '.stl': 'model/stl',
  '.ply': 'application/x-ply',
  '.3ds': 'image/x-3ds',
  '.dae': 'model/vnd.collada+xml',
  '.dxf': 'image/vnd.dxf',
  '.3mf': 'model/3mf',
  '.x3d': 'model/x3d+xml',
  '.step': 'model/step',
  '.stp': 'model/step',
  '.iges': 'model/iges',
  '.igs': 'model/iges',
  '.brep': 'application/x-brep',
};

/**
 * Pure helper to resolve the canonical MIME type for a given file extension.
 */
export function getMimeType(ext: string): string {
  const normalized = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
  return MIME_TYPE_MAP[normalized] || 'application/octet-stream';
}
