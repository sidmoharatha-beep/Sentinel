import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { generateToken, comparePassword, hashPassword, getAuthUser, requireRole, auditLog } from '../auth';
import type { Env, User } from '../types';

const app = new Hono<{ Bindings: Env }>();

app.use('*', async (c, next) => {
  const user = await getAuthUser(c);
  if (user) c.set('user', user);
  await next();
});

// ─── LOGIN ────────────────────────────────────────────────────────────────
app.post('/login', async (c) => {
  const body = await c.req.json<{ employee_id?: string; password?: string }>();
  const { employee_id, password } = body;
  if (!employee_id || !password) throw new HTTPException(400, { message: 'Employee ID and password are required' });

  const ip = c.req.header('cf-connecting-ip') || '';
  const device = c.req.header('user-agent') || 'unknown';

  const user = await c.env.SENTINEL_DB
    .prepare('SELECT * FROM users WHERE employee_id = ? OR username = ?')
    .bind(employee_id, employee_id)
    .first<User & { password_hash: string; is_active: number }>();

  if (!user || !comparePassword(password, user.password_hash)) {
    await auditLog(c.env.SENTINEL_DB, {
      userId: user?.id ?? null,
      action: 'login',
      description: `Failed login attempt for employee_id: ${employee_id}`,
      ipAddress: ip,
      deviceInfo: device,
    });
    throw new HTTPException(401, { message: 'Invalid Employee ID or password' });
  }

  if (!user.is_active) throw new HTTPException(403, { message: 'Account is deactivated' });

  const token = await generateToken(user, c.env.JWT_SECRET, c.env.JWT_EXPIRES_IN);

  await auditLog(c.env.SENTINEL_DB, {
    userId: user.id,
    action: 'login',
    description: 'Successful login',
    ipAddress: ip,
    deviceInfo: device,
    relatedId: user.id,
    relatedType: 'user',
  });

  return c.json({
    token,
    user: {
      id: user.id,
      employee_id: user.employee_id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      shift: user.shift,
      phone: user.phone,
    },
  });
});

// ─── LOGOUT ───────────────────────────────────────────────────────────────
app.post('/logout', async (c) => {
  const user = c.get('user') as User | undefined;
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });

  await auditLog(c.env.SENTINEL_DB, {
    userId: user.id,
    action: 'logout',
    description: 'User logged out',
    ipAddress: c.req.header('cf-connecting-ip') || '',
    deviceInfo: c.req.header('user-agent') || 'unknown',
    relatedId: user.id,
    relatedType: 'user',
  });

  return c.json({ message: 'Logged out successfully' });
});

// ─── ME ───────────────────────────────────────────────────────────────────
app.get('/me', async (c) => {
  const user = c.get('user') as User | undefined;
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });
  return c.json({ user });
});

// ─── REGISTER PUSH NOTIFICATION TOKEN ───────────────────────────────────────
// Called by the Android app after Firebase Cloud Messaging hands it a device
// token. We store one token per user (overwritten on reinstall/new device).
app.post('/fcm-token', async (c) => {
  const user = c.get('user') as User | undefined;
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });
  const body = await c.req.json();
  const { token } = body;
  if (!token || typeof token !== 'string') {
    throw new HTTPException(400, { message: 'token is required' });
  }
  await c.env.SENTINEL_DB
    .prepare('UPDATE users SET fcm_token = ? WHERE id = ?')
    .bind(token, user.id)
    .run();
  return c.json({ success: true });
});

// ─── LIST USERS ───────────────────────────────────────────────────────────
app.get('/users', requireRole('system_admin', 'security_manager', 'security_supervisor'), async (c) => {
  const { role, search, is_active, shift } = c.req.query();
  let sql = 'SELECT id, employee_id, username, email, full_name, role, phone, shift, is_active, created_at FROM users WHERE 1=1';
  const params: (string | number)[] = [];

  if (role) { sql += ' AND role = ?'; params.push(role); }
  if (shift) { sql += ' AND shift = ?'; params.push(shift); }
  if (is_active !== undefined) { sql += ' AND is_active = ?'; params.push(is_active === 'true' || is_active === '1' ? 1 : 0); }
  if (search) {
    sql += ' AND (employee_id LIKE ? OR username LIKE ? OR full_name LIKE ? OR email LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  sql += ' ORDER BY employee_id ASC';

  const stmt = c.env.SENTINEL_DB.prepare(sql);
  const rows = await stmt.bind(...params).all<User>();
  return c.json({ users: rows.results ?? [], count: (rows.results ?? []).length });
});

// ─── GET USER ─────────────────────────────────────────────────────────────
app.get('/users/:id', async (c) => {
  const user = c.get('user') as User | undefined;
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });

  const row = await c.env.SENTINEL_DB
    .prepare('SELECT id, employee_id, username, email, full_name, role, phone, shift, is_active, created_at FROM users WHERE id = ?')
    .bind(Number(c.req.param('id')))
    .first<User>();

  if (!row) throw new HTTPException(404, { message: 'User not found' });
  return c.json({ user: row });
});

// ─── CREATE USER ──────────────────────────────────────────────────────────
app.post('/users', requireRole('system_admin'), async (c) => {
  const me = c.get('user') as User;
  const body = await c.req.json<{
    employee_id: string; username: string; email: string; password: string;
    full_name: string; role: string; phone?: string; shift?: string;
  }>();

  const { employee_id, username, email, password, full_name, role, phone, shift } = body;
  if (!employee_id || !username || !email || !password || !full_name || !role) {
    throw new HTTPException(400, { message: 'Missing required fields' });
  }

  try {
    const result = await c.env.SENTINEL_DB
      .prepare(
        'INSERT INTO users (employee_id, username, email, password_hash, full_name, role, phone, shift) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(employee_id, username, email, hashPassword(password), full_name, role, phone ?? null, shift ?? null)
      .run<{ lastRowId: number }>();

    const id = result.meta?.last_row_id ?? (result as any).lastRowId;

    await auditLog(c.env.SENTINEL_DB, {
      userId: me.id,
      action: 'user_create',
      description: `Created user ${employee_id} (${full_name})`,
      relatedId: id,
      relatedType: 'user',
    });

    const row = await c.env.SENTINEL_DB
      .prepare('SELECT id, employee_id, username, email, full_name, role, phone, shift, is_active, created_at FROM users WHERE id = ?')
      .bind(id)
      .first<User>();

    return c.json({ user: row }, 201);
  } catch (e: any) {
    if (e.message?.includes('UNIQUE constraint failed')) {
      throw new HTTPException(409, { message: 'Employee ID, username or email already exists' });
    }
    throw e;
  }
});

// ─── UPDATE USER ──────────────────────────────────────────────────────────
app.patch('/users/:id', requireRole('system_admin'), async (c) => {
  const me = c.get('user') as User;
  const id = Number(c.req.param('id'));
  const body = await c.req.json<Record<string, any>>();

  const fields: string[] = [];
  const values: any[] = [];

  if (body.email !== undefined) { fields.push('email = ?'); values.push(body.email); }
  if (body.full_name !== undefined) { fields.push('full_name = ?'); values.push(body.full_name); }
  if (body.role !== undefined) { fields.push('role = ?'); values.push(body.role); }
  if (body.phone !== undefined) { fields.push('phone = ?'); values.push(body.phone); }
  if (body.shift !== undefined) { fields.push('shift = ?'); values.push(body.shift); }
  if (body.password !== undefined) { fields.push('password_hash = ?'); values.push(hashPassword(body.password)); }
  if (body.is_active !== undefined) { fields.push('is_active = ?'); values.push(body.is_active ? 1 : 0); }
  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  if (fields.length === 1) throw new HTTPException(400, { message: 'No fields to update' });

  const result = await c.env.SENTINEL_DB
    .prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run<{ changes: number }>();

  if ((result.meta?.changes ?? (result as any).changes) === 0) throw new HTTPException(404, { message: 'User not found' });

  await auditLog(c.env.SENTINEL_DB, {
    userId: me.id,
    action: 'user_update',
    description: `Updated user id ${id}`,
    relatedId: id,
    relatedType: 'user',
  });

  const row = await c.env.SENTINEL_DB
    .prepare('SELECT id, employee_id, username, email, full_name, role, phone, shift, is_active, created_at FROM users WHERE id = ?')
    .bind(id)
    .first<User>();

  return c.json({ user: row });
});

// ─── DELETE USER ──────────────────────────────────────────────────────────
app.delete('/users/:id', requireRole('system_admin'), async (c) => {
  const id = Number(c.req.param('id'));
  const result = await c.env.SENTINEL_DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run<{ changes: number }>();
  if ((result.meta?.changes ?? (result as any).changes) === 0) throw new HTTPException(404, { message: 'User not found' });
  return c.body(null, 204);
});

export default app;
