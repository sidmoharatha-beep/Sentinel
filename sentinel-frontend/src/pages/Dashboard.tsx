import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/lib/AuthContext';
import { dashboardApi, incidentApi } from '@/lib/api';
import {
  ShieldCheck, AlertTriangle, CheckCircle2, Clock,
  MapPin, Activity, RefreshCw, Flame, TrendingUp,
  ShieldAlert, X, Loader2, Sparkles,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from 'recharts';
import { cn } from '@/lib/utils';

function parseUTC(iso: string) { return new Date(iso.includes('Z')||iso.includes('+')?iso:iso+'Z'); }
function fmtTime(iso: string) { return parseUTC(iso).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:false}); }

const SHIFT_COLORS: Record<string,{bg:string;text:string;border:string;dot:string}> = {
  A: { bg:'bg-emerald-50', text:'text-emerald-700', border:'border-emerald-200', dot:'bg-emerald-500' },
  B: { bg:'bg-blue-50',    text:'text-blue-700',    border:'border-blue-200',    dot:'bg-blue-500' },
  C: { bg:'bg-violet-50',  text:'text-violet-700',  border:'border-violet-200',  dot:'bg-violet-500' },
};
const SEVERITY_COLOR: Record<string,string> = { Critical:'bg-red-500', High:'bg-orange-500', Medium:'bg-amber-400', Low:'bg-green-500' };
const SEVERITY_BADGE: Record<string,string> = {
  Critical:'bg-red-50 text-red-700 border-red-200', High:'bg-orange-50 text-orange-700 border-orange-200',
  Medium:'bg-amber-50 text-amber-700 border-amber-200', Low:'bg-green-50 text-green-700 border-green-200',
};
const STATUS_BADGE: Record<string,string> = {
  completed:'bg-green-50 text-green-700 border-green-200', in_progress:'bg-amber-50 text-amber-700 border-amber-200',
  scheduled:'bg-blue-50 text-blue-700 border-blue-200', missed:'bg-red-50 text-red-700 border-red-200',
};

function StatCard({ title, value, suffix, icon, iconBg, subtitle }: any) {
  return (
    <div className="bg-white rounded-2xl border border-border p-5 flex flex-col gap-3">
      <div className={cn('p-3 rounded-xl w-fit', iconBg)}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-primary">{value}{suffix && <span className="text-base font-medium text-text-muted ml-0.5">{suffix}</span>}</p>
        <p className="text-xs font-medium text-text-muted mt-0.5">{title}</p>
        {subtitle && <p className="text-[11px] text-text-muted mt-0.5 opacity-70">{subtitle}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, isRole } = useAuth();
  const isGuard = isRole('security_guard');

  const [overview, setOverview]         = useState<any>(null);
  const [patrolStats, setPatrolStats]   = useState<any>(null);
  const [shiftComp, setShiftComp]       = useState<any>(null);
  const [currentShift, setCurrentShift] = useState<any>(null);
  const [topRisk, setTopRisk]           = useState<any>(null);
  const [insights, setInsights]         = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);

  const [closingIncident, setClosingIncident] = useState<any>(null);
  const [resolutionNote, setResolutionNote]   = useState('');
  const [closing, setClosing]                 = useState(false);
  const [toast, setToast]                     = useState('');

  function showToast(msg: string) { setToast(msg); setTimeout(()=>setToast(''),3500); }

  function load() {
    setLoading(true);
    Promise.all([
      dashboardApi.overview() as Promise<any>,
      dashboardApi.patrolStats(7) as Promise<any>,
      dashboardApi.shiftCompliance(7) as Promise<any>,
      fetch('/api/patrols/current-shift').then(r=>r.json()),
      dashboardApi.topRiskAreas(30) as Promise<any>,
      (dashboardApi as any).insights().catch(() => ({ insights: [] })),
    ]).then(([ov,ps,sc,cs,tr,ins]:any[])=>{
      setOverview(ov); setPatrolStats(ps); setShiftComp(sc); setCurrentShift(cs); setTopRisk(tr);
      setInsights(ins.insights || []);
    }).catch(()=>{}).finally(()=>setLoading(false));
  }
  useEffect(load, []);

  async function handleCloseIncident() {
    if (!closingIncident) return;
    setClosing(true);
    try {
      await incidentApi.update(closingIncident.id, {
        status: 'Resolved',
        resolution_notes: resolutionNote || 'Resolved by manager',
      });
      showToast(`✓ Incident #${closingIncident.id} resolved`);
      setClosingIncident(null); setResolutionNote('');
      load();
    } catch (e: any) { showToast(`Error: ${e.message}`); }
    finally { setClosing(false); }
  }

  const stats          = overview?.stats || {};
  const criticalAlerts = overview?.critical_alerts || [];
  const recentPatrols  = overview?.recent_patrols || [];
  const shifts         = shiftComp?.shift_compliance || [];
  const riskAreas      = topRisk?.areas || [];
  const cs             = currentShift?.shift;

  const chartData = (patrolStats?.by_day || []).map((d: any) => ({
    name: parseUTC(d.date).toLocaleDateString('en',{weekday:'short',day:'numeric'}),
    Completed: d.completed, Missed: d.missed,
  }));

  return (
    <Layout>
      {toast && <div className="fixed top-4 right-4 z-[100] bg-primary text-white px-4 py-2.5 rounded-xl shadow-lg text-sm">{toast}</div>}

      <header className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl font-bold text-primary">Dashboard</h2>
            {cs && (
              <span className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border', SHIFT_COLORS[cs].bg, SHIFT_COLORS[cs].text, SHIFT_COLORS[cs].border)}>
                <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', SHIFT_COLORS[cs].dot)}/> Shift {cs} · {currentShift.start}–{currentShift.end}
              </span>
            )}
          </div>
          <p className="text-text-muted text-sm mt-0.5">
            Welcome back, <span className="font-medium text-primary">{user?.full_name?.split(' ')[0]}</span>
            {stats.complianceToday != null && ` · Today's compliance: `}
            {stats.complianceToday != null && (
              <span className={cn('font-bold', stats.complianceToday>=80?'text-green-600':stats.complianceToday>=60?'text-amber-600':'text-red-600')}>
                {stats.complianceToday}%
              </span>
            )}
          </p>
        </div>
        <button onClick={load} className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border hover:bg-surface-alt text-xs text-text-muted transition-colors">
          <RefreshCw size={13} className={loading?'animate-spin':''}/> Refresh
        </button>
      </header>

      <section className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard title="Active Patrols" value={stats.active_patrols ?? '—'} icon={<Activity size={20} className="text-blue-600"/>} iconBg="bg-blue-50" subtitle="Currently in progress"/>
        <StatCard title="Compliance Today" value={stats.complianceToday ?? '—'} suffix="%" icon={<TrendingUp size={20} className="text-emerald-600"/>} iconBg="bg-emerald-50" subtitle="Checkpoint scan rate"/>
        <StatCard title="Open Incidents" value={stats.open_incidents ?? '—'} icon={<AlertTriangle size={20} className="text-amber-600"/>} iconBg="bg-amber-50" subtitle="Pending resolution"/>
        <StatCard title="Critical Open" value={stats.criticalOpen ?? stats.critical_incidents ?? '—'} icon={<Flame size={20} className="text-red-600"/>} iconBg="bg-red-50" subtitle="Needs immediate attention"/>
      </section>

      {/* ── Smart Insights (AI-style analytics for security manager) ─────── */}
      {!isGuard && insights.length > 0 && (
        <section className="bg-white rounded-2xl border border-border p-5 mb-6">
          <h3 className="text-sm font-semibold text-primary flex items-center gap-2 mb-4">
            <Sparkles size={15} className="text-purple-500"/> Smart Insights
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.map((ins, i) => (
              <div key={i} className={cn('flex items-start gap-2.5 p-3 rounded-xl border text-xs',
                ins.severity === 'critical' ? 'bg-red-50 border-red-200 text-red-700' :
                ins.severity === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                'bg-blue-50 border-blue-200 text-blue-700')}>
                <span className="shrink-0 mt-0.5">
                  {ins.severity === 'critical' ? <Flame size={13}/> : ins.severity === 'warning' ? <AlertTriangle size={13}/> : <Sparkles size={13}/>}
                </span>
                <p className="leading-snug">{ins.message}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {!isGuard && (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-border p-5">
            <h3 className="text-sm font-semibold text-primary mb-4">Patrol Completion — Last 7 Days</h3>
            {chartData.length > 0 ? (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barGap={4} barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                    <XAxis dataKey="name" tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={{borderRadius:8,border:'1px solid #e2e8f0',fontSize:12}}/>
                    <Legend wrapperStyle={{fontSize:12}}/>
                    <Bar dataKey="Completed" fill="#3b82f6" radius={[4,4,0,0]}/>
                    <Bar dataKey="Missed" fill="#fca5a5" radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <div className="h-52 flex items-center justify-center text-text-muted text-sm">{loading?<RefreshCw size={18} className="animate-spin"/>:'No patrol data yet'}</div>}
          </div>

          <div className="bg-white rounded-2xl border border-border p-5">
            <h3 className="text-sm font-semibold text-primary mb-5">Shift Compliance</h3>
            <div className="space-y-5">
              {['A','B','C'].map(shift=>{
                const d = shifts.find((s:any)=>s.shift===shift);
                const pct = d?.compliance_pct ?? 0;
                const sc = SHIFT_COLORS[shift];
                return (
                  <div key={shift}>
                    <div className="flex justify-between items-center mb-2">
                      <span className={cn('flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border', sc.bg, sc.text, sc.border)}>
                        <span className={cn('w-1.5 h-1.5 rounded-full', sc.dot)}/> Shift {shift}
                      </span>
                      <span className={cn('text-sm font-bold', pct>=80?'text-green-600':pct>=60?'text-amber-600':'text-red-500')}>{pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all duration-700', pct>=80?'bg-green-500':pct>=60?'bg-amber-400':'bg-red-400')} style={{width:`${pct}%`}}/>
                    </div>
                    <p className="text-[11px] text-text-muted mt-1.5">{d?`${d.completed} completed · ${d.missed} missed`:'No data yet'}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div className="bg-white rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2"><Flame size={15} className="text-red-500"/> Critical & Open Incidents</h3>
            {criticalAlerts.length > 0 && <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs font-semibold border border-red-200">{criticalAlerts.length} open</span>}
          </div>
          <div className="space-y-2.5">
            {criticalAlerts.length === 0 && !loading ? (
              <div className="py-8 flex flex-col items-center gap-2 text-text-muted">
                <CheckCircle2 size={28} className="text-green-400"/><p className="text-sm">No open critical incidents</p>
              </div>
            ) : criticalAlerts.map((alert: any) => (
              <div key={alert.id} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-border">
                <div className={cn('mt-1.5 w-2 h-2 rounded-full shrink-0', SEVERITY_COLOR[alert.severity]||'bg-gray-300')}/>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-primary truncate">{alert.title}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="flex items-center gap-1 text-[11px] text-text-muted"><MapPin size={10}/> {alert.site_name}</span>
                    <span className="flex items-center gap-1 text-[11px] text-text-muted"><Clock size={10}/> {fmtTime(alert.reported_at)}</span>
                    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full border', SEVERITY_BADGE[alert.severity])}>{alert.severity}</span>
                    {alert.is_escalated === 1 && <span className="text-[10px] font-bold text-red-600">🚨 Escalated</span>}
                  </div>
                </div>
                {!isGuard && (
                  <button onClick={()=>{setClosingIncident(alert);setResolutionNote('');}}
                    className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-green-50 border border-green-200 text-green-700 text-[11px] font-medium hover:bg-green-100 transition-colors">
                    <CheckCircle2 size={11}/> Resolve
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-border p-5">
          <h3 className="text-sm font-semibold text-primary flex items-center gap-2 mb-4"><ShieldCheck size={15} className="text-accent"/> Recent Patrols</h3>
          <div className="space-y-2.5">
            {recentPatrols.length === 0 && !loading ? <div className="py-8 text-center text-text-muted text-sm">No patrol data yet</div> :
              recentPatrols.map((p: any) => (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-border">
                  <div className={cn('p-2 rounded-lg shrink-0', p.status==='in_progress'?'bg-amber-100 text-amber-600':'bg-accent/10 text-accent')}><ShieldCheck size={14}/></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-primary truncate">{p.guard_name}{p.shift && <span className="ml-1.5 text-[11px] font-normal text-text-muted">Shift {p.shift}</span>}</p>
                    <p className="text-[11px] text-text-muted mt-0.5">{parseUTC(p.scheduled_start).toLocaleString('en-IN',{dateStyle:'short',timeStyle:'short'})}</p>
                  </div>
                  <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0', STATUS_BADGE[p.status]||'bg-gray-50 text-gray-600 border-gray-200')}>{p.status.replace('_',' ')}</span>
                </div>
              ))}
          </div>
        </div>
      </section>

      {!isGuard && riskAreas.length > 0 && (
        <div className="bg-white rounded-2xl border border-border p-5">
          <h3 className="text-sm font-semibold text-primary flex items-center gap-2 mb-4"><ShieldAlert size={15} className="text-amber-500"/> Top Risk Areas — Last 30 Days</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {riskAreas.slice(0,6).map((area: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-gray-50">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0', i===0?'bg-red-100 text-red-700':i===1?'bg-orange-100 text-orange-700':'bg-amber-100 text-amber-700')}>#{i+1}</div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-primary truncate">{area.checkpoint_name || area.area}</p>
                  <p className="text-[11px] text-text-muted">{area.incident_count} incident{area.incident_count!==1?'s':''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {closingIncident && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[80] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-primary">Resolve Incident #{closingIncident.id}</h3>
                <p className="text-xs text-text-muted mt-0.5 max-w-[240px]">{closingIncident.title}</p>
              </div>
              <button onClick={()=>setClosingIncident(null)} className="p-1 rounded-lg hover:bg-surface-alt text-text-muted"><X size={16}/></button>
            </div>
            <div className="mb-5">
              <label className="text-xs font-medium text-text-muted block mb-1.5">Resolution Notes <span className="text-red-500">*</span></label>
              <textarea value={resolutionNote} onChange={e=>setResolutionNote(e.target.value)} rows={3}
                placeholder="Describe how the incident was resolved…"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"/>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>setClosingIncident(null)} className="flex-1 py-2.5 text-sm border border-border rounded-xl hover:bg-surface-alt">Cancel</button>
              <button onClick={handleCloseIncident} disabled={closing||!resolutionNote.trim()}
                className="flex-1 py-2.5 text-sm bg-green-600 text-white rounded-xl hover:bg-green-700 flex items-center justify-center gap-2 disabled:opacity-50">
                {closing ? <Loader2 size={13} className="animate-spin"/> : <CheckCircle2 size={13}/>}
                {closing ? 'Resolving…' : 'Mark Resolved'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
