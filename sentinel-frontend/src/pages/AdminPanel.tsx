import { useState, useEffect, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import {
  ShieldCheck, Trash2, CheckSquare, Loader2, RefreshCw,
  AlertTriangle, CheckCircle2, Search, FileSpreadsheet, FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

interface Patrol {
  id: number;
  shift: string | null;
  status: string;
  scheduled_start: string;
  actual_start: string | null;
  actual_end: string | null;
  notes: string | null;
  guard_name: string;
  guard_employee_id: string;
  site_name: string;
}

const STATUS_COLOR: Record<string, string> = {
  scheduled:   'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed:   'bg-green-100 text-green-700',
  missed:      'bg-red-100 text-red-700',
};

function parseUTC(iso: string) {
  return new Date(iso.includes('Z') || iso.includes('+') ? iso : iso + 'Z');
}
function fmtDateTime(iso: string | null) {
  if (!iso) return '—';
  return parseUTC(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

// ── Excel (CSV) Export ────────────────────────────────────────────────────
function exportCSV(patrols: Patrol[]) {
  const headers = [
    'Patrol ID', 'Guard Name', 'Employee ID', 'Site', 'Shift',
    'Status', 'Scheduled Start', 'Actual Start', 'Actual End', 'Notes'
  ];
  const rows = patrols.map(p => [
    p.id,
    p.guard_name,
    p.guard_employee_id,
    p.site_name,
    p.shift ? `Shift ${p.shift}` : '—',
    p.status,
    fmtDateTime(p.scheduled_start),
    fmtDateTime(p.actual_start),
    fmtDateTime(p.actual_end),
    (p.notes || '').replace(/,/g, ';'),
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Sentinel_Patrols_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── PDF Export ────────────────────────────────────────────────────────────
function exportPDF(patrols: Patrol[]) {
  const now = new Date().toLocaleString('en-IN', { hour12: false });
  const rows = patrols.map(p => `
    <tr>
      <td>#${p.id}</td>
      <td>${p.guard_name}<br/><small>${p.guard_employee_id}</small></td>
      <td>${p.shift ? `Shift ${p.shift}` : '—'}</td>
      <td><span class="badge ${p.status}">${p.status.replace('_', ' ')}</span></td>
      <td>${fmtDateTime(p.actual_start || p.scheduled_start)}</td>
      <td>${fmtDateTime(p.actual_end)}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>Sentinel Patrol Report</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; color: #1a1a2e; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  .meta { color: #666; font-size: 11px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #1a1a2e; color: white; padding: 8px; text-align: left; font-size: 11px; }
  td { padding: 7px 8px; border-bottom: 1px solid #eee; font-size: 11px; }
  tr:nth-child(even) td { background: #f9f9f9; }
  small { color: #888; }
  .badge { padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; }
  .completed { background: #dcfce7; color: #166534; }
  .in_progress { background: #fef9c3; color: #854d0e; }
  .scheduled { background: #dbeafe; color: #1e40af; }
  .missed { background: #fee2e2; color: #991b1b; }
  @media print { body { margin: 0; } }
</style></head>
<body>
  <h1>🛡 Sentinel — Patrol Report</h1>
  <div class="meta">Generated: ${now} &nbsp;|&nbsp; Total records: ${patrols.length}</div>
  <table>
    <thead><tr>
      <th>#ID</th><th>Guard</th><th>Shift</th><th>Status</th><th>Started</th><th>Ended</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body></html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  win?.addEventListener('load', () => {
    win.print();
    URL.revokeObjectURL(url);
  });
}

// ── Component ─────────────────────────────────────────────────────────────
export default function AdminPanel() {
  const [patrols, setPatrols]   = useState<Patrol[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [toast, setToast]       = useState('');
  const [search, setSearch]     = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const [confirmDelete, setConfirmDelete]     = useState<Patrol | null>(null);
  const [confirmComplete, setConfirmComplete] = useState<Patrol | null>(null);
  const [actionNote, setActionNote]           = useState('');
  const [acting, setActing]                   = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }

  const load = useCallback(() => {
    setLoading(true); setError('');
    (api.get as any)('/patrols?limit=500')
      .then((d: any) => setPatrols(d.patrols || []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(patrol: Patrol) {
    setActing(true);
    try {
      await (api.delete as any)(`/patrols/${patrol.id}`);
      showToast(`Patrol #${patrol.id} deleted`);
      setConfirmDelete(null);
      load();
    } catch (e: any) { showToast(`Error: ${e.message}`); }
    finally { setActing(false); }
  }

  async function handleForceComplete(patrol: Patrol) {
    setActing(true);
    try {
      await (api.post as any)(`/patrols/${patrol.id}/force-complete`, {
        notes: actionNote || 'Admin force-completed',
      });
      showToast(`Patrol #${patrol.id} marked as completed`);
      setConfirmComplete(null);
      setActionNote('');
      load();
    } catch (e: any) { showToast(`Error: ${e.message}`); }
    finally { setActing(false); }
  }

  const filtered = patrols.filter(p => {
    const matchStatus = filterStatus === 'all' || p.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      p.guard_name?.toLowerCase().includes(q) ||
      p.guard_employee_id?.toLowerCase().includes(q) ||
      String(p.id).includes(q);
    return matchStatus && matchSearch;
  });

  const counts = {
    all: patrols.length,
    in_progress: patrols.filter(p => p.status === 'in_progress').length,
    completed:   patrols.filter(p => p.status === 'completed').length,
    scheduled:   patrols.filter(p => p.status === 'scheduled').length,
    missed:      patrols.filter(p => p.status === 'missed').length,
  };

  return (
    <Layout>
      {toast && (
        <div className="fixed top-4 right-4 z-[100] bg-primary text-white px-4 py-2.5 rounded-xl shadow-lg text-sm animate-in fade-in">
          {toast}
        </div>
      )}

      <div className="max-w-5xl mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-primary flex items-center gap-2">
              <ShieldCheck size={20}/> Admin Panel
            </h1>
            <p className="text-xs text-text-muted mt-0.5">Delete test entries · Force-complete patrols · Export reports</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => exportCSV(filtered)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-green-300 text-green-700 bg-green-50 text-sm hover:bg-green-100 transition-colors">
              <FileSpreadsheet size={14}/> Excel
            </button>
            <button onClick={() => exportPDF(filtered)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-300 text-red-700 bg-red-50 text-sm hover:bg-red-100 transition-colors">
              <FileText size={14}/> PDF
            </button>
            <button onClick={load}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-surface-alt">
              <RefreshCw size={14}/> Refresh
            </button>
          </div>
        </div>

        {/* Status tabs */}
        <div className="flex gap-2 flex-wrap">
          {(['all','in_progress','scheduled','completed','missed'] as const).map(key => (
            <button key={key} onClick={() => setFilterStatus(key)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                filterStatus === key
                  ? 'bg-accent text-white border-accent'
                  : 'border-border text-text-muted hover:bg-surface-alt'
              )}>
              {key.replace('_', ' ')} <span className="opacity-70">({counts[key]})</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by guard name, employee ID, patrol ID…"
            className="w-full pl-8 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"/>
        </div>

        {/* Export info */}
        <p className="text-xs text-text-muted">
          Showing {filtered.length} of {patrols.length} patrols. Excel/PDF exports apply current filter.
        </p>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-text-muted">
            <Loader2 size={20} className="animate-spin"/> Loading patrols…
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-text-muted text-sm">No patrols found.</div>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-surface-alt border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Guard</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Shift</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Started</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted">Ended</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-text-muted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-surface-alt/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-text-muted">#{p.id}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-primary text-xs">{p.guard_name}</p>
                      <p className="text-xs text-text-muted">{p.guard_employee_id}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted">{p.shift ? `Shift ${p.shift}` : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLOR[p.status] || 'bg-gray-100 text-gray-600')}>
                        {p.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted">{fmtDateTime(p.actual_start || p.scheduled_start)}</td>
                    <td className="px-4 py-3 text-xs text-text-muted">{fmtDateTime(p.actual_end)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {p.status === 'in_progress' && (
                          <button onClick={() => { setConfirmComplete(p); setActionNote(''); }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-50 border border-green-200 text-green-700 text-xs font-medium hover:bg-green-100">
                            <CheckSquare size={11}/> Complete
                          </button>
                        )}
                        <button onClick={() => setConfirmDelete(p)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs font-medium hover:bg-red-100">
                          <Trash2 size={11}/> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[80] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-600"/>
              </div>
              <div>
                <h3 className="font-semibold text-primary">Delete Patrol #{confirmDelete.id}?</h3>
                <p className="text-xs text-text-muted mt-1">
                  Permanently deletes patrol by <strong>{confirmDelete.guard_name}</strong> ({fmtDateTime(confirmDelete.actual_start || confirmDelete.scheduled_start)}).
                  All checkpoint records will also be removed. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 text-sm border border-border rounded-xl hover:bg-surface-alt">Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)} disabled={acting}
                className="flex-1 py-2.5 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 flex items-center justify-center gap-2 disabled:opacity-50">
                {acting ? <Loader2 size={13} className="animate-spin"/> : <Trash2 size={13}/>} Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Force complete confirm */}
      {confirmComplete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[80] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <CheckCircle2 size={18} className="text-green-600"/>
              </div>
              <div>
                <h3 className="font-semibold text-primary">Force Complete Patrol #{confirmComplete.id}?</h3>
                <p className="text-xs text-text-muted mt-1">
                  Marks the in-progress patrol by <strong>{confirmComplete.guard_name}</strong> as completed immediately, regardless of pending checkpoints.
                </p>
              </div>
            </div>
            <div className="mb-4">
              <label className="text-xs font-medium text-text-muted block mb-1">Admin Note (optional)</label>
              <textarea value={actionNote} onChange={e => setActionNote(e.target.value)}
                rows={2} placeholder="Reason for force completing…"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"/>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmComplete(null)} className="flex-1 py-2.5 text-sm border border-border rounded-xl hover:bg-surface-alt">Cancel</button>
              <button onClick={() => handleForceComplete(confirmComplete)} disabled={acting}
                className="flex-1 py-2.5 text-sm bg-green-600 text-white rounded-xl hover:bg-green-700 flex items-center justify-center gap-2 disabled:opacity-50">
                {acting ? <Loader2 size={13} className="animate-spin"/> : <CheckSquare size={13}/>} Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
