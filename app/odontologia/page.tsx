'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import KPICard from '@/components/KPICard';
import { fmtMoney, fmtNum } from '@/components/Charts';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, AreaChart, Area,
} from 'recharts';

interface OdontologiaData {
  kpis: {
    agendamentos_mtd: number;
    realizados_mtd: number;
    pacientes_mtd: number;
    receita_mtd: number;
    receita_liq_mtd: number;
    pedidos_mtd: number;
  };
  agendamentosMes: { data: string; agendamentos: number; realizados: number }[];
  evolucao: { mes: string; agendamentos: number; realizados: number; pacientes: number }[];
  porProcedimento: { procedimento: string; qtde: number; receita: number }[];
}

export default function OdontologiaPage() {
  const [data, setData] = useState<OdontologiaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/bq/odontologia')
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const k = data?.kpis;
  const convPct = k && k.agendamentos_mtd > 0 ? (k.realizados_mtd / k.agendamentos_mtd) * 100 : 0;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <div className="header">
          <div className="header-left">
            <h1>🦷 Odontologia</h1>
            <p>Agendamentos, vendas e procedimentos da área dental</p>
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
          <div className="kpi-grid">
            <KPICard label="Agendamentos MTD" value={fmtNum(k?.agendamentos_mtd ?? 0)} icon="🦷" iconColor="blue" loading={loading} />
            <KPICard label="Realizados MTD" value={fmtNum(k?.realizados_mtd ?? 0)} icon="✅" iconColor="green" loading={loading} />
            <KPICard label="Pacientes Únicos" value={fmtNum(k?.pacientes_mtd ?? 0)} icon="👤" iconColor="purple" loading={loading} />
            <KPICard label="Receita MTD" value={fmtMoney(k?.receita_mtd ?? 0)} icon="💰" iconColor="orange" loading={loading} />
          </div>

          {/* Conversão badge */}
          <div style={{
            margin: '0 0 20px',
            padding: '10px 16px',
            borderRadius: 8,
            background: 'var(--surface-card)',
            fontSize: 13,
            display: 'flex',
            gap: 20,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}>
            <span>🎯 Taxa de conversão: <strong style={{ color: convPct >= 55 ? '#10b981' : '#f59e0b' }}>{convPct.toFixed(1)}%</strong></span>
            <span>💰 Receita líquida: <strong>{fmtMoney(k?.receita_liq_mtd ?? 0)}</strong></span>
            <span>📋 Pedidos: <strong>{fmtNum(k?.pedidos_mtd ?? 0)}</strong></span>
          </div>

          <div className="charts-grid">
            {/* Agendamentos por dia */}
            <div className="chart-card">
              <div className="chart-title">📅 Agendamentos por Dia — 60 dias</div>
              {loading ? <div className="skeleton" style={{ height: 250 }} /> : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data?.agendamentosMes ?? []} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="data" tick={{ fontSize: 10 }} interval={6} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }} />
                    <Legend />
                    <Bar dataKey="agendamentos" name="Agendados" fill="#3b82f6" radius={[3,3,0,0]} />
                    <Bar dataKey="realizados" name="Realizados" fill="#10b981" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Evolução mensal */}
            <div className="chart-card">
              <div className="chart-title">📈 Evolução Mensal — 12 meses</div>
              {loading ? <div className="skeleton" style={{ height: 250 }} /> : (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={data?.evolucao ?? []} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="od1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }} />
                    <Legend />
                    <Area type="monotone" dataKey="agendamentos" name="Agendados" stroke="#3b82f6" fill="url(#od1)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="realizados" name="Realizados" stroke="#10b981" fill="none" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Tabela por procedimento */}
          <div className="data-table-wrapper" style={{ marginTop: 24 }}>
            <div className="data-table-header">
              <div className="chart-title">🏷️ Procedimentos Mais Vendidos — MTD</div>
            </div>
            <table className="data-table">
              <thead>
                <tr><th>#</th><th>Procedimento</th><th>Qtde</th><th>Receita</th></tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>{[1,2,3,4].map(j => (
                        <td key={j}><div className="skeleton" style={{ height: 14, width: '80%' }} /></td>
                      ))}</tr>
                    ))
                  : (data?.porProcedimento ?? []).map((p, i) => (
                      <tr key={p.procedimento}>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                        <td><strong>{p.procedimento}</strong></td>
                        <td>{fmtNum(p.qtde)}</td>
                        <td className="text-money">{fmtMoney(p.receita)}</td>
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
