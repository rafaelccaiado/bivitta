'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import KPICard from '@/components/KPICard';
import { fmtNum, fmtMoney } from '@/components/Charts';

interface VittaMaisData {
  vittaCard: { mes: string; contratos_ativos: number; novos_contratos: number; receita_estimada: number }[];
  kpis: { total_contratos: number; contratos_ativos: number; total_dependentes: number }[];
}

function fmtMes(mes: string): string {
  const [y, m] = mes.split('-');
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${months[parseInt(m) - 1]}/${y.slice(2)}`;
}

export default function VittaMaisPage() {
  const [data, setData] = useState<VittaMaisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/bq/vittamais')
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const kpis = data?.kpis?.[0];
  const taxaAtivacao = kpis && kpis.total_contratos > 0
    ? ((kpis.contratos_ativos / kpis.total_contratos) * 100).toFixed(1) + '%'
    : '—';

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <div className="header">
          <div className="header-left">
            <h1>💎 VittaMais</h1>
            <p>Programa de benefícios e assinaturas de saúde</p>
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
            <KPICard label="Contratos Ativos" value={fmtNum(kpis?.contratos_ativos ?? 0)} icon="💎" iconColor="blue" loading={loading} />
            <KPICard label="Total de Contratos" value={fmtNum(kpis?.total_contratos ?? 0)} icon="📋" iconColor="purple" loading={loading} />
            <KPICard label="Total de Dependentes" value={fmtNum(kpis?.total_dependentes ?? 0)} icon="👨‍👩‍👧" iconColor="green" loading={loading} />
            <KPICard label="Taxa de Ativação" value={loading ? '...' : taxaAtivacao} icon="✅" iconColor="teal" loading={loading} />
          </div>

          <div className="data-table-wrapper">
            <div className="data-table-header">
              <div>
                <div className="chart-title">📅 Evolução Mensal — VittaMais</div>
                <div className="chart-subtitle">Contratos ativos e receita estimada (R$ 89,90/mês)</div>
              </div>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mês</th>
                  <th>Contratos Ativos</th>
                  <th>Novos Contratos</th>
                  <th>Receita Estimada</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 4 }).map((__, j) => (
                          <td key={j}><div className="skeleton" style={{ height: 14, width: '80%' }} /></td>
                        ))}
                      </tr>
                    ))
                  : [...(data?.vittaCard ?? [])].reverse().map((m, i) => (
                      <tr key={i}>
                        <td>{fmtMes(m.mes)}</td>
                        <td><strong>{fmtNum(m.contratos_ativos)}</strong></td>
                        <td>
                          {m.novos_contratos > 0 && (
                            <span className="tag green">+{fmtNum(m.novos_contratos)}</span>
                          )}
                          {m.novos_contratos === 0 && <span className="text-muted">—</span>}
                        </td>
                        <td className="text-money">{fmtMoney(m.receita_estimada)}</td>
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
