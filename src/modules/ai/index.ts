import { AIBgRemoveModule } from './ai-bg-remove';
import { AIWhisperSttModule } from './ai-whisper-stt';
import { AIDictionCoachModule } from './ai-diction-coach';
import { AITtsKokoroModule } from './ai-tts-kokoro';
import { AIUpscalerModule } from './ai-upscaler';
import { AIOcrModule } from './ai-ocr';
import { AIAudioDenoiseModule } from './ai-audio-denoise';
import { AIDepthMapModule } from './ai-depth-map';
import type { IModule } from '@/shared/types/module';

export const AI_MODULES: IModule[] = [
  AIBgRemoveModule,
  AIWhisperSttModule,
  AIDictionCoachModule,
  AITtsKokoroModule,
  AIUpscalerModule,
  AIOcrModule,
  AIAudioDenoiseModule,
  AIDepthMapModule,
];

export {
  AIBgRemoveModule,
  AIWhisperSttModule,
  AIDictionCoachModule,
  AITtsKokoroModule,
  AIUpscalerModule,
  AIOcrModule,
  AIAudioDenoiseModule,
  AIDepthMapModule,
};
