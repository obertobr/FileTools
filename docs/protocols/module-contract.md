# Protocolo: Contrato de Módulos (`module-contract.md`)

**Status:** Ativo / Normativo  
**Localização do Código:** `src/shared/types/module.ts`, `src/modules/registry.ts`

---

## 1. Visão Geral

No FileTools, todo motor de conversão é encapsulado como uma **caixa preta isolada** que implementa a interface estrita `IModule`. Esse contrato desacopla a interface do usuário (UI) e o orquestrador (`WorkerManager`) do mecanismo interno de processamento (seja WebAssembly, Web Worker dedicado ou biblioteca JS em runtime).

Esta abstração é a pedra fundamental que permite ao FileTools evoluir de um conversor simples de arquivo único para um **sistema de nós e grafos interconectados** (Nodes/Graph System).

---

## 2. Tipagens e Definição da Interface

A definição central reside em `src/shared/types/module.ts`.

### 2.1. Tipos de Dados Suportados (`DataType`)

Os nós e portas aceitam os seguintes tipos primitivos e estruturados:

```typescript
export type DataType = 'file_handle' | 'string' | 'number' | 'boolean' | 'enum';
```

- `file_handle`: Referência a arquivo no Origin Private File System (`FileSystemFileHandle`) ou dados binários intermediários em memória (`Uint8Array`).
- `string`: Texto simples, caminhos, nomes de arquivos, formatos de saída.
- `number`: Taxas de amostragem, bitrate, resolução, fator de qualidade (CRF, compressão).
- `boolean`: Flags de conversão (ex: preservar metadados, lossless).
- `enum`: Opções discretas (ex: presets de encoding, perfis de cor).

### 2.2. Definição de Portas (`PortDefinition`)

Descreve as entradas (`inputs`) e saídas (`outputs`) do módulo:

```typescript
export interface PortDefinition {
  id: string;
  name: string;
  type: DataType;
  required: boolean;
  accepts?: string[]; // MIME types (ex: 'video/*') ou extensões (ex: '.mp4')
  options?: string[]; // Opções para tipo 'enum'
  defaultValue?: unknown;
}
```

### 2.3. Regras de Conversão (`ConversionRule`)

Usadas para compilação estática de rotas SEO (SSG no Astro) e descoberta dinâmica de formatos na UI:

```typescript
export interface ConversionRule {
  from: string[]; // Tipos de origem: MIME wildcards (ex: 'video/*') ou extensões (ex: '.docx')
  to: string[];   // Extensões de destino (ex: ['.mp4', '.gif', '.mp3'])
  lossy?: boolean;
}
```

### 2.4. Manifesto do Módulo (`ModuleManifest`)

Metadados estáticos do módulo:

```typescript
export interface ModuleManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  category: 'video' | 'audio' | 'document' | 'image';
  supportedConversions: ConversionRule[];
  inputs: PortDefinition[];
  outputs: PortDefinition[];
}
```

### 2.5. Contexto de Execução (`ExecutionContext`)

Canal de comunicação fornecido pelo orquestrador durante a conversão:

```typescript
export interface ExecutionContext {
  onProgress: (percent: number, message?: string) => void;
  onLog: (message: string) => void;
  workspacePath: string; // Caminho isolado no OPFS: /sessions/{sessionId}/{taskId}/
}
```

### 2.6. A Interface `IModule`

```typescript
export interface IModule {
  manifest: ModuleManifest;
  execute: (
    inputs: Record<string, unknown>,
    context: ExecutionContext
  ) => Promise<Record<string, unknown>>;
}
```

---

## 3. Ciclo de Vida de Execução de um Módulo

O ciclo de vida padrão de uma execução segue 6 fases bem delimitadas:

```
[1. Resolução] ──> [2. Alocação OPFS] ──> [3. Despacho] ──> [4. Processamento] ──> [5. Cleanup MEMFS] ──> [6. Retorno]
```

1. **Resolução de Formato:** A UI/Orquestrador chama `resolvePossibleConversions(ext, mimeType)` no `src/modules/registry.ts` para identificar o módulo responsável.
2. **Alocação de Workspace OPFS:** O `WorkerManager` cria a pasta de isolamento da tarefa `/sessions/{sessionId}/{taskId}/` via `OPFSManager.createWorkspace`.
3. **Despacho da Tarefa:**
   - **Módulos Convencionais (ex: Mammoth, SheetJS, pdf-lib, Magick):** Executados no Web Worker isolado (`src/core/workers/conversionWorker.ts`) via proxy Comlink.
   - **Módulos com Workers Internos (ex: `@ffmpeg/ffmpeg`):** Despachados na main thread pelo `WorkerManager.executeOnMainThread` para evitar o antipattern de *worker-inside-worker* no navegador.
4. **Processamento e Telemetria:** O módulo recebe os dados binários (`fileData: Uint8Array`) ou manipuladores OPFS, reporta progresso de 0 a 100% via `context.onProgress` e logs de diagnóstico via `context.onLog`.
5. **Limpeza de Memória Temporária (MEMFS/Cache):** O módulo deve obrigatoriamente deletar arquivos temporários montados em seu sistema de arquivos virtual (ex: `ffmpeg.deleteFile`) antes de finalizar.
6. **Retorno e Liberação:** Retorna `outputData` (`Uint8Array`), `outputFileName` e `mimeType`. O `WorkerManager` no bloco `finally` chama `OPFSManager.cleanupWorkspace` para garantir zero acúmulo de lixo em disco.

---

## 4. Diretrizes para Novos Módulos

Ao implementar um novo módulo para o FileTools:
1. Deve ser implementado em `src/modules/{nome}.ts`.
2. Deve exportar um objeto estático que cumpra rigorosamente `IModule`.
3. Deve ser registrado em `src/modules/registry.ts` dentro do mapa `ModuleRegistry`.
4. Não deve conter estilos nem referências à árvore de renderização do React.
5. Deve gerenciar internamente o ciclo de vida de suas instâncias Wasm (padrão Singleton com inicialização lazy).
