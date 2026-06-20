import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import Dashboard from '@/pages/Dashboard';
import Patrols from '@/pages/Patrols';
import Compliance from '@/pages/Compliance';
import Reports from '@/pages/Reports';
import Settings from '@/pages/Settings';
import AdminPanel from '@/pages/AdminPanel';
import LiveSite from '@/pages/LiveSite';
import Login from '@/pages/Login';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-surface-alt">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" replace /> : <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={
            <PublicRoute><Login /></PublicRoute>
          } />
          <Route path="/" element={
            <RequireAuth><Dashboard /></RequireAuth>
          } />
          <Route path="/patrols" element={
            <RequireAuth><Patrols /></RequireAuth>
          } />
          <Route path="/compliance" element={
            <RequireAuth><Compliance /></RequireAuth>
          } />
          <Route path="/reports" element={
            <RequireAuth><Reports /></RequireAuth>
          } />
          <Route path="/settings" element={
            <RequireAuth><Settings /></RequireAuth>
          } />
          <Route path="/admin" element={
            <RequireAuth><AdminPanel /></RequireAuth>
          } />
          <Route path="/live-site" element={
            <RequireAuth><LiveSite /></RequireAuth>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
