import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../../tests/fixtures');

test.describe('Module: FFmpeg Single-Thread', () => {
  test('converte áudio WAV para MP3 com motor padrão', async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto('/converter/wav-para-mp3');

    // Wait for React hydration
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'visible' });

    // Upload ultra-compact test file (sample.wav)
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(fixturesDir, 'sample.wav'));

    // Wait for file preview
    await expect(page.locator('text=sample.wav')).toBeVisible({ timeout: 10_000 });

    const convertBtn = page.locator('button:has-text("Converter para")');
    await expect(convertBtn).toBeEnabled({ timeout: 10_000 });
    await convertBtn.click();

    // Verify completion
    await expect(page.locator('text=Download')).toBeVisible({ timeout: 25_000 });
    await expect(page.locator('text=sample.mp3')).toBeVisible();
  });
});
