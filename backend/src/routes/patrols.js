const express = require('express');
const { authenticateToken, requireRole, auditLog } = require('../auth');
const { db } = require('../database');
const { validate } = require('../validators');

const router = express.Router();

// ─── SHIFT DETECTION HELPER ────────────────────────────────────────────────
// Shift A: 06:00 – 14:00
// Shift B: 14:00 – 22:00
// Shift C: 22:00 – 06:00
function getCurrentShift() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 14) return 'A';
  if (hour >= 14 && hour < 22) return 'B';
  return 'C';
}

function getShiftTimes(shift) {
  const shiftMap = {
    A: { start: '06:00', end: '14:00' },
    B: { start: '14:00', end: '22:00' },
    C: { start: '22:00', end: '06:00' }
  };
  return shiftMap[shift] || shiftMap['A'];
}

// ─── CRITICAL ESCALATION HELPER ────────────────────────────────────────────
const CRITICAL_KEYWORDS = ['lpg', 'gas leak', 'fire', 'explosion', 'unauthorized access', 'intrusion', 'breach'];

function shouldEscalate(category, severity, description) {
  if (severity === 'Critical') return true;
  if (category === 'Fire') return true;
  const desc = (description || '').toLowerCase();
  return CRITICAL_KEYWORDS.some(kw => desc.includes(kw));
}

function escalateIncident(db, incidentId, siteId, title, guardId) {
  // Notify all supervisors and managers for this site
  db.all(
    "SELECT id FROM users WHERE role IN ('security_supervisor', 'security_manager', 'system_admin') AND is_active = 1",
    [],
    (err, users) => {
      if (err || !users) return;
      const insert = db.prepare(
        `INSERT INTO notifications (user_id, type, title, message, related_id, related_type)
         VALUES (?, 'critical_escalation', ?, ?, ?, 'incident')`
      );
      users.forEach(u => {
        insert.run(u.id, `🚨 CRITICAL: ${title}`, `Critical incident reported. Immediate action required. Incident ID: ${incidentId}`, incidentId);
      });
      insert.finalize();

      db.run(
        `UPDATE incidents SET is_escalated = 1, escalated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [incidentId]
      );
    }
  );
}

// ─── GET /current-shift ────────────────────────────────────────────────────
router.get('/current-shift', authenticateToken, (req, res) => {
  const shift = getCurrentShift();
  const times = getShiftTimes(shift);
  res.json({ shift, ...times });
});

// ─── GET /checkpoints-due ─────────────────────────────────────────────────
// Returns checkpoints that are due for patrol based on frequency and last scan time
router.get('/checkpoints-due', authenticateToken, (req, res) => {
  const { site_id } = req.query;
  const sql = `
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
  const params = site_id ? [site_id] : [];
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ checkpoints: rows });
  });
});

// ─── GET / ─────────────────────────────────────────────────────────────────
router.get('/', authenticateToken, (req, res) => {
  const { site_id, status, guard_id, shift, date_from, date_to } = req.query;
  let sql = `
    SELECT p.*, r.name as route_name, u.full_name as guard_name, u.employee_id as guard_employee_id,
           s.name as site_name
    FROM patrols p
    LEFT JOIN patrol_routes r ON p.route_id = r.id
    LEFT JOIN users u ON p.guard_id = u.id
    LEFT JOIN sites s ON p.site_id = s.id
    WHERE 1=1
  `;
  const params = [];

  // Guards can only see their own patrols
  if (req.user.role === 'security_guard') {
    sql += ' AND p.guard_id = ?'; params.push(req.user.id);
  } else {
    if (guard_id) { sql += ' AND p.guard_id = ?'; params.push(guard_id); }
  }
  if (site_id) { sql += ' AND p.site_id = ?'; params.push(site_id); }
  if (status) { sql += ' AND p.status = ?'; params.push(status); }
  if (shift) { sql += ' AND p.shift = ?'; params.push(shift); }
  if (date_from) { sql += ' AND p.scheduled_start >= ?'; params.push(date_from); }
  if (date_to) { sql += ' AND p.scheduled_start <= ?'; params.push(date_to); }
  sql += ' ORDER BY p.scheduled_start DESC LIMIT 200';

  db.all(sql, params, (err, patrols) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ patrols, count: patrols.length });
  });
});

// ─── GET /:id ──────────────────────────────────────────────────────────────
router.get('/:id', authenticateToken, (req, res) => {
  db.get(`
    SELECT p.*, r.name as route_name, u.full_name as guard_name, u.employee_id as guard_employee_id,
           s.name as site_name
    FROM patrols p
    LEFT JOIN patrol_routes r ON p.route_id = r.id
    LEFT JOIN users u ON p.guard_id = u.id
    LEFT JOIN sites s ON p.site_id = s.id
    WHERE p.id = ?
  `, [req.params.id], (err, patrol) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!patrol) return res.status(404).json({ error: 'Patrol not found' });

    db.all(`
      SELECT pc.*,
             c.name as checkpoint_name, c.checkpoint_code, c.description as checkpoint_description,
             c.area_type, c.patrol_frequency_hours, c.latitude as cp_lat, c.longitude as cp_lng
      FROM patrol_checkpoints pc
      LEFT JOIN checkpoints c ON pc.checkpoint_id = c.id
      WHERE pc.patrol_id = ?
      ORDER BY c.checkpoint_code ASC
    `, [req.params.id], (err2, checkpoints) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ patrol, checkpoints });
    });
  });
});

// ─── POST / (Create Patrol) ────────────────────────────────────────────────
router.post('/', authenticateToken,
  requireRole('system_admin', 'security_manager', 'security_supervisor'),
  validate('createPatrol'),
  (req, res) => {
    const { route_id, guard_id, site_id, shift, scheduled_start, scheduled_end, notes } = req.body;

    db.get("SELECT id, role FROM users WHERE id = ? AND is_active = 1", [guard_id], (err2, guard) => {
      if (err2) return res.status(500).json({ error: err2.message });
      if (!guard) return res.status(404).json({ error: 'Guard not found or inactive' });

      db.get('SELECT id FROM sites WHERE id = ?', [site_id], (err3, site) => {
        if (err3) return res.status(500).json({ error: err3.message });
        if (!site) return res.status(404).json({ error: 'Site not found' });

        db.run(
          `INSERT INTO patrols (route_id, guard_id, site_id, shift, status, scheduled_start, scheduled_end, notes)
           VALUES (?, ?, ?, ?, 'scheduled', ?, ?, ?)`,
          [route_id || null, guard_id, site_id, shift, scheduled_start, scheduled_end, notes || null],
          function(err4) {
            if (err4) return res.status(500).json({ error: err4.message });
            const patrolId = this.lastID;

            // If a route is provided, copy its checkpoints
            if (route_id) {
              db.all('SELECT DISTINCT checkpoint_id FROM route_checkpoints WHERE route_id = ? ORDER BY sequence_order', [route_id], (err5, rows) => {
                if (!err5 && rows) {
                  const insertPc = db.prepare('INSERT OR IGNORE INTO patrol_checkpoints (patrol_id, checkpoint_id, status) VALUES (?, ?, ?)');
                  rows.forEach(rc => insertPc.run(patrolId, rc.checkpoint_id, 'pending'));
                  insertPc.finalize();
                }
                returnPatrol(res, patrolId);
              });
            } else {
              // Add all site checkpoints
              db.all('SELECT DISTINCT id FROM checkpoints WHERE site_id = ? AND is_active = 1', [site_id], (err5, cps) => {
                if (!err5 && cps) {
                  const insertPc = db.prepare('INSERT OR IGNORE INTO patrol_checkpoints (patrol_id, checkpoint_id, status) VALUES (?, ?, ?)');
                  cps.forEach(cp => insertPc.run(patrolId, cp.id, 'pending'));
                  insertPc.finalize();
                }
                returnPatrol(res, patrolId);
              });
            }
          }
        );
      });
    });
  }
);

function returnPatrol(res, patrolId) {
  db.get(`
    SELECT p.*, r.name as route_name, u.full_name as guard_name, s.name as site_name
    FROM patrols p
    LEFT JOIN patrol_routes r ON p.route_id = r.id
    LEFT JOIN users u ON p.guard_id = u.id
    LEFT JOIN sites s ON p.site_id = s.id
    WHERE p.id = ?
  `, [patrolId], (err, patrol) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ patrol });
  });
}

// ─── POST /:id/start ───────────────────────────────────────────────────────
router.post('/:id/start', authenticateToken,
  requireRole('system_admin', 'security_supervisor', 'security_guard'),
  (req, res) => {
    const ip = req.ip;
    const device = req.headers['user-agent'];

    db.get('SELECT * FROM patrols WHERE id = ?', [req.params.id], (err, patrol) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!patrol) return res.status(404).json({ error: 'Patrol not found' });
      if (patrol.status === 'in_progress') return res.status(400).json({ error: 'Patrol already in progress' });
      if (patrol.status === 'completed') return res.status(400).json({ error: 'Patrol already completed' });

      // Guards can only start their own patrol
      if (req.user.role === 'security_guard' && patrol.guard_id !== req.user.id) {
        return res.status(403).json({ error: 'You can only start your own patrol' });
      }

      db.run("UPDATE patrols SET status = 'in_progress', actual_start = CURRENT_TIMESTAMP WHERE id = ?", [req.params.id], function(err2) {
        if (err2) return res.status(500).json({ error: err2.message });

        auditLog(db, {
          userId: req.user.id,
          action: 'patrol_start',
          description: `Started patrol #${req.params.id}`,
          ipAddress: ip,
          deviceInfo: device,
          relatedId: parseInt(req.params.id),
          relatedType: 'patrol'
        });

        db.get(`
          SELECT p.*, r.name as route_name, u.full_name as guard_name, s.name as site_name
          FROM patrols p LEFT JOIN patrol_routes r ON p.route_id = r.id
          LEFT JOIN users u ON p.guard_id = u.id LEFT JOIN sites s ON p.site_id = s.id
          WHERE p.id = ?
        `, [req.params.id], (err3, updated) => {
          if (err3) return res.status(500).json({ error: err3.message });
          res.json({ patrol: updated });
        });
      });
    });
  }
);

// ─── POST /:id/complete ────────────────────────────────────────────────────
router.post('/:id/complete', authenticateToken,
  requireRole('system_admin', 'security_supervisor', 'security_guard'),
  (req, res) => {
    const ip = req.ip;
    const device = req.headers['user-agent'];

    db.get('SELECT * FROM patrols WHERE id = ?', [req.params.id], (err, patrol) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!patrol) return res.status(404).json({ error: 'Patrol not found' });
      if (patrol.status === 'completed') return res.status(400).json({ error: 'Patrol already completed' });

      if (req.user.role === 'security_guard' && patrol.guard_id !== req.user.id) {
        return res.status(403).json({ error: 'You can only complete your own patrol' });
      }

      db.run("UPDATE patrols SET status = 'completed', actual_end = CURRENT_TIMESTAMP WHERE id = ?", [req.params.id], function(err2) {
        if (err2) return res.status(500).json({ error: err2.message });

        auditLog(db, {
          userId: req.user.id,
          action: 'patrol_submit',
          description: `Completed patrol #${req.params.id}`,
          ipAddress: ip,
          deviceInfo: device,
          relatedId: parseInt(req.params.id),
          relatedType: 'patrol'
        });

        db.get(`
          SELECT p.*, r.name as route_name, u.full_name as guard_name, s.name as site_name
          FROM patrols p LEFT JOIN patrol_routes r ON p.route_id = r.id
          LEFT JOIN users u ON p.guard_id = u.id LEFT JOIN sites s ON p.site_id = s.id
          WHERE p.id = ?
        `, [req.params.id], (err3, updated) => {
          if (err3) return res.status(500).json({ error: err3.message });
          res.json({ patrol: updated });
        });
      });
    });
  }
);

// ─── POST /:id/scan (QR Scan a Checkpoint) ────────────────────────────────
router.post('/:id/scan', authenticateToken,
  requireRole('system_admin', 'security_supervisor', 'security_guard'),
  validate('scanCheckpoint'),
  (req, res) => {
    const { checkpoint_id, qr_code, notes, latitude, longitude, gps_accuracy, photo_url, checklist_responses } = req.body;
    const patrolId = parseInt(req.params.id);
    const ip = req.ip;
    const device = req.headers['user-agent'];

    db.get('SELECT * FROM patrols WHERE id = ?', [patrolId], (err, patrol) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!patrol) return res.status(404).json({ error: 'Patrol not found' });
      if (patrol.status !== 'in_progress') return res.status(400).json({ error: 'Patrol is not in progress' });

      // Validate QR code if provided
      const checkpointQuery = qr_code
        ? 'SELECT * FROM checkpoints WHERE id = ? AND qr_code = ?'
        : 'SELECT * FROM checkpoints WHERE id = ?';
      const checkpointParams = qr_code ? [checkpoint_id, qr_code] : [checkpoint_id];

      db.get(checkpointQuery, checkpointParams, (cpErr, checkpoint) => {
        if (cpErr) return res.status(500).json({ error: cpErr.message });
        if (!checkpoint) {
          return res.status(400).json({ error: qr_code ? 'QR code does not match checkpoint' : 'Checkpoint not found' });
        }

        db.get('SELECT * FROM patrol_checkpoints WHERE patrol_id = ? AND checkpoint_id = ?', [patrolId, checkpoint_id], (err2, pc) => {
          if (err2) return res.status(500).json({ error: err2.message });
          if (!pc) return res.status(404).json({ error: 'Checkpoint not assigned to this patrol' });

          db.run(
            `UPDATE patrol_checkpoints
             SET status = 'scanned', scanned_at = CURRENT_TIMESTAMP, notes = ?,
                 latitude = ?, longitude = ?, gps_accuracy = ?, photo_url = ?
             WHERE id = ?`,
            [notes || null, latitude || null, longitude || null, gps_accuracy || null, photo_url || null, pc.id],
            function(err3) {
              if (err3) return res.status(500).json({ error: err3.message });

              // Save checklist responses
              if (checklist_responses && checklist_responses.length > 0) {
                const insertResp = db.prepare(
                  `INSERT OR REPLACE INTO checklist_responses (patrol_checkpoint_id, checklist_item_id, response, notes)
                   VALUES (?, ?, ?, ?)`
                );
                checklist_responses.forEach(r => {
                  insertResp.run(pc.id, r.checklist_item_id, r.response, r.notes || null);
                });
                insertResp.finalize();
              }

              auditLog(db, {
                userId: req.user.id,
                action: 'qr_scan',
                description: `Scanned checkpoint ${checkpoint.checkpoint_code} (${checkpoint.name}) in patrol #${patrolId}`,
                ipAddress: ip,
                deviceInfo: device,
                relatedId: pc.id,
                relatedType: 'patrol_checkpoint'
              });

              db.get(`
                SELECT pc.*, c.name as checkpoint_name, c.checkpoint_code, c.area_type,
                       c.description as checkpoint_description
                FROM patrol_checkpoints pc
                LEFT JOIN checkpoints c ON pc.checkpoint_id = c.id
                WHERE pc.id = ?
              `, [pc.id], (err4, updated) => {
                if (err4) return res.status(500).json({ error: err4.message });
                res.json({ checkpoint: updated });
              });
            }
          );
        });
      });
    });
  }
);

// ─── GET /checkpoints/:qr_code (QR Lookup) ────────────────────────────────
router.get('/qr/:qr_code', authenticateToken, (req, res) => {
  db.get(`
    SELECT c.*, s.name as site_name,
           json_group_array(
             json_object('id', ci.id, 'category', ci.category, 'item_text', ci.item_text, 'is_required', ci.is_required)
           ) as checklist_items_json
    FROM checkpoints c
    LEFT JOIN sites s ON c.site_id = s.id
    LEFT JOIN checklist_items ci ON ci.checkpoint_id = c.id
    WHERE c.qr_code = ? AND c.is_active = 1
    GROUP BY c.id
  `, [req.params.qr_code], (err, checkpoint) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!checkpoint) return res.status(404).json({ error: 'Checkpoint not found for this QR code' });

    try {
      checkpoint.checklist_items = JSON.parse(checkpoint.checklist_items_json || '[]').filter(i => i.id !== null);
      delete checkpoint.checklist_items_json;
    } catch (e) {
      checkpoint.checklist_items = [];
    }
    res.json({ checkpoint });
  });
});

// ─── PATCH /:id ────────────────────────────────────────────────────────────
router.patch('/:id', authenticateToken,
  requireRole('system_admin', 'security_supervisor', 'security_guard'),
  validate('updatePatrol'),
  (req, res) => {
    const fields = [];
    const values = [];

    if (req.body.status !== undefined) { fields.push('status = ?'); values.push(req.body.status); }
    if (req.body.actual_start !== undefined) { fields.push('actual_start = ?'); values.push(req.body.actual_start); }
    if (req.body.actual_end !== undefined) { fields.push('actual_end = ?'); values.push(req.body.actual_end); }
    if (req.body.notes !== undefined) { fields.push('notes = ?'); values.push(req.body.notes); }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(req.params.id);

    db.run(`UPDATE patrols SET ${fields.join(', ')} WHERE id = ?`, values, function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Patrol not found' });
      db.get(`
        SELECT p.*, r.name as route_name, u.full_name as guard_name, s.name as site_name
        FROM patrols p LEFT JOIN patrol_routes r ON p.route_id = r.id
        LEFT JOIN users u ON p.guard_id = u.id LEFT JOIN sites s ON p.site_id = s.id
        WHERE p.id = ?
      `, [req.params.id], (err2, patrol) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ patrol });
      });
    });
  }
);

// ─── DELETE /:id ───────────────────────────────────────────────────────────
router.delete('/:id', authenticateToken, requireRole('system_admin'), (req, res) => {
  db.run('DELETE FROM patrols WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Patrol not found' });
    res.status(204).send();
  });
});

// ─── POST /:id/force-complete (Admin: Force complete in-progress patrol) ───
router.post('/:id/force-complete', authenticateToken,
  requireRole('system_admin', 'security_manager'),
  (req, res) => {
    db.get('SELECT * FROM patrols WHERE id = ?', [req.params.id], (err, patrol) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!patrol) return res.status(404).json({ error: 'Patrol not found' });
      if (patrol.status === 'completed') return res.status(400).json({ error: 'Patrol already completed' });

      db.run(
        "UPDATE patrols SET status = 'completed', actual_end = CURRENT_TIMESTAMP WHERE id = ?",
        [req.params.id],
        function(err2) {
          if (err2) return res.status(500).json({ error: err2.message });
          auditLog(db, {
            userId: req.user.id,
            action: 'patrol_force_complete',
            description: `Admin force-completed patrol #${req.params.id}`,
            ipAddress: req.ip,
            deviceInfo: req.headers['user-agent'],
            relatedId: parseInt(req.params.id),
            relatedType: 'patrol'
          });
          db.get(`
            SELECT p.*, r.name as route_name, u.full_name as guard_name, s.name as site_name
            FROM patrols p LEFT JOIN patrol_routes r ON p.route_id = r.id
            LEFT JOIN users u ON p.guard_id = u.id LEFT JOIN sites s ON p.site_id = s.id
            WHERE p.id = ?
          `, [req.params.id], (err3, updated) => {
            if (err3) return res.status(500).json({ error: err3.message });
            res.json({ patrol: updated });
          });
        }
      );
    });
  }
);

// ─── GET /checklist-submissions (Export checklist data) ─────────────────────
// Returns all checkpoint checklist submission entries (for Excel/PDF download)
router.get('/checklist-submissions', authenticateToken,
  requireRole('system_admin', 'security_manager'),
  (req, res) => {
    const { site_id, date_from, date_to, patrol_id } = req.query;
    let sql = `
      SELECT
        p.id as patrol_id,
        p.shift,
        p.status as patrol_status,
        p.scheduled_start,
        p.actual_start,
        p.actual_end,
        u.full_name as guard_name,
        u.employee_id as guard_employee_id,
        s.name as site_name,
        c.checkpoint_code,
        c.name as checkpoint_name,
        c.area_type,
        pc.status as checkpoint_status,
        pc.scanned_at,
        pc.notes as checkpoint_notes,
        pc.latitude,
        pc.longitude,
        ci.category as checklist_category,
        ci.item_text as checklist_item,
        cr.response as checklist_response,
        cr.notes as checklist_notes
      FROM patrols p
      LEFT JOIN users u ON p.guard_id = u.id
      LEFT JOIN sites s ON p.site_id = s.id
      LEFT JOIN patrol_checkpoints pc ON pc.patrol_id = p.id
      LEFT JOIN checkpoints c ON pc.checkpoint_id = c.id
      LEFT JOIN checklist_items ci ON ci.checkpoint_id = c.id
      LEFT JOIN checklist_responses cr ON cr.patrol_checkpoint_id = pc.id AND cr.checklist_item_id = ci.id
      WHERE pc.status = 'scanned'
    `;
    const params = [];
    if (site_id) { sql += ' AND p.site_id = ?'; params.push(site_id); }
    if (patrol_id) { sql += ' AND p.id = ?'; params.push(patrol_id); }
    if (date_from) { sql += ' AND p.scheduled_start >= ?'; params.push(date_from); }
    if (date_to) { sql += ' AND p.scheduled_start <= ?'; params.push(date_to); }
    sql += ' ORDER BY p.scheduled_start DESC, c.checkpoint_code ASC, ci.sort_order ASC';

    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ submissions: rows || [], count: (rows || []).length });
    });
  }
);

module.exports = router;
