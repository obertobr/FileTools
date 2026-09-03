import React, { useState } from 'react';
import { Zap, Cpu, Laptop, ChevronDown, ChevronUp, Check, Layers } from 'lucide-react';
import type { EngineOption } from '@/modules/registry';
import { Card, Typography, Badge, Button } from '@/ui/components/core';
import { cn } from '@/lib/utils';

export interface EngineSelectorProps {
  engines: EngineOption[];
  selectedEngineId: string | null;
  onSelectEngine: (engineId: string) => void;
}

function getAccelerationIcon(type: EngineOption['acceleration']) {
  switch (type) {
    case 'gpu':
      return <Zap className="size-3.5 text-primary" strokeWidth={2} />;
    case 'instant-copy':
      return <Zap className="size-3.5 text-primary" strokeWidth={2} />;
    case 'cpu-multithread':
      return <Cpu className="size-3.5 text-foreground" strokeWidth={1.75} />;
    case 'cpu-singlethread':
    default:
      return <Laptop className="size-3.5 text-muted-foreground" strokeWidth={1.75} />;
  }
}

function getAccelerationBadge(type: EngineOption['acceleration']) {
  switch (type) {
    case 'gpu':
      return <Badge variant="primary" size="sm">⚡ GPU Acelerado</Badge>;
    case 'instant-copy':
      return <Badge variant="primary" size="sm">⚡ Cópia Direta</Badge>;
    case 'cpu-multithread':
      return <Badge variant="secondary" size="sm">🚀 Multi-core CPU</Badge>;
    case 'cpu-singlethread':
    default:
      return <Badge variant="default" size="sm">💻 CPU Padrão</Badge>;
  }
}

export function EngineSelector({
  engines,
  selectedEngineId,
  onSelectEngine,
}: EngineSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (engines.length === 0) return null;

  const currentEngine = engines.find((e) => e.moduleId === selectedEngineId) ?? engines[0];
  const hasMultiple = engines.length > 1;

  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Layers className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
          <Typography variant="h3" color="muted">
            Motor de Conversão
          </Typography>
        </div>
        {hasMultiple && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="focus-ring flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>{isExpanded ? 'Recolher' : `${engines.length} opções disponíveis`}</span>
            {isExpanded ? (
              <ChevronUp className="size-3" />
            ) : (
              <ChevronDown className="size-3" />
            )}
          </button>
        )}
      </div>

      {/* Selected / Recommended Engine Header Card */}
      <Card
        variant={currentEngine.acceleration === 'gpu' ? 'alert-success' : 'raised'}
        className="px-3 py-2.5"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="grid size-7 shrink-0 place-items-center rounded-sm border border-border bg-surface">
              {getAccelerationIcon(currentEngine.acceleration)}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Typography variant="body" className="font-medium truncate">
                  {currentEngine.moduleName}
                </Typography>
                {currentEngine.isRecommended && (
                  <Badge variant="primary" size="sm">
                    Recomendado
                  </Badge>
                )}
              </div>
              <Typography variant="caption" color="muted" className="truncate mt-0.5 block">
                {currentEngine.performanceNotes}
              </Typography>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {getAccelerationBadge(currentEngine.acceleration)}
            <span className="font-mono text-[11px] text-muted-foreground">
              {currentEngine.speedScore}/100
            </span>
          </div>
        </div>
      </Card>

      {/* Expandable list of alternate engines */}
      {hasMultiple && isExpanded && (
        <div className="grid gap-1.5 pt-1">
          {engines.map((engine) => {
            const isSelected = engine.moduleId === currentEngine.moduleId;
            return (
              <div
                key={engine.moduleId}
                role="button"
                tabIndex={0}
                onClick={() => onSelectEngine(engine.moduleId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectEngine(engine.moduleId);
                  }
                }}
                className={cn(
                  'focus-ring flex items-center justify-between rounded-md border p-2.5 transition-all cursor-pointer select-none',
                  isSelected
                    ? 'border-primary/50 bg-accent-subtle/20'
                    : 'border-border bg-surface hover:border-border-strong hover:bg-surface-raised'
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="grid size-6 shrink-0 place-items-center rounded-sm border border-border bg-surface">
                    {getAccelerationIcon(engine.acceleration)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Typography
                        variant="body"
                        className={cn('text-[12px] font-medium', isSelected && 'text-primary')}
                      >
                        {engine.moduleName}
                      </Typography>
                      {engine.isRecommended && (
                        <span className="text-[10px] text-primary font-semibold">
                          ★ Mais rápido
                        </span>
                      )}
                    </div>
                    <Typography variant="caption" color="muted" className="text-[11px] truncate block">
                      {engine.performanceNotes}
                    </Typography>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {getAccelerationBadge(engine.acceleration)}
                  <span className="font-mono text-[11px] text-muted-foreground w-12 text-right">
                    {engine.speedScore} pts
                  </span>
                  {isSelected && (
                    <Check className="size-3.5 text-primary ml-1 shrink-0" strokeWidth={2.5} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
