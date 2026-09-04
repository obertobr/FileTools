import React from 'react';
import { Volume2, Layers, MessageSquare, Cpu, Sparkles, Film, Maximize2, Gauge, Music, Clock } from 'lucide-react';
import type { ConfigCategoryId } from '@/shared/types/conversionOptions';
import { categoryOfExtension } from '@/lib/formats';

export interface CategoryDefinition {
  id: ConfigCategoryId;
  title: string;
  description: string;
  icon: React.ElementType;
  isApplicable: (target: string, isMT: boolean, sourceExt?: string) => boolean;
  isPinned?: (target: string, sourceExt?: string) => boolean;
}

export const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    id: 'video_duration',
    title: 'Duração do Vídeo',
    description: 'Defina a duração em segundos do vídeo gerado a partir da imagem.',
    icon: Clock,
    isApplicable: (target, _isMT, sourceExt) => {
      const srcCat = categoryOfExtension(sourceExt || '');
      const tgtCat = categoryOfExtension(target);
      // Exclusivamente para imagem convertida em vídeo. NUNCA para foto para foto!
      return srcCat === 'image' && tgtCat === 'video';
    },
    isPinned: (target, sourceExt) => {
      const srcCat = categoryOfExtension(sourceExt || '');
      const tgtCat = categoryOfExtension(target);
      return srcCat === 'image' && tgtCat === 'video';
    },
  },
  {
    id: 'fps',
    title: 'Taxa de Quadros (FPS)',
    description: 'Ajuste a quantidade de quadros por segundo do vídeo ou animação.',
    icon: Gauge,
    isApplicable: (target) => {
      const tgtCat = categoryOfExtension(target);
      return tgtCat === 'video' || target === 'gif';
    },
    isPinned: (target) => target === 'gif',
  },
  {
    id: 'resolution',
    title: 'Resolução e Escala',
    description: 'Redimensione as dimensões do vídeo para 1080p, 720p, 480p ou largura personalizada.',
    icon: Maximize2,
    isApplicable: (target) => {
      const tgtCat = categoryOfExtension(target);
      return tgtCat === 'video' || target === 'gif';
    },
    isPinned: (target) => target === 'gif',
  },
  {
    id: 'quality',
    title: 'Qualidade e Compressão',
    description: 'Ajuste a taxa de compressão e fidelidade visual do vídeo.',
    icon: Sparkles,
    isApplicable: (target) => {
      const tgtCat = categoryOfExtension(target);
      return tgtCat === 'video';
    },
  },
  {
    id: 'video_codec',
    title: 'Codec de Vídeo',
    description: 'Escolha entre H.264, H.265/HEVC, VP8, VP9 e outros codecs suportados.',
    icon: Film,
    isApplicable: (target) => {
      const tgtCat = categoryOfExtension(target);
      return tgtCat === 'video';
    },
  },
  {
    id: 'audio_tracks',
    title: 'Faixas de Áudio',
    description: 'Selecione quais faixas de áudio manter no contêiner de vídeo.',
    icon: Volume2,
    isApplicable: (target, _isMT, sourceExt) => {
      const srcCat = categoryOfExtension(sourceExt || '');
      const tgtCat = categoryOfExtension(target);
      // Disponível para saída de vídeo quando a origem possui áudio (vídeo ou áudio)
      return (srcCat === 'video' || srcCat === 'audio') && tgtCat === 'video' && target !== 'gif';
    },
  },
  {
    id: 'audio_merge',
    title: 'Juntar Faixas de Áudio',
    description: 'Mixe múltiplas faixas de áudio em uma única faixa final (ideal para gravações de OBS, microfone + sistema).',
    icon: Layers,
    isApplicable: (target, _isMT, sourceExt) => {
      const srcCat = categoryOfExtension(sourceExt || '');
      const tgtCat = categoryOfExtension(target);
      // Aplicável tanto para exportação de vídeo para áudio quanto vídeo para vídeo!
      return srcCat === 'video' && (tgtCat === 'audio' || (tgtCat === 'video' && target !== 'gif'));
    },
  },
  {
    id: 'subtitles',
    title: 'Faixas de Legenda',
    description: 'Gerencie legendas embutidas no contêiner ou remova-as.',
    icon: MessageSquare,
    isApplicable: (target, _isMT, sourceExt) => {
      const srcCat = categoryOfExtension(sourceExt || '');
      if (srcCat === 'image' || srcCat === 'document' || srcCat === 'audio') return false;
      return ['mp4', 'mkv', 'webm', 'mov', 'ts'].includes(target);
    },
  },
  {
    id: 'audio_codec',
    title: 'Codec de Áudio',
    description: 'Alterne entre MP3, AAC, Opus, Vorbis, FLAC e outros formatos de áudio.',
    icon: Music,
    isApplicable: (target, _isMT, sourceExt) => {
      const srcCat = categoryOfExtension(sourceExt || '');
      const tgtCat = categoryOfExtension(target);
      if (srcCat === 'image' || srcCat === 'document' || target === 'gif') return false;
      return tgtCat === 'video' || tgtCat === 'audio';
    },
  },
  {
    id: 'threads',
    title: 'Threads da CPU',
    description: 'Defina a quantidade de núcleos de processamento alocados.',
    icon: Cpu,
    isApplicable: (_target, isMT) => isMT,
  },
];
