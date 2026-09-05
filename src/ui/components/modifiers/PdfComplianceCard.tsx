import React from 'react';
import { Typography } from '@/ui/components/core';
import { cn } from '@/lib/utils';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import type { ConversionModifiers, PdfComplianceChoice } from '@/shared/types/conversionModifiers';

export interface PdfComplianceCardProps {
  options: ConversionModifiers;
  onChange: (updated: Partial<ConversionModifiers>) => void;
  warningMessage?: string;
}

export function PdfComplianceCard({
  options,
  onChange,
  warningMessage,
}: PdfComplianceCardProps) {
  const currentCompliance: PdfComplianceChoice = options.pdfCompliance || 'default';

  const presets: { id: PdfComplianceChoice; label: string; desc: string; badge?: string }[] = [
    { id: 'default', label: 'PDF Padrão', desc: 'Uso diário, menor tamanho de arquivo' },
    { id: 'pdfa-1b', label: 'PDF/A-1b', desc: 'ISO 19005-1 Preservação básica a longo prazo', badge: 'Legal' },
    { id: 'pdfa-2b', label: 'PDF/A-2b', desc: 'ISO 19005-2 Suporte a transparência e vetores', badge: 'Recomendado' },
    { id: 'pdfa-3b', label: 'PDF/A-3b', desc: 'ISO 19005-3 Permite embutir XML e anexos', badge: 'Arquivístico' },
  ];

  const currentLabel = presets.find((p) => p.id === currentCompliance)?.label || 'PDF Padrão';

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
          Padrão de conformidade PDF / PDF/A:
        </Typography>
        <span className="text-[11px] font-mono text-primary font-medium">
          {currentLabel}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {presets.map((preset) => {
          const isSelected = currentCompliance === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                onChange({ pdfCompliance: preset.id });
              }}
              className={cn(
                'p-2 text-left rounded-md border transition-colors select-none relative',
                isSelected
                  ? 'border-primary bg-primary/10 text-foreground font-medium'
                  : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-medium text-foreground">{preset.label}</div>
                {preset.badge && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-primary/20 text-primary font-mono font-normal">
                    {preset.badge}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{preset.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
