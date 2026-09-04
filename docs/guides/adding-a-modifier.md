# Guia: Como Adicionar um Novo Modificador à Pilha de Modificadores (Modifier Stack)

**Status:** Normativo / Obrigatório  
**Última Atualização:** 2026-09-04  
**Pré-requisitos:** Leitura de [`docs/guides/adding-a-module.md`](./adding-a-module.md) e [`docs/ARCHITECTURE.MD`](../ARCHITECTURE.MD)

---

## Visão Geral

O sistema de **Modifier Stack** (Pilha de Modificadores) permite ao usuário adicionar, remover e customizar parâmetros avançados de conversão de forma modular. Cada parâmetro é um **modificador** registrado como uma categoria que pode ser adicionada à pilha sob demanda e que aparece como um card expansível na UI.

### Arquitetura da Pilha de Modificadores

```
ConvertPanel.tsx                          -> Estado: ConversionModifiers (conversionModifiers state)
  └── ConversionModifiersPanel.tsx        -> Orquestra a pilha de cards + picker de adição
       ├── modifiers/ModifierDefinitions.ts -> Catálogo de modificadores disponíveis (metadata)
       ├── modifiers/AddModifierPicker.tsx  -> Modal de busca/adição de modificadores
       ├── modifiers/AudioTracksCard.tsx    -> Card: seleção de faixas de áudio
       ├── modifiers/AudioMergeCard.tsx     -> Card: unir/mesclar faixas de áudio
       ├── modifiers/SubtitlesCard.tsx      -> Card: seleção de legendas
       ├── modifiers/FpsCard.tsx            -> Card: taxa de quadros (FPS nativo/custom)
       ├── modifiers/ResolutionCard.tsx     -> Card: resolução/escala
       ├── modifiers/DurationCard.tsx       -> Card: duração de vídeo (gerado de imagem)
       └── (inline no Panel)                -> Cards de Threads, Qualidade, Codec
```

### Fluxo de Dados

```
[1] conversionModifiers.ts      -> Define o tipo ModifierCategoryId e campos em ConversionModifiers
                ↓
[2] ModifierDefinitions.ts     -> Registra metadata (título, ícone, regras de aplicabilidade)
                ↓
[3] Card Component (.tsx)       -> UI do card modular (controles, callbacks onChange)
                ↓
[4] ConversionModifiersPanel.tsx -> Monta pilha, conecta card ao estado, gerencia add/remove/auto-pruning
                ↓
[5] engineCapabilities.ts       -> Valida compatibilidade do modificador com o motor selecionado
                ↓
[6] Módulo (ex: ffmpeg-mt.ts)   -> Lê inputs.modifiers e aplica os parâmetros na conversão real
```

### Arquivos Envolvidos (em ordem de implementação)

| # | Arquivo | Ação |
|---|---|---|
| 1 | `src/shared/types/conversionModifiers.ts` | **MODIFICAR** — Adicionar ID à union `ModifierCategoryId` + campos à interface `ConversionModifiers` + defaults |
| 2 | `src/ui/components/modifiers/ModifierDefinitions.ts` | **MODIFICAR** — Adicionar definição do modificador (título, ícone, aplicabilidade semântica) |
| 3 | `src/ui/components/modifiers/MeuModificadorCard.tsx` | **CRIAR** — Componente do card com controles, feedback visual e acessibilidade |
| 4 | `src/ui/components/ConversionModifiersPanel.tsx` | **MODIFICAR** — Importar card, adicionar à renderização e ao reset ao remover |
| 5 | `src/modules/<motor>.ts` | **DECLARAR** — Adicionar ID ao `supportedModifiers` nos motores compatíveis (IoC) |
| 6 | `src/modules/ffmpeg-mt.ts` e `ffmpeg.ts` | **MODIFICAR** — Ler `inputs.modifiers` e injetar flags de linha de comando ou filtros |
| 7 | `e2e/test-modifiers.spec.ts` | **CRIAR/ATUALIZAR** — Teste E2E cobrindo adição, interação e remoção do modificador |

---

## Passo 1: Definir os Tipos em `conversionModifiers.ts`

Edite [`src/shared/types/conversionModifiers.ts`](../../src/shared/types/conversionModifiers.ts).

### 1.1. Adicionar o ID à Union `ModifierCategoryId`

```typescript
export type ModifierCategoryId =
  | 'video_codec'
  | 'audio_codec'
  | 'quality'
  | 'fps'
  | 'resolution'
  | 'threads'
  | 'audio_tracks'
  | 'audio_merge'
  | 'subtitles'
  | 'video_duration'
  | 'meu_modificador'; // <-- SEU NOVO MODIFICADOR
```

### 1.2. Adicionar Campos à Interface `ConversionModifiers`

```typescript
export interface ConversionModifiers {
  // ... campos existentes ...

  // Meu Modificador
  meuModificadorValor?: string;
  meuModificadorAtivo?: boolean;
}
```

### 1.3. Atualizar `DEFAULT_CONVERSION_MODIFIERS`

```typescript
export const DEFAULT_CONVERSION_MODIFIERS: ConversionModifiers = {
  // ... existentes ...
  meuModificadorValor: undefined,
  meuModificadorAtivo: false,
};
```

---

## Passo 2: Registrar a Definição em `ModifierDefinitions.ts`

Edite [`src/ui/components/modifiers/ModifierDefinitions.ts`](../../src/ui/components/modifiers/ModifierDefinitions.ts).

```typescript
{
  id: 'meu_modificador',
  title: 'Meu Modificador',
  description: 'Breve descrição do que este modificador faz.',
  icon: 'Wrench', // Ícone Lucide
  pinned: false,  // true se deve vir aberto por padrão; false para ficar no picker
  isApplicable: (targetExt: string, sourceCategory?: string, targetCategory?: string) => {
    // Regra semântica baseada em categorias de mídia
    return targetCategory === 'video';
  },
}
```

---

## Passo 3: Criar o Componente do Card

Crie `src/ui/components/modifiers/MeuModificadorCard.tsx`.

```typescript
import React from 'react';
import type { ConversionModifiers } from '@/shared/types/conversionModifiers';
import { Typography } from '@/ui/components/core';

export interface MeuModificadorCardProps {
  modifiers: ConversionModifiers;
  onChange: (updated: Partial<ConversionModifiers>) => void;
  disabled?: boolean;
}

export const MeuModificadorCard: React.FC<MeuModificadorCardProps> = ({
  modifiers,
  onChange,
  disabled,
}) => {
  return (
    <div className="space-y-4">
      <Typography variant="caption" className="text-surface-400">
        Configure as opções do seu modificador:
      </Typography>
      {/* Controles usando tokens do Design System */}
    </div>
  );
};
```

---

## Passo 4: Integrar no `ConversionModifiersPanel.tsx`

Edite [`src/ui/components/ConversionModifiersPanel.tsx`](../../src/ui/components/ConversionModifiersPanel.tsx).

1. Importe o card:
```typescript
import { MeuModificadorCard } from './modifiers/MeuModificadorCard';
```

2. Renderize dentro do switch/case de cards:
```typescript
case 'meu_modificador':
  return (
    <MeuModificadorCard
      modifiers={modifiers}
      onChange={onChange}
      disabled={disabled}
    />
  );
```

3. No reset de remoção do modificador (`handleRemoveCategory`):
```typescript
if (catId === 'meu_modificador') {
  resetFields.meuModificadorValor = undefined;
  resetFields.meuModificadorAtivo = false;
}
```

---

## Passo 5: Declarar Suporte nos Motores (Inversão de Controle)

Diferente de sistemas com orquestradores frágeis cheios de `if/else` hardcoded, o FileTools adota **Inversão de Controle (IoC)**: as capacidades de suporte a modificadores pertencem diretamente ao manifesto de cada motor (`ModuleManifest.supportedModifiers`).

O orquestrador central (`src/modules/engineCapabilities.ts`) consulta diretamente o manifesto do motor selecionado:
```typescript
return !engine.manifest.supportedModifiers.includes(modifierId);
```

Por isso, você **NÃO precisa alterar o `engineCapabilities.ts`**. Para que um motor seja compatível com seu novo modificador, basta incluir o ID no array `supportedModifiers` do módulo correspondente (ex: `src/modules/ffmpeg-mt.ts`):

```typescript
manifest: {
  id: 'ffmpeg-core-mt',
  // ...
  supportedModifiers: [
    // ... modificadores existentes ...
    'meu_modificador',
  ],
}
```

Se um motor (como o Remux direto `src/modules/remux.ts`) NÃO declarar o seu modificador no array `supportedModifiers`, o orquestrador automaticamente saberá que ele é incompatível, exibirá o alerta em vermelho na UI e desabilitará o botão de conversão incorreta.

---

## Passo 6: Consumir no Módulo de Execução

Nos módulos de conversão (ex: `src/modules/ffmpeg-mt.ts`, `src/modules/ffmpeg.ts`):
```typescript
const modifiers = (inputs.modifiers as ConversionModifiers) || undefined;
if (modifiers?.meuModificadorValor) {
  // Injetar flags do FFmpeg
  args.push('-minha-flag', modifiers.meuModificadorValor);
}
```

---

## Passo 7: Testes Automatizados

1. **Testes Unitários:** Verifique no `mediaProbe.test.ts` ou módulo correspondente.
2. **Testes E2E:** Adicione um caso de teste em `e2e/test-modifiers.spec.ts` testando a adição via botão `Adicionar Modificador`, interação com os controles e a conversão final.

---

## Passo 8: Princípio de Sintonia e Preservação de Opções (Mandatório)

Ao adicionar ou modificar modificadores que interajam com codecs ou formatos restritos (por exemplo: contêiner 3GP e codec H.263, que suportam estritamente resoluções padronizadas CIF, QCIF e sub-QCIF):

1. **Nunca silenciosamente sobreponha ou remova a escolha do usuário:** O motor de execução **nunca** deve trocar um codec escolhido explicitamente pelo usuário por outro apenas para contornar uma restrição.
2. **Sintonia Dinâmica na UI:** O card do modificador dependente (ex: `ResolutionCard`) deve receber as propriedades contextuais (`targetFormat`, `videoCodec`) e ajustar suas opções de forma inteligente:
   - Oferecer presets estritamente compatíveis com o padrão técnico escolhido (ex: CIF 352x288, QCIF 176x144, sub-QCIF 128x96 para H.263).
   - Ocultar entradas inválidas (ex: dimensões arbitrárias que causariam aborto no encoder).
   - Exibir nota explicativa orientando o usuário de que selecionar outro codec (ex: MPEG-4) desbloqueia resoluções maiores (HD 720p/1080p).
3. **Priorize Expandir Opções, Jamais Remover:** O princípio central do FileTools é prover a maior gama possível de configurações aos usuários avançados, garantindo que todas as combinações funcionem em perfeita harmonia.
