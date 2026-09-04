# Guia: Como Adicionar uma Nova Opção ao Config Stack

**Status:** Normativo / Obrigatório  
**Última Atualização:** 2026-09-03  
**Pré-requisitos:** Leitura de [`docs/guides/adding-a-module.md`](./adding-a-module.md) e [`docs/ARCHITECTURE.MD`](../ARCHITECTURE.MD)

---

## Visão Geral

O sistema de **Config Stack** (Pilha de Configurações) permite ao usuário adicionar, remover e configurar opções avançadas de conversão de forma modular. Cada opção é uma **categoria** que pode ser adicionada à pilha sob demanda e que aparece como um card expansível na UI.

### Arquitetura do Config Stack

```
ConvertPanel.tsx                    → Estado: ConversionOptions (conversionOptions state)
  └─ ConversionOptionsPanel.tsx     → Orquestra a pilha de cards + picker de adição
       ├─ CategoryDefinitions.ts    → Catálogo de categorias disponíveis (metadata)
       ├─ AddCategoryPicker.tsx     → Modal de busca/adição de categorias
       ├─ AudioTracksCard.tsx       → Card específico: seleção de faixas de áudio
       ├─ SubtitlesCard.tsx         → Card específico: seleção de legendas
       ├─ FpsCard.tsx               → Card específico: taxa de quadros
       ├─ ResolutionCard.tsx        → Card específico: resolução/escala
       └─ (inline no Panel)        → Cards de Threads, Qualidade, Codec (renderizados inline)
```

### Fluxo de Dados

```
[1] conversionOptions.ts  →  Define o tipo ConfigCategoryId e campos no ConversionOptions
                ↓
[2] CategoryDefinitions.ts  →  Registra metadata (título, ícone, regras de aplicabilidade)
                ↓
[3] Card Component (.tsx)  →  UI do card (controles, callbacks onChange)
                ↓
[4] ConversionOptionsPanel.tsx  →  Monta pilha, conecta card ao estado, gerencia add/remove
                ↓
[5] Módulo (ex: ffmpeg-mt.ts)  →  Lê `options` e aplica na conversão real
```

### Arquivos Envolvidos (em ordem de modificação)

| # | Arquivo | Ação |
|---|---|---|
| 1 | `src/shared/types/conversionOptions.ts` | **MODIFICAR** — Adicionar ID à union `ConfigCategoryId` + campos ao `ConversionOptions` |
| 2 | `src/ui/components/options/CategoryDefinitions.ts` | **MODIFICAR** — Adicionar metadata da categoria |
| 3 | `src/ui/components/options/<NomeDaOpcao>Card.tsx` | **CRIAR** — Componente React do card |
| 4 | `src/ui/components/ConversionOptionsPanel.tsx` | **MODIFICAR** — Importar card + renderizar + gerenciar reset |
| 5 | `src/modules/<modulo>.ts` | **MODIFICAR** — Consumir a nova opção na lógica de conversão |

---

## Passo 1: Definir os Tipos

Edite [`src/shared/types/conversionOptions.ts`](../../src/shared/types/conversionOptions.ts).

### 1.1. Adicionar ID à Union `ConfigCategoryId`

```typescript
export type ConfigCategoryId =
  | 'fps'
  | 'resolution'
  | 'audio_tracks'
  | 'subtitles'
  | 'threads'
  | 'quality'
  | 'video_codec'
  | 'minha_opcao';     // ← NOVO: adicionar aqui em ordem alfabética
```

#### Regras do `ConfigCategoryId`

| Regra | Detalhe |
|---|---|
| **snake_case** | IDs sempre em snake_case (ex: `audio_tracks`, `video_codec`). |
| **Único e descritivo** | O ID deve ser autoexplicativo. Evite abreviações obscuras. |
| **Imutável** | Uma vez publicado, o ID NUNCA pode ser renomeado. |

### 1.2. Adicionar Campos ao `ConversionOptions`

Adicione os campos que representam o estado desta opção na interface `ConversionOptions`:

```typescript
export interface ConversionOptions {
  // ... campos existentes ...

  // Minha Opção (descrição clara do propósito)
  minhaOpcaoValor?: string;          // O valor principal configurado
  minhaOpcaoCustom?: number;         // Valor personalizado (quando aplicável)
  isCustomMinhaOpcao?: boolean;      // Flag para modo customizado
}
```

### 1.3. Definir Defaults no `DEFAULT_CONVERSION_OPTIONS`

```typescript
export const DEFAULT_CONVERSION_OPTIONS: ConversionOptions = {
  // ... defaults existentes ...
  minhaOpcaoValor: 'auto',   // O default deve preservar o comportamento original
};
```

#### Regras dos Defaults

| Regra | Detalhe |
|---|---|
| **Fidelidade máxima** | O default DEVE resultar em saída idêntica ao comportamento sem nenhuma opção ativada. O usuário que não toca em opções avançadas NUNCA deve ter sua conversão alterada. |
| **Sem dados mockados** | Defaults devem ser valores estáticos válidos, NUNCA dados fabricados de streams ou metadata de arquivo. |

---

## Passo 2: Registrar Metadata da Categoria

Edite [`src/ui/components/options/CategoryDefinitions.ts`](../../src/ui/components/options/CategoryDefinitions.ts).

### 2.2. Princípio da Inicialização com Metadados Nativos Reais (Zero Valores Arbitrários)

> [!CRITICAL]
> **PROIBIÇÃO DE VALORES INICIAIS ARBITRÁRIOS EM CONVERSÕES:**
> NUNCA inicialize um card com valores arbitrários (por exemplo, 12 fps em um vídeo quando 12 é específico de GIF).

Ao fazer upload de um arquivo, o container probe (`src/core/media/mediaProbe.ts`) extrai imediatamente do cabeçalho binário nativo:
- **Taxa de quadros real (`fps`)**: Calculado via EBML `DefaultDuration` (`0x23 0xE3 0x83`) no Matroska/WebM ou `mdhd/stts` no MP4.
- **Dimensões reais (`width`, `height`)**: Extraído de `PixelWidth`/`PixelHeight` ou `tkhd`.
- **Faixas de áudio e legendas reais**: Títulos, codecs e contagem sem simulação.

**Regras de Inicialização:**
1. **Taxa de Quadros (`fps`)**:
   - Em conversões para **Vídeo**: Deve inicializar no preset `Original (X fps)` ou no FPS nativo detectado (ex: 30 fps para arquivos de 30 fps). NUNCA exibir 12 fps em rotas de vídeo.
   - Em conversões para **GIF**: Inicializar no preset padrão de GIF (12 fps), permitindo ao usuário escolher outros presets ou nativo.
2. **Resolução e Escala (`resolution`)**:
   - Inicializar sempre com `Original` (`100% nativo do arquivo`), indicando na interface as dimensões nativas extraídas (ex: `Original (1920x1080)`).
3. **Qualidade (`quality`)**:
   - Inicializar em `Original` (CRF 18 / Fidelidade máxima).

---

### 2.3. Contrato de Compatibilidade entre Motores e Opções (Transcoder vs. Stream-Copy)

O FileTools possui motores com arquiteturas distintas:
1. **Remux Direto / Stream Copy (`stream-copy`)**:
   - Opera via `-c copy` em velocidade quase instantânea (< 1s) sem perdas de qualidade.
   - **Incompatibilidade Inerente**: NÃO processa nem re-encodifica frames. Portanto, é **estruturalmente incompatível** com:
     - `fps` (Taxa de Quadros)
     - `resolution` (Resolução e Escala)
     - `quality` (Qualidade e Compressão / CRF)
     - `video_codec` (Alteração de Codec de Vídeo)
     - `audio_codec` (Alteração de Codec de Áudio)
     - `audio_merge` (União de Faixas com filtro `amix`)
     - `video_duration` (Geração de vídeo a partir de imagem)
2. **Motores de Transcodificação (`ffmpeg-core-mt`, `ffmpeg-core`)**:
   - Compatíveis com 100% de todas as opções e filtros de processamento de mídia.

#### Regras de Interface e Bloqueio (UX Protection)
- **No Seletor de Opções (`AddCategoryPicker`)**:
  - Opções incompatíveis com o motor selecionado devem exibir a tag: `Requer Transcodificador`.
- **No Painel de Configurações (`ConversionOptionsPanel`)**:
  - Se uma opção incompatível estiver ativa enquanto o motor Remux estiver selecionado, um banner de alerta âmbar DEVE ser exibido explicando a incompatibilidade e oferecendo um botão de 1 clique: `[Alternar para FFmpeg Multi-Thread]`.
- **No Botão de Conversão Principal (`ConvertPanel`)**:
  - O botão de conversão DEVE ser DESABILITADO quando houver opções incompatíveis ativas (`disabled={isIncompatible}`), exibindo: `Motor incompatível com opções selecionadas`. É expressamente proibido permitir que o usuário realize uma conversão na qual suas opções seriam ignoradas silenciosamente.

---

### 2.1. Matriz Universal de Aplicabilidade e Regras por Tipo de Mídia

> [!CRITICAL]
> **PROIBIÇÃO DE LISTAS HARDCODED DE FORMATOS:**
> NUNCA use listas estáticas como `['mp4', 'mkv', 'webm'].includes(target)` na função `isApplicable`.
> Fazer isso quebra formatos como `mpeg`, `mpg`, `vob`, `flv`, `wmv`, `ts`, etc.
> As opções devem ser habilitadas com base nas **Capacidades de Mídia** (`categoryOfExtension(sourceExt)` e `categoryOfExtension(target)`).

A assinatura do contrato `isApplicable` e `isPinned` é:
```typescript
isApplicable: (target: string, isMT: boolean, sourceExt?: string) => boolean;
isPinned?: (target: string, sourceExt?: string) => boolean;
```

#### Tabela Canônica de Aplicabilidade

| Categoria | ID | Regra de Aplicabilidade (`isApplicable`) | Fixada (`isPinned`) | Notas Semânticas |
|---|---|---|---|---|
| **Duração do Vídeo** | `video_duration` | `srcCat === 'image' && tgtCat === 'video'` | Sim, para imagem $\to$ vídeo | **PROIBIDO** em imagem $\to$ imagem (ex: PNG $\to$ JPG) ou imagem $\to$ GIF. Apenas para gerar vídeo a partir de imagem. |
| **Resolução e Escala** | `resolution` | `tgtCat === 'video' \|\| target === 'gif'` | Sim, para GIF | Suportado por **TODOS** os formatos de vídeo (MP4, MKV, WebM, MPEG, AVI, MOV, etc.) e animação GIF. |
| **Taxa de Quadros (FPS)** | `fps` | `tgtCat === 'video' \|\| target === 'gif'` | Sim, para GIF | Suportado por **TODOS** os formatos de vídeo e animação GIF. |
| **Qualidade e Compressão** | `quality` | `tgtCat === 'video'` | Não | Controle de CRF/Preset para qualquer vídeo codificado. |
| **Codec de Vídeo** | `video_codec` | `tgtCat === 'video'` | Não | Seleção de encoder (H.264, HEVC, VP8, VP9, etc.). O painel filtra dinamicamente os codecs suportados pelo contêiner de destino. |
| **Faixas de Áudio** | `audio_tracks` | `(srcCat === 'video' \|\| srcCat === 'audio') && tgtCat === 'video' && target !== 'gif'` | Não | Seleção de faixas independentes no contêiner de vídeo. **Mutuamente exclusivo** com `audio_merge`. |
| **Juntar Faixas de Áudio** | `audio_merge` | `srcCat === 'video' && (tgtCat === 'audio' \|\| (tgtCat === 'video' && target !== 'gif'))` | Não | Mixagem das trilhas via filtro `amix`. Disponível para Vídeo $\to$ Áudio E Vídeo $\to$ Vídeo (ex: juntar mic + jogo do OBS). |
| **Faixas de Legenda** | `subtitles` | `srcCat === 'video' && ['mp4', 'mkv', 'webm', 'mov', 'ts'].includes(target)` | Não | Gerenciamento de legendas embutidas em contêineres compatíveis. |
| **Codec de Áudio** | `audio_codec` | `srcCat !== 'image' && (tgtCat === 'video' \|\| tgtCat === 'audio')` | Não | Seleção de codec de áudio (MP3, AAC, Opus, Vorbis, FLAC, etc.). Ocultado quando a entrada não possui áudio. |
| **Threads da CPU** | `threads` | `(_target, isMT) => isMT` | Não | Alocação de núcleos de processamento para motores multi-thread. |

### 2.2. Regras de Exclusão Mútua e Higienização Automática

1. **Exclusão Mútua (`audio_tracks` vs `audio_merge`):**
   - Um contêiner de vídeo não pode simultaneamente tentar manter faixas separadas independentes E mixá-las em um único canal de áudio.
   - Adicionar `audio_merge` remove automaticamente `audio_tracks`, e vice-versa. O picker oculta a opção oposta.
2. **Higienização Automática (*Auto-Pruning*):**
   - Ao trocar de rota ou enviar um novo arquivo com tipo de mídia diferente, o `ConversionOptionsPanel` filtra e remove imediatamente qualquer categoria ativa que não seja aplicável à nova conversão, garantindo zero persistência de cards fantasmas.

### 2.3. Exemplo de Registro de Categoria

```typescript
import { MinhaOpcaoIcon } from 'lucide-react';
import { categoryOfExtension } from '@/lib/formats';

export const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  // ... categorias existentes ...
  {
    id: 'minha_opcao',
    title: 'Minha Opção',
    description: 'Breve descrição em português do Brasil.',
    icon: MinhaOpcaoIcon,
    isApplicable: (target, isMT, sourceExt) => {
      const srcCat = categoryOfExtension(sourceExt || '');
      const tgtCat = categoryOfExtension(target);
      return tgtCat === 'video';
    },
  },
];
```

### Interface `CategoryDefinition`

```typescript
interface CategoryDefinition {
  id: ConfigCategoryId;                              // ID único (= ConfigCategoryId)
  title: string;                                      // Título PT-BR
  description: string;                                // Descrição PT-BR
  icon: React.ElementType;                            // Ícone lucide-react
  isApplicable: (target: string, isMT: boolean) => boolean;  // Visibilidade
  isPinned?: (target: string) => boolean;             // Auto-adicionar (sem remoção)
}
```

#### Regras do `CategoryDefinitions`

| Regra | Detalhe |
|---|---|
| **`isApplicable` preciso** | Retornar `true` SOMENTE para formatos onde a opção faz sentido. Não poluir o picker com opções irrelevantes. Ex: `audio_tracks` retorna `false` para `gif`. |
| **`isPinned` restrito** | Usar APENAS para opções indispensáveis de um formato. Opções pinadas não podem ser removidas pelo usuário. |
| **Ícones do lucide-react** | Usar SOMENTE ícones do pacote `lucide-react` já instalado. Não adicionar dependências de ícones. |
| **Ordem no array** | Manter agrupamento lógico: opções mais usadas primeiro. A ordem afeta a exibição no picker de adição. |

---

## Passo 3: Criar o Componente Card

Crie o arquivo `src/ui/components/options/<NomeDaOpcao>Card.tsx`.

### 3.1. Interface de Props

Toda card segue o mesmo padrão de props:

```typescript
import React from 'react';
import { Typography } from '@/ui/components/core';
import { cn } from '@/lib/utils';
import type { ConversionOptions } from '@/shared/types/conversionOptions';

export interface MinhaOpcaoCardProps {
  options: ConversionOptions;
  onChange: (updated: Partial<ConversionOptions>) => void;
  // Props adicionais específicas (ex: probedMedia para cards que dependem de probing)
}
```

### 3.2. Dois Padrões de Card

#### Padrão A: Card com Presets + Custom (ex: FPS, Resolução, Qualidade)

Para opções onde o usuário escolhe entre valores predefinidos ou digita um personalizado:

```typescript
export function MinhaOpcaoCard({ options, onChange }: MinhaOpcaoCardProps) {
  const isCustom = Boolean(options.isCustomMinhaOpcao);

  return (
    <div className="space-y-2 pt-0.5">
      {/* Cabeçalho com indicador do valor atual */}
      <div className="flex items-center justify-between">
        <Typography variant="caption" color="muted">
          Descrição do que está sendo configurado:
        </Typography>
        <span className="text-[11px] font-mono text-primary font-medium">
          {/* Valor atual formatado */}
        </span>
      </div>

      {/* Grid de presets */}
      <div className="grid grid-cols-4 gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onChange({ /* campos do preset */ })}
            className={cn(
              'p-2 text-left rounded-md border transition-colors select-none',
              isSelected
                ? 'border-primary bg-primary/10 text-foreground font-medium'
                : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground'
            )}
          >
            <div className="text-[11px] font-medium text-foreground">{preset.label}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{preset.desc}</div>
          </button>
        ))}
      </div>

      {/* Input customizado (condicional) */}
      {isCustom && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[11px] text-muted-foreground">Label:</span>
          <input
            type="number"
            min={MIN}
            max={MAX}
            value={options.minhaOpcaoCustom || DEFAULT}
            onChange={(e) => {
              const val = Math.max(MIN, Math.min(MAX, parseInt(e.target.value, 10) || MIN));
              onChange({ minhaOpcaoCustom: val, isCustomMinhaOpcao: true });
            }}
            className="w-20 rounded border border-primary bg-surface-raised px-2 py-0.5 text-xs text-foreground focus:outline-none"
          />
          <span className="text-[11px] text-muted-foreground font-mono">unidade (min a max)</span>
        </div>
      )}
    </div>
  );
}
```

#### Padrão B: Card com Multi-Select de Streams (ex: Áudio, Legendas)

Para opções que dependem de streams reais detectados no arquivo de entrada:

```typescript
export function MinhaOpcaoCard({ selectedTracks, onChange, probedMedia }: MinhaOpcaoCardProps) {
  // 1. LOADING STATE: Enquanto probing não completou
  if (!probedMedia) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-md border border-border bg-surface-raised/40 text-[11px] text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin text-primary shrink-0" />
        <span>Inspecionando faixas do contêiner...</span>
      </div>
    );
  }

  // 2. EMPTY STATE: Nenhum stream encontrado
  const streams = probedMedia.meuTipoDeStreams;
  if (streams.length === 0) {
    return (
      <div className="p-3 rounded-md border border-border bg-surface-raised/40 space-y-1.5 text-center">
        <Info className="size-4 text-primary" />
        <Typography variant="body" className="font-medium text-xs">Nenhuma faixa encontrada</Typography>
        <Typography variant="caption" color="muted">Este arquivo não possui este tipo de stream.</Typography>
      </div>
    );
  }

  // 3. MULTI-SELECT LIST: Vertical stack com checkboxes
  return (
    <div className="space-y-2.5">
      {/* Controls: Selecionar Todas / Desmarcar Todas */}
      {/* Lista vertical de streams reais */}
      {/* Aviso quando nenhum selecionado */}
    </div>
  );
}
```

#### Regras dos Cards

| Regra | Detalhe |
|---|---|
| **NUNCA dados mockados** | Cards que dependem de streams (áudio, legendas) DEVEM exibir loading state enquanto `probedMedia` é `undefined`, e mostrar dados REAIS quando disponível. |
| **Usar componentes core** | Importar `Typography`, `Badge`, `Card`, `Button` de `@/ui/components/core`. NÃO criar estilos inline ad-hoc. |
| **Classes Tailwind padrão** | Seguir o design system: `text-[11px]`, `text-[10px]`, `border-primary`, `bg-primary/10`, `bg-surface-raised`, etc. |
| **Responsividade** | Grids devem usar `grid-cols-N sm:grid-cols-M` para adaptação mobile. |
| **onChange parcial** | Sempre chamar `onChange` com `Partial<ConversionOptions>`, nunca com o objeto completo. O `ConversionOptionsPanel` faz o merge. |

---

## Passo 4: Integrar no ConversionOptionsPanel

Edite [`src/ui/components/ConversionOptionsPanel.tsx`](../../src/ui/components/ConversionOptionsPanel.tsx).

### 4.1. Importar o Card

```typescript
import { MinhaOpcaoCard } from './options/MinhaOpcaoCard';
```

### 4.2. Renderizar o Card na Pilha

Dentro do loop que renderiza cards ativos, adicionar o case para o novo `catId`:

```typescript
{/* CARD: MINHA OPÇÃO */}
{catId === 'minha_opcao' && (
  <MinhaOpcaoCard
    options={options}
    onChange={update}
    // Outras props específicas se necessário (ex: probedMedia)
  />
)}
```

### 4.3. Gerenciar Reset ao Remover

Na função `removeCategory`, adicionar o case de limpeza para quando o usuário remove o card:

```typescript
function removeCategory(catId: ConfigCategoryId) {
  const nextCategories = options.activeCategories.filter((id) => id !== catId);

  if (catId === 'minha_opcao') {
    update({
      activeCategories: nextCategories,
      // Restaurar TODOS os campos desta opção para seus defaults
      minhaOpcaoValor: 'auto',
      minhaOpcaoCustom: undefined,
      isCustomMinhaOpcao: false,
    });
    return;
  }
  // ... demais cases ...
}
```

#### Regra Crítica: Reset Completo

Ao remover uma categoria, **TODOS** os campos relacionados devem ser restaurados aos valores de `DEFAULT_CONVERSION_OPTIONS`. Se um campo ficar com valor residual após remoção, a conversão seguinte pode usar configurações não intencionais.

---

## Passo 5: Consumir a Opção no Módulo

Edite o módulo que utiliza esta opção (ex: [`src/modules/ffmpeg-mt.ts`](../../src/modules/ffmpeg-mt.ts)).

### 5.1. Verificar se a Categoria Está Ativa

```typescript
const isMinhaOpcaoAtiva = options?.activeCategories?.includes('minha_opcao');

if (isMinhaOpcaoAtiva) {
  // Aplicar configuração personalizada do usuário
  const valor = options?.minhaOpcaoValor || 'auto';
  context.onLog(`[FFmpeg MT] Minha opção configurada: ${valor}`);
  // ... modificar args de conversão baseado no valor ...
}
```

### 5.2. Padrão "Fidelidade Original quando Inativo"

Quando a categoria **NÃO** está em `activeCategories`, o módulo DEVE se comportar **identicamente** ao comportamento sem nenhuma opção — preservando qualidade e atributos originais ao máximo.

```typescript
// CORRETO: Verificar se a categoria está ativa ANTES de ler valores
if (options?.activeCategories?.includes('audio_tracks')) {
  // Filtrar faixas selecionadas
  const mapFlags = options.selectedAudioTracks.map(idx => ['-map', `0:a:${idx}`]).flat();
}

// ERRADO: Ler valores sem verificar se a categoria está ativa
// const tracks = options?.selectedAudioTracks; // ← Pode ter valor residual
```

---

## Passo 6: Checklist de Validação Final

- [ ] `ConfigCategoryId` atualizado com o novo ID (snake_case, único)
- [ ] `ConversionOptions` contém todos os campos da nova opção
- [ ] `DEFAULT_CONVERSION_OPTIONS` define defaults que preservam comportamento original
- [ ] `CategoryDefinitions.ts` registra metadata com `isApplicable` preciso
- [ ] Card component criado em `src/ui/components/options/`
- [ ] Card usa componentes core (`Typography`, `Badge`, etc.) — sem estilos inline
- [ ] Card com loading state para dados assíncronos (se aplicável)
- [ ] Card com empty state para quando não há dados (se aplicável)
- [ ] Card chama `onChange` com `Partial<ConversionOptions>` (nunca objeto completo)
- [ ] `ConversionOptionsPanel` importa e renderiza o card no loop da pilha
- [ ] `removeCategory` restaura TODOS os campos da opção aos defaults
- [ ] Módulo(s) verificam `activeCategories.includes('id')` antes de ler valores
- [ ] Sem dados mockados em nenhum lugar da cadeia
- [ ] TypeScript compila sem erros (`npx tsc --noEmit`)

---

## Exemplos de Referência

| Opção | Card | Padrão | Destaque |
|---|---|---|---|
| FPS | [`FpsCard.tsx`](../../src/ui/components/options/FpsCard.tsx) | Presets + Custom | Grid de botões + input numérico |
| Resolução | [`ResolutionCard.tsx`](../../src/ui/components/options/ResolutionCard.tsx) | Presets + Custom | Presets diferentes para GIF vs vídeo |
| Faixas de Áudio | [`AudioTracksCard.tsx`](../../src/ui/components/options/AudioTracksCard.tsx) | Multi-Select de Streams | Loading/empty/real states, probed data |
| Legendas | [`SubtitlesCard.tsx`](../../src/ui/components/options/SubtitlesCard.tsx) | Multi-Select de Streams | Idêntico ao áudio, para subtitles |
| Threads | Inline no Panel | Presets + Custom | Usa `navigator.hardwareConcurrency` |
| Qualidade | Inline no Panel | Presets + Custom | CRF slider com presets nomeados |
| Codec | Inline no Panel | Seleção única | Sem modo custom |

---

## Decisão de Design: Card Dedicado vs Inline

| Situação | Decisão |
|---|---|
| Opção com lógica complexa, loading states, ou multi-select | **Card dedicado** em `options/` |
| Opção simples com 2-5 botões de preset | **Inline** no `ConversionOptionsPanel.tsx` |
| Opção que depende de `probedMedia` | **Card dedicado** obrigatoriamente |

### Quando Promover Inline → Card Dedicado

Se uma opção inline crescer para mais de ~40 linhas de JSX no Panel, extraí-la para um card dedicado em `options/` para manter o Panel legível.