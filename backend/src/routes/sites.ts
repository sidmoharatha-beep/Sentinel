import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getAuthUser, requireRole } from '../auth';
import type { Env } from '../types';

const app = new Hono<{ Bindings: Env }>();

app.use('*', async (c, next) => {
  const user = await getAuthUser(c);
  if (user) c.set('user', user);
  await next();
});

app.get('/', async (c) => {
  const { search, is_active } = c.req.query();
  let sql = 'SELECT * FROM sites WHERE 1=1';
  const params: (string | number)[] = [];

  if (is_active !== undefined) { sql += ' AND is_active = ?'; params.push(is_active === 'true' || is_active === '1' ? 1 : 0); }
  if (search) {
    sql += ' AND (name LIKE ? OR address LIKE ? OR city LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  sql += ' ORDER BY created_at DESC';

  const rows = await c.env.SENTINEL_DB.prepare(sql).bind(...params).all<Record<string, any>>();
  return c.json({ sites: rows.results ?? [], count: (rows.results ?? []).length });
});

app.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const site = await c.env.SENTINEL_DB.prepare('SELECT * FROM sites WHERE id = ?').bind(id).first<Record<string, any>>();
  if (!site) throw new HTTPException(404, { message: 'Site not found' });

  const checkpoints = await c.env.SENTINEL_DB
    .prepare('SELECT * FROM checkpoints WHERE site_id = ? AND is_active = 1 ORDER BY id')
    .bind(id)
    .all<Record<string, any>>();

  const routes = await c.env.SENTINEL_DB
    .prepare('SELECT * FROM patrol_routes WHERE site_id = ? AND is_active = 1 ORDER BY id')
    .bind(id)
    .all<Record<string, any>>();

  return c.json({ site, checkpoints: checkpoints.results ?? [], routes: routes.results ?? [] });
});

app.post('/', requireRole('system_admin', 'security_manager'), async (c) => {
  const body = await c.req.json<Record<string, any>>();
  const { name, address, city, state, zip, contact_name, contact_phone, contact_email } = body;
  if (!name || !address) throw new HTTPException(400, { message: 'Name and address are required' });

  const result = await c.env.SENTINEL_DB
    .prepare('INSERT INTO sites (name, address, city, state, zip, contact_name, contact_phone, contact_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(name, address, city ?? null, state ?? null, zip ?? null, contact_name ?? null, contact_phone ?? null, contact_email ?? null)
    .run<{ lastRowId: number }>();

  const row = await c.env.SENTINEL_DB
    .prepare('SELECT * FROM sites WHERE id = ?')
    .bind((result.meta?.last_row_id ?? (result as any).lastRowId))
    .first<Record<string, any>>();

  return c.json({ site: row }, 201);
});

app.patch('/:id', requireRole('system_admin', 'security_manager'), async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json<Record<string, any>>();
  const allowed = ['name', 'address', 'city', 'state', 'zip', 'contact_name', 'contact_phone', 'contact_email', 'is_active'];
  const fields: string[] = [];
  const values: any[] = [];

  for (const key of allowed) {
    if (body[key] !== undefined) { fields.push(`${key} = ?`); values.push(body[key]); }
  }
  if (fields.length === 0) throw new HTTPException(400, { message: 'No fields to update' });
  values.push(id);

  const result = await c.env.SENTINEL_DB
    .prepare(`UPDATE sites SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run<{ changes: number }>();

  if ((result.meta?.changes ?? (result as any).changes) === 0) throw new HTTPException(404, { message: 'Site not found' });

  const row = await c.env.SENTINEL_DB.prepare('SELECT * FROM sites WHERE id = ?').bind(id).first<Record<string, any>>();
  return c.json({ site: row });
});

app.delete('/:id', requireRole('system_admin'), async (c) => {
  const id = Number(c.req.param('id'));
  const result = await c.env.SENTINEL_DB.prepare('DELETE FROM sites WHERE id = ?').bind(id).run<{ changes: number }>();
  if ((result.meta?.changes ?? (result as any).changes) === 0) throw new HTTPException(404, { message: 'Site not found' });
  return c.body(null, 204);
});

app.get('/:id/checkpoints', async (c) => {
  const id = Number(c.req.param('id'));
  const rows = await c.env.SENTINEL_DB
    .prepare('SELECT * FROM checkpoints WHERE site_id = ? ORDER BY id')
    .bind(id)
    .all<Record<string, any>>();
  return c.json({ checkpoints: rows.results ?? [], count: (rows.results ?? []).length });
});

app.post('/:id/checkpoints', requireRole('system_admin', 'security_manager'), async (c) => {
  const siteId = Number(c.req.param('id'));
  const body = await c.req.json<Record<string, any>>();
  const { name, description, qr_code, latitude, longitude } = body;
  if (!name) throw new HTTPException(400, { message: 'Name is required' });

  const site = await c.env.SENTINEL_DB.prepare('SELECT id FROM sites WHERE id = ?').bind(siteId).first<{ id: number }>();
  if (!site) throw new HTTPException(404, { message: 'Site not found' });

  try {
    const result = await c.env.SENTINEL_DB
      .prepare('INSERT INTO checkpoints (site_id, name, description, qr_code, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(siteId, name, description ?? null, qr_code ?? null, latitude ?? null, longitude ?? null)
      .run<{ lastRowId: number }>();

    const row = await c.env.SENTINEL_DB
      .prepare('SELECT * FROM checkpoints WHERE id = ?')
      .bind((result.meta?.last_row_id ?? (result as any).lastRowId))
      .first<Record<string, any>>();

    return c.json({ checkpoint: row }, 201);
  } catch (e: any) {
    if (e.message?.includes('UNIQUE constraint failed')) throw new HTTPException(409, { message: 'QR code already exists' });
    throw e;
  }
});

export default app;
