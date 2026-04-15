import { NextResponse } from 'next/server';
import { runQuery } from '@/lib/bigquery';

const PROJECT = 'high-nature-319701';
const DS = 'vtntprod_vitta_core';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get('tipo');

  try {
    if (tipo === 'recebiveis') {
      // Recebíveis - pagamentos pendentes
      const recebiveis = await runQuery(`
        SELECT 
          SUM(value)/100 as valor_total,
          COUNT(*) as qtde
        FROM \`${PROJECT}.${DS}.pagamentos_recebidos\`
        WHERE status IS NULL OR status NOT IN ('Pago', 'Confirmado')
      `);

      const r = recebiveis[0] || {};
      return NextResponse.json({
        kpis: {
          total_a_receber: Number(r.valor_total || 0),
          qtde_transacoes: Number(r.qtde || 0),
        },
        porFaixa: [],
        porDia: [],
        transacoes: [],
      });
    }

    // Financeiro geral
    const [totais, evolucao, porForma] = await Promise.all([
      runQuery(`
        SELECT 
          SUM(value)/100 as valor_total,
          COUNT(*) as qtde
        FROM \`${PROJECT}.${DS}.pagamentos_recebidos\`
        WHERE DATE_TRUNC(created_at, MONTH) = DATE_TRUNC(CURRENT_DATE(), MONTH)
      `),
      
      runQuery(`
        SELECT 
          FORMAT_DATE('%b/%y', DATE_TRUNC(created_at, MONTH)) as mes,
          SUM(value)/100 as valor
        FROM \`${PROJECT}.${DS}.pagamentos_recebidos\`
        WHERE created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH)
        GROUP BY 1
        ORDER BY MIN(created_at) ASC
      `),

      runQuery(`
        SELECT 
          COALESCE(pay_form_id, 'Outros') as forma,
          SUM(value)/100 as valor,
          COUNT(*) as qtde
        FROM \`${PROJECT}.${DS}.pagamentos_recebidos\`
        WHERE DATE_TRUNC(created_at, MONTH) = DATE_TRUNC(CURRENT_DATE(), MONTH)
        GROUP BY 1
        ORDER BY valor DESC
      `),
    ]);

    const t = totais[0] || {};

    return NextResponse.json({
      kpis: {
        total_a_receber: Number(t.valor_total || 0),
        qtde_transacoes: Number(t.qtde || 0),
      },
      evolucao: evolucao.map((r: any) => ({
        mes: r.mes,
        valor: Number(r.valor),
      })),
      porFormaPagamento: porForma.map((r: any) => ({
        forma: r.forma,
        valor: Number(r.valor),
        transacoes: Number(r.qtde),
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}