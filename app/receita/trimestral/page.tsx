'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import KPICard from '@/components/KPICard';
import { fmtMoney, fmtNum } from '@/components/Charts';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface ReceitaTrimestralData {
  kpis: {
    receita_qtd: number;
    receita_liquida_qtd: number;
    pedidos_qtd: number;
    ticket_medio: number;
    receita_tri_ant: number;
    receita_liq_tri_ant: number;
    pedidos_tri_ant: number;
    delta_qtd_pct: string | null;
    delta_label: string;
    trimestre_atual: string;
  };
  porMes: { mes: string; receita: number; receita_liq: number; pedidos: number; ticket_medio: number }[];
  porUnidade: { unidade: string; receita: number; receita_liq: number; pacientes: number; pedidos: number; ticket_medio: number }[];
  historico: { trimestre: string; receita: number; receita_liq: number; pedidos: number; crescimento_pct: number }[];
}

const fmt = (v: number) => fmtMoney(v);
const pct = (v: string | null) => (v !== null ? `${Number(v) > 0 ? '+' : ''}${v}%` : '—');
const isPositive = (v: string | null) => v !== null && Number(v) >= 0;

export default function ReceitaTrimestralPage() {
  const [data, setData] = useState<ReceitaTrimestralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/bq/receita?tipo=trimestral')
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const k = data?.kpis;
  const delta = k?.delta_qtd_pct ? Number(k.delta_qtd_pct) : undefined;
  const totalReceita = (data?.porUnidade ?? []).reduce((s, u) => s + u.receita, 0);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <div className="header">
          <div className="header-left">
            <h1>📊 Venda Trimestral — Valor</h1>
            <p>Faturamento trimestral — comparativo com trimestre anterior</p>
          </div>
          <div className="header-right">
            {k?.trimestre_atual && (
              <span className="badge-live">{k.trimestre_atual}</span>
            )}
          </div>
        </div>

        {error && (
          <div style={{ margin: '16px 24px', padding: 16, background: '#fee2e2', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>
            ❌ Erro: {error}
          </div>
        )}

        <div className="page-body">
          <div className="kpi-grid">
            <KPICard
              label="Receita do Trimestre"
              value={fmt(k?.receita_qtd ?? 0)}
              icon="💰" iconColor="blue"
              delta={delta}
              deltaLabel={k?.delta_label}
              loading={loading}
            />
            <KPICard
              label="Receita Líquida"
              value={fmt(k?.receita_liquida_qtd ?? 0)}
              icon="🏦" iconColor="green"
              loading={loading}
            />
            <KPICard
              label="Ticket Médio"
              value={fmt(k?.ticket_medio ?? 0)}
              icon="🎯" iconColor="orange"
              loading={loading}
            />
            <KPICard
              label="Pedidos do Trimestre"
              value={fmtNum(k?.pedidos_qtd ?? 0)}
              icon="📋" iconColor="purple"
              loading={loading}
            />
          </div>

          {k?.delta_qtd_pct && (
            <div style={{
              margin: '0 0 20px',
              padding: '10px 16px',
              borderRadius: 8,
              background: isPositive(k.delta_qtd_pct) ? '#d1fae5' : '#fee2e2',
              color: isPositive(k.delta_qtd_pct) ? '#065f46' : '#dc2626',
              fontSize: 13,
              display: 'flex',
              gap: 12,
              alignItems: 'center',
            }}>
              <span style={{ fontSize: 20 }}>{isPositive(k.delta_qtd_pct) ? '📈' : '📉'}</span>
              <span>
                <strong>{pct(k.delta_qtd_pct)}</strong> {k.delta_label} — Trimestre anterior: <strong>{fmt(k.receita_tri_ant)}</strong>
              </span>
            </div>
          )}

          <div className="charts-grid">
            <div className="chart-card">
              <div className="chart-title">📅 Receita por Mês — Trimestre Atual</div>
              <div className="chart-subtitle">Receita mensal do trimestre</div>
              {loading ? (
                <div className="skeleton" style={{ height: 260 }} />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data?.porMes ?? []} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(v: any, name: any) => [
                        name === 'receita' ? 'Receita' : 'Receita Líquida',
                      ]}
                      contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }}
                    />
                    <Legend formatter={n => n === 'receita' ? 'Receita Total' : 'Receita Líquida'} />
                    <Bar dataKey="receita" fill="#3b82f6" radius={[3,3,0,0]} name="Receita" />
                    <Bar dataKey="receita_liq" fill="#10b981" radius={[3,3,0,0]} name="Receita Líquida" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="chart-card">
              <div className="chart-title">📈 Evolução Trimestral — Últimos 8 trimestres</div>
              <div className="chart-subtitle">Receita por trimestre</div>
              {loading ? (
                <div className="skeleton" style={{ height: 260 }} />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={data?.historico ?? []} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="rTri" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="trimestre" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(v: any, name: any) => [
                        name === 'crescimento_pct' ? `${v}%` : fmt(Number(v) || 0),
                        name === 'receita' ? 'Receita' : name === 'receita_liq' ? 'Rec. Líquida' : 'Crescimento %',
                      ]}
                      contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="receita" stroke="#3b82f6" fill="url(#rTri)" strokeWidth={2} dot={{ r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="data-table-wrapper">
            <div className="data-table-header">
              <div className="chart-title">🏥 Receita por Unidade — Trimestre Atual</div>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Unidade</th>
                  <th>Receita Bruta</th>
                  <th>Receita Líquida</th>
                  <th>Pedidos</th>
                  <th>Pacientes</th>
                  <th>Ticket Médio</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}>{Array.from({ length: 8 }).map((__, j) => (
                        <td key={j}><div className="skeleton" style={{ height: 14, width: '80%' }} /></td>
                      ))}</tr>
                    ))
                  : (data?.porUnidade ?? []).map((u, i) => (
                      <tr key={u.unidade}>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                        <td><strong>{u.unidade}</strong></td>
                        <td className="text-money">{fmt(u.receita)}</td>
                        <td className="text-money">{fmt(u.receita_liq)}</td>
                        <td>{fmtNum(u.pedidos)}</td>
                        <td>{fmtNum(u.pacientes)}</td>
                        <td className="text-money">{fmt(u.ticket_medio)}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                              height: 6, borderRadius: 3, minWidth: 4,
                              width: `${Math.min((u.receita / totalReceita * 100), 100).toFixed(0)}%`,
                              background: '#3b82f6', maxWidth: 80,
                            }} />
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                              {totalReceita > 0 ? (u.receita / totalReceita * 100).toFixed(1) : 0}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}