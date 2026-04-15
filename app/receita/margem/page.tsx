'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import KPICard from '@/components/KPICard';
import { fmtMoney, fmtNum } from '@/components/Charts';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { PieChart, Pie, Cell } from 'recharts';

interface MargemData {
  kpis: {
    margem_media_pct: number;
    desconto_medio: number;
    repasse_medio: number;
    pedidos_mtd: number;
    receita_total_mtd: number;
    margem_total_mtd: number;
  };
  porMes: { mes: string; margem_pct: number; desconto_medio: number; repasse_medio: number; pedidos: number; receita: number }[];
  topItens: { item: string; qtde: number; margem_pct: number; preco_medio: number; margem_total: number }[];
  porStatus: { status: string; pedidos: number; receita: number }[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function MargemPage() {
  const [data, setData] = useState<MargemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/bq/receita?tipo=margem')
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const k = data?.kpis;
  const totalReceita = (data?.porStatus ?? []).reduce((s, s_) => s + s_.receita, 0);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <div className="header">
          <div className="header-left">
            <h1>📊 Qtde Pedidos e Margem Itens</h1>
            <p>Análise de margem, desconto e repasse profissional</p>
          </div>
          <div className="header-right">
            <span className="badge-live">MTD</span>
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
              label="Margem Média"
              value={`${(k?.margem_media_pct ?? 0).toFixed(1)}%`}
              icon="📈" iconColor="green"
              loading={loading}
            />
            <KPICard
              label="Desconto Médio"
              value={fmtMoney(k?.desconto_medio ?? 0)}
              icon="🏷️" iconColor="orange"
              loading={loading}
            />
            <KPICard
              label="Repasse Profissional"
              value={fmtMoney(k?.repasse_medio ?? 0)}
              icon="👨‍⚕️" iconColor="purple"
              loading={loading}
            />
            <KPICard
              label="Pedidos MTD"
              value={fmtNum(k?.pedidos_mtd ?? 0)}
              icon="📋" iconColor="blue"
              loading={loading}
            />
          </div>

          <div className="charts-grid">
            <div className="chart-card">
              <div className="chart-title">📅 Evolução da Margem — Últimos 12 meses</div>
              <div className="chart-subtitle">Margem média mensal</div>
              {loading ? (
                <div className="skeleton" style={{ height: 260 }} />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={data?.porMes ?? []} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} domain={[0, 'auto']} />
                    <Tooltip
                      formatter={(v: any, name: any) => [
                        name === 'margem_pct' ? `${v}%` : fmtMoney(v),
                        name === 'margem_pct' ? 'Margem %' : name === 'desconto_medio' ? 'Desconto' : 'Repasse',
                      ]}
                      contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="margem_pct" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} name="Margem %" />
                    <Line type="monotone" dataKey="desconto_medio" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="Desconto" />
                    <Line type="monotone" dataKey="repasse_medio" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} name="Repasse" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="chart-card">
              <div className="chart-title">📊 Distribuição por Status</div>
              <div className="chart-subtitle">Receita por status do pedido</div>
              {loading ? (
                <div className="skeleton" style={{ height: 260 }} />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={data?.porStatus ?? []}
                      dataKey="receita"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ name, percent }) => `${name}: ${((Number(percent) || 0) * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {(data?.porStatus ?? []).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => [fmtMoney(Number(v) || 0), 'Receita']}
                      contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="data-table-wrapper">
            <div className="data-table-header">
              <div className="chart-title">🏆 Itens com Maiores Margens — Mês Atual</div>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item</th>
                  <th>Qtde Vendas</th>
                  <th>Margem %</th>
                  <th>Preço Médio</th>
                  <th>Margem Total</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 10 }).map((_, i) => (
                      <tr key={i}>{Array.from({ length: 6 }).map((__, j) => (
                        <td key={j}><div className="skeleton" style={{ height: 14, width: '80%' }} /></td>
                      ))}</tr>
                    ))
                  : (data?.topItens ?? []).map((item, i) => (
                      <tr key={item.item}>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                        <td><strong>{item.item}</strong></td>
                        <td>{fmtNum(item.qtde)}</td>
                        <td style={{ color: '#10b981', fontWeight: 600 }}>{item.margem_pct}%</td>
                        <td className="text-money">{fmtMoney(item.preco_medio)}</td>
                        <td className="text-money">{fmtMoney(item.margem_total)}</td>
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