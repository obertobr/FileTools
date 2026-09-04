import React from 'react';
import { Volume2, MessageSquare, Cpu, Sparkles, Film, Maximize2, Gauge } from 'lucide-react';
import type { ConfigCategoryId } from '@/shared/types/conversionOptions';

export interface CategoryDefinition {
  id: ConfigCategoryId;
  title: string;
  description: string;
  icon: React.ElementType;
  isApplicable: (target: string, isMT: boolean) => boolean;
  isPinned?: (target: string) => boolean;
}

export const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    id: 'fps',
    title: 'Taxa de Quadros (FPS)',
    description: 'Ajuste a quantidade de quadros por segundo do vídeo ou animação.',
    icon: Gauge,
    isApplicable: (target) => ['gif', 'mp4', 'webm'].includes(target),
    isPinned: (target) => target === 'gif',
  },
  {
    id: 'resolution',
    title: 'Resolução e Escala',
    description: 'Redimensione as dimensões do vídeo para 1080p, 720p, 480p ou largura personalizada.',
    icon: Maximize2,
    isApplicable: (target) => ['gif', 'mp4', 'mkv', 'webm', 'mov'].includes(target),
    isPinned: (target) => target === 'gif',
  },
  {
    id: 'audio_tracks',
    title: 'Faixas de Áudio',
    description: 'Selecione quais canais de áudio reais incluir ou isolar.',
    icon: Volume2,
    isApplicable: (target) => target !== 'gif',
  },
  {
    id: 'subtitles',
    title: 'Faixas de Legenda',
    description: 'Gerencie legendas embutidas no contêiner ou remova-as.',
    icon: MessageSquare,
    isApplicable: (target) => ['mp4', 'mkv', 'webm', 'mov'].includes(target),
  },
  {
    id: 'threads',
    title: 'Threads da CPU',
    description: 'Defina a quantidade de núcleos de processamento alocados.',
    icon: Cpu,
    isApplicable: (_target, isMT) => isMT,
  },
  {
    id: 'quality',
    title: 'Qualidade e Compressão',
    description: 'Ajuste a taxa de compressão e fidelidade visual do vídeo.',
    icon: Sparkles,
    isApplicable: (target) => ['mp4', 'mkv', 'webm', 'mov', 'avi'].includes(target),
  },
  {
    id: 'video_codec',
    title: 'Codec de Vídeo',
    description: 'Alterne entre H.264, VP8 e outros formatos de codificação.',
    icon: Film,
    isApplicable: (target) => ['mp4', 'mkv', 'webm'].includes(target),
  },
];
