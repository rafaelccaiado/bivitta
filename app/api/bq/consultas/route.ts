import { NextResponse } from 'next/server';
import { runQuery } from '@/lib/bigquery';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // SEMANTIC LAYER: status correto para consultas realizadas = 'CONCLUÍDO' ou 'COMPARECEU'
    const consultasMensal = await runQuery<{
      mes: string;
      realizadas: number;
      agendadas: number;
      canceladas: number;
      no_show: number;
    }>(`
      SELECT 
        FORMAT_DATE('%Y-%m', DATE(start_exec)) as mes,
        COUNTIF(status IN ('CONCLUÍDO', 'COMPARECEU')) as realizadas,
        COUNTIF(status IN ('AGENDADO', 'CONFIRMADO')) as agendadas,
        COUNTIF(status = 'CANCELADO') as canceladas,
        COUNTIF(status = 'FALTA') as no_show
      FROM \`high-nature-319701.vtntprod_vitta_core.agendamentos\`
      WHERE DATE(start_exec) >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH)
        AND start_exec IS NOT NULL
      GROUP BY 1
      ORDER BY 1
    `);

    // KPIs mês atual
    const kpis = await runQuery<{
      realizadas: number;
      canceladas: number;
      no_show: number;
      total: number;
    }>(`
      SELECT 
        COUNTIF(status IN ('CONCLUÍDO', 'COMPARECEU')) as realizadas,
        COUNTIF(status = 'CANCELADO') as canceladas,
        COUNTIF(status = 'FALTA') as no_show,
        COUNT(*) as total
      FROM \`high-nature-319701.vtntprod_vitta_core.agendamentos\`
      WHERE DATE(start_exec) BETWEEN DATE_TRUNC(CURRENT_DATE(), MONTH) AND CURRENT_DATE()
        AND start_exec IS NOT NULL
    `);

    // Por unidade mês atual
    const porUnidade = await runQuery<{
      unit_id: number;
      unidade: string;
      realizadas: number;
      canceladas: number;
      taxa_cancelamento: number;
    }>(`
      SELECT 
        unit_id,
        name_unit as unidade,
        COUNTIF(status IN ('CONCLUÍDO', 'COMPARECEU')) as realizadas,
        COUNTIF(status = 'CANCELADO') as canceladas,
        ROUND(SAFE_DIVIDE(COUNTIF(status = 'CANCELADO') * 100.0, COUNT(*)), 1) as taxa_cancelamento
      FROM \`high-nature-319701.vtntprod_vitta_core.agendamentos\`
      WHERE DATE(start_exec) BETWEEN DATE_TRUNC(CURRENT_DATE(), MONTH) AND CURRENT_DATE()
        AND start_exec IS NOT NULL
      GROUP BY unit_id, name_unit
      ORDER BY realizadas DESC
    `);

    return NextResponse.json({ ok: true, consultasMensal, kpis, porUnidade });
  } catch (err) {
    console.error('BQ error:', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
