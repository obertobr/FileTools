import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../tests/fixtures');

test.describe('Conversão Real dos Novos Formatos FFmpeg', () => {
  test('extrai áudio MP3 de um vídeo MP4 com sucesso', async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto('/converter/mp4-para-mp3');
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'visible' });

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(fixturesDir, 'sample.mp4'));
    await expect(page.locator('text=sample.mp4')).toBeVisible({ timeout: 10_000 });

    const convertBtn = page.locator('button:has-text("Converter para")');
    await expect(convertBtn).toBeEnabled({ timeout: 10_000 });
    await convertBtn.click();

    await expect(page.locator('text=Download')).toBeVisible({ timeout: 25_000 });
    await expect(page.locator('text=sample.mp3')).toBeVisible();
  });

  test('converte áudio WAV para OGG Vorbis com sucesso', async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto('/converter/wav-para-ogg');
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'visible' });

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(fixturesDir, 'sample.wav'));
    await expect(page.locator('text=sample.wav')).toBeVisible({ timeout: 10_000 });

    const convertBtn = page.locator('button:has-text("Converter para")');
    await expect(convertBtn).toBeEnabled({ timeout: 10_000 });
    await convertBtn.click();

    await expect(page.locator('text=Download')).toBeVisible({ timeout: 25_000 });
    await expect(page.locator('text=sample.ogg')).toBeVisible();
  });
});
