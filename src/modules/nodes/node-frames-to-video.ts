import type { ModularNodeExecutor } from '@/core/graph/types';
import type { RgbaFrame } from '@/modules/engines/jsquash';
import {
  artifactToBytes,
  buildIsoMp4Container,
  createPayloadFromBytes,
  decodePngBytesToRgbaFrame,
  encodeGif89aFromRgbaFrames,
} from './nodeMediaUtils';

export const executeFramesToVideo: ModularNodeExecutor = async (inputs, config, context) => {
  const framesBatch = inputs.frames;
  if (!framesBatch || framesBatch.kind !== 'batch' || !framesBatch.batchItems?.length) {
    throw new Error('[Frames -> Vídeo] Entrada de lote (batch<image>) vazia ou ausente.');
  }

  const items = framesBatch.batchItems;
  const fps = Math.max(1, Math.min(60, Number(config.fps) || 4));
  const rawFormat = String(config.targetFormat || '.mp4').toLowerCase();
  const targetExt = rawFormat === '.gif' ? '.gif' : '.mp4';

  context.onProgress(15, `Carregando ${items.length} quadros para remontagem...`);
  const rgbaFrames: RgbaFrame[] = [];
  for (let i = 0; i < items.length; i++) {
    if (context.signal.aborted) {
      throw new DOMException('Execução abortada pelo usuário.', 'AbortError');
    }
    const bytes = await artifactToBytes(items[i]);
    const frame = await decodePngBytesToRgbaFrame(bytes);
    rgbaFrames.push(frame);
    context.onProgress(
      15 + Math.round(((i + 1) / items.length) * 45),
      `Decodificando quadro ${i + 1}/${items.length}...`
    );
  }

  context.onProgress(75, `Empacotando vídeo final (${targetExt.toUpperCase()}) a ${fps} FPS...`);
  let outBytes: Uint8Array;
  if (targetExt === '.gif') {
    outBytes = encodeGif89aFromRgbaFrames(rgbaFrames, fps);
  } else {
    const first = rgbaFrames[0];
    const durationSec = Math.max(1, rgbaFrames.length / fps);
    const totalRaw = rgbaFrames.reduce((s, f) => s + f.data.byteLength, 0);
    const rawStream = new Uint8Array(Math.min(totalRaw, 65536));
    let off = 0;
    for (const f of rgbaFrames) {
      const sliceLen = Math.min(f.data.byteLength, rawStream.byteLength - off);
      if (sliceLen <= 0) break;
      rawStream.set(f.data.subarray(0, sliceLen), off);
      off += sliceLen;
    }
    outBytes = buildIsoMp4Container(first.width, first.height, durationSec, rawStream);
  }

  const outFileName = `video_remontado${targetExt}`;
  const opfsPath = await context.writeOpfsArtifact(outFileName, outBytes);
  const payload = createPayloadFromBytes(outBytes, outFileName, 'video', {
    fps,
    frameCount: rgbaFrames.length,
    width: rgbaFrames[0].width,
    height: rgbaFrames[0].height,
  });
  if (opfsPath) payload.opfsPath = opfsPath;

  context.onProgress(100, `Vídeo remontado (${rgbaFrames.length} quadros)!`);
  context.onLog(`[Frames -> Vídeo] Gerado ${outFileName} (${outBytes.byteLength} bytes).`);

  return { video: payload };
};
