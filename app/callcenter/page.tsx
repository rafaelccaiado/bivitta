'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import KPICard from '@/components/KPICard';
import { fmtMoney, fmtNum } from '@/components/Charts';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, AreaChart, Area,
} from 'recharts';

interface CallCenterData {
  kpisHoje: { agendados_hoje: number; atendentes_ativos_hoje: number };
  kpisMes: { ligacoes_mtd: number; realizados_mtd: number; atendentes_mtd: number; media_dia: number };
  rankingAtendentes: { atendente: string; agendamentos: number; realizados: number; conversao_pct: number; media_dia: number }[];
  evolucao: { mes: string; total: number; via_callcenter: number; via_whatsapp: number; via_app: number }[];
  porCanal: { canal: string; total: number }[];
}

export default function CallCenterPage() {
  const [data, setData] = useState<CallCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/bq/callcenter')
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const hj = data?.kpisHoje;
  const ms = data?.kpisMes;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <div className="header">
          <div className="header-left">
            <h1>📞 Call Center</h1>
            <p>Agendamentos via telefone, ranking de atendentes e evolução por canal</p>
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
          {/* KPIs do dia */}
          <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            HOJE
          </div>
          <div className="kpi-grid" style={{ marginBottom: 24 }}>
            <KPICard label="Agendamentos Hoje" value={fmtNum(hj?.agendados_hoje ?? 0)} icon="📞" iconColor="blue" loading={loading} />
            <KPICard label="Atendentes Ativos" value={fmtNum(hj?.atendentes_ativos_hoje ?? 0)} icon="👤" iconColor="green" loading={loading} />
            <KPICard label="Agendamentos MTD" value={fmtNum(ms?.ligacoes_mtd ?? 0)} icon="📅" iconColor="purple" loading={loading} />
            <KPICard label="Média / Dia" value={fmtNum(ms?.media_dia ?? 0)} icon="📊" iconColor="orange" loading={loading} />
          </div>

          {/* Ranking Atendentes */}
          <div className="data-table-wrapper" style={{ marginBottom: 24 }}>
            <div className="data-table-header">
              <div className="chart-title">🏆 Ranking de Atendentes — MTD</div>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Atendente</th>
                  <th>Agendamentos</th>
                  <th>Realizados</th>
                  <th>Conversão</th>
                  <th>Média/Dia</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>{Array.from({ length: 6 }).map((__, j) => (
                        <td key={j}><div className="skeleton" style={{ height: 14, width: '80%' }} /></td>
                      ))}</tr>
                    ))
                  : (data?.rankingAtendentes ?? []).map((a, i) => (
                      <tr key={a.atendente}>
                        <td>
                          <span style={{
                            fontWeight: 700,
                            color: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : 'var(--text-muted)',
                          }}>
                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                          </span>
                        </td>
                        <td><strong>{a.atendente}</strong></td>
                        <td>{fmtNum(a.agendamentos)}</td>
                        <td>{fmtNum(a.realizados)}</td>
                        <td>
                          <span style={{
                            color: a.conversao_pct >= 60 ? '#10b981' : a.conversao_pct >= 40 ? '#f59e0b' : '#ef4444',
                            fontWeight: 600,
                          }}>
                            {a.conversao_pct.toFixed(1)}%
                          </span>
                        </td>
                        <td>{a.media_dia.toFixed(1)}</td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>

          {/* Gráfico evolução */}
          <div className="chart-card">
            <div className="chart-title">📈 Evolução de Agendamentos por Canal — 12 meses</div>
            <div className="chart-subtitle">Distribuição Call Center × WhatsApp × App</div>
            {loading ? <div className="skeleton" style={{ height: 280 }} /> : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={data?.evolucao ?? []} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <defs>
                    {['#3b82f6','#10b981','#f59e0b'].map((c, i) => (
                      <linearGradient key={i} id={`cc${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={c} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={c} stopOpacity={0}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }} />
                  <Legend />
                  <Area type="monotone" dataKey="total" name="Total" stroke="#64748b" fill="none" strokeWidth={1} strokeDasharray="4 4" dot={false} />
                  <Area type="monotone" dataKey="via_callcenter" name="Call Center" stroke="#3b82f6" fill="url(#cc0)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="via_whatsapp" name="WhatsApp" stroke="#10b981" fill="url(#cc1)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="via_app" name="App/Online" stroke="#f59e0b" fill="url(#cc2)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
