import { test, expect } from '@playwright/test';

const BASE_URL = 'https://bivitta.vercel.app';

test('Ver detalhes do erro nas APIs', async ({ request }) => {
  const endpoints = [
    '/api/bq/receita',
    '/api/bq/consultas', 
    '/api/bq/pacientes',
    '/api/bq/agendamentos',
    '/api/bq/financeiro',
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
    console.log(`${endpoint} => ${status}`);
    if (status >= 400) {
      console.log(`  ERROR: ${body.substring(0, 300)}`);
    }
  }
});