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
* **Motores de Conversão (MVP):** `@ffmpeg/ffmpeg` (Wasm), `@imagemagick/magick-wasm`, `pdf-lib`, `mammoth`, `xlsx` (SheetJS).

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
│   │   ├── media/                   # Probing de containers de mídia
│   │   │   └── mediaProbe.ts        # Parser zero-dep para MKV/MP4 (EBML/ISO-BMFF)
│   │   └── workers/                 # Web Workers com Comlink
│   ├── modules/                     # Motores de conversão (IModule)
│   │   ├── registry.ts              # Registro central de módulos
│   │   ├── registry.test.ts         # Testes de resolução do registry
│   │   ├── ffmpeg-mt.ts             # Motor FFmpeg Multi-Thread (pthreads)
│   │   ├── ffmpeg.ts                # Motor FFmpeg Single-Thread
│   │   ├── remux.ts                 # Motor Stream Copy (Remux instantâneo)
│   │   ├── webcodecs.ts             # Motor WebCodecs (GPU)
│   │   ├── magick.ts                # Motor ImageMagick WASM
│   │   ├── pdf.ts                   # Motor pdf-lib
│   │   ├── mammoth.ts               # Motor mammoth.js (DOCX)
│   │   └── sheetjs.ts               # Motor SheetJS (planilhas)
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
│   │   │   │   ├── ModifierDefinitions.ts  # Catálogo de categorias disponíveis
│   │   │   │   ├── AddModifierPicker.tsx   # Modal de busca/adição de categorias
│   │   │   │   ├── AudioTracksCard.tsx     # Card: seleção de faixas de áudio
│   │   │   │   ├── SubtitlesCard.tsx       # Card: seleção de legendas
│   │   │   │   ├── FpsCard.tsx             # Card: taxa de quadros
│   │   │   │   └── ResolutionCard.tsx      # Card: resolução/escala
│   │   │   └── ...                  # Componentes de negócio (ConvertPanel, etc.)
│   │   └── layouts/                 # Layouts Astro e App Shell
│   └── pages/                       # Roteamento Astro SSG
├── e2e/                             # Testes End-to-End (Playwright)
│   ├── modules/                     # Testes de conversão por módulo
│   └── test-modifiers.spec.ts         # Testes do Pilha de Modificadores (Modifier Stack) UI
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

| Modificadorre`) |
|---|:---:|:---:|:---:|
| **Cópia Instantânea (`-c copy`)** | Sim | Sim | Sim |
| **Taxa de Quadros (`-r fps`)** | ❌ Incompatível | ✅ Total | ✅ Total |
| **Escala / Resolução (`-vf scale`)** | ❌ Incompatível | ✅ Total | ✅ Total |
| **Qualidade / CRF / Bitrate** | ❌ Incompatível | ✅ Total | ✅ Total |
| **Transcodificação de Codec** | ❌ Incompatível | ✅ Total | ✅ Total |
| **Unir Faixas (`amix` filter)** | ❌ Incompatível | ✅ Total | ✅ Total |
| **Seleção de Faixas de Áudio** | ✅ Suportado | ✅ Total | ✅ Total |
| **Subtítulos Embutidos** | ✅ Suportado | ✅ Total | ✅ Total |
| **Duração Imagem -> Vídeo** | ❌ Incompatível | ✅ Total | ✅ Total |


### 12.2. Inversão de Controle no ModuleManifest (`supportedModifiers`)
1. **Responsabilidade Descentralizada:** Cada motor declara exclusivamente em seu próprio manifesto (`ModuleManifest.supportedModifiers`) a lista de modificadores que suporta executar.
2. **Orquestrador Puro:** O módulo `src/modules/engineCapabilities.ts` não possui nenhum `if/else` com nomes de motores hardcoded. A verificação é uma consulta pura de inclusão no array de capacidades do motor.
3. **UX Guard Integrado:** Se o usuário acionar um modificador não suportado pelo motor ativo (ex: alterar FPS enquanto o motor selecionado é o Remux direto), a UI exibe o aviso em vermelho e desabilita a conversão, prevenindo execuções silenciosas incorretas.

### 12.3. Contrato de Proteção ao Usuário (UX Guard)
1. **Detecção de Conflito**: O módulo `src/modules/engineCapabilities.ts` avalia em tempo real (`checkEngineCompatibility`) as opções ativas contra as capacidades do motor selecionado.
2. **Prevenção de Execução Silenciosa Falha**: Caso o motor atual não suporte aplicar as alterações solicitadas, a conversão é bloqueada na UI com indicação clara do motivo e botão de alternância imediata para o motor transcodificador compatível.
3. **Extração e Fidelidade de Metadados**: O probe binário nativo (`src/core/media/mediaProbe.ts`) garante que framerate e dimensões sejam populados a partir do arquivo real do usuário, eliminando defaults arbitrários.

