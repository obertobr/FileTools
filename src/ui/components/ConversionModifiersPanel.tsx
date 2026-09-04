import React, { useState, useMemo, useEffect } from 'react';
import {
  Sliders,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Info,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import {
  createModifierContext,
  type ConversionModifiers,
  type ModifierCategoryId,
  type QualityPreset,
  type VideoCodecChoice,
  type AudioCodecChoice,
  type ImplicitRuleResult,
  type DerivedOptionsResult,
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
import { VideoCodecCard } from './modifiers/VideoCodecCard';
import { QualityCard } from './modifiers/QualityCard';
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

  const update = (partial: Partial<ConversionModifiers>) => {
    onChange({ ...currentModifiers, ...partial });
  };

  // 1. Build ModifierContext
  const ctx = useMemo(() => {
    return createModifierContext(target, sourceExt || '', currentModifiers, probedMedia);
  }, [target, sourceExt, currentModifiers, probedMedia]);

  // 2. Evaluate implicit rules across definitions
  const implicitRulesMap = useMemo(() => {
    const map = new Map<ModifierCategoryId, ImplicitRuleResult>();
    for (const def of MODIFIER_DEFINITIONS) {
      if (def.implicitRule) {
        const res = def.implicitRule(ctx);
        if (res.isImplicit) {
          map.set(def.id, res);
        }
      }
    }
    return map;
  }, [ctx]);

  // Ensure pinned cards and implicit cards are in activeCategories, prune inapplicable
  useEffect(() => {
    let validActive = currentModifiers.activeCategories.filter((id) => {
      const def = MODIFIER_DEFINITIONS.find((c) => c.id === id);
      return def ? def.isApplicable(ctx) : false;
    });

    const pinned = MODIFIER_DEFINITIONS.filter((c) => {
      if (!c.isApplicable(ctx)) return false;
      return typeof c.pinned === 'function' ? c.pinned(ctx) : Boolean(c.pinned);
    }).map((c) => c.id);

    const implicitIds = Array.from(implicitRulesMap.keys()).filter((id) => {
      const def = MODIFIER_DEFINITIONS.find((c) => c.id === id);
      return def ? def.isApplicable(ctx) : false;
    });

    // For any triggered implicit rule, remove mutually exclusive categories
    for (const impId of implicitIds) {
      const def = MODIFIER_DEFINITIONS.find((d) => d.id === impId);
      if (def?.mutuallyExclusiveWith) {
        validActive = validActive.filter((id) => !def.mutuallyExclusiveWith!.includes(id));
      }
    }

    const nextCategories = Array.from(new Set([...implicitIds, ...pinned, ...validActive]));

    const isDifferent =
      nextCategories.length !== currentModifiers.activeCategories.length ||
      nextCategories.some((id, i) => id !== currentModifiers.activeCategories[i]);

    if (isDifferent) {
      update({ activeCategories: nextCategories });
    }
  }, [ctx, implicitRulesMap, currentModifiers.activeCategories]);

  // Available categories to add (excludes active, pinned, implicit, and mutually exclusive)
  const availableToAdd = useMemo(() => {
    return MODIFIER_DEFINITIONS.filter((mod) => {
      if (!mod.isApplicable(ctx)) return false;
      if (currentModifiers.activeCategories.includes(mod.id)) return false;
      const isPinned = typeof mod.pinned === 'function' ? mod.pinned(ctx) : Boolean(mod.pinned);
      if (isPinned) return false;
      if (implicitRulesMap.has(mod.id)) return false;

      // Check mutual exclusion: if any active modifier conflicts with this one
      if (mod.mutuallyExclusiveWith?.some((id) => currentModifiers.activeCategories.includes(id))) {
        return false;
      }
      const conflictingActive = currentModifiers.activeCategories.some((activeId) => {
        const activeDef = MODIFIER_DEFINITIONS.find((d) => d.id === activeId);
        return activeDef?.mutuallyExclusiveWith?.includes(mod.id);
      });
      if (conflictingActive) return false;

      if (pickerSearch === '') return true;
      return (
        mod.title.toLowerCase().includes(pickerSearch.toLowerCase()) ||
        mod.description.toLowerCase().includes(pickerSearch.toLowerCase())
      );
    });
  }, [ctx, currentModifiers.activeCategories, pickerSearch, implicitRulesMap]);

  function addModifier(modId: ModifierCategoryId) {
    const def = MODIFIER_DEFINITIONS.find((d) => d.id === modId);
    let next = currentModifiers.activeCategories.filter((id) => id !== modId);
    if (def?.mutuallyExclusiveWith) {
      next = next.filter((id) => !def.mutuallyExclusiveWith!.includes(id));
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

          const isPinned = typeof def.pinned === 'function' ? def.pinned(ctx) : Boolean(def.pinned);
          const implicitInfo = implicitRulesMap.get(modId);
          const isImplicitLocked = Boolean(implicitInfo?.isImplicit);
          const derived = def.deriveOptions ? def.deriveOptions(ctx) : undefined;
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
                    {isImplicitLocked && (
                      <Badge variant="outline" size="sm" className="text-[9px] py-0 px-1 border-primary/40 text-primary flex items-center gap-1">
                        <Lock className="size-2.5" />
                        <span>{implicitInfo?.reason || 'Obrigatório'}</span>
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

                  {!isPinned && !isImplicitLocked && (
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
                      allowedOptions={derived?.allowedOptions}
                      warningMessage={derived?.warningMessage}
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
                      allowedOptions={derived?.allowedOptions}
                      warningMessage={derived?.warningMessage}
                    />
                  )}

                  {/* MODIFICADOR: QUALIDADE E COMPRESSÃO (CRF) */}
                  {modId === 'quality' && (
                    <QualityCard
                      options={currentModifiers}
                      onChange={update}
                      allowedOptions={derived?.allowedOptions}
                      warningMessage={derived?.warningMessage}
                    />
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
                      isLocked={isImplicitLocked}
                      lockReason={implicitInfo?.reason}
                      warningMessage={derived?.warningMessage}
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
                    <VideoCodecCard
                      options={currentModifiers}
                      onChange={update}
                      allowedOptions={derived?.allowedOptions}
                      warningMessage={derived?.warningMessage}
                    />
                  )}

                  {/* MODIFICADOR: CODEC DE ÁUDIO */}
                  {modId === 'audio_codec' && (
                    <AudioCodecCard
                      options={currentModifiers}
                      onChange={update}
                      probedMedia={probedMedia}
                      allowedOptions={derived?.allowedOptions}
                      warningMessage={derived?.warningMessage}
                    />
                  )}

                  {/* MODIFICADOR: FORMATO DE PIXEL */}
                  {modId === 'pixel_format' && (
                    <PixelFormatCard
                      options={currentModifiers}
                      onChange={update}
                      allowedOptions={derived?.allowedOptions}
                      warningMessage={derived?.warningMessage}
                    />
                  )}

                  {/* MODIFICADOR: PROFUNDIDADE DE COR */}
                  {modId === 'bit_depth' && (
                    <BitDepthCard
                      options={currentModifiers}
                      onChange={update}
                      allowedOptions={derived?.allowedOptions}
                      warningMessage={derived?.warningMessage}
                    />
                  )}

                  {/* MODIFICADOR: TAXA DE BITS (BITRATE) */}
                  {modId === 'bitrate' && (
                    <BitrateCard
                      options={currentModifiers}
                      onChange={update}
                      allowedOptions={derived?.allowedOptions}
                      warningMessage={derived?.warningMessage}
                    />
                  )}

                  {/* MODIFICADOR: ESPAÇO DE COR */}
                  {modId === 'color_space' && (
                    <ColorSpaceCard
                      options={currentModifiers}
                      onChange={update}
                      allowedOptions={derived?.allowedOptions}
                      warningMessage={derived?.warningMessage}
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

