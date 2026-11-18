# FileTools — Roadmap & Checklist de Execução

Este checklist acompanha em tempo real a execução das Fases 1 a 6 do plano de evolução do FileTools.

---

## Passo 0: Setup Inicial
- [x] Criar `ROADMAP_CHECKLIST.md` e espelhar no artefato `task.md`
- [x] Verificar baseline de testes (`npm run test` e `npx tsc --noEmit`)

---

## Fase 1: Fundação Taxonômica, Formatos, MIME Types, Oráculo & Fixtures
- [x] **1.1 Categorias, Formatos e MIME Types**
  - [x] Expandir `Category`, `CATEGORIES`, `FORMATS` e `categoryOfExtension` em `src/lib/formats.ts`
  - [x] Expandir `ModuleManifest['category']` em `src/shared/types/module.ts`
  - [x] Atualizar `categoryIcons` em `src/ui/components/ConvertPanel.tsx`
  - [x] Adicionar MIME types canônicos em `src/core/knowledge/mimeTypes.ts`
- [x] **1.2 Oráculo de Testes (Camada 1 & Camada 2)**
  - [x] Expandir assinaturas binárias em `src/core/testing/oracle/magicBytes.ts`
  - [x] Expandir validadores estruturais em `src/core/testing/oracle/decoderValidator.ts`
  - [x] Expandir testes unitários em `src/core/testing/oracle/oracle.test.ts`
- [x] **1.3 Fixtures Reais**
  - [x] Estender `scripts/generate-fixtures.js` e gerar amostras reais em `tests/fixtures/`
- [x] **1.4 Validação da Fase 1**
  - [x] `npm run test` e `npx tsc --noEmit` 100% aprovados

---

## Fase 2: Implementação dos Módulos de Conversão Faltantes
- [x] **2.0 Instalação de dependências e setup WASM (`package.json` & `scripts/setup-wasm.js`)**
- [x] **2.1 Onda 1: Mídia, Imagens & Vetores**
  - [x] Expandir `src/modules/engines/mediabunny.ts` (`.mp3`, `.flac`, `.aac`, áudio↔áudio)
  - [x] Criar `src/modules/engines/lamejs.ts` (`lamejs`)
  - [x] Expandir `src/modules/engines/magick.ts` (`psd`, `tga`, `pnm`, `ppm`, `pgm`, `pbm`, `svg`)
  - [x] Criar `src/modules/engines/jsquash.ts` (`jsquash` — `avif`, `jpg`, `png`, `webp`, `jxl`, `qoi`)
  - [x] Criar `src/modules/engines/libheif.ts` (`libheif` — `heic`, `heif`, `avif`)
  - [x] Criar `src/modules/engines/utif.ts` (`utif` — `tiff`, `tif`, `dng`, `cr2`, `nef`)
  - [x] Criar `src/modules/engines/resvg.ts` (`resvg` — `svg` → `png`, `webp`, `jpg`)
  - [x] Criar `src/modules/engines/svgo.ts` (`svgo` — `svg` → `svg` otimizado)
- [x] **2.2 Onda 2: Compactadores e Arquivos (Archives)**
  - [x] Criar `src/modules/engines/fflate.ts` (`fflate` — `zip`, `gz`, `deflate`)
  - [x] Criar `src/modules/engines/zip.ts` (`zipjs` — ZIP64, AES-256, split)
  - [x] Criar `src/modules/engines/libarchive.ts` (`libarchive` — `tar`, `tar.gz`, `tar.bz2`, `tar.xz`, `rar`, `7z`, `iso`, `deb`, `rpm`, etc.)
  - [x] Criar `src/modules/engines/7z.ts` (`7z-wasm` — `7z`, `zip`, `rar`, `tar`, `wim`, `iso`, `dmg`, `vhd`, etc.)
- [x] **2.3 Onda 3: PDF, Documentos, Planilhas & Ebooks**
  - [x] Criar `src/modules/engines/pdfjs.ts` (`pdfjs` — renderização raster + extração texto/MD/JSON)
  - [x] Expandir `src/modules/engines/sheetjs.ts` (`xlsm`, `xlsb`, `dif`, `sylk`, `fods`, `dbf`)
  - [x] Criar `src/modules/engines/foliate.ts` (`foliate` — `epub`, `mobi`, `azw`, `azw3`, `kf8`, `fb2`, `cbz`)
- [x] **2.4 Onda 4: Fontes & 3D / CAD**
  - [x] Criar `src/modules/engines/fonteditor.ts` (`fonteditor` — `ttf`, `otf`, `woff`, `eot`, `svg`)
  - [x] Criar `src/modules/engines/wawoff2.ts` (`wawoff2` — `woff2` ↔ `ttf`)
  - [x] Criar `src/modules/engines/assimp.ts` (`assimp` — `obj`, `fbx`, `stl`, `ply`, `3ds`, `dae`, `gltf`, `glb`, `dxf`, `3mf`, `x3d`)
  - [x] Criar `src/modules/engines/occt.ts` (`occt` — `step`, `stp`, `iges`, `igs`, `brep`)
  - [x] Criar `src/modules/engines/lib3mf.ts` (`lib3mf` — `3mf` ↔ `stl`, `obj`, `glb`, `ply`)
- [x] **2.5 Registro & Validação da Fase 2**
  - [x] Registrar módulos em `src/modules/engines/index.ts`, `src/modules/registry.ts` e `src/core/engine/WorkerManager.ts`
  - [x] Adicionar testes em `src/modules/registry.test.ts` e rodar `npm run test` + `npx tsc --noEmit`
  - [x] Validar novos motores via runner dinâmico `scripts/test-conversion.ts`

---

## Fase 3: Matriz Universal de Modificadores & Rules Engine
- [x] **3.1 Knowledge Base Estática**
  - [x] Criar `src/core/knowledge/modifierPresets.ts`
- [x] **3.2 Tipagens & Rules Engine**
  - [x] Expandir `src/shared/types/conversionModifiers.ts` (novos `ModifierCategoryId`, campos e defaults)
  - [x] Expandir `src/ui/components/modifiers/ModifierDefinitions.ts` (novas regras + `quality` p/ imagens + `background_color` + sinergia)
- [x] **3.3 UI Dumb Cards & Consumo nos Motores**
  - [x] Criar novos cards Dumb UI em `src/ui/components/modifiers/` e integrar em `ConversionModifiersPanel.tsx`
  - [x] Declarar `supportedModifiers` nos manifestos e implementar suporte real nos motores
- [x] **3.4 DDmin & Auditoria Camada 3 + Testes**
  - [x] Atualizar `src/core/testing/deltaDebugger.ts` e `src/core/testing/oracle/modifierAuditor.ts`
  - [x] Criar `src/ui/components/modifiers/ModifierDefinitions.test.ts` e validar via `npm run test` + `npx tsc --noEmit`

---

## Fase 4: Conversões em Sequência (Multi-Stage Pipeline Router)
- [x] **4.1 Roteador de Grafo**
  - [x] Criar `src/core/routing/conversionRouter.ts` (Dijkstra/BFS com preferência por pontes lossless e maxHops=3)
- [x] **4.2 Executor Multi-Estágio OPFS**
  - [x] Criar `src/core/engine/PipelineExecutor.ts` com progresso segmentado e particionamento de modificadores
- [x] **4.3 Integração UI & Testes**
  - [x] Integrar rotas multi-estágio em `ConvertPanel.tsx` / `EngineSelector.tsx` / `ConversionProgress.tsx`
  - [x] Criar `src/core/routing/conversionRouter.test.ts` e validar `npm run test` + `npx tsc --noEmit`

---

## Fase 5: Nova Aba de IAs Locais (`/ai` — WebGPU + WASM)
- [x] **5.1 Runtime & Gerenciador de Modelos**
  - [x] Criar `src/core/ai/AIModelManager.ts` (WebGPU/WASM, cache persistente, progresso, limpeza)
- [x] **5.2 Módulos de IA (`src/modules/ai/`)**
  - [x] `ai-bg-remove.ts` (Removedor de Fundo `RMBG-1.4` / segmentação)
  - [x] `ai-whisper-stt.ts` (Speech-to-Text `Whisper` / `Moonshine` → `.srt/.vtt/.txt/.json`)
  - [x] `ai-diction-coach.ts` (Avaliador de Dicção, WPM, pausas, articulação e texto-alvo)
  - [x] `ai-tts-kokoro.ts` (Text-to-Speech `Kokoro-82M` / `Piper` → `.wav/.mp3`)
  - [x] `ai-upscaler.ts` (Super-Resolução 2x/4x com tiling)
  - [x] `ai-ocr.ts` (OCR de imagens e documentos → `.txt/.md/.json`)
  - [x] `ai-audio-denoise.ts` (Limpeza de ruído `RNNoise WASM`)
  - [x] `ai-depth-map.ts` (Mapa de profundidade `Depth-Anything-V2` + Bokeh)
- [x] **5.3 Interface `/ai` & Testes**
  - [x] Atualizar `src/ui/components/Navbar.tsx`
  - [x] Criar `src/pages/ai/index.astro` e `src/ui/views/LocalAIHub.tsx`
  - [x] Criar `src/core/ai/AIModelManager.test.ts` e validar com `npm run test` + `npx tsc --noEmit`

---

## Fase 6: Nova Aba de Edição Baseada em Nodes (`/nodes` — Pipeline Visual DAG)
- [x] **6.1 Motor de Execução DAG**
  - [x] Criar `src/core/graph/types.ts`, `GraphValidator.ts` e `GraphEngine.ts` (`.ftgraph`, OPFS zero-copy, batch, cache incremental, abort)
- [x] **6.2 Nodes Modulares de Composição & Lote (`src/modules/nodes/`)**
  - [x] `node-video-to-frames.ts` (Vídeo → `batch<image>` + `audio`)
  - [x] `node-frames-to-video.ts` (`batch<image>` + `audio` → Vídeo)
  - [x] `node-video-periodic-overlay.ts` (Overlay periódico modular, ex: a cada 5s por 1s)
  - [x] `node-burn-subtitles.ts` (Vídeo + legenda → Vídeo legendado)
  - [x] `node-batch-processor.ts` (Execução de módulos/IAs em lote sobre `batch<T>`)
- [x] **6.3 Interface Visual `/nodes` & Templates**
  - [x] Criar `src/pages/nodes/index.astro` e `src/ui/views/NodeEditorWorkspace.tsx` com `@xyflow/react`
  - [x] Adicionar templates prontos (Overlay Periódico, Vídeo→Frames→IA Fundo→Vídeo, Vídeo→Whisper→Legenda, Upscaler→WebP)
- [x] **6.4 Validação Final Global**
  - [x] Criar `src/core/graph/GraphEngine.test.ts` cobrindo ciclos, portas, `.ftgraph` e pipelines reais
  - [x] Executar `npx tsc --noEmit`, `npm run test` (10 arquivos / 99 testes), e `npm run build` (2890 páginas)
