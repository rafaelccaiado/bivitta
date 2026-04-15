import { NextResponse } from 'next/server';
import { runQuery } from '@/lib/bigquery';

const PROJECT = 'high-nature-319701';
const DS = 'vtntprod_vitta_core';

export async function GET() {
  try {
    // KPIs principais
    const kpis = await runQuery(`
      SELECT 
        SUM(valor_total) as receita_total,
        COUNT(*) as total_pedidos
      FROM \`${PROJECT}.${DS}.pedidos_venda\`
      WHERE status IN ('Nota Emitida', 'Pago')
        AND DATE_TRUNC(criado_em_data, MONTH) = DATE_TRUNC(CURRENT_DATE(), MONTH)
    `);

    // Por unidade
    const porUnidade = await runQuery(`
      SELECT 
        name_unit as unidade,
        SUM(valor_total) as receita,
        COUNT(*) as pedidos
      FROM \`${PROJECT}.${DS}.pedidos_venda\`
      WHERE status IN ('Nota Emitida', 'Pago')
        AND DATE_TRUNC(criado_em_data, MONTH) = DATE_TRUNC(CURRENT_DATE(), MONTH)
      GROUP BY name_unit
      ORDER BY receita DESC
      LIMIT 20
    `);

    // Evolução mensal
    const crescimento = await runQuery(`
      SELECT 
        FORMAT_DATE('%b/%y', DATE_TRUNC(criado_em_data, MONTH)) as mes,
        SUM(valor_total) as receita,
        COUNT(*) as pedidos
      FROM \`${PROJECT}.${DS}.pedidos_venda\`
      WHERE status IN ('Nota Emitida', 'Pago')
        AND criado_em_data >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH)
      GROUP BY FORMAT_DATE('%b/%y', DATE_TRUNC(criado_em_data, MONTH))
      ORDER BY MIN(criado_em_data) ASC
    `);

    // Por dia (últimos 30 dias)
    const porDia = await runQuery(`
      SELECT 
        FORMAT_DATE('%d/%m', criado_em_data) as data,
        SUM(valor_total) as receita,
        COUNT(*) as pedidos
      FROM \`${PROJECT}.${DS}.pedidos_venda\`
      WHERE status IN ('Nota Emitida', 'Pago')
        AND criado_em_data >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
      GROUP BY FORMAT_DATE('%d/%m', criado_em_data), DATE(criado_em_data)
      ORDER BY DATE(criado_em_data) ASC
    `);

    // Por grupo
    const porGrupo = await runQuery(`
      SELECT 
        COALESCE(grupo_item, 'Outros') as grupo,
        SUM(valor_total) as receita,
        COUNT(*) as itens
      FROM \`${PROJECT}.${DS}.pedidos_venda\`
      WHERE status IN ('Nota Emitida', 'Pago')
        AND DATE_TRUNC(criado_em_data, MONTH) = DATE_TRUNC(CURRENT_DATE(), MONTH)
      GROUP BY grupo_item
      ORDER BY receita DESC
      LIMIT 15
    `);

    // Mês anterior
    const mesAnterior = await runQuery(`
      SELECT SUM(valor_total) as receita
      FROM \`${PROJECT}.${DS}.pedidos_venda\`
      WHERE status IN ('Nota Emitida', 'Pago')
        AND DATE_TRUNC(criado_em_data, MONTH) = DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH), MONTH)
    `);

    const k = kpis[0] || {};
    const receita = Number(k.receita_total || 0);
    const pedidos = Number(k.total_pedidos || 0);
    const receitaAnt = Number(mesAnterior[0]?.receita || 0);
    const delta = receitaAnt > 0 ? ((receita - receitaAnt) / receitaAnt * 100).toFixed(1) : null;

    return NextResponse.json({
      kpis: {
        receita_mtd: receita,
        receita_liquida_mtd: receita * 0.7,
        pedidos_mtd: pedidos,
        ticket_medio: pedidos > 0 ? receita / pedidos : 0,
        receita_mes_ant_completo: receitaAnt,
        delta_mtd_pct: delta,
        delta_label: delta ? (Number(delta) >= 0 ? 'crescimento' : 'queda') : null,
      },
      porDia: porDia.map((r: any) => ({
        data: r.data,
        receita: Number(r.receita),
        receita_liq: Number(r.receita) * 0.7,
        pedidos: Number(r.pedidos),
        ticket_medio: Number(r.pedidos) > 0 ? Number(r.receita) / Number(r.pedidos) : 0,
      })),
      porUnidade: porUnidade.map((r: any) => ({
        unidade: r.unidade,
        receita: Number(r.receita),
        receita_liq: Number(r.receita) * 0.7,
        pedidos: Number(r.pedidos),
        ticket_medio: Number(r.pedidos) > 0 ? Number(r.receita) / Number(r.pedidos) : 0,
        pacientes: 0,
      })),
      porGrupo: porGrupo.map((r: any) => ({
        grupo: r.grupo,
        receita: Number(r.receita),
        itens: Number(r.itens),
        preco_medio: Number(r.itens) > 0 ? Number(r.receita) / Number(r.itens) : 0,
      })),
      crescimento: crescimento.map((r: any) => ({
        mes: r.mes,
        receita: Number(r.receita),
        receita_liq: Number(r.receita) * 0.7,
        pedidos: Number(r.pedidos),
        crescimento_pct: 0,
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}