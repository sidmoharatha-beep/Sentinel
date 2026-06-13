export interface Env {
  SENTINEL_DB: D1Database;
  SENTINEL_R2: R2Bucket;
  ASSETS: Fetcher;
  __STATIC_CONTENT: Fetcher;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  CORS_ORIGINS: string;
}

export interface User {
  id: number;
  employee_id: string;
  username: string;
  email: string;
  full_name: string;
  role: 'system_admin' | 'security_manager' | 'security_supervisor' | 'security_guard';
  shift: 'A' | 'B' | 'C' | null;
  phone: string | null;
  is_active: number;
}

declare module 'hono' {
  interface ContextVariableMap {
    user: User;
  }
}
