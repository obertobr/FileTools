import React from 'react';
import {
  Volume2,
  Layers,
  MessageSquare,
  Cpu,
  Sparkles,
  Film,
  Maximize2,
  Gauge,
  Music,
  Clock,
  Palette,
  Binary,
  Activity,
  Compass,
} from 'lucide-react';
import type {
  ModifierCategoryId,
  ModifierContext,
  ImplicitRuleResult,
  DerivedOptionsResult,
  ConversionModifiers,
  ModifierDefinition,
} from '@/shared/types/conversionModifiers';
import {
  getVideoCodecConstraint,
  getContainerConstraint,
} from '@/core/knowledge/codecConstraints';
import {
  DEFAULT_VIDEO_RESOLUTIONS,
  DEFAULT_GIF_RESOLUTIONS,
} from '@/core/knowledge/resolutionPresets';
import {
  DEFAULT_VIDEO_FPS_OPTIONS,
  DEFAULT_GIF_FPS_OPTIONS,
} from '@/core/knowledge/fpsPresets';
import { DEFAULT_VIDEO_CODECS } from '@/core/knowledge/videoCodecs';
import { DEFAULT_AUDIO_CODECS } from '@/core/knowledge/audioCodecs';
import { DEFAULT_QUALITY_OPTIONS } from '@/core/knowledge/qualityPresets';
import {
  DEFAULT_PIXEL_FORMATS,
  DEFAULT_BIT_DEPTHS,
  DEFAULT_COLOR_SPACES,
} from '@/core/knowledge/colorPresets';

export const MODIFIER_DEFINITIONS: ModifierDefinition[] = [
  {
    id: 'video_duration',
    title: 'Duração do Vídeo',
    description: 'Defina a duração em segundos do vídeo gerado a partir da imagem.',
    icon: Clock,
    pinned: (ctx) => ctx.sourceCategory === 'image' && ctx.targetCategory === 'video',
    isApplicable: (ctx) => ctx.sourceCategory === 'image' && ctx.targetCategory === 'video',
  },
  {
    id: 'fps',
    title: 'Taxa de Quadros (FPS)',
    description: 'Ajuste a quantidade de quadros por segundo do vídeo ou animação.',
    icon: Gauge,
    pinned: (ctx) => ctx.targetExt === 'gif',
    isApplicable: (ctx) => ctx.targetCategory === 'video' || ctx.targetExt === 'gif',
    deriveOptions: (ctx) => {
      if (ctx.targetExt === 'gif') {
        return {
          allowedOptions: DEFAULT_GIF_FPS_OPTIONS,
        };
      }
      return {
        allowedOptions: DEFAULT_VIDEO_FPS_OPTIONS,
      };
    },
  },
  {
    id: 'resolution',
    title: 'Resolução e Escala',
    description: 'Redimensione as dimensões do vídeo para 1080p, 720p, 480p ou largura personalizada.',
    icon: Maximize2,
    pinned: (ctx) => ctx.targetExt === 'gif',
    isApplicable: (ctx) => ['video', 'image'].includes(ctx.targetCategory) || ctx.targetExt === 'gif',
    deriveOptions: (ctx) => {
      const constraint = getVideoCodecConstraint(ctx.targetExt, ctx.currentValues?.videoCodec);
      if (constraint?.allowedResolutions) {
        return {
          allowedOptions: constraint.allowedResolutions,
          warningMessage: constraint.warningMessage,
        };
      }
      if (ctx.targetExt === 'gif') {
        return {
          allowedOptions: DEFAULT_GIF_RESOLUTIONS,
        };
      }
      return {
        allowedOptions: DEFAULT_VIDEO_RESOLUTIONS,
      };
    },
  },
  {
    id: 'quality',
    title: 'Qualidade e Compressão',
    description: 'Ajuste a taxa de compressão e fidelidade visual do vídeo.',
    icon: Sparkles,
    pinned: false,
    isApplicable: (ctx) => ctx.targetCategory === 'video' && ctx.targetExt !== 'gif',
    deriveOptions: () => ({
      allowedOptions: DEFAULT_QUALITY_OPTIONS,
    }),
  },
  {
    id: 'video_codec',
    title: 'Codec de Vídeo',
    description: 'Escolha entre H.264, H.265/HEVC, VP8, VP9 e outros codecs suportados.',
    icon: Film,
    pinned: false,
    isApplicable: (ctx) => ctx.targetCategory === 'video' && ctx.targetExt !== 'gif',
    deriveOptions: (ctx) => {
      const containerConstraint = getContainerConstraint(ctx.targetExt);
      if (containerConstraint?.allowedVideoCodecs) {
        return {
          allowedOptions: containerConstraint.allowedVideoCodecs,
          warningMessage: containerConstraint.videoWarningMessage,
        };
      }
      return {
        allowedOptions: DEFAULT_VIDEO_CODECS,
      };
    },
  },
  {
    id: 'audio_tracks',
    title: 'Faixas de Áudio',
    description: 'Selecione quais faixas de áudio manter no contêiner de vídeo.',
    icon: Volume2,
    pinned: false,
    isApplicable: (ctx) =>
      (ctx.sourceCategory === 'video' || ctx.sourceCategory === 'audio') &&
      ctx.targetCategory === 'video' &&
      ctx.targetExt !== 'gif',
    mutuallyExclusiveWith: ['audio_merge'],
  },
  {
    id: 'audio_merge',
    title: 'Unir Faixas de Áudio',
    description: 'Mescla todas as faixas em um único canal (amix).',
    icon: Layers,
    pinned: false,
    isApplicable: (ctx) =>
      ctx.sourceCategory === 'video' &&
      (ctx.targetCategory === 'audio' || (ctx.targetCategory === 'video' && ctx.targetExt !== 'gif')),
    mutuallyExclusiveWith: ['audio_tracks'],
    implicitRule: (ctx) => {
      if (ctx.sourceCategory === 'video' && ctx.targetCategory === 'audio') {
        return {
          isImplicit: true,
          lockedValue: true,
          reason: 'Obrigatório ao extrair áudio de vídeos multifaixa.',
        };
      }
      return { isImplicit: false };
    },
  },
  {
    id: 'subtitles',
    title: 'Faixas de Legenda',
    description: 'Gerencie legendas embutidas no contêiner ou remova-as.',
    icon: MessageSquare,
    pinned: false,
    isApplicable: (ctx) =>
      ctx.sourceCategory !== 'image' &&
      ctx.sourceCategory !== 'audio' &&
      ['mp4', 'mkv', 'webm', 'mov', 'ts'].includes(ctx.targetExt),
  },
  {
    id: 'audio_codec',
    title: 'Codec de Áudio',
    description: 'Alterne entre MP3, AAC, Opus, Vorbis, FLAC e configure codecs por faixa individual.',
    icon: Music,
    pinned: false,
    isApplicable: (ctx) =>
      (ctx.targetCategory === 'video' || ctx.targetCategory === 'audio') && ctx.targetExt !== 'gif',
    deriveOptions: (ctx) => {
      const containerConstraint = getContainerConstraint(ctx.targetExt);
      if (containerConstraint?.allowedAudioCodecs) {
        return {
          allowedOptions: containerConstraint.allowedAudioCodecs,
          warningMessage: containerConstraint.audioWarningMessage,
        };
      }
      return {
        allowedOptions: DEFAULT_AUDIO_CODECS,
      };
    },
  },
  {
    id: 'pixel_format',
    title: 'Formato de Pixel (Pix Fmt)',
    description: 'Ajuste a amostragem de cores: YUV420p (universal), YUV422p, YUV444p, 10-bit ou RGB.',
    icon: Palette,
    pinned: false,
    isApplicable: (ctx) => ctx.targetCategory === 'video' && ctx.targetExt !== 'gif',
    deriveOptions: () => ({
      allowedOptions: DEFAULT_PIXEL_FORMATS,
    }),
  },
  {
    id: 'bit_depth',
    title: 'Profundidade de Cor (Bit Depth)',
    description: 'Defina 8-bit (padrão), 10-bit (HDR/Wide Range) ou 12-bit para evitar color banding.',
    icon: Binary,
    pinned: false,
    isApplicable: (ctx) => ctx.targetCategory === 'video' && ctx.targetExt !== 'gif',
    deriveOptions: () => ({
      allowedOptions: DEFAULT_BIT_DEPTHS,
    }),
  },
  {
    id: 'bitrate',
    title: 'Taxa de Bits (Bitrate)',
    description: 'Limite ou force taxas de bits específicas para os fluxos de vídeo e áudio.',
    icon: Activity,
    pinned: false,
    isApplicable: (ctx) =>
      (ctx.targetCategory === 'video' || ctx.targetCategory === 'audio') && ctx.targetExt !== 'gif',
    deriveOptions: (ctx) => ({
      allowedOptions: ctx.targetCategory === 'audio' ? ['audio_only'] : ['video_and_audio'],
    }),
  },
  {
    id: 'color_space',
    title: 'Espaço de Cor (Color Space)',
    description: 'Configure Rec. 709 (HD/Web), Rec. 2020 (4K/HDR), Rec. 601 ou sRGB.',
    icon: Compass,
    pinned: false,
    isApplicable: (ctx) => ctx.targetCategory === 'video' && ctx.targetExt !== 'gif',
    deriveOptions: () => ({
      allowedOptions: DEFAULT_COLOR_SPACES,
    }),
  },
  {
    id: 'threads',
    title: 'Threads da CPU',
    description: 'Defina a quantidade de núcleos de processamento alocados.',
    icon: Cpu,
    pinned: false,
    isApplicable: (ctx) => ctx.targetCategory === 'video' || ctx.targetCategory === 'audio',
  },
];
