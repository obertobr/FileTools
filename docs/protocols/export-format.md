# Protocolo: Formato de Exportação de Grafos (`export-format.md`)

**Status:** Rascunho / Arquitetura Futura  
**Extensão de Arquivo:** `.ftgraph` (JSON padronizado)

---

## 1. Visão Geral

O FileTools permitirá que os usuários salvem e compartilhem seus fluxos de trabalho e pipelines de conversão de nós. Um arquivo `.ftgraph` é um documento JSON declarativo e portátil que descreve a topologia visual do grafo, os parâmetros dos módulos e as conexões entre portas, sem depender de nenhuma infraestrutura de servidor.

---

## 2. Estrutura do Esquema JSON (`FileToolsGraphSchema`)

```json
{
  "$schema": "https://filetools.app/schemas/graph.v1.json",
  "version": "1.0.0",
  "metadata": {
    "title": "Extrair Áudio de Vídeos e Normalizar",
    "description": "Pipeline automatizada que extrai MP3 a 192k e gera WAV lossless.",
    "createdAt": "2026-09-03T17:00:00Z",
    "author": "LocalUser"
  },
  "viewport": {
    "x": 0,
    "y": 0,
    "zoom": 1.0
  },
  "nodes": [
    {
      "id": "node_input_1",
      "moduleId": "core-file-input",
      "position": { "x": 100, "y": 200 },
      "parameters": {
        "accepts": ["video/*", "audio/*"]
      }
    },
    {
      "id": "node_ffmpeg_1",
      "moduleId": "ffmpeg-core",
      "position": { "x": 450, "y": 200 },
      "parameters": {
        "targetFormat": ".mp3",
        "audioBitrate": "192k",
        "preset": "fast"
      }
    },
    {
      "id": "node_output_1",
      "moduleId": "core-file-output",
      "position": { "x": 800, "y": 200 },
      "parameters": {
        "namingPattern": "{name}_converted.{ext}"
      }
    }
  ],
  "edges": [
    {
      "id": "edge_1",
      "from": {
        "nodeId": "node_input_1",
        "portId": "file"
      },
      "to": {
        "nodeId": "node_ffmpeg_1",
        "portId": "file"
      }
    },
    {
      "id": "edge_2",
      "from": {
        "nodeId": "node_ffmpeg_1",
        "portId": "file"
      },
      "to": {
        "nodeId": "node_output_1",
        "portId": "file"
      }
    }
  ]
}
```

---

## 3. Regras de Compatibilidade e Validação

1. **Validação de Tipos de Portas:**
   Ao carregar um grafo, o motor valida se o `DataType` da porta de saída (`from.portId`) é estritamente compatível com a porta de entrada (`to.portId`). Portas de dados incompatíveis (ex: `string` conectada a `file_handle`) invalidam a aresta.
2. **Versão dos Módulos:**
   Se um nó referencia um módulo com versão desatualizada ou não instalada localmente, o grafo é renderizado em estado de alerta (`missing_module`), oferecendo ao usuário opção de substituição compatível.
3. **Segurança Client-Side:**
   Grafos importados não executam código arbitrário (`eval` ou scripts injetados). Todos os nós são instanciados exclusivamente a partir dos manifestos pré-registrados em `src/modules/registry.ts`.
