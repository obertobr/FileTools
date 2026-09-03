# Protocolo: Comunicação entre Nós (`node-communication.md`)

**Status:** Rascunho / Arquitetura Futura  
**Contexto:** Preparação arquitetural para o sistema de Grafo e Encadeamento de Nós (Pipeline Visual).

---

## 1. Visão Geral

No estágio futuro do FileTools, os usuários poderão conectar múltiplos nós de transformação em um grafo direcionado acíclico (DAG). Por exemplo:
`[Input MP4]` ──> `[FFmpeg: Extrair Áudio MP3]` ──> `[Audio Normalizer]` ──> `[Output WAV]`

Para que essa comunicação seja viável no ambiente restrito do navegador sem causar esgotamento de memória RAM (OOM - Out of Memory Crashes), os nós **nunca transferem buffers completos diretamente entre si na memória**. Toda transferência de dados pesados ocorre através do **Origin Private File System (OPFS)**.

---

## 2. Topologia e Isolamento no OPFS

Cada nó dentro de um grafo de execução opera sob uma pasta isolada na sessão:

```text
/sessions/{sessionId}/{graphExecutionId}/
    ├── nodes/
    │   ├── node-01-input/
    │   │   └── raw_file.mp4
    │   ├── node-02-ffmpeg/
    │   │   └── audio_extracted.mp3
    │   └── node-03-wav/
    │       └── final_normalized.wav
```

### 2.1. Princípio de Ponteiros OPFS (Zero-Copy Transfer)
1. O Nó $A$ produz um artefato no seu workspace OPFS.
2. O Nó $A$ finaliza e retorna para o Grafo Orchestrator apenas o manipulador de arquivo (`FileSystemFileHandle`) ou o caminho relativo `/sessions/{sessionId}/{graphId}/nodes/node-01/file.mp3`.
3. O Grafo Orchestrator entrega o `FileSystemFileHandle` como entrada para as portas do Nó $B$.
4. O Nó $B$ abre um `FileSystemSyncAccessHandle` ou lê em streams conforme a necessidade do seu motor Wasm.

---

## 3. Protocolo de Mensagens entre Nós e Orquestrador

A comunicação entre a thread orquestradora do grafo e os nós executores (Web Workers) utiliza mensagens estruturadas baseadas em eventos:

```typescript
export type NodeExecutionState = 'idle' | 'waiting_inputs' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface NodeMessagePayload {
  graphId: string;
  nodeId: string;
  timestamp: number;
}

export interface NodeProgressMessage extends NodeMessagePayload {
  type: 'PROGRESS';
  progress: number; // 0-100% individual deste nó
  stageDescription: string;
}

export interface NodeOutputReadyMessage extends NodeMessagePayload {
  type: 'OUTPUT_READY';
  outputs: Record<string, {
    type: 'file_handle' | 'primitive';
    handle?: FileSystemFileHandle;
    value?: unknown;
  }>;
}

export interface NodeErrorMessage extends NodeMessagePayload {
  type: 'ERROR';
  error: string;
  recoverable: boolean;
}
```

---

## 4. Agregação de Progresso e Cancelamento

1. **Progresso Global Ponderado:** O orquestrador calcula o progresso total do grafo considerando o peso de cada nó na cadeia (ex: transcodificação de vídeo tem peso 70%, conversão de metadados tem peso 10%).
2. **Cancelamento em Cascata:** Se um nó falhar ou for cancelado pelo usuário:
   - Um sinal `AbortSignal` é propagado imediatamente para todos os nós filhos.
   - O orquestrador envia comando de término para os workers ativos.
   - A pasta da execução `{graphExecutionId}` no OPFS é limpa imediatamente pelo `OPFSManager`.
