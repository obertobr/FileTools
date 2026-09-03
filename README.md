# FileTools

**Conversor de arquivos universal — 100% client-side, offline-first.**

> Converte vídeos, áudios, imagens, PDFs, documentos e planilhas — diretamente no navegador, sem upload, sem servidor.

## Stack

- **Framework:** [Astro](https://astro.build) (SSG)
- **UI:** React 19 + TypeScript (Astro Islands)
- **Estilo:** Tailwind CSS v4 (dark-only design system)
- **Processamento:** Web Workers + [Comlink](https://github.com/GoogleChromeLabs/comlink)
- **File System:** [OPFS](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system) (Origin Private File System)
- **PWA:** [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)

## Motores de Conversão

| Módulo | Formatos |
|--------|---------|
| `@ffmpeg/ffmpeg` | MP4, MKV, MOV, AVI, WEBM, GIF, MP3, WAV, FLAC, OGG, M4A |
| `@imagemagick/magick-wasm` | JPG, PNG, WEBP, TIFF, HEIC, AVIF |
| `pdf-lib` | PDF → JPG/PNG, JPG/PNG → PDF |
| `mammoth` | DOCX → TXT, DOCX → HTML |
| `xlsx` (SheetJS) | XLSX/ODS → CSV/JSON, CSV → XLSX |

## Desenvolvimento

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # Build estático SSG
npm run test     # Vitest (business logic)
```

## Requisitos do Navegador

- Suporta `SharedArrayBuffer` (necessário para FFmpeg.wasm)
- Os headers `Cross-Origin-Opener-Policy` e `Cross-Origin-Embedder-Policy` são configurados pelo Vite automaticamente

## Arquitetura

Ver [`docs/ARCHITECTURE.MD`](./docs/ARCHITECTURE.MD).
