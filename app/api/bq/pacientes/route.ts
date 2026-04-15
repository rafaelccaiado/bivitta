import { NextResponse } from 'next/server';
import { runQuery, getBQConfig } from '@/lib/bigquery';

const { PROJECT, DATASET: DS } = getBQConfig();

export async function GET() {
  try {
    const kpis = await runQuery(`
      SELECT
        COUNT(*) AS total_pacientes
      FROM \`${PROJECT}.${DS}.patients\`
    `);

    return NextResponse.json({
      kpis: { total: Number(kpis[0]?.total_pacientes || 0) },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}