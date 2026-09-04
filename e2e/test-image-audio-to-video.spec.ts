import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../tests/fixtures');

test.describe('Conversões Especiais e Regras de Contexto', () => {
  test('1. Converte áudio WAV para vídeo MP4 com tela preta', async ({ page }) => {
    test.setTimeout(35_000);
    await page.goto('/converter/wav-para-mp4');
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'visible' });

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(fixturesDir, 'sample.wav'));
    await expect(page.locator('text=sample.wav')).toBeVisible({ timeout: 10_000 });

    const convertBtn = page.locator('button:has-text("Converter para")');
    await expect(convertBtn).toBeEnabled({ timeout: 10_000 });
    await convertBtn.click();

    await expect(page.locator('text=Download')).toBeVisible({ timeout: 25_000 });
    await expect(page.locator('text=sample.mp4')).toBeVisible();
  });

  test('2. Converte imagem PNG para vídeo MP4 com card de duração fixado', async ({ page }) => {
    test.setTimeout(35_000);
    await page.goto('/converter/png-para-mp4');
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'visible' });

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(fixturesDir, 'sample.png'));
    await expect(page.locator('text=sample.png')).toBeVisible({ timeout: 10_000 });

    // Card de Duração do Vídeo deve estar fixado automaticamente (pinned)
    await expect(page.locator('text=Duração do Vídeo')).toBeVisible();
    await expect(page.locator('text=Tempo de exibição da imagem no vídeo:')).toBeVisible();

    // Seleciona preset 5s
    const fiveSecBtn = page.getByRole('button', { name: '5s Curto' });
    await expect(fiveSecBtn).toBeVisible();
    await fiveSecBtn.click();

    // Converte
    const convertBtn = page.locator('button:has-text("Converter para")');
    await expect(convertBtn).toBeEnabled({ timeout: 10_000 });
    await convertBtn.click();

    await expect(page.locator('text=Download')).toBeVisible({ timeout: 25_000 });
    await expect(page.locator('text=sample.mp4')).toBeVisible();
  });

  test('3. Em conversão para MP3, exibe card dedicado para Juntar Faixas de Áudio', async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto('/converter/mkv-para-mp3');
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'visible' });

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(fixturesDir, 'sample.mkv'));
    await expect(page.locator('text=sample.mkv')).toBeVisible({ timeout: 10_000 });

    // Adiciona Juntar Faixas de Áudio à pilha
    await page.getByRole('button', { name: /Adicionar Modificador/i }).click();
    await page.locator('div[role="button"]:has-text("Juntar Faixas de Áudio")').click();

    // Deve exibir o card de Juntar Faixas de Áudio e botões de ação
    await expect(page.getByText('Juntar Faixas de Áudio').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Mixar Todas/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Apenas 1ª Faixa/i })).toBeVisible();
  });

  test('4. Para imagem, NÃO exibe opções de Faixas de Áudio nem Codec de Áudio no seletor', async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto('/converter/png-para-mp4');
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'visible' });

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(fixturesDir, 'sample.png'));
    await expect(page.locator('text=sample.png')).toBeVisible({ timeout: 10_000 });

    // Abre seletor de categorias
    await page.getByRole('button', { name: /Adicionar Modificador/i }).click();

    // Não deve conter Faixas de Áudio nem Codec de Áudio
    await expect(page.locator('div[role="button"]:has-text("Faixas de Áudio")')).toHaveCount(0);
    await expect(page.locator('div[role="button"]:has-text("Codec de Áudio")')).toHaveCount(0);
  });
});
