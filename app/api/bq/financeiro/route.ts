import { NextResponse } from 'next/server';
import { runQuery } from '@/lib/bigquery';

const PROJECT = process.env.BQ_PROJECT!;
const DS = process.env.BQ_DATASET!;

async function getRecebiveisData() {
  try {
    const [totais, porFaixa, porDia, transacoes] = await Promise.all([

      // Totais
      runQuery(`
        SELECT
          ROUND(SUM(CASE WHEN pay_form_id LIKE '%crédito%' OR pay_form_id LIKE '%credito%'
                THEN value END)/100, 2)         AS total_credito,
          ROUND(SUM(CASE WHEN pay_form_id LIKE '%débito%' OR pay_form_id LIKE '%debito%'
                THEN value END)/100, 2)         AS total_debito,
          ROUND(SUM(value)/100, 2)               AS total_a_receber,
          COUNT(*)                                                AS qtde_transacoes
        FROM \`${PROJECT}.${DS}.pagamentos_recebidos\`
        WHERE status NOT IN ('Pago', 'Confirmado', 'CANCELADO')
          OR status IS NULL
      `),

      // Por faixa de dias
      runQuery(`
        SELECT
          CASE
            WHEN DATE_DIFF(CURRENT_DATE(), expected_date, DAY) <= 7 THEN '0-7 dias'
            WHEN DATE_DIFF(CURRENT_DATE(), expected_date, DAY) <= 15 THEN '8-15 dias'
            WHEN DATE_DIFF(CURRENT_DATE(), expected_date, DAY) <= 30 THEN '16-30 dias'
            ELSE '30+ dias'
          END                                                     AS faixa,
          ROUND(SUM(value)/100, 2)              AS valor,
          COUNT(*)                                                AS qtde
        FROM \`${PROJECT}.${DS}.pagamentos_recebidos\`
        WHERE (status NOT IN ('Pago', 'Confirmado', 'CANCELADO') OR status IS NULL)
          AND expected_date IS NOT NULL
        GROUP BY faixa
        ORDER BY
          CASE faixa
            WHEN '0-7 dias' THEN 1
            WHEN '8-15 dias' THEN 2
            WHEN '16-30 dias' THEN 3
            WHEN '30+ dias' THEN 4
          END
      `),

      // Recebíveis por dia (próximos 30 dias)
      runQuery(`
        SELECT
          DATE(expected_date)                        AS data,
          ROUND(SUM(value)/100, 2)              AS valor,
          COUNT(*)                                                AS qtde
        FROM \`${PROJECT}.${DS}.pagamentos_recebidos\`
        WHERE (status NOT IN ('Pago', 'Confirmado', 'CANCELADO') OR status IS NULL)
          AND expected_date >= CURRENT_DATE()
          AND expected_date <= DATE_ADD(CURRENT_DATE(), INTERVAL 30 DAY)
        GROUP BY data
        ORDER BY data ASC
      `),

      // Lista de transações pendentes
      runQuery(`
        SELECT
          id                                            AS id,
          expected_date                                 AS data,
          pay_form_id                                   AS tipo,
          ROUND(value/100, 2)                           AS valor,
          status                                        AS status,
          unit_name                                     AS estabelecimento
        FROM \`${PROJECT}.${DS}.pagamentos_recebidos\`
        WHERE (status NOT IN ('Pago', 'Confirmado', 'CANCELADO') OR status IS NULL)
        ORDER BY expected_date ASC, value DESC
        LIMIT 50
      `),
    ]);

    const t = totais[0] || {};

    return NextResponse.json({
      kpis: {
        total_a_receber: Number(t.total_a_receber || 0),
        total_credito: Number(t.total_credito || 0),
        total_debito: Number(t.total_debito || 0),
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
        id: r.id,
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
    const [recebimentos, recebidoPorMes, recebidoPorFormaPagamento] = await Promise.all([

      // Recebimentos realizados no mês
      runQuery(`
        SELECT
          ROUND(SUM(value)/100, 2)            AS recebido_mtd,
          ROUND(SUM(CASE WHEN DATE_TRUNC(created_at,MONTH) = DATE_TRUNC(DATE_SUB(CURRENT_DATE(),INTERVAL 1 MONTH),MONTH)
              THEN value END)/100, 2)          AS recebido_mes_ant,
          COUNT(*)                                                AS transacoes_mtd
        FROM \`${PROJECT}.${DS}.pagamentos_recebidos\`
        WHERE DATE_TRUNC(created_at, MONTH) = DATE_TRUNC(CURRENT_DATE(), MONTH)
           OR DATE_TRUNC(created_at, MONTH) = DATE_TRUNC(DATE_SUB(CURRENT_DATE(),INTERVAL 1 MONTH), MONTH)
      `),

      // Evolução mensal de recebimentos (12 meses)
      runQuery(`
        SELECT
          DATE_TRUNC(created_at, MONTH)                     AS mes,
          FORMAT_DATE('%b/%y', DATE_TRUNC(created_at, MONTH)) AS mes_fmt,
          ROUND(SUM(value)/100, 2)             AS recebido,
          COUNT(*)                                                AS transacoes
        FROM \`${PROJECT}.${DS}.pagamentos_recebidos\`
        WHERE created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH)
        GROUP BY mes
        ORDER BY mes ASC
      `),

      // Por forma de pagamento MTD
      runQuery(`
        SELECT
          COALESCE(pay_form_id, 'Outros')                 AS forma_pagamento,
          ROUND(SUM(value)/100, 2)         AS valor,
          COUNT(*)                                        AS transacoes
        FROM \`${PROJECT}.${DS}.pagamentos_recebidos\`
        WHERE DATE_TRUNC(created_at, MONTH) = DATE_TRUNC(CURRENT_DATE(), MONTH)
        GROUP BY forma_pagamento
        ORDER BY valor DESC
        LIMIT 10
      `),
    ]);

    const rc = recebimentos[0] || {};
    const recebidoMtd    = Number(rc.recebido_mtd     || 0);
    const recebidoMesAnt = Number(rc.recebido_mes_ant || 0);
    const delta = recebidoMesAnt > 0
      ? ((recebidoMtd - recebidoMesAnt) / recebidoMesAnt * 100).toFixed(1)
      : null;

    return NextResponse.json({
      recebiveis: {
        a_receber_credito: 0,
        a_receber_debito: 0,
        total_a_receber: 0,
        qtde_transacoes: 0,
        proxima_data: null,
      },
      recebimentos: {
        recebido_mtd:     recebidoMtd,
        recebido_mes_ant:  recebidoMesAnt,
        transacoes_mtd:   Number(rc.transacoes_mtd || 0),
        delta_pct:        delta,
      },
      evolucao: (recebidoPorMes as { mes_fmt: string; recebido: number; transacoes: number }[]).map(r => ({
        mes:        r.mes_fmt,
        recebido:   Number(r.recebido),
        transacoes: Number(r.transacoes),
      })),
      porFormaPagamento: (recebidoPorFormaPagamento as { forma_pagamento: string; valor: number; transacoes: number }[]).map(r => ({
        forma:      r.forma_pagamento,
        valor:      Number(r.valor),
        transacoes: Number(r.transacoes),
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}