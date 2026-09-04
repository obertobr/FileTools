import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../tests/fixtures');

test.describe('Pilha Modular Aberta, Detecção Real e Valores Customizáveis', () => {
  test('1. Pilha aberta diretamente, zero mock data em áudio e ausência real de legendas', async ({ page }) => {
    test.setTimeout(45_000);

    await page.goto('/converter/mkv-para-mp4');
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'visible' });

    // Upload sample.mkv (has 1 real audio track, 0 subtitle tracks)
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(fixturesDir, 'sample.mkv'));
    await expect(page.locator('text=sample.mkv')).toBeVisible({ timeout: 10_000 });

    // 1. Pilha já está aberta diretamente na tela
    await expect(page.locator('text=Pilha de Configurações')).toBeVisible();

    // 2. Adiciona Faixas de Legenda à pilha
    await page.getByRole('button', { name: 'Adicionar Configuração' }).click();
    await page.locator('div[role="button"]:has-text("Faixas de Legenda")').click();

    // Verifica que detectou que o arquivo NÃO tem legendas e NÃO exibe legendas falsas
    await expect(page.getByText('Nenhuma faixa de legenda encontrada')).toBeVisible();
    await expect(page.locator('text=Legenda 1')).toHaveCount(0);

    // 3. Adiciona Faixas de Áudio à pilha
    await page.getByRole('button', { name: 'Adicionar Configuração' }).click();
    await page.locator('div[role="button"]:has-text("Faixas de Áudio")').click();

    // sample.mkv tem APENAS 1 faixa de áudio real. NÃO pode existir dados mockados (Faixa 2, Faixa 3, Faixa 4)!
    await expect(page.locator('text=Faixa 1')).toBeVisible();
    await expect(page.locator('text=Faixa 2')).toHaveCount(0);
    await expect(page.locator('text=Faixa 3')).toHaveCount(0);
    await expect(page.locator('text=Faixa 4')).toHaveCount(0);
  });

  test('2. GIF com cards separados e fixos (FPS e Resolução) sem botão de remover', async ({ page }) => {
    test.setTimeout(45_000);

    await page.goto('/converter/mkv-para-gif');
    await page.locator('[data-hydrated="true"]').waitFor({ state: 'visible' });

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(fixturesDir, 'sample.mkv'));
    await expect(page.locator('text=sample.mkv')).toBeVisible({ timeout: 10_000 });

    // 1. Card separado de FPS fixado na pilha
    const fpsCard = page.locator('.space-y-2\\.5 > div').filter({ hasText: 'Taxa de Quadros (FPS)' }).first();
    await expect(fpsCard).toBeVisible();
    await expect(fpsCard.locator('button[title="Remover configuração da pilha"]')).toHaveCount(0);

    // 2. Card separado de Resolução e Escala fixado na pilha
    const resCard = page.locator('.space-y-2\\.5 > div').filter({ hasText: 'Resolução e Escala' }).first();
    await expect(resCard).toBeVisible();
    await expect(resCard.locator('button[title="Remover configuração da pilha"]')).toHaveCount(0);

    // 3. Testa FPS personalizado
    await fpsCard.getByRole('button', { name: 'Custom', exact: true }).click();
    const fpsInput = fpsCard.locator('input[type="number"][min="1"][max="120"]');
    await expect(fpsInput).toBeVisible();
    await fpsInput.fill('18');

    // 4. Testa Resolução personalizada
    await resCard.getByRole('button', { name: /Custom/ }).click();
    const widthInput = resCard.locator('input[type="number"][min="100"][max="3840"]');
    await expect(widthInput).toBeVisible();
    await widthInput.fill('360');

    // Converte
    const convertBtn = page.locator('button:has-text("Converter para")');
    await convertBtn.click();

    await expect(page.locator('text=Download')).toBeVisible({ timeout: 35_000 });
    await expect(page.locator('text=sample.gif')).toBeVisible();
  });
});
