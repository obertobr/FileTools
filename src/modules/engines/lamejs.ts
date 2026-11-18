import type { IModule, ExecutionContext } from '@/shared/types/module';
import type { ConversionModifiers } from '@/shared/types/conversionModifiers';
import { getMimeType } from '@/core/knowledge/mimeTypes';

interface DecodedPcm {
  channels: Float32Array[];
  sampleRate: number;
}

function decodeExtended80(bytes: Uint8Array): number {
  const exp = ((bytes[0] & 0x7f) << 8) | bytes[1];
  let mant = 0;
  for (let i = 2; i < 10; i++) {
    mant = mant * 256 + bytes[i];
  }
  if (exp === 0 && mant === 0) return 0;
  const sign = (bytes[0] & 0x80) !== 0 ? -1 : 1;
  return sign * mant * Math.pow(2, exp - 16383 - 63);
}

function parseWav(data: Uint8Array): DecodedPcm {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (data.byteLength < 44) throw new Error('[lamejs] Arquivo WAV inválido ou truncado.');

  let offset = 12;
  let audioFormat = 1;
  let numChannels = 1;
  let sampleRate = 44100;
  let bitsPerSample = 16;
  let dataStart = 0;
  let dataLength = 0;

  while (offset + 8 <= data.byteLength) {
    const id = String.fromCharCode(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;

    if (id === 'fmt ' && body + 16 <= data.byteLength) {
      audioFormat = view.getUint16(body, true);
      numChannels = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      bitsPerSample = view.getUint16(body + 14, true);
    } else if (id === 'data') {
      dataStart = body;
      dataLength = Math.min(size, data.byteLength - body);
      break;
    }

    offset = body + size + (size % 2);
  }

  if (dataLength === 0 || numChannels === 0) {
    throw new Error('[lamejs] Chunk de dados PCM não encontrado no arquivo WAV.');
  }

  const bytesPerSample = bitsPerSample / 8;
  const frameCount = Math.floor(dataLength / (numChannels * bytesPerSample));
  const channels = Array.from({ length: numChannels }, () => new Float32Array(frameCount));

  for (let i = 0; i < frameCount; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const pos = dataStart + (i * numChannels + ch) * bytesPerSample;
      let sample = 0;
      if (audioFormat === 3 && bitsPerSample === 32) {
        sample = view.getFloat32(pos, true);
      } else if (bitsPerSample === 8) {
        sample = (data[pos] - 128) / 128;
      } else if (bitsPerSample === 16) {
        sample = view.getInt16(pos, true) / 32768;
      } else if (bitsPerSample === 24) {
        let val = data[pos] | (data[pos + 1] << 8) | (data[pos + 2] << 16);
        if (val & 0x800000) val |= ~0xffffff;
        sample = val / 8388608;
      } else if (bitsPerSample === 32) {
        sample = view.getInt32(pos, true) / 2147483648;
      }
      channels[ch][i] = Math.max(-1, Math.min(1, sample));
    }
  }

  return { channels, sampleRate };
}

function parseAiff(data: Uint8Array): DecodedPcm {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 12;
  let numChannels = 1;
  let numFrames = 0;
  let sampleSize = 16;
  let sampleRate = 44100;
  let ssndBody = 0;
  let ssndSize = 0;

  while (offset + 8 <= data.byteLength) {
    const id = String.fromCharCode(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
    const size = view.getUint32(offset + 4, false);
    const body = offset + 8;

    if (id === 'COMM' && body + 18 <= data.byteLength) {
      numChannels = view.getInt16(body, false);
      numFrames = view.getUint32(body + 2, false);
      sampleSize = view.getInt16(body + 6, false);
      sampleRate = Math.round(decodeExtended80(data.subarray(body + 8, body + 18)));
    } else if (id === 'SSND' && body + 8 <= data.byteLength) {
      const ssndOffset = view.getUint32(body, false);
      ssndBody = body + 8 + ssndOffset;
      ssndSize = Math.min(size - 8 - ssndOffset, data.byteLength - ssndBody);
      break;
    }

    offset = body + size + (size % 2);
  }

  const bytesPerSample = Math.max(1, Math.ceil(sampleSize / 8));
  const frameCount = Math.min(numFrames || Number.MAX_SAFE_INTEGER, Math.floor(ssndSize / (numChannels * bytesPerSample)));
  if (frameCount <= 0) throw new Error('[lamejs] Chunk SSND inválido no arquivo AIFF.');

  const channels = Array.from({ length: numChannels }, () => new Float32Array(frameCount));
  for (let i = 0; i < frameCount; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const pos = ssndBody + (i * numChannels + ch) * bytesPerSample;
      let sample = 0;
      if (bytesPerSample === 1) sample = view.getInt8(pos) / 128;
      else if (bytesPerSample === 2) sample = view.getInt16(pos, false) / 32768;
      else if (bytesPerSample === 3) {
        let val = (data[pos] << 16) | (data[pos + 1] << 8) | data[pos + 2];
        if (val & 0x800000) val |= ~0xffffff;
        sample = val / 8388608;
      } else if (bytesPerSample === 4) {
        sample = view.getInt32(pos, false) / 2147483648;
      }
      channels[ch][i] = Math.max(-1, Math.min(1, sample));
    }
  }

  return { channels, sampleRate };
}

function resampleAndMix(
  pcm: DecodedPcm,
  targetRate?: number,
  targetChannels?: number,
  normalize?: boolean
): DecodedPcm {
  let { channels, sampleRate } = pcm;

  if (targetChannels === 1 && channels.length > 1) {
    const mono = new Float32Array(channels[0].length);
    for (let i = 0; i < mono.length; i++) {
      let sum = 0;
      for (let c = 0; c < channels.length; c++) sum += channels[c][i];
      mono[i] = sum / channels.length;
    }
    channels = [mono];
  } else if (targetChannels === 2 && channels.length === 1) {
    channels = [channels[0], new Float32Array(channels[0])];
  } else if (channels.length > 2) {
    channels = [channels[0], channels[1]];
  }

  if (targetRate && targetRate > 0 && targetRate !== sampleRate) {
    const ratio = sampleRate / targetRate;
    const outLen = Math.max(1, Math.floor(channels[0].length / ratio));
    channels = channels.map((ch) => {
      const out = new Float32Array(outLen);
      for (let i = 0; i < outLen; i++) {
        const srcIdx = i * ratio;
        const idx0 = Math.floor(srcIdx);
        const idx1 = Math.min(ch.length - 1, idx0 + 1);
        const frac = srcIdx - idx0;
        out[i] = ch[idx0] * (1 - frac) + ch[idx1] * frac;
      }
      return out;
    });
    sampleRate = targetRate;
  }

  if (normalize) {
    let peak = 0;
    for (const ch of channels) {
      for (let i = 0; i < ch.length; i++) {
        const abs = Math.abs(ch[i]);
        if (abs > peak) peak = abs;
      }
    }
    if (peak > 1e-6) {
      const gain = 0.89125 / peak;
      channels = channels.map((ch) => {
        const out = new Float32Array(ch.length);
        for (let i = 0; i < ch.length; i++) {
          out[i] = Math.max(-1, Math.min(1, ch[i] * gain));
        }
        return out;
      });
    }
  }

  return { channels, sampleRate };
}

function parseKbps(raw?: string | number): number {
  if (typeof raw === 'number' && raw > 0) return raw;
  if (!raw || raw === 'auto') return 192;
  const num = parseInt(String(raw).replace(/[^0-9]/g, ''), 10);
  const valid = [8, 16, 24, 32, 40, 48, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
  if (valid.includes(num)) return num;
  return valid.reduce((prev, curr) => (Math.abs(curr - (num || 192)) < Math.abs(prev - (num || 192)) ? curr : prev), 192);
}

export const LameJSModule: IModule = {
  manifest: {
    id: 'lamejs',
    name: 'LAME MP3 / Vorbis Encoder (WASM)',
    version: '0.7.0',
    description: 'Codificação ultrarrápida de PCM/WAV/AIFF para MP3 e Ogg Vorbis via LAME WASM.',
    category: 'audio',
    supportedModifiers: ['bitrate', 'quality', 'audio_sample_rate', 'audio_channels', 'audio_normalize'],
    supportedConversions: [
      {
        from: ['.wav', '.aiff', '.aif', '.pcm'],
        to: ['.mp3', '.ogg'],
        lossy: true,
        speedScore: 88,
        acceleration: 'cpu-singlethread',
        performanceNotes: 'Codificador LAME MP3 / Vorbis direto em memória sem sobrecarga de pipeline',
      },
    ],
    inputs: [{ id: 'file', name: 'Input File', type: 'file_handle', required: true }],
    outputs: [{ id: 'file', name: 'Output File', type: 'file_handle', required: true }],
  },

  isSupported: () => true,

  execute: async (inputs, context: ExecutionContext) => {
    const file = inputs.file as File | Blob | undefined;
    const fileData = inputs.fileData as Uint8Array | undefined;
    const originalName = inputs.originalName as string;
    const targetFormat = inputs.targetFormat as string;
    const modifiers = (inputs.modifiers || inputs.options || {}) as ConversionModifiers & {
      audioSampleRate?: number;
      audioChannels?: number;
    };

    if ((!file && !fileData) || !originalName || !targetFormat) {
      throw new Error('LAME module requires file/fileData, originalName, and targetFormat.');
    }

    const inputExt = ('.' + (originalName.split('.').pop() || 'wav')).toLowerCase();
    const targetExt = targetFormat.startsWith('.') ? targetFormat.toLowerCase() : '.' + targetFormat.toLowerCase();
    const outputFileName = originalName.replace(/\.[^.]+$/, '') + targetExt;
    const mimeType = getMimeType(targetExt);

    context.onLog(`[lamejs] Decodificando PCM de ${originalName}...`);
    context.onProgress(15, 'Lendo fluxo de áudio PCM...');

    const bytes = fileData || new Uint8Array(await (file as File | Blob).arrayBuffer());

    let decoded: DecodedPcm;
    if (inputExt === '.aiff' || inputExt === '.aif') {
      decoded = parseAiff(bytes);
    } else if (inputExt === '.pcm') {
      const chCount = modifiers.audioChannels === 1 ? 1 : 2;
      const sr = modifiers.audioSampleRate || 44100;
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const frames = Math.floor(bytes.byteLength / (2 * chCount));
      const channels = Array.from({ length: chCount }, () => new Float32Array(frames));
      for (let i = 0; i < frames; i++) {
        for (let c = 0; c < chCount; c++) {
          channels[c][i] = view.getInt16((i * chCount + c) * 2, true) / 32768;
        }
      }
      decoded = { channels, sampleRate: sr };
    } else {
      decoded = parseWav(bytes);
    }

    const targetRate = modifiers.audioSampleRate && modifiers.audioSampleRate > 0 ? modifiers.audioSampleRate : undefined;
    const targetChannels = modifiers.audioChannels === 1 || modifiers.audioChannels === 2 ? modifiers.audioChannels : undefined;
    const prepared = resampleAndMix(
      decoded,
      targetRate,
      targetChannels,
      Boolean(modifiers.audioNormalize && modifiers.audioNormalize !== 'off')
    );
    const kbps = parseKbps(modifiers.customAudioBitrateKbps ?? modifiers.audioBitrate);

    context.onProgress(40, `Codificando para ${targetExt.toUpperCase()}...`);

    const chunks: Uint8Array[] = [];
    const blockSize = 1152 * 16;

    if (targetExt === '.ogg') {
      const { createOggEncoder } = await import('wasm-media-encoders');
      const encoder = await createOggEncoder();
      encoder.configure({
        channels: prepared.channels.length as 1 | 2,
        sampleRate: prepared.sampleRate,
        vbrQuality: modifiers.qualityPreset === 'original' ? 7 : modifiers.qualityPreset === 'compressed' ? 2 : 5,
      });
      const total = prepared.channels[0].length;
      for (let i = 0; i < total; i += blockSize) {
        const end = Math.min(total, i + blockSize);
        const slice = prepared.channels.map((c) => c.subarray(i, end));
        const encoded = encoder.encode(slice);
        if (encoded.byteLength > 0) chunks.push(new Uint8Array(encoded));
        context.onProgress(40 + Math.round((end / total) * 50), 'Codificando Ogg Vorbis...');
      }
      const flushed = encoder.finalize();
      if (flushed.byteLength > 0) chunks.push(new Uint8Array(flushed));
    } else {
      try {
        const { createMp3Encoder } = await import('wasm-media-encoders');
        const encoder = await createMp3Encoder();
        encoder.configure({
          channels: prepared.channels.length as 1 | 2,
          sampleRate: prepared.sampleRate,
          bitrate: kbps as 128 | 192 | 320,
        });
        const total = prepared.channels[0].length;
        for (let i = 0; i < total; i += blockSize) {
          const end = Math.min(total, i + blockSize);
          const slice = prepared.channels.map((c) => c.subarray(i, end));
          const encoded = encoder.encode(slice);
          if (encoded.byteLength > 0) chunks.push(new Uint8Array(encoded));
          context.onProgress(40 + Math.round((end / total) * 50), 'Codificando MP3 LAME WASM...');
        }
        const flushed = encoder.finalize();
        if (flushed.byteLength > 0) chunks.push(new Uint8Array(flushed));
      } catch {
        const { Mp3Encoder } = await import('@breezystack/lamejs');
        const encoder = new Mp3Encoder(prepared.channels.length, prepared.sampleRate, kbps);
        const toInt16 = (arr: Float32Array) => {
          const out = new Int16Array(arr.length);
          for (let i = 0; i < arr.length; i++) {
            const s = Math.max(-1, Math.min(1, arr[i]));
            out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          return out;
        };
        const left = toInt16(prepared.channels[0]);
        const right = prepared.channels.length > 1 ? toInt16(prepared.channels[1]) : undefined;
        for (let i = 0; i < left.length; i += 1152) {
          const buf = right
            ? encoder.encodeBuffer(left.subarray(i, i + 1152), right.subarray(i, i + 1152))
            : encoder.encodeBuffer(left.subarray(i, i + 1152));
          if (buf.length > 0) chunks.push(new Uint8Array(buf));
        }
        const tail = encoder.flush();
        if (tail.length > 0) chunks.push(new Uint8Array(tail));
      }
    }

    const totalSize = chunks.reduce((acc, c) => acc + c.byteLength, 0);
    const outputData = new Uint8Array(totalSize);
    let writeOffset = 0;
    for (const chunk of chunks) {
      outputData.set(chunk, writeOffset);
      writeOffset += chunk.byteLength;
    }

    const outputBlob = new Blob([outputData.buffer as unknown as BlobPart], { type: mimeType });
    context.onProgress(100, 'Codificação concluída!');
    context.onLog(`[lamejs] Sucesso: ${outputFileName} (${outputData.byteLength} bytes)`);

    return {
      outputData,
      outputBlob,
      outputFileName,
      outputSize: outputData.byteLength,
      mimeType,
    };
  },
};
