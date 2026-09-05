# Guia: Como Adicionar um Novo Módulo de Conversão

**Status:** Normativo / Obrigatório  
**Última Atualização:** 2026-09-03  
**Pré-requisitos:** Leitura de [`docs/ARCHITECTURE.MD`](../ARCHITECTURE.MD) e [`docs/protocols/module-contract.md`](../protocols/module-contract.md)

---

## Visão Geral

No FileTools, todo motor de conversão é um **módulo isolado** que implementa a interface `IModule` definida em [`src/shared/types/module.ts`](../../src/shared/types/module.ts). Este guia descreve **todos os passos obrigatórios** para adicionar um novo módulo, desde a criação do arquivo até os testes e a integração com a interface.

### Arquivos Envolvidos (em ordem de modificação)

| # | Arquivo | Ação |
|---|---|---|
| 1 | `src/modules/engines/<nome-do-modulo>.ts` | **CRIAR** — Implementar `IModule` |
| 2 | `src/modules/registry.ts` | **MODIFICAR** — Importar e registrar o módulo |
| 3 | `src/lib/formats.ts` | **VERIFICAR** — Confirmar se extensões estão em `FORMAT_CATALOG` |
| 4 | `src/core/engine/WorkerManager.ts` | **MODIFICAR** — Adicionar à lista `MAIN_THREAD_MODULES` (se aplicável) |
| 5 | `src/modules/registry.test.ts` | **MODIFICAR** — Adicionar testes de resolução do novo módulo |
| 6 | `e2e/modules/<nome>.spec.ts` | **CRIAR** — Teste E2E de conversão real (Playwright) |

---

## Passo 1: Criar o Arquivo do Módulo

Crie o arquivo em `src/modules/engines/<nome-do-modulo>.ts`.

### 1.1. Estrutura Obrigatória

Todo módulo **deve** exportar uma constante do tipo `IModule` com:

```typescript
// src/modules/engines/meu-modulo.ts

import type { IModule, ExecutionContext } from '@/shared/types/module';

export const MeuModule: IModule = {
  manifest: { /* ... obrigatório ... */ },
  isSupported: () => { /* ... opcional mas recomendado ... */ },
  execute: async (inputs, context) => { /* ... obrigatório ... */ },
};
```

### 1.2. O `manifest` (Obrigatório)

O manifesto declara **estaticamente** tudo que o módulo suporta. Ele é lido pelo `ModuleRegistry` para resolver motores, gerar rotas SSG e exibir informações na UI.

```typescript
manifest: {
  // ID único e imutável. Formato: kebab-case. Usado como chave no registry.
  // REGRA: Uma vez publicado, o ID NUNCA pode mudar.
  id: 'meu-motor-wasm',

  // Nome legível exibido na UI (seletor de motor, mensagens de erro).
  name: 'Meu Motor WASM',

  // Versão semântica da biblioteca subjacente (não do FileTools).
  version: '1.0.0',

  // Descrição curta em PT-BR para exibição na UI.
  description: 'Descrição clara do que este motor faz e quando usá-lo.',

  // Categoria: determina agrupamento na UI. Valores permitidos:
  // 'video' | 'audio' | 'document' | 'image'
  category: 'video',
    // Modificadores que este motor suporta aplicar na conversão (Inversão de Controle)
    supportedModifiers: ['video_codec', 'audio_codec', 'quality', 'fps', 'resolution', 'threads'],

  // Regras de conversão: quais pares from→to este motor suporta.
  supportedConversions: [
    {
      // Origens aceitas: extensões com ponto (e.g. '.mp4') ou MIME wildcards (e.g. 'video/*')
      from: ['video/*'],

      // Destinos produzidos: sempre extensões com ponto
      to: ['.mp4', '.webm'],

      // true se a conversão pode perder qualidade (re-encoding)
      lossy: true,

      // Pontuação de velocidade de 1 (mais lento) a 100 (instantâneo).
      // Referência:
      //   95-100: Cópia direta / GPU hardware
      //   70-85:  CPU multi-thread (pthreads)
      //   30-50:  CPU single-thread
      //   1-20:   Processamento extremamente lento
      speedScore: 75,

      // Tier de aceleração usado. Valores permitidos:
      // 'gpu' | 'cpu-multithread' | 'cpu-singlethread' | 'instant-copy'
      acceleration: 'cpu-multithread',

      // Nota técnica exibida ao lado do motor na UI do seletor de engines.
      performanceNotes: 'Processamento multi-core otimizado para o seu hardware',
    },
  ],

  // Portas de entrada. Para conversões simples, sempre usar este padrão:
  inputs: [
    { id: 'file', name: 'Input File', type: 'file_handle', required: true },
  ],

  // Portas de saída. Padrão para conversões simples:
  outputs: [
    { id: 'file', name: 'Output File', type: 'file_handle', required: true },
  ],
},
```

#### Regras do `supportedConversions`

| Regra | Detalhe |
|---|---|
| **MIME Wildcards** | Use `'video/*'`, `'audio/*'`, `'image/*'` para aceitar qualquer formato da categoria. O `registry.ts` cruza wildcards com o MIME real/inferido do arquivo. |
| **Extensões Específicas** | Use `'.mkv'`, `'.mp4'` quando o módulo só aceita formatos específicos (ex: Remux aceita apenas `.mkv`, `.mp4`, `.mov`, `.m4v`). |
| **Múltiplas Regras** | Crie regras separadas quando o `speedScore` ou `acceleration` diferirem entre pares (ex: FFmpeg MT tem regras distintas para `video→video`, `video→gif`, `audio→audio`). |
| **speedScore** | Deve ser **realista e comparável** com os motores existentes. O `registry.ts` ordena decrescentemente por este valor para determinar o motor recomendado. |

### 1.3. O `isSupported` (Recomendado)

Sondagem assíncrona que verifica se o hardware/browser do cliente suporta este motor. Retornar `false` exclui o motor silenciosamente — ele não aparecerá na UI.

```typescript
isSupported: (context?) => {
  // Exemplo: verificar SharedArrayBuffer para multi-threading
  if (typeof SharedArrayBuffer === 'undefined') return false;
  if (!window.crossOriginIsolated) return false;

  // REGRA para testes: sempre retornar true em ambiente de teste
  if (typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test') return true;

  return true;
},
```

#### Regras do `isSupported`

| Regra | Detalhe |
|---|---|
| **Sempre retornar `true` em testes** | Verificar `import.meta.env.MODE === 'test'` e retornar `true` para que os testes unitários (Vitest) não descartem o módulo. |
| **Sem side-effects** | Esta função NÃO deve carregar binários, alocar memória ou inicializar bibliotecas. É apenas uma sondagem leve. |
| **Tratar exceções internamente** | Se a sondagem falhar (ex: API indisponível), capturar a exceção e retornar `false` — nunca propagar o erro. |

### 1.4. O `execute` (Obrigatório)

Função principal que realiza a conversão. Recebe `inputs` (dados brutos) e `context` (callbacks de progresso/log + caminho OPFS).

```typescript
execute: async (inputs, context) => {
  // 1. EXTRAIR INPUTS — Tipagem estrita, validação imediata
  const fileData = inputs.fileData as Uint8Array;
  const originalName = inputs.originalName as string;
  const targetFormat = inputs.targetFormat as string;
  const modifiers = (inputs.modifiers as ConversionModifiers) || undefined;

  if (!fileData || !originalName || !targetFormat) {
    throw new Error('MeuModule requires fileData (Uint8Array), originalName, and targetFormat.');
  }

  // 2. CALCULAR NOMES DE ARQUIVO
  const inputExt = '.' + originalName.split('.').pop()!.toLowerCase();
  const outputExt = '.' + targetFormat.replace(/^\.+/, '').toLowerCase();
  const outputFileName = originalName.replace(/\.[^.]+$/, '') + outputExt;

  // 3. REPORTAR PROGRESSO — Usar context.onProgress(percent, message)
  //    percent: 0-100 (nunca enviar 100 até que o resultado esteja pronto)
  //    message: string curta em PT-BR descrevendo o estágio atual
  context.onProgress(0, 'Iniciando processamento...');
  context.onLog(`[MeuModule] Convertendo: ${originalName} -> ${outputFileName}`);

  // 4. EXECUTAR CONVERSÃO
  // ... (lógica específica do motor) ...

  // 5. LER OPÇÕES DO USUÁRIO (se aplicável)
  //    NUNCA usar dados mockados. Sempre ler de `modifiers` ou usar padrões sensatos.
  if (options?.activeCategories?.includes('audio_tracks')) {
    context.onLog(`[MeuModule] Faixas de áudio selecionadas: [${options.selectedAudioTracks.join(', ')}]`);
  }

  // 6. RETORNAR RESULTADO — Formato padronizado obrigatório
  context.onProgress(100, 'Conversão concluída com sucesso!');
  return {
    outputData: outputData,         // Uint8Array — dados binários do arquivo convertido
    outputFileName: outputFileName, // string — nome do arquivo com extensão correta
    outputSize: outputData.byteLength, // number — tamanho em bytes
    mimeType: getMimeType(outputExt),  // string — MIME type do formato de saída
  };
},
```

#### Contrato de Retorno do `execute`

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `outputData` | `Uint8Array` | ✅ | Dados binários do arquivo convertido |
| `outputFileName` | `string` | ✅ | Nome do arquivo de saída com extensão |
| `outputSize` | `number` | ✅ | Tamanho em bytes (`outputData.byteLength`) |
| `mimeType` | `string` | ✅ | MIME type do formato (ex: `'video/mp4'`) |

#### Contrato de Inputs do `execute`

| Campo | Tipo | Origem | Descrição |
|---|---|---|---|
| `fileData` | `Uint8Array` | `ConvertPanel.tsx` | Dados brutos do arquivo de entrada |
| `originalName` | `string` | `ConvertPanel.tsx` | Nome original do arquivo (ex: `'video.mkv'`) |
| `targetFormat` | `string` | `ConvertPanel.tsx` | Extensão de destino com ponto (ex: `'.mp4'`) |
| `modifiers` | `ConversionModifiers` | `ConvertPanel.tsx` | Opções configuradas pelo usuário no Pilha de Modificadores |
| `userMaxThreads` | `number` (opcional) | `ConvertPanel.tsx` | Override manual de threads (quando `threadsMode === 'custom'`) |

#### Regras do `execute`

| Regra | Detalhe |
|---|---|
| **NUNCA mock data** | Não fabricar dados que deveriam vir de sondagem real (ex: faixas de áudio). Use sempre `modifiers.probedMedia` ou probing real do container. |
| **Progresso granular** | Reportar progresso com frequência para a barra da UI. Para FFmpeg, parsear `time=` e `Duration:` dos logs. Para outros motores, estimar baseado em etapas. |
| **Limpeza de memória** | Em caso de erro, garantir que buffers temporários e instâncias WASM sejam liberados (`finally` block). |
| **Mensagens em PT-BR** | Logs e mensagens de progresso devem estar em português brasileiro. |
| **Error handling explícito** | Nunca silenciar erros. Propagar com mensagem descritiva que inclua o nome do motor. |

### 1.5. Helper `getMimeType` (Padrão)

Cada módulo deve incluir seu próprio mapeamento de MIME types para as extensões que produz:

```typescript
function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.mkv': 'video/x-matroska',
    '.webm': 'video/webm',
    '.gif': 'image/gif',
    // ... adicionar apenas os formatos que este módulo produz
  };
  return map[ext] || 'application/octet-stream';
}
```

---

## Passo 2: Registrar no `ModuleRegistry`

Edite [`src/modules/registry.ts`](../../src/modules/registry.ts):

```typescript
// 1. Adicionar import no topo (em ordem alfabética com os existentes)
import { MeuModule } from './engines/meu-modulo';

// 2. Adicionar entrada no objeto ModuleRegistry
//    A CHAVE deve ser EXATAMENTE o manifest.id do módulo
export const ModuleRegistry: Record<string, IModule> = {
  'stream-copy': RemuxModule,
  'mp4box': MP4BoxModule,
  'mp4-muxer': Mp4MuxerModule,
  'webm-muxer': WebmMuxerModule,
  'ffmpeg-core-mt': FFmpegMTModule,
  'ffmpeg-core': FFmpegModule,
  'magick-wasm': MagickModule,
  'pdf-lib': PdfModule,
  'mammoth': MammothModule,
  'sheetjs': SheetJSModule,
  'meu-motor-wasm': MeuModule,  // ← NOVO
};
```

#### Regras do Registry

| Regra | Detalhe |
|---|---|
| **Chave = manifest.id** | A chave no objeto `ModuleRegistry` DEVE ser idêntica ao `manifest.id` do módulo. Qualquer divergência causa falha silenciosa na resolução de motores. |
| **Ordem de declaração** | Não afeta a resolução (que usa `speedScore`), mas manter ordem lógica: instant-copy > gpu > cpu-mt > cpu-st > outros. |
| **Sem lazy loading no registry** | Todos os módulos são importados estaticamente. O lazy loading dos binários `.wasm` é responsabilidade interna de cada módulo (dentro do `execute`). |

---

## Passo 3: Configurar Execução no WorkerManager

Edite [`src/core/engine/WorkerManager.ts`](../../src/core/engine/WorkerManager.ts).

### Quando adicionar a `MAIN_THREAD_MODULES`?

O módulo deve ser adicionado a esta lista **se e somente se** ele:
- Gerencia seus **próprios Web Workers internos** (ex: `@ffmpeg/ffmpeg` cria workers para pthreads)
- Usa **APIs que exigem a main thread** (ex: `VideoEncoder`, `AudioEncoder` do WebCodecs)
- Carrega **binários WASM com `SharedArrayBuffer`** (que requerem `crossOriginIsolated`)

```typescript
const MAIN_THREAD_MODULES = new Set([
  'ffmpeg-core',
  'ffmpeg-core-mt',
  'stream-copy',
  'mp4box',
  'mp4-muxer',
  'webm-muxer',
  'meu-motor-wasm',  // ← Adicionar SOMENTE se o módulo se enquadra nas regras acima
]);
```

Se o módulo **NÃO** gerencia workers próprios e pode rodar em um Web Worker genérico via Comlink, **NÃO** adicione à lista. Ele será automaticamente executado no worker do `conversionWorker.ts`.

---

## Passo 4: Habilitação de Conversões no Catálogo

No FileTools, não há lista estática manual de conversões. Os pares válidos são derivados automaticamente pelo gerador dinâmico (`generateConverters()`) a partir de `supportedConversions` declarado no manifesto do motor e dos formatos registrados em `FORMAT_CATALOG`.

Se o novo motor introduzir novos formatos ainda não catalogados, adicione suas extensões em [`src/lib/formats.ts`](../../src/lib/formats.ts). Consulte [`docs/guides/adding-a-format.md`](./adding-a-format.md) para detalhes.

---

## Passo 5: Adicionar Testes

### 5.1. Teste Unitário no Registry

Edite [`src/modules/registry.test.ts`](../../src/modules/registry.test.ts) para verificar que o novo módulo é resolvido corretamente:

```typescript
it('resolves MeuModule for .ext -> .ext2 conversions', async () => {
  const engines = await resolveAvailableEngines('EXT', 'EXT2', 'tipo/mime');
  expect(engines.length).toBeGreaterThanOrEqual(1);
  const meuEngine = engines.find(e => e.moduleId === 'meu-motor-wasm');
  expect(meuEngine).toBeDefined();
  expect(meuEngine!.speedScore).toBeGreaterThan(0);
});
```

### 5.2. Teste E2E (Playwright)

Crie `e2e/modules/<nome>.spec.ts` seguindo o padrão dos testes existentes. Consulte [`docs/guides/testing-strategy.md`](./testing-strategy.md) para detalhes.

---

## Passo 6: Checklist de Validação Final

Antes de considerar o módulo completo, verificar **todos** os itens:

- [ ] `manifest.id` é único e em kebab-case
- [ ] `manifest.id` === chave no `ModuleRegistry`
- [ ] `supportedConversions` tem `speedScore` realista e comparável com motores existentes
- [ ] `isSupported` retorna `true` em ambiente de teste (`import.meta.env.MODE === 'test'`)
- [ ] `isSupported` NÃO carrega binários nem faz side-effects
- [ ] `execute` valida inputs obrigatórios no início (`fileData`, `originalName`, `targetFormat`)
- [ ] `execute` retorna o objeto padronizado com `outputData`, `outputFileName`, `outputSize`, `mimeType`
- [ ] `execute` reporta progresso via `context.onProgress()` (0-100)
- [ ] `execute` loga etapas via `context.onLog()` com prefixo `[NomeDoMotor]`
- [ ] `execute` limpa recursos no bloco `finally` (deletar arquivos temporários, reset instância em erro)
- [ ] `execute` NUNCA usa dados mockados/fabricados
- [ ] Mensagens de erro incluem o nome do motor
- [ ] `getMimeType` retorna MIME correto para todos os formatos de saída
- [ ] Adicionado ao `MAIN_THREAD_MODULES` se gerencia workers próprios
- [ ] Testes unitários no `registry.test.ts` passando
- [ ] TypeScript compila sem erros (`npx tsc --noEmit`)
- [ ] Se novos pares from→to: entradas adicionadas em `CONVERTERS` (`formats.ts`)
- [ ] Rotas SSG geradas corretamente (`npm run build` sem erros)

---

## Exemplos de Referência

| Módulo | Arquivo | Complexidade | Destaque |
|---|---|---|---|
| Remux (Stream Copy) | [`src/modules/engines/remux.ts`](../../src/modules/engines/remux.ts) | Simples | Conversão mais básica possível (cópia de stream) |
| FFmpeg WASM | [`src/modules/engines/ffmpeg.ts`](../../src/modules/engines/ffmpeg.ts) | Média | Single-thread, sem opções avançadas |
| FFmpeg Multi-Thread | [`src/modules/engines/ffmpeg-mt.ts`](../../src/modules/engines/ffmpeg-mt.ts) | Complexa | Multi-thread, thread optimizer, Pilha de Modificadores completo, probing de streams |
| ImageMagick WASM | [`src/modules/engines/magick.ts`](../../src/modules/engines/magick.ts) | Placeholder | Esqueleto mínimo (execute ainda não implementado) |

---

## Erros Comuns e Como Evitar

| Erro | Causa | Solução |
|---|---|---|
| Motor não aparece no seletor de engines | `isSupported` retorna `false` no browser | Verificar se `SharedArrayBuffer` / `crossOriginIsolated` estão disponíveis. Para testes, verificar o guard `import.meta.env.MODE === 'test'`. |
| Rota SSG não gerada | Par from→to não existe em `CONVERTERS` | Adicionar a entrada em `src/lib/formats.ts` |
| Conversão trava sem progresso | Módulo não reporta progresso | Implementar parsing de progresso nos logs do motor (ex: `time=` para FFmpeg) |
| Arquivo de saída vazio ou corrompido | `execute` retorna `string` em vez de `Uint8Array` | Verificar `typeof outputData === 'string'` e lançar erro explícito |
| Barra de progresso não avança | Não parser `Duration:` do log de entrada | Capturar duração total do input primeiro, depois calcular `(currentTime / totalDuration) * 100` |
| Motor falha mas erro não aparece na UI | Erro silenciado internamente | NUNCA usar `catch` vazio. Sempre propagar com `throw` e mensagem descritiva. |