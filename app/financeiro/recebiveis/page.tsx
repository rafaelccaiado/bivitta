'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import KPICard from '@/components/KPICard';
import { fmtMoney, fmtNum } from '@/components/Charts';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface RecebiveisData {
  kpis: {
    total_a_receber: number;
    total_credito: number;
    total_debito: number;
    qtde_transacoes: number;
  };
  porFaixa: { faixa: string; valor: number; qtde: number }[];
  porDia: { data: string; valor: number; qtde: number }[];
  transacoes: { id: string; data: string; tipo: string; valor: number; status: string; estabelecimento: string }[];
}

export default function RecebiveisPage() {
  const [data, setData] = useState<RecebiveisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/bq/financeiro?tipo=recebiveis')
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); })
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
            <h1>💳 A Receber — Cartão de Crédito</h1>
            <p>Valores pendentes de recebimento por cartão</p>
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
              label="Total a Receber"
              value={fmtMoney(k?.total_a_receber ?? 0)}
              icon="💰" iconColor="blue"
              loading={loading}
            />
            <KPICard
              label="Cartão de Crédito"
              value={fmtMoney(k?.total_credito ?? 0)}
              icon="💳" iconColor="purple"
              loading={loading}
            />
            <KPICard
              label="Cartão de Débito"
              value={fmtMoney(k?.total_debito ?? 0)}
              icon="🏦" iconColor="orange"
              loading={loading}
            />
            <KPICard
              label="Transações Pendentes"
              value={fmtNum(k?.qtde_transacoes ?? 0)}
              icon="📋" iconColor="green"
              loading={loading}
            />
          </div>

          <div className="charts-grid">
            <div className="chart-card">
              <div className="chart-title">📊 Por Faixa de Dias</div>
              <div className="chart-subtitle">Valores a receber por vencimento</div>
              {loading ? (
                <div className="skeleton" style={{ height: 260 }} />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data?.porFaixa ?? []} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="faixa" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip
                      formatter={(v) => fmtMoney(Number(v))}
                      contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="valor" fill="#3b82f6" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="chart-card">
              <div className="chart-title">📅 Recebíveis por Dia — próximos 30 dias</div>
              <div className="chart-subtitle">Valor previsto de recebimento por data</div>
              {loading ? (
                <div className="skeleton" style={{ height: 260 }} />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data?.porDia ?? []} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="data" tick={{ fontSize: 10 }} tickFormatter={(v) => new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} interval={4} />
                    <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(v) => fmtMoney(Number(v))}
                      labelFormatter={(v) => new Date(v).toLocaleDateString('pt-BR')}
                      contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="valor" fill="#10b981" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="data-table-wrapper">
            <div className="data-table-header">
              <div className="chart-title">📋 Transações Pendentes</div>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Data Prevista</th>
                  <th>Tipo</th>
                  <th>Estabelecimento</th>
                  <th>Valor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>{Array.from({ length: 6 }).map((__, j) => (
                        <td key={j}><div className="skeleton" style={{ height: 14, width: '80%' }} /></td>
                      ))}</tr>
                    ))
                  : (data?.transacoes ?? []).map(t => (
                      <tr key={t.id}>
                        <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.id?.slice(-8) || '—'}</td>
                        <td>{t.data ? new Date(t.data).toLocaleDateString('pt-BR') : '—'}</td>
                        <td><strong>{t.tipo || '—'}</strong></td>
                        <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.estabelecimento || '—'}</td>
                        <td className="text-money">{fmtMoney(t.valor)}</td>
                        <td>
                          <span style={{
                            padding: '2px 8px', borderRadius: 4, fontSize: 11,
                            background: t.status === 'Pendente' ? '#fef3c7' : '#e0e7ff',
                            color: t.status === 'Pendente' ? '#92400e' : '#3730a3',
                          }}>
                            {t.status || 'Pendente'}
                          </span>
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