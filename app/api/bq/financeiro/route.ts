import { NextResponse } from 'next/server';
import { runQuery } from '@/lib/bigquery';

const PROJECT = 'high-nature-319701';
const DS = 'vtntprod_vitta_core';

export async function GET() {
  try {
    const [totais, evolucao] = await Promise.all([

      runQuery(`
        SELECT
          ROUND(SUM(value)/100, 2) AS total_a_receber,
          COUNT(*) AS qtde
        FROM \`${PROJECT}.${DS}.pagamentos_recebidos\`
        WHERE status IS NULL
      `),

      runQuery(`
        SELECT
          FORMAT_DATE('%b/%y', DATE_TRUNC(created_at, MONTH)) AS mes,
          ROUND(SUM(value)/100, 2) AS valor
        FROM \`${PROJECT}.${DS}.pagamentos_recebidos\`
        WHERE created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH)
        GROUP BY 1
        ORDER BY MIN(created_at) ASC
      `),
    ]);

    const t = totais[0] || {};
    return NextResponse.json({
      kpis: {
        total_a_receber: Number(t.total_a_receber || 0),
        qtde_transacoes: Number(t.qtde || 0),
      },
      evolucao: (evolucao as { mes: string; valor: number }[]).map(r => ({
        mes: r.mes,
        valor: Number(r.valor),
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}