import { NextResponse } from 'next/server';
import { runQuery } from '@/lib/bigquery';

const PROJECT = 'high-nature-319701';
const DS = 'vtntprod_vitta_core';

export async function GET() {
  try {
    const result = await runQuery(`
      SELECT 
        SUM(valor_total) as receita_total,
        COUNT(*) as total_pedidos
      FROM \`${PROJECT}.${DS}.pedidos_venda\`
      WHERE status IN ('Nota Emitida', 'Pago')
        AND DATE_TRUNC(criado_em_data, MONTH) = DATE_TRUNC(CURRENT_DATE(), MONTH)
    `);

    const k = result[0] || {};
    const receita = Number(k.receita_total || 0);
    const pedidos = Number(k.total_pedidos || 0);

    return NextResponse.json({
      kpis: {
        receita_mtd: receita,
        receita_liquida_mtd: receita * 0.7,
        pedidos_mtd: pedidos,
        ticket_medio: pedidos > 0 ? receita / pedidos : 0,
      },
      porUnidade: [],
      crescimento: [],
      porDia: [],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}