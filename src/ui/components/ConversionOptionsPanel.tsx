import React, { useState, useMemo, useEffect } from 'react';
import {
  Sliders,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Info,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import type {
  ConversionOptions,
  ConfigCategoryId,
  QualityPreset,
  VideoCodecChoice,
  AudioCodecChoice,
} from '@/shared/types/conversionOptions';
import type { MediaProbeResult } from '@/core/media/mediaProbe';
import { Card, Typography, Badge, Button } from '@/ui/components/core';
import { cn } from '@/lib/utils';
import { CATEGORY_DEFINITIONS } from './options/CategoryDefinitions';
import { AudioTracksCard } from './options/AudioTracksCard';
import { AudioMergeCard } from './options/AudioMergeCard';
import { SubtitlesCard } from './options/SubtitlesCard';
import { FpsCard } from './options/FpsCard';
import { ResolutionCard } from './options/ResolutionCard';
import { DurationCard } from './options/DurationCard';
import { categoryOfExtension } from '@/lib/formats';
import { AddCategoryPicker } from './options/AddCategoryPicker';
import {
  checkEngineCompatibility,
  isCategoryIncompatibleWithEngine,
} from '@/modules/engineCapabilities';

export interface ConversionOptionsPanelProps {
  targetFormat: string;
  sourceExt?: string;
  options: ConversionOptions;
  onChange: (updated: ConversionOptions) => void;
  isMultiThreadEngine?: boolean;
  probedMedia?: MediaProbeResult;
  selectedEngineId?: string | null;
  onSelectEngine?: (engineId: string) => void;
}

export function ConversionOptionsPanel({
  targetFormat,
  sourceExt,
  options,
  onChange,
  isMultiThreadEngine = true,
  probedMedia,
  selectedEngineId,
  onSelectEngine,
}: ConversionOptionsPanelProps) {
  const [isAddPickerOpen, setIsAddPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [collapsedCards, setCollapsedCards] = useState<Record<string, boolean>>({});

  const target = targetFormat.toLowerCase().replace(/^\.+/, '');
  const isGif = target === 'gif';
  const isAudioTarget = categoryOfExtension(target) === 'audio';
  const availableCores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;

  // Engine compatibility analysis
  const compatibility = useMemo(() => {
    return checkEngineCompatibility(selectedEngineId, options);
  }, [selectedEngineId, options]);

  const availableVideoCodecs = useMemo(() => {
    const all = [
      { id: 'auto', label: 'Automático', desc: 'Ideal para o contêiner' },
      { id: 'h264', label: 'H.264 / AVC', desc: 'Compatibilidade total (rápido)' },
      { id: 'hevc', label: 'H.265 / HEVC', desc: 'Alta eficiência de compressão' },
      { id: 'vp8', label: 'VP8', desc: 'Padrão aberto WebM' },
      { id: 'vp9', label: 'VP9', desc: 'Alta definição WebM/MKV' },
      { id: 'mpeg4', label: 'MPEG-4', desc: 'Compatibilidade com AVI/legados' },
      { id: 'theora', label: 'Theora', desc: 'Codec livre para Ogg' },
      { id: 'copy', label: 'Cópia (Passthrough)', desc: 'Instantâneo sem perda' },
    ];
    if (target === 'webm') return all.filter((c) => ['auto', 'vp8', 'vp9', 'copy'].includes(c.id));
    if (target === 'avi') return all.filter((c) => ['auto', 'mpeg4', 'h264', 'copy'].includes(c.id));
    if (target === 'ogv') return all.filter((c) => ['auto', 'theora', 'copy'].includes(c.id));
    if (target === 'mp4' || target === 'mov' || target === 'm4v') return all.filter((c) => ['auto', 'h264', 'hevc', 'mpeg4', 'copy'].includes(c.id));
    if (target === 'ts') return all.filter((c) => ['auto', 'h264', 'hevc', 'copy'].includes(c.id));
    if (target === 'flv') return all.filter((c) => ['auto', 'h264', 'copy'].includes(c.id));
    if (target === 'mpg' || target === 'mpeg' || target === 'vob') return all.filter((c) => ['auto', 'copy'].includes(c.id));
    if (target === 'wmv' || target === '3gp') return all.filter((c) => ['auto', 'copy'].includes(c.id));
    return all;
  }, [target]);

  const availableAudioCodecs = useMemo(() => {
    const all = [
      { id: 'auto', label: 'Automático', desc: 'Padrão recomendado' },
      { id: 'mp3', label: 'MP3 (LAME)', desc: 'Universalmente compatível' },
      { id: 'aac', label: 'AAC', desc: 'Alta fidelidade e eficiência' },
      { id: 'opus', label: 'Opus (48kHz)', desc: 'Voz e música de ponta' },
      { id: 'vorbis', label: 'Ogg Vorbis', desc: 'Padrão livre e aberto' },
      { id: 'flac', label: 'FLAC (Lossless)', desc: 'Áudio sem perdas' },
      { id: 'pcm', label: 'PCM Linear (WAV)', desc: 'Sem compressão' },
      { id: 'ac3', label: 'AC-3 (Dolby)', desc: 'Cinema / surround' },
      { id: 'copy', label: 'Cópia (Passthrough)', desc: 'Sem recodificação' },
    ];
    if (target === 'mp3') return all.filter((c) => ['auto', 'mp3', 'copy'].includes(c.id));
    if (target === 'wav') return all.filter((c) => ['auto', 'pcm', 'copy'].includes(c.id));
    if (target === 'ogg') return all.filter((c) => ['auto', 'vorbis', 'opus', 'flac', 'copy'].includes(c.id));
    if (target === 'opus') return all.filter((c) => ['auto', 'opus', 'copy'].includes(c.id));
    if (target === 'flac') return all.filter((c) => ['auto', 'flac', 'copy'].includes(c.id));
    if (target === 'm4a' || target === 'aac' || target === 'm4r') return all.filter((c) => ['auto', 'aac', 'copy'].includes(c.id));
    if (target === 'ac3') return all.filter((c) => ['auto', 'ac3', 'copy'].includes(c.id));
    if (target === 'webm') return all.filter((c) => ['auto', 'vorbis', 'opus', 'copy'].includes(c.id));
    if (target === 'mp4' || target === 'mov' || target === 'm4v') return all.filter((c) => ['auto', 'aac', 'mp3', 'ac3', 'copy'].includes(c.id));
    return all;
  }, [target]);

  const update = (partial: Partial<ConversionOptions>) => {
    onChange({ ...options, ...partial });
  };

  // Ensure pinned cards (e.g. GIF fps/resolution, Image->Video duration) are in activeCategories
  useEffect(() => {
    // 1. Filter out any categories in activeCategories that are no longer applicable to the current conversion
    const validActive = options.activeCategories.filter((id) => {
      const def = CATEGORY_DEFINITIONS.find((c) => c.id === id);
      return def ? def.isApplicable(target, isMultiThreadEngine, sourceExt) : false;
    });

    // 2. Add any pinned categories that are missing
    const pinned = CATEGORY_DEFINITIONS.filter(
      (c) => c.isPinned?.(target, sourceExt) && c.isApplicable(target, isMultiThreadEngine, sourceExt)
    ).map((c) => c.id);

    const missingPinned = pinned.filter((id) => !validActive.includes(id));
    const nextCategories = [...missingPinned, ...validActive];

    const isDifferent =
      nextCategories.length !== options.activeCategories.length ||
      nextCategories.some((id, i) => id !== options.activeCategories[i]);

    if (isDifferent) {
      update({ activeCategories: nextCategories });
    }
  }, [target, sourceExt, isMultiThreadEngine, options.activeCategories]);

  // Available categories to add (excludes already added and pinned categories)
  const availableToAdd = useMemo(() => {
    const hasAudioTracks = options.activeCategories.includes('audio_tracks');
    const hasAudioMerge = options.activeCategories.includes('audio_merge');

    return CATEGORY_DEFINITIONS.filter((cat) => {
      if (!cat.isApplicable(target, isMultiThreadEngine, sourceExt)) return false;
      if (options.activeCategories.includes(cat.id)) return false;
      if (cat.isPinned && cat.isPinned(target, sourceExt)) return false;
      // Mutually exclusive: cannot add audio_merge if audio_tracks is active, and vice versa
      if (cat.id === 'audio_merge' && hasAudioTracks) return false;
      if (cat.id === 'audio_tracks' && hasAudioMerge) return false;
      if (pickerSearch === '') return true;
      return (
        cat.title.toLowerCase().includes(pickerSearch.toLowerCase()) ||
        cat.description.toLowerCase().includes(pickerSearch.toLowerCase())
      );
    });
  }, [target, isMultiThreadEngine, sourceExt, options.activeCategories, pickerSearch]);

  function addCategory(catId: ConfigCategoryId) {
    let next = options.activeCategories.filter((id) => id !== catId);
    // Mutually exclusive: audio_merge and audio_tracks
    if (catId === 'audio_merge') {
      next = next.filter((id) => id !== 'audio_tracks');
    } else if (catId === 'audio_tracks') {
      next = next.filter((id) => id !== 'audio_merge');
    }
    next.push(catId);

    const extraUpdates: Partial<ConversionOptions> = {};
    if (catId === 'fps') {
      const probedFps = probedMedia?.fps || options.probedMedia?.fps;
      if (probedFps && !options.customFps) {
        extraUpdates.customFps = probedFps;
        extraUpdates.isCustomFps = false;
      }
    } else if (catId === 'resolution') {
      if (!options.resolutionScale) {
        extraUpdates.resolutionScale = 'original';
      }
    }

    update({ activeCategories: next, ...extraUpdates });
    setIsAddPickerOpen(false);
    setPickerSearch('');
  }

  function removeCategory(catId: ConfigCategoryId) {
    const nextCategories = options.activeCategories.filter((id) => id !== catId);
    if (catId === 'audio_tracks') {
      update({
        activeCategories: nextCategories,
        selectedAudioTracks: probedMedia?.audioStreams?.map((_, idx) => idx) || [],
      });
    } else if (catId === 'subtitles') {
      update({
        activeCategories: nextCategories,
        selectedSubtitleTracks: probedMedia?.subtitleStreams?.map((_, idx) => idx) || [],
        keepAllSubtitles: true,
      });
    } else if (catId === 'threads') {
      update({
        activeCategories: nextCategories,
        threadsMode: 'auto',
        userMaxThreads: undefined,
        customThreads: undefined,
        isCustomThreads: false,
      });
    } else if (catId === 'quality') {
      update({
        activeCategories: nextCategories,
        qualityPreset: 'original',
        customCrf: undefined,
        isCustomQuality: false,
      });
    } else if (catId === 'video_codec') {
      update({
        activeCategories: nextCategories,
        videoCodec: 'auto',
      });
    } else if (catId === 'audio_codec') {
      update({
        activeCategories: nextCategories,
        audioCodec: 'auto',
      });
    } else if (catId === 'video_duration') {
      update({
        activeCategories: nextCategories,
        videoDurationSeconds: 10,
        isCustomDuration: false,
      });
    } else if (catId === 'resolution') {
      update({
        activeCategories: nextCategories,
        resolutionScale: 'original',
        customScaleWidth: undefined,
        isCustomResolution: false,
      });
    } else if (catId === 'fps') {
      update({
        activeCategories: nextCategories,
        customFps: undefined,
        isCustomFps: false,
      });
    } else {
      update({ activeCategories: nextCategories });
    }
  }

  function toggleCardCollapse(catId: string) {
    setCollapsedCards((prev) => ({ ...prev, [catId]: !prev[catId] }));
  }

  return (
    <div className="space-y-3 pt-1">
      {/* Barra de Ação Superior: Pilha de Configurações */}
      <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-border bg-surface-raised/40">
        <div className="flex items-center gap-2 min-w-0">
          <Sliders className="size-3.5 text-primary" strokeWidth={2} />
          <span className="text-[12px] font-medium text-foreground">
            Pilha de Configurações
          </span>
          <span className="text-[11px] text-muted-foreground truncate">
            ({options.activeCategories.length} {options.activeCategories.length === 1 ? 'ativa' : 'ativas'})
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAddPickerOpen(!isAddPickerOpen)}
          className="h-7 text-[11px] px-2.5 gap-1 shrink-0"
        >
          <Plus className="size-3 text-primary" strokeWidth={2.5} />
          <span>Adicionar Configuração</span>
        </Button>
      </div>

      {/* Popover de Busca para Adicionar Novas Categorias */}
      {isAddPickerOpen && (
        <AddCategoryPicker
          availableToAdd={availableToAdd}
          searchQuery={pickerSearch}
          onSearchChange={setPickerSearch}
          onSelectCategory={addCategory}
          onClose={() => setIsAddPickerOpen(false)}
          currentEngineId={selectedEngineId}
        />
      )}

      {/* Estado Vazio: Quando nenhuma categoria estiver ativa */}
      {options.activeCategories.length === 0 && (
        <Card variant="default" className="p-4 text-center space-y-2 border-dashed border-border bg-surface/40">
          <div className="flex justify-center">
            <span className="grid size-8 place-items-center rounded-full bg-primary/10 text-primary">
              <Info className="size-4" strokeWidth={2} />
            </span>
          </div>
          <Typography variant="body" className="font-medium text-xs text-foreground">
            Nenhuma configuração personalizada ativada
          </Typography>
          <Typography variant="caption" color="muted" className="block max-w-md mx-auto text-[11px]">
            O arquivo será processado com fidelidade máxima ao original: preservando todas as faixas de áudio, legendas embutidas e a taxa de qualidade mais alta.
          </Typography>
          <div className="pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddPickerOpen(true)}
              className="h-7 text-xs gap-1"
            >
              <Plus className="size-3 text-primary" strokeWidth={2.5} />
              <span>Personalizar Opções</span>
            </Button>
          </div>
        </Card>
      )}

      {/* Pilha de Cards de Configuração Ativos */}
      <div className="space-y-2.5">
        {options.activeCategories.map((catId) => {
          const def = CATEGORY_DEFINITIONS.find((c) => c.id === catId);
          if (!def) return null;

          const isPinned = def.isPinned?.(target, sourceExt) ?? false;
          const isCollapsed = Boolean(collapsedCards[catId]);
          const Icon = def.icon;
          const isCatIncompatible = isCategoryIncompatibleWithEngine(catId, selectedEngineId);

          return (
            <Card
              key={catId}
              variant="raised"
              className="p-3 space-y-2.5 transition-all border-border/80"
            >
              {/* Cabeçalho do Card com título, ícone e botões de recolher / remover */}
              <div className="flex items-center justify-between gap-2 pb-1 border-b border-border/60">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="grid size-6 shrink-0 place-items-center rounded border border-border bg-surface text-primary">
                    <Icon className="size-3" strokeWidth={2} />
                  </span>
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <Typography variant="body" className="font-semibold text-xs text-foreground truncate">
                      {def.title}
                    </Typography>
                    {isPinned && (
                      <Badge variant="outline" size="sm" className="text-[9px] py-0 px-1 border-primary/40 text-primary">
                        Padrão {target.toUpperCase()}
                      </Badge>
                    )}
                    {isCatIncompatible && (
                      <span className="text-[9px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded">
                        não compatível com o motor selecionado
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleCardCollapse(catId)}
                    className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                    title={isCollapsed ? 'Expandir configuração' : 'Recolher configuração'}
                  >
                    {isCollapsed ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
                  </button>

                  {!isPinned && (
                    <button
                      type="button"
                      onClick={() => removeCategory(catId)}
                      className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                      title="Remover configuração da pilha"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Conteúdo Específico de Cada Categoria (quando aberto) */}
              {!isCollapsed && (
                <div className="pt-0.5 space-y-3">
                  {/* CARD: DURAÇÃO DO VÍDEO (IMAGEM -> VÍDEO) */}
                  {catId === 'video_duration' && (
                    <DurationCard
                      durationSeconds={options.videoDurationSeconds ?? 10}
                      isCustom={Boolean(options.isCustomDuration)}
                      onChange={(videoDurationSeconds, isCustomDuration) =>
                        update({ videoDurationSeconds, isCustomDuration })
                      }
                    />
                  )}

                  {/* CARD: TAXA DE QUADROS (FPS) */}
                  {catId === 'fps' && (
                    <FpsCard
                      options={options}
                      onChange={update}
                      targetFormat={target}
                      probedMedia={probedMedia}
                    />
                  )}

                  {/* CARD: RESOLUÇÃO E ESCALA (Compartilhado entre GIF, MP4, WebM, etc.) */}
                  {catId === 'resolution' && (
                    <ResolutionCard
                      options={options}
                      onChange={update}
                      isGif={isGif}
                      probedMedia={probedMedia}
                    />
                  )}

                  {/* CARD: FAIXAS DE ÁUDIO (Zero dados mockados) */}
                  {catId === 'audio_tracks' && (
                    <AudioTracksCard
                      selectedTracks={options.selectedAudioTracks}
                      onChange={(tracks) => update({ selectedAudioTracks: tracks })}
                      probedMedia={probedMedia}
                    />
                  )}

                  {catId === 'audio_merge' && (
                    <AudioMergeCard
                      selectedTracks={options.selectedAudioTracks}
                      onChange={(tracks) => update({ selectedAudioTracks: tracks })}
                      probedMedia={probedMedia}
                      targetFormat={target}
                    />
                  )}

                  {/* CARD: LEGENDAS EMBUTIDAS */}
                  {catId === 'subtitles' && (
                    <SubtitlesCard
                      selectedTracks={options.selectedSubtitleTracks}
                      onChange={(tracks: number[]) =>
                        update({ selectedSubtitleTracks: tracks })
                      }
                      probedMedia={probedMedia}
                    />
                  )}

                  {/* CARD: CODEC DE VÍDEO */}
                  {catId === 'video_codec' && (
                    <div className="space-y-2 pt-0.5">
                      <div className="flex items-center justify-between">
                        <Typography variant="caption" color="muted">
                          Codificador de vídeo do contêiner:
                        </Typography>
                        <span className="text-[11px] font-mono text-primary font-medium">
                          {options.videoCodec || 'auto'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {availableVideoCodecs.map((codec) => {
                          const isSelected = (options.videoCodec || 'auto') === codec.id;
                          return (
                            <button
                              key={codec.id}
                              type="button"
                              onClick={() => update({ videoCodec: codec.id as VideoCodecChoice })}
                              className={cn(
                                'p-2 text-left rounded-md border transition-colors select-none',
                                isSelected
                                  ? 'border-primary bg-primary/10 text-foreground font-medium'
                                  : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground'
                              )}
                            >
                              <div className="text-[11px] font-medium text-foreground">{codec.label}</div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">{codec.desc}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* CARD: CODEC DE ÁUDIO */}
                  {catId === 'audio_codec' && (
                    <div className="space-y-2 pt-0.5">
                      <div className="flex items-center justify-between">
                        <Typography variant="caption" color="muted">
                          Codificador de áudio da saída:
                        </Typography>
                        <span className="text-[11px] font-mono text-primary font-medium">
                          {options.audioCodec || 'auto'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {availableAudioCodecs.map((codec) => {
                          const isSelected = (options.audioCodec || 'auto') === codec.id;
                          return (
                            <button
                              key={codec.id}
                              type="button"
                              onClick={() => update({ audioCodec: codec.id as AudioCodecChoice })}
                              className={cn(
                                'p-2 text-left rounded-md border transition-colors select-none',
                                isSelected
                                  ? 'border-primary bg-primary/10 text-foreground font-medium'
                                  : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground'
                              )}
                            >
                              <div className="text-[11px] font-medium text-foreground">{codec.label}</div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">{codec.desc}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* CARD: QUALIDADE E COMPRESSÃO (CRF) */}
                  {catId === 'quality' && (
                    <div className="space-y-2 pt-0.5">
                      <div className="flex items-center justify-between">
                        <Typography variant="caption" color="muted">
                          Equilíbrio entre tamanho de arquivo e fidelidade visual:
                        </Typography>
                        <span className="text-[11px] font-mono text-primary font-medium">
                          {options.isCustomQuality
                            ? `CRF ${options.customCrf || 23}`
                            : options.qualityPreset === 'original'
                            ? 'Original (CRF 18)'
                            : options.qualityPreset === 'compressed'
                            ? 'Compacto (CRF 28)'
                            : 'Equilibrado (CRF 23)'}
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { id: 'original', label: 'Original', desc: 'CRF 18 (Máx. fidelidade)' },
                          { id: 'balanced', label: 'Equilibrado', desc: 'CRF 23 (Recomendado)' },
                          { id: 'compressed', label: 'Compacto', desc: 'CRF 28 (Menor tamanho)' },
                          { id: 'custom', label: 'Custom', desc: 'Definir CRF manualmente' },
                        ].map((q) => {
                          const isSelected = q.id === 'custom'
                            ? Boolean(options.isCustomQuality)
                            : !options.isCustomQuality && (options.qualityPreset || 'original') === q.id;

                          return (
                            <button
                              key={q.id}
                              type="button"
                              onClick={() => {
                                if (q.id === 'custom') {
                                  update({
                                    isCustomQuality: true,
                                    qualityPreset: 'custom',
                                    customCrf: options.customCrf || 23,
                                  });
                                } else {
                                  update({
                                    isCustomQuality: false,
                                    qualityPreset: q.id as QualityPreset,
                                    customCrf: undefined,
                                  });
                                }
                              }}
                              className={cn(
                                'p-2 text-left rounded-md border transition-colors select-none',
                                isSelected
                                  ? 'border-primary bg-primary/10 text-foreground font-medium'
                                  : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground'
                              )}
                            >
                              <div className="text-[11px] font-medium text-foreground">{q.label}</div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">{q.desc}</div>
                            </button>
                          );
                        })}
                      </div>

                      {options.isCustomQuality && (
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[11px] text-muted-foreground">Valor de CRF (0 a 51):</span>
                          <input
                            type="number"
                            min="0"
                            max="51"
                            value={options.customCrf || 23}
                            onChange={(e) => {
                              const val = Math.max(0, Math.min(51, parseInt(e.target.value, 10) || 0));
                              update({ customCrf: val, isCustomQuality: true, qualityPreset: 'custom' });
                            }}
                            className="w-20 rounded border border-primary bg-surface-raised px-2 py-0.5 text-xs text-foreground focus:outline-none"
                          />
                          <span className="text-[11px] text-muted-foreground font-mono">(0 = Lossless, 23 = Padrão, 51 = Pior)</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CARD: DESEMPENHO E THREADS */}
                  {catId === 'threads' && (
                    <div className="space-y-2 pt-0.5">
                      <div className="flex items-center justify-between">
                        <Typography variant="caption" color="muted">
                          Uso de múltiplos núcleos de CPU do navegador:
                        </Typography>
                        <span className="text-[11px] font-mono text-primary font-medium">
                          {options.isCustomThreads
                            ? `${options.customThreads || availableCores} núcleos`
                            : 'Automático (Todos os núcleos)'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            update({
                              threadsMode: 'auto',
                              isCustomThreads: false,
                              customThreads: undefined,
                              userMaxThreads: undefined,
                            })
                          }
                          className={cn(
                            'p-2 text-left rounded-md border transition-colors select-none',
                            !options.isCustomThreads
                              ? 'border-primary bg-primary/10 text-foreground font-medium'
                              : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground'
                          )}
                        >
                          <div className="text-[11px] font-medium text-foreground">
                            Automático ({availableCores} núcleos)
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            Máxima velocidade multi-thread disponível no dispositivo
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            update({
                              threadsMode: 'custom',
                              isCustomThreads: true,
                              customThreads: options.customThreads || Math.max(1, availableCores - 1),
                              userMaxThreads: options.customThreads || Math.max(1, availableCores - 1),
                            })
                          }
                          className={cn(
                            'p-2 text-left rounded-md border transition-colors select-none',
                            options.isCustomThreads
                              ? 'border-primary bg-primary/10 text-foreground font-medium'
                              : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground'
                          )}
                        >
                          <div className="text-[11px] font-medium text-foreground">Personalizado</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            Limitar o uso de núcleos para economizar bateria
                          </div>
                        </button>
                      </div>

                      {options.isCustomThreads && (
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[11px] text-muted-foreground">Núcleos alocados:</span>
                          <input
                            type="number"
                            min="1"
                            max={availableCores}
                            value={options.customThreads || 1}
                            onChange={(e) => {
                              const val = Math.max(1, Math.min(availableCores, parseInt(e.target.value, 10) || 1));
                              update({ customThreads: val, userMaxThreads: val, isCustomThreads: true });
                            }}
                            className="w-16 rounded border border-primary bg-surface-raised px-2 py-0.5 text-xs text-foreground focus:outline-none"
                          />
                          <span className="text-[11px] text-muted-foreground font-mono">de {availableCores} núcleos</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
