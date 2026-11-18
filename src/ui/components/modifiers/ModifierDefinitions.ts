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
  BookOpen,
  ShieldCheck,
  Printer,
  Scissors,
  Sliders,
  RotateCw,
  PaintBucket,
  Archive,
  KeyRound,
  Wand2,
  Type,
  Box,
  Table,
  AudioWaveform,
  Speaker,
} from 'lucide-react';
import {
  LOSSY_IMAGE_FORMATS,
  ALPHA_CAPABLE_IMAGES,
  OPAQUE_IMAGE_TARGETS,
} from '@/core/knowledge/modifierPresets';
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
    description: 'Ajuste a taxa de compressão e fidelidade visual do vídeo, imagem ou PDF.',
    icon: Sparkles,
    pinned: false,
    isApplicable: (ctx) =>
      (ctx.targetCategory === 'video' && ctx.targetExt !== 'gif') ||
      (ctx.targetCategory === 'image' && LOSSY_IMAGE_FORMATS.includes(ctx.targetExt)) ||
      ctx.targetExt === 'pdf',
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
  {
    id: 'page_range',
    title: 'Intervalo de Páginas',
    description: 'Selecione páginas específicas, intervalo ou a primeira página (capa).',
    icon: BookOpen,
    pinned: (ctx) => ctx.targetCategory === 'document' || ctx.sourceCategory === 'document',
    isApplicable: (ctx) =>
      ctx.targetCategory === 'document' ||
      ctx.sourceCategory === 'document' ||
      ctx.sourceCategory === 'ebook',
  },
  {
    id: 'pdf_compliance',
    title: 'Padrão PDF / PDF/A',
    description: 'Conformidade com o padrão ISO PDF/A para arquivamento oficial e legal a longo prazo.',
    icon: ShieldCheck,
    pinned: (ctx) => ctx.targetExt === 'pdf',
    isApplicable: (ctx) => ctx.targetExt === 'pdf',
  },
  {
    id: 'image_dpi',
    title: 'Resolução DPI (Densidade)',
    description: 'Defina a resolução de rasterização da imagem em pontos por polegada (72 a 600 DPI).',
    icon: Printer,
    pinned: (ctx) => ctx.sourceCategory === 'document' && ctx.targetCategory === 'image',
    isApplicable: (ctx) => ctx.targetCategory === 'image',
  },
  {
    id: 'audio_sample_rate',
    title: 'Taxa de Amostragem (Hz)',
    description: 'Defina a frequência de amostragem do áudio (8 kHz até 96 kHz).',
    icon: AudioWaveform,
    pinned: false,
    isApplicable: (ctx) =>
      ctx.targetCategory === 'audio' || (ctx.targetCategory === 'video' && ctx.targetExt !== 'gif'),
  },
  {
    id: 'audio_channels',
    title: 'Canais de Áudio',
    description: 'Alterne entre áudio Mono (1.0) ou Estéreo (2.0).',
    icon: Speaker,
    pinned: false,
    isApplicable: (ctx) =>
      ctx.targetCategory === 'audio' || (ctx.targetCategory === 'video' && ctx.targetExt !== 'gif'),
  },
  {
    id: 'audio_normalize',
    title: 'Normalização de Volume',
    description: 'Nivele o volume com EBU R128 ou normalização de pico sem distorção.',
    icon: Sliders,
    pinned: false,
    isApplicable: (ctx) =>
      ctx.targetCategory === 'audio' || (ctx.targetCategory === 'video' && ctx.targetExt !== 'gif'),
  },
  {
    id: 'media_trim',
    title: 'Corte Temporal (Trim)',
    description: 'Recorte um trecho específico definindo tempo inicial e final em segundos.',
    icon: Scissors,
    pinned: false,
    isApplicable: (ctx) =>
      (['video', 'audio'].includes(ctx.sourceCategory) && ['video', 'audio'].includes(ctx.targetCategory)) ||
      (ctx.sourceCategory === 'video' && ctx.targetExt === 'gif'),
  },
  {
    id: 'image_transform',
    title: 'Rotação & Transformação',
    description: 'Rotacione, espelhe, converta para escala de cinza ou remova metadados EXIF.',
    icon: RotateCw,
    pinned: false,
    isApplicable: (ctx) => ctx.targetCategory === 'image' && ctx.targetExt !== 'svg',
  },
  {
    id: 'background_color',
    title: 'Cor de Fundo (Alpha)',
    description: 'Preencha áreas transparentes ao converter SVG/PNG para formatos opacos como JPG.',
    icon: PaintBucket,
    pinned: (ctx) =>
      ALPHA_CAPABLE_IMAGES.includes(ctx.sourceExt) && OPAQUE_IMAGE_TARGETS.includes(ctx.targetExt),
    isApplicable: (ctx) =>
      ctx.targetCategory === 'image' &&
      (OPAQUE_IMAGE_TARGETS.includes(ctx.targetExt) || ctx.sourceExt === 'svg'),
    implicitRule: (ctx) => {
      if (ALPHA_CAPABLE_IMAGES.includes(ctx.sourceExt) && OPAQUE_IMAGE_TARGETS.includes(ctx.targetExt)) {
        return {
          isImplicit: true,
          lockedValue: ctx.currentValues.backgroundColor || '#ffffff',
          reason: 'Fundo sólido necessário para canal alfa em formato opaco.',
        };
      }
      return { isImplicit: false };
    },
  },
  {
    id: 'archive_compression',
    title: 'Nível de Compressão',
    description: 'Controle entre empacotamento instantâneo (Store 0) ou compressão máxima (9).',
    icon: Archive,
    pinned: false,
    isApplicable: (ctx) => ctx.targetCategory === 'archive',
  },
  {
    id: 'archive_password',
    title: 'Senha / Criptografia',
    description: 'Defina senha AES-256 para proteger arquivos ZIP/7Z ou descriptografar a entrada.',
    icon: KeyRound,
    pinned: false,
    isApplicable: (ctx) =>
      ['zip', '7z'].includes(ctx.targetExt) || ['zip', '7z', 'rar'].includes(ctx.sourceExt),
  },
  {
    id: 'svg_optimize',
    title: 'Otimização Vetorial SVG',
    description: 'Configure precisão decimal de paths, multipass e remoção de dimensões fixas.',
    icon: Wand2,
    pinned: (ctx) => ctx.sourceExt === 'svg' && ctx.targetExt === 'svg',
    isApplicable: (ctx) => ctx.sourceExt === 'svg' && ctx.targetExt === 'svg',
  },
  {
    id: 'font_subset',
    title: 'Subsetting de Glifos (Fonte)',
    description: 'Mantenha apenas os caracteres informados para reduzir drasticamente o arquivo de fonte.',
    icon: Type,
    pinned: false,
    isApplicable: (ctx) => ctx.sourceCategory === 'font' && ctx.targetCategory === 'font',
  },
  {
    id: 'cad_tessellation',
    title: 'Precisão de Malha CAD',
    description: 'Ajuste a densidade de triângulos ao tesselar modelos paramétricos STEP/IGES/BREP.',
    icon: Box,
    pinned: (ctx) => ['step', 'stp', 'iges', 'igs', 'brep'].includes(ctx.sourceExt) && ctx.targetCategory === 'model3d',
    isApplicable: (ctx) => ['step', 'stp', 'iges', 'igs', 'brep'].includes(ctx.sourceExt) && ctx.targetCategory === 'model3d',
  },
  {
    id: 'mesh_options',
    title: 'Opções de Malha 3D',
    description: 'Aplique escala de unidades (mm/cm/m) ou exporte STL ASCII/Binário.',
    icon: Box,
    pinned: false,
    isApplicable: (ctx) => ctx.sourceCategory === 'model3d' && ctx.targetCategory === 'model3d',
  },
  {
    id: 'csv_delimiter',
    title: 'Delimitador CSV/Planilha',
    description: 'Escolha o separador de colunas (vírgula, ponto e vírgula, tabulação ou pipe).',
    icon: Table,
    pinned: false,
    isApplicable: (ctx) =>
      ['csv', 'tsv', 'txt'].includes(ctx.sourceExt) || ['csv', 'tsv'].includes(ctx.targetExt),
  },
];
