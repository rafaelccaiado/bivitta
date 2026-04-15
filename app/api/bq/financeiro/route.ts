import { NextResponse } from 'next/server';
import { runQuery, BQ } from '@/lib/bigquery';

const PROJECT = BQ.PROJECT;
const DS = BQ.DATASET;

async function getRecebiveisData() {
  try {
    const [totais, porFaixa, porDia, transacoes] = await Promise.all([

      runQuery(`
        SELECT
          ROUND(SUM(value)/100, 2) AS total_a_receber,
          COUNT(*) AS qtde_transacoes
        FROM \`${PROJECT}.${DS}.pagamentos_recebidos\`
        WHERE status IS NULL OR status NOT IN ('Pago', 'Confirmado', 'CANCELADO')
      `),

      runQuery(`
        SELECT
          CASE
            WHEN expected_date IS NULL THEN 'Sem data'
            ELSE 'Pendente'
          END AS faixa,
          ROUND(SUM(value)/100, 2) AS valor,
          COUNT(*) AS qtde
        FROM \`${PROJECT}.${DS}.pagamentos_recebidos\`
        WHERE status IS NULL OR status NOT IN ('Pago', 'Confirmado', 'CANCELADO')
        GROUP BY 1
      `),

      runQuery(`
        SELECT
          DATE(expected_date) AS data,
          ROUND(SUM(value)/100, 2) AS valor,
          COUNT(*) AS qtde
        FROM \`${PROJECT}.${DS}.pagamentos_recebidos\`
        WHERE (status IS NULL OR status NOT IN ('Pago', 'Confirmado', 'CANCELADO'))
          AND expected_date >= CURRENT_DATE()
          AND expected_date <= DATE_ADD(CURRENT_DATE(), INTERVAL 30 DAY)
        GROUP BY data
        ORDER BY data ASC
      `),

      runQuery(`
        SELECT
          id AS id,
          expected_date AS data,
          pay_form_id AS tipo,
          ROUND(value/100, 2) AS valor,
          COALESCE(status, 'Pendente') AS status,
          COALESCE(unit_name, 'N/A') AS estabelecimento
        FROM \`${PROJECT}.${DS}.pagamentos_recebidos\`
        WHERE status IS NULL OR status NOT IN ('Pago', 'Confirmado', 'CANCELADO')
        ORDER BY expected_date ASC, value DESC
        LIMIT 50
      `),
    ]);

    const t = totais[0] || {};

    return NextResponse.json({
      kpis: {
        total_a_receber: Number(t.total_a_receber || 0),
        total_credito: 0,
        total_debito: 0,
        qtde_transacoes: Number(t.qtde_transacoes || 0),
      },
      porFaixa: (porFaixa as { faixa: string; valor: number; qtde: number }[]).map(r => ({
        faixa: r.faixa,
        valor: Number(r.valor),
        qtde: Number(r.qtde),
      })),
      porDia: (porDia as { data: string; valor: number; qtde: number }[]).map(r => ({
        data: r.data,
        valor: Number(r.valor),
        qtde: Number(r.qtde),
      })),
      transacoes: (transacoes as { id: string; data: string; tipo: string; valor: number; status: string; estabelecimento: string }[]).map(r => ({
        id: String(r.id),
        data: r.data,
        tipo: r.tipo,
        valor: Number(r.valor),
        status: r.status,
        estabelecimento: r.estabelecimento,
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get('tipo');

  if (tipo === 'recebiveis') {
    return getRecebiveisData();
  }

  try {
    const [recebimentos, evolucao, porForma] = await Promise.all([

      runQuery(`
        SELECT
          ROUND(SUM(value)/100, 2) AS recebido_mtd,
          COUNT(*) AS transacoes_mtd
        FROM \`${PROJECT}.${DS}.pagamentos_recebidos\`
        WHERE DATE_TRUNC(created_at, MONTH) = DATE_TRUNC(CURRENT_DATE(), MONTH)
      `),

      runQuery(`
        SELECT
          DATE_TRUNC(created_at, MONTH) AS mes,
          FORMAT_DATE('%b/%y', DATE_TRUNC(created_at, MONTH)) AS mes_fmt,
          ROUND(SUM(value)/100, 2) AS recebido,
          COUNT(*) AS transacoes
        FROM \`${PROJECT}.${DS}.pagamentos_recebidos\`
        WHERE created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH)
        GROUP BY mes
        ORDER BY mes ASC
      `),

      runQuery(`
        SELECT
          COALESCE(pay_form_id, 'Outros') AS forma_pagamento,
          ROUND(SUM(value)/100, 2) AS valor,
          COUNT(*) AS transacoes
        FROM \`${PROJECT}.${DS}.pagamentos_recebidos\`
        WHERE DATE_TRUNC(created_at, MONTH) = DATE_TRUNC(CURRENT_DATE(), MONTH)
        GROUP BY 1
        ORDER BY valor DESC
        LIMIT 10
      `),
    ]);

    const rc = recebimentos[0] || {};
    const recebidoMtd = Number(rc.recebido_mtd || 0);

    return NextResponse.json({
      recebiveis: { a_receber_credito: 0, a_receber_debito: 0, total_a_receber: 0, qtde_transacoes: 0, proxima_data: null },
      recebimentos: { recebido_mtd: recebidoMtd, recebido_mes_ant: 0, transacoes_mtd: Number(rc.transacoes_mtd || 0), delta_pct: null },
      evolucao: (evolucao as { mes_fmt: string; recebido: number; transacoes: number }[]).map(r => ({ mes: r.mes_fmt, recebido: Number(r.recebido), transacoes: Number(r.transacoes) })),
      porFormaPagamento: (porForma as { forma_pagamento: string; valor: number; transacoes: number }[]).map(r => ({ forma: r.forma_pagamento, valor: Number(r.valor), transacoes: Number(r.transacoes) })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}