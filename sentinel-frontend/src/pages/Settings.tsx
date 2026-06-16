import { useState, useEffect, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { Card } from '@/components/Card';
import { useAuth } from '@/lib/AuthContext';
import { api, patrolApi } from '@/lib/api';
import {
  Users, Shield, Info, Loader2, AlertCircle,
  RefreshCw, CheckCircle2, Building2, Pencil, Trash2, KeyRound, X, Save,
  Download, FileSpreadsheet, FileText, StopCircle, ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ROLE_LABELS: Record<string, string> = {
  system_admin:        'System Admin',
  security_manager:    'Security Manager',
  security_supervisor: 'Supervisor',
  security_guard:      'Guard',
};

const ROLE_COLORS: Record<string, string> = {
  system_admin:        'bg-red-100 text-red-700',
  security_manager:    'bg-orange-100 text-orange-700',
  security_supervisor: 'bg-blue-100 text-blue-700',
  security_guard:      'bg-green-100 text-green-700',
};

interface UserRecord {
  id: number;
  employee_id: string;
  full_name: string;
  role: string;
  shift: string | null;
  phone: string | null;
  is_active: number;
  email: string;
  created_at: string;
}

type ModalType = 'edit' | 'reset_password' | 'delete' | 'add' | null;

interface ModalState {
  type: ModalType;
  user: UserRecord | null;
}

export default function Settings() {
  const { user, isRole } = useAuth();
  const [users, setUsers]         = useState<UserRecord[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');
  const [tab, setTab]             = useState<'users' | 'system' | 'admin'>('users');
  const [modal, setModal]         = useState<ModalState>({ type: null, user: null });
  const [saving, setSaving]       = useState(false);

  // Edit form state
  const [editName, setEditName]   = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole]   = useState('');

  // Add user form state
  const [addEmpId, setAddEmpId]     = useState('');
  const [addUsername, setAddUsername] = useState('');
  const [addName, setAddName]       = useState('');
  const [addEmail, setAddEmail]     = useState('');
  const [addPhone, setAddPhone]     = useState('');
  const [addRole, setAddRole]       = useState('security_guard');
  const [addPassword, setAddPassword] = useState('');

  // Reset password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Admin panel state
  const [patrols, setPatrols]           = useState<any[]>([]);
  const [patrolsLoading, setPatrolsLoading] = useState(false);
  const [exportLoading, setExportLoading]   = useState(false);
  const [exportDateFrom, setExportDateFrom] = useState('');
  const [exportDateTo, setExportDateTo]     = useState('');
  const [adminAction, setAdminAction]       = useState<{type: 'delete'|'force_complete', patrol: any} | null>(null);

  const loadUsers = useCallback(() => {
    if (!isRole('system_admin', 'security_manager', 'security_supervisor')) return;
    setLoading(true);
    setError('');
    (api.get('/auth/users') as Promise<any>)
      .then((d: any) => setUsers(d.users || []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [isRole]);

  const loadPatrols = useCallback(() => {
    if (!isRole('system_admin', 'security_manager')) return;
    setPatrolsLoading(true);
    (patrolApi.list({ status: 'in_progress' }) as Promise<any>)
      .then((d: any) => {
        // Also fetch scheduled+test
        (patrolApi.list() as Promise<any>).then((all: any) => {
          setPatrols(all.patrols || []);
        }).catch(() => setPatrols(d.patrols || []));
      })
      .catch(() => setPatrols([]))
      .finally(() => setPatrolsLoading(false));
  }, [isRole]);

  useEffect(() => {
    if (tab === 'users') loadUsers();
    if (tab === 'admin') loadPatrols();
  }, [tab, loadUsers, loadPatrols]);

  function openEdit(u: UserRecord) {
    setEditName(u.full_name);
    setEditEmail(u.email);
    setEditPhone(u.phone || '');
    setEditRole(u.role);
    setModal({ type: 'edit', user: u });
    setError(''); setSuccess('');
  }

  function openResetPassword(u: UserRecord) {
    setNewPassword(''); setConfirmPassword('');
    setModal({ type: 'reset_password', user: u });
    setError(''); setSuccess('');
  }

  function openDelete(u: UserRecord) {
    setModal({ type: 'delete', user: u });
    setError(''); setSuccess('');
  }

  function openAdd() {
    setAddEmpId(''); setAddUsername(''); setAddName('');
    setAddEmail(''); setAddPhone(''); setAddRole('security_guard'); setAddPassword('');
    setModal({ type: 'add', user: null });
    setError(''); setSuccess('');
  }

  function closeModal() {
    setModal({ type: null, user: null });
    setError(''); setSuccess('');
  }

  function showSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  }

  async function handleEdit() {
    if (!modal.user) return;
    if (!editName.trim()) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try {
      await api.patch(`/auth/users/${modal.user.id}`, {
        full_name: editName.trim(),
        email: editEmail.trim(),
        phone: editPhone.trim() || null,
        role: editRole,
      });
      setUsers(prev => prev.map(u => u.id === modal.user!.id
        ? { ...u, full_name: editName.trim(), email: editEmail.trim(), phone: editPhone.trim() || null, role: editRole }
        : u
      ));
      closeModal();
      showSuccess(`${editName} updated successfully`);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleResetPassword() {
    if (!modal.user) return;
    if (!newPassword) { setError('Password is required'); return; }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    setSaving(true); setError('');
    try {
      await api.patch(`/auth/users/${modal.user.id}`, { password: newPassword });
      closeModal();
      showSuccess(`Password reset for ${modal.user.full_name}`);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!modal.user) return;
    setSaving(true); setError('');
    try {
      await api.delete(`/auth/users/${modal.user.id}`);
      setUsers(prev => prev.filter(u => u.id !== modal.user!.id));
      closeModal();
      showSuccess(`${modal.user.full_name} deleted successfully`);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleAdd() {
    if (!addEmpId || !addUsername || !addName || !addEmail || !addPassword) {
      setError('All fields except phone are required'); return;
    }
    setSaving(true); setError('');
    try {
      const res: any = await api.post('/auth/users', {
        employee_id: addEmpId.trim(),
        username: addUsername.trim(),
        full_name: addName.trim(),
        email: addEmail.trim(),
        phone: addPhone.trim() || null,
        role: addRole,
        password: addPassword,
      });
      setUsers(prev => [...prev, res.user]);
      closeModal();
      showSuccess(`${addName} added successfully`);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function toggleActive(u: UserRecord) {
    if (!isRole('system_admin')) return;
    try {
      await api.patch(`/auth/users/${u.id}`, { is_active: !u.is_active });
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_active: u.is_active ? 0 : 1 } : x));
    } catch (e: any) { setError(e.message); }
  }

  async function handleDeletePatrol(patrol: any) {
    try {
      await patrolApi.delete(patrol.id);
      setPatrols(prev => prev.filter(p => p.id !== patrol.id));
      setAdminAction(null);
      showSuccess(`Patrol #${patrol.id} deleted`);
    } catch (e: any) { setError(e.message); setAdminAction(null); }
  }

  async function handleForceComplete(patrol: any) {
    try {
      await patrolApi.forceComplete(patrol.id);
      setPatrols(prev => prev.map(p => p.id === patrol.id ? { ...p, status: 'completed' } : p));
      setAdminAction(null);
      showSuccess(`Patrol #${patrol.id} marked as completed`);
    } catch (e: any) { setError(e.message); setAdminAction(null); }
  }

  // Build params object without undefined values
  function buildExportParams() {
    const params: Record<string, string> = {};
    if (exportDateFrom) params.date_from = exportDateFrom;
    if (exportDateTo) params.date_to = exportDateTo;
    return params;
  }

  async function handleExportExcel() {
    setExportLoading(true);
    try {
      const d: any = await patrolApi.checklistSubmissions(buildExportParams());
      const rows: any[] = d.submissions || [];
      if (rows.length === 0) { showSuccess('No data to export'); return; }

      // Build CSV
      const headers = [
        'Patrol ID','Shift','Patrol Status','Scheduled Start','Actual Start','Actual End',
        'Guard Name','Employee ID','Site','Checkpoint Code','Checkpoint Name','Area Type',
        'Checkpoint Status','Scanned At','Checkpoint Notes','Latitude','Longitude',
        'Checklist Category','Checklist Item','Response','Response Notes'
      ];
      const escape = (v: any) => {
        if (v == null) return '';
        const s = String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const csvRows = [headers.join(',')];
      rows.forEach(r => {
        csvRows.push([
          r.patrol_id, r.shift, r.patrol_status, r.scheduled_start, r.actual_start, r.actual_end,
          r.guard_name, r.guard_employee_id, r.site_name, r.checkpoint_code, r.checkpoint_name, r.area_type,
          r.checkpoint_status, r.scanned_at, r.checkpoint_notes, r.latitude, r.longitude,
          r.checklist_category, r.checklist_item, r.checklist_response, r.checklist_notes
        ].map(escape).join(','));
      });
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `checklist-submissions-${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showSuccess(`Exported ${rows.length} rows to CSV`);
    } catch (e: any) { setError(e.message); }
    finally { setExportLoading(false); }
  }

  async function handleExportPDF() {
    setExportLoading(true);
    try {
      const d: any = await patrolApi.checklistSubmissions(buildExportParams());
      const rows: any[] = d.submissions || [];
      if (rows.length === 0) { showSuccess('No data to export'); return; }

      // Group by patrol
      const byPatrol: Record<number, any[]> = {};
      rows.forEach(r => {
        if (!byPatrol[r.patrol_id]) byPatrol[r.patrol_id] = [];
        byPatrol[r.patrol_id].push(r);
      });

      const now = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Checklist Submissions</title>
<style>
  body{font-family:Arial,sans-serif;font-size:11px;margin:20px;color:#222}
  h1{font-size:16px;margin-bottom:4px}
  .meta{color:#666;font-size:10px;margin-bottom:20px}
  .patrol-block{margin-bottom:24px;page-break-inside:avoid}
  .patrol-header{background:#1a3a5c;color:white;padding:8px 12px;border-radius:4px 4px 0 0;font-size:12px;font-weight:bold}
  .patrol-meta{background:#f0f4f8;padding:6px 12px;font-size:10px;color:#444;border:1px solid #ddd;border-top:none}
  table{width:100%;border-collapse:collapse;margin-top:0;border:1px solid #ddd;border-top:none}
  th{background:#e8eef5;padding:5px 8px;text-align:left;font-size:10px;border-bottom:1px solid #ccc;border-right:1px solid #ddd}
  td{padding:4px 8px;border-bottom:1px solid #eee;border-right:1px solid #eee;vertical-align:top}
  .ok{color:#16a34a;font-weight:bold}
  .issue{color:#dc2626;font-weight:bold}
  .na{color:#6b7280}
  .pending{color:#d97706}
  @media print{.patrol-block{page-break-inside:avoid}}
</style></head><body>
<h1>Sentinel – Checkpoint Checklist Submissions Report</h1>
<div class="meta">Generated: ${now} &nbsp;|&nbsp; Total records: ${rows.length}</div>`;

      Object.entries(byPatrol).forEach(([patrolId, pRows]) => {
        const first = pRows[0];
        const grouped: Record<string, any[]> = {};
        pRows.forEach(r => {
          const key = r.checkpoint_code || 'Unknown';
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(r);
        });

        html += `<div class="patrol-block">
<div class="patrol-header">Patrol #${patrolId} &nbsp;·&nbsp; Shift ${first.shift || '-'} &nbsp;·&nbsp; ${first.patrol_status || ''}</div>
<div class="patrol-meta">Guard: <b>${first.guard_name || '-'}</b> (${first.guard_employee_id || '-'}) &nbsp;|&nbsp; Site: ${first.site_name || '-'} &nbsp;|&nbsp; Start: ${first.actual_start || first.scheduled_start || '-'} &nbsp;|&nbsp; End: ${first.actual_end || '-'}</div>
<table><thead><tr><th>Checkpoint</th><th>Area</th><th>Scanned At</th><th>Checklist Item</th><th>Response</th><th>Notes</th></tr></thead><tbody>`;

        Object.entries(grouped).forEach(([, cpRows]) => {
          cpRows.forEach((r, i) => {
            const resp = r.checklist_response || '-';
            const cls = resp === 'ok' ? 'ok' : resp === 'issue' ? 'issue' : resp === 'na' ? 'na' : '';
            html += `<tr>
              ${i === 0 ? `<td rowspan="${cpRows.length}"><b>${r.checkpoint_code}</b><br/>${r.checkpoint_name}</td><td rowspan="${cpRows.length}">${r.area_type || '-'}</td><td rowspan="${cpRows.length}">${r.scanned_at ? new Date(r.scanned_at).toLocaleString('en-IN', {hour:'2-digit',minute:'2-digit',day:'2-digit',month:'short'}) : '-'}</td>` : ''}
              <td>${r.checklist_item || '-'}</td><td class="${cls}">${resp.toUpperCase()}</td><td>${r.checklist_notes || r.checkpoint_notes || ''}</td>
            </tr>`;
          });
        });

        html += '</tbody></table></div>';
      });

      html += '</body></html>';
      const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (win) { win.focus(); setTimeout(() => { win.print(); }, 800); }
      showSuccess(`PDF report opened with ${rows.length} records`);
    } catch (e: any) { setError(e.message); }
    finally { setExportLoading(false); }
  }

  const shifts = [
    { key: 'A', label: 'Shift A', time: '06:00 – 14:00', color: 'text-green-600' },
    { key: 'B', label: 'Shift B', time: '14:00 – 22:00', color: 'text-blue-600' },
    { key: 'C', label: 'Shift C', time: '22:00 – 06:00', color: 'text-purple-600' },
  ];

  return (
    <Layout>
      <header className="mb-6">
        <h2 className="text-2xl font-semibold text-primary">Settings</h2>
        <p className="text-text-muted text-sm">System configuration and user management.</p>
      </header>

      {/* Success toast */}
      {success && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-success/10 text-success text-sm">
          <CheckCircle2 size={14} /> {success}
        </div>
      )}

      {/* My Profile */}
      <Card className="mb-6">
        <h3 className="text-sm font-semibold text-primary mb-4 flex items-center gap-2">
          <Shield size={15} /> My Profile
        </h3>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-lg">
            {user?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <p className="font-semibold text-primary">{user?.full_name}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-sm text-text-muted font-mono">{user?.employee_id}</span>
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', ROLE_COLORS[user?.role || ''])}>
                {ROLE_LABELS[user?.role || '']}
              </span>
            </div>
            <p className="text-xs text-text-muted mt-1">{user?.email}</p>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      {isRole('system_admin', 'security_manager', 'security_supervisor') && (
        <>
          <div className="flex gap-1 mb-4 border-b border-border">
            {[
              { key: 'users', label: 'User Management' },
              ...(isRole('system_admin', 'security_manager') ? [{ key: 'admin', label: 'Patrol Admin' }] : []),
              { key: 'system', label: 'System Info' },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key as any)}
                className={cn('px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                  tab === t.key
                    ? 'border-accent text-accent'
                    : 'border-transparent text-text-muted hover:text-primary'
                )}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'users' && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                  <Users size={15} /> Users ({users.length})
                </h3>
                <div className="flex gap-2">
                  {isRole('system_admin') && (
                    <button onClick={openAdd}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors">
                      + Add User
                    </button>
                  )}
                  <button onClick={loadUsers} className="p-2 rounded-lg border border-border hover:bg-surface-alt transition-colors text-text-muted">
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              {error && !modal.type && (
                <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-danger/10 text-danger text-sm">
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              {loading ? (
                <div className="flex items-center justify-center py-8 text-text-muted gap-2">
                  <Loader2 size={18} className="animate-spin" /> Loading users…
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Employee</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Role</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Status</th>
                        {isRole('system_admin') && (
                          <th className="text-left py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Actions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-surface-alt/50 transition-colors">
                          <td className="py-3 px-3">
                            <p className="font-medium text-primary">{u.full_name}</p>
                            <p className="text-xs text-text-muted font-mono">{u.employee_id}</p>
                          </td>
                          <td className="py-3 px-3">
                            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', ROLE_COLORS[u.role])}>
                              {ROLE_LABELS[u.role] || u.role}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            {u.is_active ? (
                              <span className="flex items-center gap-1 text-xs text-success">
                                <CheckCircle2 size={12} /> Active
                              </span>
                            ) : (
                              <span className="text-xs text-danger">Inactive</span>
                            )}
                          </td>
                          {isRole('system_admin') && (
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1 flex-wrap">
                                {/* Edit */}
                                <button onClick={() => openEdit(u)}
                                  title="Edit"
                                  className="p-1.5 rounded-md border border-border hover:bg-surface-alt text-text-muted hover:text-primary transition-colors">
                                  <Pencil size={13} />
                                </button>
                                {/* Reset Password */}
                                <button onClick={() => openResetPassword(u)}
                                  title="Reset Password"
                                  className="p-1.5 rounded-md border border-border hover:bg-surface-alt text-text-muted hover:text-accent transition-colors">
                                  <KeyRound size={13} />
                                </button>
                                {/* Activate/Deactivate */}
                                {u.id !== user?.id && (
                                  <button onClick={() => toggleActive(u)}
                                    className={cn('text-xs px-2 py-1 rounded-md border transition-colors',
                                      u.is_active
                                        ? 'border-danger/40 text-danger hover:bg-danger/10'
                                        : 'border-success/40 text-success hover:bg-success/10'
                                    )}>
                                    {u.is_active ? 'Deactivate' : 'Activate'}
                                  </button>
                                )}
                                {/* Delete */}
                                {u.id !== user?.id && (
                                  <button onClick={() => openDelete(u)}
                                    title="Delete"
                                    className="p-1.5 rounded-md border border-danger/30 hover:bg-danger/10 text-danger transition-colors">
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {tab === 'admin' && isRole('system_admin', 'security_manager') && (
            <div className="space-y-6">

              {/* Checklist Export */}
              <Card>
                <h3 className="text-sm font-semibold text-primary mb-4 flex items-center gap-2">
                  <ClipboardList size={15} /> Download Checkpoint Checklist Submissions
                </h3>
                <p className="text-xs text-text-muted mb-4">
                  Export all scanned checkpoint checklist entries for manual verification. Filter by date range.
                </p>
                <div className="flex flex-wrap gap-3 mb-4">
                  <div className="flex-1 min-w-[140px]">
                    <label className="text-xs text-text-muted block mb-1">From Date</label>
                    <input type="date" value={exportDateFrom} onChange={e => setExportDateFrom(e.target.value)}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface focus:outline-none focus:border-accent" />
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <label className="text-xs text-text-muted block mb-1">To Date</label>
                    <input type="date" value={exportDateTo} onChange={e => setExportDateTo(e.target.value)}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface focus:outline-none focus:border-accent" />
                  </div>
                </div>
                <div className="flex gap-3 flex-wrap">
                  <button onClick={handleExportExcel} disabled={exportLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
                    {exportLoading ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
                    Download Excel (CSV)
                  </button>
                  <button onClick={handleExportPDF} disabled={exportLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
                    {exportLoading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                    Download PDF Report
                  </button>
                </div>
              </Card>

              {/* Patrol Management */}
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                    <StopCircle size={15} /> Patrol Management
                  </h3>
                  <button onClick={loadPatrols} className="p-2 rounded-lg border border-border hover:bg-surface-alt transition-colors text-text-muted">
                    <RefreshCw size={14} className={patrolsLoading ? 'animate-spin' : ''} />
                  </button>
                </div>
                <p className="text-xs text-text-muted mb-4">
                  Delete test/dummy patrol entries or force-complete stuck in-progress patrols.
                  <span className="text-danger font-medium"> Deletions are permanent.</span>
                </p>

                {patrolsLoading ? (
                  <div className="flex justify-center py-6"><Loader2 className="animate-spin text-text-muted" /></div>
                ) : patrols.length === 0 ? (
                  <p className="text-center text-text-muted text-sm py-6">No patrols found.</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {patrols.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-3 border border-border rounded-lg bg-surface-alt">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-primary">Patrol #{p.id}</span>
                            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                              p.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                              p.status === 'completed'   ? 'bg-green-100 text-green-700'  :
                              p.status === 'scheduled'   ? 'bg-blue-100 text-blue-700'    :
                              'bg-gray-100 text-gray-600'
                            )}>{p.status}</span>
                            <span className="text-xs text-text-muted">Shift {p.shift || '-'}</span>
                          </div>
                          <p className="text-xs text-text-muted mt-0.5 truncate">
                            {p.guard_name || 'Unknown Guard'} · {p.site_name || '-'} ·{' '}
                            {p.scheduled_start ? new Date(p.scheduled_start).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : 'No date'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                          {p.status === 'in_progress' && isRole('system_admin', 'security_manager') && (
                            <button onClick={() => setAdminAction({ type: 'force_complete', patrol: p })}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100 transition-colors">
                              <CheckCircle2 size={12} /> Force Complete
                            </button>
                          )}
                          {isRole('system_admin') && (
                            <button onClick={() => setAdminAction({ type: 'delete', patrol: p })}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-red-50 text-danger border border-red-200 hover:bg-red-100 transition-colors">
                              <Trash2 size={12} /> Delete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Confirm admin action modal */}
              {adminAction && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                  <div className="bg-surface rounded-2xl shadow-xl p-6 w-full max-w-sm">
                    <h3 className="text-base font-semibold text-primary mb-2">
                      {adminAction.type === 'delete' ? 'Delete Patrol?' : 'Force Complete Patrol?'}
                    </h3>
                    <p className="text-sm text-text-muted mb-1">
                      Patrol #{adminAction.patrol.id} · {adminAction.patrol.guard_name} · Shift {adminAction.patrol.shift || '-'}
                    </p>
                    {adminAction.type === 'delete' && (
                      <p className="text-xs text-danger bg-danger/10 rounded-lg p-3 mb-4">
                        This will permanently delete the patrol and all its checkpoint/checklist data. This cannot be undone.
                      </p>
                    )}
                    {adminAction.type === 'force_complete' && (
                      <p className="text-xs text-yellow-700 bg-yellow-50 rounded-lg p-3 mb-4">
                        This will mark the patrol as completed immediately, even if not all checkpoints were scanned.
                      </p>
                    )}
                    <div className="flex gap-3">
                      <button onClick={() => setAdminAction(null)}
                        className="flex-1 px-4 py-2 border border-border rounded-xl text-sm font-medium hover:bg-surface-alt transition-colors">
                        Cancel
                      </button>
                      <button
                        onClick={() => adminAction.type === 'delete'
                          ? handleDeletePatrol(adminAction.patrol)
                          : handleForceComplete(adminAction.patrol)}
                        className={cn('flex-1 px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors',
                          adminAction.type === 'delete' ? 'bg-danger hover:bg-danger/90' : 'bg-yellow-600 hover:bg-yellow-700'
                        )}>
                        {adminAction.type === 'delete' ? 'Yes, Delete' : 'Yes, Complete'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'system' && (
            <div className="space-y-4">
              <Card>
                <h3 className="text-sm font-semibold text-primary mb-4 flex items-center gap-2">
                  <Building2 size={15} /> Shift Configuration
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {shifts.map(s => (
                    <div key={s.key} className="p-4 rounded-xl border border-border bg-surface-alt">
                      <p className={cn('text-sm font-bold', s.color)}>Shift {s.key}</p>
                      <p className="text-lg font-semibold text-primary mt-1">{s.time}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold text-primary mb-4">Patrol Frequency by Area Type</h3>
                <div className="space-y-3">
                  {[
                    { type: 'Critical',    freq: '1 hour',  desc: 'Production, LPG Yard, Tank Farm, Pump Station, Fire Station, Control Unit, Main Gate', color: 'text-red-600 bg-red-50 border-red-200' },
                    { type: 'Operational', freq: '2 hours', desc: 'Electrical Substation, Warehouse, Water Treatment, Office Block, Marine Jetty, Rail/Road Dispatch', color: 'text-blue-600 bg-blue-50 border-blue-200' },
                    { type: 'Support',     freq: '4 hours', desc: 'Medical Centre, Canteen, Perimeter East, Administrative Block', color: 'text-gray-600 bg-gray-50 border-gray-200' },
                  ].map(a => (
                    <div key={a.type} className={cn('p-3 rounded-lg border flex items-start gap-3', a.color)}>
                      <div className="shrink-0">
                        <p className="text-sm font-bold">{a.type}</p>
                        <p className="text-xs font-semibold mt-0.5">Every {a.freq}</p>
                      </div>
                      <p className="text-xs opacity-80">{a.desc}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold text-primary mb-4 flex items-center gap-2">
                  <Info size={15} /> System Information
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ['Version', 'Sentinel v3.0'],
                    ['Site', 'ITC, Khordha'],
                    ['Total Checkpoints', '17'],
                    ['Backend', 'Hono + Cloudflare Workers'],
                    ['Auth', 'JWT · Employee ID login'],
                    ['Audit Trail', 'Enabled'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex flex-col">
                      <span className="text-xs text-text-muted">{k}</span>
                      <span className="font-medium text-primary">{v}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      {/* ── MODALS ── */}
      {modal.type && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">

            {/* EDIT MODAL */}
            {modal.type === 'edit' && modal.user && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-base font-semibold text-primary flex items-center gap-2"><Pencil size={15}/> Edit User</h3>
                  <button onClick={closeModal} className="p-1 rounded-md hover:bg-surface-alt text-text-muted"><X size={16}/></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-text-muted block mb-1">Full Name *</label>
                    <input value={editName} onChange={e => setEditName(e.target.value)}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-muted block mb-1">Email</label>
                    <input value={editEmail} onChange={e => setEditEmail(e.target.value)} type="email"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-muted block mb-1">Phone</label>
                    <input value={editPhone} onChange={e => setEditPhone(e.target.value)}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-muted block mb-1">Role</label>
                    <select value={editRole} onChange={e => setEditRole(e.target.value)}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30">
                      {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  {error && <p className="text-xs text-danger flex items-center gap-1"><AlertCircle size={12}/>{error}</p>}
                </div>
                <div className="flex gap-2 mt-5">
                  <button onClick={closeModal} className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-surface-alt transition-colors">Cancel</button>
                  <button onClick={handleEdit} disabled={saving}
                    className="flex-1 px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                    {saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Save
                  </button>
                </div>
              </div>
            )}

            {/* RESET PASSWORD MODAL */}
            {modal.type === 'reset_password' && modal.user && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-base font-semibold text-primary flex items-center gap-2"><KeyRound size={15}/> Reset Password</h3>
                  <button onClick={closeModal} className="p-1 rounded-md hover:bg-surface-alt text-text-muted"><X size={16}/></button>
                </div>
                <p className="text-sm text-text-muted mb-4">Resetting password for <strong className="text-primary">{modal.user.full_name}</strong></p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-text-muted block mb-1">New Password *</label>
                    <input value={newPassword} onChange={e => setNewPassword(e.target.value)} type="password"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-muted block mb-1">Confirm Password *</label>
                    <input value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} type="password"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
                  </div>
                  {error && <p className="text-xs text-danger flex items-center gap-1"><AlertCircle size={12}/>{error}</p>}
                </div>
                <div className="flex gap-2 mt-5">
                  <button onClick={closeModal} className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-surface-alt transition-colors">Cancel</button>
                  <button onClick={handleResetPassword} disabled={saving}
                    className="flex-1 px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                    {saving ? <Loader2 size={14} className="animate-spin"/> : <KeyRound size={14}/>} Reset
                  </button>
                </div>
              </div>
            )}

            {/* DELETE MODAL */}
            {modal.type === 'delete' && modal.user && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-base font-semibold text-danger flex items-center gap-2"><Trash2 size={15}/> Delete User</h3>
                  <button onClick={closeModal} className="p-1 rounded-md hover:bg-surface-alt text-text-muted"><X size={16}/></button>
                </div>
                <p className="text-sm text-text-muted mb-2">Are you sure you want to permanently delete:</p>
                <p className="text-sm font-semibold text-primary mb-1">{modal.user.full_name}</p>
                <p className="text-xs text-text-muted font-mono mb-4">{modal.user.employee_id}</p>
                <p className="text-xs text-danger bg-danger/10 rounded-lg p-3">This action cannot be undone. All patrol records for this user will remain but the account will be removed.</p>
                {error && <p className="text-xs text-danger mt-2 flex items-center gap-1"><AlertCircle size={12}/>{error}</p>}
                <div className="flex gap-2 mt-5">
                  <button onClick={closeModal} className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-surface-alt transition-colors">Cancel</button>
                  <button onClick={handleDelete} disabled={saving}
                    className="flex-1 px-4 py-2 text-sm bg-danger text-white rounded-lg hover:bg-danger/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                    {saving ? <Loader2 size={14} className="animate-spin"/> : <Trash2 size={14}/>} Delete
                  </button>
                </div>
              </div>
            )}

            {/* ADD USER MODAL */}
            {modal.type === 'add' && (
              <div className="p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-base font-semibold text-primary flex items-center gap-2"><Users size={15}/> Add New User</h3>
                  <button onClick={closeModal} className="p-1 rounded-md hover:bg-surface-alt text-text-muted"><X size={16}/></button>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-text-muted block mb-1">Employee ID *</label>
                      <input value={addEmpId} onChange={e => setAddEmpId(e.target.value)} placeholder="EMP011"
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-text-muted block mb-1">Username *</label>
                      <input value={addUsername} onChange={e => setAddUsername(e.target.value)} placeholder="guard011"
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-muted block mb-1">Full Name *</label>
                    <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="Full Name"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-muted block mb-1">Email *</label>
                    <input value={addEmail} onChange={e => setAddEmail(e.target.value)} type="email" placeholder="email@itc.com"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-muted block mb-1">Phone</label>
                    <input value={addPhone} onChange={e => setAddPhone(e.target.value)} placeholder="+91 9876543210"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-muted block mb-1">Role *</label>
                    <select value={addRole} onChange={e => setAddRole(e.target.value)}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30">
                      {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-muted block mb-1">Password *</label>
                    <input value={addPassword} onChange={e => setAddPassword(e.target.value)} type="password" placeholder="Min 6 characters"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
                  </div>
                  {error && <p className="text-xs text-danger flex items-center gap-1"><AlertCircle size={12}/>{error}</p>}
                </div>
                <div className="flex gap-2 mt-5">
                  <button onClick={closeModal} className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-surface-alt transition-colors">Cancel</button>
                  <button onClick={handleAdd} disabled={saving}
                    className="flex-1 px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                    {saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Add User
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </Layout>
  );
}
