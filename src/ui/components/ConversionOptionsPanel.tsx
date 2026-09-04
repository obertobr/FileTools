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
  ConversionOptions,
  ConfigCategoryId,
  QualityPreset,
  VideoCodecChoice,
} from '@/shared/types/conversionOptions';
import type { MediaProbeResult } from '@/core/media/mediaProbe';
import { Card, Typography, Badge, Button } from '@/ui/components/core';
import { cn } from '@/lib/utils';
import { CATEGORY_DEFINITIONS } from './options/CategoryDefinitions';
import { AudioTracksCard } from './options/AudioTracksCard';
import { SubtitlesCard } from './options/SubtitlesCard';
import { FpsCard } from './options/FpsCard';
import { ResolutionCard } from './options/ResolutionCard';
import { AddCategoryPicker } from './options/AddCategoryPicker';

export interface ConversionOptionsPanelProps {
  targetFormat: string;
  sourceExt?: string;
  options: ConversionOptions;
  onChange: (updated: ConversionOptions) => void;
  isMultiThreadEngine?: boolean;
  probedMedia?: MediaProbeResult;
}

export function ConversionOptionsPanel({
  targetFormat,
  sourceExt,
  options,
  onChange,
  isMultiThreadEngine = true,
  probedMedia,
}: ConversionOptionsPanelProps) {
  const [isAddPickerOpen, setIsAddPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [collapsedCards, setCollapsedCards] = useState<Record<string, boolean>>({});

  const target = targetFormat.toLowerCase().replace(/^\.+/, '');
  const isGif = target === 'gif';
  const availableCores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;

  const update = (partial: Partial<ConversionOptions>) => {
    onChange({ ...options, ...partial });
  };

  // Ensure pinned cards for GIF (fps & resolution) are always in activeCategories
  useEffect(() => {
    if (isGif) {
      const required: ConfigCategoryId[] = ['fps', 'resolution'];
      const missing = required.filter((id) => !options.activeCategories.includes(id));
      if (missing.length > 0) {
        update({ activeCategories: [...missing, ...options.activeCategories] });
      }
    }
  }, [isGif, options.activeCategories]);

  // Available categories to add (excludes already added and pinned categories)
  const availableToAdd = useMemo(() => {
    return CATEGORY_DEFINITIONS.filter(
      (cat) =>
        cat.isApplicable(target, isMultiThreadEngine) &&
        !options.activeCategories.includes(cat.id) &&
        !(cat.isPinned && cat.isPinned(target)) &&
        (pickerSearch === '' ||
          cat.title.toLowerCase().includes(pickerSearch.toLowerCase()) ||
          cat.description.toLowerCase().includes(pickerSearch.toLowerCase()))
    );
  }, [target, isMultiThreadEngine, options.activeCategories, pickerSearch]);

  function addCategory(catId: ConfigCategoryId) {
    if (!options.activeCategories.includes(catId)) {
      update({ activeCategories: [...options.activeCategories, catId] });
    }
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
              className="h-7 text-[11px]"
            >
              <Plus className="size-3 mr-1 text-primary" />
              Personalizar Parâmetros
            </Button>
          </div>
        </Card>
      )}

      {/* Renderização da Pilha de Cards Ativos */}
      <div className="space-y-2.5">
        {options.activeCategories.map((catId) => {
          const catDef = CATEGORY_DEFINITIONS.find((c) => c.id === catId);
          if (!catDef) return null;
          const Icon = catDef.icon;
          const isCollapsed = Boolean(collapsedCards[catId]);
          const isPinned = Boolean(catDef.isPinned && catDef.isPinned(target));

          return (
            <Card
              key={catId}
              variant="raised"
              className="p-3.5 space-y-3 border-border bg-surface animate-in fade-in-50 duration-150"
            >
              {/* Cabeçalho do Card */}
              <div className="flex items-center justify-between gap-2 pb-1 border-b border-border/60">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="grid size-6 shrink-0 place-items-center rounded border border-border bg-surface text-primary">
                    <Icon className="size-3.5" strokeWidth={2} />
                  </span>
                  <Typography variant="body" className="font-semibold text-xs text-foreground">
                    {catDef.title}
                  </Typography>
                  {isPinned && (
                    <Badge variant="secondary" size="sm" className="text-[10px]">
                      Essencial
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleCardCollapse(catId)}
                    className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                    title={isCollapsed ? 'Expandir' : 'Recolher'}
                  >
                    {isCollapsed ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
                  </button>

                  {/* Botão de Remover (Apenas se NÃO for fixo) */}
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
                  {/* CARD: TAXA DE QUADROS (FPS) */}
                  {catId === 'fps' && (
                    <FpsCard options={options} onChange={update} />
                  )}

                  {/* CARD: RESOLUÇÃO E ESCALA (Compartilhado entre GIF, MP4, WebM, etc.) */}
                  {catId === 'resolution' && (
                    <ResolutionCard options={options} onChange={update} isGif={isGif} />
                  )}

                  {/* CARD: FAIXAS DE ÁUDIO (Zero dados mockados) */}
                  {catId === 'audio_tracks' && (
                    <AudioTracksCard
                      selectedTracks={options.selectedAudioTracks}
                      onChange={(tracks) => update({ selectedAudioTracks: tracks })}
                      probedMedia={probedMedia}
                    />
                  )}

                  {/* CARD: FAIXAS DE LEGENDA (Zero dados mockados) */}
                  {catId === 'subtitles' && (
                    <SubtitlesCard
                      selectedTracks={options.selectedSubtitleTracks}
                      onChange={(tracks) => update({ selectedSubtitleTracks: tracks })}
                      probedMedia={probedMedia}
                    />
                  )}

                  {/* CARD: THREADS DA CPU */}
                  {catId === 'threads' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">
                          Alocação de paralelismo do processador:
                        </span>
                        <Badge variant="secondary" size="sm" className="text-[10px] font-mono">
                          {availableCores} núcleos detectados
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        <button
                          type="button"
                          onClick={() => update({ threadsMode: 'auto', userMaxThreads: undefined, isCustomThreads: false })}
                          className={cn(
                            'px-2.5 py-1 text-[11px] rounded-md border font-medium transition-colors select-none',
                            !options.isCustomThreads && options.threadsMode === 'auto'
                              ? 'border-primary bg-primary/10 text-primary font-semibold'
                              : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground'
                          )}
                        >
                          Automático
                        </button>

                        {[2, 4, 8, availableCores]
                          .filter((c, idx, arr) => arr.indexOf(c) === idx && c <= availableCores)
                          .map((coreCount) => {
                            const isSelected = !options.isCustomThreads && options.threadsMode === 'custom' && options.userMaxThreads === coreCount;
                            const isMax = coreCount === availableCores;
                            return (
                              <button
                                key={coreCount}
                                type="button"
                                onClick={() => update({ threadsMode: 'custom', userMaxThreads: coreCount, isCustomThreads: false })}
                                className={cn(
                                  'px-2.5 py-1 text-[11px] rounded-md border font-mono font-medium transition-colors select-none',
                                  isSelected
                                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                                    : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground'
                                )}
                              >
                                {coreCount} {isMax ? 'threads (Máx)' : 'threads'}
                              </button>
                            );
                          })}

                        <button
                          type="button"
                          onClick={() => update({ isCustomThreads: true, threadsMode: 'custom', userMaxThreads: options.customThreads || 4 })}
                          className={cn(
                            'px-2.5 py-1 text-[11px] rounded-md border font-medium transition-colors select-none',
                            options.isCustomThreads
                              ? 'border-primary bg-primary/10 text-primary font-semibold'
                              : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground'
                          )}
                        >
                          Personalizado
                        </button>
                      </div>

                      {options.isCustomThreads && (
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[11px] text-muted-foreground">Número de threads:</span>
                          <input
                            type="number"
                            min="1"
                            max="32"
                            value={options.customThreads || options.userMaxThreads || 4}
                            onChange={(e) => {
                              const val = Math.max(1, Math.min(32, parseInt(e.target.value, 10) || 1));
                              update({ customThreads: val, userMaxThreads: val, threadsMode: 'custom', isCustomThreads: true });
                            }}
                            className="w-20 rounded border border-primary bg-surface-raised px-2 py-0.5 text-xs text-foreground focus:outline-none"
                          />
                          <span className="text-[11px] text-muted-foreground font-mono">threads (1 a 32)</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CARD: QUALIDADE E COMPRESSÃO */}
                  {catId === 'quality' && (
                    <div className="space-y-2">
                      <span className="text-[11px] text-muted-foreground block">
                        Taxa de compressão visual (CRF):
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {[
                          { id: 'original', label: 'Máxima Fidelidade', desc: 'CRF 18 • Original' },
                          { id: 'balanced', label: 'Equilibrado', desc: 'CRF 23 • Padrão' },
                          { id: 'compressed', label: 'Compacto', desc: 'CRF 28 • Menor' },
                          { id: 'custom', label: 'Personalizado', desc: 'Definir CRF livre' },
                        ].map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              if (item.id === 'custom') {
                                update({ qualityPreset: 'custom', isCustomQuality: true, customCrf: options.customCrf || 20 });
                              } else {
                                update({ qualityPreset: item.id as QualityPreset, isCustomQuality: false, customCrf: undefined });
                              }
                            }}
                            className={cn(
                              'p-2 text-left rounded-md border transition-colors select-none',
                              (options.qualityPreset || 'original') === item.id
                                ? 'border-primary bg-primary/10 text-foreground'
                                : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground'
                            )}
                          >
                            <div className="text-[11px] font-medium text-foreground">{item.label}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</div>
                          </button>
                        ))}
                      </div>

                      {options.isCustomQuality && (
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[11px] text-muted-foreground">Valor do CRF:</span>
                          <input
                            type="number"
                            min="0"
                            max="51"
                            value={options.customCrf || 20}
                            onChange={(e) => {
                              const val = Math.max(0, Math.min(51, parseInt(e.target.value, 10) || 0));
                              update({ customCrf: val, isCustomQuality: true, qualityPreset: 'custom' });
                            }}
                            className="w-20 rounded border border-primary bg-surface-raised px-2 py-0.5 text-xs text-foreground focus:outline-none"
                          />
                          <span className="text-[11px] text-muted-foreground font-mono">(0 = lossless, 51 = máx compressão)</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CARD: CODEC DE VÍDEO */}
                  {catId === 'video_codec' && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] text-muted-foreground block">
                        Formato de codificação do vídeo:
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {[
                          { id: 'auto', label: 'Automático', desc: 'Ideal para o contêiner' },
                          { id: 'h264', label: 'H.264 / AVC', desc: 'Compatibilidade total' },
                          { id: 'vp8', label: 'VP8', desc: 'Padrão WebM' },
                          { id: 'vp9', label: 'VP9', desc: 'Alta eficiência' },
                        ].map((codec) => (
                          <button
                            key={codec.id}
                            type="button"
                            onClick={() => update({ videoCodec: codec.id as VideoCodecChoice })}
                            className={cn(
                              'p-2 text-left rounded-md border transition-colors select-none',
                              (options.videoCodec || 'auto') === codec.id
                                ? 'border-primary bg-primary/10 text-foreground'
                                : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground'
                            )}
                          >
                            <div className="text-[11px] font-medium text-foreground">{codec.label}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">{codec.desc}</div>
                          </button>
                        ))}
                      </div>
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
