import type { ModularNodeExecutor, NodeArtifactPayload } from '@/core/graph/types';
import {
  artifactToBytes,
  createPayloadFromBytes,
  decodeVideoToRgbaFrames,
  encodeRgbaFrameToPngBytes,
} from './nodeMediaUtils';

export const executeVideoToFrames: ModularNodeExecutor = async (inputs, config, context) => {
  const videoInput = inputs.video;
  if (!videoInput) {
    throw new Error('[Vídeo -> Frames] Entrada de vídeo ausente.');
  }

  const fps = Math.max(0.5, Math.min(30, Number(config.fps) || 2));
  const maxFrames = Math.max(2, Math.min(60, Number(config.maxFrames) || 12));

  context.onProgress(15, 'Lendo stream de vídeo...');
  const videoBytes = await artifactToBytes(videoInput);

  context.onProgress(35, `Extraindo quadros a ${fps} FPS...`);
  const { frames, durationSec } = await decodeVideoToRgbaFrames(
    videoBytes,
    videoInput.fileName,
    fps,
    maxFrames
  );

  const batchItems: NodeArtifactPayload[] = [];
  for (let i = 0; i < frames.length; i++) {
    if (context.signal.aborted) {
      throw new DOMException('Execução abortada pelo usuário.', 'AbortError');
    }
    const pngBytes = await encodeRgbaFrameToPngBytes(frames[i]);
    const fileName = `frame_${String(i + 1).padStart(4, '0')}.png`;
    const opfsPath = await context.writeOpfsArtifact(fileName, pngBytes);
    const payload = createPayloadFromBytes(pngBytes, fileName, 'image', {
      frameIndex: i,
      timestampSec: Number((i / fps).toFixed(3)),
      width: frames[i].width,
      height: frames[i].height,
    });
    if (opfsPath) payload.opfsPath = opfsPath;
    batchItems.push(payload);
    context.onProgress(
      35 + Math.round(((i + 1) / frames.length) * 60),
      `Quadro ${i + 1}/${frames.length} extraído`
    );
  }

  context.onProgress(100, `${batchItems.length} quadros extraídos em lote!`);
  context.onLog(`[Vídeo -> Frames] Extraídos ${batchItems.length} quadros PNG (${durationSec}s).`);

  return {
    frames: {
      kind: 'batch',
      dataType: 'batch',
      fileName: 'video_frames_batch',
      mimeType: 'application/octet-stream',
      batchItems,
      metadata: { fps, frameCount: batchItems.length, durationSec },
    },
  };
};
