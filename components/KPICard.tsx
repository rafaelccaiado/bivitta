'use client';

interface KPICardProps {
  label: string;
  value: string;
  icon: string;
  iconColor?: 'blue' | 'green' | 'purple' | 'orange' | 'teal';
  delta?: number;
  deltaLabel?: string;
  loading?: boolean;
}

function formatDelta(delta: number): string {
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}%`;
}

export default function KPICard({
  label,
  value,
  icon,
  iconColor = 'blue',
  delta,
  deltaLabel = 'vs mês anterior',
  loading = false,
}: KPICardProps) {
  if (loading) {
    return (
      <div className="kpi-card">
        <div className="kpi-header">
          <div className="skeleton" style={{ width: 120, height: 14 }} />
          <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 9 }} />
        </div>
        <div className="skeleton" style={{ width: 160, height: 32 }} />
        <div className="skeleton" style={{ width: 100, height: 12 }} />
      </div>
    );
  }

  return (
    <div className="kpi-card">
      <div className="kpi-header">
        <span className="kpi-label">{label}</span>
        <div className={`kpi-icon ${iconColor}`}>{icon}</div>
      </div>
      <div className="kpi-value text-money">{value}</div>
      {delta !== undefined && (
        <div className="kpi-footer">
          <span className={`kpi-delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral'}`}>
            {delta > 0 ? '↑' : delta < 0 ? '↓' : '→'} {formatDelta(delta)}
          </span>
          <span className="kpi-delta-label">{deltaLabel}</span>
        </div>
      )}
    </div>
  );
}
