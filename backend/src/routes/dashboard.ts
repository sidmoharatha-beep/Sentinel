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

app.get('/overview', async (c) => {
  const user = c.get('user') as User | undefined;
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });

  const db = c.env.SENTINEL_DB;

  const totalGuards = await db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'security_guard' AND is_active = 1").first<{ count: number }>();
  const activePatrols = await db.prepare("SELECT COUNT(*) as count FROM patrols WHERE status = 'in_progress'").first<{ count: number }>();
  const patrolsToday = await db.prepare("SELECT COUNT(*) as count FROM patrols WHERE date(scheduled_start) = date('now')").first<{ count: number }>();
  const completedToday = await db.prepare("SELECT COUNT(*) as count FROM patrols WHERE status = 'completed' AND date(actual_end) = date('now')").first<{ count: number }>();
  const openIncidents = await db.prepare("SELECT COUNT(*) as count FROM incidents WHERE status NOT IN ('Resolved', 'Closed')").first<{ count: number }>();
  const criticalOpen = await db.prepare("SELECT COUNT(*) as count FROM incidents WHERE severity = 'Critical' AND status NOT IN ('Resolved', 'Closed')").first<{ count: number }>();
  const missedToday = await db.prepare("SELECT COUNT(*) as count FROM patrols WHERE status = 'missed' AND date(scheduled_start) = date('now')").first<{ count: number }>();

  const stats = {
    totalGuards: totalGuards?.count ?? 0,
    activePatrols: activePatrols?.count ?? 0,
    patrolsToday: patrolsToday?.count ?? 0,
    completedToday: completedToday?.count ?? 0,
    openIncidents: openIncidents?.count ?? 0,
    criticalOpen: criticalOpen?.count ?? 0,
    missedToday: missedToday?.count ?? 0,
    complianceToday: Math.round(((completedToday?.count ?? 0) / Math.max(patrolsToday?.count ?? 1, 1)) * 100),
  };

  const recentPatrols = await db
    .prepare(`
      SELECT p.id, p.status, p.shift, p.scheduled_start, p.actual_start, p.actual_end,
             u.full_name as guard_name, u.employee_id as guard_employee_id, s.name as site_name
      FROM patrols p
      LEFT JOIN users u ON p.guard_id = u.id
      LEFT JOIN sites s ON p.site_id = s.id
      ORDER BY p.scheduled_start DESC
      LIMIT 8
    `)
    .all<Record<string, any>>();

  const criticalAlerts = await db
    .prepare(`
      SELECT i.id, i.category, i.severity, i.title, i.status, i.is_escalated, i.reported_at,
             s.name as site_name, u.full_name as guard_name
      FROM incidents i
      LEFT JOIN sites s ON i.site_id = s.id
      LEFT JOIN users u ON i.guard_id = u.id
      WHERE i.status NOT IN ('Resolved', 'Closed')
      ORDER BY CASE i.severity WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END,
               i.reported_at DESC
      LIMIT 10
    `)
    .all<Record<string, any>>();

  return c.json({
    stats,
    recent_patrols: recentPatrols.results ?? [],
    critical_alerts: criticalAlerts.results ?? [],
  });
});

app.get('/shift-compliance', async (c) => {
  const user = c.get('user') as User | undefined;
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });

  const days = Number(c.req.query('days')) || 7;
  const rows = await c.env.SENTINEL_DB
    .prepare(`
      SELECT
        p.shift,
        COUNT(*) as total,
        SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN p.status = 'missed' THEN 1 ELSE 0 END) as missed,
        ROUND(100.0 * SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) / COUNT(*), 1) as compliance_pct
      FROM patrols p
      WHERE p.scheduled_start >= date('now', '-${days} days')
        AND p.shift IS NOT NULL
      GROUP BY p.shift
      ORDER BY p.shift
    `)
    .all<Record<string, any>>();

  return c.json({ shift_compliance: rows.results ?? [] });
});

app.get('/area-compliance', async (c) => {
  const user = c.get('user') as User | undefined;
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });

  const days = Number(c.req.query('days')) || 7;
  const rows = await c.env.SENTINEL_DB
    .prepare(`
      SELECT
        c.area_type,
        c.checkpoint_code,
        c.name as checkpoint_name,
        COUNT(pc.id) as total_scans,
        SUM(CASE WHEN pc.status = 'scanned' THEN 1 ELSE 0 END) as completed_scans,
        MAX(pc.scanned_at) as last_scanned,
        c.patrol_frequency_hours
      FROM checkpoints c
      LEFT JOIN patrol_checkpoints pc ON pc.checkpoint_id = c.id
      LEFT JOIN patrols p ON pc.patrol_id = p.id AND p.scheduled_start >= date('now', '-${days} days')
      WHERE c.is_active = 1
      GROUP BY c.id
      ORDER BY c.area_type, c.checkpoint_code
    `)
    .all<Record<string, any>>();

  const list = rows.results ?? [];
  const byArea: Record<string, { total: number; completed: number }> = {};
  for (const r of list) {
    if (!byArea[r.area_type]) byArea[r.area_type] = { total: 0, completed: 0 };
    byArea[r.area_type].total += r.total_scans || 0;
    byArea[r.area_type].completed += r.completed_scans || 0;
  }

  const areaSummary = Object.entries(byArea).map(([type, d]) => ({
    area_type: type,
    compliance_pct: d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0,
    total_scans: d.total,
    completed_scans: d.completed,
  }));

  return c.json({ checkpoints: list, area_summary: areaSummary });
});

app.get('/patrol-stats', async (c) => {
  const user = c.get('user') as User | undefined;
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });

  const days = Number(c.req.query('days')) || 7;
  const byStatus = await c.env.SENTINEL_DB
    .prepare(`
      SELECT status, COUNT(*) as count
      FROM patrols
      WHERE scheduled_start >= date('now', '-${days} days')
      GROUP BY status
    `)
    .all<Record<string, any>>();

  const byDay = await c.env.SENTINEL_DB
    .prepare(`
      SELECT date(scheduled_start) as date,
             COUNT(*) as total,
             SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
             SUM(CASE WHEN status = 'missed' THEN 1 ELSE 0 END) as missed
      FROM patrols
      WHERE scheduled_start >= date('now', '-${days} days')
      GROUP BY date(scheduled_start)
      ORDER BY date
    `)
    .all<Record<string, any>>();

  return c.json({ by_status: byStatus.results ?? [], by_day: byDay.results ?? [] });
});

app.get('/incident-stats', async (c) => {
  const user = c.get('user') as User | undefined;
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });

  const days = Number(c.req.query('days')) || 7;
  const byCategory = await c.env.SENTINEL_DB
    .prepare(`SELECT category, COUNT(*) as count FROM incidents WHERE reported_at >= date('now', '-${days} days') GROUP BY category`)
    .all<Record<string, any>>();

  const bySeverity = await c.env.SENTINEL_DB
    .prepare(`SELECT severity, COUNT(*) as count FROM incidents WHERE reported_at >= date('now', '-${days} days') GROUP BY severity`)
    .all<Record<string, any>>();

  const byDay = await c.env.SENTINEL_DB
    .prepare(`
      SELECT date(reported_at) as date, COUNT(*) as count,
             SUM(CASE WHEN severity = 'Critical' THEN 1 ELSE 0 END) as critical_count
      FROM incidents WHERE reported_at >= date('now', '-${days} days')
      GROUP BY date(reported_at) ORDER BY date
    `)
    .all<Record<string, any>>();

  return c.json({
    by_category: byCategory.results ?? [],
    by_severity: bySeverity.results ?? [],
    by_day: byDay.results ?? [],
  });
});

app.get('/guard-performance', requireRole('system_admin', 'security_manager', 'security_supervisor'), async (c) => {
  const days = Number(c.req.query('days')) || 30;
  const rows = await c.env.SENTINEL_DB
    .prepare(`
      SELECT
        u.id, u.employee_id, u.full_name, u.shift,
        COUNT(p.id) as total_patrols,
        SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) as completed_patrols,
        SUM(CASE WHEN p.status = 'missed' THEN 1 ELSE 0 END) as missed_patrols,
        ROUND(
          100.0 * SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) / MAX(COUNT(p.id), 1),
          1
        ) as completion_rate
      FROM users u
      LEFT JOIN patrols p ON u.id = p.guard_id
        AND p.scheduled_start >= date('now', '-${days} days')
      WHERE u.role = 'security_guard' AND u.is_active = 1
      GROUP BY u.id
      ORDER BY completion_rate DESC
    `)
    .all<Record<string, any>>();

  return c.json({ guards: rows.results ?? [] });
});

app.get('/top-risk-areas', async (c) => {
  const user = c.get('user') as User | undefined;
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });

  const days = Number(c.req.query('days')) || 30;
  const rows = await c.env.SENTINEL_DB
    .prepare(`
      SELECT
        c.checkpoint_code, c.name as checkpoint_name, c.area_type,
        COUNT(i.id) as incident_count,
        SUM(CASE WHEN i.severity = 'Critical' THEN 4
                 WHEN i.severity = 'High' THEN 3
                 WHEN i.severity = 'Medium' THEN 2
                 ELSE 1 END) as risk_score
      FROM checkpoints c
      LEFT JOIN incidents i ON i.checkpoint_id = c.id
        AND i.reported_at >= date('now', '-${days} days')
      WHERE c.is_active = 1
      GROUP BY c.id
      HAVING incident_count > 0
      ORDER BY risk_score DESC, incident_count DESC
      LIMIT 10
    `)
    .all<Record<string, any>>();

  return c.json({ risk_areas: rows.results ?? [] });
});

app.get('/audit-trail', requireRole('system_admin', 'security_manager'), async (c) => {
  const { user_id, action, date_from, date_to } = c.req.query();
  let sql = `
    SELECT al.*, u.full_name, u.employee_id
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (user_id) { sql += ' AND al.user_id = ?'; params.push(Number(user_id)); }
  if (action) { sql += ' AND al.action = ?'; params.push(action); }
  if (date_from) { sql += ' AND al.created_at >= ?'; params.push(date_from); }
  if (date_to) { sql += ' AND al.created_at <= ?'; params.push(date_to); }
  sql += ' ORDER BY al.created_at DESC LIMIT 500';

  const rows = await c.env.SENTINEL_DB.prepare(sql).bind(...params).all<Record<string, any>>();
  return c.json({ logs: rows.results ?? [], count: (rows.results ?? []).length });
});

export default app;
