'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import KPICard from '@/components/KPICard';
import { fmtMoney, fmtNum } from '@/components/Charts';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface ReceitaAPI {
  kpis: {
    receita_mtd: number;
    receita_liquida_mtd: number;
    pedidos_mtd: number;
    ticket_medio: number;
    receita_mes_ant_completo: number;
    delta_mtd_pct: string | null;
    delta_label: string;
  };
  porDia: { data: string; receita: number; receita_liq: number }[];
  porUnidade: { unidade: string; receita: number; receita_liq: number; pacientes: number; pedidos: number }[];
  crescimento: { mes: string; receita: number; receita_liq: number }[];
}

interface ConsultasAPI {
  consultasMensal: { mes: string; realizadas: number; canceladas: number; no_show: number }[];
  kpis: { realizadas: number; canceladas: number; no_show: number; total: number }[];
  porUnidade: { unidade: string; realizadas: number; canceladas: number; taxa_cancelamento: number }[];
}

function calcDelta(atual: number, anterior: number): number {
  if (!anterior) return 0;
  return ((atual - anterior) / anterior) * 100;
}

function getMesLabel(): string {
  const now = new Date();
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return `${months[now.getMonth()]} ${now.getFullYear()}`;
}

export default function DashboardPage() {
  const [receita, setReceita] = useState<ReceitaAPI | null>(null);
  const [consultas, setConsultas] = useState<ConsultasAPI | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  useEffect(() => {
    async function load() {
      try {
        const [rRes, cRes] = await Promise.all([
          fetch('/api/bq/receita'),
          fetch('/api/bq/consultas'),
        ]);
        
        const rJson = await rRes.json();
        const cJson = await cRes.json();
        
        if (rRes.ok && !rJson.error) {
          setReceita(rJson);
        } else {
          setError('Erro na API de receita: ' + (rJson.error || rRes.statusText));
        }
        
        if (cRes.ok && !cJson.error) {
          setConsultas(cJson);
        } else {
          setError('Erro na API de consultas: ' + (cJson.error || cRes.statusText));
        }
        
        setLastUpdate(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      } catch (e) {
        console.error(e);
        setError(String(e));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const k = receita?.kpis;
  const consultasK = consultas?.kpis?.[0];
  
  const receitaAtual = k?.receita_mtd ?? 0;
  const receitaAnterior = k?.receita_mes_ant_completo ?? 0;
  const deltaReceita = k?.delta_mtd_pct ? Number(k.delta_mtd_pct) : undefined;

  const pedidosAtual = k?.pedidos_mtd ?? 0;
  const consultasRealizadas = consultasK?.realizadas ?? 0;
  
  const taxaCancelamento = consultasK && consultasK.total > 0
    ? ((consultasK.canceladas / consultasK.total) * 100).toFixed(1) + '%'
    : '—';

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <div className="header">
          <div className="header-left">
            <h1>Dashboard Geral</h1>
            <p>{getMesLabel()} — Visão consolidada da Clínica Vitta</p>
          </div>
          <div className="header-right">
            {lastUpdate && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Atualizado às {lastUpdate}
              </span>
            )}
            <span className="badge-live">Ao vivo</span>
          </div>
        </div>

        {error && (
          <div style={{ margin: '16px 24px', padding: 16, background: '#fee2e2', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}

        <div className="page-body">
          <div className="kpi-grid">
            <KPICard
              label="Receita do Mês"
              value={loading ? '...' : fmtMoney(receitaAtual)}
              icon="💰"
              iconColor="blue"
              delta={loading ? undefined : deltaReceita}
              deltaLabel={k?.delta_label}
              loading={loading}
            />
            <KPICard
              label="Consultas Realizadas"
              value={loading ? '...' : fmtNum(consultasRealizadas)}
              icon="📅"
              iconColor="green"
              loading={loading}
            />
            <KPICard
              label="Pedidos do Mês"
              value={loading ? '...' : fmtNum(pedidosAtual)}
              icon="📋"
              iconColor="purple"
              loading={loading}
            />
            <KPICard
              label="Ticket Médio"
              value={loading ? '...' : fmtMoney(k?.ticket_medio ?? 0)}
              icon="🎯"
              iconColor="orange"
              loading={loading}
            />
            <KPICard
              label="Taxa de Cancelamento"
              value={loading ? '...' : taxaCancelamento}
              icon="❌"
              iconColor="teal"
              loading={loading}
            />
          </div>

          <div className="charts-grid">
            <div className="chart-card">
              <div className="chart-title">📈 Receita Mensal</div>
              <div className="chart-subtitle">Últimos 12 meses — pagamentos confirmados</div>
              {loading ? (
                <div className="skeleton" style={{ height: 280 }} />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={receita?.crescimento ?? []} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: any) => [fmtMoney(Number(v) || 0), 'Receita']} contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }} />
                    <Area type="monotone" dataKey="receita" stroke="#3b82f6" fill="url(#gradReceita)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="chart-card">
              <div className="chart-title">🏥 Receita por Unidade</div>
              <div className="chart-subtitle">Mês atual</div>
              {loading ? (
                <div className="skeleton" style={{ height: 280 }} />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={(receita?.porUnidade ?? []).slice(0, 8)} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="unidade" tick={{ fontSize: 10 }} width={80} />
                    <Tooltip formatter={(v: any) => [fmtMoney(Number(v) || 0), 'Receita']} contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="receita" fill="#3b82f6" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="charts-grid">
            <div className="chart-card">
              <div className="chart-title">📅 Consultas por Mês</div>
              <div className="chart-subtitle">Realizadas vs Canceladas — últimos 12 meses</div>
              {loading ? (
                <div className="skeleton" style={{ height: 280 }} />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={consultas?.consultasMensal ?? []} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="gradRealizadas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="gradCanceladas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: any, name: any) => [fmtNum(Number(v) || 0), name === 'realizadas' ? 'Realizadas' : 'Canceladas']} contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }} />
                    <Legend />
                    <Area type="monotone" dataKey="realizadas" stroke="#10b981" fill="url(#gradRealizadas)" strokeWidth={2} />
                    <Area type="monotone" dataKey="canceladas" stroke="#ef4444" fill="url(#gradCanceladas)" strokeWidth={1.5} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="data-table-wrapper">
              <div className="data-table-header">
                <div>
                  <div className="chart-title">🏥 Performance por Unidade</div>
                  <div className="chart-subtitle">Consultas do mês atual</div>
                </div>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Unidade</th>
                    <th>Realizadas</th>
                    <th>Cancel.</th>
                    <th>Taxa</th>
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}>
                          {Array.from({ length: 4 }).map((__, j) => (
                            <td key={j}><div className="skeleton" style={{ height: 14, width: '80%' }} /></td>
                          ))}
                        </tr>
                      ))
                    : (consultas?.porUnidade ?? []).map((u) => (
                        <tr key={u.unidade}>
                          <td>{u.unidade}</td>
                          <td>{fmtNum(u.realizadas)}</td>
                          <td>{fmtNum(u.canceladas)}</td>
                          <td>
                            <span className={`tag ${u.taxa_cancelamento > 20 ? 'red' : u.taxa_cancelamento > 10 ? 'orange' : 'green'}`}>
                              {u.taxa_cancelamento}%
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
    </div>
  );
}