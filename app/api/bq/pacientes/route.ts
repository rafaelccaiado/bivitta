import { NextResponse } from 'next/server';
import { runQuery } from '@/lib/bigquery';

const PROJECT = 'high-nature-319701';
const DS = 'vtntprod_vitta_core';

export async function GET() {
  try {
    // Total de pacientes (da view)
    const kpis = await runQuery(`
      SELECT 
        COUNT(*) as total_pacientes,
        COUNTIF(ativo_atual = 1) as ativos
      FROM \`${PROJECT}.${DS}.vw_growth_inteligencia_clientes\`
    `);

    // Por mês (últimos 12) - usar uma data disponível
    const porMes = await runQuery(`
      SELECT 
        FORMAT_DATE('%b/%y', DATE_TRUNC(created_at, MONTH)) as mes,
        COUNT(*) as total
      FROM \`${PROJECT}.${DS}.vw_growth_inteligencia_clientes\`
      WHERE created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH)
      GROUP BY 1
      ORDER BY MIN(created_at) ASC
    `);

    const k = kpis[0] || {};

    return NextResponse.json({
      kpis: {
        total: Number(k.total_pacientes || 0),
        ativos: Number(k.ativos || 0),
        novos_mes: 0,
        recorrentes: 0,
      },
      porMes: porMes.map((r: any) => ({
        mes: r.mes,
        total: Number(r.total),
      })),
      porUnidade: [],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}