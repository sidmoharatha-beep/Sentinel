import { useState, useEffect, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import {
  ShieldCheck, Clock, MapPin, Search, Filter, Plus,
  ChevronRight, Play, CheckSquare, RefreshCw, AlertCircle,
  Loader2, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { patrolApi } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';

interface Patrol {
  id: number;
  shift: 'A' | 'B' | 'C';
  status: string;
  scheduled_start: string;
  scheduled_end: string;
  actual_start: string | null;
  actual_end: string | null;
  notes: string | null;
  route_name: string | null;
  guard_name: string;
  guard_employee_id: string;
  site_name: string;
}

const SHIFT_STYLE: Record<string, string> = {
  A: 'text-green-700 bg-green-50 border-green-200',
  B: 'text-blue-700 bg-blue-50 border-blue-200',
  C: 'text-purple-700 bg-purple-50 border-purple-200',
};

function formatTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short' });
}

export default function Patrols() {
  const { isRole } = useAuth();

  const [patrols, setPatrols]     = useState<Patrol[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [filter, setFilter]       = useState('all');
  const [shiftFilter, setShiftFilter] = useState('all');
  const [search, setSearch]       = useState('');
  const [actionId, setActionId]   = useState<number | null>(null);
  const [toast, setToast]         = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    patrolApi.list()
      .then((d: any) => setPatrols(d.patrols || []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function handleStart(id: number) {
    setActionId(id);
    try {
      await patrolApi.start(id);
      showToast('Patrol started successfully');
      load();
    } catch (e: any) {
      showToast(`Error: ${e.message}`);
    } finally {
      setActionId(null);
    }
  }

  async function handleComplete(id: number) {
    setActionId(id);
    try {
      await patrolApi.complete(id);
      showToast('Patrol marked as completed');
      load();
    } catch (e: any) {
      showToast(`Error: ${e.message}`);
    } finally {
      setActionId(null);
    }
  }

  const filtered = patrols.filter(p => {
    if (filter !== 'all' && p.status !== filter) return false;
    if (shiftFilter !== 'all' && p.shift !== shiftFilter) return false;
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      p.guard_name?.toLowerCase().includes(q) ||
      p.guard_employee_id?.toLowerCase().includes(q) ||
      p.site_name?.toLowerCase().includes(q) ||
      p.route_name?.toLowerCase().includes(q) ||
      String(p.id).includes(q)
    );
  });

  const canAct = isRole('system_admin', 'security_supervisor', 'security_guard');

  return (
    <Layout>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg bg-primary text-white text-sm shadow-lg">
          {toast}
          <button onClick={() => setToast('')}><X size={14} /></button>
        </div>
      )}

      <header className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-primary">Patrols</h2>
          <p className="text-text-muted text-sm">Manage and monitor security patrol operations.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg border border-border hover:bg-surface transition-colors text-text-muted" title="Refresh">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          {isRole('system_admin', 'security_manager', 'security_supervisor') && (
            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-light transition-colors">
              <Plus size={16} /> Schedule Patrol
            </button>
          )}
        </div>
      </header>

      {/* Filters */}
      <Card className="mb-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={15} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search guard, site, route…"
              className="w-full pl-9 pr-3 py-2 rounded-md border border-border bg-surface-alt text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={15} className="text-text-muted" />
            {['all', 'in_progress', 'completed', 'scheduled', 'missed'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={cn('px-2.5 py-1 rounded-md text-xs font-medium border transition-colors',
                  filter === f ? 'bg-accent text-white border-accent' : 'bg-surface-alt text-text-muted border-border hover:border-accent/40'
                )}>
                {f === 'all' ? 'All' : f.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </button>
            ))}
            <span className="w-px h-4 bg-border" />
            {['all', 'A', 'B', 'C'].map(s => (
              <button key={s} onClick={() => setShiftFilter(s)}
                className={cn('px-2.5 py-1 rounded-md text-xs font-medium border transition-colors',
                  shiftFilter === s ? 'bg-primary text-white border-primary' : 'bg-surface-alt text-text-muted border-border hover:border-primary/40'
                )}>
                {s === 'all' ? 'All Shifts' : `Shift ${s}`}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-danger/10 text-danger text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* List */}
      {loading && patrols.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-text-muted gap-2">
          <Loader2 size={20} className="animate-spin" /> Loading patrols…
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(p => (
            <Card key={p.id} className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="p-2.5 rounded-lg bg-accent/10 text-accent shrink-0">
                  <ShieldCheck size={17} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-primary truncate">
                      #{p.id} — {p.guard_name}
                    </p>
                    <span className="text-xs text-text-muted shrink-0">({p.guard_employee_id})</span>
                  </div>
                  <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5 truncate">
                    <MapPin size={11} /> {p.site_name}
                    {p.route_name && <> · {p.route_name}</>}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                {p.shift && (
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold border', SHIFT_STYLE[p.shift])}>
                    Shift {p.shift}
                  </span>
                )}
                <div className="flex items-center gap-1 text-xs text-text-muted">
                  <Clock size={12} />
                  {formatDate(p.scheduled_start)} · {formatTime(p.scheduled_start)}–{formatTime(p.scheduled_end)}
                </div>
                <Badge variant={p.status as any}>{p.status.replace('_', ' ')}</Badge>

                {/* Action buttons */}
                {canAct && (
                  <>
                    {p.status === 'scheduled' && (
                      <button
                        onClick={() => handleStart(p.id)}
                        disabled={actionId === p.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent-light disabled:opacity-50 transition-colors"
                      >
                        {actionId === p.id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                        Start
                      </button>
                    )}
                    {p.status === 'in_progress' && (
                      <button
                        onClick={() => handleComplete(p.id)}
                        disabled={actionId === p.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-success text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-colors"
                      >
                        {actionId === p.id ? <Loader2 size={12} className="animate-spin" /> : <CheckSquare size={12} />}
                        Complete
                      </button>
                    )}
                  </>
                )}
                <button className="p-1.5 rounded-md hover:bg-surface-alt text-text-muted">
                  <ChevronRight size={15} />
                </button>
              </div>
            </Card>
          ))}
          {filtered.length === 0 && !loading && (
            <div className="text-center text-text-muted py-12">
              <ShieldCheck size={32} className="mx-auto mb-2 opacity-30" />
              No patrols match your filters.
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
