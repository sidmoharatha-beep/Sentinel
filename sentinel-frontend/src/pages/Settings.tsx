import { useState, useEffect, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/lib/api';
import {
  Users, Shield, Info, Loader2, AlertCircle,
  RefreshCw, CheckCircle2, Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ROLE_LABELS: Record<string, string> = {
  system_admin:        'System Admin',
  security_manager:    'Security Manager',
  security_supervisor: 'Supervisor',
  security_guard:      'Guard',
};

const SHIFT_COLORS: Record<string, string> = {
  A: 'bg-green-100 text-green-700 border-green-200',
  B: 'bg-blue-100 text-blue-700 border-blue-200',
  C: 'bg-purple-100 text-purple-700 border-purple-200',
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

export default function Settings() {
  const { user, isRole } = useAuth();
  const [users, setUsers]     = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [tab, setTab]         = useState<'users' | 'system'>('users');

  const loadUsers = useCallback(() => {
    if (!isRole('system_admin', 'security_manager', 'security_supervisor')) return;
    setLoading(true);
    setError('');
    (api.get('/auth/users') as Promise<any>)
      .then((d: any) => setUsers(d.users || []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [isRole]);

  useEffect(() => { if (tab === 'users') loadUsers(); }, [tab, loadUsers]);

  async function toggleActive(u: UserRecord) {
    if (!isRole('system_admin')) return;
    try {
      await api.patch(`/auth/users/${u.id}`, { is_active: !u.is_active });
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_active: u.is_active ? 0 : 1 } : x));
    } catch (e: any) { setError(e.message); }
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
              {user?.shift && (
                <span className={cn('text-xs px-2 py-0.5 rounded-full border font-semibold', SHIFT_COLORS[user.shift])}>
                  Shift {user.shift}
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted mt-1">{user?.email}</p>
          </div>
        </div>
      </Card>

      {/* Tabs — only for admins/managers/supervisors */}
      {isRole('system_admin', 'security_manager', 'security_supervisor') && (
        <>
          <div className="flex gap-1 mb-4 border-b border-border">
            {[
              { key: 'users', label: 'User Management' },
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
                <button onClick={loadUsers} className="p-2 rounded-lg border border-border hover:bg-surface-alt transition-colors text-text-muted">
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>

              {error && (
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
                        <th className="text-left py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Shift</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Status</th>
                        {isRole('system_admin') && (
                          <th className="text-left py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Action</th>
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
                            {u.shift ? (
                              <span className={cn('text-xs px-2 py-0.5 rounded-full border font-semibold', SHIFT_COLORS[u.shift])}>
                                Shift {u.shift}
                              </span>
                            ) : (
                              <span className="text-xs text-text-muted">—</span>
                            )}
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
                              {u.id !== user?.id && (
                                <button
                                  onClick={() => toggleActive(u)}
                                  className={cn('text-xs px-2.5 py-1 rounded-md border transition-colors',
                                    u.is_active
                                      ? 'border-danger/40 text-danger hover:bg-danger/10'
                                      : 'border-success/40 text-success hover:bg-success/10'
                                  )}
                                >
                                  {u.is_active ? 'Deactivate' : 'Activate'}
                                </button>
                              )}
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

          {tab === 'system' && (
            <div className="space-y-4">
              {/* Shift config info */}
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

              {/* Patrol frequency */}
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

              {/* System info */}
              <Card>
                <h3 className="text-sm font-semibold text-primary mb-4 flex items-center gap-2">
                  <Info size={15} /> System Information
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ['Version', 'Sentinel v2.0'],
                    ['Site', 'HPCL Visakh Refinery'],
                    ['Total Checkpoints', '17'],
                    ['Backend', 'Node.js + Express + SQLite'],
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
    </Layout>
  );
}
