import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../tests/fixtures');
const userFile = path.join(fixturesDir, '2025-03-31 23-44-55.mkv');

test.describe('Teste com Arquivo Real do Usuário (11.3 MB, 1080p, 38s)', () => {
  test('1. Converte MKV -> MP4 via Remux Direto instantaneamente', async ({ page }) => {
    test.setTimeout(30_000);

    await page.goto('/converter/mkv-para-mp4');
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'visible' });

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(userFile);

    await expect(page.locator('text=2025-03-31 23-44-55.mkv')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=Remux Direto')).toBeVisible();

    const convertBtn = page.locator('button:has-text("Converter para")');
    await expect(convertBtn).toBeEnabled({ timeout: 10_000 });
    await convertBtn.click();

    await expect(page.locator('text=Download')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=2025-03-31 23-44-55.mp4')).toBeVisible();
  });

  test('2. Converte MKV -> WebM via FFmpeg Multi-Thread com porcentagem ao vivo', async ({ page }) => {
    test.setTimeout(90_000);

    await page.goto('/converter/mkv-para-webm');
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'visible' });

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(userFile);

    await expect(page.locator('text=2025-03-31 23-44-55.mkv')).toBeVisible({ timeout: 10_000 });

    const convertBtn = page.locator('button:has-text("Converter para")');
    await expect(convertBtn).toBeEnabled({ timeout: 10_000 });
    await convertBtn.click();

    // Verify download result appears
    await expect(page.locator('text=Download')).toBeVisible({ timeout: 75_000 });
    await expect(page.locator('text=2025-03-31 23-44-55.webm')).toBeVisible();
  });
});
