import { NextResponse } from 'next/server';
import { runQuery } from '@/lib/bigquery';

const PROJECT = 'high-nature-319701';
const DS = 'vtntprod_vitta_core';

export async function GET() {
  try {
    const kpis = await runQuery(`
      SELECT COUNT(*) as total_novos
      FROM \`${PROJECT}.${DS}.patients\`
      WHERE created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    `);

    return NextResponse.json({
      kpis: { novos_mes: Number(kpis[0]?.total_novos || 0) },
      porMes: [],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}