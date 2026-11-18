export interface PcmAudio {
  channels: Float32Array[];
  sampleRate: number;
}

export interface AcousticSegment {
  startSec: number;
  endSec: number;
  rms: number;
  isVoiced: boolean;
}

export interface AcousticMetrics {
  durationSec: number;
  voicedDurationSec: number;
  silenceDurationSec: number;
  pauseCount: number;
  estimatedWpm: number;
  snrDb: number;
  peakDb: number;
  clarityScore: number;
  segments: AcousticSegment[];
}

export function parseWavToPcm(data: Uint8Array): PcmAudio {
  if (data.byteLength < 44) {
    throw new Error('[AI Audio] Arquivo WAV inválido ou truncado.');
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
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
      numChannels = Math.max(1, view.getUint16(body + 2, true));
      sampleRate = view.getUint32(body + 4, true) || 44100;
      bitsPerSample = view.getUint16(body + 14, true) || 16;
    } else if (id === 'data') {
      dataStart = body;
      dataLength = Math.min(size, data.byteLength - body);
      break;
    }

    offset = body + size + (size % 2);
  }

  if (dataLength <= 0) {
    throw new Error('[AI Audio] Chunk PCM data não encontrado.');
  }

  const bytesPerSample = Math.max(1, Math.floor(bitsPerSample / 8));
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
        let v = data[pos] | (data[pos + 1] << 8) | (data[pos + 2] << 16);
        if (v & 0x800000) v |= ~0xffffff;
        sample = v / 8388608;
      } else if (bitsPerSample === 32) {
        sample = view.getInt32(pos, true) / 2147483648;
      }
      channels[ch][i] = Math.max(-1, Math.min(1, sample));
    }
  }

  return { channels, sampleRate };
}

export async function decodeAnyAudioToPcm(bytes: Uint8Array, ext: string): Promise<PcmAudio> {
  const clean = ext.toLowerCase();
  if (clean === '.wav' || (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46)) {
    return parseWavToPcm(bytes);
  }

  if (typeof AudioContext !== 'undefined') {
    const ctx = new AudioContext();
    try {
      const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const decoded = await ctx.decodeAudioData(ab);
      const channels: Float32Array[] = [];
      for (let c = 0; c < decoded.numberOfChannels; c++) {
        channels.push(new Float32Array(decoded.getChannelData(c)));
      }
      return { channels, sampleRate: decoded.sampleRate };
    } finally {
      await ctx.close().catch(() => {});
    }
  }

  throw new Error(`[AI Audio] Decodificação de '${clean}' requer ambiente Web Audio API ou entrada WAV.`);
}

export function encodePcmToWav(channels: Float32Array[], sampleRate: number): Uint8Array {
  const numChannels = Math.max(1, channels.length);
  const frameCount = channels[0]?.length || 0;
  const bitsPerSample = 16;
  const blockAlign = numChannels * 2;
  const byteRate = sampleRate * blockAlign;
  const dataSize = frameCount * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (off: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let pos = 44;
  for (let i = 0; i < frameCount; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i] ?? 0));
      view.setInt16(pos, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      pos += 2;
    }
  }

  return new Uint8Array(buffer);
}

export function mixToMono(pcm: PcmAudio): Float32Array {
  if (pcm.channels.length === 1) return pcm.channels[0];
  const len = pcm.channels[0].length;
  const mono = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    let sum = 0;
    for (let c = 0; c < pcm.channels.length; c++) {
      sum += pcm.channels[c][i];
    }
    mono[i] = sum / pcm.channels.length;
  }
  return mono;
}

export function analyzeAcousticSpeech(mono: Float32Array, sampleRate: number): AcousticMetrics {
  const durationSec = mono.length / Math.max(1, sampleRate);
  const frameLen = Math.max(64, Math.floor(sampleRate * 0.025));
  const frameEnergies: number[] = [];
  let maxAbs = 1e-7;

  for (let i = 0; i < mono.length; i++) {
    const abs = Math.abs(mono[i]);
    if (abs > maxAbs) maxAbs = abs;
  }

  for (let start = 0; start < mono.length; start += frameLen) {
    const end = Math.min(mono.length, start + frameLen);
    let sq = 0;
    for (let i = start; i < end; i++) sq += mono[i] * mono[i];
    frameEnergies.push(Math.sqrt(sq / Math.max(1, end - start)));
  }

  const sorted = [...frameEnergies].sort((a, b) => a - b);
  const noiseFloor = sorted[Math.floor(sorted.length * 0.15)] ?? 0.002;
  const speechThreshold = Math.max(noiseFloor * 2.2, maxAbs * 0.08, 0.004);

  const segments: AcousticSegment[] = [];
  let currentVoiced: boolean | null = null;
  let segStartIdx = 0;
  let segRmsAcc = 0;
  let segCount = 0;
  let voicedFrames = 0;
  let signalEnergySum = 0;

  for (let f = 0; f < frameEnergies.length; f++) {
    const e = frameEnergies[f];
    const voiced = e >= speechThreshold;
    if (voiced) {
      voicedFrames++;
      signalEnergySum += e;
    }

    if (currentVoiced === null) {
      currentVoiced = voiced;
      segStartIdx = f;
      segRmsAcc = e;
      segCount = 1;
    } else if (currentVoiced === voiced) {
      segRmsAcc += e;
      segCount++;
    } else {
      segments.push({
        startSec: (segStartIdx * frameLen) / sampleRate,
        endSec: Math.min(durationSec, (f * frameLen) / sampleRate),
        rms: segRmsAcc / Math.max(1, segCount),
        isVoiced: currentVoiced,
      });
      currentVoiced = voiced;
      segStartIdx = f;
      segRmsAcc = e;
      segCount = 1;
    }
  }

  if (currentVoiced !== null) {
    segments.push({
      startSec: (segStartIdx * frameLen) / sampleRate,
      endSec: durationSec,
      rms: segRmsAcc / Math.max(1, segCount),
      isVoiced: currentVoiced,
    });
  }

  const voicedSegments = segments.filter((s) => s.isVoiced && s.endSec - s.startSec >= 0.06);
  const longPauses = segments.filter((s) => !s.isVoiced && s.endSec - s.startSec >= 0.28);

  const voicedDurationSec = (voicedFrames * frameLen) / sampleRate;
  const silenceDurationSec = Math.max(0, durationSec - voicedDurationSec);

  const avgSignal = voicedFrames > 0 ? signalEnergySum / voicedFrames : maxAbs * 0.5;
  const snrDb = Math.max(0, Math.min(60, 20 * Math.log10(Math.max(1e-5, avgSignal) / Math.max(1e-5, noiseFloor))));
  const peakDb = 20 * Math.log10(Math.max(1e-5, maxAbs));

  // Syllabic / modulation rate estimate mapped into realistic conversational WPM
  let modulationPeaks = 0;
  for (let f = 1; f < frameEnergies.length - 1; f++) {
    if (
      frameEnergies[f] >= speechThreshold &&
      frameEnergies[f] > frameEnergies[f - 1] * 1.05 &&
      frameEnergies[f] >= frameEnergies[f + 1]
    ) {
      modulationPeaks++;
    }
  }
  const effectiveDurationMin = Math.max(1 / 60, durationSec / 60);
  const estimatedWords = Math.max(voicedSegments.length, Math.round(modulationPeaks / 2.2));
  const estimatedWpm = Math.round(Math.min(260, Math.max(0, estimatedWords / effectiveDurationMin)));

  const snrFactor = Math.min(45, (snrDb / 28) * 45);
  const wpmBalance =
    estimatedWpm === 0
      ? 10
      : estimatedWpm >= 110 && estimatedWpm <= 165
      ? 35
      : Math.max(12, 35 - Math.abs(estimatedWpm - 138) * 0.25);
  const levelFactor = peakDb > -24 && peakDb < -0.5 ? 20 : 12;
  const clarityScore = Math.round(Math.max(15, Math.min(99, snrFactor + wpmBalance + levelFactor)));

  return {
    durationSec: Number(durationSec.toFixed(2)),
    voicedDurationSec: Number(voicedDurationSec.toFixed(2)),
    silenceDurationSec: Number(silenceDurationSec.toFixed(2)),
    pauseCount: longPauses.length,
    estimatedWpm,
    snrDb: Number(snrDb.toFixed(1)),
    peakDb: Number(peakDb.toFixed(1)),
    clarityScore,
    segments,
  };
}

export function synthesizeSpeechPcm(
  text: string,
  sampleRate = 22050,
  voice: 'pt-br' | 'en-us' | 'neutral' = 'pt-br',
  speed = 1.0
): PcmAudio {
  const cleanText = (text || 'Olá, teste de síntese local FileTools.').trim();
  const basePitch = voice === 'en-us' ? 148 : voice === 'pt-br' ? 168 : 132;
  const charDuration = Math.max(0.032, Math.min(0.11, 0.062 / Math.max(0.5, Math.min(2.0, speed))));
  const samplesPerChar = Math.floor(sampleRate * charDuration);
  const totalSamples = Math.max(sampleRate * 0.6, cleanText.length * samplesPerChar);
  const out = new Float32Array(Math.ceil(totalSamples));

  const formants: Record<string, [number, number]> = {
    a: [730, 1090],
    e: [530, 1840],
    i: [270, 2290],
    o: [570, 840],
    u: [300, 870],
  };

  let cursor = 0;
  for (let idx = 0; idx < cleanText.length && cursor < out.length; idx++) {
    const ch = cleanText[idx].toLowerCase();
    const isSpaceOrPunct = /[\s,.;:!?]/.test(ch);
    const len = Math.min(samplesPerChar, out.length - cursor);

    if (!isSpaceOrPunct) {
      const code = ch.charCodeAt(0);
      const pitchMod = 1 + 0.08 * Math.sin(idx * 0.35) - (idx / cleanText.length) * 0.06;
      const f0 = basePitch * pitchMod;
      const [f1, f2] = formants[ch] || [420 + (code % 5) * 75, 1100 + (code % 7) * 160];

      for (let n = 0; n < len; n++) {
        const t = n / sampleRate;
        const env = Math.sin((Math.PI * n) / Math.max(1, len));
        const carrier =
          0.55 * Math.sin(2 * Math.PI * f0 * t) +
          0.28 * Math.sin(2 * Math.PI * f1 * t) +
          0.12 * Math.sin(2 * Math.PI * f2 * t);
        out[cursor + n] = carrier * env * 0.65;
      }
    }
    cursor += len;
  }

  return { channels: [out], sampleRate };
}
