import { NextResponse } from 'next/server';
import { runQuery } from '@/lib/bigquery';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // VittaCard/VittaMais stats
    const vittaCard = await runQuery<{
      mes: string;
      contratos_ativos: number;
      novos_contratos: number;
      receita_estimada: number;
    }>(`
      SELECT 
        FORMAT_DATE('%Y-%m', DATE(vc.created_at)) as mes,
        COUNT(DISTINCT CASE WHEN vc.status = 1 THEN vc.id END) as contratos_ativos,
        COUNT(DISTINCT CASE WHEN FORMAT_DATE('%Y-%m', DATE(vc.created_at)) = FORMAT_DATE('%Y-%m', CURRENT_DATE()) THEN vc.id END) as novos_contratos,
        ROUND(COUNT(DISTINCT CASE WHEN vc.status = 1 THEN vc.id END) * 89.9, 2) as receita_estimada
      FROM \`high-nature-319701.vtntprod_vitta_core.vitta_cards\` vc
      WHERE DATE(vc.created_at) >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH)
        AND EXTRACT(YEAR FROM vc.created_at) BETWEEN 2020 AND 2030
      GROUP BY 1
      ORDER BY 1
    `);

    const kpis = await runQuery<{
      total_contratos: number;
      contratos_ativos: number;
      total_dependentes: number;
    }>(`
      SELECT 
        COUNT(DISTINCT id) as total_contratos,
        COUNT(DISTINCT CASE WHEN status = 1 THEN id END) as contratos_ativos,
        (SELECT COUNT(*) FROM \`high-nature-319701.vtntprod_vitta_core.vitta_card_dependents\`) as total_dependentes
      FROM \`high-nature-319701.vtntprod_vitta_core.vitta_cards\`
    `);

    return NextResponse.json({ ok: true, vittaCard, kpis });
  } catch (err) {
    console.error('BQ error:', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
