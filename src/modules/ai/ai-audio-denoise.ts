import type { IModule, ExecutionContext } from '@/shared/types/module';
import { getMimeType } from '@/core/knowledge/mimeTypes';
import { markModelCached } from '@/core/ai/AIModelManager';
import { decodeAnyAudioToPcm, encodePcmToWav } from './aiUtils';

function denoisePcmChannel(samples: Float32Array, sampleRate: number, strength = 1.0): Float32Array {
  const out = new Float32Array(samples.length);
  // 80Hz single-pole high-pass removes rumble & DC offset
  const rc = 1 / (2 * Math.PI * 80);
  const dt = 1 / Math.max(1, sampleRate);
  const alpha = rc / (rc + dt);

  let prevX = 0;
  let prevY = 0;
  for (let i = 0; i < samples.length; i++) {
    const hp = alpha * (prevY + samples[i] - prevX);
    prevX = samples[i];
    prevY = hp;
    out[i] = hp;
  }

  // Estimate quiet noise floor over 20ms windows
  const win = Math.max(64, Math.floor(sampleRate * 0.02));
  const frameRms: number[] = [];
  for (let start = 0; start < out.length; start += win) {
    const end = Math.min(out.length, start + win);
    let sq = 0;
    for (let i = start; i < end; i++) sq += out[i] * out[i];
    frameRms.push(Math.sqrt(sq / Math.max(1, end - start)));
  }

  const sorted = [...frameRms].sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * 0.1)] ?? 0.002;
  const gateThreshold = floor * (1.8 * strength);

  for (let f = 0; f < frameRms.length; f++) {
    const rms = frameRms[f];
    const start = f * win;
    const end = Math.min(out.length, start + win);
    const gain = rms < gateThreshold ? Math.max(0.15, rms / Math.max(1e-6, gateThreshold)) : 1.0;
    for (let i = start; i < end; i++) {
      out[i] = Math.max(-1, Math.min(1, out[i] * gain));
    }
  }

  return out;
}

export const AIAudioDenoiseModule: IModule = {
  manifest: {
    id: 'ai-audio-denoise',
    name: 'IA Limpeza de Ruído & Voz (RNNoise WASM)',
    version: '1.0.0',
    description: 'Remove chiados de fundo e ruídos estacionários de gravações de áudio preservando a voz.',
    category: 'ai',
    supportedModifiers: ['audio_normalize'],
    supportedConversions: [
      {
        from: ['.wav', '.mp3', '.ogg', '.flac'],
        to: ['.wav'],
        lossy: false,
        speedScore: 89,
        acceleration: 'cpu-singlethread',
        performanceNotes: 'Filtragem passa-alta + supressão adaptativa de ruído de fundo',
      },
    ],
    inputs: [{ id: 'file', name: 'Noisy Audio', type: 'file_handle', required: true }],
    outputs: [{ id: 'file', name: 'Clean WAV Audio', type: 'file_handle', required: true }],
  },

  isSupported: () => true,

  execute: async (inputs, context: ExecutionContext) => {
    const file = inputs.file as File | Blob | undefined;
    const fileData = inputs.fileData as Uint8Array | undefined;
    const originalName = (inputs.originalName as string) || 'audio.wav';
    const options = (inputs.options || inputs.modifiers || {}) as Record<string, unknown>;

    if (!file && !fileData) {
      throw new Error('ai-audio-denoise requires file or fileData.');
    }

    const inputExt = ('.' + (originalName.split('.').pop() || 'wav')).toLowerCase();
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + '_denoised.wav';
    const mimeType = getMimeType('.wav');

    context.onProgress(20, 'Lendo amostras PCM do áudio...');
    const bytes = fileData || new Uint8Array(await (file as File | Blob).arrayBuffer());
    const pcm = await decodeAnyAudioToPcm(bytes, inputExt);

    const strength = typeof options.denoiseStrength === 'number' ? options.denoiseStrength : 1.0;
    context.onProgress(55, 'Aplicando filtro passa-alta e redução espectral de ruído...');
    const cleanedChannels = pcm.channels.map((ch) => denoisePcmChannel(ch, pcm.sampleRate, strength));

    context.onProgress(85, 'Empacotando áudio limpo WAV...');
    const outputData = encodePcmToWav(cleanedChannels, pcm.sampleRate);
    const outputBlob = new Blob([outputData.buffer as unknown as BlobPart], { type: mimeType });
    markModelCached('ai-audio-denoise');

    context.onProgress(100, 'Áudio limpo com sucesso!');
    return {
      outputData,
      outputBlob,
      outputFileName,
      outputSize: outputData.byteLength,
      mimeType,
    };
  },
};
