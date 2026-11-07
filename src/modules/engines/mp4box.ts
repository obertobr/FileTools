/**
 * src/modules/engines/mp4box.ts
 *
 * Dedicated ISO-BMFF container processor powered exclusively by the MP4Box library.
 * Performs direct track extraction (e.g. lossless audio extraction from MP4 to M4A/AAC)
 * and MP4 container restructuring without re-encoding, completely client-side.
 *
 * Adheres to:
 * - Pilar 1: Desacoplamento Canônico (Engines "Burras")
 * - Pilar 2: Zero-RAM Streaming em Chunks de 2MB
 */
import * as MP4Box from 'mp4box';
import type { IModule, ExecutionContext } from '@/shared/types/module';
import { getMimeType } from '@/core/knowledge/mimeTypes';

export const MP4BoxModule: IModule = {
  manifest: {
    id: 'mp4box',
    name: 'MP4Box (ISO-BMFF)',
    version: '0.5.2',
    description: 'Processamento nativo de contêineres MP4/ISO-BMFF com extração direta de faixas sem re-encode e zero perda de qualidade.',
    category: 'video',
    supportedModifiers: ['audio_tracks'],
    supportedConversions: [
      {
        from: ['.mp4', '.m4v', '.mov', '.3gp'],
        to: ['.m4a', '.m4r', '.aac', '.mp4'],
        lossy: false,
        speedScore: 99,
        acceleration: 'instant-copy',
        performanceNotes: 'Cópia pura e extração direta de bitstream via MP4Box (ultra-rápido, zero re-encode)',
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
    return true;
  },

  execute: async (inputs, context: ExecutionContext) => {
    const file = inputs.file as File | Blob | undefined;
    const fileData = inputs.fileData as Uint8Array | undefined;
    const originalName = inputs.originalName as string;
    const targetFormat = inputs.targetFormat as string;

    if ((!file && !fileData) || !originalName || !targetFormat) {
      throw new Error('MP4Box requer arquivo (File/Blob) ou fileData (Uint8Array), originalName e targetFormat.');
    }

    const outputExt = targetFormat.startsWith('.') ? targetFormat.toLowerCase() : '.' + targetFormat.toLowerCase();
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + outputExt;
    const mimeType = getMimeType(outputExt);

    context.onLog(`[MP4Box] Iniciando processamento ISO-BMFF: ${originalName} -> ${outputFileName}`);
    context.onProgress(0, 'Iniciando análise do contêiner MP4...');

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
        let totalSamples = 0;
        let processedSamples = 0;
        const isAacTarget = outputExt === '.aac';
        const isAudioTarget = outputExt === '.m4a' || outputExt === '.aac' || outputExt === '.m4r';
        const adtsChunks: Uint8Array[] = [];
        const FREQ_MAP = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];

        mp4boxfile.onError = (module: string, msg: string) => {
          if (processedSamples > 0) {
            context.onLog(`[MP4Box] Aviso residual ignorado: [${module}] ${msg}`);
            return;
          }
          fail(`Erro no parser MP4Box: [${module}] ${msg}`);
        };

        mp4boxfile.onReady = (info: MP4Box.MP4Info) => {
          try {
            if (isAudioTarget) {
              const audioTrack = info.audioTracks[0];
              if (!audioTrack) {
                fail('Nenhuma trilha de áudio encontrada no contêiner MP4 para extração.');
                return;
              }
              totalSamples = audioTrack.nb_samples || 100;
              const sampleRate = (audioTrack as any).audio?.sample_rate || 44100;
              context.onLog(`[MP4Box] Trilha de áudio detectada: ${audioTrack.codec}, ${sampleRate} Hz, ${totalSamples} amostras.`);

              if (isAacTarget) {
                const freqIndex = Math.max(0, FREQ_MAP.indexOf(sampleRate));
                const channels = (audioTrack as any).audio?.channel_count || 2;
                const profile = 2; // AAC-LC

                mp4boxfile.onSamples = (_id: number, _user: unknown, samples: MP4Box.MP4Sample[]) => {
                  for (const sample of samples) {
                    if (sample.data) {
                      const frameLen = sample.data.byteLength + 7;
                      const header = new Uint8Array(7);
                      header[0] = 0xFF;
                      header[1] = 0xF1;
                      header[2] = ((profile - 1) << 6) | (freqIndex << 2) | ((channels >> 2) & 1);
                      header[3] = ((channels & 3) << 6) | ((frameLen >> 11) & 3);
                      header[4] = (frameLen >> 3) & 0xFF;
                      header[5] = ((frameLen & 7) << 5) | 0x1F;
                      header[6] = 0xFC;
                      adtsChunks.push(header);
                      adtsChunks.push(new Uint8Array(sample.data.buffer, sample.data.byteOffset, sample.data.byteLength));
                    }
                    processedSamples++;
                  }
                  const pct = Math.min(99, Math.round((processedSamples / Math.max(1, totalSamples)) * 100));
                  context.onProgress(pct, `Extraindo fluxo AAC... ${pct}%`);
                  if (processedSamples >= totalSamples || samples.length === 0) {
                    finishAac();
                  }
                };

                mp4boxfile.setExtractionOptions(audioTrack.id, null, { nbSamples: 10000 });
                mp4boxfile.start();
              }
            } else {
              const vTrack = info.videoTracks[0];
              if (!vTrack) {
                fail('Nenhuma trilha de vídeo encontrada no arquivo.');
                return;
              }
              totalSamples = vTrack.nb_samples || 100;
              context.onLog(`[MP4Box] Trilha de vídeo detectada: ${vTrack.track_width}x${vTrack.track_height}, codec ${vTrack.codec}.`);
            }
          } catch (err) {
            fail(err instanceof Error ? err : String(err));
          }
        };

        function finishAac() {
          if (isSettled) return;
          isSettled = true;
          const totalBytes = adtsChunks.reduce((acc, c) => acc + c.byteLength, 0);
          const merged = new Uint8Array(totalBytes);
          let offset = 0;
          for (const c of adtsChunks) {
            merged.set(c, offset);
            offset += c.byteLength;
          }
          context.onProgress(100, 'Extração AAC concluída com sucesso!');
          context.onLog(`[MP4Box] Sucesso: gerado ${outputFileName} (${(totalBytes / 1024).toFixed(1)} KB)`);
          const outputBlob = new Blob([merged.buffer as unknown as BlobPart], { type: mimeType });
          resolve({
            outputData: merged,
            outputBlob,
            outputFileName,
            outputSize: totalBytes,
            mimeType,
          });
        }

        function finishIsoContainer() {
          if (isSettled) return;
          isSettled = true;
          try {
            if (isAudioTarget) {
              const audioTrack = (mp4boxfile as any).moov?.traks?.find((t: any) => t.mdia?.hdlr?.handler === 'soun');
              if (audioTrack && (mp4boxfile as any).moov?.traks) {
                (mp4boxfile as any).moov.traks = [audioTrack];
              }
              if ((mp4boxfile as any).ftyp) {
                (mp4boxfile as any).ftyp.major_brand = 'M4A ';
                (mp4boxfile as any).ftyp.compatible_brands = ['M4A ', 'mp42', 'isom'];
              }
            }

            const stream = (mp4boxfile as any).getBuffer();
            const outputData = new Uint8Array(stream.buffer);
            context.onProgress(100, 'Processamento ISO-BMFF concluído com sucesso!');
            context.onLog(`[MP4Box] Sucesso: gerado contêiner ${outputFileName} (${(outputData.byteLength / 1024).toFixed(1)} KB)`);
            const outputBlob = new Blob([outputData.buffer as unknown as BlobPart], { type: mimeType });
            resolve({
              outputData,
              outputBlob,
              outputFileName,
              outputSize: outputData.byteLength,
              mimeType,
            });
          } catch (err) {
            fail(err instanceof Error ? err : String(err));
          }
        }

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

            if (!isAacTarget) {
              finishIsoContainer();
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
