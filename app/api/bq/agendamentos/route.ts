import { NextResponse } from 'next/server';
import { runQuery, BQ } from '@/lib/bigquery';

const PROJECT = BQ.PROJECT;
const DS = BQ.DATASET;

export async function GET() {
  try {
    const [kpis, porDia, porUnidade] = await Promise.all([

      runQuery(`
        SELECT
          COUNT(*) AS total_agendamentos,
          COUNTIF(status IN ('CONCLUÍDO','PAGO','COMPARECEU')) AS realizados
        FROM \`${PROJECT}.${DS}.agendamentos\`
        WHERE DATE(start_exec) >= DATE_TRUNC(DATE_SUB(CURRENT_DATE(),INTERVAL 1 MONTH),MONTH)
      `),

      runQuery(`
        SELECT
          DATE(start_exec) AS data,
          FORMAT_DATE('%d/%m', DATE(start_exec)) AS data_fmt,
          COUNT(*) AS total
        FROM \`${PROJECT}.${DS}.agendamentos\`
        WHERE DATE(start_exec) >= DATE_SUB(CURRENT_DATE(), INTERVAL 60 DAY)
          AND DATE(start_exec) < CURRENT_DATE()
        GROUP BY DATE(start_exec)
        ORDER BY data ASC
        LIMIT 60
      `),

      runQuery(`
        SELECT
          name_unit AS unidade,
          COUNT(*) AS total
        FROM \`${PROJECT}.${DS}.agendamentos\`
        WHERE DATE(start_exec) >= DATE_TRUNC(CURRENT_DATE(),MONTH)
        GROUP BY name_unit
        ORDER BY total DESC
        LIMIT 20
      `),
    ]);

    const k = kpis[0] || {};
    return NextResponse.json({
      kpis: {
        agendados_mtd: Number(k.total_agendamentos || 0),
        realizados_mtd: Number(k.realizados || 0),
      },
      porDia: (porDia as { data: string; data_fmt: string; total: number }[]).map(r => ({
        data: r.data_fmt,
        total: Number(r.total),
      })),
      porUnidade: (porUnidade as { unidade: string; total: number }[]).map(r => ({
        unidade: r.unidade,
        total: Number(r.total),
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}