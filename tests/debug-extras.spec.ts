import { test } from '@playwright/test';

const BASE_URL = 'https://bivitta.vercel.app';

test('Testar APIs', async ({ request }) => {
  const endpoints = [
    '/api/bq/pacientes/novos',
    '/api/bq/callcenter',
    '/api/bq/odontologia',
  ];
  
  for (const endpoint of endpoints) {
    const res = await request.get(`${BASE_URL}${endpoint}`);
    console.log(`${endpoint} => ${res.status()}`);
    if (res.status() >= 400) {
      console.log(`  ERROR: ${await res.text()}`);
    }
  }
});