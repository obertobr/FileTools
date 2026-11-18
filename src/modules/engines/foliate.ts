import { unzipSync } from 'fflate';
import JSZip from 'jszip';
import type { IModule, ExecutionContext } from '@/shared/types/module';
import { getMimeType } from '@/core/knowledge/mimeTypes';

interface EbookSection {
  title: string;
  html: string;
  text: string;
}

interface ParsedEbook {
  title: string;
  author: string;
  sections: EbookSection[];
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|section|br|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseEpubBytes(bytes: Uint8Array): ParsedEbook {
  const files = unzipSync(bytes);
  const dec = new TextDecoder('utf-8');
  const containerXml = files['META-INF/container.xml'] ? dec.decode(files['META-INF/container.xml']) : '';
  const opfMatch = containerXml.match(/full-path=["']([^"']+)["']/i);
  const opfPath = opfMatch?.[1] || Object.keys(files).find((k) => k.endsWith('.opf')) || '';
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const opfXml = opfPath && files[opfPath] ? dec.decode(files[opfPath]) : '';

  const title = opfXml.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i)?.[1]?.trim() || 'Ebook';
  const author = opfXml.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i)?.[1]?.trim() || 'Desconhecido';

  const manifestMap = new Map<string, string>();
  const itemRegex = /<item\b([^>]+)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(opfXml)) !== null) {
    const attrs = m[1];
    const id = attrs.match(/id=["']([^"']+)["']/i)?.[1];
    const href = attrs.match(/href=["']([^"']+)["']/i)?.[1];
    if (id && href) manifestMap.set(id, href);
  }

  const spineHrefs: string[] = [];
  const spineRegex = /<itemref\b[^>]*idref=["']([^"']+)["']/gi;
  while ((m = spineRegex.exec(opfXml)) !== null) {
    const href = manifestMap.get(m[1]);
    if (href) spineHrefs.push(opfDir + decodeURIComponent(href));
  }

  const chapterPaths =
    spineHrefs.length > 0
      ? spineHrefs
      : Object.keys(files)
          .filter((k) => /\.(xhtml|html|htm)$/i.test(k) && !k.endsWith('nav.xhtml'))
          .sort();

  const sections: EbookSection[] = [];
  for (let i = 0; i < chapterPaths.length; i++) {
    const raw = files[chapterPaths[i]];
    if (!raw) continue;
    const content = dec.decode(raw);
    const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const html = (bodyMatch ? bodyMatch[1] : content).trim();
    const secTitle = content.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i)?.[1] || `Seção ${i + 1}`;
    sections.push({
      title: stripTags(secTitle) || `Seção ${i + 1}`,
      html,
      text: stripTags(html),
    });
  }

  return { title: stripTags(title), author: stripTags(author), sections };
}

function parseFb2Bytes(bytes: Uint8Array): ParsedEbook {
  const xml = new TextDecoder('utf-8').decode(bytes);
  const title = xml.match(/<book-title[^>]*>([\s\S]*?)<\/book-title>/i)?.[1]?.trim() || 'FictionBook';
  const firstName = xml.match(/<first-name[^>]*>([\s\S]*?)<\/first-name>/i)?.[1]?.trim() || '';
  const lastName = xml.match(/<last-name[^>]*>([\s\S]*?)<\/last-name>/i)?.[1]?.trim() || '';
  const author = [firstName, lastName].filter(Boolean).join(' ') || 'Desconhecido';

  const sections: EbookSection[] = [];
  const secRegex = /<section[^>]*>([\s\S]*?)<\/section>/gi;
  let m: RegExpExecArray | null;
  let idx = 1;
  while ((m = secRegex.exec(xml)) !== null) {
    const raw = m[1];
    const secTitle = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || `Capítulo ${idx}`;
    const html = raw
      .replace(/<title[^>]*>([\s\S]*?)<\/title>/gi, '<h2>$1</h2>')
      .replace(/<emphasis>/gi, '<em>')
      .replace(/<\/emphasis>/gi, '</em>')
      .replace(/<strong>/gi, '<strong>')
      .replace(/<\/strong>/gi, '</strong>');
    sections.push({
      title: stripTags(secTitle) || `Capítulo ${idx}`,
      html,
      text: stripTags(html),
    });
    idx++;
  }

  if (sections.length === 0) {
    const body = xml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || xml;
    sections.push({ title, html: body, text: stripTags(body) });
  }

  return { title: stripTags(title), author, sections };
}

function decompressPalmDocLz77(src: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  while (i < src.length) {
    const b = src[i++];
    if (b === 0) {
      out.push(0);
    } else if (b <= 8) {
      for (let j = 0; j < b && i < src.length; j++) out.push(src[i++]);
    } else if (b <= 0x7f) {
      out.push(b);
    } else if (b <= 0xbf) {
      if (i >= src.length) break;
      const b2 = src[i++];
      const combined = (b << 8) | b2;
      const dist = (combined >> 3) & 0x07ff;
      const len = (combined & 0x07) + 3;
      const start = out.length - dist;
      for (let k = 0; k < len; k++) {
        out.push(start + k >= 0 && start + k < out.length ? out[start + k] : 0x20);
      }
    } else {
      out.push(0x20, b ^ 0x80);
    }
  }
  return new Uint8Array(out);
}

function parseMobiBytes(bytes: Uint8Array): ParsedEbook {
  if (bytes.byteLength < 80) throw new Error('[Foliate] Arquivo MOBI/AZW inválido ou muito curto.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const title = new TextDecoder('ascii').decode(bytes.subarray(0, 32)).replace(/\0.*$/, '').trim() || 'Kindle Ebook';
  const numRecords = view.getUint16(76, false);
  const offsets: number[] = [];
  for (let i = 0; i < numRecords; i++) {
    const pos = 78 + i * 8;
    if (pos + 4 <= bytes.byteLength) offsets.push(view.getUint32(pos, false));
  }
  offsets.push(bytes.byteLength);

  if (offsets.length < 3) {
    throw new Error('[Foliate] Cabeçalho PalmDB sem registros de texto.');
  }

  const rec0 = bytes.subarray(offsets[0], offsets[1]);
  const rec0View = new DataView(rec0.buffer, rec0.byteOffset, rec0.byteLength);
  const compression = rec0View.getUint16(0, false);
  const numTextRecords = rec0View.getUint16(8, false);
  const encryption = rec0View.getUint16(12, false);
  if (encryption !== 0) {
    throw new Error('[Foliate] Ebook protegido por DRM não pode ser convertido.');
  }

  const textChunks: Uint8Array[] = [];
  const limit = Math.min(numTextRecords, offsets.length - 2);
  for (let i = 1; i <= limit; i++) {
    const rec = bytes.subarray(offsets[i], offsets[i + 1]);
    if (compression === 2) {
      textChunks.push(decompressPalmDocLz77(rec));
    } else {
      textChunks.push(rec);
    }
  }

  const totalLen = textChunks.reduce((a, c) => a + c.byteLength, 0);
  const merged = new Uint8Array(totalLen);
  let p = 0;
  for (const ch of textChunks) {
    merged.set(ch, p);
    p += ch.byteLength;
  }

  const html = new TextDecoder('utf-8', { fatal: false }).decode(merged);
  return {
    title,
    author: 'Kindle Author',
    sections: [{ title, html, text: stripTags(html) }],
  };
}

function parseCbzBytes(bytes: Uint8Array): { ebook: ParsedEbook; images: Array<{ name: string; data: Uint8Array }> } {
  const files = unzipSync(bytes);
  const imageNames = Object.keys(files)
    .filter((k) => /\.(png|jpe?g|webp|gif)$/i.test(k) && !k.startsWith('__MACOSX'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const images = imageNames.map((name) => ({ name, data: files[name] }));
  const sections: EbookSection[] = images.map((img, i) => ({
    title: `Página ${i + 1}`,
    html: `<figure><img src="images/${img.name.split('/').pop()}" alt="Página ${i + 1}" /></figure>`,
    text: `[Página ${i + 1}: ${img.name}]`,
  }));

  return {
    ebook: { title: 'Comic Book Archive', author: 'CBZ', sections },
    images,
  };
}

async function buildEpubBytes(ebook: ParsedEbook, images: Array<{ name: string; data: Uint8Array }> = []): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="utf-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`
  );

  const manifestItems: string[] = [];
  const spineItems: string[] = [];

  ebook.sections.forEach((sec, idx) => {
    const fileName = `chapter_${idx + 1}.xhtml`;
    zip.file(
      `OEBPS/${fileName}`,
      `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${escapeXml(
        sec.title
      )}</title></head><body>${sec.html}</body></html>`
    );
    manifestItems.push(`<item id="chap_${idx + 1}" href="${fileName}" media-type="application/xhtml+xml"/>`);
    spineItems.push(`<itemref idref="chap_${idx + 1}"/>`);
  });

  images.forEach((img, idx) => {
    const cleanName = img.name.split('/').pop() || `img_${idx}.png`;
    const ext = cleanName.split('.').pop()?.toLowerCase() || 'png';
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
    zip.file(`OEBPS/images/${cleanName}`, img.data);
    manifestItems.push(`<item id="img_${idx}" href="images/${escapeXml(cleanName)}" media-type="${mime}"/>`);
  });

  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${escapeXml(
      ebook.title
    )}</dc:title><dc:creator>${escapeXml(ebook.author)}</dc:creator><dc:language>pt</dc:language></metadata><manifest>${manifestItems.join(
      ''
    )}</manifest><spine>${spineItems.join('')}</spine></package>`
  );

  return await zip.generateAsync({ type: 'uint8array' });
}

export const FoliateModule: IModule = {
  manifest: {
    id: 'foliate',
    name: 'Foliate.js (EPUB / MOBI / AZW3 / FB2 / CBZ)',
    version: '1.0.1',
    description: 'Leitor e conversor estrutural para e-books EPUB, Kindle (MOBI/AZW/AZW3/KF8), FB2 e CBZ.',
    category: 'ebook',
    supportedModifiers: [],
    supportedConversions: [
      {
        from: ['.epub', '.mobi', '.azw', '.azw3', '.kf8', '.fb2', '.cbz'],
        to: ['.html', '.txt', '.md', '.epub', '.json'],
        lossy: false,
        speedScore: 93,
        acceleration: 'cpu-singlethread',
        performanceNotes: 'Extração e reempacotamento estrutural direto de e-books client-side',
      },
    ],
    inputs: [{ id: 'file', name: 'Input File', type: 'file_handle', required: true }],
    outputs: [{ id: 'file', name: 'Output File', type: 'file_handle', required: true }],
  },

  isSupported: () => true,

  execute: async (inputs, context: ExecutionContext) => {
    const file = inputs.file as File | Blob | undefined;
    const fileData = inputs.fileData as Uint8Array | undefined;
    const originalName = inputs.originalName as string;
    const targetFormat = inputs.targetFormat as string;

    if ((!file && !fileData) || !originalName || !targetFormat) {
      throw new Error('Foliate module requires file/fileData, originalName, and targetFormat.');
    }

    const inputExt = ('.' + (originalName.split('.').pop() || 'epub')).toLowerCase();
    const targetExt = targetFormat.startsWith('.') ? targetFormat.toLowerCase() : '.' + targetFormat.toLowerCase();
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + targetExt;
    const mimeType = getMimeType(targetExt);

    context.onLog(`[Foliate] Analisando e-book ${originalName}...`);
    context.onProgress(25, 'Decodificando estrutura do e-book...');

    const bytes = fileData || new Uint8Array(await (file as File | Blob).arrayBuffer());
    let parsed: ParsedEbook;
    let images: Array<{ name: string; data: Uint8Array }> = [];

    if (inputExt === '.epub') {
      parsed = parseEpubBytes(bytes);
    } else if (inputExt === '.fb2') {
      parsed = parseFb2Bytes(bytes);
    } else if (inputExt === '.cbz') {
      const cbz = parseCbzBytes(bytes);
      parsed = cbz.ebook;
      images = cbz.images;
    } else if (['.mobi', '.azw', '.azw3', '.kf8'].includes(inputExt)) {
      parsed = parseMobiBytes(bytes);
    } else {
      throw new Error(`[Foliate] Formato de e-book não suportado: ${inputExt}`);
    }

    context.onProgress(70, `Exportando para ${targetExt.toUpperCase()}...`);
    let outputData: Uint8Array;

    if (targetExt === '.epub') {
      outputData = await buildEpubBytes(parsed, images);
    } else if (targetExt === '.html') {
      const body = parsed.sections.map((s) => `<section><h2>${escapeXml(s.title)}</h2>${s.html}</section>`).join('\n');
      const doc = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeXml(
        parsed.title
      )}</title></head><body><h1>${escapeXml(parsed.title)}</h1><p><em>${escapeXml(parsed.author)}</em></p>${body}</body></html>`;
      outputData = new TextEncoder().encode(doc);
    } else if (targetExt === '.md') {
      const md = `# ${parsed.title}\n\n*Autor: ${parsed.author}*\n\n` + parsed.sections.map((s) => `## ${s.title}\n\n${s.text}`).join('\n\n---\n\n');
      outputData = new TextEncoder().encode(md);
    } else if (targetExt === '.json') {
      outputData = new TextEncoder().encode(JSON.stringify(parsed, null, 2));
    } else {
      const txt = `${parsed.title} — ${parsed.author}\n\n` + parsed.sections.map((s) => `${s.title}\n\n${s.text}`).join('\n\n');
      outputData = new TextEncoder().encode(txt);
    }

    const outputBlob = new Blob([outputData.buffer as unknown as BlobPart], { type: mimeType });
    context.onProgress(100, 'Conversão de e-book concluída!');
    context.onLog(`[Foliate] Sucesso: ${outputFileName} (${outputData.byteLength} bytes)`);

    return {
      outputData,
      outputBlob,
      outputFileName,
      outputSize: outputData.byteLength,
      mimeType,
    };
  },
};
