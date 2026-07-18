const API_BASE = import.meta.env.VITE_API_URL || '/api';

function getToken(): string | null {
  return localStorage.getItem('sentinel_token');
}

async function request<T = unknown>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    localStorage.removeItem('sentinel_token');
    localStorage.removeItem('sentinel_user');
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  // Safely read the body: it may be empty (204 No Content), JSON, or
  // occasionally plain text (e.g. a framework-level error page). Never
  // call res.json() unconditionally — that throws on empty bodies.
  const raw = await res.text();
  let data: any = null;
  if (raw) {
    try { data = JSON.parse(raw); }
    catch { data = { error: raw }; }
  }

  if (!res.ok) throw new Error(data?.error || res.statusText || `Request failed (${res.status})`);
  return (data ?? ({} as T)) as T;
}

export const api = {
  get:    <T = unknown>(path: string) => request<T>('GET', path),
  post:   <T = unknown>(path: string, body: unknown) => request<T>('POST', path, body),
  patch:  <T = unknown>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T = unknown>(path: string) => request<T>('DELETE', path),
};

// ── Auth ───────────────────────────────────────────────────────────────────
export interface User {
  id: number;
  employee_id: string;
  username: string;
  email: string;
  full_name: string;
  role: 'system_admin' | 'security_manager' | 'security_supervisor' | 'security_guard';
  shift: 'A' | 'B' | 'C' | null;
  phone: string | null;
}

export function login(employee_id: string, password: string) {
  return api.post<{ token: string; user: User }>('/auth/login', { employee_id, password });
}

export function registerFcmToken(token: string) {
  return api.post('/auth/fcm-token', { token });
}

export function logout() {
  return api.post('/auth/logout', {});
}

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem('sentinel_user');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function storeAuth(token: string, user: User) {
  localStorage.setItem('sentinel_token', token);
  localStorage.setItem('sentinel_user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('sentinel_token');
  localStorage.removeItem('sentinel_user');
}

// ── Dashboard ──────────────────────────────────────────────────────────────
export const dashboardApi = {
  overview:       () => api.get('/dashboard/overview'),
  shiftCompliance:(days = 7) => api.get(`/dashboard/shift-compliance?days=${days}`),
  areaCompliance: (days = 7) => api.get(`/dashboard/area-compliance?days=${days}`),
  patrolStats:    (days = 7) => api.get(`/dashboard/patrol-stats?days=${days}`),
  incidentStats:  (days = 7) => api.get(`/dashboard/incident-stats?days=${days}`),
  guardPerformance:(days = 30) => api.get(`/dashboard/guard-performance?days=${days}`),
  topRiskAreas:   (days = 30) => api.get(`/dashboard/top-risk-areas?days=${days}`),
  auditTrail:     () => api.get('/dashboard/audit-trail?limit=500'),
  insights:       () => api.get('/dashboard/insights'),
  anomalies:      (staleMinutes = 90) => api.get(`/dashboard/anomalies?stale_minutes=${staleMinutes}`),
  photoTimeline:  (date?: string, guardId?: number) => api.get(`/dashboard/photo-timeline?${new URLSearchParams({ ...(date ? { date } : {}), ...(guardId ? { guard_id: String(guardId) } : {}) })}`),
};

// ── Patrols ────────────────────────────────────────────────────────────────
export const patrolApi = {
  list:           (params?: Record<string, string>) => api.get(`/patrols?${new URLSearchParams(params || {})}`),
  get:            (id: number) => api.get(`/patrols/${id}`),
  create:         (data: unknown) => api.post('/patrols', data),
  update:         (id: number, data: unknown) => api.patch(`/patrols/${id}`, data),
  delete:         (id: number) => api.delete(`/patrols/${id}`),
  start:          (id: number) => api.post(`/patrols/${id}/start`, {}),
  complete:       (id: number) => api.post(`/patrols/${id}/complete`, {}),
  forceComplete:  (id: number) => api.post(`/patrols/${id}/force-complete`, {}),
  scan:           (id: number, data: unknown) => api.post(`/patrols/${id}/scan`, data),
  currentShift:   () => api.get('/patrols/current-shift'),
  checkpointsDue: (site_id?: number) => api.get(`/patrols/checkpoints-due${site_id ? `?site_id=${site_id}` : ''}`),
  qrLookup:       (qr_code: string) => api.get(`/patrols/qr/${encodeURIComponent(qr_code)}`),
  uploadPhoto:    (patrolId: number, checkpointId: number, blob: Blob) => uploadCheckpointPhoto(patrolId, checkpointId, blob),
  checklistSubmissions: (params?: Record<string, string>) => api.get(`/patrols/checklist-submissions${params ? `?${new URLSearchParams(params)}` : ''}`),
};

async function uploadCheckpointPhoto(patrolId: number, checkpointId: number, blob: Blob): Promise<{ photo_key: string; photo_url: string }> {
  const token = getToken();
  const form = new FormData();
  form.append('photo', blob, `checkpoint-${checkpointId}.jpg`);
  form.append('checkpoint_id', String(checkpointId));

  const res = await fetch(`${API_BASE}/patrols/${patrolId}/photo`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Photo upload failed');
  return data;
}

// ── Incidents ──────────────────────────────────────────────────────────────
export const incidentApi = {
  list:    (params?: Record<string, string>) => api.get(`/incidents?${new URLSearchParams(params || {})}`),
  get:     (id: number) => api.get(`/incidents/${id}`),
  critical:() => api.get('/incidents/critical'),
  create:  (data: unknown) => api.post('/incidents', data),
  update:  (id: number, data: unknown) => api.patch(`/incidents/${id}`, data),
};

// ── Notifications ──────────────────────────────────────────────────────────
export const notificationApi = {
  list:   () => api.get('/notifications'),
  markRead:(id: number) => api.patch(`/notifications/${id}/read`, {}),
  markAllRead: () => api.patch('/notifications/read-all', {}),
};

export default api;
