import { NextResponse } from 'next/server';
import { runQuery, getBQConfig } from '@/lib/bigquery';

const { PROJECT, DATASET: DS } = getBQConfig();

const STATUS_REALIZADO = `('CONCLUÍDO', 'COMPARECEU')`;

export async function GET() {
  try {
    const [kpis, agendamentosMes, vendasMes, evolucao, porProcedimento] = await Promise.all([

      runQuery(`
        SELECT
          COUNT(CASE WHEN DATE_TRUNC(DATE(start_exec,'America/Sao_Paulo'),MONTH) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'),MONTH)
                THEN appointment_id END)                                   AS agendamentos_mtd,
          COUNT(CASE WHEN DATE_TRUNC(DATE(start_exec,'America/Sao_Paulo'),MONTH) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'),MONTH)
                  AND status IN ${STATUS_REALIZADO}
                THEN appointment_id END)                                   AS realizados_mtd,
          COUNT(DISTINCT CASE WHEN DATE_TRUNC(DATE(start_exec,'America/Sao_Paulo'),MONTH) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'),MONTH)
                THEN patient_id END)                                       AS pacientes_mtd
        FROM \`${PROJECT}.${DS}.agendamentos\` ag
        WHERE LOWER(name_item) LIKE '%odon%'
           OR LOWER(name_item) LIKE '%dent%'
           OR LOWER(name_item) LIKE '%oral%'
           OR LOWER(name_item) LIKE '%implante%'
           OR LOWER(name_item) LIKE '%ortodont%'
           OR LOWER(name_item) LIKE '%protocolo%'
           OR LOWER(name_item) LIKE '%lente%'
           OR LOWER(name_item) LIKE '%lentes%'
           OR LOWER(name_item) LIKE '%prótese%'
           OR LOWER(name_item) LIKE '%proteses%'
           OR LOWER(name_item) LIKE '%odontologia%'
           OR LOWER(name_item) LIKE '%odontolog%'
           OR LOWER(name_item) LIKE '% Clareamento%'
           OR LOWER(name_item) LIKE '%tratamento dent%'
        `),

      runQuery(`
        SELECT
          DATE(start_exec,'America/Sao_Paulo')                    AS data,
          FORMAT_DATE('%d/%m', DATE(start_exec,'America/Sao_Paulo')) AS data_fmt,
          COUNT(appointment_id)                                   AS agendamentos,
          COUNT(CASE WHEN status IN ${STATUS_REALIZADO} THEN appointment_id END) AS realizados
        FROM \`${PROJECT}.${DS}.agendamentos\`
        WHERE (LOWER(name_item) LIKE '%odon%'
            OR LOWER(name_item) LIKE '%dent%'
            OR LOWER(name_item) LIKE '%oral%'
            OR LOWER(name_item) LIKE '%implante%'
            OR LOWER(name_item) LIKE '%ortodont%'
            OR LOWER(name_item) LIKE '%protocolo%'
            OR LOWER(name_item) LIKE '%lente%'
            OR LOWER(name_item) LIKE '%lentes%'
            OR LOWER(name_item) LIKE '%prótese%'
            OR LOWER(name_item) LIKE '%proteses%'
            OR LOWER(name_item) LIKE '%odontologia%'
            OR LOWER(name_item) LIKE '%odontolog%'
            OR LOWER(name_item) LIKE '% Clareamento%'
            OR LOWER(name_item) LIKE '%tratamento dent%')
          AND DATE(start_exec,'America/Sao_Paulo') >= DATE_SUB(CURRENT_DATE('America/Sao_Paulo'), INTERVAL 60 DAY)
          AND DATE(start_exec,'America/Sao_Paulo') < CURRENT_DATE('America/Sao_Paulo')
        GROUP BY data
        ORDER BY data ASC
      `),

      runQuery(`
        SELECT
          SUM(valor_total)                                        AS receita_total,
          SUM(valor_total_unidade)                                AS receita_liquida,
          COUNT(DISTINCT pedido_id)                               AS pedidos,
          COUNT(DISTINCT paciente_id)                             AS pacientes
        FROM \`${PROJECT}.${DS}.pedidos_venda\`
        WHERE status IN ('Nota Emitida', 'Pago')
          AND (LOWER(grupo_item) LIKE '%odon%'
            OR LOWER(grupo_item) LIKE '%dent%'
            OR LOWER(grupo_item) LIKE '%protese%'
            OR LOWER(grupo_item) LIKE '%implante%'
            OR LOWER(nome_item)  LIKE '%odon%'
            OR LOWER(nome_item)  LIKE '%dent%'
            OR LOWER(nome_item)  LIKE '%implante%'
            OR LOWER(nome_item)  LIKE '%protocolo%'
            OR LOWER(nome_item)  LIKE '%lente%'
            OR LOWER(nome_item)  LIKE '%lentes%'
            OR LOWER(nome_item)  LIKE '%prótese%'
            OR LOWER(nome_item)  LIKE '%proteses%'
            OR LOWER(nome_item)  LIKE '%ortodont%'
            OR LOWER(nome_item)  LIKE '%odontologia%'
            OR LOWER(nome_item)  LIKE '% Clareamento%')
          AND DATE_TRUNC(criado_em_data, MONTH) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'), MONTH)
      `),

      runQuery(`
        SELECT
          DATE_TRUNC(DATE(start_exec,'America/Sao_Paulo'),MONTH)  AS mes,
          FORMAT_DATE('%b/%y', DATE_TRUNC(DATE(start_exec,'America/Sao_Paulo'),MONTH)) AS mes_fmt,
          COUNT(appointment_id)                                   AS agendamentos,
          COUNT(CASE WHEN status IN ${STATUS_REALIZADO} THEN appointment_id END) AS realizados,
          COUNT(DISTINCT patient_id)                              AS pacientes_distintos
        FROM \`${PROJECT}.${DS}.agendamentos\`
        WHERE (LOWER(name_item) LIKE '%odon%'
            OR LOWER(name_item) LIKE '%dent%'
            OR LOWER(name_item) LIKE '%oral%'
            OR LOWER(name_item) LIKE '%implante%'
            OR LOWER(name_item) LIKE '%ortodont%'
            OR LOWER(name_item) LIKE '%protocolo%'
            OR LOWER(name_item) LIKE '%lente%'
            OR LOWER(name_item) LIKE '%lentes%'
            OR LOWER(name_item) LIKE '%prótese%'
            OR LOWER(name_item) LIKE '%proteses%'
            OR LOWER(name_item) LIKE '%odontologia%'
            OR LOWER(name_item) LIKE '%odontolog%'
            OR LOWER(name_item) LIKE '% Clareamento%'
            OR LOWER(name_item) LIKE '%tratamento dent%')
          AND DATE(start_exec,'America/Sao_Paulo') >= DATE_SUB(CURRENT_DATE('America/Sao_Paulo'), INTERVAL 12 MONTH)
        GROUP BY mes
        ORDER BY mes ASC
      `),

      runQuery(`
        SELECT
          COALESCE(nome_item, 'N/A') AS procedimento,
          COUNT(*)                                  AS qtde,
          SUM(valor_total)                          AS receita
        FROM \`${PROJECT}.${DS}.pedidos_venda\`
        WHERE status IN ('Nota Emitida', 'Pago')
          AND (LOWER(grupo_item) LIKE '%odon%'
            OR LOWER(grupo_item) LIKE '%dent%'
            OR LOWER(grupo_item) LIKE '%protese%'
            OR LOWER(grupo_item) LIKE '%implante%'
            OR LOWER(nome_item)  LIKE '%odon%'
            OR LOWER(nome_item)  LIKE '%dent%'
            OR LOWER(nome_item)  LIKE '%implante%'
            OR LOWER(nome_item)  LIKE '%protocolo%'
            OR LOWER(nome_item)  LIKE '%lente%'
            OR LOWER(nome_item)  LIKE '%lentes%'
            OR LOWER(nome_item)  LIKE '%prótese%'
            OR LOWER(nome_item)  LIKE '%proteses%'
            OR LOWER(nome_item)  LIKE '%ortodont%'
            OR LOWER(nome_item)  LIKE '%odontologia%'
            OR LOWER(nome_item)  LIKE '% Clareamento%')
          AND DATE_TRUNC(criado_em_data, MONTH) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'), MONTH)
        GROUP BY procedimento
        ORDER BY receita DESC
        LIMIT 15
      `),
    ]);

    const k = kpis[0] || {};
    const v = vendasMes[0] || {};

    return NextResponse.json({
      kpis: {
        agendamentos_mtd: Number(k.agendamentos_mtd || 0),
        realizados_mtd:   Number(k.realizados_mtd   || 0),
        pacientes_mtd:    Number(k.pacientes_mtd    || 0),
        receita_mtd:      Number(v.receita_total    || 0),
        receita_liq_mtd:  Number(v.receita_liquida  || 0),
        pedidos_mtd:      Number(v.pedidos          || 0),
      },
      agendamentosMes: agendamentosMes.map(r => ({
        data:        r.data_fmt,
        agendamentos: Number(r.agendamentos),
        realizados:  Number(r.realizados),
      })),
      evolucao: evolucao.map(r => ({
        mes:        r.mes_fmt,
        agendamentos: Number(r.agendamentos),
        realizados: Number(r.realizados),
        pacientes:  Number(r.pacientes_distintos),
      })),
      porProcedimento: porProcedimento.map(r => ({
        procedimento: r.procedimento,
        qtde:         Number(r.qtde),
        receita:      Number(r.receita),
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
