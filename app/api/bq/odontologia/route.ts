import { NextResponse } from 'next/server';
import { runQuery } from '@/lib/bigquery';

const PROJECT = 'high-nature-319701';
const DS = 'vtntprod_vitta_core';

export async function GET() {
  try {
    const kpis = await runQuery(`
      SELECT 
        COUNT(*) as total_procedimentos
      FROM \`${PROJECT}.${DS}.agendamentos\`
      WHERE DATE(start_exec) >= DATE_TRUNC(CURRENT_DATE(), MONTH)
        AND (name_item LIKE '%dent%' OR name_item LIKE '%odont%' OR name_item LIKE '%oral%')
    `);

    return NextResponse.json({
      kpis: { total: Number(kpis[0]?.total_procedimentos || 0) },
      porProcedimento: [],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}