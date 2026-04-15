import { test } from '@playwright/test';

const BASE_URL = 'https://bivitta.vercel.app';

test('Testar receita', async ({ request }) => {
  const res = await request.get(`${BASE_URL}/api/bq/receita`);
  console.log('Status:', res.status());
  console.log('Body:', await res.text());
});