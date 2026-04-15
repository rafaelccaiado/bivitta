'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import KPICard from '@/components/KPICard';
import { PacientesChart, fmtNum } from '@/components/Charts';

interface PacientesData {
  pacientesMensal: { mes: string; novos: number; recorrentes: number; total: number }[];
  kpis: { total_base: number; ativos_30d: number; ativos_90d: number; novos_mes: number }[];
}

export default function PacientesPage() {
  const [data, setData] = useState<PacientesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/bq/pacientes')
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const kpis = data?.kpis?.[0];

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <div className="header">
          <div className="header-left">
            <h1>👥 Pacientes</h1>
            <p>Base de pacientes, novos vs recorrentes, engajamento</p>
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
            <KPICard label="Base Total" value={fmtNum(kpis?.total_base ?? 0)} icon="🗄️" iconColor="blue" loading={loading} />
            <KPICard label="Ativos (30 dias)" value={fmtNum(kpis?.ativos_30d ?? 0)} icon="🟢" iconColor="green" loading={loading} />
            <KPICard label="Ativos (90 dias)" value={fmtNum(kpis?.ativos_90d ?? 0)} icon="🔵" iconColor="teal" loading={loading} />
            <KPICard label="Novos este Mês" value={fmtNum(kpis?.novos_mes ?? 0)} icon="✨" iconColor="purple" loading={loading} />
          </div>

          <div className="charts-grid full">
            <div className="chart-card">
              <div className="chart-title">📊 Novos vs Recorrentes por Mês</div>
              <div className="chart-subtitle">Últimos 12 meses — pacientes únicos por tipo</div>
              <PacientesChart data={data?.pacientesMensal ?? []} loading={loading} />
            </div>
          </div>

          <div className="data-table-wrapper">
            <div className="data-table-header">
              <div className="chart-title">📋 Aquisição Mensal</div>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mês</th>
                  <th>Novos</th>
                  <th>Recorrentes</th>
                  <th>Total</th>
                  <th>Taxa de Retenção</th>
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
                  : [...(data?.pacientesMensal ?? [])].reverse().map((m, i) => {
                      const ret = m.total > 0 ? (m.recorrentes / m.total) * 100 : 0;
                      const [y, mo] = m.mes.split('-');
                      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                      const label = `${months[parseInt(mo) - 1]}/${y.slice(2)}`;
                      return (
                        <tr key={i}>
                          <td>{label}</td>
                          <td><span className="tag green">+{fmtNum(m.novos)}</span></td>
                          <td>{fmtNum(m.recorrentes)}</td>
                          <td><strong>{fmtNum(m.total)}</strong></td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{
                                height: 6,
                                width: `${ret.toFixed(0)}%`,
                                background: 'var(--vitta-green)',
                                borderRadius: 3,
                                minWidth: 4,
                                maxWidth: 80,
                              }} />
                              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{ret.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
