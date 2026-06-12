const express = require('express');
const { authenticateToken, requireRole } = require('../auth');
const { db } = require('../database');

const router = express.Router();

// ─── GET /overview ─────────────────────────────────────────────────────────
router.get('/overview', authenticateToken, (req, res) => {
  const queries = {
    totalGuards:    "SELECT COUNT(*) as count FROM users WHERE role = 'security_guard' AND is_active = 1",
    activePatrols:  "SELECT COUNT(*) as count FROM patrols WHERE status = 'in_progress'",
    patrolsToday:   "SELECT COUNT(*) as count FROM patrols WHERE date(scheduled_start) = date('now')",
    completedToday: "SELECT COUNT(*) as count FROM patrols WHERE status = 'completed' AND date(actual_end) = date('now')",
    openIncidents:  "SELECT COUNT(*) as count FROM incidents WHERE status NOT IN ('Resolved', 'Closed')",
    criticalOpen:   "SELECT COUNT(*) as count FROM incidents WHERE severity = 'Critical' AND status NOT IN ('Resolved', 'Closed')",
    missedToday:    "SELECT COUNT(*) as count FROM patrols WHERE status = 'missed' AND date(scheduled_start) = date('now')",
  };

  const results = {};
  const keys = Object.keys(queries);
  let pending = keys.length;

  keys.forEach(key => {
    db.get(queries[key], [], (err, row) => {
      if (!err && row) results[key] = row.count;
      else results[key] = 0;
      if (--pending === 0) {
        // Patrol compliance % today
        const total = results.patrolsToday || 1;
        const completed = results.completedToday || 0;
        results.complianceToday = Math.round((completed / total) * 100);

        fetchRecentData(res, results);
      }
    });
  });
});

function fetchRecentData(res, stats) {
  db.all(`
    SELECT p.id, p.status, p.shift, p.scheduled_start, p.actual_start, p.actual_end,
           u.full_name as guard_name, u.employee_id as guard_employee_id,
           s.name as site_name
    FROM patrols p
    LEFT JOIN users u ON p.guard_id = u.id
    LEFT JOIN sites s ON p.site_id = s.id
    ORDER BY p.scheduled_start DESC
    LIMIT 8
  `, [], (err, recentPatrols) => {
    db.all(`
      SELECT i.id, i.category, i.severity, i.title, i.status, i.is_escalated, i.reported_at,
             s.name as site_name, u.full_name as guard_name
      FROM incidents i
      LEFT JOIN sites s ON i.site_id = s.id
      LEFT JOIN users u ON i.guard_id = u.id
      WHERE i.status NOT IN ('Resolved', 'Closed')
      ORDER BY CASE i.severity WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END,
               i.reported_at DESC
      LIMIT 10
    `, [], (err2, criticalAlerts) => {
      res.json({
        stats,
        recent_patrols: recentPatrols || [],
        critical_alerts: criticalAlerts || []
      });
    });
  });
}

// ─── GET /shift-compliance ─────────────────────────────────────────────────
router.get('/shift-compliance', authenticateToken, (req, res) => {
  const days = parseInt(req.query.days) || 7;
  db.all(`
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
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ shift_compliance: rows });
  });
});

// ─── GET /area-compliance ──────────────────────────────────────────────────
router.get('/area-compliance', authenticateToken, (req, res) => {
  const days = parseInt(req.query.days) || 7;
  db.all(`
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
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    // Calculate compliance % per area type
    const byArea = {};
    rows.forEach(r => {
      if (!byArea[r.area_type]) byArea[r.area_type] = { total: 0, completed: 0 };
      byArea[r.area_type].total += r.total_scans || 0;
      byArea[r.area_type].completed += r.completed_scans || 0;
    });

    const areaSummary = Object.entries(byArea).map(([type, d]) => ({
      area_type: type,
      compliance_pct: d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0,
      total_scans: d.total,
      completed_scans: d.completed
    }));

    res.json({ checkpoints: rows, area_summary: areaSummary });
  });
});

// ─── GET /patrol-stats ─────────────────────────────────────────────────────
router.get('/patrol-stats', authenticateToken, (req, res) => {
  const days = parseInt(req.query.days) || 7;
  db.all(`
    SELECT status, COUNT(*) as count
    FROM patrols
    WHERE scheduled_start >= date('now', '-${days} days')
    GROUP BY status
  `, [], (err, byStatus) => {
    if (err) return res.status(500).json({ error: err.message });
    db.all(`
      SELECT date(scheduled_start) as date,
             COUNT(*) as total,
             SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
             SUM(CASE WHEN status = 'missed' THEN 1 ELSE 0 END) as missed
      FROM patrols
      WHERE scheduled_start >= date('now', '-${days} days')
      GROUP BY date(scheduled_start)
      ORDER BY date
    `, [], (err2, byDay) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ by_status: byStatus, by_day: byDay });
    });
  });
});

// ─── GET /incident-stats ───────────────────────────────────────────────────
router.get('/incident-stats', authenticateToken, (req, res) => {
  const days = parseInt(req.query.days) || 7;
  db.all(`
    SELECT category, COUNT(*) as count
    FROM incidents WHERE reported_at >= date('now', '-${days} days')
    GROUP BY category
  `, [], (err, byCategory) => {
    if (err) return res.status(500).json({ error: err.message });
    db.all(`
      SELECT severity, COUNT(*) as count
      FROM incidents WHERE reported_at >= date('now', '-${days} days')
      GROUP BY severity
    `, [], (err2, bySeverity) => {
      if (err2) return res.status(500).json({ error: err2.message });
      db.all(`
        SELECT date(reported_at) as date, COUNT(*) as count,
               SUM(CASE WHEN severity = 'Critical' THEN 1 ELSE 0 END) as critical_count
        FROM incidents WHERE reported_at >= date('now', '-${days} days')
        GROUP BY date(reported_at) ORDER BY date
      `, [], (err3, byDay) => {
        if (err3) return res.status(500).json({ error: err3.message });
        res.json({ by_category: byCategory, by_severity: bySeverity, by_day: byDay });
      });
    });
  });
});

// ─── GET /guard-performance ────────────────────────────────────────────────
router.get('/guard-performance', authenticateToken,
  requireRole('system_admin', 'security_manager', 'security_supervisor'),
  (req, res) => {
    const days = parseInt(req.query.days) || 30;
    db.all(`
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
    `, [], (err, guards) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ guards });
    });
  }
);

// ─── GET /top-risk-areas ───────────────────────────────────────────────────
router.get('/top-risk-areas', authenticateToken, (req, res) => {
  const days = parseInt(req.query.days) || 30;
  db.all(`
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
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ risk_areas: rows });
  });
});

// ─── GET /audit-trail ─────────────────────────────────────────────────────
router.get('/audit-trail', authenticateToken,
  requireRole('system_admin', 'security_manager'),
  (req, res) => {
    const { user_id, action, date_from, date_to } = req.query;
    let sql = `
      SELECT al.*, u.full_name, u.employee_id
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    if (user_id) { sql += ' AND al.user_id = ?'; params.push(user_id); }
    if (action)  { sql += ' AND al.action = ?';  params.push(action); }
    if (date_from) { sql += ' AND al.created_at >= ?'; params.push(date_from); }
    if (date_to)   { sql += ' AND al.created_at <= ?'; params.push(date_to); }
    sql += ' ORDER BY al.created_at DESC LIMIT 500';

    db.all(sql, params, (err, logs) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ logs, count: logs.length });
    });
  }
);

module.exports = router;
