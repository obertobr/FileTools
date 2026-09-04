import React from 'react';
import { Search, Plus } from 'lucide-react';
import { Card, Typography } from '@/ui/components/core';
import type { ConfigCategoryId } from '@/shared/types/conversionOptions';
import type { CategoryDefinition } from './CategoryDefinitions';

export interface AddCategoryPickerProps {
  availableToAdd: CategoryDefinition[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectCategory: (id: ConfigCategoryId) => void;
  onClose: () => void;
}

export function AddCategoryPicker({
  availableToAdd,
  searchQuery,
  onSearchChange,
  onSelectCategory,
  onClose,
}: AddCategoryPickerProps) {
  return (
    <Card variant="raised" className="p-3 space-y-2 border-primary/30 bg-surface shadow-md animate-in fade-in-50 duration-150">
      <div className="flex items-center justify-between pb-1 border-b border-border">
        <Typography variant="body" className="font-semibold text-xs">
          Adicionar Categoria à Pilha
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
          placeholder="Buscar configuração (ex: áudio, legendas, threads, qualidade)..."
          className="w-full rounded-md border border-border bg-surface-raised pl-8 pr-3 py-1.5 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          autoFocus
        />
      </div>

      {/* Lista de Opções Disponíveis */}
      <div className="max-h-56 overflow-y-auto space-y-1 pt-1 pr-0.5">
        {availableToAdd.length === 0 ? (
          <div className="p-3 text-center text-[11px] text-muted-foreground">
            {searchQuery ? 'Nenhuma categoria encontrada com esse termo.' : 'Todas as categorias disponíveis já foram adicionadas à pilha!'}
          </div>
        ) : (
          availableToAdd.map((cat) => {
            const Icon = cat.icon;
            return (
              <div
                key={cat.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectCategory(cat.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectCategory(cat.id);
                  }
                }}
                className="flex items-center justify-between p-2 rounded-md border border-border bg-surface-raised/60 hover:bg-surface-raised hover:border-primary/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="grid size-7 shrink-0 place-items-center rounded border border-border bg-surface text-primary">
                    <Icon className="size-3.5" strokeWidth={2} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[12px] font-medium text-foreground">{cat.title}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{cat.description}</div>
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
