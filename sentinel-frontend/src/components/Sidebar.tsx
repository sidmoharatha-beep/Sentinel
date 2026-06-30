import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShieldCheck, ClipboardList, ShieldAlert,
  FileText, Settings, Menu, X, LogOut, ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';

const ROLE_LABELS: Record<string, string> = {
  system_admin:        'System Admin',
  security_manager:    'Security Manager',
  security_supervisor: 'Supervisor',
  security_guard:      'Security Guard',
};

const SHIFT_COLORS: Record<string, string> = {
  A: 'bg-green-500',
  B: 'bg-blue-500',
  C: 'bg-purple-500',
};

const allNavItems = [
  { label: 'Dashboard',   icon: LayoutDashboard, path: '/',          roles: ['system_admin', 'security_manager', 'security_supervisor', 'security_guard'] },
  { label: 'Patrols',     icon: ShieldCheck,     path: '/patrols',   roles: ['system_admin', 'security_manager', 'security_supervisor', 'security_guard'] },
  { label: 'Compliance',  icon: ClipboardList,   path: '/compliance',roles: ['system_admin', 'security_manager', 'security_supervisor'] },
  { label: 'Reports',     icon: FileText,        path: '/reports',   roles: ['system_admin', 'security_manager', 'security_supervisor'] },
  { label: 'Live Map',    icon: ShieldAlert,     path: '/live-site', roles: ['system_admin', 'security_manager', 'security_supervisor'] },
  { label: 'Settings',    icon: Settings,        path: '/settings',  roles: ['system_admin'] },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = allNavItems.filter(item =>
    !user || item.roles.includes(user.role)
  );

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-surface shadow border border-border"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle menu"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-40 w-64 bg-primary text-white flex flex-col transition-transform',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/10">
          <h1 className="text-lg font-semibold tracking-wide flex items-center gap-2">
            <ShieldCheck className="text-accent-light" size={22} />
            Sentinel
          </h1>
          <p className="text-xs text-white/60 mt-1">Security Patrol Compliance</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors',
                  active
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                )}
              >
                <item.icon size={18} />
                <span className="flex-1">{item.label}</span>
                {active && <ChevronRight size={14} className="opacity-50" />}
              </Link>
            );
          })}
        </nav>

        {/* User info + logout */}
        {user && (
          <div className="px-4 py-4 border-t border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-accent-light font-semibold text-sm shrink-0">
                {user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.full_name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs text-white/50">{user.employee_id}</span>
                  {user.shift && (
                    <span className={cn('w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white', SHIFT_COLORS[user.shift])}>
                      {user.shift}
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/40 mt-0.5 truncate">{ROLE_LABELS[user.role]}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-white/60
                         hover:bg-white/10 hover:text-white transition-colors"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        )}
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  );
}
