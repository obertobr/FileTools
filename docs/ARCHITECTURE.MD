# Projeto: FileTools
**Visão Geral:** Um conversor de arquivos universal 100% client-side, rodando localmente no navegador (offline-first). O MVP foca em conversões diretas de mídia e documentos, com a arquitetura base (Módulos, Workers, OPFS) estritamente desenhada para suportar um sistema futuro de "Nodes/Grafo".

---

## 1. Stack Tecnológica
* **Framework Core:** Astro (Geração de Site Estático - SSG para roteamento e SEO).
* **UI/Interatividade:** React + TypeScript (Arquitetura de Ilhas do Astro).
* **Bundler & Estilos:** Vite + TailwindCSS v4 com Design Tokens unificados.
* **Isolamento de Threads:** Web Workers + `comlink` (Processamento pesado fora da main thread).
* **File System:** API OPFS (Origin Private File System) para manipulação de arquivos com alta performance e sem estouro de RAM.
* **PWA:** `vite-plugin-pwa` (Cache API e Service Worker offline-first).
* **Motores de Conversão (MVP):** `@ffmpeg/ffmpeg` (Wasm MT/ST), `@imagemagick/magick-wasm`, `mp4-muxer` (WebCodecs H.264), `webm-muxer` (WebCodecs VP9), `mp4box` (ISO-BMFF), `pdf-lib`, `mammoth`, `xlsx` (SheetJS).

---

## 2. Estrutura de Rotas (Astro)
A aplicação possui dupla natureza (PWA interativo e Catálogo SEO):
* `/` **(Root/App Shell):** Ponto de entrada do PWA (`start_url`). Interface interativa Drag & Drop pura. O usuário arrasta o arquivo, o sistema lê os manifestos e gera os seletores dinamicamente.
* `/converter`: Página catálogo (SEO). Exibe um grid/abas listando todas as categorias e conversões possíveis baseadas no registro de módulos.
* `/converter/[from]-para-[to]`: Dezenas de rotas estáticas geradas no build (SSG), compiladas dinamicamente cruzando os Manifestos dos módulos com as regras de conversão.

---

## 3. Arquitetura de Módulos (Core Abstraction)
Toda ferramenta de conversão é tratada como uma **caixa preta isolada** que implementa a interface `IModule`. Isso desacopla a interface gráfica e o orquestrador do motor de execução, preparando o terreno para encadeamento em nós e grafos.

* Os detalhes técnicos completos, ciclo de vida e tipos de portas estão isolados no protocolo específico em [`docs/protocols/module-contract.md`](./protocols/module-contract.md).
* O catálogo de módulos ativos fica centralizado em `src/modules/registry.ts`.

---

## 4. Protocolos do Sistema
A especificação técnica detalhada de cada camada de comunicação está segregada em documentos normativos na pasta `docs/protocols/`:

1. **[Contrato de Módulos (`module-contract.md`)](./protocols/module-contract.md):**  
   Define as interfaces `IModule`, `ModuleManifest`, `PortDefinition`, `ConversionRule` e o ciclo de vida de execução de um módulo.
2. **[Comunicação entre Nós (`node-communication.md`)](./protocols/node-communication.md):**  
   Especifica o tráfego de ponteiros OPFS com *Zero-Copy*, eventos de telemetria e coordenação entre nós da futura interface baseada em grafos.
3. **[Formato de Exportação de Grafos (`export-format.md`)](./protocols/export-format.md):**  
   Descreve a estrutura do arquivo portátil `.ftgraph` (JSON) para persistência, importação e exportação de pipelines de nós criadas pelo usuário.

---

## 5. Diretrizes de Interface e Design System (Fim de Estilos Hardcoded)
Para garantir consistência visual estrita, manutenibilidade e escalabilidade do projeto:

* **Estilos Inline Proibidos:** É terminantemente proibido o uso de `style={{ ... }}` ou classes utilitárias CSS arbitrárias e repetitivas sem padrão nos componentes de tela.
* **Centralização em Design Tokens:** A identidade visual (cores, espaçamentos, tipografia, bordas e raios) é declarada de forma centralizada nos tokens de TailwindCSS (`tailwind.config.ts` e `src/styles/global.css`).
* **Componentes Base Reutilizáveis (`src/ui/components/core/`):**  
  Todas as telas e componentes compostos **devem obrigatoriamente** reutilizar os blocos atômicos do Design System:
  - `Button.tsx`: Botões primários, secundários, outline, ghost, destrutivos e estados de loading.
  - `Card.tsx`: Containers com bordas finas, superfícies elevadas e variações semânticas.
  - `Typography.tsx`: Tipografia padronizada (h1, h2, h3, body, caption, mono).
  - `Badge.tsx`: Pílulas e tags indicadoras de formato, categoria e estado.
  - `Input.tsx`: Campos de busca e entrada de texto com `focus-ring` e bordas padronizadas.
* **Estética Visual:** Dark mode nativo com superfícies quase pretas (`oklch`), bordas finas (*hairline*), acento verde esmeralda contido e tipografia nítida (Inter + JetBrains Mono).

### 5.1. Dumb UI e Separação de Conhecimento de Domínio (Data-Driven Architecture)
Para impedir vazamentos de regras de negócio (*domain knowledge*) para dentro dos componentes visuais:

1. **Componentes React Estritamente Burros (Dumb UI):**
   - Componentes visuais (`.tsx`) em `src/ui/` **NUNCA** devem conter lógica condicional baseada em nomes de codecs, resoluções específicas ou extensões de formato (ex: proibido `if (codec === 'h263')`, `if (ext === 'gif')` ou `if (nativeWidth === 1920)`).
   - Componentes visuais não tomam decisões de compatibilidade, não filtram codecs por container internamente e não constroem presets ad-hoc na camada de renderização.

2. **Dicionários Estáticos na Base de Conhecimento (`src/core/knowledge/`):**
   - Todas as constantes de domínio, metadados visuais (rótulos, descrições), resoluções, taxas de quadros, codecs suportados e limites residem exclusivamente na pasta `src/core/knowledge/` (ex: `resolutionPresets.ts`, `fpsPresets.ts`, `codecConstraints.ts`, `videoCodecs.ts`, `audioCodecs.ts`, `colorPresets.ts`, `bitratePresets.ts`, `qualityPresets.ts`, `durationPresets.ts`).
   - Esses arquivos são contratos estáticos puros, desacoplados de qualquer camada de renderização ou estado de interface.

3. **Motor de Regras como Único Tomador de Decisão (`ModifierDefinitions.ts`):**
   - A inteligência sobre aplicabilidade, visibilidade, travamento e restrições de opções pertence **exclusivamente** ao catálogo do Rules Engine em `ModifierDefinitions.ts` através das funções:
     - `isApplicable(ctx)`: determina se o modificador pode existir para o fluxo de conversão atual.
     - `pinned(ctx)`: fixa cards obrigatórios ou essenciais para a conversão.
     - `implicitRule(ctx)`: impõe regras compulsórias (ex: mixagem obrigatória de áudio multifaixa para contêiner de áudio).
     - `deriveOptions(ctx)`: consulta a Base de Conhecimento e calcula as opções permitidas (`allowedOptions`) e eventuais alertas normativos (`warningMessage`).

4. **Contrato de Comunicação entre Motor e UI:**
   - A interface apenas recebe props puras e declarativas:
     - `options`: estado atual dos modificadores selecionados.
     - `onChange`: callback para emissão de atualizações parciais.
     - `allowedOptions`: lista pura de IDs permitidos (`(string | number)[]`) entregue por `deriveOptions`.
     - `warningMessage`: texto de alerta informativo derivado das regras de domínio.
   - O componente apenas mapeia os IDs de `allowedOptions` contra o dicionário estático correspondente da Knowledge Base para obter os textos e descrições, mantendo a renderização 100% orientada a dados (*data-driven*).

---

## 6. Orquestração e Memória (OPFS)
Arquivos processados não são mantidos inteiramente na memória RAM para evitar travamentos do navegador.
* **Estrutura:** `/opfs_root/sessions/{sessionId}/{taskId}/`
* **Zelador de Inicialização:** Ao inicializar a aplicação, o `OPFSManager` verifica a pasta `/sessions/` e elimina sessões antigas automaticamente.
* **Cão de Guarda:** Antes de executar qualquer tarefa, o sistema consulta `navigator.storage.estimate()` para garantir cota de armazenamento suficiente.
* **Limpeza Imediata:** Ao finalizar o download ou em caso de erro, a pasta `{taskId}` é deletada.

---

## 7. PWA, Lazy Loading e Cache
* **Lazy Loading Estrito:** Binários `.wasm` (ex: `ffmpeg-core.wasm`) só são baixados quando o usuário requisitar a conversão correspondente pela primeira vez.
* **Service Worker:** Armazena os binários na Cache API com estratégia *CacheFirst*. Rotas SSG são servidas sob demanda com *StaleWhileRevalidate*.

---

## 8. Diretrizes de Testes (Vitest)
A suíte de testes foca em regras de negócio críticas:
* **Testar:** Lógica de cruzamento de formatos no `registry.test.ts`, isolamento e limpeza do `OPFSManager.test.ts`, contratos de dados e rotas SSG.
* **Não testar:** Marcação cosmética, cores de CSS ou funcionamento interno de bibliotecas de terceiros.

---

## 9. Estrutura de Diretórios Atualizada

```text
/
├── docs/                            # Documentação arquitetural
│   ├── ARCHITECTURE.MD              # Visão geral e regras do sistema
│   ├── guides/                      # Guias práticos de desenvolvimento
│   │   ├── adding-a-module.md       # Como criar e registrar um novo módulo IModule
│   │   ├── adding-a-modifier.md      # Como adicionar modificador à Pilha de Modificadores
│   │   ├── adding-a-format.md       # Como registrar formato no catálogo e SSG
│   │   └── testing-strategy.md      # Estratégia e padrões obrigatórios de testes
│   └── protocols/                   # Especificações isoladas de protocolos
│       ├── module-contract.md       # Contrato da interface IModule
│       ├── node-communication.md    # Troca de dados entre nós via OPFS
│       └── export-format.md         # Esquema do arquivo de grafo .ftgraph
├── public/                          # Binários Wasm, ícones PWA
├── src/
│   ├── core/                        # Orquestração desacoplada de UI
│   │   ├── engine/                  # WorkerManager (Singleton orquestrador)
│   │   ├── fs/                      # OPFSManager (Zelador de sessões)
│   │   ├── hardware/                # Detecção de hardware e otimização de threads
│   │   │   └── threadOptimizer.ts   # Thread profiles dinâmicos por codec/CPU
│   │   ├── knowledge/               # Dicionários Estáticos de Domínio (Data-Driven)
│   │   │   ├── resolutionPresets.ts # Presets de resolução e matching nativo
│   │   │   ├── fpsPresets.ts        # Presets de taxa de quadros (FPS)
│   │   │   ├── codecConstraints.ts  # Restrições de contêineres e codecs
│   │   │   ├── videoCodecs.ts       # Presets e catálogo de codecs de vídeo
│   │   │   ├── audioCodecs.ts       # Presets, catálogo e normalizador de codecs de áudio
│   │   │   ├── colorPresets.ts      # Pixel formats, bit depth e color spaces
│   │   │   ├── bitratePresets.ts    # Presets de bitrate de vídeo e áudio
│   │   │   ├── qualityPresets.ts    # Presets de qualidade CRF
│   │   │   └── durationPresets.ts   # Presets de duração para imagem->vídeo
│   │   ├── media/                   # Probing de containers de mídia
│   │   │   └── mediaProbe.ts        # Parser zero-dep para MKV/MP4 (EBML/ISO-BMFF)
│   │   └── workers/                 # Web Workers com Comlink
│   ├── modules/                     # Infraestrutura e Registro de Motores
│   │   ├── registry.ts              # Registro central de módulos
│   │   ├── registry.test.ts         # Testes de resolução do registry
│   │   ├── engineCapabilities.ts    # Validador de capacidades
│   │   └── engines/                 # Motores de conversão (IModule) isolados
│   │       ├── ffmpeg-mt.ts         # Motor FFmpeg Multi-Thread (pthreads)
│   │       ├── ffmpeg.ts            # Motor FFmpeg Single-Thread
│   │       ├── remux.ts             # Motor Stream Copy (Remux instantâneo)
│   │       ├── mp4-muxer.ts         # Motor MP4 Muxer (WebCodecs H.264 GPU)
│   │       ├── webm-muxer.ts        # Motor WebM Muxer (WebCodecs VP9 GPU)
│   │       ├── mp4box.ts            # Motor MP4Box (ISO-BMFF, extração direta)
│   │       ├── magick.ts            # Motor ImageMagick WASM
│   │       ├── pdf.ts               # Motor pdf-lib
│   │       ├── mammoth.ts           # Motor mammoth.js (DOCX)
│   │       ├── sheetjs.ts           # Motor SheetJS (planilhas)
│   │       └── index.ts             # Exportação unificada dos motores
│   ├── shared/                      # Tipagens e utilitários agnósticos
│   │   ├── types/
│   │   │   ├── module.ts            # Contratos TypeScript de IModule
│   │   │   └── conversionModifiers.ts # Tipos da Pilha de Modificadores (Modifier Stack)
│   │   └── utils/                   # Utilitários compartilhados
│   ├── styles/                      # Design System & Tailwind Tokens
│   │   └── global.css               # Tokens inline e base styles
│   ├── ui/
│   │   ├── components/              # Componentes de interface
│   │   │   ├── core/                # Design System Base (Button, Card, Typography, etc.)
│   │   │   ├── modifiers/             # Cards modulares do Pilha de Modificadores (Modifier Stack)
│   │   │   │   ├── ModifierDefinitions.ts  # Catálogo do Motor de Regras (Rules Engine)
│   │   │   │   ├── AddModifierPicker.tsx   # Modal de busca/adição de categorias
│   │   │   │   ├── AudioTracksCard.tsx     # Card: seleção de faixas de áudio
│   │   │   │   ├── AudioMergeCard.tsx      # Card: mixagem/unificação de faixas de áudio
│   │   │   │   ├── SubtitlesCard.tsx       # Card: seleção de legendas
│   │   │   │   ├── FpsCard.tsx             # Card: taxa de quadros
│   │   │   │   ├── ResolutionCard.tsx      # Card: resolução/escala
│   │   │   │   ├── VideoCodecCard.tsx      # Card: seleção de codec de vídeo
│   │   │   │   ├── AudioCodecCard.tsx      # Card: seleção de codec de áudio
│   │   │   │   ├── QualityCard.tsx         # Card: qualidade visual e CRF
│   │   │   │   ├── PixelFormatCard.tsx     # Card: formato de pixel
│   │   │   │   ├── BitDepthCard.tsx        # Card: profundidade de bits de cor
│   │   │   │   ├── BitrateCard.tsx         # Card: taxa de bits
│   │   │   │   ├── ColorSpaceCard.tsx      # Card: espaço de cor
│   │   │   │   └── DurationCard.tsx        # Card: duração imagem->vídeo
│   │   │   └── ...                  # Componentes de negócio (ConvertPanel, etc.)
│   │   └── layouts/                 # Layouts Astro e App Shell
│   └── pages/                       # Roteamento Astro SSG
├── e2e/                             # Testes End-to-End (Playwright)
│   ├── modules/                     # Testes de conversão por módulo
│   └── test-new-modifiers-ui.spec.ts # Testes do Pilha de Modificadores (Modifier Stack) UI
└── tests/                           # Fixtures e helpers de teste
    └── fixtures/                    # Arquivos reais para testes
```

---

## 10. Guias de Desenvolvimento

Para manter a **padronização** e **escalabilidade** do sistema, consulte os guias normativos antes de qualquer implementação:

| Guia | Quando Consultar |
|---|---|
| [`guides/adding-a-module.md`](./guides/adding-a-module.md) | Ao criar um novo motor de conversão (implementar `IModule`) |
| [`guides/adding-a-modifier.md`](./guides/adding-a-modifier.md) | Ao adicionar uma opção ao Pilha de Modificadores (Modifier Stack) (nova categoria) |
| [`guides/adding-a-format.md`](./guides/adding-a-format.md) | Ao registrar um formato novo no catálogo ou SSG |
| [`guides/testing-strategy.md`](./guides/testing-strategy.md) | Ao escrever testes ou verificar pipeline de validação |

Estes documentos são a **fonte de verdade** para implementação. Desvios dos padrões documentados são proibidos sem aprovação explícita.

---

## 11. Princípio da Matriz Universal de Modificadores de Conversão

O sistema de opções avançadas (Pilha de Modificadores (Modifier Stack)) obedece estritamente à regra de **Capacidades Semânticas de Mídia**:

1. **Classificação por Categorias de Mídia:**
   - Em vez de listas manuais e frágeis de extensões (ex: `['mp4', 'mkv']`), as opções são resolvidas cruzando `categoryOfExtension(sourceExt)` com `categoryOfExtension(target)`.
   - Formatos de vídeo (`video`) sempre oferecem **Resolução**, **FPS**, **Qualidade** e **Codec de Vídeo** (incluindo contêineres legados e de broadcast como `mpeg`, `mpg`, `vob`, `ts`, `wmv`, `flv`, etc.).
   - Conversões de vídeo para áudio ou vídeo para vídeo oferecem **Juntar Faixas de Áudio** (`audio_merge`) para mixagem em fluxo único via filtro `amix`.
   - Conversões de imagem para vídeo oferecem **Duração do Vídeo** (`video_duration`), sendo proibida a exibição desta opção em conversões de foto para foto (imagem para imagem).
2. **Higienização e Exclusividade Mútua:**
   - O orquestrador `ConversionModifiersPanel` higieniza e poda automaticamente qualquer categoria que não pertença à conversão ativa (*auto-pruning*).
   - `audio_merge` (mixagem de faixas) e `audio_tracks` (manter trilhas separadas no contêiner) operam em regime de exclusão mútua na interface.

## 12. Compatibilidade de Motores e Inicialização com Metadados Nativos

### 12.1. Matriz de Compatibilidade Motor x Capacidade

| Modificador | Remux (`remux`) | FFmpeg Multi-Thread (`ffmpeg-core-mt`) | FFmpeg Single-Thread (`ffmpeg-core`) |
|---|:---:|:---:|:---:|
| **Cópia Instantânea (`-c copy`)** | Sim | Sim | Sim |
| **Taxa de Quadros (`-r fps`)** | ❌ Incompatível | ✅ Total | ✅ Total |
| **Escala / Resolução (`-vf scale`)** | ❌ Incompatível | ✅ Total | ✅ Total |
| **Qualidade / CRF** | ❌ Incompatível | ✅ Total | ✅ Total |
| **Taxa de Bits / Bitrate (`-b:v`, `-b:a`)** | ❌ Incompatível | ✅ Total | ✅ Total |
| **Formato de Pixel (`-pix_fmt`)** | ❌ Incompatível | ✅ Total | ✅ Total |
| **Profundidade de Cor (8/10/12-bit)** | ❌ Incompatível | ✅ Total | ✅ Total |
| **Espaço de Cor (`-colorspace`)** | ❌ Incompatível | ✅ Total | ✅ Total |
| **Transcodificação de Codec** | ❌ Incompatível | ✅ Total | ✅ Total |
| **Unir Faixas (`amix` filter)** | ❌ Incompatível | ✅ Total | ✅ Total |
| **Seleção de Faixas de Áudio** | ✅ Suportado | ✅ Total | ✅ Total |
| **Subtítulos Embutidos** | ✅ Suportado | ✅ Total | ✅ Total |
| **Duração Imagem -> Vídeo** | ❌ Incompatível | ✅ Total | ✅ Total |
| **Controle de Threads (`-threads`)** | ❌ Incompatível | ✅ Total (Multi-Core) | ❌ Incompatível (WASM 1 thread) |


### 12.2. Inversão de Controle no ModuleManifest (`supportedModifiers`)
1. **Responsabilidade Descentralizada:** Cada motor declara exclusivamente em seu próprio manifesto (`ModuleManifest.supportedModifiers`) a lista de modificadores que suporta executar.
2. **Orquestrador Puro:** O módulo `src/modules/engineCapabilities.ts` não possui nenhum `if/else` com nomes de motores hardcoded. A verificação é uma consulta pura de inclusão no array de capacidades do motor.
3. **UX Guard Integrado:** Se o usuário acionar um modificador não suportado pelo motor ativo (ex: alterar FPS enquanto o motor selecionado é o Remux direto), a UI exibe o aviso em vermelho e desabilita a conversão, prevenindo execuções silenciosas incorretas.

### 12.3. Contrato de Proteção ao Usuário (UX Guard)
1. **Detecção de Conflito**: O módulo `src/modules/engineCapabilities.ts` avalia em tempo real (`checkEngineCompatibility`) as opções ativas contra as capacidades do motor selecionado.
2. **Prevenção de Execução Silenciosa Falha**: Caso o motor atual não suporte aplicar as alterações solicitadas, a conversão é bloqueada na UI com indicação clara do motivo e botão de alternância imediata para o motor transcodificador compatível.
3. **Extração e Fidelidade de Metadados**: O probe binário nativo (`src/core/media/mediaProbe.ts`) garante que framerate e dimensões sejam populados a partir do arquivo real do usuário, eliminando defaults arbitrários.

### 12.4. Princípio de Sintonia e Preservação de Opções
1. **Preservar em Vez de Remover ou Sobrescrever**: O FileTools prioriza rigorosamente expandir e preservar o maior número possível de opções para o usuário. Nunca se deve remover opções da interface ou alterar escolhas do usuário de forma silenciosa ("por baixo dos panos") dentro dos motores de conversão.
2. **Sintonia Mútua (Synergy) entre Modificadores**: Quando dois ou mais modificadores possuem restrições técnicas cruzadas (exemplo: o codec de vídeo H.263 em contêiner 3GP que aceita estritamente resoluções padronizadas CIF, QCIF e sub-QCIF):
   - Os modificadores devem operar em sintonia dinâmica: se o usuário seleciona o codec H.263, o modificador de resolução apresenta e restringe as opções estritamente àquelas suportadas pelo codec selecionado, acompanhado de orientação informativa clara na UI (orientando que codecs modernos como MPEG-4 liberam resoluções 720p/1080p).
   - O motor de conversão honra com precisão a escolha explícita do usuário (se o usuário escolheu H.263, executa com H.263; se escolheu MPEG-4, executa com MPEG-4).
3. **Resiliência a Cargas Arbitrárias**: O sistema deve se auto-adaptar a qualquer complexidade de arquivo de entrada (desde amostras ultra-leves até vídeos de alta densidade 1080p e 4K multifaixas), dimensionando buffers e threads para rodar com eficiência máxima sem estourar limites de memória.

### 12.5. Princípio de Desacoplamento de Modificadores e Harmonia de Threads
1. **Desacoplamento Canônico**: Os motores de conversão não devem conter escadas de condicionais (`if/else`) baseadas em rótulos de interface de usuário (como `'1080p'`, `'cif'`, etc.). Os modificadores são responsáveis por traduzir qualquer preset ou entrada manual em parâmetros operacionais canônicos (`targetWidth`, `targetHeight`, `targetFps`, `targetCrf`). O motor simplesmente recebe esses valores numéricos e aplica o filtro correspondente (`scale=${width}:${height}`, `-r ${fps}`, `-crf ${crf}`). Isso torna os motores universalmente extensíveis e 100% desacoplados de mudanças de interface.
2. **Harmonia de Threads e Integridade de Capacidades**:
   - É terminantemente proibido limitar ou sobrescrever de forma estática o número de threads (`-threads 1`) dentro de um motor se o modificador de threads estiver disponível ou ativo. Se um motor declara suporte a threads, ele deve respeitar estritamente a escolha do usuário ou o dimensionamento dinâmico calculado pelo hardware optimizer.
   - Motores mono-thread (ex: `ffmpeg-core`) e motores sem re-encodificação (ex: `stream-copy` / `remux`) jamais devem declarar `threads` em seu `supportedModifiers`.
   - Discrepâncias entre o que o modificador oferece e o que o motor de execução efetivamente executa violam o princípio de transparência e confiabilidade do FileTools.

### 12.6. Tolerância a Arquivos Gigantes e Streaming Zero-RAM (WORKERFS & OPFS)
1. **Eliminação de Alocações Monolíticas em RAM**:
   - É expressamente proibido alocar arquivos de entrada inteiros na memória heap do navegador via `file.arrayBuffer()` ou duplicações em `Uint8Array` no orquestrador de interface (`ConvertPanel.tsx`). O handle nativo `File` ou `Blob` deve ser repassado diretamente para a camada de execução.
2. **Montagem Virtual de Arquivos no FFmpeg (WORKERFS)**:
   - Os motores baseados em FFmpeg (`ffmpeg-mt.ts`, `ffmpeg.ts`, `remux.ts`) utilizam a montagem virtual via `WORKERFS` do Emscripten (`ffmpeg.mount('WORKERFS' as FFFSType, { files: [file] }, '/work')`).
   - O binário C/WASM lê blocos sob demanda diretamente do descritor de arquivo nativo do navegador sem duplicar o arquivo na RAM do WebAssembly.
   - Em blocos `finally`, o sistema realiza o desmontamento seguro (`ffmpeg.unmount('/work')`) e a limpeza imediata do diretório virtual.
3. **Chunked Demuxing & Retorno em Blob**:
   - Motores demuxers/muxers em JavaScript (como `mp4-muxer.ts`, `webm-muxer.ts` e `mp4box.ts`) realizam a leitura fatiada em blocos controlados (ex: fatias de 2MB diretamente via `ReadableStream` / `file.slice`), prevenindo estouro de heap do V8 ao processar arquivos de múltiplos gigabytes.
   - Os motores entregam a saída final como `outputBlob` ou gravam diretamente no OPFS, preservando a estabilidade da aba do navegador.

---

## 13. Motor de Regras dos Modificadores (Rules Engine)

Para transformar a definição dos modificadores em um verdadeiro **Rules Engine**, todo o contexto da conversão ativa é encapsulado no objeto declarativo `ModifierContext` (`src/shared/types/conversionModifiers.ts`).

### 13.1. Arquitetura do Contexto (`ModifierContext`)

```typescript
export interface ModifierContext {
  sourceExt: string;
  targetExt: string;
  sourceCategory: 'video' | 'audio' | 'image' | 'document';
  targetCategory: 'video' | 'audio' | 'image' | 'document';
  currentValues: ConversionModifiers;
  activeModifiers: ModifierCategoryId[];
  sourceProbe?: MediaProbeResult;
}
```

### 13.2. Os Quatro Pilares Declarativos da `ModifierDefinition`

1. **Aplicabilidade Semântica (`isApplicable: (ctx) => boolean`)**:
   Avalia se o modificador tem sentido técnico para o par ativo (ex: `video_duration` aplica-se exclusivamente a imagem convertida para vídeo; `pixel_format` aplica-se a contêineres de vídeo).
2. **Exclusão Mútua Declarativa (`mutuallyExclusiveWith`)**:
   Declara incompatibilidades cruzadas diretas entre modificadores. Exemplo: `audio_merge` (mixagem unificada em fluxo único) declara exclusão mútua com `audio_tracks` (roteamento multifaixa discreto). O painel desativa automaticamente a contraparte conflitante.
3. **Trava e Forçamento Implícito (`implicitRule: (ctx) => ImplicitRuleResult`)**:
   Ativa e trava modificadores que são tecnicamente obrigatórios para determinados fluxos (ex: extrair áudio de vídeo multifaixa força `audio_merge` com trava de edição e badge informativo na UI: *"Obrigatório ao extrair áudio de vídeos multifaixa"*).
4. **Derivação de Opções e Sintonia (`deriveOptions: (ctx) => DerivedOptionsResult`)**:
   Modificadores adaptam suas opções de forma inteligente com base no codec ou formato ativo (ex: o codec `h263` restringe as resoluções de `ResolutionCard` estritamente aos padrões CIF/QCIF/sub-QCIF e emite aviso explicativo amarelo na UI). O card visual apenas renderiza o que o Rules Engine deriva.



---

## 14. Sistema de Teste de Conversões com Delta Debugging (DDmin)

Para garantir cobertura total das centenas de pares de conversão sem incorrer em execuções de dezenas de horas, o FileTools adota o algoritmo **Delta Debugging (DDmin)** com **Escopo Direcionado**:

1. **Localização**:
   - Motor DDmin: [`src/core/testing/deltaDebugger.ts`](../src/core/testing/deltaDebugger.ts)
   - Testes Unitários: [`src/core/testing/deltaDebugger.test.ts`](../src/core/testing/deltaDebugger.test.ts)
   - CLI Runner: [`scripts/test-conversion.ts`](../scripts/test-conversion.ts)
   - Teste E2E Playwright: [`e2e/test-delta-debugging.spec.ts`](../e2e/test-delta-debugging.spec.ts)
   - Protocolo Normativo: [`docs/protocols/delta-debugging.md`](./protocols/delta-debugging.md)

2. **Fluxo Operacional**:
   - **Fast-Path ($C_{max}$)**: Aplica todos os modificadores válidos suportados pelo motor. Se passar, o teste termina em 1 ciclo (~1s).
   - **Baseline ($C = \emptyset$)**: Se $C_{max}$ falhar, avalia se a conversão básica é suportada pelo motor.
   - **Singleton ($|C| = 1$)**: Se o baseline passar, testa modificadores individualmente.
   - **Bissecção Binária**: Bissecção recursiva de partições e complementos até isolar o subconjunto conflitante mínimo.

3. **Comando para Desenvolvedores**:
   ```bash
   # Testar conversão específica em segundos
   npx tsx scripts/test-conversion.ts --from=mkv --to=webm
   # ou via npm
   npm run test:conversion -- --from=mkv --to=webm
   ```
