import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getAuthUser, requireRole, auditLog } from '../auth';
import type { Env, User } from '../types';

const app = new Hono<{ Bindings: Env }>();

app.use('*', async (c, next) => {
  const user = await getAuthUser(c);
  if (user) c.set('user', user);
  await next();
});

const CRITICAL_KEYWORDS = ['lpg', 'gas leak', 'fire', 'explosion', 'unauthorized access', 'intrusion', 'breach', 'flame'];

function needsEscalation(category: string, severity: string, title: string, description?: string) {
  if (severity === 'Critical') return true;
  if (category === 'Fire') return true;
  const text = `${title} ${description || ''}`.toLowerCase();
  return CRITICAL_KEYWORDS.some((kw) => text.includes(kw));
}

async function triggerEscalation(db: D1Database, incidentId: number, title: string) {
  const users = await db
    .prepare("SELECT id FROM users WHERE role IN ('security_supervisor','security_manager','system_admin') AND is_active = 1")
    .all<{ id: number }>();

  for (const u of users.results ?? []) {
    await db
      .prepare(
        `INSERT INTO notifications (user_id, type, title, message, related_id, related_type)
         VALUES (?, 'critical_escalation', ?, ?, ?, 'incident')`
      )
      .bind(
        u.id,
        `CRITICAL ESCALATION: ${title}`,
        `A critical incident has been reported and requires immediate attention. Incident ID: ${incidentId}`,
        incidentId
      )
      .run();
  }

  await db
    .prepare("UPDATE incidents SET is_escalated = 1, escalated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(incidentId)
    .run();
}

app.get('/', async (c) => {
  const user = c.get('user') as User | undefined;
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });

  const { site_id, status, severity, category, guard_id, date_from, date_to, is_escalated } = c.req.query();
  let sql = `
    SELECT i.*, s.name as site_name, u.full_name as guard_name, u.employee_id as guard_employee_id,
           c.checkpoint_code, c.name as checkpoint_name
    FROM incidents i
    LEFT JOIN sites s ON i.site_id = s.id
    LEFT JOIN users u ON i.guard_id = u.id
    LEFT JOIN checkpoints c ON i.checkpoint_id = c.id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (site_id) { sql += ' AND i.site_id = ?'; params.push(Number(site_id)); }
  if (status) { sql += ' AND i.status = ?'; params.push(status); }
  if (severity) { sql += ' AND i.severity = ?'; params.push(severity); }
  if (category) { sql += ' AND i.category = ?'; params.push(category); }
  if (guard_id) { sql += ' AND i.guard_id = ?'; params.push(Number(guard_id)); }
  if (date_from) { sql += ' AND i.reported_at >= ?'; params.push(date_from); }
  if (date_to) { sql += ' AND i.reported_at <= ?'; params.push(date_to); }
  if (is_escalated !== undefined) { sql += ' AND i.is_escalated = ?'; params.push(is_escalated === 'true' || is_escalated === '1' ? 1 : 0); }
  sql += ' ORDER BY i.reported_at DESC LIMIT 500';

  const rows = await c.env.SENTINEL_DB.prepare(sql).bind(...params).all<Record<string, any>>();
  return c.json({ incidents: rows.results ?? [], count: (rows.results ?? []).length });
});

app.get('/critical', async (c) => {
  const user = c.get('user') as User | undefined;
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });

  const rows = await c.env.SENTINEL_DB
    .prepare(`
      SELECT i.*, s.name as site_name, u.full_name as guard_name
      FROM incidents i
      LEFT JOIN sites s ON i.site_id = s.id
      LEFT JOIN users u ON i.guard_id = u.id
      WHERE (i.severity = 'Critical' OR i.is_escalated = 1)
        AND i.status NOT IN ('Resolved', 'Closed')
      ORDER BY i.reported_at DESC
      LIMIT 50
    `)
    .all<Record<string, any>>();

  return c.json({ incidents: rows.results ?? [], count: (rows.results ?? []).length });
});

app.get('/:id', async (c) => {
  const user = c.get('user') as User | undefined;
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });

  const id = Number(c.req.param('id'));
  const row = await c.env.SENTINEL_DB
    .prepare(`
      SELECT i.*, s.name as site_name, u.full_name as guard_name,
             c.checkpoint_code, c.name as checkpoint_name, eu.full_name as escalated_to_name
      FROM incidents i
      LEFT JOIN sites s ON i.site_id = s.id
      LEFT JOIN users u ON i.guard_id = u.id
      LEFT JOIN checkpoints c ON i.checkpoint_id = c.id
      LEFT JOIN users eu ON i.escalated_to = eu.id
      WHERE i.id = ?
    `)
    .bind(id)
    .first<Record<string, any>>();

  if (!row) throw new HTTPException(404, { message: 'Incident not found' });
  return c.json({ incident: row });
});

app.post('/', async (c) => {
  const user = c.get('user') as User;
  const body = await c.req.json<Record<string, any>>();
  const { site_id, guard_id, patrol_id, checkpoint_id, category, severity, title, description, latitude, longitude, photo_url } = body;

  if (!site_id || !category || !severity || !title) {
    throw new HTTPException(400, { message: 'Missing required fields' });
  }

  const requiresEvidence = severity === 'Critical' || category === 'Fire' ? 1 : 0;

  const result = await c.env.SENTINEL_DB
    .prepare(`INSERT INTO incidents
      (site_id, guard_id, patrol_id, checkpoint_id, category, severity, title, description,
       status, latitude, longitude, photo_url, requires_evidence_closure)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Open', ?, ?, ?, ?)`)
    .bind(
      Number(site_id), guard_id ? Number(guard_id) : user.id,
      patrol_id ? Number(patrol_id) : null, checkpoint_id ? Number(checkpoint_id) : null,
      category, severity, title, description ?? null,
      latitude ?? null, longitude ?? null, photo_url ?? null, requiresEvidence
    )
    .run<{ lastRowId: number }>();

  const incidentId = result.meta?.last_row_id ?? (result as any).lastRowId;

  await auditLog(c.env.SENTINEL_DB, {
    userId: user.id,
    action: 'observation_create',
    description: `Reported ${severity} ${category} incident: ${title}`,
    ipAddress: c.req.header('cf-connecting-ip') || '',
    deviceInfo: c.req.header('user-agent') || 'unknown',
    relatedId: incidentId,
    relatedType: 'incident',
  });

  const escalated = needsEscalation(category, severity, title, description);
  if (escalated) await triggerEscalation(c.env.SENTINEL_DB, incidentId, title);

  const row = await c.env.SENTINEL_DB
    .prepare(`
      SELECT i.*, s.name as site_name, u.full_name as guard_name
      FROM incidents i
      LEFT JOIN sites s ON i.site_id = s.id
      LEFT JOIN users u ON i.guard_id = u.id
      WHERE i.id = ?
    `)
    .bind(incidentId)
    .first<Record<string, any>>();

  return c.json({ incident: row, escalated }, 201);
});

app.patch('/:id', requireRole('system_admin', 'security_manager', 'security_supervisor'), async (c) => {
  const user = c.get('user') as User;
  const id = Number(c.req.param('id'));
  const body = await c.req.json<Record<string, any>>();

  const incident = await c.env.SENTINEL_DB.prepare('SELECT * FROM incidents WHERE id = ?').bind(id).first<Record<string, any>>();
  if (!incident) throw new HTTPException(404, { message: 'Incident not found' });

  if (body.status === 'Closed' && incident.requires_evidence_closure && !incident.closure_evidence_url && !body.closure_evidence_url) {
    throw new HTTPException(400, { message: 'Closure evidence is required before closing this critical incident' });
  }

  const fields: string[] = [];
  const values: any[] = [];

  if (body.status !== undefined) {
    fields.push('status = ?'); values.push(body.status);
    if (body.status === 'Resolved' || body.status === 'Closed') {
      fields.push('resolved_at = CURRENT_TIMESTAMP');
    }
  }
  if (body.severity !== undefined) { fields.push('severity = ?'); values.push(body.severity); }
  if (body.resolution_notes !== undefined) { fields.push('resolution_notes = ?'); values.push(body.resolution_notes); }
  if (body.closure_evidence_url !== undefined) { fields.push('closure_evidence_url = ?'); values.push(body.closure_evidence_url); }
  if (fields.length === 0) throw new HTTPException(400, { message: 'No fields to update' });
  values.push(id);

  const result = await c.env.SENTINEL_DB
    .prepare(`UPDATE incidents SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run<{ changes: number }>();

  if ((result.meta?.changes ?? (result as any).changes) === 0) throw new HTTPException(404, { message: 'Incident not found' });

  await auditLog(c.env.SENTINEL_DB, {
    userId: user.id,
    action: 'observation_update',
    description: `Updated incident #${id}: status=${body.status || 'unchanged'}`,
    ipAddress: c.req.header('cf-connecting-ip') || '',
    deviceInfo: c.req.header('user-agent') || 'unknown',
    relatedId: id,
    relatedType: 'incident',
  });

  const row = await c.env.SENTINEL_DB
    .prepare(`
      SELECT i.*, s.name as site_name, u.full_name as guard_name
      FROM incidents i
      LEFT JOIN sites s ON i.site_id = s.id
      LEFT JOIN users u ON i.guard_id = u.id
      WHERE i.id = ?
    `)
    .bind(id)
    .first<Record<string, any>>();

  return c.json({ incident: row });
});

app.delete('/:id', requireRole('system_admin'), async (c) => {
  const id = Number(c.req.param('id'));
  const result = await c.env.SENTINEL_DB.prepare('DELETE FROM incidents WHERE id = ?').bind(id).run<{ changes: number }>();
  if ((result.meta?.changes ?? (result as any).changes) === 0) throw new HTTPException(404, { message: 'Incident not found' });
  return c.body(null, 204);
});

export default app;
