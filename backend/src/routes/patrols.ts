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

function getCurrentShift() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 14) return 'A';
  if (hour >= 14 && hour < 22) return 'B';
  return 'C';
}

function getShiftTimes(shift: string) {
  const map: Record<string, { start: string; end: string }> = {
    A: { start: '06:00', end: '14:00' },
    B: { start: '14:00', end: '22:00' },
    C: { start: '22:00', end: '06:00' },
  };
  return map[shift] || map['A'];
}

const CRITICAL_KEYWORDS = ['lpg', 'gas leak', 'fire', 'explosion', 'unauthorized access', 'intrusion', 'breach'];

function shouldEscalate(category: string, severity: string, description?: string) {
  if (severity === 'Critical') return true;
  if (category === 'Fire') return true;
  const desc = (description || '').toLowerCase();
  return CRITICAL_KEYWORDS.some((kw) => desc.includes(kw));
}

async function escalateIncident(db: D1Database, incidentId: number, title: string) {
  const users = await db
    .prepare("SELECT id FROM users WHERE role IN ('security_supervisor', 'security_manager', 'system_admin') AND is_active = 1")
    .all<{ id: number }>();

  const rows = users.results ?? [];
  for (const u of rows) {
    await db
      .prepare(
        `INSERT INTO notifications (user_id, type, title, message, related_id, related_type)
         VALUES (?, 'critical_escalation', ?, ?, ?, 'incident')`
      )
      .bind(u.id, `CRITICAL: ${title}`, `Critical incident reported. Immediate action required. Incident ID: ${incidentId}`, incidentId)
      .run();
  }

  await db
    .prepare("UPDATE incidents SET is_escalated = 1, escalated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(incidentId)
    .run();
}

// ─── GET /current-shift ───────────────────────────────────────────────────
app.get('/current-shift', async (c) => {
  const shift = getCurrentShift();
  return c.json({ shift, ...getShiftTimes(shift) });
});

// ─── GET /checkpoints-due ─────────────────────────────────────────────────
app.get('/checkpoints-due', async (c) => {
  const user = c.get('user') as User | undefined;
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });

  const site_id = c.req.query('site_id');
  let sql = `
    SELECT
      c.id, c.checkpoint_code, c.name, c.area_type, c.patrol_frequency_hours,
      c.latitude, c.longitude, c.qr_code,
      MAX(pc.scanned_at) as last_scanned_at,
      CASE
        WHEN MAX(pc.scanned_at) IS NULL THEN 1
        WHEN (julianday('now') - julianday(MAX(pc.scanned_at))) * 24 >= c.patrol_frequency_hours THEN 1
        ELSE 0
      END as is_due
    FROM checkpoints c
    LEFT JOIN patrol_checkpoints pc ON pc.checkpoint_id = c.id AND pc.status = 'scanned'
    WHERE c.is_active = 1 ${site_id ? 'AND c.site_id = ?' : ''}
    GROUP BY c.id
    ORDER BY c.area_type ASC, c.checkpoint_code ASC
  `;
  const params: (string | number)[] = site_id ? [Number(site_id)] : [];
  const rows = await c.env.SENTINEL_DB.prepare(sql).bind(...params).all<Record<string, any>>();
  return c.json({ checkpoints: rows.results ?? [] });
});

// ─── GET / ────────────────────────────────────────────────────────────────
app.get('/', async (c) => {
  const user = c.get('user') as User | undefined;
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });

  const { site_id, status, guard_id, shift, date_from, date_to } = c.req.query();
  let sql = `
    SELECT p.*, r.name as route_name, u.full_name as guard_name, u.employee_id as guard_employee_id,
           s.name as site_name
    FROM patrols p
    LEFT JOIN patrol_routes r ON p.route_id = r.id
    LEFT JOIN users u ON p.guard_id = u.id
    LEFT JOIN sites s ON p.site_id = s.id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (user.role === 'security_guard') {
    sql += ' AND p.guard_id = ?'; params.push(user.id);
  } else if (guard_id) {
    sql += ' AND p.guard_id = ?'; params.push(Number(guard_id));
  }

  if (site_id) { sql += ' AND p.site_id = ?'; params.push(Number(site_id)); }
  if (status) { sql += ' AND p.status = ?'; params.push(status); }
  if (shift) { sql += ' AND p.shift = ?'; params.push(shift); }
  if (date_from) { sql += ' AND p.scheduled_start >= ?'; params.push(date_from); }
  if (date_to) { sql += ' AND p.scheduled_start <= ?'; params.push(date_to); }
  sql += ' ORDER BY p.scheduled_start DESC LIMIT 200';

  const rows = await c.env.SENTINEL_DB.prepare(sql).bind(...params).all<Record<string, any>>();
  return c.json({ patrols: rows.results ?? [], count: (rows.results ?? []).length });
});

// ─── GET /:id ─────────────────────────────────────────────────────────────
app.get('/:id', async (c) => {
  const user = c.get('user') as User | undefined;
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });

  const id = Number(c.req.param('id'));
  const patrol = await c.env.SENTINEL_DB
    .prepare(`
      SELECT p.*, r.name as route_name, u.full_name as guard_name, u.employee_id as guard_employee_id, s.name as site_name
      FROM patrols p
      LEFT JOIN patrol_routes r ON p.route_id = r.id
      LEFT JOIN users u ON p.guard_id = u.id
      LEFT JOIN sites s ON p.site_id = s.id
      WHERE p.id = ?
    `)
    .bind(id)
    .first<Record<string, any>>();

  if (!patrol) throw new HTTPException(404, { message: 'Patrol not found' });

  const checkpoints = await c.env.SENTINEL_DB
    .prepare(`
      SELECT pc.*, c.name as checkpoint_name, c.checkpoint_code, c.description as checkpoint_description,
             c.area_type, c.patrol_frequency_hours, c.latitude as cp_lat, c.longitude as cp_lng
      FROM patrol_checkpoints pc
      LEFT JOIN checkpoints c ON pc.checkpoint_id = c.id
      WHERE pc.patrol_id = ?
      ORDER BY c.checkpoint_code ASC
    `)
    .bind(id)
    .all<Record<string, any>>();

  return c.json({ patrol, checkpoints: checkpoints.results ?? [] });
});

// ─── POST / ───────────────────────────────────────────────────────────────
app.post('/', requireRole('system_admin', 'security_manager', 'security_supervisor', 'security_guard'), async (c) => {
  const body = await c.req.json<Record<string, any>>();
  const { route_id, guard_id, site_id, shift, scheduled_start, scheduled_end, notes } = body;
  const effectiveGuardId = guard_id || user.id;
if (!effectiveGuardId || !site_id || !shift || !scheduled_start || !scheduled_end) {
    throw new HTTPException(400, { message: 'Missing required fields' });
  }

  const guard = await c.env.SENTINEL_DB
    .prepare("SELECT id, role FROM users WHERE id = ? AND is_active = 1")
    .bind(Number(guard_id))
    .first<{ id: number; role: string }>();
  if (!guard) throw new HTTPException(404, { message: 'Guard not found or inactive' });

  const site = await c.env.SENTINEL_DB.prepare('SELECT id FROM sites WHERE id = ?').bind(Number(site_id)).first<{ id: number }>();
  if (!site) throw new HTTPException(404, { message: 'Site not found' });

  const result = await c.env.SENTINEL_DB
    .prepare(`INSERT INTO patrols (route_id, guard_id, site_id, shift, status, scheduled_start, scheduled_end, notes)
              VALUES (?, ?, ?, ?, 'scheduled', ?, ?, ?)`)
    .bind(route_id ? Number(route_id) : null, Number(effectiveGuardId), Number(site_id), shift, scheduled_start, scheduled_end, notes ?? null)
    .run<{ lastRowId: number }>();

  const patrolId = result.meta?.last_row_id ?? (result as any).lastRowId;

  if (route_id) {
    const rcs = await c.env.SENTINEL_DB
      .prepare('SELECT checkpoint_id FROM route_checkpoints WHERE route_id = ? ORDER BY sequence_order')
      .bind(Number(route_id))
      .all<{ checkpoint_id: number }>();
    for (const rc of rcs.results ?? []) {
      await c.env.SENTINEL_DB
        .prepare("INSERT INTO patrol_checkpoints (patrol_id, checkpoint_id, status) VALUES (?, ?, 'pending')")
        .bind(patrolId, rc.checkpoint_id)
        .run();
    }
  } else {
    const cps = await c.env.SENTINEL_DB
      .prepare('SELECT id FROM checkpoints WHERE site_id = ? AND is_active = 1')
      .bind(Number(site_id))
      .all<{ id: number }>();
    for (const cp of cps.results ?? []) {
      await c.env.SENTINEL_DB
        .prepare("INSERT INTO patrol_checkpoints (patrol_id, checkpoint_id, status) VALUES (?, ?, 'pending')")
        .bind(patrolId, cp.id)
        .run();
    }
  }

  const row = await c.env.SENTINEL_DB
    .prepare(`
      SELECT p.*, r.name as route_name, u.full_name as guard_name, s.name as site_name
      FROM patrols p LEFT JOIN patrol_routes r ON p.route_id = r.id
      LEFT JOIN users u ON p.guard_id = u.id LEFT JOIN sites s ON p.site_id = s.id
      WHERE p.id = ?
    `)
    .bind(patrolId)
    .first<Record<string, any>>();

  return c.json({ patrol: row }, 201);
});

// ─── POST /:id/start ──────────────────────────────────────────────────────
app.post('/:id/start', requireRole('system_admin', 'security_supervisor', 'security_guard'), async (c) => {
  const user = c.get('user') as User;
  const id = Number(c.req.param('id'));

  const patrol = await c.env.SENTINEL_DB.prepare('SELECT * FROM patrols WHERE id = ?').bind(id).first<Record<string, any>>();
  if (!patrol) throw new HTTPException(404, { message: 'Patrol not found' });
  if (patrol.status === 'in_progress') throw new HTTPException(400, { message: 'Patrol already in progress' });
  if (patrol.status === 'completed') throw new HTTPException(400, { message: 'Patrol already completed' });
  if (user.role === 'security_guard' && patrol.guard_id !== user.id) throw new HTTPException(403, { message: 'You can only start your own patrol' });

  await c.env.SENTINEL_DB
    .prepare("UPDATE patrols SET status = 'in_progress', actual_start = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(id)
    .run();

  await auditLog(c.env.SENTINEL_DB, {
    userId: user.id,
    action: 'patrol_start',
    description: `Started patrol #${id}`,
    ipAddress: c.req.header('cf-connecting-ip') || '',
    deviceInfo: c.req.header('user-agent') || 'unknown',
    relatedId: id,
    relatedType: 'patrol',
  });

  const row = await c.env.SENTINEL_DB
    .prepare(`
      SELECT p.*, r.name as route_name, u.full_name as guard_name, s.name as site_name
      FROM patrols p LEFT JOIN patrol_routes r ON p.route_id = r.id
      LEFT JOIN users u ON p.guard_id = u.id LEFT JOIN sites s ON p.site_id = s.id
      WHERE p.id = ?
    `)
    .bind(id)
    .first<Record<string, any>>();

  return c.json({ patrol: row });
});

// ─── POST /:id/complete ───────────────────────────────────────────────────
app.post('/:id/complete', requireRole('system_admin', 'security_supervisor', 'security_guard'), async (c) => {
  const user = c.get('user') as User;
  const id = Number(c.req.param('id'));

  const patrol = await c.env.SENTINEL_DB.prepare('SELECT * FROM patrols WHERE id = ?').bind(id).first<Record<string, any>>();
  if (!patrol) throw new HTTPException(404, { message: 'Patrol not found' });
  if (patrol.status === 'completed') throw new HTTPException(400, { message: 'Patrol already completed' });
  if (user.role === 'security_guard' && patrol.guard_id !== user.id) throw new HTTPException(403, { message: 'You can only complete your own patrol' });

  // ─── BUG FIX: Prevent completion if checkpoints remain ───
  const pendingCheck = await c.env.SENTINEL_DB
    .prepare(`SELECT COUNT(*) as pending_count FROM patrol_checkpoints WHERE patrol_id = ? AND status = 'pending'`)
    .bind(id)
    .first<{ pending_count: number }>();

  const pending = pendingCheck?.pending_count ?? 0;
  if (pending > 0) {
    throw new HTTPException(400, { message: `Cannot complete patrol. ${pending} checkpoint(s) not yet scanned.` });
  }

  await c.env.SENTINEL_DB
    .prepare("UPDATE patrols SET status = 'completed', actual_end = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(id)
    .run();

  await auditLog(c.env.SENTINEL_DB, {
    userId: user.id,
    action: 'patrol_submit',
    description: `Completed patrol #${id}`,
    ipAddress: c.req.header('cf-connecting-ip') || '',
    deviceInfo: c.req.header('user-agent') || 'unknown',
    relatedId: id,
    relatedType: 'patrol',
  });

  const row = await c.env.SENTINEL_DB
    .prepare(`
      SELECT p.*, r.name as route_name, u.full_name as guard_name, s.name as site_name
      FROM patrols p LEFT JOIN patrol_routes r ON p.route_id = r.id
      LEFT JOIN users u ON p.guard_id = u.id LEFT JOIN sites s ON p.site_id = s.id
      WHERE p.id = ?
    `)
    .bind(id)
    .first<Record<string, any>>();

  return c.json({ patrol: row });
});

// ─── POST /:id/scan ───────────────────────────────────────────────────────
app.post('/:id/scan', requireRole('system_admin', 'security_supervisor', 'security_guard'), async (c) => {
  const user = c.get('user') as User;
  const patrolId = Number(c.req.param('id'));
  const body = await c.req.json<Record<string, any>>();
  const { checkpoint_id, qr_code, notes, latitude, longitude, gps_accuracy, photo_url, checklist_responses } = body;

  if (!checkpoint_id) throw new HTTPException(400, { message: 'checkpoint_id is required' });

  const patrol = await c.env.SENTINEL_DB.prepare('SELECT * FROM patrols WHERE id = ?').bind(patrolId).first<Record<string, any>>();
  if (!patrol) throw new HTTPException(404, { message: 'Patrol not found' });
  if (patrol.status !== 'in_progress') throw new HTTPException(400, { message: 'Patrol is not in progress' });

  let cpSql = 'SELECT * FROM checkpoints WHERE id = ?';
  const cpParams: (string | number)[] = [Number(checkpoint_id)];
  if (qr_code) { cpSql += ' AND qr_code = ?'; cpParams.push(qr_code); }

  const checkpoint = await c.env.SENTINEL_DB.prepare(cpSql).bind(...cpParams).first<Record<string, any>>();
  if (!checkpoint) throw new HTTPException(400, { message: qr_code ? 'QR code does not match checkpoint' : 'Checkpoint not found' });

  const pc = await c.env.SENTINEL_DB
    .prepare('SELECT * FROM patrol_checkpoints WHERE patrol_id = ? AND checkpoint_id = ?')
    .bind(patrolId, Number(checkpoint_id))
    .first<Record<string, any>>();

  if (!pc) throw new HTTPException(404, { message: 'Checkpoint not assigned to this patrol' });

  await c.env.SENTINEL_DB
    .prepare(`UPDATE patrol_checkpoints
              SET status = 'scanned', scanned_at = CURRENT_TIMESTAMP, notes = ?,
                  latitude = ?, longitude = ?, gps_accuracy = ?, photo_url = ?
              WHERE id = ?`)
    .bind(notes ?? null, latitude ?? null, longitude ?? null, gps_accuracy ?? null, photo_url ?? null, pc.id)
    .run();

  if (checklist_responses && Array.isArray(checklist_responses) && checklist_responses.length > 0) {
    for (const r of checklist_responses) {
      await c.env.SENTINEL_DB
        .prepare(`INSERT OR REPLACE INTO checklist_responses (patrol_checkpoint_id, checklist_item_id, response, notes)
                  VALUES (?, ?, ?, ?)`)
        .bind(pc.id, Number(r.checklist_item_id), r.response, r.notes ?? null)
        .run();
    }
  }

  await auditLog(c.env.SENTINEL_DB, {
    userId: user.id,
    action: 'qr_scan',
    description: `Scanned checkpoint ${checkpoint.checkpoint_code} (${checkpoint.name}) in patrol #${patrolId}`,
    ipAddress: c.req.header('cf-connecting-ip') || '',
    deviceInfo: c.req.header('user-agent') || 'unknown',
    relatedId: pc.id,
    relatedType: 'patrol_checkpoint',
  });

  const row = await c.env.SENTINEL_DB
    .prepare(`
      SELECT pc.*, c.name as checkpoint_name, c.checkpoint_code, c.area_type, c.description as checkpoint_description
      FROM patrol_checkpoints pc
      LEFT JOIN checkpoints c ON pc.checkpoint_id = c.id
      WHERE pc.id = ?
    `)
    .bind(pc.id)
    .first<Record<string, any>>();

  return c.json({ checkpoint: row });
});

// ─── GET /qr/:qr_code ─────────────────────────────────────────────────────
app.get('/qr/:qr_code', async (c) => {
  const qr_code = c.req.param('qr_code');
  const row = await c.env.SENTINEL_DB
    .prepare(`
      SELECT c.*, s.name as site_name,
             json_group_array(
               json_object('id', ci.id, 'category', ci.category, 'item_text', ci.item_text, 'is_required', ci.is_required)
             ) as checklist_items_json
      FROM checkpoints c
      LEFT JOIN sites s ON c.site_id = s.id
      LEFT JOIN checklist_items ci ON ci.checkpoint_id = c.id
      WHERE c.qr_code = ? AND c.is_active = 1
      GROUP BY c.id
    `)
    .bind(qr_code)
    .first<Record<string, any>>();

  if (!row) throw new HTTPException(404, { message: 'Checkpoint not found for this QR code' });

  try {
    row.checklist_items = JSON.parse(row.checklist_items_json || '[]').filter((i: any) => i.id !== null);
    delete row.checklist_items_json;
  } catch {
    row.checklist_items = [];
  }

  return c.json({ checkpoint: row });
});

// ─── PATCH /:id ───────────────────────────────────────────────────────────
app.patch('/:id', requireRole('system_admin', 'security_supervisor', 'security_guard'), async (c) => {
  const user = c.get('user') as User;
  const id = Number(c.req.param('id'));
  const body = await c.req.json<Record<string, any>>();

  const fields: string[] = [];
  const values: any[] = [];

  if (body.status !== undefined) { fields.push('status = ?'); values.push(body.status); }
  if (body.actual_start !== undefined) { fields.push('actual_start = ?'); values.push(body.actual_start); }
  if (body.actual_end !== undefined) { fields.push('actual_end = ?'); values.push(body.actual_end); }
  if (body.notes !== undefined) { fields.push('notes = ?'); values.push(body.notes); }
  if (fields.length === 0) throw new HTTPException(400, { message: 'No fields to update' });
  values.push(id);

  const result = await c.env.SENTINEL_DB
    .prepare(`UPDATE patrols SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run<{ changes: number }>();

  if ((result.meta?.changes ?? (result as any).changes) === 0) throw new HTTPException(404, { message: 'Patrol not found' });

  const row = await c.env.SENTINEL_DB
    .prepare(`
      SELECT p.*, r.name as route_name, u.full_name as guard_name, s.name as site_name
      FROM patrols p LEFT JOIN patrol_routes r ON p.route_id = r.id
      LEFT JOIN users u ON p.guard_id = u.id LEFT JOIN sites s ON p.site_id = s.id
      WHERE p.id = ?
    `)
    .bind(id)
    .first<Record<string, any>>();

  return c.json({ patrol: row });
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────
app.delete('/:id', requireRole('system_admin'), async (c) => {
  const id = Number(c.req.param('id'));
  const result = await c.env.SENTINEL_DB.prepare('DELETE FROM patrols WHERE id = ?').bind(id).run<{ changes: number }>();
  if ((result.meta?.changes ?? (result as any).changes) === 0) throw new HTTPException(404, { message: 'Patrol not found' });
  return c.body(null, 204);
});

export default app;
