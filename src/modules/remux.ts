/**
 * src/modules/remux.ts
 *
 * Ultra-fast Stream Copy (Remuxing) Engine.
 * Copies video and audio packets directly between containers (e.g. MKV <-> MP4)
 * without re-encoding a single frame. Instantaneous and 100% lossless.
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import type { IModule, ExecutionContext } from '@/shared/types/module';

let remuxFFmpegInstance: FFmpeg | null = null;
let remuxLoaded = false;

async function getRemuxFFmpeg(context: ExecutionContext): Promise<FFmpeg> {
  if (remuxFFmpegInstance && remuxLoaded) return remuxFFmpegInstance;

  remuxFFmpegInstance = new FFmpeg();

  remuxFFmpegInstance.on('log', ({ message }) => {
    context.onLog(`[Remux] ${message}`);
  });

  context.onLog('[Remux] Inicializando motor de cópia direta de stream...');
  context.onProgress(0, 'Carregando motor de remuxing...');

  const origin = typeof self !== 'undefined' && self.location ? self.location.origin : '';
  const coreURL = await toBlobURL(`${origin}/ffmpeg-core.js`, 'text/javascript');
  const wasmURL = await toBlobURL(`${origin}/ffmpeg-core.wasm`, 'application/wasm');

  await remuxFFmpegInstance.load({ coreURL, wasmURL });
  remuxLoaded = true;
  return remuxFFmpegInstance;
}

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.mkv': 'video/x-matroska',
    '.mov': 'video/quicktime',
  };
  return map[ext] || 'application/octet-stream';
}

export const RemuxModule: IModule = {
  manifest: {
    id: 'stream-copy',
    name: 'Remux Direto (Cópia Sem Perdas)',
    version: '1.0.0',
    description: 'Copia os fluxos de vídeo e áudio diretamente para o novo contêiner sem re-encodificar. Instantâneo (< 1s) e com 0% de perda de qualidade.',
    category: 'video',
    supportedModifiers: ['audio_tracks', 'subtitles', 'threads'],
    supportedConversions: [
      {
        from: ['.mkv', '.mp4', '.mov', '.m4v'],
        to: ['.mp4', '.mkv'],
        lossy: false,
        speedScore: 99,
        acceleration: 'instant-copy',
        performanceNotes: 'Cópia direta sem re-encoding (instantâneo, qualidade 100% original)',
      },
    ],
    inputs: [
      { id: 'file', name: 'Input File', type: 'file_handle', required: true },
    ],
    outputs: [
      { id: 'file', name: 'Output File', type: 'file_handle', required: true },
    ],
  },

  isSupported: () => true,

  execute: async (inputs, context) => {
    const fileData = inputs.fileData as Uint8Array;
    const originalName = inputs.originalName as string;
    const targetFormat = inputs.targetFormat as string;

    if (!fileData || !originalName || !targetFormat) {
      throw new Error('Remux module requires fileData (Uint8Array), originalName, and targetFormat.');
    }

    const inputExt = '.' + originalName.split('.').pop()!.toLowerCase();
    const outputExt = targetFormat.startsWith('.') ? targetFormat.toLowerCase() : '.' + targetFormat.toLowerCase();
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + outputExt;

    context.onLog(`[Remux] Remuxing instantâneo: ${originalName} -> ${outputFileName} (Stream Copy)`);
    context.onProgress(10, 'Carregando contêiner...');

    const ffmpeg = await getRemuxFFmpeg(context);

    const inputPath = `input_remux${inputExt}`;
    const outputPath = `output_remux${outputExt}`;

    await ffmpeg.writeFile(inputPath, fileData);

    context.onProgress(40, 'Copiando fluxos de vídeo e áudio...');

    // Stream copy command: -c copy -movflags +faststart
    const args = ['-i', inputPath, '-c', 'copy', '-movflags', '+faststart', outputPath];
    context.onLog(`[Remux] Executando: ffmpeg ${args.join(' ')}`);

    const exitCode = await ffmpeg.exec(args);

    if (exitCode !== 0) {
      try { await ffmpeg.deleteFile(inputPath); } catch (_e) { /* noop */ }
      throw new Error(
        `Os codecs internos deste arquivo não puderam ser empacotados diretamente no contêiner ${outputExt.toUpperCase()} sem re-encodificação. Por favor, selecione o motor 'FFmpeg Multi-Thread' para re-encodar.`
      );
    }

    context.onProgress(90, 'Finalizando novo contêiner...');
    const outputData = await ffmpeg.readFile(outputPath);

    try { await ffmpeg.deleteFile(inputPath); } catch (_e) { /* noop */ }
    try { await ffmpeg.deleteFile(outputPath); } catch (_e) { /* noop */ }

    if (typeof outputData === 'string') {
      throw new Error('Retorno inválido do motor de remuxing.');
    }

    context.onProgress(100, 'Remuxing concluído em alta velocidade!');
    context.onLog(`[Remux] Sucesso: ${outputFileName} (${(outputData.byteLength / 1024 / 1024).toFixed(2)} MB)`);

    return {
      outputData,
      outputFileName,
      outputSize: outputData.byteLength,
      mimeType: getMimeType(outputExt),
    };
  },
};
