import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../../tests/fixtures');

test.describe('Module: Stream Copy (Remux Direto)', () => {
  test('converte MKV para MP4 instantaneamente via Remux', async ({ page }) => {
    await page.goto('/converter/mkv-para-mp4');

    // Wait for React hydration
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'visible' });

    // Upload ultra-compact test file (sample.mkv)
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(fixturesDir, 'sample.mkv'));

    // Wait for file preview
    await expect(page.locator('text=sample.mkv')).toBeVisible({ timeout: 10_000 });

    // Verify engine selector displays Remux Direto
    await expect(page.locator('text=Remux Direto')).toBeVisible();

    // Click convert button
    const convertBtn = page.locator('button:has-text("Converter para")');
    await expect(convertBtn).toBeEnabled({ timeout: 10_000 });
    await convertBtn.click();

    // Verify download result appears
    await expect(page.locator('text=Download')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('text=sample.mp4')).toBeVisible();
  });
});
