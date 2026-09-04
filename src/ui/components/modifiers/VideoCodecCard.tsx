import React from 'react';
import { Typography } from '@/ui/components/core';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';
import type { ConversionModifiers, VideoCodecChoice } from '@/shared/types/conversionModifiers';
import {
  VIDEO_CODEC_PRESETS,
  DEFAULT_VIDEO_CODECS,
  type VideoCodecPresetData,
} from '@/core/knowledge/videoCodecs';

export interface VideoCodecCardProps {
  options: ConversionModifiers;
  onChange: (updated: Partial<ConversionModifiers>) => void;
  allowedOptions?: (string | number)[];
  warningMessage?: string;
}

export function VideoCodecCard({
  options,
  onChange,
  allowedOptions,
  warningMessage,
}: VideoCodecCardProps) {
  const activeAllowed: VideoCodecChoice[] = allowedOptions && allowedOptions.length > 0
    ? (allowedOptions.map(String) as VideoCodecChoice[])
    : DEFAULT_VIDEO_CODECS;

  const currentCodec = options.videoCodec || 'auto';

  const presets: VideoCodecPresetData[] = activeAllowed
    .filter((id) => VIDEO_CODEC_PRESETS[id])
    .map((id) => VIDEO_CODEC_PRESETS[id]);

  const currentLabel = VIDEO_CODEC_PRESETS[currentCodec]?.label || 'Automático';

  return (
    <div className="space-y-2 pt-0.5">
      {warningMessage && (
        <div className="flex items-center gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{warningMessage}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Typography variant="caption" color="muted">
          Codificador de vídeo:
        </Typography>
        <span className="text-[11px] font-mono text-primary font-medium">
          {currentLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {presets.map((codec) => {
          const isSelected = currentCodec === codec.id;
          return (
            <button
              key={codec.id}
              type="button"
              onClick={() => onChange({ videoCodec: codec.id })}
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
  );
}
