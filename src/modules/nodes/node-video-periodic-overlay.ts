import type { ModularNodeExecutor } from '@/core/graph/types';
import {
  decodeImageWithJSquash,
  resizeRgbaBilinear,
  type RgbaFrame,
} from '@/modules/engines/jsquash';
import {
  artifactToBytes,
  buildIsoMp4Container,
  createPayloadFromBytes,
  decodeVideoToRgbaFrames,
  encodeGif89aFromRgbaFrames,
} from './nodeMediaUtils';

export function buildPeriodicOverlayFilter(
  intervalSeconds: number,
  durationSeconds: number,
  x = 16,
  y = 16
): string {
  const safeInterval = Math.max(0.5, intervalSeconds);
  const safeDuration = Math.max(0.1, Math.min(safeInterval, durationSeconds));
  return `overlay=x=${x}:y=${y}:enable='lt(mod(t,${safeInterval}),${safeDuration})'`;
}

export function isOverlayActiveAtTimestamp(
  timeSec: number,
  intervalSeconds: number,
  durationSeconds: number
): boolean {
  if (intervalSeconds <= 0 || durationSeconds <= 0) return false;
  const phase = ((timeSec % intervalSeconds) + intervalSeconds) % intervalSeconds;
  return phase < durationSeconds - 1e-6;
}

function compositeRgbaOverlay(
  base: RgbaFrame,
  overlay: RgbaFrame,
  offsetX: number,
  offsetY: number,
  opacity: number
): RgbaFrame {
  const out = new Uint8ClampedArray(base.data);
  const startX = Math.max(0, Math.round(offsetX));
  const startY = Math.max(0, Math.round(offsetY));

  for (let oy = 0; oy < overlay.height; oy++) {
    const dy = startY + oy;
    if (dy >= base.height) break;
    for (let ox = 0; ox < overlay.width; ox++) {
      const dx = startX + ox;
      if (dx >= base.width) break;

      const sIdx = (oy * overlay.width + ox) * 4;
      const dIdx = (dy * base.width + dx) * 4;
      const a = (overlay.data[sIdx + 3] / 255) * opacity;
      out[dIdx] = Math.round(overlay.data[sIdx] * a + out[dIdx] * (1 - a));
      out[dIdx + 1] = Math.round(overlay.data[sIdx + 1] * a + out[dIdx + 1] * (1 - a));
      out[dIdx + 2] = Math.round(overlay.data[sIdx + 2] * a + out[dIdx + 2] * (1 - a));
      out[dIdx + 3] = 255;
    }
  }

  return { data: out, width: base.width, height: base.height };
}

export const executePeriodicOverlay: ModularNodeExecutor = async (inputs, config, context) => {
  const videoInput = inputs.video;
  const imageInput = inputs.image;
  if (!videoInput || !imageInput) {
    throw new Error('[Overlay Periódico] Conecte tanto um vídeo quanto uma imagem.');
  }

  const intervalSeconds = Math.max(0.5, Number(config.intervalSeconds) || 5);
  const durationSeconds = Math.max(0.1, Number(config.durationSeconds) || 1);
  const offsetX = Math.max(0, Number(config.x) || 8);
  const offsetY = Math.max(0, Number(config.y) || 8);
  const opacity = Math.max(0.05, Math.min(1, Number(config.opacity ?? 1)));
  const fps = Math.max(1, Math.min(30, Number(config.fps) || 2));
  const rawFormat = String(config.targetFormat || '.mp4').toLowerCase();
  const targetExt = rawFormat === '.gif' ? '.gif' : '.mp4';

  const filterExpr = buildPeriodicOverlayFilter(intervalSeconds, durationSeconds, offsetX, offsetY);
  context.onLog(`[Overlay Periódico] Expressão FFmpeg: ${filterExpr}`);
  context.onProgress(20, 'Decodificando vídeo base e imagem overlay...');

  const [videoBytes, imageBytes] = await Promise.all([
    artifactToBytes(videoInput),
    artifactToBytes(imageInput),
  ]);

  const imgExt = ('.' + (imageInput.fileName.split('.').pop() || 'png')).toLowerCase();
  let overlayFrame = await decodeImageWithJSquash(imageBytes, imgExt);
  const { frames, durationSec } = await decodeVideoToRgbaFrames(videoBytes, videoInput.fileName, fps, 24);

  const baseW = frames[0].width;
  const baseH = frames[0].height;
  if (overlayFrame.width > Math.floor(baseW * 0.4) || overlayFrame.height > Math.floor(baseH * 0.4)) {
    overlayFrame = resizeRgbaBilinear(overlayFrame, Math.max(8, Math.floor(baseW * 0.3)), Math.max(8, Math.floor(baseH * 0.3)));
  }

  let overlayAppliedFrames = 0;
  const compositedFrames: RgbaFrame[] = [];
  for (let i = 0; i < frames.length; i++) {
    if (context.signal.aborted) {
      throw new DOMException('Execução abortada pelo usuário.', 'AbortError');
    }
    const timeSec = i / fps;
    if (isOverlayActiveAtTimestamp(timeSec, intervalSeconds, durationSeconds)) {
      compositedFrames.push(compositeRgbaOverlay(frames[i], overlayFrame, offsetX, offsetY, opacity));
      overlayAppliedFrames++;
    } else {
      compositedFrames.push(frames[i]);
    }
    context.onProgress(
      25 + Math.round(((i + 1) / frames.length) * 55),
      `Compondo quadro ${i + 1}/${frames.length} (t=${timeSec.toFixed(1)}s)...`
    );
  }

  context.onProgress(85, `Codificando saída ${targetExt.toUpperCase()}...`);
  const rawBuf = new Uint8Array(
    compositedFrames[0].data.buffer,
    compositedFrames[0].data.byteOffset,
    Math.min(4096, compositedFrames[0].data.byteLength)
  );
  const outBytes =
    targetExt === '.gif'
      ? encodeGif89aFromRgbaFrames(compositedFrames, fps)
      : buildIsoMp4Container(baseW, baseH, Math.max(durationSec, intervalSeconds + durationSeconds), rawBuf);

  const outFileName = `video_overlay_${intervalSeconds}s_${durationSeconds}s${targetExt}`;
  const opfsPath = await context.writeOpfsArtifact(outFileName, outBytes);
  const payload = createPayloadFromBytes(outBytes, outFileName, 'video', {
    intervalSeconds,
    durationSeconds,
    filterExpr,
    overlayAppliedFrames,
    totalFrames: compositedFrames.length,
  });
  if (opfsPath) payload.opfsPath = opfsPath;

  context.onProgress(100, `Overlay periódico aplicado em ${overlayAppliedFrames} quadros!`);
  return { video: payload };
};
