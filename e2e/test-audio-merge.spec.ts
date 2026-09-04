import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../tests/fixtures');

test.describe('Juntar Faixas de Áudio (Audio Merge) e Gestão Contextual', () => {
  test('Vídeo para MP3 exibe "Juntar Faixas de Áudio" e oculta "Faixas de Áudio"', async ({ page }) => {
    test.setTimeout(35_000);
    await page.goto('/converter/mp4-para-mp3');
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'visible' });

    // Upload sample.mp4
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(fixturesDir, 'sample.mp4'));
    await expect(page.locator('text=sample.mp4')).toBeVisible({ timeout: 10_000 });

    // Click on "Adicionar Configuração"
    const addBtn = page.getByRole('button', { name: /Adicionar Configura/i });
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // Verify "Juntar Faixas de Áudio" is present
    const mergeOption = page.locator('div[role="button"]:has-text("Juntar Faixas de Áudio")');
    await expect(mergeOption).toBeVisible();

    // Verify "Faixas de Áudio" (video-only) is NOT in the list
    const tracksOption = page.locator('div[role="button"]:has-text("Faixas de Áudio")').filter({ hasNotText: 'Juntar' });
    await expect(tracksOption).toHaveCount(0);

    // Add "Juntar Faixas de Áudio" to the options stack
    await mergeOption.click();

    // The card "Juntar Faixas de Áudio" should now be visible in the options stack
    await expect(page.getByText('Juntar Faixas de Áudio').first()).toBeVisible();

    // Quick action buttons should be visible
    await expect(page.getByRole('button', { name: /Mixar Todas/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Apenas 1ª Faixa/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Desmarcar/i })).toBeVisible();

    // Probed stream should be visible
    await expect(page.locator('text=Faixa 1').first()).toBeVisible();

    // Click "Apenas 1ª Faixa" and check status
    await page.getByRole('button', { name: /Apenas 1ª Faixa/i }).click();
    await expect(page.locator('text=Extração Direta (Faixa 1)')).toBeVisible();

    // Click "Desmarcar" and check status
    await page.getByRole('button', { name: /Desmarcar/i }).click();
    await expect(page.locator('text=Nenhuma faixa selecionada')).toBeVisible();

    // Click "Mixar Todas" and check status
    await page.getByRole('button', { name: /Mixar Todas/i }).click();
    await expect(page.locator('text=Faixa 1').first()).toBeVisible();
  });

  test('Vídeo para Vídeo (MKV para MP4) exibe "Faixas de Áudio" e "Juntar Faixas de Áudio"', async ({ page }) => {
    test.setTimeout(35_000);
    await page.goto('/converter/mkv-para-mp4');
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'visible' });

    // Upload sample.mkv
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(fixturesDir, 'sample.mkv'));
    await expect(page.locator('text=sample.mkv')).toBeVisible({ timeout: 10_000 });

    const addBtn = page.getByRole('button', { name: /Adicionar Configura/i });
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // Verify "Faixas de Áudio" is present
    const tracksOption = page.locator('div[role="button"]:has-text("Faixas de Áudio")').filter({ hasNotText: 'Juntar' });
    await expect(tracksOption).toBeVisible();

    // Verify "Juntar Faixas de Áudio" is ALSO present (agora disponível para vídeo para vídeo!)
    const mergeOption = page.locator('div[role="button"]:has-text("Juntar Faixas de Áudio")');
    await expect(mergeOption).toBeVisible();
  });

  test('Conversão Real de Vídeo para MP3 com card "Juntar Faixas de Áudio" ativo', async ({ page }) => {
    test.setTimeout(45_000);
    await page.goto('/converter/mp4-para-mp3');
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'visible' });

    // Upload sample.mp4
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(fixturesDir, 'sample.mp4'));
    await expect(page.locator('text=sample.mp4')).toBeVisible({ timeout: 10_000 });

    // Add "Juntar Faixas de Áudio"
    await page.getByRole('button', { name: /Adicionar Configura/i }).click();
    const mergeOption = page.locator('div[role="button"]:has-text("Juntar Faixas de Áudio")');
    await mergeOption.click();

    // Click Converter
    const convertBtn = page.locator('button:has-text("Converter para")');
    await expect(convertBtn).toBeEnabled({ timeout: 10_000 });
    await convertBtn.click();

    // Wait for conversion completion
    await expect(page.locator('text=Download')).toBeVisible({ timeout: 35_000 });
    await expect(page.locator('text=sample.mp3')).toBeVisible();
  });
});
