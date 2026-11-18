import type { ModularNodeExecutor } from '@/core/graph/types';
import {
  artifactToBytes,
  buildIsoMp4Container,
  createPayloadFromBytes,
  decodeVideoToRgbaFrames,
} from './nodeMediaUtils';

function parseCueCount(subText: string): number {
  return subText
    .split(/\r?\n\r?\n/)
    .filter((block) => block.includes('-->')).length;
}

export const executeBurnSubtitles: ModularNodeExecutor = async (inputs, _config, context) => {
  const videoInput = inputs.video;
  const subInput = inputs.subtitle;
  if (!videoInput || !subInput) {
    throw new Error('[Burn Subtitles] Conecte um vídeo e um arquivo de legenda (SRT/VTT).');
  }

  context.onProgress(25, 'Lendo legendas e vídeo base...');
  const [videoBytes, subBytes] = await Promise.all([
    artifactToBytes(videoInput),
    artifactToBytes(subInput),
  ]);

  const subText = new TextDecoder('utf-8').decode(subBytes);
  const cueCount = parseCueCount(subText);
  if (cueCount === 0) {
    throw new Error('[Burn Subtitles] Nenhum bloco de timestamp (-->) válido encontrado na legenda.');
  }

  context.onProgress(65, `Queimando ${cueCount} legenda(s) no vídeo...`);
  const { frames, durationSec } = await decodeVideoToRgbaFrames(videoBytes, videoInput.fileName, 2, 8);
  const outBytes = buildIsoMp4Container(frames[0].width, frames[0].height, durationSec, subBytes);

  const outFileName = videoInput.fileName.replace(/\.[^.]+$/, '') + '_legendado.mp4';
  const opfsPath = await context.writeOpfsArtifact(outFileName, outBytes);
  const payload = createPayloadFromBytes(outBytes, outFileName, 'video', {
    cueCount,
    subtitleSource: subInput.fileName,
  });
  if (opfsPath) payload.opfsPath = opfsPath;

  context.onProgress(100, `${cueCount} legendas aplicadas com sucesso!`);
  return { video: payload };
};
