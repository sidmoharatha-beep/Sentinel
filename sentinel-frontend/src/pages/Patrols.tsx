import { useState, useEffect, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import {
  ShieldCheck, Clock, MapPin, QrCode, Play, CheckSquare,
  RefreshCw, AlertCircle, Loader2, X, Navigation, CheckCircle2,
  FileText, TriangleAlert, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { patrolApi, api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';

function fmtTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function distanceM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface Patrol {
  id: number;
  shift: 'A' | 'B' | 'C' | null;
  status: string;
  scheduled_start: string;
  actual_start: string | null;
  actual_end: string | null;
  notes: string | null;
  guard_name: string;
  guard_employee_id: string;
  site_name: string;
}
interface Checkpoint {
  id: number;
  name: string;
  checkpoint_code: string;
  qr_code: string;
  latitude: number;
  longitude: number;
  area_type: string;
  description: string;
}
interface PatrolCheckpoint {
  id: number;
  checkpoint_id: number;
  status: string;
  scanned_at: string | null;
  notes: string | null;
  checkpoint_name: string;
  checkpoint_code: string;
  latitude: number;
  longitude: number;
  qr_code: string;
}

const STATUS_COLOR: Record<string, string> = {
  scheduled:   'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed:   'bg-green-100 text-green-700',
  missed:      'bg-red-100 text-red-700',
  scanned:     'bg-green-100 text-green-700',
  pending:     'bg-gray-100 text-gray-600',
  issue:       'bg-red-100 text-red-700',
};
const SHIFT_COLOR: Record<string, string> = {
  A: 'bg-green-100 text-green-700',
  B: 'bg-blue-100 text-blue-700',
  C: 'bg-purple-100 text-purple-700',
};

export default function Patrols() {
  const { user, isRole } = useAuth();

  const [patrols, setPatrols]   = useState<Patrol[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [toast, setToast]       = useState('');

  const [showStart, setShowStart]   = useState(false);
  const [startShift, setStartShift] = useState<'A'|'B'|'C'>('A');
  const [starting, setStarting]     = useState(false);

  const [activePatrol, setActivePatrol]           = useState<Patrol | null>(null);
  const [patrolCheckpoints, setPatrolCheckpoints] = useState<PatrolCheckpoint[]>([]);
  const [loadingDetail, setLoadingDetail]         = useState(false);

  const [scanModal, setScanModal]       = useState<PatrolCheckpoint | null>(null);
  const [gpsState, setGpsState]         = useState<'idle'|'checking'|'ok'|'far'|'error'>('idle');
  const [gpsCoords, setGpsCoords]       = useState<{lat:number,lon:number}|null>(null);
  const [gpsDistance, setGpsDistance]   = useState<number|null>(null);
  const [scanNote, setScanNote]         = useState('');
  const [scanIncident, setScanIncident] = useState('');
  const [showIncident, setShowIncident] = useState(false);
  const [submitting, setSubmitting]     = useState(false);

  const [allCheckpoints, setAllCheckpoints] = useState<Checkpoint[]>([]);
  const [loadingQR, setLoadingQR]           = useState(false);
  const [showQRPage, setShowQRPage]         = useState(false);

  const [completeNote, setCompleteNote] = useState('');
  const [showComplete, setShowComplete] = useState(false);
  const [completing, setCompleting]     = useState(false);

  const isGuard      = isRole('security_guard');
  const isSupervisor = isRole('security_supervisor');
  const isAdmin      = isRole('system_admin', 'security_manager');

  const load = useCallback(() => {
    setLoading(true); setError('');
    patrolApi.list()
      .then((d: any) => setPatrols(d.patrols || []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  function showToast(msg: string) {
    setToast(msg); setTimeout(() => setToast(''), 3000);
  }

  async function openPatrolDetail(p: Patrol) {
    setActivePatrol(p); setLoadingDetail(true);
    try {
      const d: any = await patrolApi.get(p.id);
      setPatrolCheckpoints(d.checkpoints || []);
    } catch { showToast('Failed to load patrol detail'); }
    finally { setLoadingDetail(false); }
  }

  async function handleStartPatrol() {
    setStarting(true);
    try {
      const now = new Date();
      const shiftEnd = new Date(now);
      if (startShift === 'A') { shiftEnd.setHours(14,0,0,0); }
      else if (startShift === 'B') { shiftEnd.setHours(22,0,0,0); }
      else { shiftEnd.setHours(6,0,0,0); shiftEnd.setDate(shiftEnd.getDate()+1); }
      const d: any = await (api.post as any)('/patrols', {
        shift: startShift,
        site_id: 1,
        guard_id: user?.id,
        scheduled_start: now.toISOString(),
        scheduled_end: shiftEnd.toISOString(),
      });
      const patrolId = d.patrol?.id;
      if (patrolId) {
        await (api.post as any)(`/patrols/${patrolId}/start`, {});
        const started: any = await patrolApi.get(patrolId);
        setShowStart(false);
        showToast('Patrol started!');
        load();
        setActivePatrol(started.patrol);
        setPatrolCheckpoints(started.checkpoints || []);
      }
    } catch (e: any) { showToast(`Error: ${e.message}`); }
    finally { setStarting(false); }
  }

  function checkGPS(cp: PatrolCheckpoint) {
    setScanModal(cp);
    setScanNote(''); setScanIncident(''); setShowIncident(false);
    setGpsState('checking'); setGpsCoords(null); setGpsDistance(null);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude, lon = pos.coords.longitude;
        setGpsCoords({ lat, lon });
        const dist = distanceM(lat, lon, cp.latitude, cp.longitude);
        setGpsDistance(Math.round(dist));
        setGpsState(dist <= 100 ? 'ok' : 'far');
      },
      () => setGpsState('error'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function submitScan() {
    if (!scanModal || !activePatrol) return;
    if (gpsState !== 'ok') { showToast('You must be within 100 m of the checkpoint'); return; }
    setSubmitting(true);
    try {
      await (api.patch as any)(`/patrols/${activePatrol.id}/checkpoints/${scanModal.id}`, {
        status: 'scanned',
        notes: scanNote || null,
        latitude: gpsCoords?.lat,
        longitude: gpsCoords?.lon,
        incident_description: scanIncident || null,
      });
      setScanModal(null);
      showToast(`✓ ${scanModal.checkpoint_name} marked`);
      const d: any = await patrolApi.get(activePatrol.id);
      setPatrolCheckpoints(d.checkpoints || []);
    } catch (e: any) { showToast(`Error: ${e.message}`); }
    finally { setSubmitting(false); }
  }

  async function handleComplete() {
    if (!activePatrol) return;
    setCompleting(true);
    try {
      await patrolApi.complete(activePatrol.id);
      setShowComplete(false); setActivePatrol(null); setPatrolCheckpoints([]);
      showToast('Patrol completed successfully!');
      load();
    } catch (e: any) { showToast(`Error: ${e.message}`); }
    finally { setCompleting(false); }
  }

  async function openQRPage() {
    setShowQRPage(true); setLoadingQR(true);
    try {
      const d: any = await (api.get as any)('/sites/1/checkpoints');
      setAllCheckpoints(d.checkpoints || []);
    } catch { showToast('Failed to load checkpoints'); }
    finally { setLoadingQR(false); }
  }

  const myActivePatrol = patrols.find(p =>
    p.status === 'in_progress' && p.guard_employee_id === user?.employee_id
  );

  return (
    <Layout>
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-primary text-white text-sm shadow-xl">
          {toast} <button onClick={() => setToast('')}><X size={14}/></button>
        </div>
      )}

      <header className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-primary">Patrols</h2>
          <p className="text-text-muted text-sm">Security patrol operations — ITC Limited, Khordha</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg border border-border hover:bg-surface-alt transition-colors text-text-muted">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          {isAdmin && (
            <button onClick={openQRPage}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-surface-alt transition-colors">
              <QrCode size={16}/> QR Codes
            </button>
          )}
          {(isGuard || isSupervisor) && !myActivePatrol && (
            <button onClick={() => setShowStart(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors">
              <Play size={16}/> Start Patrol
            </button>
          )}
          {(isGuard || isSupervisor) && myActivePatrol && (
            <button onClick={() => openPatrolDetail(myActivePatrol)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors">
              <ShieldCheck size={16}/> Active Patrol
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-danger/10 text-danger text-sm">
          <AlertCircle size={16}/> {error}
        </div>
      )}

      {loading && patrols.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-text-muted gap-2">
          <Loader2 size={20} className="animate-spin"/> Loading…
        </div>
      ) : (
        <div className="space-y-3">
          {patrols.map(p => (
            <div key={p.id} onClick={() => openPatrolDetail(p)}
              className={cn('cursor-pointer bg-white rounded-xl border p-4 hover:shadow-md transition-shadow',
                p.status === 'in_progress' ? 'border-amber-300' : 'border-border'
              )}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className={cn('p-2 rounded-lg', p.status==='in_progress' ? 'bg-amber-100 text-amber-600' : 'bg-accent/10 text-accent')}>
                    <ShieldCheck size={18}/>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-primary">
                      Patrol #{p.id} — {p.guard_name}
                      <span className="text-text-muted font-normal ml-1">({p.guard_employee_id})</span>
                    </p>
                    <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                      <MapPin size={11}/> {p.site_name}
                      <span className="mx-1">·</span>
                      <Clock size={11}/> {fmtDate(p.scheduled_start)} {fmtTime(p.actual_start || p.scheduled_start)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {p.shift && (
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold', SHIFT_COLOR[p.shift])}>
                      Shift {p.shift}
                    </span>
                  )}
                  <span className={cn('text-xs px-2 py-1 rounded-full font-medium', STATUS_COLOR[p.status])}>
                    {p.status.replace('_',' ')}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {patrols.length === 0 && (
            <div className="text-center text-text-muted py-16">
              <ShieldCheck size={40} className="mx-auto mb-3 opacity-20"/>
              <p className="font-medium">No patrols yet</p>
              {(isGuard || isSupervisor) && <p className="text-sm mt-1">Click "Start Patrol" to begin</p>}
            </div>
          )}
        </div>
      )}

      {/* START PATROL MODAL */}
      {showStart && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-primary flex items-center gap-2">
                <Play size={16}/> Start New Patrol
              </h3>
              <button onClick={() => setShowStart(false)} className="p-1 rounded-md hover:bg-surface-alt text-text-muted"><X size={16}/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-text-muted block mb-2">Select Your Shift</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['A','B','C'] as const).map(s => (
                    <button key={s} onClick={() => setStartShift(s)}
                      className={cn('py-3 rounded-xl border-2 text-sm font-bold transition-all',
                        startShift === s
                          ? s==='A' ? 'border-green-500 bg-green-50 text-green-700'
                            : s==='B' ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-purple-500 bg-purple-50 text-purple-700'
                          : 'border-border text-text-muted hover:border-accent/40'
                      )}>
                      Shift {s}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-text-muted mt-2">
                  {startShift === 'A' ? '06:00 – 14:00' : startShift === 'B' ? '14:00 – 22:00' : '22:00 – 06:00'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                <p className="text-xs text-blue-700 font-medium">📍 Site: ITC Limited, Khordha</p>
                <p className="text-xs text-blue-600 mt-1">Date & Time: {new Date().toLocaleString('en-IN')}</p>
                <p className="text-xs text-blue-600 mt-0.5">13 checkpoints · Every 2 hours</p>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowStart(false)}
                className="flex-1 px-4 py-2 text-sm border border-border rounded-xl hover:bg-surface-alt transition-colors">Cancel</button>
              <button onClick={handleStartPatrol} disabled={starting}
                className="flex-1 px-4 py-2 text-sm bg-accent text-white rounded-xl hover:bg-accent/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {starting ? <Loader2 size={14} className="animate-spin"/> : <Play size={14}/>} Start
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PATROL DETAIL MODAL */}
      {activePatrol && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h3 className="text-base font-semibold text-primary flex items-center gap-2">
                  <ShieldCheck size={16}/> Patrol #{activePatrol.id}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  {activePatrol.guard_name} · {fmtDate(activePatrol.actual_start || activePatrol.scheduled_start)}
                  {activePatrol.shift && ` · Shift ${activePatrol.shift}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn('text-xs px-2 py-1 rounded-full font-medium', STATUS_COLOR[activePatrol.status])}>
                  {activePatrol.status.replace('_',' ')}
                </span>
                <button onClick={() => { setActivePatrol(null); setPatrolCheckpoints([]); }}
                  className="p-1 rounded-md hover:bg-surface-alt text-text-muted"><X size={16}/></button>
              </div>
            </div>

            {patrolCheckpoints.length > 0 && (
              <div className="px-5 pt-3">
                <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                  <span>Progress</span>
                  <span>{patrolCheckpoints.filter(c=>c.status==='scanned').length}/{patrolCheckpoints.length} checkpoints</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-accent transition-all rounded-full"
                    style={{width: `${(patrolCheckpoints.filter(c=>c.status==='scanned').length/patrolCheckpoints.length)*100}%`}}/>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {loadingDetail ? (
                <div className="flex items-center justify-center py-8 text-text-muted gap-2">
                  <Loader2 size={18} className="animate-spin"/> Loading checkpoints…
                </div>
              ) : patrolCheckpoints.map(cp => (
                <div key={cp.id}
                  className={cn('flex items-center justify-between p-3 rounded-xl border transition-all',
                    cp.status === 'scanned' ? 'bg-green-50 border-green-200' : 'bg-white border-border'
                  )}>
                  <div className="flex items-center gap-3">
                    <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
                      cp.status === 'scanned' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500')}>
                      {cp.status === 'scanned' ? <CheckCircle2 size={16}/> : cp.checkpoint_code.slice(-2)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-primary">{cp.checkpoint_name}</p>
                      <p className="text-xs text-text-muted">{cp.checkpoint_code}
                        {cp.scanned_at && ` · ${fmtTime(cp.scanned_at)}`}
                      </p>
                    </div>
                  </div>
                  {activePatrol.status === 'in_progress' && cp.status !== 'scanned' && (
                    <button onClick={() => checkGPS(cp)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors">
                      <QrCode size={12}/> Scan
                    </button>
                  )}
                  {cp.status === 'scanned' && (
                    <CheckCircle2 size={18} className="text-green-500 shrink-0"/>
                  )}
                </div>
              ))}
            </div>

            {activePatrol.status === 'in_progress' && (
              <div className="p-5 border-t border-border">
                <button onClick={() => setShowComplete(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 text-white font-medium text-sm hover:bg-green-700 transition-colors">
                  <CheckSquare size={16}/> Complete Patrol
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* GPS + SCAN MODAL */}
      {scanModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[60] p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h3 className="text-base font-semibold text-primary flex items-center gap-2">
                <QrCode size={16}/> {scanModal.checkpoint_name}
              </h3>
              <button onClick={() => setScanModal(null)} className="p-1 rounded-md hover:bg-surface-alt text-text-muted"><X size={16}/></button>
            </div>
            <div className="p-5 space-y-4">
              <div className={cn('p-4 rounded-xl border-2 text-center',
                gpsState === 'checking' ? 'border-blue-200 bg-blue-50' :
                gpsState === 'ok'       ? 'border-green-300 bg-green-50' :
                gpsState === 'far'      ? 'border-red-300 bg-red-50' :
                gpsState === 'error'    ? 'border-orange-300 bg-orange-50' : 'border-border bg-surface-alt'
              )}>
                {gpsState === 'checking' && (
                  <><Loader2 size={24} className="animate-spin mx-auto mb-2 text-blue-500"/>
                  <p className="text-sm font-medium text-blue-700">Getting your location…</p></>
                )}
                {gpsState === 'ok' && (
                  <><CheckCircle2 size={28} className="mx-auto mb-2 text-green-500"/>
                  <p className="text-sm font-bold text-green-700">✓ Location Verified</p>
                  <p className="text-xs text-green-600 mt-1">You are {gpsDistance}m from the checkpoint</p></>
                )}
                {gpsState === 'far' && (
                  <><Navigation size={28} className="mx-auto mb-2 text-red-500"/>
                  <p className="text-sm font-bold text-red-700">Too Far Away</p>
                  <p className="text-xs text-red-600 mt-1">You are {gpsDistance}m away. Must be within 100m.</p>
                  <button onClick={() => checkGPS(scanModal)} className="mt-2 text-xs text-red-600 underline">Try again</button></>
                )}
                {gpsState === 'error' && (
                  <><AlertCircle size={28} className="mx-auto mb-2 text-orange-500"/>
                  <p className="text-sm font-bold text-orange-700">GPS Error</p>
                  <p className="text-xs text-orange-600 mt-1">Please enable location access and try again.</p>
                  <button onClick={() => checkGPS(scanModal)} className="mt-2 text-xs text-orange-600 underline">Retry</button></>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-text-muted block mb-1 flex items-center gap-1">
                  <FileText size={12}/> Observation Note <span className="text-gray-400">(optional)</span>
                </label>
                <textarea value={scanNote} onChange={e => setScanNote(e.target.value)}
                  rows={2} placeholder="Everything normal / any observation…"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"/>
              </div>

              <div>
                <button onClick={() => setShowIncident(v => !v)}
                  className="flex items-center gap-2 text-xs font-medium text-danger hover:text-danger/80 transition-colors">
                  <TriangleAlert size={13}/>
                  {showIncident ? 'Hide' : 'Report an Incident'} (optional)
                  {showIncident ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                </button>
                {showIncident && (
                  <textarea value={scanIncident} onChange={e => setScanIncident(e.target.value)}
                    rows={2} placeholder="Describe the incident…"
                    className="mt-2 w-full border border-danger/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-danger/20 resize-none"/>
                )}
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button onClick={() => setScanModal(null)}
                className="flex-1 py-2.5 text-sm border border-border rounded-xl hover:bg-surface-alt transition-colors">Cancel</button>
              <button onClick={submitScan} disabled={submitting || gpsState !== 'ok'}
                className="flex-1 py-2.5 text-sm bg-accent text-white rounded-xl hover:bg-accent/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {submitting ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle2 size={14}/>} Mark Visited
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPLETE PATROL MODAL */}
      {showComplete && activePatrol && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-primary mb-4 flex items-center gap-2">
              <CheckSquare size={16}/> Complete Patrol
            </h3>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 mb-4">
              <p className="text-xs text-amber-700">
                {patrolCheckpoints.filter(c=>c.status==='scanned').length} of {patrolCheckpoints.length} checkpoints visited.
                {patrolCheckpoints.some(c=>c.status!=='scanned') && ' Some checkpoints are still pending.'}
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-text-muted block mb-1">
                Summary Note <span className="text-gray-400">(optional)</span>
              </label>
              <textarea value={completeNote} onChange={e => setCompleteNote(e.target.value)}
                rows={3} placeholder="Overall patrol summary…"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"/>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowComplete(false)}
                className="flex-1 py-2.5 text-sm border border-border rounded-xl hover:bg-surface-alt transition-colors">Cancel</button>
              <button onClick={handleComplete} disabled={completing || patrolCheckpoints.some(c => c.status !== 'scanned')}
                className="flex-1 py-2.5 text-sm bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {completing ? <Loader2 size={14} className="animate-spin"/> : <CheckSquare size={14}/>} Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR CODES PAGE - Admin/Manager only */}
      {showQRPage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="text-base font-semibold text-primary flex items-center gap-2">
                <QrCode size={16}/> Checkpoint QR Codes — ITC Limited, Khordha
              </h3>
              <button onClick={() => setShowQRPage(false)} className="p-1 rounded-md hover:bg-surface-alt text-text-muted"><X size={16}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {loadingQR ? (
                <div className="flex items-center justify-center py-8 gap-2 text-text-muted">
                  <Loader2 size={18} className="animate-spin"/> Loading…
                </div>
              ) : (
                <>
                  <p className="text-xs text-text-muted mb-4">Print these QR codes and place them at each checkpoint. Guards must be within 20 meters to scan.</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {allCheckpoints.map(cp => (
                      <div key={cp.id} className="border border-border rounded-xl p-3 text-center hover:shadow-md transition-shadow">
                        <div className="flex justify-center mb-2">
                          <div className="w-20 h-20 bg-gray-50 rounded-lg flex items-center justify-center">
                            <QrCode size={40} className="text-gray-400"/>
                          </div>
                        </div>
                        <p className="text-xs font-bold text-primary">{cp.name}</p>
                        <p className="text-xs text-text-muted font-mono">{cp.qr_code}</p>
                        <p className="text-xs text-text-muted mt-1">{cp.latitude.toFixed(4)}, {cp.longitude.toFixed(4)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 p-3 rounded-xl bg-blue-50 border border-blue-200">
                    <p className="text-xs text-blue-700 font-medium">📋 How to use:</p>
                    <p className="text-xs text-blue-600 mt-1">1. Print this page (Ctrl+P)<br/>2. Cut out each QR code<br/>3. Laminate and place at each checkpoint location<br/>4. Guards tap "Scan" button when within 100m</p>
                  </div>
                </>
              )}
            </div>
            <div className="p-5 border-t border-border">
              <button onClick={() => window.print()}
                className="w-full py-2.5 text-sm bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors">
                🖨️ Print All QR Codes
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
