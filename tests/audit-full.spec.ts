import { test } from '@playwright/test';

const BASE_URL = 'https://bivitta.vercel.app';

const pages = [
  '/receita',
  '/receita/trimestral', 
  '/receita/conversao',
  '/receita/margem',
  '/pacientes',
  '/pacientes/novos',
  '/consultas',
  '/agendamentos',
  '/financeiro',
  '/financeiro/recebiveis',
  '/callcenter',
  '/odontologia',
  '/vittamais',
];

test('Auditar todas as páginas', async ({ page }) => {
  const results: { page: string; status: string; errors: string[] }[] = [];
  
  for (const p of pages) {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    
    await page.goto(`${BASE_URL}${p}`);
    await page.waitForTimeout(2000);
    
    const title = await page.locator('h1').first().textContent().catch(() => 'N/A');
    results.push({ page: p, status: title, errors });
    console.log(`${p} => ${title} (${errors.length} erros)`);
  }
  
  console.log('\n=== RESUMO ===');
  console.log(`Total de páginas: ${results.length}`);
  console.log(`Com erros: ${results.filter(r => r.errors.length > 0).length}`);
});