'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import KPICard from '@/components/KPICard';
import { fmtMoney, fmtNum } from '@/components/Charts';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from 'recharts';

interface ReceitaData {
  kpis: {
    receita_mtd: number;
    receita_liquida_mtd: number;
    pedidos_mtd: number;
    ticket_medio: number;
    receita_mes_ant_completo: number;
    delta_mtd_pct: string | null;
    delta_label: string;
  };
  porDia: { data: string; receita: number; receita_liq: number; pedidos: number; ticket_medio: number }[];
  porUnidade: { unidade: string; receita: number; receita_liq: number; pacientes: number; pedidos: number; ticket_medio: number }[];
  porGrupo: { grupo: string; receita: number; itens: number; preco_medio: number }[];
  crescimento: { mes: string; receita: number; receita_liq: number; pedidos: number; crescimento_pct: number }[];
  ticketPorUnidade: { unidade: string; ticket: number; pedidos: number }[];
}

const COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316','#ec4899'];

const fmt = (v: number) => fmtMoney(v);
const pct = (v: string | null) => (v !== null ? `${Number(v) > 0 ? '+' : ''}${v}%` : '—');
const isPositive = (v: string | null) => v !== null && Number(v) >= 0;

export default function ReceitaPage() {
  const [data, setData] = useState<ReceitaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dia' | 'mes' | 'grupo'>('dia');

  useEffect(() => {
    fetch('/api/bq/receita')
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const k = data?.kpis;
  const delta = k?.delta_mtd_pct ? Number(k.delta_mtd_pct) : undefined;
  const totalReceita = (data?.porUnidade ?? []).reduce((s, u) => s + u.receita, 0);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <div className="header">
          <div className="header-left">
            <h1>💰 Receita</h1>
            <p>Faturamento e análise financeira — comparativo justo (mesmo período)</p>
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
            <KPICard
              label="Receita MTD"
              value={fmt(k?.receita_mtd ?? 0)}
              icon="💰" iconColor="blue"
              delta={delta}
              deltaLabel={k?.delta_label}
              loading={loading}
            />
            <KPICard
              label="Receita Líquida MTD"
              value={fmt(k?.receita_liquida_mtd ?? 0)}
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
              label="Pedidos MTD"
              value={fmtNum(k?.pedidos_mtd ?? 0)}
              icon="📋" iconColor="purple"
              loading={loading}
            />
          </div>

          {/* Delta badge */}
          {k?.delta_mtd_pct && (
            <div style={{
              margin: '0 0 20px',
              padding: '10px 16px',
              borderRadius: 8,
              background: isPositive(k.delta_mtd_pct) ? '#d1fae5' : '#fee2e2',
              color: isPositive(k.delta_mtd_pct) ? '#065f46' : '#dc2626',
              fontSize: 13,
              display: 'flex',
              gap: 12,
              alignItems: 'center',
            }}>
              <span style={{ fontSize: 20 }}>{isPositive(k.delta_mtd_pct) ? '📈' : '📉'}</span>
              <span>
                <strong>{pct(k.delta_mtd_pct)}</strong> {k.delta_label} —{' '}
                Mês anterior completo: <strong>{fmt(k.receita_mes_ant_completo)}</strong>
              </span>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {(['dia', 'mes', 'grupo'] as const).map(t => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                style={{
                  padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: activeTab === t ? 'var(--vitta-blue)' : 'var(--surface-card)',
                  color: activeTab === t ? '#fff' : 'var(--text-secondary)',
                  fontSize: 13, fontWeight: 500,
                }}
              >
                {t === 'dia' ? '📅 Por Dia' : t === 'mes' ? '📆 Evolução Mensal' : '🏷️ Por Grupo'}
              </button>
            ))}
          </div>

          {/* Chart por dia */}
          {activeTab === 'dia' && (
            <div className="chart-card" style={{ marginBottom: 24 }}>
              <div className="chart-title">📅 Receita por Dia — últimos 60 dias</div>
              <div className="chart-subtitle">Receita total e líquida diária</div>
              {loading ? (
                <div className="skeleton" style={{ height: 280 }} />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={data?.porDia ?? []} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="rT" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="rL" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="data" tick={{ fontSize: 10 }} interval={6} />
                    <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(v: any, name: any) => [fmt(Number(v) || 0), name === 'receita' ? 'Receita Total' : 'Receita Líquida']}
                      contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }}
                    />
                    <Legend formatter={n => n === 'receita' ? 'Receita Total' : 'Receita Líquida'} />
                    <Area type="monotone" dataKey="receita" stroke="#3b82f6" fill="url(#rT)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="receita_liq" stroke="#10b981" fill="url(#rL)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          {/* Chart evolução mensal */}
          {activeTab === 'mes' && (
            <div className="chart-card" style={{ marginBottom: 24 }}>
              <div className="chart-title">📆 Evolução Mensal — últimos 24 meses</div>
              <div className="chart-subtitle">Receita total mês a mês com crescimento %</div>
              {loading ? (
                <div className="skeleton" style={{ height: 280 }} />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data?.crescimento ?? []} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(v: any, name: any) => [
                        name === 'crescimento_pct' ? `${Number(v).toFixed(1)}%` : fmt(Number(v) || 0),
                        name === 'receita' ? 'Receita' : name === 'receita_liq' ? 'Rec. Líquida' : 'Crescimento %',
                      ]}
                      contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }}
                    />
                    <Legend formatter={n => n === 'receita' ? 'Receita Total' : 'Rec. Líquida'} />
                    <Bar dataKey="receita" fill="#3b82f6" radius={[3,3,0,0]} />
                    <Bar dataKey="receita_liq" fill="#10b981" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          {/* Chart por grupo */}
          {activeTab === 'grupo' && (
            <div className="charts-grid">
              <div className="chart-card">
                <div className="chart-title">🏷️ Receita por Grupo de Serviço — MTD</div>
                {loading ? (
                  <div className="skeleton" style={{ height: 250 }} />
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={data?.porGrupo ?? []} dataKey="receita" nameKey="grupo" cx="50%" cy="50%" outerRadius={90} label={({ percent }) => `${((Number(percent) || 0) * 100).toFixed(0)}%`} labelLine={false}>
                        {(data?.porGrupo ?? []).map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => fmt(Number(v) || 0)} contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="chart-card">
                <div className="chart-title">🎯 Ticket Médio por Unidade — 30 dias</div>
                {loading ? (
                  <div className="skeleton" style={{ height: 250 }} />
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={data?.ticketPorUnidade ?? []} layout="vertical" margin={{ left: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis type="number" tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="unidade" tick={{ fontSize: 10 }} width={120} />
                      <Tooltip formatter={(v) => fmt(Number(v) || 0)} contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="ticket" fill="#f59e0b" radius={[0,4,4,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}

          {/* Tabela por unidade */}
          <div className="data-table-wrapper">
            <div className="data-table-header">
              <div className="chart-title">🏥 Receita por Unidade — MTD</div>
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
                              background: COLORS[i % COLORS.length], maxWidth: 80,
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
