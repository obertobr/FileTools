import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../tests/fixtures');

test.describe('Compatibilidade de Motores, Metadados Nativos e Bloqueio de Conversão', () => {
  test('1. MKV 30fps: Inicializa em 30 fps nativo, indica incompatibilidade com Remux em vermelho e desabilita botão cinza', async ({ page }) => {
    test.setTimeout(45_000);
    await page.goto('/converter/mkv-para-mp4');
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'visible' });

    // 1. Upload sample_1080p.mkv (vídeo real 1080p, 30fps)
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(fixturesDir, 'sample_1080p.mkv'));
    await expect(page.locator('text=sample_1080p.mkv')).toBeVisible({ timeout: 10_000 });

    // 2. Motor padrão recomendado para MKV -> MP4 deve ser Remux Direto
    await expect(page.locator('text=Remux Direto (Cópia Sem Perdas)')).toBeVisible();

    // 3. Abrir o picker de opções
    await page.getByRole('button', { name: /Adicionar Modificador/i }).click();

    // 4. Verificar se no picker a opção "Taxa de Quadros (FPS)" possui indicador "não compatível com o motor selecionado"
    const fpsOptionInPicker = page.locator('div[role="button"]').filter({ hasText: 'Taxa de Quadros (FPS)' }).first();
    await expect(fpsOptionInPicker).toBeVisible();
    await expect(fpsOptionInPicker.locator('text=não compatível com o motor selecionado')).toBeVisible();

    // 5. Adicionar a Taxa de Quadros
    await fpsOptionInPicker.click();

    // 6. Verificar que a taxa de quadros renomeou o preset para "Original (30 fps)"
    await expect(page.getByRole('button', { name: /Original \(30 fps\)/ })).toBeVisible();
    // E que no card do modificador aparece o badge vermelho "não compatível com o motor selecionado"
    await expect(page.locator('text=não compatível com o motor selecionado').first()).toBeVisible();

    // 7. Verificar que no motor ativo aparece a indicação vermelha "não é compatível"
    await expect(page.locator('text=não é compatível').first()).toBeVisible();

    // 8. O botão de conversão DEVE manter seu texto original ("Converter para MP4"), porém estar DESABILITADO e cinza
    const convertBtn = page.locator('button:has-text("Converter para")');
    await expect(convertBtn).toBeVisible();
    await expect(convertBtn).toBeDisabled();

    // 9. Alternar motor manualmente via EngineSelector
    const expandEngineBtn = page.locator('button').filter({ hasText: /opções disponíveis/i });
    if (await expandEngineBtn.isVisible()) {
      await expandEngineBtn.click();
    }
    const ffmpegOption = page.locator('div[role="button"]').filter({ hasText: 'FFmpeg Multi-Thread' }).first();
    await ffmpegOption.click();

    // Recolher a lista de motores
    const collapseBtn = page.locator('button').filter({ hasText: /Recolher/i });
    if (await collapseBtn.isVisible()) {
      await collapseBtn.click();
    }

    // 10. Ao selecionar motor compatível, os avisos de incompatibilidade somem e o botão é reabilitado!
    await expect(page.locator('text=não compatível com o motor selecionado')).toHaveCount(0);
    await expect(page.locator('text=não é compatível')).toHaveCount(0);
    await expect(convertBtn).toBeEnabled();

    // 11. Customizar para 10 fps
    await page.getByRole('button', { name: 'Custom Definir fps' }).click();
    const fpsInput = page.locator('input[type="number"][min="1"][max="120"]');
    await expect(fpsInput).toBeVisible();
    await fpsInput.fill('10');

    // Screenshot para evidência visual
    await page.screenshot({
      path: 'C:/Users/obertobr/.gemini/antigravity-ide/brain/3197d3f4-52bb-46de-9f4a-8d92bdb6c5ca/engine_incompatibility_flow.png',
      fullPage: true,
    });
  });

  test('2. Resolução também inicializa em Original nativo e alerta sobre Remux', async ({ page }) => {
    test.setTimeout(35_000);
    await page.goto('/converter/mkv-para-mp4');
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'visible' });

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(fixturesDir, 'sample_1080p.mkv'));
    await expect(page.locator('text=sample_1080p.mkv')).toBeVisible({ timeout: 10_000 });

    // Adicionar Resolução
    await page.getByRole('button', { name: /Adicionar Modificador/i }).click();
    const resOption = page.locator('div[role="button"]').filter({ hasText: 'Resolução e Escala' }).first();
    await expect(resOption.locator('text=não compatível com o motor selecionado')).toBeVisible();
    await resOption.click();

    // Verificar que resolução veio como Original (1920x1080)
    await expect(page.getByRole('button', { name: /Original \(1920x1080\)/ })).toBeVisible();

    // Botão de conversão deve estar desabilitado no Remux
    await expect(page.locator('button:has-text("Converter para")')).toBeDisabled();
  });

  test('3. Conversão real MKV para MP4 com alteração de FPS via FFmpeg Multi-Thread', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/converter/mkv-para-mp4');
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'visible' });

    // Upload sample.mkv
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(fixturesDir, 'sample.mkv'));
    await expect(page.locator('text=sample.mkv')).toBeVisible({ timeout: 10_000 });

    // Adicionar Taxa de Quadros
    await page.getByRole('button', { name: /Adicionar Modificador/i }).click();
    await page.locator('div[role="button"]').filter({ hasText: 'Taxa de Quadros (FPS)' }).first().click();

    // Alternar para FFmpeg Multi-Thread no EngineSelector
    const expandEngineBtn = page.locator('button').filter({ hasText: /opções disponíveis/i });
    if (await expandEngineBtn.isVisible()) {
      await expandEngineBtn.click();
    }
    await page.locator('div[role="button"]').filter({ hasText: 'FFmpeg Multi-Thread' }).first().click();

    // Customizar FPS para 10
    await page.getByRole('button', { name: 'Custom Definir fps' }).click();
    const fpsInput = page.locator('input[type="number"][min="1"][max="120"]');
    await expect(fpsInput).toBeVisible();
    await fpsInput.fill('10');

    // Executar conversão
    const convertBtn = page.locator('button:has-text("Converter para")');
    await expect(convertBtn).toBeEnabled();
    await convertBtn.click();

    // Aguardar conclusão da conversão
    await expect(page.locator('text=Download')).toBeVisible({ timeout: 40_000 });
    await expect(page.locator('text=sample.mp4')).toBeVisible();
  });
});
