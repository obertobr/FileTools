import React, { useState, useMemo, useEffect } from 'react';
import {
  Sliders,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Info,
} from 'lucide-react';
import type {
  ConversionModifiers,
  ModifierCategoryId,
  QualityPreset,
  VideoCodecChoice,
  AudioCodecChoice,
} from '@/shared/types/conversionModifiers';
import type { MediaProbeResult } from '@/core/media/mediaProbe';
import { Card, Typography, Badge, Button } from '@/ui/components/core';
import { cn } from '@/lib/utils';
import { MODIFIER_DEFINITIONS } from './modifiers/ModifierDefinitions';
import { AudioTracksCard } from './modifiers/AudioTracksCard';
import { AudioMergeCard } from './modifiers/AudioMergeCard';
import { SubtitlesCard } from './modifiers/SubtitlesCard';
import { FpsCard } from './modifiers/FpsCard';
import { ResolutionCard } from './modifiers/ResolutionCard';
import { DurationCard } from './modifiers/DurationCard';
import { AudioCodecCard } from './modifiers/AudioCodecCard';
import { PixelFormatCard } from './modifiers/PixelFormatCard';
import { BitDepthCard } from './modifiers/BitDepthCard';
import { BitrateCard } from './modifiers/BitrateCard';
import { ColorSpaceCard } from './modifiers/ColorSpaceCard';
import { categoryOfExtension } from '@/lib/formats';
import { AddModifierPicker } from './modifiers/AddModifierPicker';
import {
  checkEngineCompatibility,
  isModifierIncompatibleWithEngine,
} from '@/modules/engineCapabilities';

export interface ConversionModifiersPanelProps {
  targetFormat: string;
  sourceExt?: string;
  modifiers?: ConversionModifiers;
  // Compatibility alias
  options?: ConversionModifiers;
  onChange: (updated: ConversionModifiers) => void;
  isMultiThreadEngine?: boolean;
  probedMedia?: MediaProbeResult;
  selectedEngineId?: string | null;
  onSelectEngine?: (engineId: string) => void;
}

export function ConversionModifiersPanel({
  targetFormat,
  sourceExt,
  modifiers,
  options,
  onChange,
  isMultiThreadEngine = true,
  probedMedia,
  selectedEngineId,
  onSelectEngine,
}: ConversionModifiersPanelProps) {
  const currentModifiers = modifiers ?? options ?? {
    activeCategories: [],
    selectedAudioTracks: [],
    selectedSubtitleTracks: [],
    keepAllSubtitles: true,
  };

  const [isAddPickerOpen, setIsAddPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [collapsedCards, setCollapsedCards] = useState<Record<string, boolean>>({});

  const target = targetFormat.toLowerCase().replace(/^\.+/, '');
  const isGif = target === 'gif';
  const isAudioTarget = categoryOfExtension(target) === 'audio';
  const availableCores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;

  const availableVideoCodecs = useMemo(() => {
    const all = [
      { id: 'auto', label: 'Automático', desc: 'Ideal para o contêiner' },
      { id: 'h264', label: 'H.264 / AVC', desc: 'Compatibilidade total (rápido)' },
      { id: 'hevc', label: 'H.265 / HEVC', desc: 'Alta eficiência de compressão' },
      { id: 'vp8', label: 'VP8', desc: 'Padrão aberto WebM' },
      { id: 'vp9', label: 'VP9', desc: 'Alta definição WebM/MKV' },
      { id: 'mpeg4', label: 'MPEG-4', desc: 'Compatibilidade com AVI/legados' },
      { id: 'h263', label: 'H.263', desc: 'Padrão 3GPP clássico (CIF/QCIF)' },
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
    if (target === '3gp') return all.filter((c) => ['auto', 'h263', 'mpeg4', 'h264', 'copy'].includes(c.id));
    if (target === 'wmv') return all.filter((c) => ['auto', 'copy'].includes(c.id));
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

  const update = (partial: Partial<ConversionModifiers>) => {
    onChange({ ...currentModifiers, ...partial });
  };

  // Ensure pinned cards (e.g. GIF fps/resolution, Image->Video duration) are in activeCategories
  useEffect(() => {
    const validActive = currentModifiers.activeCategories.filter((id) => {
      const def = MODIFIER_DEFINITIONS.find((c) => c.id === id);
      return def ? def.isApplicable(target, isMultiThreadEngine, sourceExt) : false;
    });

    const pinned = MODIFIER_DEFINITIONS.filter(
      (c) => c.isPinned?.(target, sourceExt) && c.isApplicable(target, isMultiThreadEngine, sourceExt)
    ).map((c) => c.id);

    const missingPinned = pinned.filter((id) => !validActive.includes(id));
    const nextCategories = [...missingPinned, ...validActive];

    const isDifferent =
      nextCategories.length !== currentModifiers.activeCategories.length ||
      nextCategories.some((id, i) => id !== currentModifiers.activeCategories[i]);

    if (isDifferent) {
      update({ activeCategories: nextCategories });
    }
  }, [target, sourceExt, isMultiThreadEngine, currentModifiers.activeCategories]);

  // Available categories to add (excludes already added and pinned categories)
  const availableToAdd = useMemo(() => {
    const hasAudioTracks = currentModifiers.activeCategories.includes('audio_tracks');
    const hasAudioMerge = currentModifiers.activeCategories.includes('audio_merge');

    return MODIFIER_DEFINITIONS.filter((mod) => {
      if (!mod.isApplicable(target, isMultiThreadEngine, sourceExt)) return false;
      if (currentModifiers.activeCategories.includes(mod.id)) return false;
      if (mod.isPinned && mod.isPinned(target, sourceExt)) return false;
      if (mod.id === 'audio_merge' && hasAudioTracks) return false;
      if (mod.id === 'audio_tracks' && hasAudioMerge) return false;
      if (pickerSearch === '') return true;
      return (
        mod.title.toLowerCase().includes(pickerSearch.toLowerCase()) ||
        mod.description.toLowerCase().includes(pickerSearch.toLowerCase())
      );
    });
  }, [target, isMultiThreadEngine, sourceExt, currentModifiers.activeCategories, pickerSearch]);

  function addModifier(modId: ModifierCategoryId) {
    let next = currentModifiers.activeCategories.filter((id) => id !== modId);
    if (modId === 'audio_merge') {
      next = next.filter((id) => id !== 'audio_tracks');
    } else if (modId === 'audio_tracks') {
      next = next.filter((id) => id !== 'audio_merge');
    }
    next.push(modId);

    const extraUpdates: Partial<ConversionModifiers> = {};
    if (modId === 'fps') {
      const probedFps = probedMedia?.fps || currentModifiers.probedMedia?.fps;
      if (probedFps && !currentModifiers.customFps) {
        extraUpdates.customFps = probedFps;
        extraUpdates.isCustomFps = false;
      }
    } else if (modId === 'resolution') {
      if (!currentModifiers.resolutionScale) {
        extraUpdates.resolutionScale = 'original';
      }
    }

    update({ activeCategories: next, ...extraUpdates });
    setIsAddPickerOpen(false);
    setPickerSearch('');
  }

  function removeModifier(modId: ModifierCategoryId) {
    const nextCategories = currentModifiers.activeCategories.filter((id) => id !== modId);
    if (modId === 'audio_tracks') {
      update({
        activeCategories: nextCategories,
        selectedAudioTracks: probedMedia?.audioStreams?.map((_, idx) => idx) || [],
      });
    } else if (modId === 'subtitles') {
      update({
        activeCategories: nextCategories,
        selectedSubtitleTracks: probedMedia?.subtitleStreams?.map((_, idx) => idx) || [],
        keepAllSubtitles: true,
      });
    } else if (modId === 'threads') {
      update({
        activeCategories: nextCategories,
        threadsMode: 'auto',
        userMaxThreads: undefined,
        customThreads: undefined,
        isCustomThreads: false,
      });
    } else if (modId === 'quality') {
      update({
        activeCategories: nextCategories,
        qualityPreset: 'original',
        customCrf: undefined,
        isCustomQuality: false,
      });
    } else if (modId === 'video_codec') {
      update({
        activeCategories: nextCategories,
        videoCodec: 'auto',
      });
    } else if (modId === 'audio_codec') {
      update({
        activeCategories: nextCategories,
        audioCodec: 'auto',
      });
    } else if (modId === 'video_duration') {
      update({
        activeCategories: nextCategories,
        videoDurationSeconds: 10,
        isCustomDuration: false,
      });
    } else if (modId === 'resolution') {
      update({
        activeCategories: nextCategories,
        resolutionScale: 'original',
        customScaleWidth: undefined,
        isCustomResolution: false,
      });
    } else if (modId === 'fps') {
      update({
        activeCategories: nextCategories,
        customFps: undefined,
        isCustomFps: false,
      });
    } else if (modId === 'pixel_format') {
      update({
        activeCategories: nextCategories,
        pixelFormat: 'auto',
      });
    } else if (modId === 'bit_depth') {
      update({
        activeCategories: nextCategories,
        bitDepth: 'auto',
      });
    } else if (modId === 'bitrate') {
      update({
        activeCategories: nextCategories,
        videoBitrate: 'auto',
        customVideoBitrateKbps: undefined,
        isCustomVideoBitrate: false,
        audioBitrate: 'auto',
        customAudioBitrateKbps: undefined,
        isCustomAudioBitrate: false,
      });
    } else if (modId === 'color_space') {
      update({
        activeCategories: nextCategories,
        colorSpace: 'auto',
      });
    } else {
      update({ activeCategories: nextCategories });
    }
  }

  function toggleCardCollapse(modId: string) {
    setCollapsedCards((prev) => ({ ...prev, [modId]: !prev[modId] }));
  }

  return (
    <div aria-label="Pilha de Modificadores" className="space-y-3 pt-1">
      {/* Barra de Ação Superior: Pilha de Modificadores */}
      <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-border bg-surface-raised/40">
        <div className="flex items-center gap-2 min-w-0">
          <Sliders className="size-3.5 text-primary" strokeWidth={2} />
          <span className="text-[12px] font-medium text-foreground">
            Pilha de Modificadores
          </span>
          <span className="text-[11px] text-muted-foreground truncate">
            ({currentModifiers.activeCategories.length} {currentModifiers.activeCategories.length === 1 ? 'ativo' : 'ativos'})
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAddPickerOpen(!isAddPickerOpen)}
          className="h-7 text-[11px] px-2.5 gap-1 shrink-0"
        >
          <Plus className="size-3 text-primary" strokeWidth={2.5} />
          <span>Adicionar Modificador</span>
        </Button>
      </div>

      {/* Popover de Busca para Adicionar Novos Modificadores */}
      {isAddPickerOpen && (
        <AddModifierPicker
          availableToAdd={availableToAdd}
          searchQuery={pickerSearch}
          onSearchChange={setPickerSearch}
          onSelectModifier={addModifier}
          onClose={() => setIsAddPickerOpen(false)}
          currentEngineId={selectedEngineId}
        />
      )}

      {/* Estado Vazio: Quando nenhum modificador estiver ativo */}
      {currentModifiers.activeCategories.length === 0 && (
        <Card variant="default" className="p-4 text-center space-y-2 border-dashed border-border bg-surface/40">
          <div className="flex justify-center">
            <span className="grid size-8 place-items-center rounded-full bg-primary/10 text-primary">
              <Info className="size-4" strokeWidth={2} />
            </span>
          </div>
          <Typography variant="body" className="font-medium text-xs text-foreground">
            Nenhum modificador personalizado ativado
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
              <span>Personalizar Modificadores</span>
            </Button>
          </div>
        </Card>
      )}

      {/* Pilha de Cards de Modificadores Ativos */}
      <div className="space-y-2.5">
        {currentModifiers.activeCategories.map((modId) => {
          const def = MODIFIER_DEFINITIONS.find((c) => c.id === modId);
          if (!def) return null;

          const isPinned = def.isPinned?.(target, sourceExt) ?? false;
          const isCollapsed = Boolean(collapsedCards[modId]);
          const Icon = def.icon;
          const isCatIncompatible = isModifierIncompatibleWithEngine(modId, selectedEngineId);

          return (
            <Card
              key={modId}
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
                    onClick={() => toggleCardCollapse(modId)}
                    className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                    title={isCollapsed ? 'Expandir modificador' : 'Recolher modificador'}
                  >
                    {isCollapsed ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
                  </button>

                  {!isPinned && (
                    <button
                      type="button"
                      onClick={() => removeModifier(modId)}
                      className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                      title="Remover modificador da pilha"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Conteúdo Específico de Cada Modificador (quando aberto) */}
              {!isCollapsed && (
                <div className="pt-0.5 space-y-3">
                  {/* MODIFICADOR: DURAÇÃO DO VÍDEO (IMAGEM -> VÍDEO) */}
                  {modId === 'video_duration' && (
                    <DurationCard
                      durationSeconds={currentModifiers.videoDurationSeconds ?? 10}
                      isCustom={Boolean(currentModifiers.isCustomDuration)}
                      onChange={(videoDurationSeconds, isCustomDuration) =>
                        update({ videoDurationSeconds, isCustomDuration })
                      }
                    />
                  )}

                  {/* MODIFICADOR: TAXA DE QUADROS (FPS) */}
                  {modId === 'fps' && (
                    <FpsCard
                      options={currentModifiers}
                      onChange={update}
                      targetFormat={target}
                      probedMedia={probedMedia}
                    />
                  )}

                  {/* MODIFICADOR: RESOLUÇÃO E ESCALA */}
                  {modId === 'resolution' && (
                    <ResolutionCard
                      options={currentModifiers}
                      onChange={update}
                      isGif={isGif}
                      probedMedia={probedMedia}
                      targetFormat={target}
                      videoCodec={currentModifiers.videoCodec}
                    />
                  )}

                  {/* MODIFICADOR: QUALIDADE E COMPRESSÃO (CRF) */}
                  {modId === 'quality' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Typography variant="caption" color="muted">
                          Nível de fidelidade visual:
                        </Typography>
                        <span className="text-[11px] font-mono text-primary font-medium">
                          {currentModifiers.qualityPreset === 'custom'
                            ? `CRF ${currentModifiers.customCrf ?? 23}`
                            : currentModifiers.qualityPreset === 'compressed'
                            ? 'Econômica (CRF 28)'
                            : currentModifiers.qualityPreset === 'balanced'
                            ? 'Média (CRF 23)'
                            : 'Original (Fidelidade Máxima)'}
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { id: 'original', label: 'Original', desc: 'Fidelidade máx.' },
                          { id: 'balanced', label: 'Equilibrada', desc: 'Média (CRF 23)' },
                          { id: 'compressed', label: 'Compacta', desc: 'Menor arquivo' },
                          { id: 'custom', label: 'Custom', desc: 'Definir CRF' },
                        ].map((q) => {
                          const isSelected = (currentModifiers.qualityPreset || 'original') === q.id;
                          return (
                            <button
                              key={q.id}
                              type="button"
                              onClick={() => {
                                const crfVal = q.id === 'original' ? 18 : (q.id === 'balanced' ? 23 : (q.id === 'compressed' ? 28 : (currentModifiers.customCrf ?? 23)));
                                update({
                                  qualityPreset: q.id as QualityPreset,
                                  targetCrf: crfVal,
                                  isCustomQuality: q.id === 'custom',
                                  customCrf: q.id === 'custom' ? (currentModifiers.customCrf ?? 23) : undefined,
                                });
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

                      {currentModifiers.qualityPreset === 'custom' && (
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[11px] text-muted-foreground">Fator CRF (0 a 51):</span>
                          <input
                            type="number"
                            min="0"
                            max="51"
                            value={currentModifiers.customCrf ?? 23}
                            onChange={(e) => {
                              const val = Math.max(0, Math.min(51, parseInt(e.target.value, 10) || 0));
                              update({ customCrf: val, targetCrf: val });
                            }}
                            className="w-20 rounded border border-primary bg-surface-raised px-2 py-0.5 text-xs text-foreground focus:outline-none"
                          />
                          <span className="text-[11px] text-muted-foreground font-mono">(0 = lossless, 23 = padrão, 51 = máx compressão)</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* MODIFICADOR: SELEÇÃO DE FAIXAS DE ÁUDIO */}
                  {modId === 'audio_tracks' && (
                    <AudioTracksCard
                      selectedTracks={currentModifiers.selectedAudioTracks}
                      onChange={(tracks) => update({ selectedAudioTracks: tracks })}
                      probedMedia={probedMedia}
                    />
                  )}

                  {/* MODIFICADOR: UNIR / MESCLAR FAIXAS DE ÁUDIO */}
                  {modId === 'audio_merge' && (
                    <AudioMergeCard
                      selectedTracks={currentModifiers.selectedAudioTracks}
                      onChange={(tracks) => update({ selectedAudioTracks: tracks })}
                      probedMedia={probedMedia}
                      targetFormat={targetFormat}
                    />
                  )}

                  {/* MODIFICADOR: LEGENDAS EMBUTIDAS */}
                  {modId === 'subtitles' && (
                    <SubtitlesCard
                      selectedTracks={currentModifiers.selectedSubtitleTracks}
                      onChange={(tracks) => update({ selectedSubtitleTracks: tracks })}
                      probedMedia={probedMedia}
                    />
                  )}

                  {/* MODIFICADOR: CODEC DE VÍDEO */}
                  {modId === 'video_codec' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Typography variant="caption" color="muted">
                          Codificador de vídeo para {target.toUpperCase()}:
                        </Typography>
                        <span className="text-[11px] font-mono text-primary font-medium">
                          {availableVideoCodecs.find((c) => c.id === currentModifiers.videoCodec)?.label || 'Automático'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {availableVideoCodecs.map((codec) => {
                          const isSelected = (currentModifiers.videoCodec || 'auto') === codec.id;
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

                  {/* MODIFICADOR: CODEC DE ÁUDIO */}
                  {modId === 'audio_codec' && (
                    <AudioCodecCard
                      options={currentModifiers}
                      onChange={update}
                      targetFormat={targetFormat}
                      probedMedia={probedMedia}
                    />
                  )}

                  {/* MODIFICADOR: FORMATO DE PIXEL */}
                  {modId === 'pixel_format' && (
                    <PixelFormatCard
                      options={currentModifiers}
                      onChange={update}
                    />
                  )}

                  {/* MODIFICADOR: PROFUNDIDADE DE COR */}
                  {modId === 'bit_depth' && (
                    <BitDepthCard
                      options={currentModifiers}
                      onChange={update}
                    />
                  )}

                  {/* MODIFICADOR: TAXA DE BITS (BITRATE) */}
                  {modId === 'bitrate' && (
                    <BitrateCard
                      options={currentModifiers}
                      onChange={update}
                      targetFormat={targetFormat}
                    />
                  )}

                  {/* MODIFICADOR: ESPAÇO DE COR */}
                  {modId === 'color_space' && (
                    <ColorSpaceCard
                      options={currentModifiers}
                      onChange={update}
                    />
                  )}

                  {/* MODIFICADOR: NÚCLEOS / THREADS DE PROCESSAMENTO */}
                  {modId === 'threads' && isMultiThreadEngine && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Typography variant="caption" color="muted">
                          Alocação de CPU paralela:
                        </Typography>
                        <span className="text-[11px] font-mono text-primary font-medium">
                          {currentModifiers.threadsMode === 'custom'
                            ? `${currentModifiers.customThreads ?? availableCores} núcleos`
                            : `Automático (${availableCores} núcleos)`}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { id: 'auto', label: 'Automático', desc: `Máximo (${availableCores} cores)` },
                          { id: 'custom', label: 'Customizado', desc: 'Definir contagem' },
                        ].map((m) => {
                          const isSelected = (currentModifiers.threadsMode || 'auto') === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                update({
                                  threadsMode: m.id as 'auto' | 'custom',
                                  isCustomThreads: m.id === 'custom',
                                  customThreads: m.id === 'custom' ? (currentModifiers.customThreads ?? availableCores) : undefined,
                                });
                              }}
                              className={cn(
                                'p-2 text-left rounded-md border transition-colors select-none',
                                isSelected
                                  ? 'border-primary bg-primary/10 text-foreground font-medium'
                                  : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground'
                              )}
                            >
                              <div className="text-[11px] font-medium text-foreground">{m.label}</div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">{m.desc}</div>
                            </button>
                          );
                        })}
                      </div>

                      {currentModifiers.threadsMode === 'custom' && (
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[11px] text-muted-foreground">Núcleos a utilizar:</span>
                          <input
                            type="number"
                            min="1"
                            max={Math.max(16, availableCores)}
                            value={currentModifiers.customThreads ?? availableCores}
                            onChange={(e) => {
                              const val = Math.max(1, Math.min(32, parseInt(e.target.value, 10) || 1));
                              update({ customThreads: val });
                            }}
                            className="w-20 rounded border border-primary bg-surface-raised px-2 py-0.5 text-xs text-foreground focus:outline-none"
                          />
                          <span className="text-[11px] text-muted-foreground font-mono">de {availableCores} disponíveis</span>
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

