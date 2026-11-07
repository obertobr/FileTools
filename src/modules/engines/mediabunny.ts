/**
 * src/modules/engines/mediabunny.ts
 *
 * Unified WebCodecs & Transmuxing Engine powered by Mediabunny.
 * Successor to mp4-muxer and webm-muxer (by the same author, Vanilagy).
 *
 * Provides hardware-accelerated (GPU) WebCodecs encoding/decoding and
 * instant-copy transmuxing across ISO-BMFF (MP4/MOV/M4V/3GP), Matroska/WebM (MKV/WebM),
 * MPEG-TS, and modern audio containers (AAC, MP3, WAV, OGG, FLAC).
 *
 * Compliant with:
 * - Pilar 1: Desacoplamento Canônico (zero strings de UI, contratos puros)
 * - Pilar 2: Tolerância a Arquivos Gigantes & Zero-RAM Streaming (BlobSource fatiado)
 */
import {
  Input,
  Output,
  Conversion,
  ALL_FORMATS,
  BlobSource,
  BufferSource,
  BufferTarget,
  Mp4OutputFormat,
  WebMOutputFormat,
  MkvOutputFormat,
  MovOutputFormat,
  MpegTsOutputFormat,
  OggOutputFormat,
  WavOutputFormat,
  Mp3OutputFormat,
  AdtsOutputFormat,
  FlacOutputFormat,
  QUALITY_VERY_LOW,
  QUALITY_LOW,
  QUALITY_MEDIUM,
  QUALITY_HIGH,
  QUALITY_VERY_HIGH,
} from 'mediabunny';
import type { IModule } from '@/shared/types/module';
import type { ConversionModifiers } from '@/shared/types/conversionModifiers';
import { getMimeType } from '@/core/knowledge/mimeTypes';

function resolveOutputFormat(targetExt: string) {
  const ext = targetExt.startsWith('.') ? targetExt.toLowerCase() : '.' + targetExt.toLowerCase();
  switch (ext) {
    case '.mp4':
    case '.m4v':
    case '.m4a':
      return new Mp4OutputFormat();
    case '.webm':
      return new WebMOutputFormat();
    case '.mkv':
      return new MkvOutputFormat();
    case '.mov':
      return new MovOutputFormat();
    case '.ts':
      return new MpegTsOutputFormat();
    case '.ogg':
    case '.opus':
      return new OggOutputFormat();
    case '.wav':
      return new WavOutputFormat();
    case '.mp3':
      return new Mp3OutputFormat();
    case '.aac':
      return new AdtsOutputFormat();
    case '.flac':
      return new FlacOutputFormat();
    default:
      throw new Error(`[Mediabunny] Formato de saída não suportado: ${targetExt}`);
  }
}

export const MediabunnyModule: IModule = {
  manifest: {
    id: 'mediabunny',
    name: 'Mediabunny (WebCodecs & Fast Muxer)',
    version: '1.55.7',
    description: 'Motor ultrarrápido com aceleração por hardware (GPU WebCodecs) e transmuxing direto para vídeo e áudio.',
    category: 'video',
    supportedModifiers: [
      'resolution',
      'fps',
      'quality',
      'bitrate',
      'video_codec',
      'audio_codec',
      'video_duration',
    ],
    supportedConversions: [
      {
        from: ['.mp4', '.m4v', '.mov', '.3gp', '.mkv', '.webm', '.ts'],
        to: ['.mp4', '.m4v', '.mov', '.mkv', '.webm'],
        lossy: false,
        speedScore: 74,
        acceleration: 'gpu',
        performanceNotes: 'Aceleração nativa por hardware GPU (WebCodecs) / Transmuxing direto',
      },
      {
        from: ['.mp4', '.m4v', '.mov', '.3gp', '.mkv', '.webm'],
        to: ['.m4a', '.opus', '.ogg', '.wav'],
        lossy: false,
        speedScore: 68,
        acceleration: 'gpu',
        performanceNotes: 'Extração e re-encodificação de áudio via WebCodecs (AAC/Opus/PCM)',
      },
    ],
    inputs: [
      { id: 'file', name: 'Input File', type: 'file_handle', required: true }
    ],
    outputs: [
      { id: 'file', name: 'Output File', type: 'file_handle', required: true }
    ]
  },

  isSupported: async () => true,

  execute: async (inputs, context) => {
    const file = inputs.file as File | Blob | undefined;
    const fileData = inputs.fileData as Uint8Array | undefined;
    const originalName = inputs.originalName as string;
    const targetFormat = inputs.targetFormat as string;
    const modifiers = (inputs.modifiers as ConversionModifiers) || (inputs.options as ConversionModifiers) || undefined;

    if ((!file && !fileData) || !originalName || !targetFormat) {
      throw new Error('Mediabunny module requires file (File/Blob) or fileData (Uint8Array), originalName, and targetFormat.');
    }

    const targetExt = targetFormat.startsWith('.') ? targetFormat.toLowerCase() : '.' + targetFormat.toLowerCase();
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + targetExt;
    const mimeType = getMimeType(targetExt);

    context.onLog(`[Mediabunny] Iniciando processamento: ${originalName} -> ${outputFileName}`);
    context.onProgress(10, 'Inicializando decodificadores e demuxers...');

    // Zero-RAM streaming via BlobSource whenever possible
    let source;
    if (file) {
      source = new BlobSource(file);
    } else {
      const buffer = fileData!.buffer.slice(
        fileData!.byteOffset,
        fileData!.byteOffset + fileData!.byteLength
      ) as ArrayBuffer;
      source = new BufferSource(buffer);
    }

    const input = new Input({
      source,
      formats: ALL_FORMATS,
    });

    const outputFormat = resolveOutputFormat(targetExt);
    const target = new BufferTarget();
    const output = new Output({
      format: outputFormat,
      target,
    });

    // Build video configuration
    const videoConfig: Record<string, unknown> = {};
    const isAudioTarget = ['.aac', '.m4a', '.opus', '.ogg', '.wav', '.mp3', '.flac'].includes(targetExt);
    if (isAudioTarget) {
      videoConfig.discard = true;
    } else {
      let targetW = modifiers?.targetWidth && modifiers.targetWidth > 0
        ? modifiers.targetWidth
        : modifiers?.customScaleWidth && modifiers.customScaleWidth > 0
        ? modifiers.customScaleWidth
        : undefined;

      let targetH = modifiers?.targetHeight && modifiers.targetHeight > 0
        ? modifiers.targetHeight
        : modifiers?.customScaleHeight && modifiers.customScaleHeight > 0
        ? modifiers.customScaleHeight
        : undefined;

      if (!targetW && modifiers?.resolutionScale && modifiers.resolutionScale !== 'original') {
        const res = modifiers.resolutionScale.toLowerCase();
        const wMap: Record<string, { w: number; h?: number }> = {
          '1080p': { w: 1920, h: 1080 },
          '720p': { w: 1280, h: 720 },
          '480p': { w: 854, h: 480 },
          '360p': { w: 640, h: 360 },
          '320p': { w: 480, h: 320 },
          'cif': { w: 352, h: 288 },
          'qcif': { w: 176, h: 144 },
        };
        if (wMap[res]) {
          targetW = wMap[res].w;
          if (!targetH && wMap[res].h) targetH = wMap[res].h;
        }
      }

      if (targetW) videoConfig.width = targetW;
      if (targetH) videoConfig.height = targetH;
      if (targetW || targetH) {
        videoConfig.fit = 'contain';
        videoConfig.forceTranscode = true;
      }
      if (modifiers?.targetFps) {
        videoConfig.frameRate = modifiers.targetFps;
        videoConfig.forceTranscode = true;
      }
      if (modifiers?.videoBitrate) {
        const b = modifiers.videoBitrate.toLowerCase();
        if (b.endsWith('m')) {
          videoConfig.bitrate = parseFloat(b) * 1_000_000;
        } else if (b.endsWith('k')) {
          videoConfig.bitrate = parseFloat(b) * 1_000;
        } else if (!isNaN(Number(b))) {
          videoConfig.bitrate = Number(b);
        }
        videoConfig.forceTranscode = true;
      } else if (modifiers?.targetCrf !== undefined) {
        if (modifiers.targetCrf <= 18) videoConfig.quality = QUALITY_VERY_HIGH;
        else if (modifiers.targetCrf <= 23) videoConfig.quality = QUALITY_HIGH;
        else if (modifiers.targetCrf <= 28) videoConfig.quality = QUALITY_MEDIUM;
        else if (modifiers.targetCrf <= 35) videoConfig.quality = QUALITY_LOW;
        else videoConfig.quality = QUALITY_VERY_LOW;
        videoConfig.forceTranscode = true;
      }
      if (modifiers?.videoCodec) {
        const codec = modifiers.videoCodec.toLowerCase();
        if (codec.includes('264') || codec.includes('avc')) videoConfig.codec = 'avc';
        else if (codec.includes('265') || codec.includes('hevc')) videoConfig.codec = 'hevc';
        else if (codec.includes('vp9')) videoConfig.codec = 'vp9';
        else if (codec.includes('vp8')) videoConfig.codec = 'vp8';
        else if (codec.includes('av1')) videoConfig.codec = 'av1';
        videoConfig.forceTranscode = true;
      }
    }

    // Build audio configuration
    const audioConfig: Record<string, unknown> = {};
    if (modifiers?.audioCodec) {
      const aCodec = modifiers.audioCodec.toLowerCase();
      if (aCodec.includes('aac')) audioConfig.codec = 'aac';
      else if (aCodec.includes('opus')) audioConfig.codec = 'opus';
      else if (aCodec.includes('pcm') || aCodec.includes('wav')) audioConfig.codec = 'pcm-s16';
      else if (aCodec.includes('mp3')) audioConfig.codec = 'mp3';
      else if (aCodec.includes('flac')) audioConfig.codec = 'flac';
      audioConfig.forceTranscode = true;
    }
    if (modifiers?.audioBitrate) {
      const b = modifiers.audioBitrate.toLowerCase();
      if (b.endsWith('k')) {
        audioConfig.bitrate = parseFloat(b) * 1_000;
      } else if (!isNaN(Number(b))) {
        audioConfig.bitrate = Number(b);
      }
      audioConfig.forceTranscode = true;
    }

    // Ensure output format has compatible codec defaults
    if (targetExt === '.webm') {
      if (!videoConfig.codec && !videoConfig.discard) {
        videoConfig.codec = 'vp9';
        videoConfig.forceTranscode = true;
      }
      if (!audioConfig.codec) {
        audioConfig.codec = 'opus';
        audioConfig.forceTranscode = true;
      }
    } else if (targetExt === '.aac') {
      audioConfig.codec = 'aac';
      audioConfig.forceTranscode = true;
    } else if (targetExt === '.opus') {
      audioConfig.codec = 'opus';
      audioConfig.forceTranscode = true;
    } else if (targetExt === '.wav') {
      audioConfig.codec = 'pcm-s16';
      audioConfig.forceTranscode = true;
    } else if (targetExt === '.mp3') {
      audioConfig.codec = 'mp3';
      audioConfig.forceTranscode = true;
    } else if (targetExt === '.flac') {
      audioConfig.codec = 'flac';
      audioConfig.forceTranscode = true;
    }

    // Build trimming configuration
    let trimConfig: { start?: number; end?: number } | undefined;
    if (modifiers?.videoDurationSeconds && modifiers.videoDurationSeconds > 0) {
      trimConfig = { start: 0, end: modifiers.videoDurationSeconds };
    }

    context.onProgress(20, 'Configurando pipeline de conversão...');

    const conversion = await Conversion.init({
      input,
      output,
      video: Object.keys(videoConfig).length > 0 ? videoConfig : undefined,
      audio: Object.keys(audioConfig).length > 0 ? audioConfig : undefined,
      trim: trimConfig,
      showWarnings: false,
    });

    if (!conversion.isValid) {
      throw new Error(`[Mediabunny] A conversão solicitada não é válida para este formato ou codec de entrada.`);
    }

    conversion.onProgress = (progress: number) => {
      const pct = Math.min(99, Math.max(20, Math.round(20 + progress * 79)));
      context.onProgress(pct, `Processando mídia (${Math.round(progress * 100)}%)...`);
    };

    context.onLog(`[Mediabunny] Executando pipeline com WebCodecs...`);
    await conversion.execute();

    const outputBuffer = target.buffer;
    if (!outputBuffer || outputBuffer.byteLength === 0) {
      throw new Error('[Mediabunny] Falha: o buffer de saída gerado está vazio.');
    }

    const outputData = new Uint8Array(outputBuffer);
    const outputBlob = new Blob([outputBuffer], { type: mimeType });

    context.onProgress(100, 'Conversão concluída com sucesso!');
    context.onLog(`[Mediabunny] Concluído: ${outputFileName} (${outputData.byteLength} bytes)`);

    return {
      outputData,
      outputBlob,
      outputFileName,
      outputSize: outputData.byteLength,
      mimeType,
    };
  }
};
