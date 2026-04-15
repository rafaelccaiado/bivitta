'use client';

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
} from 'recharts';

// ── Formatters ─────────────────────────────────────────

export function fmtMoney(v: number | string): string {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '—';
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(0)}k`;
  return `R$ ${n.toFixed(0)}`;
}

export function fmtNum(v: number | string): string {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(Math.round(n));
}

export function fmtPct(v: number | string): string {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '—';
  return `${n.toFixed(1)}%`;
}

export function fmtMes(mes: string): string {
  const [y, m] = mes.split('-');
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${months[parseInt(m) - 1]}/${y.slice(2)}`;
}

// Custom tooltip styles
const tooltipStyle = {
  backgroundColor: '#1e2433',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  padding: '10px 14px',
  fontSize: 12,
  color: '#f1f5f9',
  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
};

const labelStyle = {
  color: '#94a3b8',
  fontSize: 11,
  fontWeight: 600,
  marginBottom: 4,
};

// ── Receita Line Chart ─────────────────────────────────

interface ReceitaDataPoint {
  mes: string;
  receita_total: number;
  ticket_medio: number;
}

interface ReceitaChartProps {
  data: ReceitaDataPoint[];
  loading?: boolean;
}

export function ReceitaChart({ data, loading }: ReceitaChartProps) {
  if (loading) {
    return <div className="skeleton" style={{ height: 260 }} />;
  }

  const formatted = data.map(d => ({
    ...d,
    mes_fmt: fmtMes(d.mes),
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={formatted} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
        <defs>
          <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#1a56db" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#1a56db" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="mes_fmt" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={fmtMoney} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={labelStyle}
          formatter={(v: any) => [fmtMoney(Number(v) || 0), 'Receita']}
        />
        <Area
          type="monotone"
          dataKey="receita_total"
          stroke="#1a56db"
          strokeWidth={2.5}
          fill="url(#gradReceita)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Bar Chart horizontal (por unidade) ─────────────────

interface BarDataPoint {
  unidade: string;
  receita: number;
  pedidos?: number;
}

interface BarChartProps {
  data: BarDataPoint[];
  loading?: boolean;
}

export function UnidadeBarChart({ data, loading }: BarChartProps) {
  if (loading) {
    return <div className="skeleton" style={{ height: 260 }} />;
  }

  const sorted = [...data].sort((a, b) => b.receita - a.receita);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={sorted} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 80 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
        <XAxis type="number" tickFormatter={fmtMoney} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="unidade" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={labelStyle}
          formatter={(v: any) => [fmtMoney(Number(v) || 0), 'Receita']}
        />
        <Bar dataKey="receita" fill="#1a56db" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Consultas Area Chart ─────────────────────────────────

interface ConsultasDataPoint {
  mes: string;
  realizadas: number;
  canceladas?: number;
  no_show?: number;
}

interface ConsultasChartProps {
  data: ConsultasDataPoint[];
  loading?: boolean;
}

export function ConsultasChart({ data, loading }: ConsultasChartProps) {
  if (loading) {
    return <div className="skeleton" style={{ height: 260 }} />;
  }

  const formatted = data.map(d => ({
    ...d,
    mes_fmt: fmtMes(d.mes),
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={formatted} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
        <defs>
          <linearGradient id="gradRealizadas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#059669" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradCanceladas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="mes_fmt" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={fmtNum} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} formatter={(v: any, name: any) => [fmtNum(Number(v) || 0), name === 'realizadas' ? 'Realizadas' : 'Canceladas']} />
        <Legend formatter={(v) => v === 'realizadas' ? 'Realizadas' : 'Canceladas'} />
        <Area type="monotone" dataKey="realizadas" stroke="#059669" strokeWidth={2.5} fill="url(#gradRealizadas)" />
        <Area type="monotone" dataKey="canceladas" stroke="#ef4444" strokeWidth={1.5} fill="url(#gradCanceladas)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Pacientes Line Chart ─────────────────────────────────

interface PacientesDataPoint {
  mes: string;
  novos: number;
  recorrentes?: number;
  total?: number;
}

interface PacientesChartProps {
  data: PacientesDataPoint[];
  loading?: boolean;
}

export function PacientesChart({ data, loading }: PacientesChartProps) {
  if (loading) return <div className="skeleton" style={{ height: 260 }} />;

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
        <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} formatter={(v: any, name: any) => [fmtNum(Number(v) || 0), name === 'novos' ? 'Novos' : 'Recorrentes']} />
        <Legend formatter={(v) => v === 'novos' ? 'Novos' : 'Recorrentes'} />
        <Bar dataKey="recorrentes" stackId="a" fill="#1a56db" radius={[0, 0, 0, 0]} />
        <Bar dataKey="novos" stackId="a" fill="#059669" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
