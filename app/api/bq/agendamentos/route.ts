import { NextResponse } from 'next/server';
import { runQuery, BQ } from '@/lib/bigquery';

const PROJECT = BQ.PROJECT;
const DS = BQ.DATASET;

// Status válidos por categoria (MAIÚSCULAS conforme BigQuery)
const STATUS_REALIZADO  = `('CONCLUÍDO', 'PAGO', 'COMPARECEU')`;
const STATUS_NAOSHOW    = `('FALTOU', 'FALTOU CONFIRMADO')`;
const STATUS_CANCELADO  = `('CANCELADO', 'DESMARCADO')`;
const STATUS_FUTURO     = `('AGENDADO', 'CONFIRMADO', 'EM ESPERA', 'EM ATENDIMENTO', 'AGUARDANDO')`;

export async function GET() {
  try {
    const [kpis, porDia, porCanal, porUnidade, evolucao, porDiaSemana, statusBreakdown] = await Promise.all([

// KPIs MTD (data da consulta no mês atual)
      runQuery(`
        SELECT
          COUNT(CASE WHEN DATE_TRUNC(DATE(start_exec),MONTH) = DATE_TRUNC(CURRENT_DATE(),MONTH)
                THEN appointment_id END)                                    AS agendados_mtd,
          COUNT(CASE WHEN DATE_TRUNC(DATE(start_exec),MONTH) = DATE_TRUNC(CURRENT_DATE(),MONTH)
                  AND status IN ${STATUS_REALIZADO} THEN appointment_id END) AS realizados_mtd,
          COUNT(CASE WHEN DATE_TRUNC(DATE(start_exec),MONTH) = DATE_TRUNC(CURRENT_DATE(),MONTH)
                  AND status IN ${STATUS_NAOSHOW} THEN appointment_id END)   AS faltou_mtd,
          COUNT(CASE WHEN DATE_TRUNC(DATE(start_exec),MONTH) = DATE_TRUNC(CURRENT_DATE(),MONTH)
                  AND status IN ${STATUS_CANCELADO} THEN appointment_id END) AS cancelados_mtd,
          ROUND(COUNT(CASE WHEN DATE_TRUNC(DATE(start_exec),MONTH) = DATE_TRUNC(CURRENT_DATE(),MONTH)
                  AND status IN ${STATUS_REALIZADO} THEN appointment_id END) * 100.0
                / NULLIF(COUNT(CASE WHEN DATE_TRUNC(DATE(start_exec),MONTH) = DATE_TRUNC(CURRENT_DATE(),MONTH)
                THEN appointment_id END), 0), 1)                            AS conversao_pct_mtd,
          COUNT(CASE WHEN DATE_TRUNC(DATE(start_exec),MONTH) = DATE_TRUNC(DATE_SUB(CURRENT_DATE(),INTERVAL 1 MONTH),MONTH)
               AND EXTRACT(DAY FROM DATE(start_exec)) <= EXTRACT(DAY FROM CURRENT_DATE())
                  THEN appointment_id END)                                    AS agendados_ant
        FROM \`${PROJECT}.${DS}.agendamentos\`
        WHERE DATE(start_exec) >= DATE_TRUNC(DATE_SUB(CURRENT_DATE(),INTERVAL 1 MONTH),MONTH)
      `),

      // Agendamentos por dia (últimos 60 dias)
      runQuery(`
        SELECT
          DATE(start_exec)           AS data,
          FORMAT_DATE('%d/%m', DATE(start_exec)) AS data_fmt,
          COUNT(appointment_id)                          AS total,
          COUNT(CASE WHEN status IN ${STATUS_REALIZADO}  THEN 1 END) AS realizados,
          COUNT(CASE WHEN status IN ${STATUS_NAOSHOW}    THEN 1 END) AS faltou,
          COUNT(CASE WHEN status IN ${STATUS_CANCELADO}  THEN 1 END) AS cancelados
        FROM \`${PROJECT}.${DS}.agendamentos\`
        WHERE DATE(start_exec) >= DATE_SUB(CURRENT_DATE(), INTERVAL 60 DAY)
          AND DATE(start_exec) < CURRENT_DATE()
        GROUP BY data
        ORDER BY data ASC
      `),

      // Agendamentos por canal origem MTD
      runQuery(`
        SELECT
          COALESCE(scheduling_origin, 'Desconhecido')    AS canal,
          COUNT(appointment_id)                          AS total,
          COUNT(CASE WHEN status IN ${STATUS_REALIZADO} THEN 1 END) AS realizados,
          ROUND(COUNT(CASE WHEN status IN ${STATUS_REALIZADO} THEN 1 END) * 100.0
                / NULLIF(COUNT(appointment_id), 0), 1)  AS conversao_pct
        FROM \`${PROJECT}.${DS}.agendamentos\`
        WHERE DATE_TRUNC(DATE(start_exec),MONTH)
              = DATE_TRUNC(CURRENT_DATE(),MONTH)
        GROUP BY canal
        ORDER BY total DESC
      `),

      // Por unidade MTD
      runQuery(`
        SELECT
          COALESCE(name_unit, 'N/A')                     AS unidade,
          COUNT(appointment_id)                          AS total,
          COUNT(CASE WHEN status IN ${STATUS_REALIZADO} THEN 1 END) AS realizados,
          COUNT(CASE WHEN status IN ${STATUS_NAOSHOW}   THEN 1 END) AS faltou,
          ROUND(COUNT(CASE WHEN status IN ${STATUS_REALIZADO} THEN 1 END) * 100.0
                / NULLIF(COUNT(appointment_id), 0), 1)  AS conversao_pct
        FROM \`${PROJECT}.${DS}.agendamentos\`
        WHERE DATE_TRUNC(DATE(start_exec),MONTH)
              = DATE_TRUNC(CURRENT_DATE(),MONTH)
        GROUP BY name_unit
        ORDER BY total DESC
      `),

      // Evolução mensal (últimos 12 meses)
      runQuery(`
        SELECT
          DATE_TRUNC(DATE(start_exec),MONTH) AS mes,
          FORMAT_DATE('%b/%y', DATE_TRUNC(DATE(start_exec),MONTH)) AS mes_fmt,
          COUNT(appointment_id)                                   AS total,
          COUNT(CASE WHEN status IN ${STATUS_REALIZADO} THEN 1 END) AS realizados,
          ROUND(COUNT(CASE WHEN status IN ${STATUS_REALIZADO} THEN 1 END) * 100.0
                / NULLIF(COUNT(appointment_id), 0), 1)           AS conversao_pct
        FROM \`${PROJECT}.${DS}.agendamentos\`
        WHERE DATE(start_exec) >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH)
        GROUP BY mes
        ORDER BY mes ASC
      `),

      // Por dia da semana
      runQuery(`
        SELECT
          CASE EXTRACT(DAYOFWEEK FROM DATE(start_exec))
            WHEN 1 THEN '1_Dom' WHEN 2 THEN '2_Seg' WHEN 3 THEN '3_Ter'
            WHEN 4 THEN '4_Qua' WHEN 5 THEN '5_Qui' WHEN 6 THEN '6_Sex'
            WHEN 7 THEN '7_Sáb'
          END                                                     AS dia_semana,
          COUNT(appointment_id)                                   AS total,
          COUNT(CASE WHEN status IN ${STATUS_REALIZADO} THEN 1 END) AS realizados
        FROM \`${PROJECT}.${DS}.agendamentos\`
        WHERE status IN ${STATUS_REALIZADO}
          AND DATE(start_exec) >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
          AND start_exec IS NOT NULL
        GROUP BY dia_semana
        ORDER BY dia_semana ASC
      `),

      // Breakdown de status detalhado MTD
      runQuery(`
        SELECT
          status,
          COUNT(*) AS total
        FROM \`${PROJECT}.${DS}.agendamentos\`
        WHERE DATE_TRUNC(DATE(start_exec),MONTH)
              = DATE_TRUNC(CURRENT_DATE(),MONTH)
        GROUP BY status
        ORDER BY total DESC
        LIMIT 20
      `),
    ]);

    const k = kpis[0] || {};
    const agendados   = Number(k.agendados_mtd  || 0);
    const realizados  = Number(k.realizados_mtd || 0);
    const faltou      = Number(k.faltou_mtd     || 0);
    const cancelados  = Number(k.cancelados_mtd || 0);
    const antPeriodo  = Number(k.agendados_ant  || 0);
    const delta = antPeriodo > 0
      ? ((agendados - antPeriodo) / antPeriodo * 100).toFixed(1)
      : null;

    return NextResponse.json({
      kpis: {
        agendados_mtd:    agendados,
        realizados_mtd:   realizados,
        faltou_mtd:       faltou,
        cancelados_mtd:   cancelados,
        conversao_pct:    Number(k.conversao_pct_mtd || 0),
        delta_pct:        delta,
        delta_label:      'vs mesmo período mês ant.',
      },
      porDia: porDia.map(r => ({
        data:        r.data_fmt,
        total:       Number(r.total),
        realizados:  Number(r.realizados),
        faltou:      Number(r.faltou),
        cancelados:  Number(r.cancelados),
      })),
      porCanal: porCanal.map(r => ({
        canal:         r.canal,
        total:         Number(r.total),
        realizados:    Number(r.realizados),
        conversao_pct: Number(r.conversao_pct),
      })),
      porUnidade: porUnidade.map(r => ({
        unidade:       r.unidade,
        total:         Number(r.total),
        realizados:    Number(r.realizados),
        faltou:        Number(r.faltou),
        conversao_pct: Number(r.conversao_pct),
      })),
      evolucao: evolucao.map(r => ({
        mes:           r.mes_fmt,
        total:         Number(r.total),
        realizados:    Number(r.realizados),
        conversao_pct: Number(r.conversao_pct),
      })),
      porDiaSemana: porDiaSemana.map(r => ({
        dia:         String(r.dia_semana || '').split('_')[1] || String(r.dia_semana),
        total:       Number(r.total),
        realizados:  Number(r.realizados),
      })),
      statusBreakdown: statusBreakdown.map(r => ({
        status: r.status,
        total:  Number(r.total),
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
