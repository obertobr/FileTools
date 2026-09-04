import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../tests/fixtures');

test.describe('Seletor de Codecs de Vídeo e Áudio Expandidos', () => {
  test('permite selecionar todos os codecs de vídeo disponíveis dinamicamente', async ({ page }) => {
    test.setTimeout(45_000);

    await page.goto('/converter/mkv-para-mp4');
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'visible' });

    // Upload sample.mkv to reveal modifiers stack
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(fixturesDir, 'sample.mkv'));
    await expect(page.locator('text=sample.mkv')).toBeVisible({ timeout: 10_000 });

    // Open add category picker
    await page.getByRole('button', { name: /Adicionar Modificador/i }).click();

    // Select video_codec
    const videoCodecOption = page.locator('div[role="button"]:has-text("Codec de Vídeo")');
    await expect(videoCodecOption).toBeVisible();
    await videoCodecOption.click();

    // Verify video codec options for MP4
    await expect(page.locator('button:has-text("H.264 / AVC")')).toBeVisible();
    await expect(page.locator('button:has-text("H.265 / HEVC")')).toBeVisible();
    await expect(page.locator('button:has-text("MPEG-4")')).toBeVisible();
    await expect(page.locator('button:has-text("Cópia (Passthrough)")')).toBeVisible();

    // Select HEVC
    const hevcBtn = page.locator('button:has-text("H.265 / HEVC")');
    await hevcBtn.click();
    await expect(hevcBtn).toHaveClass(/border-primary/);
  });

  test('permite selecionar codecs de áudio disponíveis na categoria de áudio', async ({ page }) => {
    test.setTimeout(45_000);

    await page.goto('/converter/wav-para-mp3');
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'visible' });

    // Upload sample.wav to reveal modifiers stack
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(fixturesDir, 'sample.wav'));
    await expect(page.locator('text=sample.wav')).toBeVisible({ timeout: 10_000 });

    // Open add category picker
    await page.getByRole('button', { name: /Adicionar Modificador/i }).click();

    // Select audio_codec
    const audioCodecOption = page.locator('div[role="button"]:has-text("Codec de Áudio")');
    await expect(audioCodecOption).toBeVisible();
    await audioCodecOption.click();

    // Verify audio codec options for MP3
    await expect(page.locator('button:has-text("MP3 (LAME)")')).toBeVisible();
    await expect(page.locator('button:has-text("Cópia (Passthrough)")')).toBeVisible();
  });
});
