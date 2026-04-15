'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import KPICard from '@/components/KPICard';
import { ConsultasChart, fmtNum, fmtPct } from '@/components/Charts';

interface ConsultasData {
  consultasMensal: { mes: string; realizadas: number; canceladas: number; no_show: number }[];
  kpis: { realizadas: number; canceladas: number; no_show: number; total: number }[];
  porUnidade: { unit_id: number; unidade: string; realizadas: number; canceladas: number; taxa_cancelamento: number }[];
}

export default function ConsultasPage() {
  const [data, setData] = useState<ConsultasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/bq/consultas')
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const kpis = data?.kpis?.[0];
  const taxaCancelamento = kpis && kpis.total > 0 ? (kpis.canceladas / kpis.total) * 100 : 0;
  const taxaNoShow = kpis && kpis.total > 0 ? (kpis.no_show / kpis.total) * 100 : 0;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <div className="header">
          <div className="header-left">
            <h1>📅 Consultas</h1>
            <p>Agendamentos, realizações e análise de cancelamentos</p>
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
            <KPICard label="Realizadas (mês)" value={fmtNum(kpis?.realizadas ?? 0)} icon="✅" iconColor="green" loading={loading} />
            <KPICard label="Canceladas (mês)" value={fmtNum(kpis?.canceladas ?? 0)} icon="❌" iconColor="orange" loading={loading} />
            <KPICard label="No-Show (mês)" value={fmtNum(kpis?.no_show ?? 0)} icon="🚫" iconColor="teal" loading={loading} />
            <KPICard label="Taxa de Cancelamento" value={loading ? '...' : fmtPct(taxaCancelamento)} icon="📉" iconColor="purple" loading={loading} />
            <KPICard label="Taxa de No-Show" value={loading ? '...' : fmtPct(taxaNoShow)} icon="🕐" iconColor="blue" loading={loading} />
          </div>

          <div className="charts-grid full">
            <div className="chart-card">
              <div className="chart-title">📈 Consultas por Mês</div>
              <div className="chart-subtitle">Realizadas vs Canceladas — últimos 12 meses</div>
              <ConsultasChart data={data?.consultasMensal ?? []} loading={loading} />
            </div>
          </div>

          <div className="data-table-wrapper">
            <div className="data-table-header">
              <div className="chart-title">🏥 Performance por Unidade</div>
              <div className="chart-subtitle">Consultas do mês atual</div>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Unidade</th>
                  <th>Realizadas</th>
                  <th>Canceladas</th>
                  <th>Taxa Cancel.</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 5 }).map((__, j) => (
                          <td key={j}><div className="skeleton" style={{ height: 14, width: '80%' }} /></td>
                        ))}
                      </tr>
                    ))
                  : (data?.porUnidade ?? []).map(u => (
                      <tr key={u.unit_id}>
                        <td><strong>{u.unidade}</strong></td>
                        <td>{fmtNum(u.realizadas)}</td>
                        <td>{fmtNum(u.canceladas)}</td>
                        <td>{fmtPct(u.taxa_cancelamento)}</td>
                        <td>
                          <span className={`tag ${u.taxa_cancelamento > 20 ? 'red' : u.taxa_cancelamento > 10 ? 'orange' : 'green'}`}>
                            {u.taxa_cancelamento > 20 ? '⚠ Alto' : u.taxa_cancelamento > 10 ? '~ Médio' : '✓ OK'}
                          </span>
                        </td>
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
