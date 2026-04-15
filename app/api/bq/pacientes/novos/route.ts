import { NextResponse } from 'next/server';
import { runQuery } from '@/lib/bigquery';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [kpis, porMes, detalhamento, porOrigem] = await Promise.all([

      // KPIs novos pacientes
      runQuery<{
        novos_mes: number;
        novos_mes_ant: number;
        taxa_conversao: number;
      }>(`
        SELECT 
          COUNT(DISTINCT CASE WHEN DATE_TRUNC(criado_em_data, MONTH) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'), MONTH)
            THEN id END) AS novos_mes,
          COUNT(DISTINCT CASE WHEN DATE_TRUNC(criado_em_data, MONTH) = DATE_TRUNC(DATE_SUB(CURRENT_DATE('America/Sao_Paulo'), INTERVAL 1 MONTH), MONTH)
            THEN id END) AS novos_mes_ant,
          ROUND(
            COUNT(DISTINCT CASE WHEN DATE_TRUNC(criado_em_data, MONTH) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'), MONTH) AND status NOT IN ('Inativo')
              THEN id END) * 100.0 / NULLIF(COUNT(DISTINCT CASE WHEN DATE_TRUNC(criado_em_data, MONTH) = DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'), MONTH)
              THEN id END), 0), 1
          ) AS taxa_conversao
        FROM \`high-nature-319701.vtntprod_vitta_core.patients\`
        WHERE EXTRACT(YEAR FROM criado_em_data) BETWEEN 2020 AND 2030
      `),

      // Novos cadastros por mês (últimos 12 meses)
      runQuery<{
        mes: string;
        novos: number;
      }>(`
        SELECT 
          FORMAT_DATE('%Y-%m', DATE_TRUNC(criado_em_data, MONTH)) AS mes,
          COUNT(DISTINCT id) AS novos
        FROM \`high-nature-319701.vtntprod_vitta_core.patients\`
        WHERE criado_em_data >= DATE_SUB(DATE_TRUNC(CURRENT_DATE('America/Sao_Paulo'), MONTH), INTERVAL 12 MONTH)
          AND EXTRACT(YEAR FROM criado_em_data) BETWEEN 2020 AND 2030
        GROUP BY 1
        ORDER BY 1
      `),

      // Detalhamento pacientes novos (últimos 30 dias)
      runQuery<{
        nome: string;
        unidade: string;
        data_cadastro: string;
        telefone: string;
        origem: string;
      }>(`
        SELECT 
          nome AS nome,
          COALESCE(unidade, 'Não identificada') AS unidade,
          FORMAT_DATE('%d/%m/%Y', DATE(criado_em_data)) AS data_cadastro,
          COALESCE(telefone_principal, telefone) AS telefone,
          COALESCE(origem, 'Não informada') AS origem
        FROM \`high-nature-319701.vtntprod_vitta_core.patients\`
        WHERE criado_em_data >= DATE_SUB(CURRENT_DATE('America/Sao_Paulo'), INTERVAL 30 DAY)
          AND EXTRACT(YEAR FROM criado_em_data) BETWEEN 2020 AND 2030
        ORDER BY criado_em_data DESC
        LIMIT 100
      `),

      // Origem dos pacientes
      runQuery<{
        origem: string;
        total: number;
      }>(`
        SELECT 
          COALESCE(origem, 'Não informada') AS origem,
          COUNT(DISTINCT id) AS total
        FROM \`high-nature-319701.vtntprod_vitta_core.patients\`
        WHERE criado_em_data >= DATE_SUB(CURRENT_DATE('America/Sao_Paulo'), INTERVAL 90 DAY)
          AND EXTRACT(YEAR FROM criado_em_data) BETWEEN 2020 AND 2030
        GROUP BY 1
        ORDER BY 2 DESC
      `),
    ]);

    const k = kpis[0] || {};
    const novosMes = Number(k.novos_mes || 0);
    const novosMesAnt = Number(k.novos_mes_ant || 0);
    const delta = novosMesAnt > 0
      ? ((novosMes - novosMesAnt) / novosMesAnt * 100).toFixed(1)
      : null;

    return NextResponse.json({
      ok: true,
      kpis: {
        novos_mes: novosMes,
        novos_mes_ant: novosMesAnt,
        taxa_conversao: Number(k.taxa_conversao || 0),
        delta_pct: delta,
      },
      porMes: porMes.map(r => ({
        mes: r.mes,
        novos: Number(r.novos),
      })),
      detalhamento: detalhamento.map(r => ({
        nome: r.nome,
        unidade: r.unidade,
        data_cadastro: r.data_cadastro,
        telefone: r.telefone,
        origem: r.origem,
      })),
      porOrigem: porOrigem.map(r => ({
        origem: r.origem,
        total: Number(r.total),
      })),
    });
  } catch (err) {
    console.error('BQ error:', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}