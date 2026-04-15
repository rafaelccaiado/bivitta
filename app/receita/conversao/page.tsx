'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import KPICard from '@/components/KPICard';
import { fmtMoney, fmtNum, fmtPct } from '@/components/Charts';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ComposedChart, Line,
} from 'recharts';

interface ConversaoData {
  kpis: {
    agendamentos: number;
    consultas: number;
    pedidos: number;
    receita: number;
    tx_agendamento_consulta: number;
    tx_consulta_pedido: number;
    tx_global: number;
    receita_consulta: number;
  };
  funil: { etapa: string; valor: number; percentual: number }[];
  conversaoPorUnidade: { unidade: string; agendamentos: number; consultas: number; pedidos: number; receita: number; tx_agendamento: number; tx_consulta: number }[];
  comparativoMensal: { mes: string; receita: number; tx_conversao: number }[];
  conversaoDiaria: { data: string; agendamentos: number; consultas: number; pedidos: number; tx_agendamento: number; tx_consulta: number }[];
}

const COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316','#ec4899'];
const FUNIL_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'];

const fmt = (v: number) => fmtMoney(v);
const fmtP = (v: number) => (v !== null && !isNaN(v) ? `${v.toFixed(1)}%` : '—');

export default function ConversaoPage() {
  const [data, setData] = useState<ConversaoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'unidade' | 'mensal' | 'diaria'>('unidade');

  useEffect(() => {
    fetch('/api/bq/receita?tipo=conversao')
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const k = data?.kpis;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <div className="header">
          <div className="header-left">
            <h1>📈 Receita e Conversão</h1>
            <p>Análise do funil de conversão — agendamentos → consultas → pedidos → receita</p>
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
            <KPICard
              label="Agendamentos"
              value={fmtNum(k?.agendamentos ?? 0)}
              icon="📅" iconColor="blue"
              loading={loading}
            />
            <KPICard
              label="Consultas"
              value={fmtNum(k?.consultas ?? 0)}
              icon="🩺" iconColor="purple"
              loading={loading}
            />
            <KPICard
              label="Pedidos"
              value={fmtNum(k?.pedidos ?? 0)}
              icon="📋" iconColor="green"
              loading={loading}
            />
            <KPICard
              label="Receita"
              value={fmt(k?.receita ?? 0)}
              icon="💰" iconColor="orange"
              loading={loading}
            />
          </div>

          <div className="kpi-grid" style={{ marginTop: 16 }}>
            <KPICard
              label="Taxa Agend → Consulta"
              value={fmtP(k?.tx_agendamento_consulta ?? 0)}
              icon="🎯" iconColor="blue"
              loading={loading}
            />
            <KPICard
              label="Taxa Consulta → Pedido"
              value={fmtP(k?.tx_consulta_pedido ?? 0)}
              icon="🎯" iconColor="purple"
              loading={loading}
            />
            <KPICard
              label="Taxa Global"
              value={fmtP(k?.tx_global ?? 0)}
              icon="🎯" iconColor="green"
              loading={loading}
            />
            <KPICard
              label="Receita por Consulta"
              value={fmt(k?.receita_consulta ?? 0)}
              icon="💵" iconColor="orange"
              loading={loading}
            />
          </div>

          <div className="chart-card" style={{ marginTop: 24 }}>
            <div className="chart-title">🔻 Funil de Conversão — MTD</div>
            <div className="chart-subtitle">Agendamentos → Consultas → Pedidos → Receita</div>
            {loading ? (
              <div className="skeleton" style={{ height: 280 }} />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data?.funil ?? []} layout="vertical" margin={{ top: 20, right: 30, left: 120, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={true} vertical={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="etapa" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip 
                    formatter={(value: any, name: any) => {
                      if (name === 'percentual') return [`${Number(value).toFixed(1)}%`, 'Taxa'];
                      return [name === 'valor' ? fmt(Number(value) || 0) : value, name === 'valor' ? 'Valor' : name];
                    }}
                    contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="valor" fill="#3b82f6" radius={[0,4,4,0]} name="Quantidade" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 24, marginBottom: 16 }}>
            {(['unidade', 'mensal', 'diaria'] as const).map(t => (
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
                {t === 'unidade' ? '🏥 Por Unidade' : t === 'mensal' ? '📆 Evolução Mensal' : '📅 Evolução Diária'}
              </button>
            ))}
          </div>

          {activeTab === 'unidade' && (
            <div className="data-table-wrapper">
              <div className="data-table-header">
                <div className="chart-title">🏥 Conversão por Unidade — MTD</div>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Unidade</th>
                    <th>Agendamentos</th>
                    <th>Consultas</th>
                    <th>Pedidos</th>
                    <th>Receita</th>
                    <th>Tx Agend→Cons</th>
                    <th>Tx Cons→Ped</th>
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i}>{Array.from({ length: 8 }).map((__, j) => (
                          <td key={j}><div className="skeleton" style={{ height: 14, width: '80%' }} /></td>
                        ))}</tr>
                      ))
                    : (data?.conversaoPorUnidade ?? []).map((u, i) => (
                        <tr key={u.unidade}>
                          <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                          <td><strong>{u.unidade}</strong></td>
                          <td>{fmtNum(u.agendamentos)}</td>
                          <td>{fmtNum(u.consultas)}</td>
                          <td>{fmtNum(u.pedidos)}</td>
                          <td className="text-money">{fmt(u.receita)}</td>
                          <td style={{ color: u.tx_agendamento >= 50 ? '#10b981' : u.tx_agendamento >= 30 ? '#f59e0b' : '#ef4444' }}>
                            {fmtP(u.tx_agendamento)}
                          </td>
                          <td style={{ color: u.tx_consulta >= 50 ? '#10b981' : u.tx_consulta >= 30 ? '#f59e0b' : '#ef4444' }}>
                            {fmtP(u.tx_consulta)}
                          </td>
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'mensal' && (
            <div className="chart-card">
              <div className="chart-title">📆 Receita vs Taxa de Conversão — Últimos 12 meses</div>
              <div className="chart-subtitle">Comparativo mensal de receita e taxa de conversão global</div>
              {loading ? (
                <div className="skeleton" style={{ height: 300 }} />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={data?.comparativoMensal ?? []} margin={{ top: 20, right: 16, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="rConv" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="left" tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} domain={[0, 30]} />
                    <Tooltip
                      formatter={(value: any, name: any) => [
                        name === 'receita' ? fmt(Number(value) || 0) : `${Number(value).toFixed(1)}%`,
                        name === 'receita' ? 'Receita' : 'Taxa Conversão',
                      ]}
                      contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }}
                    />
                    <Legend formatter={n => n === 'receita' ? 'Receita' : 'Taxa Conversão %'} />
                    <Bar yAxisId="left" dataKey="receita" fill="#3b82f6" radius={[3,3,0,0]} name="receita" />
                    <Line yAxisId="right" type="monotone" dataKey="tx_conversao" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} name="tx_conversao" />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          {activeTab === 'diaria' && (
            <div className="chart-card">
              <div className="chart-title">📅 Conversão Diária — Últimos 30 dias</div>
              <div className="chart-subtitle">Evolução diária de agendamentos, consultas e taxa de conversão</div>
              {loading ? (
                <div className="skeleton" style={{ height: 300 }} />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={data?.conversaoDiaria ?? []} margin={{ top: 20, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="data" tick={{ fontSize: 10 }} interval={4} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} domain={[0, 100]} />
                    <Tooltip
                      formatter={(value: any, name: any) => {
                        if (name.startsWith('tx_')) return [`${Number(value).toFixed(1)}%`, name === 'tx_agendamento' ? 'Tx Agend→Cons' : 'Tx Cons→Ped'];
                        return [fmtNum(Number(value) || 0), name === 'agendamentos' ? 'Agendamentos' : name === 'consultas' ? 'Consultas' : 'Pedidos'];
                      }}
                      contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="agendamentos" fill="#3b82f6" name="agendamentos" />
                    <Bar yAxisId="left" dataKey="consultas" fill="#8b5cf6" name="consultas" />
                    <Line yAxisId="right" type="monotone" dataKey="tx_agendamento" stroke="#10b981" strokeWidth={2} dot={false} name="Tx Agend→Cons" />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}