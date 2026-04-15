'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import KPICard from '@/components/KPICard';
import { fmtMoney, fmtNum } from '@/components/Charts';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from 'recharts';

interface FinanceiroData {
  recebiveis: {
    a_receber_credito: number;
    a_receber_debito: number;
    total_a_receber: number;
    qtde_transacoes: number;
    proxima_data: string | null;
  };
  recebimentos: {
    recebido_mtd: number;
    recebido_mes_ant: number;
    transacoes_mtd: number;
    delta_pct: string | null;
  };
  evolucao: { mes: string; recebido: number; transacoes: number }[];
  porFormaPagamento: { forma: string; valor: number; transacoes: number }[];
}

const COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444'];

export default function FinanceiroPage() {
  const [data, setData] = useState<FinanceiroData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/bq/financeiro')
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const rv = data?.recebiveis;
  const rc = data?.recebimentos;
  const delta = rc?.delta_pct ? Number(rc.delta_pct) : undefined;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <div className="header">
          <div className="header-left">
            <h1>💳 Financeiro</h1>
            <p>Recebíveis pendentes e recebimentos realizados</p>
          </div>
          <div className="header-right">
            <span className="badge-live">Ao vivo</span>
          </div>
        </div>

        {error && (
          <div style={{ margin: '16px 24px', padding: 16, background: '#fee2e2', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>
            ❌ Erro ao carregar dados financeiros — as tabelas vittanet_vittapag podem não estar disponíveis: {error}
          </div>
        )}

        <div className="page-body">
          {/* A Receber */}
          <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            A RECEBER
          </div>
          <div className="kpi-grid" style={{ marginBottom: 24 }}>
            <KPICard label="Total a Receber" value={fmtMoney(rv?.total_a_receber ?? 0)} icon="💳" iconColor="blue" loading={loading} />
            <KPICard label="Cartão de Crédito" value={fmtMoney(rv?.a_receber_credito ?? 0)} icon="💰" iconColor="purple" loading={loading} />
            <KPICard label="Cartão de Débito" value={fmtMoney(rv?.a_receber_debito ?? 0)} icon="🏦" iconColor="orange" loading={loading} />
            <KPICard label="Transações Pendentes" value={fmtNum(rv?.qtde_transacoes ?? 0)} icon="📋" iconColor="green" loading={loading} />
          </div>

          {rv?.proxima_data && (
            <div style={{
              marginBottom: 20, padding: '10px 16px', borderRadius: 8,
              background: '#fffbeb', color: '#78350f', fontSize: 13,
            }}>
              📅 Próximo recebimento previsto: <strong>{rv.proxima_data}</strong>
            </div>
          )}

          {/* Recebimentos */}
          <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            RECEBIMENTOS DO MÊS
          </div>
          <div className="kpi-grid" style={{ marginBottom: 24 }}>
            <KPICard
              label="Recebido MTD"
              value={fmtMoney(rc?.recebido_mtd ?? 0)}
              icon="✅" iconColor="green"
              delta={delta}
              deltaLabel="vs mês anterior"
              loading={loading}
            />
            <KPICard label="Mês Anterior" value={fmtMoney(rc?.recebido_mes_ant ?? 0)} icon="📅" iconColor="blue" loading={loading} />
            <KPICard label="Transações MTD" value={fmtNum(rc?.transacoes_mtd ?? 0)} icon="📋" iconColor="purple" loading={loading} />
          </div>

          <div className="charts-grid">
            {/* Evolução */}
            <div className="chart-card">
              <div className="chart-title">📈 Evolução de Recebimentos — 12 meses</div>
              {loading ? <div className="skeleton" style={{ height: 260 }} /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data?.evolucao ?? []} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(v) => fmtMoney(Number(v) || 0)}
                      contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="recebido" name="Recebido" fill="#10b981" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Por forma de pagamento */}
            <div className="chart-card">
              <div className="chart-title">🏷️ Por Forma de Pagamento — MTD</div>
              {loading ? <div className="skeleton" style={{ height: 260 }} /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={data?.porFormaPagamento ?? []}
                      dataKey="valor"
                      nameKey="forma"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ percent }) => `${((Number(percent) || 0) * 100).toFixed(0)}%`}
                    >
                      {(data?.porFormaPagamento ?? []).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => fmtMoney(Number(v) || 0)}
                      contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Tabela por forma */}
          <div className="data-table-wrapper" style={{ marginTop: 24 }}>
            <div className="data-table-header">
              <div className="chart-title">💳 Detalhamento por Forma de Pagamento — MTD</div>
            </div>
            <table className="data-table">
              <thead>
                <tr><th>Forma de Pagamento</th><th>Valor Recebido</th><th>Transações</th><th>Ticket Médio</th></tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>{[1,2,3,4].map(j => (
                        <td key={j}><div className="skeleton" style={{ height: 14, width: '80%' }} /></td>
                      ))}</tr>
                    ))
                  : (data?.porFormaPagamento ?? []).map(f => (
                      <tr key={f.forma}>
                        <td><strong>{f.forma}</strong></td>
                        <td className="text-money">{fmtMoney(f.valor)}</td>
                        <td>{fmtNum(f.transacoes)}</td>
                        <td className="text-money">{fmtMoney(f.transacoes > 0 ? f.valor / f.transacoes : 0)}</td>
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
