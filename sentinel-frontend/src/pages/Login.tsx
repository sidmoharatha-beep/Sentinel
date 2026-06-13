import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { ShieldCheck, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!employeeId.trim() || !password.trim()) {
      setError('Employee ID and password are required');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(employeeId.trim(), password);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-primary-light flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent mb-4">
            <ShieldCheck size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">SENTINEL</h1>
          <p className="text-white/60 text-sm mt-1">Security Patrol Compliance System</p>
        </div>

        {/* Card */}
        <div className="bg-surface rounded-2xl shadow-xl p-8">
          <h2 className="text-lg font-semibold text-primary mb-6">Sign In</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text mb-1.5">
                Employee ID
              </label>
              <input
                type="text"
                value={employeeId}
                onChange={e => setEmployeeId(e.target.value)}
                placeholder="e.g. EMP006"
                autoComplete="username"
                autoFocus
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface-alt text-sm
                           focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent
                           transition-colors placeholder:text-text-muted"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full px-3 py-2.5 pr-10 rounded-lg border border-border bg-surface-alt text-sm
                             focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent
                             transition-colors placeholder:text-text-muted"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-danger/10 text-danger text-sm">
                <AlertCircle size={16} className="shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-accent
                         text-white font-medium text-sm hover:bg-accent-light transition-colors
                         disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Signing in...</>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-white/40 text-xs mt-6">
          ITC Limited, Khordha — Sentinel v3.0
        </p>
      </div>
    </div>
  );
}
