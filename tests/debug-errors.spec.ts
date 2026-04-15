import { test } from '@playwright/test';

const BASE_URL = 'https://bivitta.vercel.app';

const pages = [
  { url: '/pacientes/novos', name: 'Pacientes Novos' },
  { url: '/callcenter', name: 'Call Center' },
  { url: '/odontologia', name: 'Odontologia' },
];

test('Ver detalhes dos erros', async ({ page }) => {
  for (const p of pages) {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    
    await page.goto(`${BASE_URL}${p.url}`);
    await page.waitForTimeout(3000);
    
    console.log(`\n=== ${p.name} (${p.url}) ===`);
    console.log('Erros:', errors);
    
    // Verificar dados na página
    const kpis = await page.locator('.kpi-grid').count();
    console.log('KPIs encontrados:', kpis);
  }
});