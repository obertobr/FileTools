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
├── docs/                       # Documentação arquitetural
│   ├── ARCHITECTURE.MD         # Visão geral e regras do sistema
│   └── protocols/              # Especificações isoladas de protocolos
│       ├── module-contract.md  # Contrato da interface IModule
│       ├── node-communication.md # Troca de dados entre nós via OPFS
│       └── export-format.md    # Esquema do arquivo de grafo .ftgraph
├── public/                     # Binários Wasm, ícones PWA
├── src/
│   ├── core/                   # Orquestração desacoplada de UI
│   │   ├── engine/             # WorkerManager (Singleton orquestrador)
│   │   ├── fs/                 # OPFSManager (Zelador de sessões)
│   │   └── workers/            # Web Workers com Comlink
│   ├── modules/                # Motores de conversão (IModule)
│   │   ├── registry.ts         # Registro central de módulos
│   │   ├── ffmpeg.ts           # Motor FFmpeg WASM
│   │   └── ...                 # Demais motores
│   ├── shared/                 # Tipagens e utilitários agnósticos
│   │   └── types/module.ts     # Contratos TypeScript de IModule
│   ├── styles/                 # Design System & Tailwind Tokens
│   │   └── global.css          # Tokens inline e base styles
│   ├── ui/
│   │   ├── components/         # Componentes de interface
│   │   │   ├── core/           # Design System Base (Button, Card, Typography, etc.)
│   │   │   └── ...             # Componentes de negócio (ConvertPanel, Dropzone, etc.)
│   │   └── layouts/            # Layouts Astro e App Shell
│   └── pages/                  # Roteamento Astro SSG
```
