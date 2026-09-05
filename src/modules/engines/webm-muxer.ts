/**
 * src/modules/engines/webm-muxer.ts
 *
 * Dedicated WebM container muxer and GPU-accelerated video encoder powered by
 * the `webm-muxer` library and the native WebCodecs API (VP9).
 *
 * Adheres to:
 * - Pilar 1: Desacoplamento Canônico (Engines "Burras")
 * - Pilar 2: Zero-RAM Streaming em Chunks de 2MB
 */
import * as MP4Box from 'mp4box';
import { Muxer as WebmMuxer, ArrayBufferTarget as WebmArrayBufferTarget } from 'webm-muxer';
import type { IModule, ExecutionContext } from '@/shared/types/module';
import { getMimeType } from '@/core/knowledge/mimeTypes';
import { resolveWebCodecsBitrate } from '@/core/knowledge/bitratePresets';

function getTrackDescription(track: MP4Box.MP4Track, mp4boxfile: any): Uint8Array | undefined {
  try {
    const traks = mp4boxfile.moov?.traks || [];
    const trak = traks.find((t: any) => t.tkhd && t.tkhd.track_id === track.id);
    const entries = trak?.mdia?.minf?.stbl?.stsd?.entries || [];
    for (const entry of entries) {
      const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
      if (box && (MP4Box as any).DataStream) {
        const stream = new (MP4Box as any).DataStream(undefined, 0, (MP4Box as any).DataStream.BIG_ENDIAN);
        box.write(stream);
        return new Uint8Array(stream.buffer, 8);
      }
    }
  } catch (_e) {
    /* fallback to auto-detection */
  }
  return undefined;
}

export const WebmMuxerModule: IModule = {
  manifest: {
    id: 'webm-muxer',
    name: 'WebM Muxer (GPU)',
    version: '1.0.0',
    description: 'Empacotamento e transcodificação de alta velocidade para contêiner WebM com aceleração por hardware (WebCodecs VP9).',
    category: 'video',
    supportedModifiers: ['quality', 'bitrate'],
    supportedConversions: [
      {
        from: ['.mp4', '.m4v', '.mov', '.3gp'],
        to: ['.webm'],
        lossy: true,
        speedScore: 95,
        acceleration: 'gpu',
        performanceNotes: 'Aceleração direta de hardware na GPU com codificador VP9 e webm-muxer',
      },
    ],
    inputs: [
      { id: 'file', name: 'Input File', type: 'file_handle', required: true },
    ],
    outputs: [
      { id: 'file', name: 'Output File', type: 'file_handle', required: true },
    ],
  },

  isSupported: async () => {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.MODE === 'test') {
      return true;
    }
    if (typeof window === 'undefined') return true;
    if (!('VideoDecoder' in window) || !('VideoEncoder' in window)) return false;

    try {
      const encoderSupport = await VideoEncoder.isConfigSupported({
        codec: 'vp09.00.10.08',
        width: 1280,
        height: 720,
        bitrate: 2_500_000,
        framerate: 30,
        hardwareAcceleration: 'prefer-hardware',
      });
      return Boolean(encoderSupport.supported);
    } catch {
      return false;
    }
  },

  execute: async (inputs, context: ExecutionContext) => {
    const file = inputs.file as File | Blob | undefined;
    const fileData = inputs.fileData as Uint8Array | undefined;
    const originalName = inputs.originalName as string;
    const targetFormat = inputs.targetFormat as string;
    const options = (inputs.modifiers as any) || (inputs.options as any) || undefined;

    if ((!file && !fileData) || !originalName || !targetFormat) {
      throw new Error('WebM Muxer requer arquivo (File/Blob) ou fileData (Uint8Array), originalName e targetFormat.');
    }

    if (typeof window === 'undefined' || !('VideoDecoder' in window) || !('VideoEncoder' in window)) {
      throw new Error('WebCodecs API (VideoDecoder/VideoEncoder) não é suportada neste navegador.');
    }

    const outputFileName = originalName.replace(/\.[^.]+$/, '') + '.webm';
    context.onLog(`[WebM Muxer] Iniciando muxing GPU para ${originalName} -> ${outputFileName}`);
    context.onProgress(0, 'Inicializando decodificador GPU e webm-muxer...');

    return new Promise((resolve, reject) => {
      let isSettled = false;

      function fail(err: Error | string) {
        if (isSettled) return;
        isSettled = true;
        const msg = typeof err === 'string' ? err : err.message;
        reject(new Error(msg));
      }

      try {
        const mp4boxfile = MP4Box.createFile();
        let videoTrack: MP4Box.MP4Track | null = null;
        let totalSamples = 0;
        let processedSamples = 0;

        const webmTarget = new WebmArrayBufferTarget();
        let webmMuxer: WebmMuxer<WebmArrayBufferTarget> | null = null;
        let videoDecoder: VideoDecoder | null = null;
        let videoEncoder: VideoEncoder | null = null;
        let isCompleted = false;

        function checkFinished() {
          if (isCompleted && videoEncoder && videoEncoder.encodeQueueSize === 0) {
            try {
              if (webmMuxer) webmMuxer.finalize();
              const buffer = webmTarget.buffer;
              const resultBytes = new Uint8Array(buffer);

              if (isSettled) return;
              isSettled = true;

              context.onProgress(100, 'Transcodificação WebM concluída com sucesso!');
              context.onLog(`[WebM Muxer] Sucesso: ${outputFileName} (${(resultBytes.byteLength / 1024 / 1024).toFixed(2)} MB)`);

              const mimeType = getMimeType('.webm');
              const outputBlob = new Blob([buffer], { type: mimeType });

              resolve({
                outputData: resultBytes,
                outputBlob,
                outputFileName,
                outputSize: resultBytes.byteLength,
                mimeType,
              });
            } catch (err) {
              fail(err instanceof Error ? err : String(err));
            }
          }
        }

        mp4boxfile.onError = (module: string, msg: string) => {
          if (isCompleted || processedSamples > 0) {
            context.onLog(`[WebM Muxer] Aviso residual ignorado: [${module}] ${msg}`);
            return;
          }
          fail(`Erro na leitura do contêiner: [${module}] ${msg}`);
        };

        mp4boxfile.onReady = async (info: MP4Box.MP4Info) => {
          try {
            videoTrack = info.videoTracks[0];
            if (!videoTrack) {
              fail('Nenhuma trilha de vídeo encontrada no arquivo.');
              return;
            }

            totalSamples = videoTrack.nb_samples || 100;
            const width = videoTrack.track_width || 1280;
            const height = videoTrack.track_height || 720;

            context.onLog(`[WebM Muxer] Trilha de vídeo: ${width}x${height}, codec: ${videoTrack.codec}, total: ${totalSamples} quadros`);

            // Setup webm-muxer
            webmMuxer = new WebmMuxer({
              target: webmTarget,
              video: {
                codec: 'V_VP9',
                width,
                height,
              },
            });

            // Setup Hardware VideoEncoder for VP9
            videoEncoder = new VideoEncoder({
              output: (chunk, metadata) => {
                webmMuxer?.addVideoChunk(chunk, metadata ?? undefined);
                checkFinished();
              },
              error: (e) => {
                context.onLog(`[WebM Muxer] Erro no codificador VP9: ${e.message}`);
                fail(e);
              },
            });

            const bitrate = resolveWebCodecsBitrate(options);

            videoEncoder.configure({
              codec: 'vp09.00.10.08',
              width,
              height,
              bitrate,
              framerate: 30,
              hardwareAcceleration: 'prefer-hardware',
            });

            // Setup VideoDecoder
            videoDecoder = new VideoDecoder({
              output: (frame) => {
                processedSamples++;
                const percent = Math.min(Math.round((processedSamples / totalSamples) * 90), 95);
                context.onProgress(percent, `Processando GPU: quadro ${processedSamples}/${totalSamples}...`);

                const keyFrame = processedSamples % 60 === 0;
                videoEncoder?.encode(frame, { keyFrame });
                frame.close();
              },
              error: (e) => {
                context.onLog(`[WebM Muxer] Erro no decodificador de vídeo: ${e.message}`);
                fail(e);
              },
            });

            const description = getTrackDescription(videoTrack, mp4boxfile);
            const decoderConfig: VideoDecoderConfig = {
              codec: videoTrack.codec,
              hardwareAcceleration: 'prefer-hardware',
              ...(description ? { description } : {}),
            };

            videoDecoder.configure(decoderConfig);

            mp4boxfile.setExtractionOptions(videoTrack.id, null, { nbSamples: 10000 });
            mp4boxfile.start();
          } catch (err) {
            fail(err instanceof Error ? err : String(err));
          }
        };

        mp4boxfile.onSamples = async (_id: number, _user: unknown, samples: MP4Box.MP4Sample[]) => {
          try {
            for (const sample of samples) {
              const chunk = new EncodedVideoChunk({
                type: sample.is_sync ? 'key' : 'delta',
                timestamp: (1_000_000 * sample.cts) / sample.timescale,
                duration: (1_000_000 * sample.duration) / sample.timescale,
                data: sample.data,
              });
              videoDecoder?.decode(chunk);
            }

            if (videoDecoder) {
              await videoDecoder.flush();
              videoDecoder.close();
            }
            if (videoEncoder) {
              await videoEncoder.flush();
              isCompleted = true;
              checkFinished();
            }
          } catch (err) {
            fail(err instanceof Error ? err : String(err));
          }
        };

        // Streaming in 2MB chunks (Pilar 2: Zero-RAM Streaming)
        (async () => {
          try {
            if (file) {
              const CHUNK_SIZE = 2 * 1024 * 1024;
              let offset = 0;
              while (offset < file.size) {
                const end = Math.min(offset + CHUNK_SIZE, file.size);
                const slice = file.slice(offset, end);
                const chunkBuffer = await slice.arrayBuffer();
                (chunkBuffer as any).fileStart = offset;
                mp4boxfile.appendBuffer(chunkBuffer, offset + chunkBuffer.byteLength >= file.size);
                offset = end;
              }
              mp4boxfile.flush();
            } else if (fileData) {
              const rawBuffer = fileData.buffer.slice(
                fileData.byteOffset,
                fileData.byteOffset + fileData.byteLength
              ) as ArrayBuffer;
              (rawBuffer as any).fileStart = 0;
              mp4boxfile.appendBuffer(rawBuffer, true);
              mp4boxfile.flush();
            }
          } catch (readErr) {
            fail(readErr instanceof Error ? readErr : String(readErr));
          }
        })();
      } catch (err) {
        fail(err instanceof Error ? err : String(err));
      }
    });
  },
};
