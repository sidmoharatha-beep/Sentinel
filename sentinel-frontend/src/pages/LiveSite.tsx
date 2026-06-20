import { useState, useEffect, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import {
  AlertTriangle, Clock, RefreshCw, Loader2, Image as ImageIcon,
  ShieldAlert, Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { dashboardApi } from '@/lib/api';

interface Anomaly {
  type: 'stale_patrol' | 'repeated_checkpoint';
  severity: 'high' | 'medium' | 'low';
  patrol_id: number;
  guard_name: string;
  employee_id: string;
  site_name: string;
  message: string;
  minutes_since_activity?: number;
}

interface TimelineEntry {
  id: number;
  scanned_at: string;
  photo_url: string | null;
  incident_photo_url: string | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  mock_gps_flag: number;
  checkpoint_name: string;
  checkpoint_code: string;
  patrol_id: number;
  shift: string | null;
  guard_name: string;
  employee_id: string;
}

const SEVERITY_STYLE: Record<string, string> = {
  high:   'bg-red-50 border-red-300 text-red-700',
  medium: 'bg-amber-50 border-amber-300 text-amber-700',
  low:    'bg-blue-50 border-blue-300 text-blue-700',
};

function parseUTC(iso: string) {
  return new Date(iso.includes('Z') || iso.includes('+') ? iso : iso + 'Z');
}
function fmtTime(iso: string) {
  return parseUTC(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function LiveSite() {
  const [tab, setTab] = useState<'anomalies' | 'timeline'>('anomalies');

  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loadingAnomalies, setLoadingAnomalies] = useState(true);

  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const loadAnomalies = useCallback(() => {
    setLoadingAnomalies(true);
    dashboardApi.anomalies(90)
      .then((d: any) => setAnomalies(d.anomalies || []))
      .catch(() => setAnomalies([]))
      .finally(() => setLoadingAnomalies(false));
  }, []);

  const loadTimeline = useCallback((date: string) => {
    setLoadingTimeline(true);
    dashboardApi.photoTimeline(date)
      .then((d: any) => setTimeline(d.timeline || []))
      .catch(() => setTimeline([]))
      .finally(() => setLoadingTimeline(false));
  }, []);

  useEffect(() => { loadAnomalies(); }, [loadAnomalies]);
  useEffect(() => { if (tab === 'timeline') loadTimeline(selectedDate); }, [tab, selectedDate, loadTimeline]);

  // Auto-refresh anomalies every 60s while tab is active
  useEffect(() => {
    if (tab !== 'anomalies') return;
    const id = setInterval(loadAnomalies, 60000);
    return () => clearInterval(id);
  }, [tab, loadAnomalies]);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-primary flex items-center gap-2">
              <ShieldAlert size={20} /> Live Site Monitor
            </h1>
            <p className="text-xs text-text-muted mt-0.5">Anomaly alerts and visual proof of rounds — no GPS tracking required</p>
          </div>
          <button onClick={() => (tab === 'anomalies' ? loadAnomalies() : loadTimeline(selectedDate))}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-surface-alt">
            <RefreshCw size={14} className={(loadingAnomalies || loadingTimeline) ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button onClick={() => setTab('anomalies')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
              tab === 'anomalies' ? 'bg-accent text-white border-accent' : 'border-border text-text-muted hover:bg-surface-alt')}>
            <AlertTriangle size={12} /> Anomaly Alerts {anomalies.length > 0 && <span className="opacity-80">({anomalies.length})</span>}
          </button>
          <button onClick={() => setTab('timeline')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
              tab === 'timeline' ? 'bg-accent text-white border-accent' : 'border-border text-text-muted hover:bg-surface-alt')}>
            <ImageIcon size={12} /> Photo Timeline
          </button>
        </div>

        {/* ── ANOMALIES TAB ──────────────────────────────────────────────── */}
        {tab === 'anomalies' && (
          <div className="space-y-2">
            <p className="text-xs text-text-muted">Auto-refreshes every 60 seconds. Flags guards inactive 90+ minutes or repeated checkpoint scans.</p>
            {loadingAnomalies ? (
              <div className="flex items-center justify-center py-16 gap-2 text-text-muted">
                <Loader2 size={20} className="animate-spin" /> Checking for anomalies…
              </div>
            ) : anomalies.length === 0 ? (
              <div className="text-center py-16 text-green-700 bg-green-50 border border-green-200 rounded-xl">
                <p className="text-sm font-medium">✓ All active patrols look normal</p>
                <p className="text-xs text-green-600 mt-1">No stale patrols or repeated checkpoints detected</p>
              </div>
            ) : (
              anomalies.map((a, i) => (
                <div key={i} className={cn('p-4 rounded-xl border flex items-start gap-3', SEVERITY_STYLE[a.severity])}>
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <p className="text-sm font-semibold">{a.guard_name} <span className="font-normal opacity-70">({a.employee_id})</span></p>
                      <span className="text-[10px] uppercase font-bold tracking-wide px-2 py-0.5 rounded-full bg-white/60">{a.severity}</span>
                    </div>
                    <p className="text-xs mt-1">{a.message}</p>
                    <p className="text-[11px] opacity-70 mt-1">{a.site_name} · Patrol #{a.patrol_id}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── PHOTO TIMELINE TAB ─────────────────────────────────────────── */}
        {tab === 'timeline' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-text-muted" />
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
              <span className="text-xs text-text-muted">{timeline.length} checkpoint{timeline.length !== 1 ? 's' : ''} scanned</span>
            </div>

            {loadingTimeline ? (
              <div className="flex items-center justify-center py-16 gap-2 text-text-muted">
                <Loader2 size={20} className="animate-spin" /> Loading photos…
              </div>
            ) : timeline.length === 0 ? (
              <div className="text-center py-16 text-text-muted text-sm">No checkpoint scans recorded for this date.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {timeline.map(t => (
                  <div key={t.id} className="border border-border rounded-xl overflow-hidden bg-white hover:shadow-md transition-shadow">
                    <button onClick={() => t.photo_url && setLightboxUrl(t.photo_url)} className="block w-full">
                      {t.photo_url ? (
                        <img src={t.photo_url} alt={t.checkpoint_name} className="w-full h-28 object-cover" />
                      ) : (
                        <div className="w-full h-28 bg-gray-100 flex items-center justify-center text-gray-300">
                          <ImageIcon size={24} />
                        </div>
                      )}
                    </button>
                    <div className="p-2.5">
                      <p className="text-xs font-semibold text-primary truncate">{t.checkpoint_name}</p>
                      <p className="text-[11px] text-text-muted flex items-center gap-1 mt-0.5">
                        <Clock size={10} /> {fmtTime(t.scanned_at)}
                      </p>
                      <p className="text-[11px] text-text-muted truncate">{t.guard_name}</p>
                      {!!t.mock_gps_flag && (
                        <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                          <ShieldAlert size={9} /> GPS flagged
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[90] p-4" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="Checkpoint" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </Layout>
  );
}
