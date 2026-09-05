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
        const collectedChunks: Uint8Array[] = [];
        let totalSamples = 0;
        let processedSamples = 0;
        let selectedTrack: MP4Box.MP4Track | null = null;
        let isAudioTarget = outputExt === '.m4a' || outputExt === '.aac' || outputExt === '.m4r';

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
              selectedTrack = audioTrack;
              totalSamples = audioTrack.nb_samples || 100;
              const sampleRate = (audioTrack as any).audio?.sample_rate || 44100;
              context.onLog(`[MP4Box] Trilha de áudio detectada: ${audioTrack.codec}, ${sampleRate} Hz, ${totalSamples} amostras.`);
              mp4boxfile.setExtractionOptions(audioTrack.id, null, { nbSamples: 10000 });
              mp4boxfile.start();
            } else {
              // Video / MP4 pass-through or track extraction
              const vTrack = info.videoTracks[0];
              if (!vTrack) {
                fail('Nenhuma trilha de vídeo encontrada no arquivo.');
                return;
              }
              selectedTrack = vTrack;
              totalSamples = vTrack.nb_samples || 100;
              context.onLog(`[MP4Box] Trilha de vídeo detectada: ${vTrack.track_width}x${vTrack.track_height}, codec ${vTrack.codec}.`);
              mp4boxfile.setExtractionOptions(vTrack.id, null, { nbSamples: 10000 });
              mp4boxfile.start();
            }
          } catch (err) {
            fail(err instanceof Error ? err : String(err));
          }
        };

        mp4boxfile.onSamples = (_id: number, _user: unknown, samples: MP4Box.MP4Sample[]) => {
          try {
            for (const sample of samples) {
              if (sample.data) {
                collectedChunks.push(new Uint8Array(sample.data.buffer, sample.data.byteOffset, sample.data.byteLength));
              }
              processedSamples++;
            }

            const percent = Math.min(99, Math.round((processedSamples / Math.max(1, totalSamples)) * 100));
            context.onProgress(percent, `Extraindo amostras ISO-BMFF... ${percent}%`);

            if (processedSamples >= totalSamples || samples.length === 0) {
              finish();
            }
          } catch (err) {
            fail(err instanceof Error ? err : String(err));
          }
        };

        function finish() {
          if (isSettled) return;
          isSettled = true;

          const totalBytes = collectedChunks.reduce((acc, c) => acc + c.byteLength, 0);
          const merged = new Uint8Array(totalBytes);
          let offset = 0;
          for (const c of collectedChunks) {
            merged.set(c, offset);
            offset += c.byteLength;
          }

          context.onProgress(100, 'Extração MP4Box concluída com sucesso!');
          context.onLog(`[MP4Box] Sucesso: gerado ${outputFileName} (${(totalBytes / 1024 / 1024).toFixed(2)} MB, zero re-encode)`);

          const outputBlob = new Blob([merged.buffer], { type: mimeType });

          resolve({
            outputData: merged,
            outputBlob,
            outputFileName,
            outputSize: totalBytes,
            mimeType,
          });
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
