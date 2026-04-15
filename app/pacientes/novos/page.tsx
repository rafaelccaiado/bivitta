'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import KPICard from '@/components/KPICard';
import { fmtNum, fmtMes } from '@/components/Charts';

interface NovosPacientesData {
  kpis: {
    novos_mes: number;
    novos_mes_ant: number;
    taxa_conversao: number;
    delta_pct: string | null;
  };
  porMes: { mes: string; novos: number }[];
  detalhamento: {
    nome: string;
    unidade: string;
    data_cadastro: string;
    telefone: string;
    origem: string;
  }[];
  porOrigem: { origem: string; total: number }[];
}

function NovosChart({ data, loading }: { data: { mes: string; novos: number }[]; loading?: boolean }) {
  const { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } = require('recharts');

  if (loading) {
    return <div className="skeleton" style={{ height: 260 }} />;
  }

  const formatted = data.map(d => ({
    ...d,
    mes_fmt: fmtMes(d.mes),
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={formatted} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="mes_fmt" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1e2433',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            padding: '10px 14px',
            fontSize: 12,
            color: '#f1f5f9',
          }}
          formatter={(v: any) => [fmtNum(Number(v) || 0), 'Novos']}
        />
        <Bar dataKey="novos" fill="#059669" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function OrigemChart({ data, loading }: { data: { origem: string; total: number }[]; loading?: boolean }) {
  const { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } = require('recharts');

  if (loading) {
    return <div className="skeleton" style={{ height: 260 }} />;
  }

  const colors = ['#1a56db', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#0891b2'];

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="total"
          nameKey="origem"
          cx="50%"
          cy="50%"
          outerRadius={90}
          labelLine={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: '#1e2433',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            padding: '10px 14px',
            fontSize: 12,
            color: '#f1f5f9',
          }}
          formatter={(v: any) => [fmtNum(Number(v) || 0), 'Total']}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export default function NovosPacientesPage() {
  const [data, setData] = useState<NovosPacientesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/bq/pacientes/novos')
      .then(r => r.json())
      .then(d => { if (d.ok) setData(d); })
      .finally(() => setLoading(false));
  }, []);

  const kpis = data?.kpis;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <div className="header">
          <div className="header-left">
            <h1>✨ Novos Pacientes</h1>
            <p>Pacientes cadastrados neste mês</p>
          </div>
          <div className="header-right">
            <span className="badge-live">Ao vivo</span>
          </div>
        </div>

        <div className="page-body">
          <div className="kpi-grid">
            <KPICard 
              label="Novos este Mês" 
              value={fmtNum(kpis?.novos_mes ?? 0)} 
              icon="✨" 
              iconColor="green" 
              delta={kpis?.delta_pct ? parseFloat(kpis.delta_pct) : undefined}
              deltaLabel="vs mês anterior"
              loading={loading} 
            />
            <KPICard 
              label="Taxa de Conversão" 
              value={`${kpis?.taxa_conversao ?? 0}%`} 
              icon="📈" 
              iconColor="blue" 
              loading={loading} 
            />
            <KPICard 
              label="Novos Mês Anterior" 
              value={fmtNum(kpis?.novos_mes_ant ?? 0)} 
              icon="📅" 
              iconColor="purple" 
              loading={loading} 
            />
          </div>

          <div className="charts-grid">
            <div className="chart-card">
              <div className="chart-title">📊 Novos Cadastros por Mês</div>
              <div className="chart-subtitle">Últimos 12 meses</div>
              <NovosChart data={data?.porMes ?? []} loading={loading} />
            </div>
            <div className="chart-card">
              <div className="chart-title">🔍 Origem dos Pacientes</div>
              <div className="chart-subtitle">Últimos 90 dias</div>
              <OrigemChart data={data?.porOrigem ?? []} loading={loading} />
            </div>
          </div>

          <div className="data-table-wrapper">
            <div className="data-table-header">
              <div className="chart-title">📋 Novos Pacientes (Últimos 30 dias)</div>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Unidade</th>
                  <th>Data Cadastro</th>
                  <th>Telefone</th>
                  <th>Origem</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 5 }).map((__, j) => (
                          <td key={j}><div className="skeleton" style={{ height: 14, width: '80%' }} /></td>
                        ))}
                      </tr>
                    ))
                  : (data?.detalhamento ?? []).map((p, i) => (
                      <tr key={i}>
                        <td><strong>{p.nome}</strong></td>
                        <td>{p.unidade}</td>
                        <td>{p.data_cadastro}</td>
                        <td>{p.telefone}</td>
                        <td><span className="tag blue">{p.origem}</span></td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}