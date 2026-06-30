import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { login as apiLogin, logout as apiLogout, getStoredUser, storeAuth, clearAuth, type User } from './api';
import { setupPushNotifications } from './pushNotifications';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (employee_id: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isRole: (...roles: User['role'][]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredUser();
    setUser(stored);
    setLoading(false);
    if (stored && ['system_admin', 'security_manager', 'security_supervisor'].includes(stored.role)) {
      setupPushNotifications();
    }
  }, []);

  async function login(employee_id: string, password: string) {
    const { token, user: u } = await apiLogin(employee_id, password);
    storeAuth(token, u);
    setUser(u);
    if (['system_admin', 'security_manager', 'security_supervisor'].includes(u.role)) {
      setupPushNotifications();
    }
  }

  async function logout() {
    try { await apiLogout(); } catch { /* ignore */ }
    clearAuth();
    setUser(null);
  }

  function isRole(...roles: User['role'][]) {
    return user ? roles.includes(user.role) : false;
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
