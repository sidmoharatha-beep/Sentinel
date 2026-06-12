import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getAuthUser, requireRole } from '../auth';
import type { Env, User } from '../types';

const app = new Hono<{ Bindings: Env }>();

app.use('*', async (c, next) => {
  const user = await getAuthUser(c);
  if (user) c.set('user', user);
  await next();
});

app.get('/', async (c) => {
  const user = c.get('user') as User | undefined;
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });

  const { site_id, record_type, status } = c.req.query();
  let sql = `
    SELECT c.*, s.name as site_name, u.full_name as reviewed_by_name
    FROM compliance_records c
    LEFT JOIN sites s ON c.site_id = s.id
    LEFT JOIN users u ON c.reviewed_by = u.id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (site_id) { sql += ' AND c.site_id = ?'; params.push(Number(site_id)); }
  if (record_type) { sql += ' AND c.record_type = ?'; params.push(record_type); }
  if (status) { sql += ' AND c.status = ?'; params.push(status); }
  sql += ' ORDER BY c.created_at DESC';

  const rows = await c.env.SENTINEL_DB.prepare(sql).bind(...params).all<Record<string, any>>();
  return c.json({ records: rows.results ?? [], count: (rows.results ?? []).length });
});

app.get('/:id', async (c) => {
  const user = c.get('user') as User | undefined;
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });

  const id = Number(c.req.param('id'));
  const row = await c.env.SENTINEL_DB
    .prepare(`
      SELECT c.*, s.name as site_name, u.full_name as reviewed_by_name
      FROM compliance_records c
      LEFT JOIN sites s ON c.site_id = s.id
      LEFT JOIN users u ON c.reviewed_by = u.id
      WHERE c.id = ?
    `)
    .bind(id)
    .first<Record<string, any>>();

  if (!row) throw new HTTPException(404, { message: 'Compliance record not found' });
  return c.json({ record: row });
});

app.post('/', requireRole('system_admin', 'security_supervisor', 'security_manager'), async (c) => {
  const body = await c.req.json<Record<string, any>>();
  const { site_id, record_type, details } = body;
  if (!site_id || !record_type) throw new HTTPException(400, { message: 'site_id and record_type are required' });

  const site = await c.env.SENTINEL_DB.prepare('SELECT id FROM sites WHERE id = ?').bind(Number(site_id)).first<{ id: number }>();
  if (!site) throw new HTTPException(404, { message: 'Site not found' });

  const result = await c.env.SENTINEL_DB
    .prepare('INSERT INTO compliance_records (site_id, record_type, details) VALUES (?, ?, ?)')
    .bind(Number(site_id), record_type, details ?? null)
    .run<{ lastRowId: number }>();

  const row = await c.env.SENTINEL_DB
    .prepare(`
      SELECT c.*, s.name as site_name
      FROM compliance_records c
      LEFT JOIN sites s ON c.site_id = s.id
      WHERE c.id = ?
    `)
    .bind((result.meta?.last_row_id ?? (result as any).lastRowId))
    .first<Record<string, any>>();

  return c.json({ record: row }, 201);
});

app.patch('/:id', requireRole('system_admin', 'security_supervisor', 'security_manager'), async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json<Record<string, any>>();

  const fields: string[] = [];
  const values: any[] = [];

  if (body.status !== undefined) { fields.push('status = ?'); values.push(body.status); }
  if (body.score !== undefined) { fields.push('score = ?'); values.push(body.score); }
  if (body.details !== undefined) { fields.push('details = ?'); values.push(body.details); }
  if (fields.length === 0) throw new HTTPException(400, { message: 'No fields to update' });
  values.push(id);

  const result = await c.env.SENTINEL_DB
    .prepare(`UPDATE compliance_records SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run<{ changes: number }>();

  if ((result.meta?.changes ?? (result as any).changes) === 0) throw new HTTPException(404, { message: 'Compliance record not found' });

  const row = await c.env.SENTINEL_DB
    .prepare(`
      SELECT c.*, s.name as site_name, u.full_name as reviewed_by_name
      FROM compliance_records c
      LEFT JOIN sites s ON c.site_id = s.id
      LEFT JOIN users u ON c.reviewed_by = u.id
      WHERE c.id = ?
    `)
    .bind(id)
    .first<Record<string, any>>();

  return c.json({ record: row });
});

app.post('/:id/review', requireRole('system_admin', 'security_supervisor', 'security_manager'), async (c) => {
  const user = c.get('user') as User;
  const id = Number(c.req.param('id'));
  const body = await c.req.json<{ score?: number; details?: string }>();

  const result = await c.env.SENTINEL_DB
    .prepare('UPDATE compliance_records SET reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, score = ?, details = COALESCE(?, details) WHERE id = ?')
    .bind(user.id, body.score !== undefined ? body.score : null, body.details ?? null, id)
    .run<{ changes: number }>();

  if ((result.meta?.changes ?? (result as any).changes) === 0) throw new HTTPException(404, { message: 'Compliance record not found' });

  const row = await c.env.SENTINEL_DB
    .prepare(`
      SELECT c.*, s.name as site_name, u.full_name as reviewed_by_name
      FROM compliance_records c
      LEFT JOIN sites s ON c.site_id = s.id
      LEFT JOIN users u ON c.reviewed_by = u.id
      WHERE c.id = ?
    `)
    .bind(id)
    .first<Record<string, any>>();

  return c.json({ record: row });
});

app.delete('/:id', requireRole('system_admin'), async (c) => {
  const id = Number(c.req.param('id'));
  const result = await c.env.SENTINEL_DB.prepare('DELETE FROM compliance_records WHERE id = ?').bind(id).run<{ changes: number }>();
  if ((result.meta?.changes ?? (result as any).changes) === 0) throw new HTTPException(404, { message: 'Compliance record not found' });
  return c.body(null, 204);
});

export default app;
