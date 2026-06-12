import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { StatCard } from '@/components/StatCard';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import {
  ShieldCheck, ClipboardList, AlertTriangle, CheckCircle2,
  Clock, MapPin, Activity, RefreshCw, TrendingUp, Flame,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LineChart, Line, Legend,
} from 'recharts';
import { dashboardApi } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';

const SEVERITY_COLOR: Record<string, string> = {
  Critical: 'bg-red-500',
  High:     'bg-orange-500',
  Medium:   'bg-yellow-500',
  Low:      'bg-green-500',
};

const SHIFT_COLORS: Record<string, string> = {
  A: 'text-green-600 bg-green-50 border-green-200',
  B: 'text-blue-600 bg-blue-50 border-blue-200',
  C: 'text-purple-600 bg-purple-50 border-purple-200',
};

function useData<T>(fn: () => Promise<T>, initial: T) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const refresh = () => {
    setLoading(true);
    fn().then(d => setData(d)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(refresh, []);
  return { data, loading, refresh };
}

export default function Dashboard() {
  const { user } = useAuth();

  const overview   = useData(() => dashboardApi.overview() as Promise<any>, null);
  const patrolStats = useData(() => dashboardApi.patrolStats(7) as Promise<any>, null);
  const shiftComp  = useData(() => dashboardApi.shiftCompliance(7) as Promise<any>, null);
  const currentShift = useData(() => fetch('/api/patrols/current-shift').then(r => r.json()), null);

  const stats = overview.data?.stats || {};
  const byDay: {date: string; completed: number; missed: number}[] = patrolStats.data?.by_day || [];
  const shiftData: {shift: string; compliance_pct: number; completed: number; missed: number}[] = shiftComp.data?.shift_compliance || [];
  const criticalAlerts: any[] = overview.data?.critical_alerts || [];
  const recentPatrols: any[] = overview.data?.recent_patrols || [];

  function handleRefresh() {
    overview.refresh(); patrolStats.refresh(); shiftComp.refresh();
  }

  const chartData = byDay.map(d => ({
    name: new Date(d.date).toLocaleDateString('en', { weekday: 'short' }),
    Completed: d.completed,
    Missed: d.missed,
  }));

  return (
    <Layout>
      <header className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-primary">Dashboard</h2>
          <p className="text-text-muted text-sm">
            Welcome, {user?.full_name?.split(' ')[0]}.
            {stats.complianceToday != null && ` Today's compliance: ${stats.complianceToday}%`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {currentShift.data?.shift && (
            <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${SHIFT_COLORS[currentShift.data.shift]}`}>
              Shift {currentShift.data.shift} Active · {currentShift.data.start}–{currentShift.data.end}
            </span>
          )}
          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg border border-border hover:bg-surface transition-colors text-text-muted hover:text-primary"
            title="Refresh"
          >
            <RefreshCw size={16} className={overview.loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Stat Cards */}
      <section className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Active Patrols"
          value={stats.active_patrols ?? '—'}
          icon={<Activity size={20} />}
        />
        <StatCard
          title="Compliance Today"
          value={stats.complianceToday ?? '—'}
          suffix="%"
          icon={<ClipboardList size={20} />}
        />
        <StatCard
          title="Open Incidents"
          value={stats.open_incidents ?? '—'}
          icon={<AlertTriangle size={20} />}
        />
        <StatCard
          title="Critical Open"
          value={stats.criticalOpen ?? stats.critical_incidents ?? '—'}
          icon={<Flame size={20} />}
        />
      </section>

      {/* Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Patrol completion chart */}
        <Card className="lg:col-span-2">
          <h3 className="text-sm font-semibold text-primary mb-4">Patrol Completion — Last 7 Days</h3>
          {chartData.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Completed" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Missed" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center text-text-muted text-sm">
              {patrolStats.loading ? 'Loading...' : 'No patrol data yet'}
            </div>
          )}
        </Card>

        {/* Shift compliance */}
        <Card>
          <h3 className="text-sm font-semibold text-primary mb-4">Shift Compliance (7 days)</h3>
          <div className="space-y-4">
            {['A', 'B', 'C'].map(shift => {
              const d = shiftData.find(s => s.shift === shift);
              const pct = d?.compliance_pct ?? 0;
              return (
                <div key={shift}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${SHIFT_COLORS[shift]}`}>
                      Shift {shift}
                    </span>
                    <span className="text-sm font-bold text-primary">{pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-border overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct >= 80 ? 'bg-success' : pct >= 60 ? 'bg-warning' : 'bg-danger'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">
                    {d ? `${d.completed} completed, ${d.missed} missed` : 'No data'}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      {/* Alerts + Recent Patrols */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Critical Alerts */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-primary">Critical & Open Incidents</h3>
            {criticalAlerts.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-danger/10 text-danger text-xs font-semibold">
                {criticalAlerts.length} open
              </span>
            )}
          </div>
          <div className="space-y-2.5">
            {criticalAlerts.length === 0 && !overview.loading && (
              <p className="text-text-muted text-sm text-center py-4 flex items-center justify-center gap-2">
                <CheckCircle2 size={16} className="text-success" /> No open critical incidents
              </p>
            )}
            {criticalAlerts.map((alert: any) => (
              <div key={alert.id} className="flex items-start gap-3 p-3 rounded-lg bg-surface-alt border border-border">
                <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${SEVERITY_COLOR[alert.severity] || 'bg-border'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary truncate">{alert.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-text-muted flex-wrap">
                    <span className="flex items-center gap-1"><MapPin size={11} /> {alert.site_name}</span>
                    <span className="flex items-center gap-1"><Clock size={11} />
                      {new Date(alert.reported_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <Badge variant={alert.severity.toLowerCase() as any}>{alert.severity}</Badge>
                    {alert.is_escalated === 1 && (
                      <span className="text-danger font-semibold">🚨 Escalated</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent Patrols */}
        <Card>
          <h3 className="text-sm font-semibold text-primary mb-4">Recent Patrols</h3>
          <div className="space-y-2.5">
            {recentPatrols.length === 0 && !overview.loading && (
              <p className="text-text-muted text-sm text-center py-4">No patrol data yet</p>
            )}
            {recentPatrols.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface-alt border border-border">
                <div className="p-2 rounded-md bg-accent/10 text-accent shrink-0">
                  <ShieldCheck size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary truncate">
                    {p.guard_name}
                    {p.shift && (
                      <span className="ml-1.5 text-xs text-text-muted">Shift {p.shift}</span>
                    )}
                  </p>
                  <p className="text-xs text-text-muted">
                    {new Date(p.scheduled_start).toLocaleString('en', { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </div>
                <Badge variant={p.status}>{p.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </Layout>
  );
}
