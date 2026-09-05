/**
 * src/modules/engines/remux.ts
 *
 * Ultra-fast Stream Copy (Remuxing) Engine.
 * Copies video and audio packets directly between containers (e.g. MKV <-> MP4)
 * without re-encoding a single frame. Instantaneous and 100% lossless.
 * Supports Zero-RAM WORKERFS streaming for giant files.
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';
import type { FFFSType } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import type { IModule, ExecutionContext } from '@/shared/types/module';
import { getMimeType } from '@/core/knowledge/mimeTypes';

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

export const RemuxModule: IModule = {
  manifest: {
    id: 'stream-copy',
    name: 'Remux Direto (Cópia Sem Perdas)',
    version: '1.0.0',
    description: 'Copia os fluxos de vídeo e áudio diretamente para o novo contêiner sem re-encodificar. Instantâneo (< 1s) e com 0% de perda de qualidade.',
    category: 'video',
    supportedModifiers: ['audio_tracks', 'subtitles'],
    supportedConversions: [
      {
        from: ['.mkv', '.mp4', '.mov', '.m4v', '.ts'],
        to: ['.mp4', '.mkv', '.mov', '.m4v', '.ts', '.m4a', '.aac'],
        lossy: false,
        speedScore: 98,
        acceleration: 'instant-copy',
        performanceNotes: 'Cópia direta de pacotes de dados sem re-encoding (instantâneo, qualidade 100% original)',
      },
      {
        from: ['.webm'],
        to: ['.mkv', '.opus', '.ogg'],
        lossy: false,
        speedScore: 98,
        acceleration: 'instant-copy',
        performanceNotes: 'Cópia direta de pacotes WebM/Matroska sem re-encoding',
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
    const file = inputs.file as File | Blob | undefined;
    const fileData = inputs.fileData as Uint8Array | undefined;
    const originalName = inputs.originalName as string;
    const targetFormat = inputs.targetFormat as string;

    if ((!file && !fileData) || !originalName || !targetFormat) {
      throw new Error('Remux module requires file (File/Blob) or fileData (Uint8Array), originalName, and targetFormat.');
    }

    const inputExt = '.' + originalName.split('.').pop()!.toLowerCase();
    const outputExt = targetFormat.startsWith('.') ? targetFormat.toLowerCase() : '.' + targetFormat.toLowerCase();
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + outputExt;

    context.onLog(`[Remux] Remuxing instantâneo: ${originalName} -> ${outputFileName} (Stream Copy)`);
    context.onProgress(10, 'Carregando contêiner...');

    const ffmpeg = await getRemuxFFmpeg(context);

    let mountedWorkDir = false;
    const workDir = '/work';
    const fallbackInputPath = `input_remux${inputExt}`;
    let inputPath = fallbackInputPath;
    const outputPath = `output_remux${outputExt}`;

    try {
      const targetFileOrBlob: File | Blob | null = file || (fileData ? new Blob([fileData as unknown as BlobPart]) : null);

      if (typeof ffmpeg.mount === 'function' && targetFileOrBlob) {
        try {
          try {
            await ffmpeg.createDir(workDir);
          } catch (_e) {
            /* noop */
          }

          if (typeof File !== 'undefined' && targetFileOrBlob instanceof File) {
            await ffmpeg.mount('WORKERFS' as FFFSType, {
              files: [targetFileOrBlob],
            }, workDir);
            inputPath = `${workDir}/${targetFileOrBlob.name}`;
            mountedWorkDir = true;
          } else {
            const blobName = `input_remux${inputExt}`;
            await ffmpeg.mount('WORKERFS' as FFFSType, {
              blobs: [{ name: blobName, data: targetFileOrBlob }],
            }, workDir);
            inputPath = `${workDir}/${blobName}`;
            mountedWorkDir = true;
          }

          context.onLog(`[Remux] WORKERFS montado com sucesso em ${workDir} (Zero-RAM streaming).`);
        } catch (mountErr) {
          context.onLog(`[Remux] WORKERFS indisponível (${mountErr}), utilizando gravação direta.`);
          mountedWorkDir = false;
        }
      }

      if (!mountedWorkDir) {
        inputPath = fallbackInputPath;
        const dataToWrite: Uint8Array = fileData || new Uint8Array(await (file as File | Blob).arrayBuffer());
        await ffmpeg.writeFile(inputPath, dataToWrite);
      }

      const options = (inputs.modifiers as any) || (inputs.options as any) || undefined;
      let streamMapArgs: string[] = [];
      if (options?.activeCategories?.includes('audio_tracks')) {
        const selected = options.selectedAudioTracks ?? [];
        if (selected.length === 0) {
          streamMapArgs = ['-map', '0:v:0', '-an'];
        } else {
          streamMapArgs = ['-map', '0:v:0', ...selected.flatMap((idx: number) => ['-map', `0:a:${idx}?`])];
        }
      }
      if (options?.activeCategories?.includes('subtitles')) {
        const selectedSubs = options.selectedSubtitleTracks ?? [];
        if (!options.keepAllSubtitles && selectedSubs.length === 0) {
          streamMapArgs.push('-sn');
        } else if (selectedSubs.length > 0) {
          streamMapArgs.push(...selectedSubs.flatMap((idx: number) => ['-map', `0:s:${idx}?`]));
        }
      }

      // Stream copy command: handles video containers and direct audio extraction
      const isAudioOutput = ['.m4a', '.aac', '.opus', '.ogg', '.mp3'].includes(outputExt);
      const copyFlags = isAudioOutput ? ['-vn', '-c:a', 'copy'] : ['-c', 'copy'];
      const movFlags = ['.mp4', '.mov', '.m4v', '.m4a'].includes(outputExt) ? ['-movflags', '+faststart'] : [];
      const args = ['-i', inputPath, ...streamMapArgs, ...copyFlags, ...movFlags, outputPath];
      context.onLog(`[Remux] Executando: ffmpeg ${args.join(' ')}`);

      const exitCode = await ffmpeg.exec(args);

      if (exitCode !== 0) {
        throw new Error(
          `Os codecs internos deste arquivo não puderam ser empacotados diretamente no contêiner ${outputExt.toUpperCase()} sem re-encodificação. Por favor, selecione o motor 'FFmpeg Multi-Thread' para re-encodar.`
        );
      }

      context.onProgress(90, 'Finalizando novo contêiner...');
      const outputData = await ffmpeg.readFile(outputPath);

      if (typeof outputData === 'string') {
        throw new Error('Retorno inválido do motor de remuxing.');
      }

      context.onProgress(100, 'Remuxing concluído em alta velocidade!');
      context.onLog(`[Remux] Sucesso: ${outputFileName} (${(outputData.byteLength / 1024 / 1024).toFixed(2)} MB)`);

      const mimeType = getMimeType(outputExt);
      const outputBlob = new Blob([outputData.buffer as unknown as BlobPart], { type: mimeType });

      return {
        outputData,
        outputBlob,
        outputFileName,
        outputSize: outputData.byteLength,
        mimeType,
      };
    } finally {
      if (mountedWorkDir) {
        try {
          await ffmpeg.unmount(workDir);
        } catch (_e) {
          /* noop */
        }
        try {
          await ffmpeg.deleteDir(workDir);
        } catch (_e) {
          /* noop */
        }
      } else {
        try {
          await ffmpeg.deleteFile(inputPath);
        } catch (_e) {
          /* noop */
        }
      }
      try {
        await ffmpeg.deleteFile(outputPath);
      } catch (_e) {
        /* noop */
      }
    }
  },
};
