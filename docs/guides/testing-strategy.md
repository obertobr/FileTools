# Guia: Estratégia de Testes do FileTools

**Status:** Normativo / Obrigatório  
**Última Atualização:** 2026-09-03  
**Ferramentas:** Vitest (unitários), Playwright (E2E), scripts de módulo (`test:modules`)

---

## Visão Geral

O FileTools utiliza **três camadas de teste** complementares, cada uma com escopo e objetivo distintos:

```
┌─────────────────────────────────────────────────────┐
│  Camada 3: E2E (Playwright)                         │
│  → Fluxo completo no browser real                   │
│  → Upload → Conversão → Download                    │
│  → Verifica que opções são renderizadas e funcionam  │
├─────────────────────────────────────────────────────┤
│  Camada 2: Testes de Módulo (scripts/test-module.js)│
│  → Executa módulo isolado com arquivo real           │
│  → Valida que a conversão produz output válido       │
│  → Detecta problemas de WASM/threads/codecs          │
├─────────────────────────────────────────────────────┤
│  Camada 1: Unitários (Vitest)                       │
│  → Registry: resolução de motores e formatos         │
│  → OPFS: limpeza de sessões                          │
│  → Tipos: contratos de dados e cruzamento de regras  │
└─────────────────────────────────────────────────────┘
```

### Comandos de Teste

| Comando | Escopo | Quando Usar |
|---|---|---|
| `npm run test` | Vitest: todos os unitários em `src/` | Sempre. Antes de qualquer commit. |
| `npm run test:modules` | Scripts: executa todos os módulos | Após alterar lógica de conversão |
| `npm run test:module <id>` | Scripts: executa módulo específico | Debug de um módulo individual |
| `npm run test:e2e` | Playwright: todos os E2E em `e2e/` | Antes de release. Após mudanças na UI. |
| `npx tsc --noEmit` | TypeScript: verificação de tipos | Sempre. Antes de qualquer commit. |

---

## Camada 1: Testes Unitários (Vitest)

### Localização e Nomenclatura

| Padrão | Localização |
|---|---|
| Testes de módulos/registry | `src/modules/registry.test.ts` |
| Testes de OPFS | `src/core/fs/OPFSManager.test.ts` |
| Qualquer novo teste unitário | `src/<caminho>/<nome>.test.ts` (co-localizado) |

### Configuração

Arquivo: [`vitest.config.ts`](../../vitest.config.ts)

```typescript
{
  test: {
    environment: 'jsdom',  // DOM para testes de OPFS e componentes
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
}
```

### O que Testar

#### 1.1. Registry — Resolução de Motores (`registry.test.ts`)

**Obrigatório** para cada módulo e par de conversão:

```typescript
describe('Module Registry', () => {
  // TESTE 1: Resolução de extensões (case insensitive)
  it('resolves specific file extensions correctly', () => {
    const results = resolvePossibleConversions('DOCX');
    expect(results.length).toBeGreaterThan(0);
    const mammoth = results.find(r => r.moduleId === 'mammoth');
    expect(mammoth).toBeDefined();
  });

  // TESTE 2: Resolução com MIME type real
  it('resolves wildcards using MIME type', () => {
    const results = resolvePossibleConversions('MP4', 'video/mp4');
    expect(results.length).toBeGreaterThan(0);
  });

  // TESTE 3: Resolução com MIME vazio (fallback por extensão)
  it('resolves even with empty MIME (Windows MKV)', () => {
    const results = resolvePossibleConversions('MKV', '');
    expect(results.length).toBeGreaterThan(0);
  });

  // TESTE 4: Engine ranking por speedScore
  it('ranks engines by speedScore descending', async () => {
    const engines = await resolveAvailableEngines('MP4', 'WEBM', 'video/mp4');
    for (let i = 0; i < engines.length - 1; i++) {
      expect(engines[i].speedScore).toBeGreaterThanOrEqual(engines[i + 1].speedScore);
    }
  });

  // TESTE 5: Motor recomendado é o primeiro
  it('marks first engine as recommended', async () => {
    const engines = await resolveAvailableEngines('MP4', 'WEBM');
    expect(engines[0].isRecommended).toBe(true);
  });

  // TESTE 6: Formato não suportado retorna vazio
  it('returns empty for unsupported formats', async () => {
    const engines = await resolveAvailableEngines('DOCX', 'MP3');
    expect(engines).toHaveLength(0);
  });
});
```

#### Padrão Obrigatório para Novos Módulos

Ao adicionar um módulo, **adicionar PELO MENOS** estes testes:

```typescript
it('resolves NomeDoModulo for .from -> .to', async () => {
  const engines = await resolveAvailableEngines('FROM', 'TO', 'mime/type');
  expect(engines.length).toBeGreaterThanOrEqual(1);
  const engine = engines.find(e => e.moduleId === 'id-do-modulo');
  expect(engine).toBeDefined();
  expect(engine!.speedScore).toBeGreaterThan(0);
});
```

#### 1.2. OPFS — Gestão de Sessões (`OPFSManager.test.ts`)

Testar ciclo de vida de workspace (create, cleanup, quota check). Estes testes já existem e devem ser mantidos.

### O que NÃO Testar

| Não testar | Motivo |
|---|---|
| Marcação HTML/CSS cosmética | Quebra com qualquer refactor visual. Sem valor de negócio. |
| Cores, espaçamentos, tipografia | Responsabilidade do Design System/Tailwind. |
| Funcionamento interno de libs | FFmpeg, ImageMagick, pdf-lib são testados externamente. |
| Renderização de componentes React | Usar E2E (Playwright) para validação visual. |

---

## Camada 2: Testes de Módulo (`scripts/test-module.js`)

### Propósito

Executa o `execute()` de um módulo **isolado** com um arquivo real de teste para verificar que a conversão produz output válido. Detecta problemas de:
- Binários WASM corrompidos ou ausentes
- Incompatibilidade de codecs
- Parsing de progresso quebrado
- Timeouts e travamentos

### Uso

```bash
# Testar todos os módulos
npm run test:modules

# Testar módulo específico
npm run test:module ffmpeg-core-mt
```

### Arquivos de Teste

Arquivos de teste ficam em `tests/fixtures/`. Devem ser:
- **Pequenos** (< 5MB para velocidade)
- **Reais** (nunca gerados com dados aleatórios)
- **Representativos** (conter streams de áudio, vídeo, e legendas quando relevante)

### Quando Adicionar Fixture

Ao criar um módulo novo, adicionar pelo menos um arquivo fixture que exercite o caso principal de conversão.

---

## Camada 3: Testes E2E (Playwright)

### Localização e Nomenclatura

```
e2e/
├── modules/
│   ├── ffmpeg-mt.spec.ts      # Conversão real com FFmpeg MT
│   ├── ffmpeg.spec.ts         # Conversão real com FFmpeg single-thread
│   └── remux.spec.ts          # Conversão real com Remux
├── test-modifiers.spec.ts       # UI do Pilha de Modificadores (renderização e interação)
└── test-user-file.spec.ts     # Fluxo completo de upload → conversão → download
```

### Configuração

Arquivo: [`playwright.config.ts`](../../playwright.config.ts)

### Padrão para Testes E2E de Módulo

```typescript
import { test, expect } from '@playwright/test';

test.describe('NomeDoModulo Conversions', () => {
  test('converts .from to .to successfully', async ({ page }) => {
    // 1. Navegar para a rota da conversão
    await page.goto('/converter/from-para-to');

    // 2. Upload do arquivo fixture
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('tests/fixtures/sample.from');

    // 3. Verificar que o motor correto é selecionado
    await expect(page.locator('[data-engine-id="id-do-modulo"]')).toBeVisible();

    // 4. Iniciar conversão
    await page.click('button:has-text("Converter")');

    // 5. Aguardar conclusão (com timeout adequado para WASM)
    await expect(page.locator('[data-testid="download-result"]')).toBeVisible({
      timeout: 120_000,  // 2 minutos para conversões WASM
    });

    // 6. Verificar que o arquivo de saída foi gerado
    await expect(page.locator('[data-testid="output-filename"]')).toContainText('.to');
  });
});
```

### Padrão para Testes E2E de Opções

```typescript
test.describe('Modifier Stack Modifiers', () => {
  test('renders and interacts with MinhaOpcao card', async ({ page }) => {
    await page.goto('/converter/mp4-para-webm');
    // Upload arquivo
    // ...

    // 1. Abrir picker de adição
    await page.click('button:has-text("Adicionar Modificador")');

    // 2. Buscar e adicionar categoria
    await page.fill('[placeholder*="Buscar"]', 'Minha Opção');
    await page.click('text=Minha Opção');

    // 3. Verificar que o card apareceu
    await expect(page.locator('text=Minha Opção')).toBeVisible();

    // 4. Interagir com controles do card
    // ...

    // 5. Remover e verificar limpeza
    await page.click('[aria-label="Remover Minha Opção"]');
    await expect(page.locator('text=Minha Opção')).not.toBeVisible();
  });
});
```

### Quando Criar Testes E2E

| Mudança | Teste Necessário |
|---|---|
| Novo módulo de conversão | Teste em `e2e/modules/<nome>.spec.ts` |
| Nova opção no Pilha de Modificadores | Teste em `e2e/test-modifiers.spec.ts` |
| Alteração no fluxo de upload/download | Atualizar `e2e/test-user-file.spec.ts` |
| Mudança apenas cosmética/CSS | Nenhum teste E2E necessário |

---

## Regras Globais de Teste

### 1. Proibição de Dados Mockados

```typescript
// ❌ ERRADO: Mock de streams
const mockStreams = [
  { streamIndex: 0, type: 'audio', title: 'Track 1' },
  { streamIndex: 1, type: 'audio', title: 'Track 2' },
];

// ✅ CORRETO: Usar probing real ou fixture
const probed = probeMediaData(fixtureBytes);
expect(probed.audioStreams.length).toBeGreaterThan(0);
```

### 2. Guard de Teste no `isSupported`

Todo módulo que sonda hardware deve retornar `true` em testes:

```typescript
isSupported: () => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test') return true;
  // ... sondagem real ...
},
```

### 3. Timeout Adequado para WASM

Conversões WASM podem demorar. Usar timeouts generosos no Playwright:

```typescript
// Para conversões de vídeo: mínimo 60s, ideal 120s
await expect(locator).toBeVisible({ timeout: 120_000 });
```

### 4. Isolamento de Testes

Cada teste E2E deve ser **independente**: fazer seu próprio upload, selecionar motor, converter. Não depender de estado de testes anteriores.

---

## Pipeline de Validação Obrigatória

Antes de qualquer merge, executar na seguinte ordem:

```bash
# 1. Verificação de tipos
npx tsc --noEmit

# 2. Testes unitários
npm run test

# 3. Testes de módulos (se alterou conversões)
npm run test:modules

# 4. Testes E2E (se alterou UI ou fluxo)
npm run test:e2e
```

Se **qualquer** etapa falhar, o código NÃO deve ser merged/deployed.

---

## Adicionando Cobertura para Novos Componentes

### Quando adicionar um novo módulo:
1. ✅ Teste de resolução no `registry.test.ts`
2. ✅ Fixture de arquivo real em `tests/fixtures/`
3. ✅ Script de teste em `test:modules` (se conversão complexa)
4. ✅ Teste E2E em `e2e/modules/<nome>.spec.ts`

### Quando adicionar uma nova opção:
1. ✅ Teste E2E de renderização e interação em `e2e/test-modifiers.spec.ts`
2. ✅ Verificar que a opção é consumida corretamente via teste de módulo

### Quando adicionar um novo formato:
1. ✅ Teste de resolução no `registry.test.ts`
2. ✅ Verificar build SSG (`npm run build`)

---

## Camada 4: Teste de Conversões com Delta Debugging e Escopo Direcionado (`npm run test:conversion`)

O FileTools possui um sistema automatizado de testes de conversão com **Delta Debugging (DDmin)** e **Escopo Direcionado (Targeted Testing)** implementado em `src/core/testing/deltaDebugger.ts` e executado via CLI com `scripts/test-conversion.ts`.

### Por que usar Delta Debugging?
Em conversões de mídia com múltiplos modificadores (resolução, taxa de quadros, codecs de áudio/vídeo, mesclagem de faixas, threads, etc.), testar todas as centenas de permutações combinatórias é proibitivamente demorado. O algoritmo DDmin resolve isso de maneira cirúrgica:

1. **Etapa 1: Prioridade Obrigatória ao Baseline ($C = \emptyset$)**:
   Antes de aplicar modificadores, o executor **sempre** testa a conversão padrão sem qualquer modificador ativo. Isso garante que o caso de uso mais comum do usuário (upload e conversão direta) seja validado primeiro e impede que erros do baseline fiquem mascarados.
2. **Etapa 2: Estresse Máximo ($C_{max}$)**:
   Aplica todos os modificadores suportados pelo motor de uma vez só. Se passar junto com o baseline, a conversão é aprovada em 2 iterações rápidas.
3. **Etapa 3: Isolamento Singleton ($|C| = 1$)**:
   Se a pilha máxima falhar, testa cada modificador isoladamente para detectar o modificador pontualmente quebrado (`FAIL_SINGLETON`).
4. **Etapa 4: Bissecção Binária DDmin**:
   Se nenhum modificador falhar sozinho, divide o conjunto em partições e complementos sucessivos até isolar a interação conflitante exata (`FAIL_INTERACTION`).

### Cães de Guarda (Stall Watchdog & Timeouts)
Para evitar que execuções WebAssembly multithread travem o terminal indefinidamente em caso de deadlocks (`Atomics.wait` ou starvation):
- **Frame Stall Watchdog:** Monitora a emissão de frames a cada 500ms; se o motor passar mais de 10 segundos sem qualquer progresso de codificação ou atividade de metadados, o teste é abortado com `ESTAGNAÇÃO DE QUADROS (STALL)`.
- **Hard Timeout Global:** Limite máximo de 120 segundos para conversões de arquivos pesados.
- **Transparência de Etapas:** Cada fase do teste exibe claramente o rótulo de execução (`Etapa 1/2: Baseline`, `Etapa 2/2: Estresse Máximo`), evitando pausas silenciosas.

### Fixtures Realistas (`scripts/generate-fixtures.js`)
Os testes automatizados utilizam fixtures geradas programaticamente com características reais de produção:
- `sample.mkv` / `sample_multitrack_1080p.mkv`: 1080p (1920x1080), 30 fps, 3 faixas de áudio AAC independentes (`TUDO`, `MIC`, `SISTEMA`), `yuv420p`.
- `sample_4k_multitrack.mkv`: 4K UHD (3840x2160), 30 fps, 3 faixas de áudio AAC.

### Comandos de Teste Direcionado

```bash
# Testar exatamente a conversão em que você está mexendo (em segundos)
npx tsx scripts/test-conversion.ts --from=mkv --to=mp4
npm run test:conversion --from=mkv --to=mp4

# Testar apenas o baseline limpo (sem modificadores)
npx tsx scripts/test-conversion.ts --from=mkv --to=mp4 --baseline

# Testar com arquivo de teste pesado customizado
npx tsx scripts/test-conversion.ts --from=mkv --to=mp4 --file="tests/fixtures/2025-03-31 23-44-55.mkv"

# Testar com codec específico e verbose habilitado
npx tsx scripts/test-conversion.ts --from=mkv --to=3gp --video-codec=h263 --verbose
```
