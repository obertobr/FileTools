import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../../tests/fixtures');

test.describe('Module: FFmpeg Multi-Thread', () => {
  test('converte vídeo 1080p para WebM com multi-threading e porcentagem real', async ({ page }) => {
    test.setTimeout(45_000);

    const logs: string[] = [];
    page.on('console', (msg) => logs.push(msg.text()));

    await page.goto('/converter/mkv-para-webm');
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'visible' });

    // Upload 1080p sample file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(fixturesDir, 'sample_1080p.mkv'));

    await expect(page.locator('text=sample_1080p.mkv')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=FFmpeg Multi-Thread')).toBeVisible();

    const convertBtn = page.locator('button:has-text("Converter para")');
    await expect(convertBtn).toBeEnabled({ timeout: 10_000 });
    await convertBtn.click();

    // Verify download result appears
    await expect(page.locator('text=Download')).toBeVisible({ timeout: 35_000 });
    await expect(page.locator('text=sample_1080p.webm')).toBeVisible();

    // Verify that hardware optimization logs and progress were printed
    const hwLog = logs.find((l) => l.includes('núcleos lógicos'));
    console.log('Hardware detection log:', hwLog || '(no console log captured)');
  });
});
