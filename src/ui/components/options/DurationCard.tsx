import React from 'react';
import { cn } from '@/lib/utils';

export interface DurationCardProps {
  durationSeconds: number;
  isCustom: boolean;
  onChange: (duration: number, isCustom: boolean) => void;
}

const PRESETS = [
  { value: 3, label: '3s', desc: 'Rápido' },
  { value: 5, label: '5s', desc: 'Curto' },
  { value: 10, label: '10s', desc: 'Padrão' },
  { value: 15, label: '15s', desc: 'Story/Reels' },
  { value: 30, label: '30s', desc: 'Médio' },
  { value: 60, label: '60s', desc: '1 minuto' },
];

export function DurationCard({
  durationSeconds,
  isCustom,
  onChange,
}: DurationCardProps) {
  return (
    <div className="space-y-2">
      <span className="text-[11px] text-muted-foreground block">
        Tempo de exibição da imagem no vídeo:
      </span>

      <div className="grid grid-cols-3 sm:grid-cols-7 gap-1.5">
        {PRESETS.map((preset) => {
          const isSelected = !isCustom && durationSeconds === preset.value;
          return (
            <button
              key={preset.value}
              type="button"
              onClick={() => onChange(preset.value, false)}
              className={cn(
                'p-2 text-left rounded-md border transition-colors select-none',
                isSelected
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground'
              )}
            >
              <div className="text-[11px] font-medium text-foreground">{preset.label}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{preset.desc}</div>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onChange(durationSeconds || 10, true)}
          className={cn(
            'p-2 text-left rounded-md border transition-colors select-none',
            isCustom
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground'
          )}
        >
          <div className="text-[11px] font-medium text-foreground">Personalizado</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Segundos</div>
        </button>
      </div>

      {isCustom && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[11px] text-muted-foreground">Duração exata:</span>
          <input
            type="number"
            min="1"
            max="3600"
            value={durationSeconds}
            onChange={(e) => {
              const val = Math.max(1, Math.min(3600, parseInt(e.target.value, 10) || 1));
              onChange(val, true);
            }}
            className="w-20 rounded border border-primary bg-surface-raised px-2 py-0.5 text-xs text-foreground focus:outline-none font-mono"
          />
          <span className="text-[11px] text-muted-foreground font-mono">segundos (1s a 3600s)</span>
        </div>
      )}
    </div>
  );
}
