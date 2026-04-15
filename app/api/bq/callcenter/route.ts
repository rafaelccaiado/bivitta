import { NextResponse } from 'next/server';
import { runQuery } from '@/lib/bigquery';

const PROJECT = 'high-nature-319701';
const DS = 'vtntprod_vitta_core';

export async function GET() {
  try {
    const kpis = await runQuery(`
      SELECT 
        COUNT(*) as total_agendamentos
      FROM \`${PROJECT}.${DS}.agendamentos\`
      WHERE DATE(start_exec) >= DATE_TRUNC(CURRENT_DATE(), MONTH)
    `);

    return NextResponse.json({
      kpis: { total: Number(kpis[0]?.total_agendamentos || 0) },
      porUnidade: [],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}