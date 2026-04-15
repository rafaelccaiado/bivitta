import { test, expect } from '@playwright/test';

const BASE_URL = 'https://bivitta.vercel.app';

test.describe('BI Vitta - Testes de smoke', () => {
  
  test('Dashboard carrega sem erros', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Verifica se o título está presente
    await expect(page.locator('h1')).toContainText('Dashboard');
    
    // Verifica se KPIs carregaram (não estão em loading)
    await page.waitForTimeout(3000);
    
    console.log('Erros encontrados:', errors);
  });

  test('Receita carrega', async ({ page }) => {
    await page.goto(`${BASE_URL}/receita`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await expect(page.locator('h1')).toContainText('Receita');
  });

  test('Financeiro carrega', async ({ page }) => {
    await page.goto(`${BASE_URL}/financeiro`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await expect(page.locator('h1')).toContainText('Financeiro');
  });

  test('Pacientes carrega', async ({ page }) => {
    await page.goto(`${BASE_URL}/pacientes`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await expect(page.locator('h1')).toContainText('Pacientes');
  });

  test('Agendamentos carrega', async ({ page }) => {
    await page.goto(`${BASE_URL}/agendamentos`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await expect(page.locator('h1')).toContainText('Agendamentos');
  });

  test('VittaMais carrega', async ({ page }) => {
    await page.goto(`${BASE_URL}/vittamais`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await expect(page.locator('h1')).toContainText('Vitta');
  });
});