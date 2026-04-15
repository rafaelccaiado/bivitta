'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import KPICard from '@/components/KPICard';
import { fmtNum } from '@/components/Charts';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts';

interface AgendamentosData {
  kpis: {
    agendados_mtd: number;
    realizados_mtd: number;
    faltou_mtd: number;
    cancelados_mtd: number;
    conversao_pct: number;
    delta_pct: string | null;
    delta_label: string;
  };
  porDia: { data: string; total: number; realizados: number; faltou: number; cancelados: number }[];
  porCanal: { canal: string; total: number; realizados: number; conversao_pct: number }[];
  porUnidade: { unidade: string; total: number; realizados: number; faltou: number; conversao_pct: number }[];
  evolucao: { mes: string; total: number; realizados: number; conversao_pct: number }[];
  porDiaSemana: { dia: string; total: number; realizados: number }[];
  statusBreakdown: { status: string; total: number }[];
}

const COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316'];

export default function AgendamentosPage() {
  const [data, setData] = useState<AgendamentosData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'dia' | 'semana' | 'canal' | 'unidade' | 'evolucao'>('dia');

  useEffect(() => {
    fetch('/api/bq/agendamentos')
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const k = data?.kpis;
  const delta = k?.delta_pct ? Number(k.delta_pct) : undefined;
  const convPct = k?.conversao_pct ?? 0;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <div className="header">
          <div className="header-left">
            <h1>📅 Agendamentos</h1>
            <p>Volume, conversão e execução — {k?.delta_label ?? 'vs mesmo período mês ant.'}</p>
          </div>
          <div className="header-right">
            <span className="badge-live">Ao vivo</span>
          </div>
        </div>

        {error && (
          <div style={{ margin: '16px 24px', padding: 16, background: '#fee2e2', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>
            ❌ Erro: {error}
          </div>
        )}

        <div className="page-body">
          {/* KPI Cards */}
          <div className="kpi-grid">
            <KPICard label="Agendados MTD" value={fmtNum(k?.agendados_mtd ?? 0)} icon="📅" iconColor="blue" delta={delta} deltaLabel={k?.delta_label} loading={loading} />
            <KPICard label="Realizados MTD" value={fmtNum(k?.realizados_mtd ?? 0)} icon="✅" iconColor="green" loading={loading} />
            <KPICard label="Taxa de Conversão" value={`${convPct.toFixed(1)}%`} icon="🎯" iconColor="orange" loading={loading} />
            <KPICard label="Faltou / Cancelado" value={fmtNum((k?.faltou_mtd ?? 0) + (k?.cancelados_mtd ?? 0))} icon="❌" iconColor="purple" loading={loading} />
          </div>

          {/* Badge conversão */}
          <div style={{
            margin: '0 0 20px',
            padding: '12px 16px',
            borderRadius: 8,
            background: 'var(--surface-card)',
            display: 'flex',
            gap: 24,
            fontSize: 13,
            flexWrap: 'wrap',
          }}>
            {[
              { label: 'Realizados', value: k?.realizados_mtd ?? 0, color: '#10b981' },
              { label: 'Faltou', value: k?.faltou_mtd ?? 0, color: '#f59e0b' },
              { label: 'Cancelados', value: k?.cancelados_mtd ?? 0, color: '#ef4444' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
                <span style={{ color: 'var(--text-secondary)' }}>{item.label}: </span>
                <strong style={{ color: item.color }}>{fmtNum(item.value)}</strong>
                {k?.agendados_mtd! > 0 && (
                  <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                    ({((item.value / (k?.agendados_mtd ?? 1)) * 100).toFixed(1)}%)
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {([
              { key: 'dia', label: '📅 Por Dia' },
              { key: 'semana', label: '📊 Dia da Semana' },
              { key: 'canal', label: '📞 Por Canal' },
              { key: 'unidade', label: '🏥 Por Unidade' },
              { key: 'evolucao', label: '📈 Evolução' },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: tab === t.key ? 'var(--vitta-blue)' : 'var(--surface-card)',
                color: tab === t.key ? '#fff' : 'var(--text-secondary)',
                fontSize: 13, fontWeight: 500,
              }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Por Dia */}
          {tab === 'dia' && (
            <div className="chart-card" style={{ marginBottom: 24 }}>
              <div className="chart-title">📅 Agendamentos por Dia — últimos 60 dias</div>
              {loading ? <div className="skeleton" style={{ height: 280 }} /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data?.porDia ?? []} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="data" tick={{ fontSize: 10 }} interval={5} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }} />
                    <Legend />
                    <Bar dataKey="realizados" name="Realizados" fill="#10b981" radius={[3,3,0,0]} stackId="a" />
                    <Bar dataKey="faltou" name="Faltou" fill="#f59e0b" radius={[0,0,0,0]} stackId="a" />
                    <Bar dataKey="cancelados" name="Cancelados" fill="#ef4444" radius={[0,0,3,3]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          {/* Dia da Semana */}
          {tab === 'semana' && (
            <div className="chart-card" style={{ marginBottom: 24 }}>
              <div className="chart-title">📊 Agendamentos por Dia da Semana — 90 dias</div>
              {loading ? <div className="skeleton" style={{ height: 280 }} /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data?.porDiaSemana ?? []} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="realizados" name="Realizados" fill="#3b82f6" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          {/* Por Canal */}
          {tab === 'canal' && (
            <div className="charts-grid">
              <div className="chart-card">
                <div className="chart-title">📞 Volume por Canal — MTD</div>
                {loading ? <div className="skeleton" style={{ height: 280 }} /> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={data?.porCanal ?? []} dataKey="total" nameKey="canal" cx="50%" cy="50%" outerRadius={100}>
                        {(data?.porCanal ?? []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmtNum(Number(v) || 0)} contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr><th>Canal</th><th>Total</th><th>Realizados</th><th>Conversão</th></tr>
                  </thead>
                  <tbody>
                    {(data?.porCanal ?? []).map(c => (
                      <tr key={c.canal}>
                        <td><strong>{c.canal}</strong></td>
                        <td>{fmtNum(c.total)}</td>
                        <td>{fmtNum(c.realizados)}</td>
                        <td>
                          <span style={{ color: c.conversao_pct >= 55 ? '#10b981' : c.conversao_pct >= 40 ? '#f59e0b' : '#ef4444', fontWeight: 600 }}>
                            {c.conversao_pct.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Por Unidade */}
          {tab === 'unidade' && (
            <div className="data-table-wrapper">
              <div className="data-table-header">
                <div className="chart-title">🏥 Agendamentos por Unidade — MTD</div>
              </div>
              <table className="data-table">
                <thead>
                  <tr><th>Unidade</th><th>Total</th><th>Realizados</th><th>Faltou</th><th>Conversão</th></tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i}>{Array.from({ length: 5 }).map((__, j) => (
                          <td key={j}><div className="skeleton" style={{ height: 14, width: '80%' }} /></td>
                        ))}</tr>
                      ))
                    : (data?.porUnidade ?? []).map(u => (
                        <tr key={u.unidade}>
                          <td><strong>{u.unidade}</strong></td>
                          <td>{fmtNum(u.total)}</td>
                          <td>{fmtNum(u.realizados)}</td>
                          <td style={{ color: '#f59e0b' }}>{fmtNum(u.faltou)}</td>
                          <td>
                            <span style={{ color: u.conversao_pct >= 55 ? '#10b981' : u.conversao_pct >= 40 ? '#f59e0b' : '#ef4444', fontWeight: 600 }}>
                              {u.conversao_pct.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            </div>
          )}

          {/* Evolução */}
          {tab === 'evolucao' && (
            <div className="chart-card" style={{ marginBottom: 24 }}>
              <div className="chart-title">📈 Evolução Mensal — últimos 12 meses</div>
              {loading ? <div className="skeleton" style={{ height: 280 }} /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={data?.evolucao ?? []} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }} />
                    <Legend />
                    <Area type="monotone" dataKey="total" name="Agendados" stroke="#3b82f6" fill="url(#ag)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="realizados" name="Realizados" stroke="#10b981" fill="none" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
