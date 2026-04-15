import { NextResponse } from 'next/server';
import { runQuery } from '@/lib/bigquery';

const PROJECT = 'high-nature-319701';
const DS = 'vtntprod_vitta_core';

export async function GET() {
  try {
    // KPIs principais
    const kpis = await runQuery(`
      SELECT 
        COUNT(*) as total_pacientes,
        COUNTIF(ativo_atual = 1) as ativos
      FROM \`${PROJECT}.${DS}.vw_growth_inteligencia_clientes\`
    `);

    // Por mês (últimos 12)
    const porMes = await runQuery(`
      SELECT 
        FORMAT_DATE('%b/%y', DATE_TRUNC(criado_em_data, MONTH)) as mes,
        COUNT(*) as total
      FROM \`${PROJECT}.${DS}.vw_growth_inteligencia_clientes\`
      WHERE criado_em_data >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH)
      GROUP BY 1
      ORDER BY MIN(criado_em_data) ASC
    `);

    // Por unidade
    const porUnidade = await runQuery(`
      SELECT 
        name_unit as unidade,
        COUNT(*) as total
      FROM \`${PROJECT}.${DS}.vw_growth_inteligencia_clientes\`
      GROUP BY name_unit
      ORDER BY total DESC
      LIMIT 15
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
      porUnidade: porUnidade.map((r: any) => ({
        unidade: r.unidade,
        total: Number(r.total),
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}