import React from 'react';
import { Typography, Input } from '@/ui/components/core';
import { cn } from '@/lib/utils';
import type { ConversionModifiers } from '@/shared/types/conversionModifiers';
import {
  AUDIO_SAMPLE_RATE_PRESETS,
  AUDIO_CHANNEL_PRESETS,
  AUDIO_NORMALIZE_PRESETS,
  IMAGE_ROTATION_PRESETS,
  BACKGROUND_COLOR_PRESETS,
  ARCHIVE_COMPRESSION_PRESETS,
  SVG_PRECISION_PRESETS,
  CAD_TESSELLATION_PRESETS,
  MESH_SCALE_PRESETS,
  CSV_DELIMITER_PRESETS,
  type PresetOption,
} from '@/core/knowledge/modifierPresets';

interface CardProps {
  options: ConversionModifiers;
  onChange: (updated: Partial<ConversionModifiers>) => void;
}

function PresetGrid<T extends string | number>({
  label,
  currentLabel,
  items,
  selectedValue,
  onSelect,
  columnsClass = 'grid-cols-2 sm:grid-cols-3',
}: {
  label: string;
  currentLabel: string;
  items: PresetOption<T>[];
  selectedValue: T;
  onSelect: (val: T) => void;
  columnsClass?: string;
}) {
  return (
    <div className="space-y-2 pt-0.5">
      <div className="flex items-center justify-between">
        <Typography variant="caption" color="muted">
          {label}
        </Typography>
        <span className="text-[11px] font-mono text-primary font-medium">{currentLabel}</span>
      </div>
      <div className={cn('grid gap-1.5', columnsClass)}>
        {items.map((item) => {
          const isSelected = selectedValue === item.value;
          return (
            <button
              key={String(item.value)}
              type="button"
              onClick={() => onSelect(item.value)}
              className={cn(
                'p-2 text-left rounded-md border transition-colors select-none',
                isSelected
                  ? 'border-primary bg-primary/10 text-foreground font-medium'
                  : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground'
              )}
            >
              <div className="text-[11px] font-medium text-foreground">{item.label}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AudioSampleRateCard({ options, onChange }: CardProps) {
  const rate = options.audioSampleRate ?? 44100;
  return (
    <PresetGrid
      label="Frequência de amostragem:"
      currentLabel={`${rate} Hz`}
      items={AUDIO_SAMPLE_RATE_PRESETS}
      selectedValue={rate}
      onSelect={(val) => onChange({ audioSampleRate: val })}
    />
  );
}

export function AudioChannelsCard({ options, onChange }: CardProps) {
  const ch = options.audioChannels ?? 2;
  return (
    <PresetGrid
      label="Configuração de canais:"
      currentLabel={ch === 1 ? 'Mono (1.0)' : 'Estéreo (2.0)'}
      items={AUDIO_CHANNEL_PRESETS}
      selectedValue={ch}
      columnsClass="grid-cols-2"
      onSelect={(val) => onChange({ audioChannels: val })}
    />
  );
}

export function AudioNormalizeCard({ options, onChange }: CardProps) {
  const mode = options.audioNormalize ?? 'off';
  return (
    <PresetGrid
      label="Nivelamento de volume:"
      currentLabel={mode.toUpperCase()}
      items={AUDIO_NORMALIZE_PRESETS}
      selectedValue={mode}
      onSelect={(val) => onChange({ audioNormalize: val })}
    />
  );
}

export function MediaTrimCard({ options, onChange }: CardProps) {
  return (
    <div className="space-y-2 pt-0.5">
      <Typography variant="caption" color="muted">
        Corte de intervalo em segundos (vazio = início/fim original):
      </Typography>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <span className="text-[11px] text-muted-foreground">Início (seg)</span>
          <Input
            type="number"
            min={0}
            step={0.1}
            placeholder="0"
            value={options.trimStartSeconds ?? ''}
            onChange={(e) =>
              onChange({
                trimStartSeconds: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)),
              })
            }
          />
        </div>
        <div className="space-y-1">
          <span className="text-[11px] text-muted-foreground">Fim (seg)</span>
          <Input
            type="number"
            min={0}
            step={0.1}
            placeholder="Fim"
            value={options.trimEndSeconds ?? ''}
            onChange={(e) =>
              onChange({
                trimEndSeconds: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)),
              })
            }
          />
        </div>
      </div>
    </div>
  );
}

export function ImageTransformCard({ options, onChange }: CardProps) {
  const deg = options.imageRotateDeg ?? 0;
  return (
    <div className="space-y-2.5 pt-0.5">
      <PresetGrid
        label="Rotação:"
        currentLabel={`${deg}°`}
        items={IMAGE_ROTATION_PRESETS}
        selectedValue={deg}
        columnsClass="grid-cols-2 sm:grid-cols-4"
        onSelect={(val) => onChange({ imageRotateDeg: val })}
      />
      <div className="grid grid-cols-2 gap-1.5">
        {(
          [
            ['imageFlipH', 'Espelhar Horizontal'],
            ['imageFlipV', 'Espelhar Vertical'],
            ['imageGrayscale', 'Escala de Cinza'],
            ['imageStripMetadata', 'Remover EXIF/GPS'],
          ] as const
        ).map(([key, title]) => {
          const active = Boolean(options[key]);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange({ [key]: !active })}
              className={cn(
                'px-2.5 py-1.5 text-left rounded-md border text-[11px] transition-colors',
                active
                  ? 'border-primary bg-primary/10 text-foreground font-medium'
                  : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground'
              )}
            >
              {title}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function BackgroundColorCard({ options, onChange }: CardProps) {
  const color = options.backgroundColor || '#ffffff';
  return (
    <div className="space-y-2 pt-0.5">
      <PresetGrid
        label="Cor de preenchimento do canal alfa:"
        currentLabel={color.toUpperCase()}
        items={BACKGROUND_COLOR_PRESETS}
        selectedValue={color.toLowerCase()}
        onSelect={(val) => onChange({ backgroundColor: val })}
      />
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground">Hex customizado:</span>
        <Input
          type="text"
          value={color}
          onChange={(e) => onChange({ backgroundColor: e.target.value })}
          className="h-7 w-28 font-mono text-xs"
        />
      </div>
    </div>
  );
}

export function ArchiveCompressionCard({ options, onChange }: CardProps) {
  const level = options.archiveCompressionLevel ?? 6;
  return (
    <PresetGrid
      label="Nível de compressão:"
      currentLabel={`Nível ${level}`}
      items={ARCHIVE_COMPRESSION_PRESETS}
      selectedValue={level}
      columnsClass="grid-cols-2 sm:grid-cols-4"
      onSelect={(val) => onChange({ archiveCompressionLevel: val })}
    />
  );
}

export function ArchivePasswordCard({ options, onChange }: CardProps) {
  return (
    <div className="space-y-1.5 pt-0.5">
      <Typography variant="caption" color="muted">
        Senha AES-256 (para proteger saída ou abrir arquivo criptografado):
      </Typography>
      <Input
        type="password"
        placeholder="Digite a senha opcional..."
        value={options.archivePassword ?? ''}
        onChange={(e) => onChange({ archivePassword: e.target.value })}
      />
    </div>
  );
}

export function SvgOptimizeCard({ options, onChange }: CardProps) {
  const precision = options.svgFloatPrecision ?? 3;
  return (
    <div className="space-y-2.5 pt-0.5">
      <PresetGrid
        label="Precisão decimal de coordenadas:"
        currentLabel={`${precision} casas`}
        items={SVG_PRECISION_PRESETS}
        selectedValue={precision}
        columnsClass="grid-cols-2 sm:grid-cols-4"
        onSelect={(val) => onChange({ svgFloatPrecision: val })}
      />
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => onChange({ svgMultipass: !(options.svgMultipass ?? true) })}
          className={cn(
            'px-2.5 py-1.5 text-left rounded-md border text-[11px] transition-colors',
            (options.svgMultipass ?? true)
              ? 'border-primary bg-primary/10 text-foreground font-medium'
              : 'border-border bg-surface-raised text-muted-foreground'
          )}
        >
          Multipass Ativo
        </button>
        <button
          type="button"
          onClick={() => onChange({ svgRemoveDimensions: !options.svgRemoveDimensions })}
          className={cn(
            'px-2.5 py-1.5 text-left rounded-md border text-[11px] transition-colors',
            options.svgRemoveDimensions
              ? 'border-primary bg-primary/10 text-foreground font-medium'
              : 'border-border bg-surface-raised text-muted-foreground'
          )}
        >
          Remover width/height fixos
        </button>
      </div>
    </div>
  );
}

export function FontSubsetCard({ options, onChange }: CardProps) {
  return (
    <div className="space-y-1.5 pt-0.5">
      <Typography variant="caption" color="muted">
        Caracteres a manter no subset (deixe vazio para preservar todos os glifos):
      </Typography>
      <Input
        type="text"
        placeholder="Ex: ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        value={options.fontSubsetText ?? ''}
        onChange={(e) => onChange({ fontSubsetText: e.target.value })}
      />
    </div>
  );
}

export function CadTessellationCard({ options, onChange }: CardProps) {
  const q = options.cadQuality ?? 'standard';
  return (
    <PresetGrid
      label="Densidade da malha CAD (B-Rep):"
      currentLabel={q.toUpperCase()}
      items={CAD_TESSELLATION_PRESETS}
      selectedValue={q}
      onSelect={(val) => onChange({ cadQuality: val })}
    />
  );
}

export function MeshOptionsCard({ options, onChange }: CardProps) {
  const scale = options.meshScale ?? 1;
  return (
    <div className="space-y-2.5 pt-0.5">
      <PresetGrid
        label="Conversão de escala / unidades:"
        currentLabel={`${scale}x`}
        items={MESH_SCALE_PRESETS}
        selectedValue={scale}
        columnsClass="grid-cols-2 sm:grid-cols-4"
        onSelect={(val) => onChange({ meshScale: val })}
      />
      <button
        type="button"
        onClick={() => onChange({ meshAsciiStl: !options.meshAsciiStl })}
        className={cn(
          'w-full px-2.5 py-1.5 text-left rounded-md border text-[11px] transition-colors',
          options.meshAsciiStl
            ? 'border-primary bg-primary/10 text-foreground font-medium'
            : 'border-border bg-surface-raised text-muted-foreground'
        )}
      >
        Exportar STL em formato texto ASCII (em vez de binário)
      </button>
    </div>
  );
}

export function CsvDelimiterCard({ options, onChange }: CardProps) {
  const delim = options.csvDelimiter ?? ',';
  return (
    <PresetGrid
      label="Delimitador de colunas:"
      currentLabel={delim === '\t' ? 'TAB' : delim}
      items={CSV_DELIMITER_PRESETS}
      selectedValue={delim}
      columnsClass="grid-cols-2 sm:grid-cols-4"
      onSelect={(val) => onChange({ csvDelimiter: val })}
    />
  );
}
