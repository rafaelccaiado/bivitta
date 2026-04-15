import { NextResponse } from 'next/server';
import { runQuery, getBQConfig } from '@/lib/bigquery';

const { PROJECT: _PROJECT, DATASET: _DS } = getBQConfig();

// Fallback temporário para deploy na Vercel
const PROJECT = 'high-nature-319701';
const DS = 'vtntprod_vitta_core';

export async function GET() {
  try {
    const kpis = await runQuery(`
      SELECT COUNT(*) AS total_pacientes
      FROM \`${PROJECT}.${DS}.patients\`
    `);

    return NextResponse.json({
      kpis: { total: Number(kpis[0]?.total_pacientes || 0) },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}