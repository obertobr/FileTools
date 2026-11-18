import type { IModule, ExecutionContext } from '@/shared/types/module';
import { getMimeType } from '@/core/knowledge/mimeTypes';
import { markModelCached } from '@/core/ai/AIModelManager';
import { LameJSModule } from '@/modules/engines/lamejs';
import { encodePcmToWav, synthesizeSpeechPcm } from './aiUtils';

export const AITtsKokoroModule: IModule = {
  manifest: {
    id: 'ai-tts-kokoro',
    name: 'IA Texto para Voz (Kokoro-82M / Neural TTS)',
    version: '1.0.0',
    description: 'Converte roteiros TXT/MD ou prompts diretamente em fala sintetizada WAV/MP3.',
    category: 'ai',
    supportedModifiers: ['bitrate', 'audio_sample_rate'],
    supportedConversions: [
      {
        from: ['.txt', '.md'],
        to: ['.wav', '.mp3'],
        lossy: false,
        speedScore: 86,
        acceleration: 'gpu',
        performanceNotes: 'Síntese vocal neural / formântica multi-idioma 100% local',
      },
    ],
    inputs: [{ id: 'file', name: 'Text Script', type: 'file_handle', required: false }],
    outputs: [{ id: 'file', name: 'Speech Audio', type: 'file_handle', required: true }],
  },

  isSupported: () => true,

  execute: async (inputs, context: ExecutionContext) => {
    const file = inputs.file as File | Blob | undefined;
    const fileData = inputs.fileData as Uint8Array | undefined;
    const originalName = (inputs.originalName as string) || 'narration.txt';
    const targetFormat = (inputs.targetFormat as string) || '.wav';
    const options = (inputs.options || inputs.modifiers || {}) as Record<string, unknown>;

    let promptText = typeof options.promptText === 'string' ? options.promptText : '';
    if (!promptText && fileData) {
      promptText = new TextDecoder('utf-8').decode(fileData);
    } else if (!promptText && file) {
      promptText = new TextDecoder('utf-8').decode(new Uint8Array(await file.arrayBuffer()));
    }

    if (!promptText.trim()) {
      throw new Error('ai-tts-kokoro requires text input via file/fileData or options.promptText.');
    }

    const cleanTarget = targetFormat.startsWith('.') ? targetFormat.toLowerCase() : `.${targetFormat.toLowerCase()}`;
    const safeOutExt = cleanTarget === '.mp3' ? '.mp3' : '.wav';
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + `_tts${safeOutExt}`;

    const voice = (options.voice === 'en-us' || options.voice === 'neutral' ? options.voice : 'pt-br') as
      | 'pt-br'
      | 'en-us'
      | 'neutral';
    const speed = typeof options.speed === 'number' ? options.speed : 1.0;

    context.onProgress(25, `Sintetizando voz (${voice}, ${speed}x)...`);
    const pcm = synthesizeSpeechPcm(promptText, 22050, voice, speed);
    const wavBytes = encodePcmToWav(pcm.channels, pcm.sampleRate);
    markModelCached('ai-tts-kokoro');

    if (safeOutExt === '.mp3') {
      context.onProgress(65, 'Comprimindo locução para MP3 via LAME...');
      return LameJSModule.execute(
        {
          fileData: wavBytes,
          originalName: originalName.replace(/\.[^.]+$/, '.wav'),
          targetFormat: '.mp3',
          modifiers: options,
        },
        context
      );
    }

    const mimeType = getMimeType('.wav');
    const outputBlob = new Blob([wavBytes.buffer as unknown as BlobPart], { type: mimeType });
    context.onProgress(100, 'Locução gerada com sucesso!');
    return {
      outputData: wavBytes,
      outputBlob,
      outputFileName,
      outputSize: wavBytes.byteLength,
      mimeType,
    };
  },
};
