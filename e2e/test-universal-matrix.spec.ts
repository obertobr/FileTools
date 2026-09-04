import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../tests/fixtures');

test.describe('Matriz Universal de Opções de Conversão', () => {
  test('1. Foto para Foto (PNG para JPG): NUNCA exibe duração de vídeo nem opções de vídeo/áudio', async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto('/converter/png-para-jpg');
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'visible' });

    // Upload sample.png
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(fixturesDir, 'sample.png'));
    await expect(page.locator('text=sample.png')).toBeVisible({ timeout: 10_000 });

    // In photo to photo, video duration must NOT be pinned or active
    await expect(page.locator('text=Duração do Vídeo')).toHaveCount(0);

    // If options picker exists, open it and verify no video_duration
    const addBtn = page.getByRole('button', { name: /Adicionar Configura/i });
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await expect(page.locator('div[role="button"]:has-text("Duração do Vídeo")')).toHaveCount(0);
      await expect(page.locator('div[role="button"]:has-text("Taxa de Quadros")')).toHaveCount(0);
      await expect(page.locator('div[role="button"]:has-text("Codec de Vídeo")')).toHaveCount(0);
    }
  });

  test('2. Vídeo para Vídeo (MKV para MP4): Permite Unir Faixas de Áudio (audio_merge) com exclusividade mútua', async ({ page }) => {
    test.setTimeout(35_000);
    await page.goto('/converter/mkv-para-mp4');
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'visible' });

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(fixturesDir, 'sample.mkv'));
    await expect(page.locator('text=sample.mkv')).toBeVisible({ timeout: 10_000 });

    // Abrir o seletor de configurações
    await page.getByRole('button', { name: /Adicionar Configura/i }).click();

    // Confirmar que "Juntar Faixas de Áudio" AGORA ESTÁ DISPONÍVEL para vídeo para vídeo!
    const mergeOption = page.locator('div[role="button"]:has-text("Juntar Faixas de Áudio")');
    await expect(mergeOption).toBeVisible();

    // Confirmar que "Faixas de Áudio" tradicional também está disponível inicialmente
    const tracksOption = page.locator('div[role="button"]:has-text("Faixas de Áudio")').filter({ hasNotText: 'Juntar' });
    await expect(tracksOption).toBeVisible();

    // Adicionar "Juntar Faixas de Áudio"
    await mergeOption.click();

    // Verificar que o card de Juntar Faixas foi adicionado
    await expect(page.getByText('Juntar Faixas de Áudio').first()).toBeVisible();
    await expect(page.locator('text=vídeo final')).toBeVisible();

    // Reabrir o seletor de configurações: "Faixas de Áudio" NÃO DEVE MAIS APARECER (exclusão mútua)
    await page.getByRole('button', { name: /Adicionar Configura/i }).click();
    await expect(page.locator('div[role="button"]:has-text("Faixas de Áudio")').filter({ hasNotText: 'Juntar' })).toHaveCount(0);
  });

  test('3. Vídeo para MPEG (MKV para MPEG): Exibe Resolução, FPS, Qualidade e Codec de Vídeo', async ({ page }) => {
    test.setTimeout(35_000);
    await page.goto('/converter/mkv-para-mpeg');
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'visible' });

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(fixturesDir, 'sample.mkv'));
    await expect(page.locator('text=sample.mkv')).toBeVisible({ timeout: 10_000 });

    // Abrir o seletor de configurações
    await page.getByRole('button', { name: /Adicionar Configura/i }).click();

    // Verificar que Resolução e Escala está presente para MPEG!
    await expect(page.locator('div[role="button"]:has-text("Resolução e Escala")')).toBeVisible();

    // Verificar que Taxa de Quadros (FPS) está presente para MPEG!
    await expect(page.locator('div[role="button"]:has-text("Taxa de Quadros (FPS)")')).toBeVisible();

    // Verificar que Qualidade e Compressão está presente para MPEG!
    await expect(page.locator('div[role="button"]:has-text("Qualidade e Compressão")')).toBeVisible();

    // Verificar que Codec de Vídeo está presente para MPEG!
    await expect(page.locator('div[role="button"]:has-text("Codec de Vídeo")')).toBeVisible();

    // Adicionar Resolução e Escala
    await page.locator('div[role="button"]:has-text("Resolução e Escala")').click();
    await expect(page.getByText('Resolução e Escala').first()).toBeVisible();
    await expect(page.getByRole('button', { name: '720p' })).toBeVisible();
  });

  test('4. Conversão Real de MKV para MPEG com escala e motor multi-thread', async ({ page }) => {
    test.setTimeout(45_000);
    await page.goto('/converter/mkv-para-mpeg');
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'visible' });

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(fixturesDir, 'sample.mkv'));
    await expect(page.locator('text=sample.mkv')).toBeVisible({ timeout: 10_000 });

    const convertBtn = page.locator('button:has-text("Converter para")');
    await expect(convertBtn).toBeEnabled({ timeout: 10_000 });
    await convertBtn.click();

    await expect(page.locator('text=Download')).toBeVisible({ timeout: 35_000 });
    await expect(page.locator('text=sample.mpeg')).toBeVisible();
  });
});
