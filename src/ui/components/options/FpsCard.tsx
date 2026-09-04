import React from 'react';
import { Typography } from '@/ui/components/core';
import { cn } from '@/lib/utils';
import type { ConversionOptions } from '@/shared/types/conversionOptions';
import type { MediaProbeResult } from '@/core/media/mediaProbe';

export interface FpsCardProps {
  options: ConversionOptions;
  onChange: (updated: Partial<ConversionOptions>) => void;
  targetFormat?: string;
  probedMedia?: MediaProbeResult;
}

export function FpsCard({ options, onChange, targetFormat, probedMedia }: FpsCardProps) {
  const isGif = targetFormat?.toLowerCase().replace(/^\.+/, '') === 'gif';
  const probedFps = probedMedia?.fps || options.probedMedia?.fps;

  // For video, fallback to probedFps if available, else 30; for GIF fallback to 12
  const currentFps = options.customFps || (isGif ? (options.gifFps || 12) : (probedFps || 30));
  const isCustomFps = Boolean(options.isCustomFps);

  if (isGif) {
    const gifPresets = [
      { value: 10, label: '10' },
      { value: 12, label: '12' },
      { value: 15, label: '15' },
      { value: 24, label: '24' },
      { value: 30, label: '30' },
    ];

    return (
      <div className="space-y-2 pt-0.5">
        <div className="flex items-center justify-between">
          <Typography variant="caption" color="muted">
            Quantidade de quadros exibidos por segundo:
          </Typography>
          <span className="text-[11px] font-mono text-primary font-medium">
            {currentFps} fps
          </span>
        </div>

        <div className="grid grid-cols-6 gap-1.5">
          {gifPresets.map((item) => {
            const isSelected = !isCustomFps && (options.gifFps || 12) === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => onChange({ gifFps: item.value, customFps: item.value, isCustomFps: false })}
                className={cn(
                  'px-1.5 py-1 text-[11px] rounded border transition-colors select-none text-center font-medium',
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground'
                )}
              >
                {item.label}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => onChange({ isCustomFps: true, customFps: options.customFps || options.gifFps || 18, gifFps: options.customFps || options.gifFps || 18 })}
            className={cn(
              'px-1.5 py-1 text-[11px] rounded border transition-colors select-none text-center font-medium',
              isCustomFps
                ? 'border-primary bg-primary/10 text-primary font-semibold'
                : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground'
            )}
          >
            Custom
          </button>
        </div>

        {isCustomFps && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] text-muted-foreground">FPS personalizado:</span>
            <input
              type="number"
              min="1"
              max="120"
              value={options.customFps || 18}
              onChange={(e) => {
                const val = Math.max(1, Math.min(120, parseInt(e.target.value, 10) || 1));
                onChange({ customFps: val, gifFps: val, isCustomFps: true });
              }}
              className="w-20 rounded border border-primary bg-surface-raised px-2 py-0.5 text-xs text-foreground focus:outline-none"
            />
            <span className="text-[11px] text-muted-foreground font-mono">fps (1 a 120)</span>
          </div>
        )}
      </div>
    );
  }

  // Target is Video (e.g. MP4, MKV, WebM, etc.)
  const basePresets = [
    { fps: 24, label: '24 fps', desc: 'Cinema' },
    { fps: 30, label: '30 fps', desc: 'Padrão' },
    { fps: 60, label: '60 fps', desc: 'Fluido (60p)' },
  ];

  let videoPresets: { id: string; fps: number; label: string; desc: string }[] = [];

  if (probedFps) {
    const matchesBase = basePresets.find((p) => p.fps === probedFps);
    if (matchesBase) {
      // The video's FPS is the same as an existing preset: rename that preset button to `Original (${probedFps} fps)`
      videoPresets = basePresets.map((p) => {
        if (p.fps === probedFps) {
          return {
            id: String(p.fps),
            fps: p.fps,
            label: `Original (${probedFps} fps)`,
            desc: 'Nativo do arquivo',
          };
        }
        return {
          id: String(p.fps),
          fps: p.fps,
          label: p.label,
          desc: p.desc,
        };
      });
    } else {
      // The video's FPS is non-standard (e.g. 25 fps, 50 fps, 15 fps): prepend it to the presets
      videoPresets = [
        {
          id: String(probedFps),
          fps: probedFps,
          label: `Original (${probedFps} fps)`,
          desc: 'Nativo do arquivo',
        },
        ...basePresets.map((p) => ({
          id: String(p.fps),
          fps: p.fps,
          label: p.label,
          desc: p.desc,
        })),
      ];
    }
  } else {
    // No probed FPS available
    videoPresets = basePresets.map((p) => ({
      id: String(p.fps),
      fps: p.fps,
      label: p.label,
      desc: p.desc,
    }));
  }

  return (
    <div className="space-y-2 pt-0.5">
      <div className="flex items-center justify-between">
        <Typography variant="caption" color="muted">
          Taxa de quadros do vídeo final:
        </Typography>
        <span className="text-[11px] font-mono text-primary font-medium">
          {!isCustomFps && currentFps === probedFps
            ? `Original (${currentFps} fps)`
            : `${currentFps} fps`}
        </span>
      </div>

      <div className={cn(
        'grid gap-1.5',
        videoPresets.length >= 4 ? 'grid-cols-5' : 'grid-cols-4'
      )}>
        {videoPresets.map((item) => {
          const isSelected = !isCustomFps && (
            options.customFps !== undefined
              ? options.customFps === item.fps
              : item.fps === (probedFps || 30)
          );

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onChange({ customFps: item.fps, gifFps: item.fps, isCustomFps: false });
              }}
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

        <button
          type="button"
          onClick={() =>
            onChange({
              isCustomFps: true,
              customFps: options.customFps || probedFps || 30,
              gifFps: options.customFps || probedFps || 30,
            })
          }
          className={cn(
            'p-2 text-left rounded-md border transition-colors select-none',
            isCustomFps
              ? 'border-primary bg-primary/10 text-foreground font-medium'
              : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground'
          )}
        >
          <div className="text-[11px] font-medium text-foreground">Custom</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Definir fps</div>
        </button>
      </div>

      {isCustomFps && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[11px] text-muted-foreground">FPS personalizado:</span>
          <input
            type="number"
            min="1"
            max="120"
            value={options.customFps || 30}
            onChange={(e) => {
              const val = Math.max(1, Math.min(120, parseInt(e.target.value, 10) || 1));
              onChange({ customFps: val, gifFps: val, isCustomFps: true });
            }}
            className="w-20 rounded border border-primary bg-surface-raised px-2 py-0.5 text-xs text-foreground focus:outline-none"
          />
          <span className="text-[11px] text-muted-foreground font-mono">fps (1 a 120)</span>
        </div>
      )}
    </div>
  );
}
