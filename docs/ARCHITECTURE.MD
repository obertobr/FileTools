# Projeto: FileTools
**Visão Geral:** Um conversor de arquivos universal 100% client-side, rodando localmente no navegador (offline-first). O MVP focará em conversões diretas de mídia e documentos, com a arquitetura base (Módulos, Workers, OPFS) estritamente desenhada para suportar um sistema futuro de "Nodes/Grafo".

## 1. Stack Tecnológica
* **Framework Core:** Astro (Geração de Site Estático - SSG para roteamento e SEO).
* **UI/Interatividade:** React + TypeScript (Arquitetura de Ilhas do Astro).
* **Bundler:** Vite (com configuração de headers `Cross-Origin-Opener-Policy` e `Cross-Origin-Embedder-Policy` para habilitar `SharedArrayBuffer`).
* **Isolamento de Threads:** Web Workers + `comlink` (Nenhum processamento de conversão pode ocorrer na main thread).
* **File System:** API OPFS (Origin Private File System) para manipulação de arquivos grandes.
* **PWA:** `vite-plugin-pwa` (Cache API e Service Worker).
* **Motores de Conversão (MVP):** `@ffmpeg/ffmpeg` (Wasm), `@imagemagick/magick-wasm`, `pdf-lib`, `mammoth`, `xlsx` (SheetJS).

## 2. Estrutura de Rotas (Astro)
A aplicação possui dupla natureza (PWA interativo e Catálogo SEO).
* `/` **(Root/App Shell):** Ponto de entrada do PWA (`start_url`). Interface interativa Drag & Drop pura. O usuário arrasta o arquivo, o sistema lê os manifestos e gera os botões de conversão dinamicamente. Não possui foco em indexação SEO.
* `/converter`: Página catálogo (SEO). Exibe um grid/abas listando todas as categorias e conversões possíveis baseadas no registro de módulos.
* `/converter/[from]-para-[to]`: Milhares de rotas estáticas geradas no momento do build (SSG). O Astro deve varrer os Manifestos dos módulos cruzando as regras de origem e destino para compilar essas URLs.

## 3. Arquitetura de Módulos (Core Contract)
Toda ferramenta de conversão é tratada como um módulo isolado ("caixa preta") para permitir fácil substituição e integração futura com o sistema de Nodes.

### 3.1. Tipagens Base (`src/shared/types/module.ts`)
```typescript
export type DataType = 'file_handle' | 'string' | 'number' | 'boolean' | 'enum';

export interface PortDefinition {
  id: string;
  name: string;
  type: DataType;
  required: boolean;
  accepts?: string[]; // MIME types ou extensões
  options?: string[]; // Para selects/enums
  defaultValue?: any;
}

export interface ConversionRule {
  from: string[]; // ex: ['video/*', 'audio/*'] ou ['.docx']
  to: string[];   // ex: ['.mp4', '.mp3']
  lossy?: boolean;
}

export interface ModuleManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  category: 'video' | 'audio' | 'document' | 'image';
  supportedConversions: ConversionRule[]; // Usado para UI Dinâmica e SSG SEO
  inputs: PortDefinition[];
  outputs: PortDefinition[];
}

export interface ExecutionContext {
  onProgress: (percent: number, message?: string) => void;
  onLog: (message: string) => void;
  workspacePath: string; // Caminho isolado no OPFS
}

export interface IModule {
  manifest: ModuleManifest;
  execute: (inputs: Record<string, any>, context: ExecutionContext) => Promise<Record<string, any>>;
}

```

## 4. Orquestração e Memória (OPFS)

Arquivos processados não podem ser carregados na RAM (para evitar crashes). O tráfego de dados entre UI, Orquestrador e Módulo usa apenas ponteiros/referências do OPFS.

### 4.1. Ciclo de Vida do Workspace (Garbage Collection)

* **Estrutura:** `/opfs_root/sessions/{sessionId}/{taskId}/`
* **Zelador de Inicialização:** Ao montar o app no navegador, o orquestrador verifica a pasta `/sessions/`. Se houver pastas de sessões anteriores à atual, elas são deletadas recursivamente.
* **Prevenção (Cão de Guarda):** Antes de instanciar um `execute()`, o orquestrador deve invocar `navigator.storage.estimate()` para checar o espaço livre.
* **Limpeza de Tarefa:** Ao concluir um download de arquivo pelo usuário ou em caso de falha irreversível, a pasta `{taskId}` específica é destruída.

## 5. PWA, Lazy Loading e Cache

* **Lazy Loading Estrito:** Binários `.wasm` (ex: `ffmpeg.wasm`) **nunca** devem ser importados no load inicial da página. Eles devem ser carregados dinamicamente apenas quando o Worker solicitar a conversão pela primeira vez.
* **Service Worker (Cache First):** O Vite PWA deve fazer o cache persistente desses binários na Cache API do navegador. O Service Worker não deve fazer o pré-cache das rotas SSG (para economizar banda), servindo-as sob demanda.
* **Gerenciador de Armazenamento:** A UI deve incluir um componente de configurações que lê a Cache API e exibe o tamanho dos módulos (Wasm) baixados, com a opção "Excluir/Limpar" para que o usuário recupere espaço em disco.

## 6. Diretrizes de Testes (Vitest)

A suíte de testes deve ser pragmática e focar em comportamento crítico (Business Logic), ignorando testes cosméticos sem valor.

**O que DEVE ser testado:**

1. **Lógica de Módulos (Unitários):** A função que cruza as extensões de arquivo do usuário com o `supportedConversions` dos manifestos para gerar a lista de outputs possíveis.
2. **Ciclo de Vida do OPFS:** O orquestrador isolado deve ser testado simulando a criação de pastas, o limite de cota (`storage.estimate`), e a limpeza de sessões antigas (Mock do File System).
3. **Comunicação UI-Worker (Integração):** Testar se a interface gráfica recebe corretamente os callbacks de `onProgress` enviados pelo `Comlink` a partir do Web Worker.
4. **Gerador SSG (Unitário):** O script que compila as rotas `/converter/[from]-para-[to]` deve garantir que nenhuma rota duplicada ou inválida seja gerada a partir dos manifestos.

**O que NÃO DEVE ser testado:**

* Evite snapshot testing de marcação HTML pura.
* Não crie testes para verificar estilos, cores de botões, propriedades CSS, ou presença de ícones decorativos.
* Não teste o funcionamento interno das bibliotecas de terceiros (não crie testes para checar se o FFmpeg realmente converteu o byte final corretamente, confie na engine da biblioteca).

## 7. Estrutura de Diretórios Esperada

```text
/
├── public/                 # Binários Wasm, ícones do PWA
├── src/
│   ├── core/               # Lógica sem dependência de React
│   │   ├── engine/         # Orquestrador de tarefas (WorkerManager)
│   │   ├── fs/             # Abstrações do OPFS e Garbage Collection
│   │   └── workers/        # Workers encapsulados via Comlink
│   ├── modules/            # Motores de conversão isolados
│   │   ├── registry.ts     # Catálogo central
│   │   ├── ffmpeg.ts       # Implementação do FFmpeg via IModule
│   │   └── ... Outros módulos
│   ├── shared/             # Código agnóstico (Types, Helpers)
│   ├── ui/                 # Componentes React (Ilhas)
│   │   ├── components/     # Dropzone, Barras de Progresso, StorageManager
│   │   ├── layouts/        
│   │   └── views/          # Entrypoints das ilhas React
│   ├── pages/              # Roteamento baseado em arquivos do Astro
│   │   ├── index.astro     # App Shell (PWA Entrypoint)
│   │   └── converter/      # Rotas do Catálogo e Gerador SSG dinâmico

```

```