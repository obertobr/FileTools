import type {
  FtGraphDocument,
  GraphNodeData,
  GraphNodeKind,
  ModularNodeExecutor,
} from '@/core/graph/types';
import { executeVideoToFrames } from './node-video-to-frames';
import { executeFramesToVideo } from './node-frames-to-video';
import { executePeriodicOverlay } from './node-video-periodic-overlay';
import { executeBurnSubtitles } from './node-burn-subtitles';
import { executeBatchProcessor } from './node-batch-processor';

export * from './nodeMediaUtils';
export * from './node-video-to-frames';
export * from './node-frames-to-video';
export * from './node-video-periodic-overlay';
export * from './node-burn-subtitles';
export * from './node-batch-processor';

export const MODULAR_NODE_EXECUTORS: Partial<Record<GraphNodeKind, ModularNodeExecutor>> = {
  'video-to-frames': executeVideoToFrames,
  'frames-to-video': executeFramesToVideo,
  'periodic-overlay': executePeriodicOverlay,
  'burn-subtitles': executeBurnSubtitles,
  'batch-processor': executeBatchProcessor,
};

export interface PaletteNodePreset {
  kind: GraphNodeKind;
  title: string;
  description: string;
  createData: () => GraphNodeData;
}

export const NODE_PALETTE_PRESETS: PaletteNodePreset[] = [
  {
    kind: 'input',
    title: 'Arquivo de Entrada',
    description: 'Carrega vídeo, imagem, áudio ou documento para iniciar o fluxo.',
    createData: () => ({
      kind: 'input',
      label: 'Entrada (Arquivo)',
      config: {},
      inputs: [],
      outputs: [{ id: 'out', label: 'Arquivo', type: 'file' }],
    }),
  },
  {
    kind: 'converter',
    title: 'Conversor Universal',
    description: 'Executa qualquer motor (FFmpeg, jSquash, ImageMagick, 7z, etc.).',
    createData: () => ({
      kind: 'converter',
      label: 'Conversor de Formato',
      moduleId: 'jsquash',
      targetFormat: '.webp',
      config: { qualityPreset: 'balanced' },
      inputs: [{ id: 'in', label: 'Entrada', type: 'file', required: true }],
      outputs: [{ id: 'out', label: 'Convertido', type: 'file' }],
    }),
  },
  {
    kind: 'ai',
    title: 'IA Local (WebGPU / WASM)',
    description: 'Aplica uma das 8 IAs locais (Remover Fundo, Whisper, TTS, Upscaler, etc.).',
    createData: () => ({
      kind: 'ai',
      label: 'IA Local',
      moduleId: 'ai-bg-remove',
      targetFormat: '.png',
      config: { scaleFactor: 2, chromaTolerance: 42 },
      inputs: [{ id: 'in', label: 'Mídia', type: 'file', required: true }],
      outputs: [{ id: 'out', label: 'Saída IA', type: 'file' }],
    }),
  },
  {
    kind: 'video-to-frames',
    title: 'Vídeo → Frames (Lote)',
    description: 'Extrai sequência de quadros PNG em lote a partir de um vídeo.',
    createData: () => ({
      kind: 'video-to-frames',
      label: 'Vídeo → Frames',
      config: { fps: 2, maxFrames: 10 },
      inputs: [{ id: 'video', label: 'Vídeo', type: 'video', required: true }],
      outputs: [{ id: 'frames', label: 'Lote Frames', type: 'batch' }],
    }),
  },
  {
    kind: 'batch-processor',
    title: 'Processador em Lote',
    description: 'Executa IA ou conversor em cada item de um lote (batch<T>).',
    createData: () => ({
      kind: 'batch-processor',
      label: 'Processar Lote (IA/Conv)',
      moduleId: 'ai-bg-remove',
      targetFormat: '.png',
      config: { moduleId: 'ai-bg-remove', targetFormat: '.png' },
      inputs: [{ id: 'batch', label: 'Lote Entrada', type: 'batch', required: true }],
      outputs: [{ id: 'batch', label: 'Lote Saída', type: 'batch' }],
    }),
  },
  {
    kind: 'frames-to-video',
    title: 'Frames → Vídeo',
    description: 'Remonta uma sequência em lote de quadros em vídeo MP4 ou GIF.',
    createData: () => ({
      kind: 'frames-to-video',
      label: 'Frames → Vídeo',
      targetFormat: '.mp4',
      config: { fps: 4, targetFormat: '.mp4' },
      inputs: [{ id: 'frames', label: 'Lote Frames', type: 'batch', required: true }],
      outputs: [{ id: 'video', label: 'Vídeo Final', type: 'video' }],
    }),
  },
  {
    kind: 'periodic-overlay',
    title: 'Overlay Periódico (Vídeo + Img)',
    description: 'Sobrepõe uma imagem no vídeo a cada N segundos por D segundos.',
    createData: () => ({
      kind: 'periodic-overlay',
      label: 'Overlay Periódico',
      targetFormat: '.mp4',
      config: {
        intervalSeconds: 5,
        durationSeconds: 1,
        x: 16,
        y: 16,
        opacity: 1,
        fps: 2,
        targetFormat: '.mp4',
      },
      inputs: [
        { id: 'video', label: 'Vídeo', type: 'video', required: true },
        { id: 'image', label: 'Imagem', type: 'image', required: true },
      ],
      outputs: [{ id: 'video', label: 'Vídeo Composto', type: 'video' }],
    }),
  },
  {
    kind: 'burn-subtitles',
    title: 'Queimar Legendas (Burn-in)',
    description: 'Mescla legendas SRT/VTT diretamente sobre o stream de vídeo.',
    createData: () => ({
      kind: 'burn-subtitles',
      label: 'Burn-in Legendas',
      config: {},
      inputs: [
        { id: 'video', label: 'Vídeo', type: 'video', required: true },
        { id: 'subtitle', label: 'Legenda SRT/VTT', type: 'subtitle', required: true },
      ],
      outputs: [{ id: 'video', label: 'Vídeo Legendado', type: 'video' }],
    }),
  },
  {
    kind: 'output',
    title: 'Saída / Download',
    description: 'Coleta o resultado final do pipeline para download imediato.',
    createData: () => ({
      kind: 'output',
      label: 'Saída Final',
      config: {},
      inputs: [{ id: 'in', label: 'Resultado', type: 'file', required: true }],
      outputs: [],
    }),
  },
];

export interface GraphTemplatePreset {
  id: string;
  name: string;
  description: string;
  graph: FtGraphDocument;
}

const nowIso = () => new Date().toISOString();

export const GRAPH_TEMPLATES: GraphTemplatePreset[] = [
  {
    id: 'periodic-overlay-5s',
    name: 'Vídeo + Overlay Periódico (5s / 1s)',
    description: 'Recebe um vídeo e uma imagem e insere a imagem a cada 5s durante 1s.',
    graph: {
      version: '1.0.0',
      metadata: { name: 'Overlay Periódico 5s/1s', createdAt: nowIso(), updatedAt: nowIso() },
      nodes: [
        {
          id: 'in-video',
          type: 'customNode',
          position: { x: 40, y: 60 },
          data: {
            kind: 'input',
            label: 'Vídeo Base',
            config: { accept: 'video/*,.mp4,.webm,.gif' },
            inputs: [],
            outputs: [{ id: 'out', label: 'Vídeo', type: 'video' }],
          },
        },
        {
          id: 'in-image',
          type: 'customNode',
          position: { x: 40, y: 260 },
          data: {
            kind: 'input',
            label: 'Imagem / Marca',
            config: { accept: 'image/*,.png,.jpg,.webp,.qoi' },
            inputs: [],
            outputs: [{ id: 'out', label: 'Imagem', type: 'image' }],
          },
        },
        {
          id: 'overlay-node',
          type: 'customNode',
          position: { x: 360, y: 140 },
          data: {
            kind: 'periodic-overlay',
            label: 'Overlay a cada 5s por 1s',
            targetFormat: '.mp4',
            config: {
              intervalSeconds: 5,
              durationSeconds: 1,
              x: 16,
              y: 16,
              opacity: 1,
              fps: 2,
              targetFormat: '.mp4',
            },
            inputs: [
              { id: 'video', label: 'Vídeo', type: 'video', required: true },
              { id: 'image', label: 'Imagem', type: 'image', required: true },
            ],
            outputs: [{ id: 'video', label: 'Vídeo Composto', type: 'video' }],
          },
        },
        {
          id: 'out-final',
          type: 'customNode',
          position: { x: 700, y: 150 },
          data: {
            kind: 'output',
            label: 'Download Vídeo',
            config: {},
            inputs: [{ id: 'in', label: 'Vídeo', type: 'video', required: true }],
            outputs: [],
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'in-video', sourceHandle: 'out', target: 'overlay-node', targetHandle: 'video' },
        { id: 'e2', source: 'in-image', sourceHandle: 'out', target: 'overlay-node', targetHandle: 'image' },
        { id: 'e3', source: 'overlay-node', sourceHandle: 'video', target: 'out-final', targetHandle: 'in' },
      ],
    },
  },
  {
    id: 'video-frames-ai-bg',
    name: 'Vídeo → Frames → IA Remover Fundo (Lote) → Vídeo',
    description: 'Separa vídeo em quadros, remove o fundo de cada frame com IA em lote e remonta o vídeo.',
    graph: {
      version: '1.0.0',
      metadata: { name: 'Vídeo -> Frames -> IA Fundo -> Vídeo', createdAt: nowIso(), updatedAt: nowIso() },
      nodes: [
        {
          id: 'in-video',
          type: 'customNode',
          position: { x: 30, y: 140 },
          data: {
            kind: 'input',
            label: 'Vídeo Entrada',
            config: { accept: 'video/*,.mp4,.gif' },
            inputs: [],
            outputs: [{ id: 'out', label: 'Vídeo', type: 'video' }],
          },
        },
        {
          id: 'v2f',
          type: 'customNode',
          position: { x: 290, y: 140 },
          data: {
            kind: 'video-to-frames',
            label: 'Vídeo → Frames',
            config: { fps: 2, maxFrames: 6 },
            inputs: [{ id: 'video', label: 'Vídeo', type: 'video', required: true }],
            outputs: [{ id: 'frames', label: 'Lote Frames', type: 'batch' }],
          },
        },
        {
          id: 'batch-ai',
          type: 'customNode',
          position: { x: 560, y: 140 },
          data: {
            kind: 'batch-processor',
            label: 'IA Remover Fundo (Lote)',
            moduleId: 'ai-bg-remove',
            targetFormat: '.png',
            config: { moduleId: 'ai-bg-remove', targetFormat: '.png' },
            inputs: [{ id: 'batch', label: 'Lote', type: 'batch', required: true }],
            outputs: [{ id: 'batch', label: 'Lote RGBA', type: 'batch' }],
          },
        },
        {
          id: 'f2v',
          type: 'customNode',
          position: { x: 840, y: 140 },
          data: {
            kind: 'frames-to-video',
            label: 'Frames → GIF/Vídeo',
            targetFormat: '.gif',
            config: { fps: 2, targetFormat: '.gif' },
            inputs: [{ id: 'frames', label: 'Lote RGBA', type: 'batch', required: true }],
            outputs: [{ id: 'video', label: 'Vídeo', type: 'video' }],
          },
        },
        {
          id: 'out-final',
          type: 'customNode',
          position: { x: 1110, y: 140 },
          data: {
            kind: 'output',
            label: 'Download Saída',
            config: {},
            inputs: [{ id: 'in', label: 'Vídeo', type: 'video', required: true }],
            outputs: [],
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'in-video', sourceHandle: 'out', target: 'v2f', targetHandle: 'video' },
        { id: 'e2', source: 'v2f', sourceHandle: 'frames', target: 'batch-ai', targetHandle: 'batch' },
        { id: 'e3', source: 'batch-ai', sourceHandle: 'batch', target: 'f2v', targetHandle: 'frames' },
        { id: 'e4', source: 'f2v', sourceHandle: 'video', target: 'out-final', targetHandle: 'in' },
      ],
    },
  },
  {
    id: 'whisper-burn-subtitles',
    name: 'Vídeo → Whisper Legendas → Burn-in',
    description: 'Gera legendas SRT automaticamente com Whisper local e grava no vídeo.',
    graph: {
      version: '1.0.0',
      metadata: { name: 'Whisper Legendas + Burn-in', createdAt: nowIso(), updatedAt: nowIso() },
      nodes: [
        {
          id: 'in-media',
          type: 'customNode',
          position: { x: 40, y: 130 },
          data: {
            kind: 'input',
            label: 'Áudio / Vídeo',
            config: {},
            inputs: [],
            outputs: [{ id: 'out', label: 'Arquivo', type: 'file' }],
          },
        },
        {
          id: 'ai-stt',
          type: 'customNode',
          position: { x: 330, y: 250 },
          data: {
            kind: 'ai',
            label: 'IA Whisper (.srt)',
            moduleId: 'ai-whisper-stt',
            targetFormat: '.srt',
            config: {},
            inputs: [{ id: 'in', label: 'Mídia', type: 'file', required: true }],
            outputs: [{ id: 'out', label: 'Legenda SRT', type: 'subtitle' }],
          },
        },
        {
          id: 'burn',
          type: 'customNode',
          position: { x: 640, y: 130 },
          data: {
            kind: 'burn-subtitles',
            label: 'Queimar Legendas',
            config: {},
            inputs: [
              { id: 'video', label: 'Vídeo', type: 'video', required: true },
              { id: 'subtitle', label: 'Legenda', type: 'subtitle', required: true },
            ],
            outputs: [{ id: 'video', label: 'Legendado', type: 'video' }],
          },
        },
        {
          id: 'out-sub',
          type: 'customNode',
          position: { x: 940, y: 140 },
          data: {
            kind: 'output',
            label: 'Download Legendado',
            config: {},
            inputs: [{ id: 'in', label: 'Vídeo', type: 'video', required: true }],
            outputs: [],
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'in-media', sourceHandle: 'out', target: 'ai-stt', targetHandle: 'in' },
        { id: 'e2', source: 'in-media', sourceHandle: 'out', target: 'burn', targetHandle: 'video' },
        { id: 'e3', source: 'ai-stt', sourceHandle: 'out', target: 'burn', targetHandle: 'subtitle' },
        { id: 'e4', source: 'burn', sourceHandle: 'video', target: 'out-sub', targetHandle: 'in' },
      ],
    },
  },
  {
    id: 'ai-upscale-webp',
    name: 'Imagem → Upscaler IA 2x → WebP Otimizado',
    description: 'Amplia resolução 2x com IA local e converte para WebP compacto.',
    graph: {
      version: '1.0.0',
      metadata: { name: 'Upscaler 2x + WebP', createdAt: nowIso(), updatedAt: nowIso() },
      nodes: [
        {
          id: 'in-img',
          type: 'customNode',
          position: { x: 40, y: 140 },
          data: {
            kind: 'input',
            label: 'Imagem Entrada',
            config: { accept: 'image/*' },
            inputs: [],
            outputs: [{ id: 'out', label: 'Imagem', type: 'image' }],
          },
        },
        {
          id: 'ai-up',
          type: 'customNode',
          position: { x: 330, y: 140 },
          data: {
            kind: 'ai',
            label: 'IA Upscaler 2x',
            moduleId: 'ai-upscaler',
            targetFormat: '.png',
            config: { scaleFactor: 2 },
            inputs: [{ id: 'in', label: 'Imagem', type: 'image', required: true }],
            outputs: [{ id: 'out', label: 'PNG 2x', type: 'image' }],
          },
        },
        {
          id: 'conv-webp',
          type: 'customNode',
          position: { x: 640, y: 140 },
          data: {
            kind: 'converter',
            label: 'jSquash → WebP',
            moduleId: 'jsquash',
            targetFormat: '.webp',
            config: { qualityPreset: 'balanced' },
            inputs: [{ id: 'in', label: 'Imagem', type: 'image', required: true }],
            outputs: [{ id: 'out', label: 'WebP', type: 'image' }],
          },
        },
        {
          id: 'out-webp',
          type: 'customNode',
          position: { x: 940, y: 140 },
          data: {
            kind: 'output',
            label: 'Saída Final',
            config: {},
            inputs: [{ id: 'in', label: 'Imagem', type: 'image', required: true }],
            outputs: [],
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'in-img', sourceHandle: 'out', target: 'ai-up', targetHandle: 'in' },
        { id: 'e2', source: 'ai-up', sourceHandle: 'out', target: 'conv-webp', targetHandle: 'in' },
        { id: 'e3', source: 'conv-webp', sourceHandle: 'out', target: 'out-webp', targetHandle: 'in' },
      ],
    },
  },
];
