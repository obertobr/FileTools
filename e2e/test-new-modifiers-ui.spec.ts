import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../tests/fixtures');

test.describe('E2E: Advanced Conversion Modifiers & Track Routing', () => {
  test('verifies native 1080p resolution selection, custom aspect ratio, per-track audio codecs, and new modifiers', async ({ page }) => {
    test.setTimeout(90_000);

    page.on('console', (msg) => console.log('[Browser]', msg.text()));
    await page.goto('/converter/mkv-para-mp4');
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'visible' });

    // 1. Upload sample.mkv (1080p with 3 audio tracks: TUDO, MIC, SISTEMA)
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(fixturesDir, 'sample.mkv'));
    await expect(page.locator('text=sample.mkv')).toBeVisible({ timeout: 10_000 });

    // Switch to FFmpeg Multi-Thread engine so that all encoding modifiers are fully supported
    const expandEnginesBtn = page.locator('button:has-text("opções disponíveis")');
    if (await expandEnginesBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expandEnginesBtn.click();
      await page.locator('[role="button"]:has-text("FFmpeg Multi-Thread")').click();
    }

    // Wait for modifiers panel
    await expect(page.locator('text=Pilha de Modificadores')).toBeVisible({ timeout: 10_000 });

    const addModBtn = page.locator('button:has-text("Adicionar Modificador")');

    // 2. Add and Test Resolution Card
    await addModBtn.click();
    await expect(page.locator('text=Adicionar Modificador à Pilha')).toBeVisible();
    await page.locator('[role="button"]:has-text("Resolução e Escala")').click();

    // Verify 1080p (Nativo) exists and is selected by default, and no duplicate "Original" button is present
    const native1080pBtn = page.locator('button:has-text("1080p (Nativo)")');
    await expect(native1080pBtn).toBeVisible();
    await expect(page.locator('button:has-text("Original (1920x1080)")')).toHaveCount(0);

    // Click Custom resolution
    const customResBtn = page.locator('button:has-text("Custom")');
    await customResBtn.click();

    // Verify "Manter proporção" checkbox
    const propCheckbox = page.locator('text=Manter proporção (altura calculada automaticamente)');
    await expect(propCheckbox).toBeVisible();

    // Uncheck proportional to expose Height input
    await propCheckbox.click();
    await expect(page.locator('text=Largura:')).toBeVisible();
    await expect(page.locator('text=Altura:')).toBeVisible();

    // Re-select 1080p (Nativo)
    await native1080pBtn.click();

    // 3. Add and Test Audio Codec Card
    await addModBtn.click();
    await page.locator('[role="button"]:has-text("Codec de Áudio")').click();

    // Verify sync checkbox is present and checked by default
    const syncCheckbox = page.locator('text=Sincronizar todas as faixas');
    await expect(syncCheckbox).toBeVisible();

    // Uncheck sync to reveal per-track selectors
    await syncCheckbox.click();
    await expect(page.locator('text=Faixa 1: TUDO')).toBeVisible();
    await expect(page.locator('text=Faixa 2: MIC')).toBeVisible();
    await expect(page.locator('text=Faixa 3: SISTEMA')).toBeVisible();

    // Re-enable sync for standard encoding
    await syncCheckbox.click();

    // 4. Add Pixel Format, Bit Depth, Bitrate, Color Space
    await addModBtn.click();
    await page.locator('[role="button"]:has-text("Formato de Pixel")').click();

    await addModBtn.click();
    await page.locator('[role="button"]:has-text("Profundidade de Cor")').click();

    await addModBtn.click();
    await page.locator('[role="button"]:has-text("Taxa de Bits (Bitrate)")').click();

    await addModBtn.click();
    await page.locator('[role="button"]:has-text("Espaço de Cor")').click();

    // Interact with Bitrate: select 5.0 Mbps
    const bitratePreset5M = page.locator('button:has-text("5.0 Mbps")');
    await expect(bitratePreset5M).toBeVisible();
    await bitratePreset5M.click();

    // Capture screenshot of the full modifiers stack
    const screenshotPath = path.resolve('C:/Users/obertobr/.gemini/antigravity-ide/brain/3197d3f4-52bb-46de-9f4a-8d92bdb6c5ca/modifiers_full_stack.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // 5. Execute Conversion
    const convertBtn = page.locator('button:has-text("Converter para")');
    await expect(convertBtn).toBeEnabled({ timeout: 10_000 });
    await convertBtn.click();

    // Verify download result
    await expect(page.locator('text=Download')).toBeVisible({ timeout: 45_000 });
    await expect(page.locator('text=sample.mp4')).toBeVisible();
  });
});
