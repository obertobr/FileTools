export type AIBackendType = 'webgpu' | 'wasm';
export type AITaskCategory = 'image' | 'audio' | 'speech' | 'document';

export interface AIModelCatalogEntry {
  id: string;
  name: string;
  shortName: string;
  task: string;
  category: AITaskCategory;
  hfModelId: string;
  estimatedSizeMB: number;
  recommendedBackend: AIBackendType;
  description: string;
  inputExtensions: string[];
  outputExtensions: string[];
}

export interface AIHardwareCapabilities {
  backend: AIBackendType;
  webgpuAvailable: boolean;
  simdSupported: boolean;
  adapterDescription?: string;
}

export interface CachedModelRecord {
  modelId: string;
  hfModelId: string;
  cachedAt: string;
  sizeBytes: number;
}

const AI_CACHE_STORE_KEY = 'filetools_ai_model_registry_v1';
const AI_CACHE_BUCKET_NAME = 'filetools-ai-models-v1';

export const AI_MODELS_CATALOG: AIModelCatalogEntry[] = [
  {
    id: 'ai-bg-remove',
    name: 'Removedor de Fundo (RMBG-1.4)',
    shortName: 'Remover Fundo',
    task: 'image-segmentation',
    category: 'image',
    hfModelId: 'briaai/RMBG-1.4',
    estimatedSizeMB: 176,
    recommendedBackend: 'webgpu',
    description: 'Segmenta o assunto principal e remove o fundo gerando PNG/WebP com canal alfa transparente.',
    inputExtensions: ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.qoi', '.tiff'],
    outputExtensions: ['.png', '.webp'],
  },
  {
    id: 'ai-whisper-stt',
    name: 'Whisper Speech-to-Text & Legendas',
    shortName: 'Transcrição / Legendas',
    task: 'automatic-speech-recognition',
    category: 'speech',
    hfModelId: 'Xenova/whisper-small',
    estimatedSizeMB: 244,
    recommendedBackend: 'webgpu',
    description: 'Transcreve áudios e vídeos localmente com timestamps precisos para SRT, VTT, TXT ou JSON.',
    inputExtensions: ['.wav', '.mp3', '.m4a', '.ogg', '.flac', '.mp4', '.mkv', '.webm', '.mov'],
    outputExtensions: ['.srt', '.vtt', '.txt', '.json'],
  },
  {
    id: 'ai-diction-coach',
    name: 'Avaliador de Dicção & Oratória',
    shortName: 'Avaliar Dicção',
    task: 'speech-prosody-analysis',
    category: 'speech',
    hfModelId: 'filetools/acoustic-diction-v1',
    estimatedSizeMB: 48,
    recommendedBackend: 'wasm',
    description: 'Analisa velocidade (PPM), pausas excessivas, nitidez articulatória, SNR e fidelidade a roteiro.',
    inputExtensions: ['.wav', '.mp3', '.ogg', '.m4a', '.webm'],
    outputExtensions: ['.json', '.md'],
  },
  {
    id: 'ai-tts-kokoro',
    name: 'Kokoro-82M Neural Text-to-Speech',
    shortName: 'Texto para Voz (TTS)',
    task: 'text-to-speech',
    category: 'speech',
    hfModelId: 'onnx-community/Kokoro-82M-v1.0-ONNX',
    estimatedSizeMB: 92,
    recommendedBackend: 'webgpu',
    description: 'Sintetiza narração natural a partir de texto ou arquivos TXT/MD para áudio WAV ou MP3.',
    inputExtensions: ['.txt', '.md'],
    outputExtensions: ['.wav', '.mp3'],
  },
  {
    id: 'ai-upscaler',
    name: 'Super-Resolução 2x / 4x (Swin2SR)',
    shortName: 'Upscaler IA',
    task: 'image-to-image',
    category: 'image',
    hfModelId: 'Xenova/swin2SR-classical-sr-x2-64',
    estimatedSizeMB: 64,
    recommendedBackend: 'webgpu',
    description: 'Amplia imagens em 2x ou 4x preservando bordas, nitidez e detalhes sem serrilhado.',
    inputExtensions: ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.qoi'],
    outputExtensions: ['.png', '.webp', '.jpg'],
  },
  {
    id: 'ai-ocr',
    name: 'OCR Local Multi-Idiomas (TrOCR / Layout)',
    shortName: 'Extrair Texto (OCR)',
    task: 'image-to-text',
    category: 'document',
    hfModelId: 'Xenova/trocr-base-printed',
    estimatedSizeMB: 120,
    recommendedBackend: 'wasm',
    description: 'Reconhece texto em capturas de tela, scans e PDFs rasterizados diretamente no navegador.',
    inputExtensions: ['.png', '.jpg', '.jpeg', '.webp', '.tiff', '.tif', '.pdf'],
    outputExtensions: ['.txt', '.md', '.json'],
  },
  {
    id: 'ai-audio-denoise',
    name: 'Removedor de Ruído Vocal (RNNoise WASM)',
    shortName: 'Limpar Áudio',
    task: 'audio-enhancement',
    category: 'audio',
    hfModelId: 'filetools/rnnoise-spectral-gate-v1',
    estimatedSizeMB: 12,
    recommendedBackend: 'wasm',
    description: 'Remove chiado de fundo, zumbido elétrico (hum 60Hz) e ruído ambiente preservando a voz.',
    inputExtensions: ['.wav', '.mp3', '.ogg', '.flac'],
    outputExtensions: ['.wav'],
  },
  {
    id: 'ai-depth-map',
    name: 'Mapa de Profundidade & Bokeh (Depth-Anything V2)',
    shortName: 'Profundidade / Bokeh',
    task: 'depth-estimation',
    category: 'image',
    hfModelId: 'onnx-community/depth-anything-v2-small',
    estimatedSizeMB: 98,
    recommendedBackend: 'webgpu',
    description: 'Estima mapa de profundidade Z monocular em escala de cinza ou aplica efeito Bokeh realista.',
    inputExtensions: ['.png', '.jpg', '.jpeg', '.webp', '.qoi'],
    outputExtensions: ['.png'],
  },
];

let cachedHardware: AIHardwareCapabilities | null = null;
const memoryCacheRegistry = new Map<string, CachedModelRecord>();

function detectWasmSimd(): boolean {
  try {
    if (typeof WebAssembly?.validate !== 'function') return false;
    // Minimal SIMD module (v128 type test)
    const simdProbe = new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
      0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7b,
    ]);
    return WebAssembly.validate(simdProbe);
  } catch {
    return false;
  }
}

export async function detectAIBackend(): Promise<AIHardwareCapabilities> {
  if (cachedHardware) return cachedHardware;

  const simdSupported = detectWasmSimd();
  let webgpuAvailable = false;
  let adapterDescription: string | undefined;

  try {
    const nav = typeof navigator !== 'undefined' ? (navigator as unknown as { gpu?: { requestAdapter?: () => Promise<{ name?: string; info?: { description?: string; vendor?: string } } | null> } }) : undefined;
    if (nav?.gpu?.requestAdapter) {
      const adapter = await nav.gpu.requestAdapter();
      if (adapter) {
        webgpuAvailable = true;
        adapterDescription = adapter.info?.description || adapter.info?.vendor || adapter.name || 'WebGPU Adapter';
      }
    }
  } catch {
    webgpuAvailable = false;
  }

  cachedHardware = {
    backend: webgpuAvailable ? 'webgpu' : 'wasm',
    webgpuAvailable,
    simdSupported,
    adapterDescription,
  };
  return cachedHardware;
}

export function getAIModelCatalogEntry(modelId: string): AIModelCatalogEntry | undefined {
  return AI_MODELS_CATALOG.find((m) => m.id === modelId);
}

function readRegistryMap(): Record<string, CachedModelRecord> {
  const result: Record<string, CachedModelRecord> = {};
  for (const [k, v] of memoryCacheRegistry.entries()) {
    result[k] = v;
  }
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(AI_CACHE_STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, CachedModelRecord>;
        Object.assign(result, parsed);
      }
    }
  } catch {
    // ignore storage access issues
  }
  return result;
}

function writeRegistryMap(map: Record<string, CachedModelRecord>): void {
  memoryCacheRegistry.clear();
  for (const [k, v] of Object.entries(map)) {
    memoryCacheRegistry.set(k, v);
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AI_CACHE_STORE_KEY, JSON.stringify(map));
    }
  } catch {
    // ignore quota errors
  }
}

export function markModelCached(modelId: string, sizeBytes?: number): void {
  const entry = getAIModelCatalogEntry(modelId);
  if (!entry) return;
  const map = readRegistryMap();
  map[modelId] = {
    modelId,
    hfModelId: entry.hfModelId,
    cachedAt: new Date().toISOString(),
    sizeBytes: sizeBytes ?? entry.estimatedSizeMB * 1024 * 1024,
  };
  writeRegistryMap(map);
}

export function listCachedModels(): CachedModelRecord[] {
  return Object.values(readRegistryMap());
}

export function isModelCached(modelId: string): boolean {
  const map = readRegistryMap();
  return Boolean(map[modelId]);
}

export async function deleteCachedModel(modelId: string): Promise<void> {
  const map = readRegistryMap();
  const entry = getAIModelCatalogEntry(modelId);
  delete map[modelId];
  writeRegistryMap(map);

  if (typeof caches !== 'undefined' && entry) {
    try {
      const cache = await caches.open(AI_CACHE_BUCKET_NAME);
      const keys = await cache.keys();
      await Promise.all(
        keys
          .filter((req) => req.url.includes(entry.hfModelId) || req.url.includes(modelId))
          .map((req) => cache.delete(req))
      );
    } catch {
      // ignore CacheStorage unavailability
    }
  }
}

export async function clearAllModelCaches(): Promise<void> {
  writeRegistryMap({});
  if (typeof caches !== 'undefined') {
    try {
      await caches.delete(AI_CACHE_BUCKET_NAME);
    } catch {
      // ignore
    }
  }
}

export function getTotalCachedBytes(): number {
  return listCachedModels().reduce((sum, item) => sum + (item.sizeBytes || 0), 0);
}
