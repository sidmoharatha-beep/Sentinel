import { sign, verify } from 'hono/jwt';
import { compareSync, hashSync } from 'bcryptjs';
import { HTTPException } from 'hono/http-exception';
import type { Context } from 'hono';
import type { Env, User } from './types';

export async function generateToken(user: User, secret: string, expiresIn: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + parseDuration(expiresIn);
  return sign({ id: user.id, employee_id: user.employee_id, username: user.username, role: user.role, exp }, secret, 'HS256');
}

export async function verifyToken(token: string, secret: string) {
  try {
    return await verify(token, secret, 'HS256') as { id: number; employee_id: string; username: string; role: string };
  } catch {
    return null;
  }
}

export function hashPassword(password: string): string {
  return hashSync(password, 10);
}

export function comparePassword(password: string, hash: string): boolean {
  return compareSync(password, hash);
}

export async function getAuthUser(c: Context<{ Bindings: Env }>): Promise<User | null> {
  const header = c.req.header('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;

  const decoded = await verifyToken(token, c.env.JWT_SECRET);
  if (!decoded) return null;

  const row = await c.env.SENTINEL_DB
    .prepare('SELECT id, employee_id, username, email, full_name, role, shift, is_active FROM users WHERE id = ?')
    .bind(decoded.id)
    .first<User>();

  if (!row || !row.is_active) return null;
  return row;
}

export function requireRole(...roles: string[]) {
  return async (c: Context<{ Bindings: Env }>, next: () => Promise<void>) => {
    const user = c.get('user') as User | undefined;
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    if (!roles.includes(user.role)) throw new HTTPException(403, { message: 'Insufficient permissions' });
    await next();
  };
}

export async function auditLog(
  db: D1Database,
  payload: {
    userId?: number | null;
    action: string;
    description?: string | null;
    ipAddress?: string | null;
    deviceInfo?: string | null;
    relatedId?: number | null;
    relatedType?: string | null;
  }
) {
  try {
    await db
      .prepare(
        `INSERT INTO audit_logs (user_id, action, description, ip_address, device_info, related_id, related_type)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        payload.userId ?? null,
        payload.action,
        payload.description ?? null,
        payload.ipAddress ?? null,
        payload.deviceInfo ?? null,
        payload.relatedId ?? null,
        payload.relatedType ?? null
      )
      .run();
  } catch (e) {
    console.error('Audit log error:', e);
  }
}

function parseDuration(str: string): number {
  const match = str.match(/^(\d+)([smhd])$/);
  if (!match) return 86400; // default 1 day
  const n = parseInt(match[1], 10);
  switch (match[2]) {
    case 's': return n;
    case 'm': return n * 60;
    case 'h': return n * 3600;
    case 'd': return n * 86400;
    default: return 86400;
  }
}
