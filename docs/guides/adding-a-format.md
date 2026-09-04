# Guia: Como Adicionar um Novo Formato ao Catálogo

**Status:** Normativo / Obrigatório  
**Última Atualização:** 2026-09-03  
**Pré-requisitos:** Leitura de [`docs/ARCHITECTURE.MD`](../ARCHITECTURE.MD)

---

## Visão Geral

O FileTools mantém duas listas paralelas que devem estar **sincronizadas**:

1. **`FORMATS`** — Lista de formatos conhecidos (extensão, label, categoria). Usado para inferência de MIME e para a UI do catálogo.
2. **`CONVERTERS`** — Lista de pares from→to com rotas SSG. Cada entrada gera uma rota estática `/converter/[from]-para-[to]`.

Ambas residem em [`src/lib/formats.ts`](../../src/lib/formats.ts).

### Relação com o Module Registry

O `CONVERTERS` é a **representação UI** das conversões. A **autoridade real** sobre o que é suportado em runtime vem dos `ModuleManifest.supportedConversions` no registry. As duas fontes devem estar alinhadas:

```
ModuleManifest.supportedConversions  →  Define capacidade real do motor
CONVERTERS (formats.ts)              →  Define rotas SSG e catálogo UI
```

Se um par existe no `CONVERTERS` mas nenhum módulo o suporta em `supportedConversions`, a rota será gerada mas a conversão falhará em runtime.

### Arquivos Envolvidos

| # | Arquivo | Ação |
|---|---|---|
| 1 | `src/lib/formats.ts` | **MODIFICAR** — Adicionar formato em `FORMATS` e/ou converter em `CONVERTERS` |
| 2 | `src/modules/<modulo>.ts` | **VERIFICAR** — Confirmar que o módulo suporta o par no `supportedConversions` |
| 3 | `src/modules/registry.test.ts` | **MODIFICAR** — Adicionar teste de resolução |

---

## Cenário 1: Adicionar um Formato Novo (extensão desconhecida)

Quando o FileTools não conhece a extensão (ex: `.avif`, `.flac` etc.).

### 1.1. Adicionar em `FORMATS`

```typescript
export const FORMATS: Format[] = [
  // ... formatos existentes ...

  // Adicionar na seção da categoria correta, em ordem alfabética
  { ext: 'NOVO', label: 'Descrição curta em inglês', category: 'video' },
];
```

#### Regras do `FORMATS`

| Campo | Regra |
|---|---|
| `ext` | MAIÚSCULAS, sem ponto (ex: `'MP4'`, `'WEBM'`) |
| `label` | Inglês, curto, descritivo (ex: `'Animated image'`, `'Lossless audio'`) |
| `category` | Um de: `'video'`, `'audio'`, `'image'`, `'document'`, `'archive'`, `'other'` |

### 1.2. Atualizar `categoryOfExtension`

Se o novo formato não é detectado automaticamente pela função `categoryOfExtension`, adicione-o ao array da categoria correspondente:

```typescript
export function categoryOfExtension(ext: string): Category {
  const e = ext.toLowerCase();
  if (['mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v', 'novo'].includes(e)) return 'video';
  // ...
}
```

---

## Cenário 2: Adicionar um Novo Par de Conversão (from→to)

Quando um módulo já suporta a conversão mas ela ainda não está no catálogo.

### 2.1. Adicionar em `CONVERTERS`

```typescript
export const CONVERTERS: Converter[] = [
  // ... conversões existentes ...

  // Adicionar na seção do módulo correspondente
  // A função conv() cria o objeto com slug automático em PT-BR
  conv('NOVO', 'MP4', 'video', 'Convert NOVO video to MP4'),
  conv('MP4', 'NOVO', 'video', 'Convert MP4 video to NOVO'),
];
```

#### A função `conv(from, to, category, description)`

| Parâmetro | Tipo | Regra |
|---|---|---|
| `from` | `string` | MAIÚSCULAS, sem ponto (ex: `'MKV'`) |
| `to` | `string` | MAIÚSCULAS, sem ponto (ex: `'MP4'`) |
| `category` | `Category` | Mesma categoria do formato fonte |
| `description` | `string` | Inglês, formato: `'Convert X to Y'` ou `'Extract X from Y'` |

#### Regras do `CONVERTERS`

| Regra | Detalhe |
|---|---|
| **Slug automático** | A função `conv()` gera o slug `{from.lower()}-para-{to.lower()}` (PT-BR: "para" = "to"). |
| **Agrupamento** | Manter conversões agrupadas por módulo responsável (comentários `// --- FFmpeg ---`, `// --- Magick ---`). |
| **Sem duplicatas** | Cada par from→to deve aparecer **exatamente uma vez**. Múltiplos motores para o mesmo par são gerenciados pelo engine selector, não por duplicação no catálogo. |
| **Bidirecionalidade** | Adicionar ambas direções separadamente se o módulo suporta (ex: `MKV→MP4` E `MP4→MKV`). |

### 2.2. Verificar Suporte no Módulo

Confirmar que pelo menos um módulo no registry tem o par no `supportedConversions`:

```typescript
// No módulo correspondente, verificar:
supportedConversions: [
  {
    from: ['.novo'],  // ou 'video/*' se usar wildcard
    to: ['.mp4'],
    // ... speedScore, acceleration, etc.
  },
],
```

Se nenhum módulo suporta o par, criar o módulo primeiro seguindo [`docs/guides/adding-a-module.md`](./adding-a-module.md).

---

## Cenário 3: Adicionar Suporte MIME para Inferência

Quando um arquivo com extensão conhecida mas MIME desconhecido (ex: `.mkv` no Windows reporta `''`) precisa ser inferido.

O registry já resolve isso automaticamente através de `getEffectiveMime()` em [`src/modules/registry.ts`](../../src/modules/registry.ts):

```typescript
export function getEffectiveMime(extWithDot: string, mime?: string): string {
  // Se o browser reporta MIME vazio ou genérico, infere via FORMATS
  const cleanExt = extWithDot.replace('.', '').toUpperCase();
  const found = FORMATS.find(f => f.ext === cleanExt);
  if (found) {
    return `${found.category}/*`;  // ex: 'video/*' para MKV
  }
  return '';
}
```

**Portanto:** Adicionar o formato em `FORMATS` com a `category` correta é suficiente para que a inferência funcione automaticamente. Não é necessário nenhum código adicional.

---

## Passo Final: Testes e Validação

### Teste Unitário

Adicionar teste em [`src/modules/registry.test.ts`](../../src/modules/registry.test.ts):

```typescript
it('resolves conversions for NOVO format', () => {
  const results = resolvePossibleConversions('NOVO', 'tipo/mime');
  expect(results.length).toBeGreaterThan(0);
  // Verificar que pelo menos um módulo suporta
});
```

### Validação de Rotas SSG

Executar `npm run build` e verificar que:
- A pasta `dist/converter/novo-para-mp4/` foi gerada
- A página HTML contém o converter funcional

### Checklist de Validação

- [ ] Formato adicionado em `FORMATS` (se novo)
- [ ] `categoryOfExtension` detecta a extensão corretamente
- [ ] Par(es) from→to adicionado(s) em `CONVERTERS`
- [ ] Pelo menos um módulo no registry suporta o par em `supportedConversions`
- [ ] Slugs gerados em PT-BR (formato: `{from}-para-{to}`)
- [ ] Sem duplicatas em `CONVERTERS`
- [ ] Teste unitário adicionado e passando
- [ ] `npm run build` gera as rotas SSG sem erros
- [ ] TypeScript compila sem erros (`npx tsc --noEmit`)

---

## Diagrama: Fluxo de Resolução de Formatos

```
[Usuário seleciona arquivo]
        ↓
[file.name → extensão]  +  [file.type → MIME]
        ↓
[getEffectiveMime(ext, mime)]
        ↓ (cruza com FORMATS para inferir MIME se vazio)
[resolvePossibleConversions(ext, mime)]
        ↓ (varre ModuleRegistry.supportedConversions)
[Lista de PossibleConversion[]]
        ↓ (filtra extensões de destino únicas)
[FormatSelector exibe opções ao usuário]
        ↓
[Usuário escolhe formato destino]
        ↓
[resolveAvailableEngines(source, target, mime)]
        ↓ (filtra por isSupported, ordena por speedScore)
[EngineSelector exibe motores compatíveis]
```