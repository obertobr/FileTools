# Protocolo: Contrato de Módulos (`module-contract.md`)

**Status:** Ativo / Normativo  
**Localização do Código:** `src/shared/types/module.ts`, `src/modules/registry.ts`

---

## 1. Visão Geral

No FileTools, todo motor de conversão é encapsulado como uma **caixa preta isolada** que implementa a interface estrita `IModule`. Esse contrato desacopla a interface do usuário (UI) e o orquestrador (`WorkerManager`) do mecanismo interno de processamento (seja WebAssembly multi-thread, WebCodecs acelerado por GPU, ou bibliotecas JS em runtime).

Esta abstração permite ao FileTools suportar:
1. **Sondagem Dinâmica de Hardware (`isSupported`):** O sistema apenas oferece ao usuário os motores que o hardware e o navegador do cliente comprovadamente suportam (ex: chips de codificação por hardware da GPU via `VideoEncoder.isConfigSupported`, ou suporte a `SharedArrayBuffer` para multi-threading).
2. **Ranqueamento por Performance (`speedScore`):** Múltiplos motores concorrentes para a mesma conversão são ordenados do mais rápido ao mais lento.
3. **Decisão Explícita do Usuário (Sem Fallbacks Silenciosos):** Se um motor falhar durante a execução, o erro é reportado explicitamente com o nome do motor, permitindo ao usuário decidir se deseja alternar para outro motor compatível.

---

## 2. Tipagens e Definição da Interface

A definição central reside em `src/shared/types/module.ts`.

### 2.1. Tipos de Aceleração e Pontuação de Performance

```typescript
export type AccelerationType = 'gpu' | 'cpu-multithread' | 'cpu-singlethread' | 'instant-copy';

export interface ConversionRule {
  from: string[]; // Tipos de origem (ex: ['.mp4', '.m4v'] ou wildcards 'audio/*')
  to: string[];   // Extensões de destino (ex: ['.webm', '.gif'])
  lossy?: boolean;
  
  /**
   * Pontuação de velocidade específica desta regra (1 a 100).
   * - 95-100: Aceleração direta por hardware (GPU/NVENC) ou cópia direta de stream (Remux).
   * - 70-85: Processamento multi-threaded em CPU (todos os núcleos via pthreads).
   * - 30-50: Processamento single-threaded em CPU.
   */
  speedScore?: number;
  
  /** Tier de aceleração utilizado */
  acceleration?: AccelerationType;
  
  /** Descrição técnica curta exibida na UI */
  performanceNotes?: string;
}
```

### 2.2. Sondagem de Capacidades do Hardware (`CapabilityCheckContext`)

```typescript
export interface CapabilityCheckContext {
  sourceExt?: string;
  targetFormat?: string;
  mimeType?: string;
}
```


### 2.3. O Manifesto do Módulo (`ModuleManifest`)

```typescript
export interface ModuleManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  category: 'video' | 'audio' | 'document' | 'image';
  /** Regras de conversão suportadas (usadas na resolução dinâmica de rotas e catálogo) */
  supportedConversions: ConversionRule[];
  /**
   * Modificadores da Pilha de Modificadores (Modifier Stack) que este motor suporta aplicar.
   * Inversão de Controle (IoC): O motor declara explicitamente suas capacidades.
   * Modificadores omitidos são considerados incompatíveis pelo orquestrador, alertando na UI.
   */
  supportedModifiers?: ModifierCategoryId[];
  inputs: PortDefinition[];
  outputs: PortDefinition[];
}
```

### 2.4. A Interface `IModule`

```typescript
export interface IModule {
  manifest: ModuleManifest;
  /**
   * Sondagem assíncrona de compatibilidade de hardware/browser.
   * Se retornar false, o motor não será exibido nem sugerido para o usuário.
   */
  isSupported?: (context?: CapabilityCheckContext) => Promise<boolean> | boolean;
  execute: (
    inputs: Record<string, unknown>,
    context: ExecutionContext
  ) => Promise<Record<string, unknown>>;
}
```

---

## 3. Resolução e Filtro de Motores Compatíveis

Quando o usuário seleciona um formato de origem e de destino (ex: `MP4 → WebM`), o sistema invoca:

```typescript
resolveAvailableEngines(sourceExt: string, targetExt: string, mimeType?: string): Promise<EngineOption[]>
```

1. **Casamento de Regras:** O `ModuleRegistry` verifica quais regras declaram suporte a `from → to`.
2. **Sondagem de Hardware em Tempo Real:** Para cada motor compatível, invoca `await module.isSupported(...)`:
   - Para `mp4-muxer` e `webm-muxer`: Verifica se `VideoEncoder.isConfigSupported` confirma suporte acelerado por hardware para o codec destino (H.264 ou VP9). Se a GPU do usuário não possuir o chip codificador, o motor é descartado silenciosamente.
   - Para `ffmpeg-core-mt`: Verifica se o navegador possui `SharedArrayBuffer` e isolamento COOP/COEP (`crossOriginIsolated`). Se não possuir, o motor multi-thread é descartado.
3. **Ordenação por Performance:** Os motores aprovados no teste de hardware são ordenados decrescentemente pelo `speedScore`.
4. **Recomendação Padrão:** O primeiro motor da lista recebe `isRecommended = true`.

---

## 4. Política de Tratamento de Erros (Zero Fallback Oculto)

Conforme a diretriz de transparência técnica do FileTools:
1. O orquestrador `WorkerManager` executa estritamente o motor selecionado pelo usuário.
2. Em caso de falha de execução:
   - O erro é lançado contendo a mensagem técnica real.
   - A interface (`ConvertPanel.tsx`) indica claramente:
     `"Falha na conversão com o motor {Nome do Motor}"`
   - O sistema lista diretamente no cartão de erro os outros motores compatíveis disponíveis (ex: `[🚀 Usar FFmpeg Multi-Thread]`, `[💻 Usar FFmpeg WASM]`), conferindo total controle de decisão ao usuário.

---

## 5. Inversão de Controle: Capacidades de Modificadores no Manifesto

Para evitar orquestradores centrais com acoplamento indevido e listas hardcoded de `if/else`, a capacidade de aplicar modificadores da **Pilha de Modificadores (Modifier Stack)** pertence exclusivamente a cada motor:

1. **Declaração no Manifesto:** Cada motor declara no array `supportedModifiers` exatamente os modificadores que ele é capaz de honrar durante o processamento (ex: `['audio_tracks', 'subtitles']` para cópia direta de stream; ou a lista completa de transcodificação para FFmpeg).
2. **Orquestrador Isento de Regras Hardcoded:** A verificação de compatibilidade em `src/modules/engineCapabilities.ts` é uma função pura e direta:
   ```typescript
   return !moduleInstance.manifest.supportedModifiers.includes(modifierId);
   ```
3. **Escalabilidade Garantida:** Motores e modificadores futuros podem ser criados sem que seja necessário tocar no orquestrador central.
