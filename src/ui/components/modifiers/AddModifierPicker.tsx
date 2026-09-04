import React from 'react';
import { Search, Plus, AlertTriangle } from 'lucide-react';
import { Card, Typography } from '@/ui/components/core';
import type { ModifierCategoryId, ModifierDefinition } from '@/shared/types/conversionModifiers';
import { isModifierIncompatibleWithEngine } from '@/modules/engineCapabilities';

export interface AddModifierPickerProps {
  availableToAdd: ModifierDefinition[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectModifier: (id: ModifierCategoryId) => void;
  onClose: () => void;
  currentEngineId?: string | null;
}

export function AddModifierPicker({
  availableToAdd,
  searchQuery,
  onSearchChange,
  onSelectModifier,
  onClose,
  currentEngineId,
}: AddModifierPickerProps) {
  return (
    <Card variant="raised" className="p-3 space-y-2 border-primary/30 bg-surface shadow-md animate-in fade-in-50 duration-150">
      <div className="flex items-center justify-between pb-1 border-b border-border">
        <Typography variant="body" className="font-semibold text-xs">
          Adicionar Modificador à Pilha
        </Typography>
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          Fechar
        </button>
      </div>

      {/* Caixa de Busca */}
      <div className="relative">
        <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar modificador (ex: áudio, legendas, threads, qualidade, fps)..."
          className="w-full rounded-md border border-border bg-surface-raised pl-8 pr-3 py-1.5 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          autoFocus
        />
      </div>

      {/* Lista de Opções Disponíveis */}
      <div className="max-h-56 overflow-y-auto space-y-1 pt-1 pr-0.5">
        {availableToAdd.length === 0 ? (
          <div className="p-3 text-center text-[11px] text-muted-foreground">
            {searchQuery ? 'Nenhum modificador encontrado com esse termo.' : 'Todos os modificadores disponíveis já foram adicionados à pilha!'}
          </div>
        ) : (
          availableToAdd.map((mod) => {
            const Icon = mod.icon;
            const isIncompatible = isModifierIncompatibleWithEngine(mod.id, currentEngineId);

            return (
              <div
                key={mod.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectModifier(mod.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectModifier(mod.id);
                  }
                }}
                className="flex items-center justify-between p-2 rounded-md border border-border bg-surface-raised/60 hover:bg-surface-raised hover:border-primary/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="grid size-7 shrink-0 place-items-center rounded border border-border bg-surface text-primary">
                    <Icon className="size-3.5" strokeWidth={2} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[12px] font-medium text-foreground">{mod.title}</span>
                      {isIncompatible && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded">
                          <AlertTriangle className="size-2.5 text-red-400" />
                          não compatível com o motor selecionado
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">{mod.description}</div>
                  </div>
                </div>
                <Plus className="size-4 text-primary shrink-0 ml-2" />
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
