import { NextResponse } from 'next/server';
import { runQuery } from '@/lib/bigquery';

const PROJECT = process.env.BQ_PROJECT!;
const DS = process.env.BQ_DATASET!;

export async function GET() {
  try {
    const [kpisHoje, kpisMes, rankingAtendentes, evolucaoLigacoes, porCanal, porUnidade] = await Promise.all([

      // KPIs do dia de hoje
      runQuery(`
        SELECT
          COUNT(CASE WHEN DATE(created_at,'America/Sao_Paulo') = CURRENT_DATE('America/Sao_Paulo')
                THEN appointment_id END)                          AS agendados_hoje,
          COUNT(DISTINCT CASE WHEN DATE(created_at,'America/Sao_Paulo') = CURRENT_DATE('America/Sao_Paulo')
                THEN attendant_id END)                            AS atendentes_ativos_hoje
        FROM \`${PROJECT}.${DS}.agendamentos\`
        WHERE scheduling_origin IN ('CALL CENTER', 'Call Center', 'call center', 'TELEFONE', 'Ligação')
           OR scheduling_origin LIKE '%call%'
           OR scheduling_origin LIKE '%ligan%'
      `),

      // KPIs do mês (agendamentos via call center)
      runQuery(`
        SELECT
          COUNT(appointment_id)                                   AS ligacoes_mtd,
          COUNT(CASE WHEN status IN ('CONCLUÍDO','PAGO','COMPARECEU') THEN appointment_id END) AS realizados_mtd,
          COUNT(CASE WHEN status IN ('AGENDADO','CONFIRMADO') THEN appointment_id END) AS agendados_futuros,
          COUNT(DISTINCT attendant_id)                            AS atendentes_mtd,
          COUNT(DISTINCT DATE(created_at,'America/Sao_Paulo'))    AS dias_ativos,
          ROUND(COUNT(appointment_id) / NULLIF(COUNT(DISTINCT DATE(created_at,'America/Sao_Paulo')),0), 0) AS media_dia
        FROM \`${PROJECT}.${DS}.agendamentos\`
        WHERE DATE_TRUNC(DATE(created_at,'America/Sao_Paulo'),MONTH)
              = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'),MONTH)
          AND (scheduling_origin LIKE '%call%' OR scheduling_origin LIKE '%telefon%'
               OR scheduling_origin LIKE '%ligan%' OR scheduling_origin = 'CALL CENTER')
      `),

      // Ranking de atendentes (mês atual)
      runQuery(`
        SELECT
          COALESCE(TRIM(attendant_name), CAST(attendant_id AS STRING), 'N/A') AS atendente,
          COUNT(appointment_id)                                               AS agendamentos,
          COUNT(CASE WHEN status IN ('CONCLUÍDO','PAGO','COMPARECEU') THEN appointment_id END) AS realizados,
          ROUND(COUNT(CASE WHEN status IN ('CONCLUÍDO','PAGO','COMPARECEU') THEN appointment_id END)*100.0
                / NULLIF(COUNT(appointment_id), 0), 1)                      AS conversao_pct,
          COUNT(DISTINCT DATE(created_at,'America/Sao_Paulo'))               AS dias_ativos,
          ROUND(COUNT(appointment_id) / NULLIF(
            COUNT(DISTINCT DATE(created_at,'America/Sao_Paulo')),0), 1)     AS media_dia
        FROM \`${PROJECT}.${DS}.agendamentos\`
        WHERE DATE_TRUNC(DATE(created_at,'America/Sao_Paulo'),MONTH)
              = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'),MONTH)
          AND attendant_id IS NOT NULL
        GROUP BY atendente
        ORDER BY agendamentos DESC
        LIMIT 30
      `),

      // Evolução de agendamentos/ligações por mês (últimos 12 meses) por origem
      runQuery(`
        SELECT
          DATE_TRUNC(DATE(created_at,'America/Sao_Paulo'),MONTH)  AS mes,
          FORMAT_DATE('%b/%yy', DATE_TRUNC(DATE(created_at,'America/Sao_Paulo'),MONTH)) AS mes_fmt,
          COUNT(appointment_id)                                   AS total,
          COUNT(CASE WHEN scheduling_origin LIKE '%call%'
                  OR scheduling_origin LIKE '%telefon%'
                  OR scheduling_origin = 'CALL CENTER'     THEN appointment_id END) AS via_callcenter,
          COUNT(CASE WHEN scheduling_origin LIKE '%whatsapp%'
                  OR scheduling_origin LIKE '%wpp%'        THEN appointment_id END) AS via_whatsapp,
          COUNT(CASE WHEN scheduling_origin LIKE '%app%'
                  OR scheduling_origin LIKE '%online%'     THEN appointment_id END) AS via_app
        FROM \`${PROJECT}.${DS}.agendamentos\`
        WHERE DATE(created_at,'America/Sao_Paulo') >= DATE_SUB(CURRENT_DATE('America/Sao_Paulo'), INTERVAL 12 MONTH)
        GROUP BY mes
        ORDER BY mes ASC
      `),

      // Agendamentos por canal no mês atual
      runQuery(`
        SELECT
          COALESCE(scheduling_origin, 'Desconhecido') AS canal,
          COUNT(appointment_id)                       AS total
        FROM \`${PROJECT}.${DS}.agendamentos\`
        WHERE DATE_TRUNC(DATE(created_at,'America/Sao_Paulo'),MONTH)
              = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'),MONTH)
        GROUP BY canal
        ORDER BY total DESC
        LIMIT 10
      `),

      // Volume por unidade no mês atual
      runQuery(`
        SELECT
          COALESCE(name_unit, 'Sem unidade') AS unidade,
          COUNT(appointment_id)              AS total,
          COUNT(CASE WHEN status IN ('CONCLUÍDO','PAGO','COMPARECEU') THEN appointment_id END) AS realizados,
          COUNT(CASE WHEN status IN ('AGENDADO','CONFIRMADO') THEN appointment_id END) AS agendados_futuros
        FROM \`${PROJECT}.${DS}.agendamentos\`
        WHERE DATE_TRUNC(DATE(created_at,'America/Sao_Paulo'),MONTH)
              = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'),MONTH)
          AND name_unit IS NOT NULL
        GROUP BY unidade
        ORDER BY total DESC
        LIMIT 20
      `),
    ]);

    const hj = kpisHoje[0] || {};
    const ms = kpisMes[0]  || {};

    return NextResponse.json({
      kpisHoje: {
        agendados_hoje:         Number(hj.agendados_hoje || 0),
        atendentes_ativos_hoje: Number(hj.atendentes_ativos_hoje || 0),
      },
      kpisMes: {
        ligacoes_mtd:       Number(ms.ligacoes_mtd       || 0),
        realizados_mtd:    Number(ms.realizados_mtd    || 0),
        agendados_futuros: Number(ms.agendados_futuros || 0),
        atendentes_mtd:    Number(ms.atendentes_mtd    || 0),
        media_dia:         Number(ms.media_dia         || 0),
      },
      rankingAtendentes: rankingAtendentes.map(r => ({
        atendente:     r.atendente,
        agendamentos:  Number(r.agendamentos),
        realizados:    Number(r.realizados),
        conversao_pct: Number(r.conversao_pct),
        media_dia:     Number(r.media_dia),
      })),
      evolucao: evolucaoLigacoes.map(r => ({
        mes:           r.mes_fmt,
        total:         Number(r.total),
        via_callcenter: Number(r.via_callcenter),
        via_whatsapp:  Number(r.via_whatsapp),
        via_app:       Number(r.via_app),
      })),
      porCanal: porCanal.map(r => ({
        canal: r.canal,
        total: Number(r.total),
      })),
      porUnidade: porUnidade.map(r => ({
        unidade: r.unidade,
        total:   Number(r.total),
        realizados: Number(r.realizados),
        agendados_futuros: Number(r.agendados_futuros),
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
