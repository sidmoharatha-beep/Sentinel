import { useState, useEffect, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { Card } from '@/components/Card';
import { dashboardApi } from '@/lib/api';
import {
  Download, RefreshCw, Loader2, AlertCircle,
  TrendingUp, Shield, Calendar, Users,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { cn } from '@/lib/utils';

const SEVERITY_COLORS: Record<string, string> = {
  Critical: '#ef4444',
  High:     '#f97316',
  Medium:   '#f59e0b',
  Low:      '#22c55e',
};

type ReportType = 'daily' | 'shift' | 'weekly' | 'monthly' | 'critical' | 'audit_trail';

const REPORT_TYPES: { type: ReportType; label: string; icon: any; desc: string }[] = [
  { type: 'daily',       label: 'Daily Report',       icon: Calendar, desc: 'Today\'s patrol & incident summary' },
  { type: 'shift',       label: 'Shift Report',        icon: Calendar, desc: 'Breakdown by Shift A / B / C' },
  { type: 'weekly',      label: 'Weekly Report',       icon: TrendingUp, desc: 'Last 7 days patrol compliance' },
  { type: 'monthly',     label: 'Monthly Report',      icon: TrendingUp, desc: 'Last 30 days full summary' },
  { type: 'critical',    label: 'Critical Incidents',  icon: AlertCircle, desc: 'All Critical/Escalated incidents' },
  { type: 'audit_trail', label: 'Audit Trail',          icon: Shield, desc: 'Login, scan and action logs' },
];

export default function Reports() {
  const [patrolStats, setPatrolStats]     = useState<any>(null);
  const [incidentStats, setIncidentStats] = useState<any>(null);
  const [guardPerf, setGuardPerf]         = useState<any>(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [days, setDays]                   = useState(7);
  const [generating, setGenerating]       = useState<ReportType | null>(null);
  const [genMsg, setGenMsg]               = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    Promise.all([
      dashboardApi.patrolStats(days) as Promise<any>,
      dashboardApi.incidentStats(days) as Promise<any>,
      dashboardApi.guardPerformance(days) as Promise<any>,
    ])
      .then(([p, i, g]) => { setPatrolStats(p); setIncidentStats(i); setGuardPerf(g); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const patrolByDay = (patrolStats?.by_day || []).map((d: any) => ({
    name: new Date(d.date).toLocaleDateString('en', { weekday: 'short', day: 'numeric' }),
    Completed: d.completed,
    Missed: d.missed,
  }));

  const incidentByCategory = incidentStats?.by_category || [];
  const incidentBySeverity = (incidentStats?.by_severity || []).map((s: any) => ({
    name: s.severity,
    value: s.count,
    fill: SEVERITY_COLORS[s.severity] || '#94a3b8',
  }));

  const guards = guardPerf?.guards || [];

  async function handleGenerate(type: ReportType) {
    setGenerating(type);
    setGenMsg('');
    // Simulate report generation (replace with real API call when backend generates files)
    await new Promise(r => setTimeout(r, 1200));
    setGenerating(null);
    setGenMsg(`${REPORT_TYPES.find(r => r.type === type)?.label} generated. PDF/Excel export coming in next release.`);
    setTimeout(() => setGenMsg(''), 4000);
  }

  return (
    <Layout>
      <header className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-primary">Reports</h2>
          <p className="text-text-muted text-sm">Patrol and incident analytics.</p>
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
          <button onClick={load} className="p-2 rounded-lg border border-border hover:bg-surface transition-colors text-text-muted">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {genMsg && (
        <div className="mb-4 p-3 rounded-lg bg-accent/10 text-accent text-sm border border-accent/20">
          {genMsg}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-danger/10 text-danger text-sm">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Report generation cards */}
      <section className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {REPORT_TYPES.map(rt => (
          <button
            key={rt.type}
            onClick={() => handleGenerate(rt.type)}
            disabled={!!generating}
            className="p-4 rounded-xl border border-border bg-surface text-left hover:border-accent/50 hover:shadow-sm transition-all disabled:opacity-60 group"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="p-2 rounded-lg bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white transition-colors">
                <rt.icon size={16} />
              </div>
              {generating === rt.type
                ? <Loader2 size={14} className="animate-spin text-text-muted mt-1" />
                : <Download size={14} className="text-text-muted mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
              }
            </div>
            <p className="text-sm font-semibold text-primary">{rt.label}</p>
            <p className="text-xs text-text-muted mt-0.5">{rt.desc}</p>
          </button>
        ))}
      </section>

      {loading && !patrolStats ? (
        <div className="flex items-center justify-center py-12 text-text-muted gap-2">
          <Loader2 size={20} className="animate-spin" /> Loading report data…
        </div>
      ) : (
        <>
          {/* Charts row */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
            {/* Patrol by day */}
            <Card className="lg:col-span-2">
              <h3 className="text-sm font-semibold text-primary mb-4">Patrol Activity — Last {days} Days</h3>
              {patrolByDay.length > 0 ? (
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={patrolByDay} barGap={3}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="Completed" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Missed"    fill="#ef4444" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-52 flex items-center justify-center text-text-muted text-sm">No patrol data</div>
              )}
            </Card>

            {/* Incident by severity pie */}
            <Card>
              <h3 className="text-sm font-semibold text-primary mb-4">Incidents by Severity</h3>
              {incidentBySeverity.length > 0 ? (
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={incidentBySeverity} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                        {incidentBySeverity.map((entry: any, i: number) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-52 flex items-center justify-center text-text-muted text-sm">No incident data</div>
              )}
            </Card>
          </section>

          {/* Incident by category */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            <Card>
              <h3 className="text-sm font-semibold text-primary mb-4">Incidents by Category</h3>
              {incidentByCategory.length > 0 ? (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={incidentByCategory} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis dataKey="category" type="category" tick={{ fontSize: 11 }} width={100} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-text-muted text-sm">No incident data</div>
              )}
            </Card>

            {/* Guard performance */}
            <Card>
              <h3 className="text-sm font-semibold text-primary mb-4 flex items-center gap-2">
                <Users size={15} /> Guard Performance
              </h3>
              <div className="space-y-3 max-h-48 overflow-auto">
                {guards.length === 0 && (
                  <p className="text-text-muted text-sm text-center py-4">No guard data</p>
                )}
                {guards.map((g: any) => (
                  <div key={g.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs font-bold shrink-0">
                      {g.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-primary truncate">{g.full_name}</p>
                        <span className="text-xs font-bold text-primary shrink-0">{g.completion_rate ?? 0}%</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', g.completion_rate >= 80 ? 'bg-success' : g.completion_rate >= 60 ? 'bg-warning' : 'bg-danger')}
                            style={{ width: `${g.completion_rate || 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-text-muted shrink-0">
                          {g.completed_patrols}/{g.total_patrols}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        </>
      )}
    </Layout>
  );
}
