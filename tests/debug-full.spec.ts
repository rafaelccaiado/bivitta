import { test } from '@playwright/test';

const BASE_URL = 'https://bivitta.vercel.app';

test('Ver dados completos de todas APIs', async ({ request }) => {
  const endpoints = [
    '/api/bq/receita',
    '/api/bq/receita?tipo=trimestral',
    '/api/bq/receita?tipo=conversao',
    '/api/bq/receita?tipo=margem',
    '/api/bq/pacientes',
    '/api/bq/pacientes/novos',
    '/api/bq/consultas',
    '/api/bq/agendamentos',
    '/api/bq/financeiro',
    '/api/bq/financeiro?tipo=recebiveis',
    '/api/bq/callcenter',
    '/api/bq/odontologia',
    '/api/bq/vittamais',
  ];
  
  for (const endpoint of endpoints) {
    const res = await request.get(`${BASE_URL}${endpoint}`);
    const status = res.status();
    let body = '';
    try {
      body = await res.text();
    } catch {
      body = 'N/A';
    }
    
    console.log(`\n=== ${endpoint} ===`);
    console.log(`Status: ${status}`);
    
    if (status === 200) {
      try {
        const json = JSON.parse(body);
        console.log('Keys:', Object.keys(json));
        // Mostrar KPIs se existirem
        if (json.kpis) console.log('KPIs:', JSON.stringify(json.kpis));
        if (json.porDia?.length) console.log('porDia: tem dados');
        if (json.porUnidade?.length) console.log('porUnidade: tem dados');
        if (json.crescimento?.length) console.log('crescimento: tem dados');
      } catch {
        console.log('Body (raw):', body.substring(0, 200));
      }
    } else {
      console.log('Error:', body.substring(0, 200));
    }
  }
});