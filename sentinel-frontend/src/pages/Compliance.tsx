import { useState, useEffect, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { Card } from '@/components/Card';
import { ProgressBar } from '@/components/ProgressBar';
import { RefreshCw, Loader2, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { dashboardApi } from '@/lib/api';
import { cn } from '@/lib/utils';

const AREA_LABELS: Record<string, string> = {
  critical:    'Critical Areas',
  operational: 'Operational Areas',
  support:     'Support Areas',
};

const AREA_COLORS: Record<string, string> = {
  critical:    'bg-red-100 border-red-200 text-red-700',
  operational: 'bg-blue-100 border-blue-200 text-blue-700',
  support:     'bg-gray-100 border-gray-200 text-gray-600',
};

const FREQ_LABEL: Record<number, string> = {
  1: 'Every 1 hr',
  2: 'Every 2 hrs',
  4: 'Every 4 hrs',
};

function pctColor(pct: number) {
  if (pct >= 80) return 'bg-success';
  if (pct >= 60) return 'bg-warning';
  return 'bg-danger';
}

function timeAgo(iso: string | null) {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Compliance() {
  const [areaData, setAreaData]     = useState<any>(null);
  const [shiftData, setShiftData]   = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [days, setDays]             = useState(7);
  const [activeArea, setActiveArea] = useState<string>('all');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    Promise.all([
      dashboardApi.areaCompliance(days) as Promise<any>,
      dashboardApi.shiftCompliance(days) as Promise<any>,
    ])
      .then(([area, shift]) => {
        setAreaData(area);
        setShiftData(shift);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const allCheckpoints: any[] = areaData?.checkpoints || [];
  const areaSummary: any[]    = areaData?.area_summary || [];
  const shiftSummary: any[]   = shiftData?.shift_compliance || [];

  const filteredCheckpoints = activeArea === 'all'
    ? allCheckpoints
    : allCheckpoints.filter((c: any) => c.area_type === activeArea);

  // Group checkpoints by area type for display
  const grouped: Record<string, any[]> = {};
  filteredCheckpoints.forEach((c: any) => {
    if (!grouped[c.area_type]) grouped[c.area_type] = [];
    grouped[c.area_type].push(c);
  });

  const overallPct = areaSummary.length > 0
    ? Math.round(areaSummary.reduce((a, s) => a + (s.compliance_pct || 0), 0) / areaSummary.length)
    : 0;

  return (
    <Layout>
      <header className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-primary">Compliance</h2>
          <p className="text-text-muted text-sm">Patrol compliance by shift and area.</p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 14, 30].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={cn('px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                days === d ? 'bg-accent text-white border-accent' : 'bg-surface-alt text-text-muted border-border hover:border-accent/40'
              )}>
              {d}d
            </button>
          ))}
          <button onClick={load} className="p-2 rounded-lg border border-border hover:bg-surface transition-colors text-text-muted" title="Refresh">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-danger/10 text-danger text-sm">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {loading && !areaData ? (
        <div className="flex items-center justify-center py-16 text-text-muted gap-2">
          <Loader2 size={20} className="animate-spin" /> Loading compliance data…
        </div>
      ) : (
        <>
          {/* Top summary row */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Overall */}
            <Card className="col-span-2 lg:col-span-1 flex items-center gap-4">
              <div className="relative w-16 h-16 shrink-0">
                <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                  <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9155" fill="none"
                    stroke={overallPct >= 80 ? '#22c55e' : overallPct >= 60 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="3"
                    strokeDasharray={`${overallPct} 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-primary">
                  {overallPct}%
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-primary">Overall</p>
                <p className="text-xs text-text-muted">Last {days} days</p>
              </div>
            </Card>

            {/* Per area type */}
            {['critical', 'operational', 'support'].map(type => {
              const s = areaSummary.find(a => a.area_type === type);
              const pct = s?.compliance_pct ?? 0;
              return (
                <Card key={type}>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
                    {AREA_LABELS[type]}
                  </p>
                  <p className="text-2xl font-bold text-primary">{pct}%</p>
                  <div className="h-1.5 rounded-full bg-border mt-2 overflow-hidden">
                    <div className={cn('h-full rounded-full', pctColor(pct))} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-text-muted mt-1">
                    {s ? `${s.completed_scans}/${s.total_scans} scans` : 'No data'}
                  </p>
                </Card>
              );
            })}
          </section>

          {/* Shift compliance */}
          <Card className="mb-6">
            <h3 className="text-sm font-semibold text-primary mb-4">Shift-wise Compliance</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {['A', 'B', 'C'].map(shift => {
                const s = shiftSummary.find((x: any) => x.shift === shift);
                const pct = s?.compliance_pct ?? 0;
                const label = shift === 'A' ? '06:00–14:00' : shift === 'B' ? '14:00–22:00' : '22:00–06:00';
                return (
                  <div key={shift} className="p-4 rounded-xl border border-border bg-surface-alt">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm font-semibold text-primary">Shift {shift}</p>
                        <p className="text-xs text-text-muted">{label}</p>
                      </div>
                      <span className="text-xl font-bold text-primary">{pct}%</span>
                    </div>
                    <ProgressBar value={pct} />
                    <div className="flex justify-between text-xs text-text-muted mt-2">
                      <span className="text-success">{s?.completed ?? 0} completed</span>
                      <span className="text-danger">{s?.missed ?? 0} missed</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Checkpoint detail */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-primary">Checkpoint Status</h3>
              <div className="flex gap-2">
                {['all', 'critical', 'operational', 'support'].map(a => (
                  <button key={a} onClick={() => setActiveArea(a)}
                    className={cn('px-2.5 py-1 rounded-md text-xs font-medium border transition-colors capitalize',
                      activeArea === a ? 'bg-primary text-white border-primary' : 'bg-surface-alt text-text-muted border-border hover:border-primary/40'
                    )}>
                    {a === 'all' ? 'All' : a}
                  </button>
                ))}
              </div>
            </div>

            {Object.entries(grouped).map(([areaType, cps]) => (
              <div key={areaType} className="mb-6 last:mb-0">
                <div className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border mb-3', AREA_COLORS[areaType])}>
                  {AREA_LABELS[areaType]} ({cps.length})
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {cps.map((cp: any) => {
                    const pct = cp.total_scans > 0
                      ? Math.round((cp.completed_scans / cp.total_scans) * 100)
                      : 0;
                    const isDue = !cp.last_scanned || (() => {
                      const diffHrs = (Date.now() - new Date(cp.last_scanned).getTime()) / 3600000;
                      return diffHrs >= cp.patrol_frequency_hours;
                    })();
                    return (
                      <div key={cp.checkpoint_code}
                        className={cn('p-3 rounded-lg border', isDue ? 'border-warning bg-warning/5' : 'border-border bg-surface-alt')}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <p className="text-xs font-bold text-primary font-mono">{cp.checkpoint_code}</p>
                            <p className="text-xs text-text-muted leading-tight">{cp.checkpoint_name}</p>
                          </div>
                          <span className={cn('text-xs font-bold', pctColor(pct).replace('bg-', 'text-').replace('success', 'green-600').replace('warning', 'yellow-600').replace('danger', 'red-600'))}>
                            {pct}%
                          </span>
                        </div>
                        <div className="h-1 rounded-full bg-border overflow-hidden mb-2">
                          <div className={cn('h-full rounded-full', pctColor(pct))} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex items-center justify-between text-xs text-text-muted">
                          <span className="flex items-center gap-1">
                            <Clock size={10} /> {FREQ_LABEL[cp.patrol_frequency_hours] || `${cp.patrol_frequency_hours}h`}
                          </span>
                          <span className={cn('flex items-center gap-1', isDue && 'text-warning font-semibold')}>
                            {isDue ? '⚠ Due now' : `✓ ${timeAgo(cp.last_scanned)}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {filteredCheckpoints.length === 0 && (
              <div className="text-center py-8 text-text-muted">
                <CheckCircle2 size={28} className="mx-auto mb-2 opacity-30" />
                No checkpoint data available.
              </div>
            )}
          </Card>
        </>
      )}
    </Layout>
  );
}
