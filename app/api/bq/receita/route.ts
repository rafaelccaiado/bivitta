import { NextResponse } from 'next/server';
import { runQuery, BQ } from '@/lib/bigquery';

const PROJECT = BQ.PROJECT;
const DS = BQ.DATASET;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get('tipo'); // 'mensal' | 'trimestral'

  try {
    if (tipo === 'trimestral') {
      return getTrimestralData();
    }
    if (tipo === 'conversao') {
      return getConversaoData();
    }
    if (tipo === 'margem') {
      return getMargemData();
    }
    return getMensalData();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function getTrimestralData() {
  const [kpis, porTrimestre, porUnidade, historico] = await Promise.all([

    // KPIs Trimestre Atual vs Trimestre Anterior
    runQuery(`
      SELECT
        SUM(CASE WHEN DATE_TRUNC(criado_em_data,QUARTER) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'),QUARTER)
            THEN valor_total END)                                              AS receita_qtd,
        SUM(CASE WHEN DATE_TRUNC(criado_em_data,QUARTER) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'),QUARTER)
            THEN valor_total_unidade END)                                     AS receita_liq_qtd,
        COUNT(DISTINCT CASE WHEN DATE_TRUNC(criado_em_data,QUARTER) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'),QUARTER)
            THEN pedido_id END)                                               AS pedidos_qtd,
        SUM(CASE WHEN DATE_TRUNC(criado_em_data,QUARTER) = DATE_TRUNC(DATE_SUB(CURRENT_DATE('America/Sao_Paulo'),INTERVAL 1 QUARTER),QUARTER)
            THEN valor_total END)                                               AS receita_tri_ant,
        SUM(CASE WHEN DATE_TRUNC(criado_em_data,QUARTER) = DATE_TRUNC(DATE_SUB(CURRENT_DATE('America/Sao_Paulo'),INTERVAL 1 QUARTER),QUARTER)
            THEN valor_total_unidade END)                                      AS receita_liq_tri_ant,
        COUNT(DISTINCT CASE WHEN DATE_TRUNC(criado_em_data,QUARTER) = DATE_TRUNC(DATE_SUB(CURRENT_DATE('America/Sao_Paulo'),INTERVAL 1 QUARTER),QUARTER)
            THEN pedido_id END)                                                 AS pedidos_tri_ant,
        SUM(CASE WHEN DATE_TRUNC(criado_em_data,QUARTER) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'),QUARTER)
            THEN valor_total END)
        / NULLIF(COUNT(DISTINCT CASE WHEN DATE_TRUNC(criado_em_data,QUARTER) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'),QUARTER)
            THEN pedido_id END), 0)                                           AS ticket_medio_qtd
      FROM \`${PROJECT}.${DS}.pedidos_venda\`
      WHERE status IN ('Nota Emitida', 'Pago')
        AND criado_em_data >= DATE_TRUNC(DATE_SUB(CURRENT_DATE('America/Sao_Paulo'),INTERVAL 2 QUARTER),QUARTER)
    `),

    // Receita por mês do trimestre atual
    runQuery(`
      SELECT
        FORMAT_DATE('%b', criado_em_data)                AS mes,
        FORMAT_DATE('%m', criado_em_data)              AS mes_num,
        SUM(valor_total)                             AS receita,
        SUM(valor_total_unidade)                     AS receita_liquida,
        COUNT(DISTINCT pedido_id)                      AS pedidos,
        SUM(valor_total) / NULLIF(COUNT(DISTINCT pedido_id), 0) AS ticket_medio
      FROM \`${PROJECT}.${DS}.pedidos_venda\`
      WHERE status IN ('Nota Emitida', 'Pago')
        AND DATE_TRUNC(criado_em_data, QUARTER) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'), QUARTER)
      GROUP BY FORMAT_DATE('%m', criado_em_data), FORMAT_DATE('%b', criado_em_data)
      ORDER BY mes_num ASC
    `),

    // Receita por unidade no trimestre
    runQuery(`
      SELECT
        unidade,
        SUM(valor_total)                                        AS receita,
        SUM(valor_total_unidade)                                AS receita_liquida,
        COUNT(DISTINCT paciente_id)                             AS pacientes,
        COUNT(DISTINCT pedido_id)                               AS pedidos,
        SUM(valor_total) / NULLIF(COUNT(DISTINCT pedido_id),0)   AS ticket_medio
      FROM \`${PROJECT}.${DS}.pedidos_venda\`
      WHERE status IN ('Nota Emitida', 'Pago')
        AND DATE_TRUNC(criado_em_data, QUARTER) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'), QUARTER)
      GROUP BY unidade
      ORDER BY receita DESC
    `),

    // Histórico trimestral — últimos 8 trimestres
    runQuery(`
      WITH trimestral AS (
        SELECT
          DATE_TRUNC(criado_em_data, QUARTER) AS trimestre,
          SUM(valor_total)                    AS receita,
          SUM(valor_total_unidade)          AS receita_liquida,
          COUNT(DISTINCT pedido_id)         AS pedidos
        FROM \`${PROJECT}.${DS}.pedidos_venda\`
        WHERE status IN ('Nota Emitida', 'Pago')
          AND criado_em_data >= DATE_SUB(CURRENT_DATE('America/Sao_Paulo'), INTERVAL 8 QUARTER)
        GROUP BY trimestre
      )
      SELECT
        trimestre,
        CONCAT('T', EXTRACT(QUARTER FROM trimestre), '/', FORMAT_DATE('%y', trimestre)) AS trimestre_fmt,
        receita,
        receita_liquida,
        pedidos,
        LAG(receita) OVER (ORDER BY trimestre)       AS receita_anterior,
        ROUND((receita - LAG(receita) OVER (ORDER BY trimestre)) * 100.0
              / NULLIF(LAG(receita) OVER (ORDER BY trimestre), 0), 1) AS crescimento_pct
      FROM trimestral
      ORDER BY trimestre ASC
    `),
  ]);

  const k = kpis[0] || {};
  const receitaQtd = Number(k.receita_qtd || 0);
  const receitaLiqQtd = Number(k.receita_liq_qtd || 0);
  const pedidosQtd = Number(k.pedidos_qtd || 0);
  const receitaTriAnt = Number(k.receita_tri_ant || 0);
  const receitaLiqTriAnt = Number(k.receita_liq_tri_ant || 0);
  const pedidosTriAnt = Number(k.pedidos_tri_ant || 0);
  const ticketMedioQtd = Number(k.ticket_medio_qtd || 0);

  const deltaQtd = receitaTriAnt > 0
    ? ((receitaQtd - receitaTriAnt) / receitaTriAnt * 100).toFixed(1)
    : null;

  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);
  const currentYear = new Date().getFullYear();

  return NextResponse.json({
    kpis: {
      receita_qtd: receitaQtd,
      receita_liquida_qtd: receitaLiqQtd,
      pedidos_qtd: pedidosQtd,
      ticket_medio: ticketMedioQtd,
      receita_tri_ant: receitaTriAnt,
      receita_liq_tri_ant: receitaLiqTriAnt,
      pedidos_tri_ant: pedidosTriAnt,
      delta_qtd_pct: deltaQtd,
      delta_label: 'vs trimestre anterior',
      trimestre_atual: `T${currentQuarter}/${currentYear}`,
    },
    porMes: porTrimestre.map(r => ({
      mes: r.mes,
      receita: Number(r.receita),
      receita_liq: Number(r.receita_liquida),
      pedidos: Number(r.pedidos),
      ticket_medio: Number(r.ticket_medio),
    })),
    porUnidade: porUnidade.map(r => ({
      unidade: r.unidade || 'N/A',
      receita: Number(r.receita),
      receita_liq: Number(r.receita_liquida),
      pacientes: Number(r.pacientes),
      pedidos: Number(r.pedidos),
      ticket_medio: Number(r.ticket_medio),
    })),
    historico: historico.map(r => ({
      trimestre: r.trimestre_fmt,
      receita: Number(r.receita),
      receita_liq: Number(r.receita_liquida),
      pedidos: Number(r.pedidos),
      crescimento_pct: Number(r.crescimento_pct || 0),
    })),
  });
}

async function getMensalData() {
  const [kpis, porDia, porUnidade, porGrupo, crescimento, ticketMedio] = await Promise.all([

      // KPIs MTD vs mesmo período mês anterior (comparação justa)
      // ⚠️ Semantic layer: status = 'Nota Emitida' ou 'Pago' (case sensitive)
      runQuery(`
        SELECT
          SUM(CASE WHEN DATE_TRUNC(criado_em_data,MONTH) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'),MONTH)
              THEN valor_total END)                                            AS receita_mtd,
          SUM(CASE WHEN DATE_TRUNC(criado_em_data,MONTH) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'),MONTH)
              THEN valor_total_unidade END)                                   AS receita_liquida_mtd,
          COUNT(DISTINCT CASE WHEN DATE_TRUNC(criado_em_data,MONTH) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'),MONTH)
              THEN pedido_id END)                                             AS pedidos_mtd,
          -- Mesmo período do mês anterior (até o mesmo dia do mês)
          SUM(CASE WHEN DATE_TRUNC(criado_em_data,MONTH) = DATE_TRUNC(DATE_SUB(CURRENT_DATE('America/Sao_Paulo'),INTERVAL 1 MONTH),MONTH)
               AND EXTRACT(DAY FROM criado_em_data) <= EXTRACT(DAY FROM CURRENT_DATE('America/Sao_Paulo'))
              THEN valor_total END)                                           AS receita_mes_ant_mtd,
          SUM(CASE WHEN DATE_TRUNC(criado_em_data,MONTH) = DATE_TRUNC(DATE_SUB(CURRENT_DATE('America/Sao_Paulo'),INTERVAL 1 MONTH),MONTH)
               AND EXTRACT(DAY FROM criado_em_data) <= EXTRACT(DAY FROM CURRENT_DATE('America/Sao_Paulo'))
              THEN valor_total_unidade END)                                   AS receita_liq_mes_ant_mtd,
          -- Mês anterior completo
          SUM(CASE WHEN DATE_TRUNC(criado_em_data,MONTH) = DATE_TRUNC(DATE_SUB(CURRENT_DATE('America/Sao_Paulo'),INTERVAL 1 MONTH),MONTH)
              THEN valor_total END)                                           AS receita_mes_ant_completo,
          SUM(CASE WHEN DATE_TRUNC(criado_em_data,MONTH) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'),MONTH)
              THEN valor_total END
              ) / NULLIF(COUNT(DISTINCT CASE WHEN DATE_TRUNC(criado_em_data,MONTH) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'),MONTH)
              THEN pedido_id END), 0)                                         AS ticket_medio_mtd
        FROM \`high-nature-319701.vtntprod_vitta_core.pedidos_venda\`
        WHERE status IN ('Nota Emitida', 'Pago')
          AND criado_em_data >= DATE_TRUNC(DATE_SUB(CURRENT_DATE('America/Sao_Paulo'),INTERVAL 1 MONTH),MONTH)
      `),

      // Receita por dia dos últimos 60 dias
      runQuery(`
        SELECT
          criado_em_data                             AS data,
          FORMAT_DATE('%d/%m', criado_em_data)       AS data_fmt,
          SUM(valor_total)                           AS receita,
          SUM(valor_total_unidade)                   AS receita_liquida,
          COUNT(DISTINCT pedido_id)                  AS pedidos,
          SUM(valor_total) / NULLIF(COUNT(DISTINCT pedido_id), 0) AS ticket_medio
        FROM \`high-nature-319701.vtntprod_vitta_core.pedidos_venda\`
        WHERE status IN ('Nota Emitida', 'Pago')
          AND criado_em_data >= DATE_SUB(CURRENT_DATE('America/Sao_Paulo'), INTERVAL 60 DAY)
          AND criado_em_data < CURRENT_DATE('America/Sao_Paulo')
        GROUP BY criado_em_data
        ORDER BY criado_em_data ASC
      `),

      // Receita por unidade MTD (sem hardcoded - usa name_unit diretamente)
      runQuery(`
        SELECT
          name_unit as unidade,
          SUM(valor_total)                                        AS receita,
          SUM(valor_total_unidade)                                AS receita_liquida,
          COUNT(DISTINCT paciente_id)                             AS pacientes,
          COUNT(DISTINCT pedido_id)                               AS pedidos,
          SUM(valor_total) / NULLIF(COUNT(DISTINCT pedido_id),0) AS ticket_medio
        FROM \`high-nature-319701.vtntprod_vitta_core.pedidos_venda\`
        WHERE status IN ('Nota Emitida', 'Pago')
          AND DATE_TRUNC(criado_em_data, MONTH) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'), MONTH)
        GROUP BY name_unit
        ORDER BY receita DESC
      `),

      // Receita por grupo de serviço MTD
      runQuery(`
        SELECT
          COALESCE(grupo_item, 'Outros')             AS grupo,
          SUM(valor_total)                           AS receita,
          COUNT(*)                                   AS itens_vendidos,
          ROUND(AVG(preco_unit), 2)                  AS preco_medio
        FROM \`high-nature-319701.vtntprod_vitta_core.pedidos_venda\`
        WHERE status IN ('Nota Emitida', 'Pago')
          AND DATE_TRUNC(criado_em_data, MONTH) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'), MONTH)
        GROUP BY grupo
        ORDER BY receita DESC
        LIMIT 15
      `),

      // Evolução mensal — últimos 24 meses
      runQuery(`
        WITH mensal AS (
          SELECT
            DATE_TRUNC(criado_em_data, MONTH)   AS mes,
            SUM(valor_total)                    AS receita,
            SUM(valor_total_unidade)            AS receita_liquida,
            COUNT(DISTINCT pedido_id)           AS pedidos
          FROM \`high-nature-319701.vtntprod_vitta_core.pedidos_venda\`
          WHERE status IN ('Nota Emitida', 'Pago')
            AND criado_em_data >= DATE_SUB(CURRENT_DATE('America/Sao_Paulo'), INTERVAL 24 MONTH)
          GROUP BY mes
        )
        SELECT
          mes,
          FORMAT_DATE('%b/%y', mes)              AS mes_fmt,
          receita,
          receita_liquida,
          pedidos,
          LAG(receita) OVER (ORDER BY mes)       AS receita_anterior,
          ROUND((receita - LAG(receita) OVER (ORDER BY mes)) * 100.0
                / NULLIF(LAG(receita) OVER (ORDER BY mes), 0), 1) AS crescimento_pct
        FROM mensal
        ORDER BY mes ASC
      `),

      // Ticket médio por unidade (últimos 30 dias)
      runQuery(`
        SELECT
          name_unit as unidade,
          ROUND(SUM(valor_total) / NULLIF(COUNT(DISTINCT pedido_id), 0), 2) AS ticket_medio,
          COUNT(DISTINCT pedido_id)                                           AS pedidos
        FROM \`high-nature-319701.vtntprod_vitta_core.pedidos_venda\`
        WHERE status IN ('Nota Emitida', 'Pago')
          AND criado_em_data >= DATE_SUB(CURRENT_DATE('America/Sao_Paulo'), INTERVAL 30 DAY)
        GROUP BY name_unit
        ORDER BY ticket_medio DESC
      `),
    ]);

const k = kpis[0] || {};
    const receitaMtd      = Number(k.receita_mtd || 0);
    const receitaLiqMtd   = Number(k.receita_liquida_mtd || 0);
    const pedidosMtd      = Number(k.pedidos_mtd || 0);
    const receitaAntMtd   = Number(k.receita_mes_ant_mtd || 0);
    const receitaLiqAnt   = Number(k.receita_liq_mes_ant_mtd || 0);
    const receitaAntComp  = Number(k.receita_mes_ant_completo || 0);
    const ticketMedioMtd  = Number(k.ticket_medio_mtd || 0);

    const deltaMtd = receitaAntMtd > 0
      ? ((receitaMtd - receitaAntMtd) / receitaAntMtd * 100).toFixed(1)
      : null;

    return NextResponse.json({
      kpis: {
        receita_mtd:        receitaMtd,
        receita_liquida_mtd: receitaLiqMtd,
        pedidos_mtd:        pedidosMtd,
        ticket_medio:       ticketMedioMtd,
        receita_mes_ant_completo: receitaAntComp,
        delta_mtd_pct:      deltaMtd,
        delta_label:        'vs mesmo período mês ant.',
      },
      porDia:     porDia.map(r => ({
        data:          r.data_fmt,
        receita:       Number(r.receita),
        receita_liq:   Number(r.receita_liquida),
        pedidos:       Number(r.pedidos),
        ticket_medio:  Number(r.ticket_medio),
      })),
      porUnidade: porUnidade.map(r => ({
        unidade:        r.unidade || 'N/A',
        receita:        Number(r.receita),
        receita_liq:    Number(r.receita_liquida),
        pacientes:      Number(r.pacientes),
        pedidos:        Number(r.pedidos),
        ticket_medio:   Number(r.ticket_medio),
      })),
      porGrupo: porGrupo.map(r => ({
        grupo:         r.grupo,
        receita:       Number(r.receita),
        itens:         Number(r.itens_vendidos),
        preco_medio:   Number(r.preco_medio),
      })),
      crescimento: crescimento.map(r => ({
        mes:             r.mes_fmt,
        receita:         Number(r.receita),
        receita_liq:     Number(r.receita_liquida),
        pedidos:         Number(r.pedidos),
        crescimento_pct: Number(r.crescimento_pct || 0),
      })),
      ticketPorUnidade: ticketMedio.map(r => ({
        unidade:     r.unidade || 'N/A',
        ticket:      Number(r.ticket_medio),
        pedidos:    Number(r.pedidos),
      })),
});
}

async function getConversaoData() {
  const [kpis, funil, porUnidade, comparativoMensal, conversaoDiaria] = await Promise.all([

    // KPIs de conversão MTD
    runQuery(`
      SELECT
        COUNT(DISTINCT CASE WHEN DATE_TRUNC(criado_em_data,MONTH) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'),MONTH)
          THEN agendamento_id END)                                              AS agendamentos,
        COUNT(DISTINCT CASE WHEN DATE_TRUNC(criado_em_data,MONTH) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'),MONTH)
          THEN consulta_id END)                                                 AS consultas,
        COUNT(DISTINCT CASE WHEN DATE_TRUNC(criado_em_data,MONTH) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'),MONTH)
          THEN pedido_id END)                                                   AS pedidos_mtd,
        SUM(CASE WHEN DATE_TRUNC(criado_em_data,MONTH) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'),MONTH)
          THEN valor_total END)                                                 AS receita_mtd
      FROM \`${PROJECT}.${DS}.pedidos_venda\`
      WHERE status IN ('Nota Emitida', 'Pago')
        AND DATE_TRUNC(criado_em_data,MONTH) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'),MONTH)
    `),

    // Funil de conversão (dados agregados do funil)
    runQuery(`
      WITH base AS (
        SELECT
          COUNT(DISTINCT agendamento_id) AS agendamentos,
          COUNT(DISTINCT consulta_id)    AS consultas,
          COUNT(DISTINCT pedido_id)      AS pedidos,
          SUM(valor_total)               AS receita
        FROM \`${PROJECT}.${DS}.pedidos_venda\`
        WHERE status IN ('Nota Emitida', 'Pago')
          AND DATE_TRUNC(criado_em_data,MONTH) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'),MONTH)
      )
      SELECT 
        'Agendamentos' AS etapa,
        agendamentos    AS valor,
        100.0          AS percentual
      FROM base
      UNION ALL
      SELECT 
        'Consultas',
        consultas,
        ROUND(consultas * 100.0 / NULLIF(agendamentos, 0), 1)
      FROM base
      UNION ALL
      SELECT 
        'Pedidos',
        pedidos,
        ROUND(pedidos * 100.0 / NULLIF(consultas, 0), 1)
      FROM base
      UNION ALL
      SELECT 
        'Receita (R$)',
        CAST(receita AS INT64),
        ROUND(pedidos * 100.0 / NULLIF(consultas, 0), 1)
      FROM base
    `),

    // Conversão por unidade MTD
    runQuery(`
      SELECT
        unidade,
        COUNT(DISTINCT CASE WHEN DATE_TRUNC(criado_em_data,MONTH) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'),MONTH)
          THEN agendamento_id END)                                              AS agendamentos,
        COUNT(DISTINCT CASE WHEN DATE_TRUNC(criado_em_data,MONTH) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'),MONTH)
          THEN consulta_id END)                                                 AS consultas,
        COUNT(DISTINCT CASE WHEN DATE_TRUNC(criado_em_data,MONTH) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'),MONTH)
          THEN pedido_id END)                                                   AS pedidos,
        SUM(CASE WHEN DATE_TRUNC(criado_em_data,MONTH) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'),MONTH)
          THEN valor_total END)                                                 AS receita
      FROM \`${PROJECT}.${DS}.pedidos_venda\`
      WHERE DATE_TRUNC(criado_em_data,MONTH) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'),MONTH)
      GROUP BY unidade
      HAVING COUNT(DISTINCT agendamento_id) > 0
      ORDER BY agendamentos DESC
    `),

    // Comparativo mensal receita vs taxa de conversão — últimos 12 meses
    runQuery(`
      WITH mensal AS (
        SELECT
          DATE_TRUNC(criado_em_data, MONTH)                   AS mes,
          COUNT(DISTINCT agendamento_id)                       AS agendamentos,
          COUNT(DISTINCT consulta_id)                          AS consultas,
          COUNT(DISTINCT pedido_id)                            AS pedidos,
          SUM(valor_total)                                     AS receita
        FROM \`${PROJECT}.${DS}.pedidos_venda\`
        WHERE status IN ('Nota Emitida', 'Pago')
          AND criado_em_data >= DATE_SUB(CURRENT_DATE('America/Sao_Paulo'), INTERVAL 12 MONTH)
        GROUP BY DATE_TRUNC(criado_em_data, MONTH)
      )
      SELECT
        FORMAT_DATE('%b/%y', mes)                  AS mes,
        receita,
        ROUND(pedidos * 100.0 / NULLIF(consultas, 0), 1) AS tx_conversao
      FROM mensal
      ORDER BY mes ASC
    `),

    // Conversão diária — últimos 30 dias
    runQuery(`
      SELECT
        FORMAT_DATE('%d/%m', criado_em_data)                   AS data,
        COUNT(DISTINCT agendamento_id)                         AS agendamentos,
        COUNT(DISTINCT consulta_id)                            AS consultas,
        COUNT(DISTINCT pedido_id)                              AS pedidos
      FROM \`${PROJECT}.${DS}.pedidos_venda\`
      WHERE status IN ('Nota Emitida', 'Pago')
        AND criado_em_data >= DATE_SUB(CURRENT_DATE('America/Sao_Paulo'), INTERVAL 30 DAY)
      GROUP BY criado_em_data
      ORDER BY criado_em_data ASC
    `),
  ]);

  const k = kpis[0] || {};
  const agendamentos = Number(k.agendamentos || 0);
  const consultas = Number(k.consultas || 0);
  const pedidos = Number(k.pedidos_mtd || 0);
  const receita = Number(k.receita_mtd || 0);

  const txAgendamento = agendamentos > 0 ? (consultas / agendamentos) * 100 : 0;
  const txConsulta = consultas > 0 ? (pedidos / consultas) * 100 : 0;
  const txGlobal = agendamentos > 0 ? (pedidos / agendamentos) * 100 : 0;
  const receitaConsulta = consultas > 0 ? receita / consultas : 0;

  return NextResponse.json({
    kpis: {
      agendamentos,
      consultas,
      pedidos,
      receita,
      tx_agendamento_consulta: txAgendamento,
      tx_consulta_pedido: txConsulta,
      tx_global: txGlobal,
      receita_consulta: receitaConsulta,
    },
    funil: funil.map(r => ({
      etapa: r.etapa,
      valor: Number(r.valor),
      percentual: Number(r.percentual),
    })),
    conversaoPorUnidade: porUnidade.map((r: Record<string, unknown>) => ({
      unidade: String(r.unidade || 'N/A'),
      agendamentos: Number(r.agendamentos),
      consultas: Number(r.consultas),
      pedidos: Number(r.pedidos),
      receita: Number(r.receita),
      tx_agendamento: Number(r.agendamentos) > 0 ? (Number(r.consultas) / Number(r.agendamentos)) * 100 : 0,
      tx_consulta: Number(r.consultas) > 0 ? (Number(r.pedidos) / Number(r.consultas)) * 100 : 0,
    })),
    comparativoMensal: comparativoMensal.map(r => ({
      mes: r.mes,
      receita: Number(r.receita),
      tx_conversao: Number(r.tx_conversao || 0),
    })),
    conversaoDiaria: conversaoDiaria.map((r: Record<string, unknown>) => ({
      data: r.data,
      agendamentos: Number(r.agendamentos),
      consultas: Number(r.consultas),
      pedidos: Number(r.pedidos),
      tx_agendamento: Number(r.agendamentos) > 0 ? (Number(r.consultas) / Number(r.agendamentos)) * 100 : 0,
      tx_consulta: Number(r.consultas) > 0 ? (Number(r.pedidos) / Number(r.consultas)) * 100 : 0,
    })),
  });
}

async function getMargemData() {
  const [kpis, porMes, topItens, porStatus] = await Promise.all([

    // KPIs de Margem MTD
    runQuery(`
      SELECT
        ROUND(AVG(CASE WHEN DATE_TRUNC(criado_em_data,MONTH) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'),MONTH)
          THEN (valor_total - valor_total_unidade) * 100.0 / NULLIF(valor_total, 0) END), 2)           AS margem_media_pct,
        ROUND(AVG(CASE WHEN DATE_TRUNC(criado_em_data,MONTH) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'),MONTH)
          THEN valor_desconto END), 2)                                                                   AS desconto_medio,
        ROUND(AVG(CASE WHEN DATE_TRUNC(criado_em_data,MONTH) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'),MONTH)
          THEN valor_repasse_profissional END), 2)                                                       AS repasse_medio,
        COUNT(DISTINCT CASE WHEN DATE_TRUNC(criado_em_data,MONTH) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'),MONTH)
          THEN pedido_id END)                                                                             AS pedidos_mtd,
        SUM(CASE WHEN DATE_TRUNC(criado_em_data,MONTH) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'),MONTH)
          THEN valor_total END)                                                                           AS receita_total_mtd,
        SUM(CASE WHEN DATE_TRUNC(criado_em_data,MONTH) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'),MONTH)
          THEN valor_total - valor_total_unidade END)                                                    AS margem_total_mtd
      FROM \`${PROJECT}.${DS}.pedidos_venda\`
      WHERE status IN ('Nota Emitida', 'Pago')
        AND criado_em_data >= DATE_TRUNC(DATE_SUB(CURRENT_DATE('America/Sao_Paulo'),INTERVAL 1 MONTH),MONTH)
    `),

    // Margem por mês — últimos 12 meses
    runQuery(`
      SELECT
        FORMAT_DATE('%b/%y', DATE_TRUNC(criado_em_data, MONTH)) AS mes,
        EXTRACT(YEAR FROM DATE_TRUNC(criado_em_data, MONTH))   AS ano,
        EXTRACT(MONTH FROM DATE_TRUNC(criado_em_data, MONTH))  AS mes_num,
        ROUND(AVG((valor_total - valor_total_unidade) * 100.0 / NULLIF(valor_total, 0)), 2)          AS margem_pct,
        ROUND(AVG(valor_desconto), 2)                                                                     AS desconto_medio,
        ROUND(AVG(valor_repasse_profissional), 2)                                                          AS repasse_medio,
        COUNT(DISTINCT pedido_id)                                                                        AS pedidos,
        SUM(valor_total)                                                                                 AS receita
      FROM \`${PROJECT}.${DS}.pedidos_venda\`
      WHERE status IN ('Nota Emitida', 'Pago')
        AND criado_em_data >= DATE_SUB(CURRENT_DATE('America/Sao_Paulo'), INTERVAL 12 MONTH)
      GROUP BY DATE_TRUNC(criado_em_data, MONTH)
      ORDER BY ano ASC, mes_num ASC
    `),

    // Top 15 itens com maiores margens
    runQuery(`
      SELECT
        item_nome,
        COUNT(*)                                           AS qtde_vendas,
        ROUND(AVG((valor_total - valor_total_unidade) * 100.0 / NULLIF(valor_total, 0)), 2) AS margem_media_pct,
        ROUND(AVG(valor_total), 2)                         AS preco_medio,
        SUM(valor_total - valor_total_unidade)             AS margem_total
      FROM \`${PROJECT}.${DS}.pedidos_venda\`
      WHERE status IN ('Nota Emitida', 'Pago')
        AND DATE_TRUNC(criado_em_data, MONTH) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'), MONTH)
      GROUP BY item_nome
      ORDER BY margem_media_pct DESC
      LIMIT 15
    `),

    // Distribuição por status
    runQuery(`
      SELECT
        status,
        COUNT(DISTINCT pedido_id)          AS pedidos,
        SUM(valor_total)                   AS receita
      FROM \`${PROJECT}.${DS}.pedidos_venda\`
      WHERE DATE_TRUNC(criado_em_data, MONTH) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'), MONTH)
      GROUP BY status
      ORDER BY receita DESC
    `),
  ]);

  const k = kpis[0] || {};

  return NextResponse.json({
    kpis: {
      margem_media_pct:   Number(k.margem_media_pct || 0),
      desconto_medio:    Number(k.desconto_medio || 0),
      repasse_medio:      Number(k.repasse_medio || 0),
      pedidos_mtd:        Number(k.pedidos_mtd || 0),
      receita_total_mtd: Number(k.receita_total_mtd || 0),
      margem_total_mtd:  Number(k.margem_total_mtd || 0),
    },
    porMes: porMes.map(r => ({
      mes:          r.mes,
      margem_pct:   Number(r.margem_pct),
      desconto_medio: Number(r.desconto_medio),
      repasse_medio:   Number(r.repasse_medio),
      pedidos:      Number(r.pedidos),
      receita:      Number(r.receita),
    })),
    topItens: topItens.map(r => ({
      item:         r.item_nome || 'N/A',
      qtde:         Number(r.qtde_vendas),
      margem_pct:   Number(r.margem_media_pct),
      preco_medio:  Number(r.preco_medio),
      margem_total: Number(r.margem_total),
    })),
    porStatus: porStatus.map(r => ({
      status:   r.status || 'N/A',
      pedidos:  Number(r.pedidos),
      receita:  Number(r.receita),
    })),
  });
}
