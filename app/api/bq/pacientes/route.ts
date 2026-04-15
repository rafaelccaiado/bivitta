import { NextResponse } from 'next/server';
import { runQuery, BQ } from '@/lib/bigquery';

const PROJECT = BQ.PROJECT;
const DS = BQ.DATASET;

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Pacientes novos por mês (primeira consulta)
    const pacientesMensal = await runQuery<{
      mes: string;
      novos: number;
      recorrentes: number;
      total: number;
    }>(`
      WITH primeira_consulta AS (
        SELECT 
          patient_id,
          MIN(DATE(created_at)) as data_primeira
FROM \`${PROJECT}.${DS}.sales_orders\`
        WHERE status NOT IN (3, 4)
          AND created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 24 MONTH)
      ),
      pedidos_mes AS (
        SELECT 
          FORMAT_DATE('%Y-%m', DATE(so.created_at)) as mes,
          so.patient_id,
          DATE(so.created_at) as data_pedido,
          pc.data_primeira
        FROM \`${PROJECT}.${DS}.sales_orders\` so
        JOIN primeira_consulta pc ON pc.patient_id = so.patient_id
        WHERE so.status NOT IN (3, 4)
          AND DATE(so.created_at) >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH)
          AND EXTRACT(YEAR FROM so.created_at) BETWEEN 2020 AND 2030
      )
      SELECT 
        mes,
        COUNT(DISTINCT CASE WHEN FORMAT_DATE('%Y-%m', data_primeira) = mes THEN patient_id END) as novos,
        COUNT(DISTINCT CASE WHEN FORMAT_DATE('%Y-%m', data_primeira) < mes THEN patient_id END) as recorrentes,
        COUNT(DISTINCT patient_id) as total
      FROM pedidos_mes
      GROUP BY 1
      ORDER BY 1
    `);

    // KPIs pacientes usando view semantic layer
    const kpis = await runQuery<{
      total_base: number;
      ativos_30d: number;
      ativos_90d: number;
      novos_mes: number;
      ltv_medio: number;
    }>(`
      SELECT 
        COUNT(DISTINCT patient_id) as total_base,
        COUNT(DISTINCT CASE WHEN ativo_atual = 1 THEN patient_id END) as ativos_30d,
        COUNT(DISTINCT CASE WHEN ativo_atual = 1 THEN patient_id END) as ativos_90d,
        COUNT(DISTINCT CASE WHEN DATE(criado_em_data) >= DATE_TRUNC(CURRENT_DATE(), MONTH) THEN patient_id END) as novos_mes,
        AVG(ltv) as ltv_medio
      FROM \`high-nature-319701.vw_growth_inteligencia_clientes\`
      WHERE EXTRACT(YEAR FROM criado_em_data) BETWEEN 2020 AND 2030
    `);

    // Pacientes ativos com plano
    const pacientesComPlano = await runQuery<{
      tem_plano: number;
      sem_plano: number;
    }>(`
      SELECT 
        COUNT(DISTINCT CASE WHEN tem_plano = 1 THEN patient_id END) as tem_plano,
        COUNT(DISTINCT CASE WHEN tem_plano = 0 THEN patient_id END) as sem_plano
      FROM \`high-nature-319701.vw_growth_inteligencia_clientes\`
      WHERE ativo_atual = 1
    `);

    return NextResponse.json({ ok: true, pacientesMensal, kpis, pacientesComPlano });
  } catch (err) {
    console.error('BQ error:', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
