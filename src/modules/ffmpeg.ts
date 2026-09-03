/**
 * src/modules/ffmpeg.ts
 *
 * FFmpeg WASM conversion engine (Single-Thread).
 * Uses @ffmpeg/ffmpeg 0.12 with standard @ffmpeg/core.
 * High compatibility fallback engine running on single CPU thread.
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import type { IModule, ExecutionContext } from '@/shared/types/module';

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoaded = false;

async function getFFmpeg(context: ExecutionContext): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegLoaded) return ffmpegInstance;

  ffmpegInstance = new FFmpeg();

  ffmpegInstance.on('log', ({ message }) => {
    context.onLog(`[FFmpeg] ${message}`);
  });

  ffmpegInstance.on('progress', ({ progress, time }) => {
    const percent = Math.min(Math.round(progress * 100), 99);
    const timeSec = (time / 1_000_000).toFixed(1);
    context.onProgress(percent, `Processing... ${timeSec}s encoded`);
  });

  context.onLog('[FFmpeg] Loading ffmpeg-core.wasm...');
  context.onProgress(0, 'Loading FFmpeg engine...');

  const origin = typeof self !== 'undefined' && self.location ? self.location.origin : '';
  const coreURL = await toBlobURL(`${origin}/ffmpeg-core.js`, 'text/javascript');
  const wasmURL = await toBlobURL(`${origin}/ffmpeg-core.wasm`, 'application/wasm');

  await ffmpegInstance.load({ coreURL, wasmURL });

  ffmpegLoaded = true;
  context.onLog('[FFmpeg] Engine loaded successfully.');
  return ffmpegInstance;
}

function getConversionArgs(inputExt: string, outputExt: string): string[] {
  const from = inputExt.toLowerCase();
  const to = outputExt.toLowerCase();

  if (to === '.gif') {
    return ['-vf', 'fps=10,scale=480:-1:flags=lanczos', '-loop', '0'];
  }

  const videoExts = ['.mp4', '.mkv', '.webm', '.mov', '.avi', '.m4v'];
  const audioExts = ['.mp3', '.wav', '.ogg', '.m4a', '.flac'];

  if (videoExts.includes(from) && audioExts.includes(to)) {
    return ['-vn'];
  }

  if (audioExts.includes(from) && audioExts.includes(to)) {
    if (to === '.mp3') return ['-codec:a', 'libmp3lame', '-qscale:a', '2'];
    if (to === '.ogg') return ['-codec:a', 'libvorbis', '-qscale:a', '5'];
    if (to === '.flac') return ['-codec:a', 'flac'];
    if (to === '.m4a') return ['-codec:a', 'aac', '-b:a', '192k'];
    return [];
  }

  if (to === '.webm') return ['-c:v', 'libvpx', '-b:v', '1M', '-c:a', 'libvorbis'];
  if (to === '.mkv') return ['-c', 'copy'];
  if (to === '.mp4') return ['-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac'];

  return [];
}

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    '.mp4': 'video/mp4', '.mkv': 'video/x-matroska', '.webm': 'video/webm',
    '.gif': 'image/gif', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
    '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.flac': 'audio/flac',
  };
  return map[ext] || 'application/octet-stream';
}

export const FFmpegModule: IModule = {
  manifest: {
    id: 'ffmpeg-core',
    name: 'FFmpeg WASM (Single-Thread)',
    version: '0.12.15',
    description: 'Conversão confiável em CPU single-thread com alta compatibilidade.',
    category: 'video',
    supportedConversions: [
      {
        from: ['video/*'],
        to: ['.mp4', '.mkv', '.webm', '.gif'],
        lossy: true,
        speedScore: 45,
        acceleration: 'cpu-singlethread',
        performanceNotes: 'CPU single-thread padrão (seguro para baixa memória)',
      },
      {
        from: ['audio/*'],
        to: ['.mp3', '.wav', '.ogg', '.m4a', '.flac'],
        lossy: true,
        speedScore: 50,
        acceleration: 'cpu-singlethread',
        performanceNotes: 'CPU single-thread para áudio',
      },
    ],
    inputs: [
      { id: 'file', name: 'Input File', type: 'file_handle', required: true },
    ],
    outputs: [
      { id: 'file', name: 'Output File', type: 'file_handle', required: true },
    ],
  },

  execute: async (inputs, context) => {
    const fileData = inputs.fileData as Uint8Array;
    const originalName = inputs.originalName as string;
    const targetFormat = inputs.targetFormat as string;

    if (!fileData || !originalName || !targetFormat) {
      throw new Error('FFmpeg module requires fileData (Uint8Array), originalName, and targetFormat.');
    }

    const inputExt = '.' + originalName.split('.').pop()!.toLowerCase();
    const outputExt = targetFormat.startsWith('.') ? targetFormat.toLowerCase() : '.' + targetFormat.toLowerCase();
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + outputExt;

    context.onLog(`[FFmpeg] Converting ${originalName} -> ${outputFileName}`);

    const ffmpeg = await getFFmpeg(context);

    const inputPath = `input${inputExt}`;
    const outputPath = `output${outputExt}`;

    context.onProgress(5, 'Writing input file...');
    await ffmpeg.writeFile(inputPath, fileData);

    const convArgs = getConversionArgs(inputExt, outputExt);
    const fullArgs = ['-i', inputPath, ...convArgs, outputPath];

    context.onLog(`[FFmpeg] Executing: ffmpeg ${fullArgs.join(' ')}`);
    context.onProgress(10, 'Starting conversion...');

    const exitCode = await ffmpeg.exec(fullArgs);

    if (exitCode !== 0) {
      try { await ffmpeg.deleteFile(inputPath); } catch (_e) { /* noop */ }
      throw new Error(`FFmpeg exited with code ${exitCode}. Check logs for details.`);
    }

    context.onProgress(95, 'Reading output file...');
    const outputData = await ffmpeg.readFile(outputPath);

    try { await ffmpeg.deleteFile(inputPath); } catch (_e) { /* noop */ }
    try { await ffmpeg.deleteFile(outputPath); } catch (_e) { /* noop */ }

    if (typeof outputData === 'string') {
      throw new Error('Unexpected string output from FFmpeg. Expected Uint8Array.');
    }

    context.onProgress(100, 'Conversion complete!');
    context.onLog(`[FFmpeg] Output: ${outputFileName} (${(outputData.byteLength / 1024 / 1024).toFixed(2)} MB)`);

    return {
      outputData: outputData,
      outputFileName: outputFileName,
      outputSize: outputData.byteLength,
      mimeType: getMimeType(outputExt),
    };
  },
};
