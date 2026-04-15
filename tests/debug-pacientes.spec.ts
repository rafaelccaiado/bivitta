import { test, expect } from '@playwright/test';

const BASE_URL = 'https://bivitta.vercel.app';

test('Ver erro completo do pacientes', async ({ request }) => {
  const res = await request.get(`${BASE_URL}/api/bq/pacientes`);
  console.log('Status:', res.status());
  console.log('Body:', await res.text());
});