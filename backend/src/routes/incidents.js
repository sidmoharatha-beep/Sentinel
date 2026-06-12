const express = require('express');
const { authenticateToken, requireRole, auditLog } = require('../auth');
const { db } = require('../database');
const { validate } = require('../validators');

const router = express.Router();

// Critical-escalation triggers
const CRITICAL_KEYWORDS = ['lpg', 'gas leak', 'fire', 'explosion', 'unauthorized access', 'intrusion', 'breach', 'flame'];

function needsEscalation(category, severity, title, description) {
  if (severity === 'Critical') return true;
  if (category === 'Fire') return true;
  const text = `${title} ${description || ''}`.toLowerCase();
  return CRITICAL_KEYWORDS.some(kw => text.includes(kw));
}

function triggerEscalation(db, incidentId, incidentTitle) {
  // Notify supervisors + managers + admins immediately
  db.all(
    "SELECT id FROM users WHERE role IN ('security_supervisor','security_manager','system_admin') AND is_active = 1",
    [],
    (err, users) => {
      if (err || !users.length) return;
      const insert = db.prepare(
        `INSERT INTO notifications (user_id, type, title, message, related_id, related_type)
         VALUES (?, 'critical_escalation', ?, ?, ?, 'incident')`
      );
      users.forEach(u => {
        insert.run(
          u.id,
          `🚨 CRITICAL ESCALATION: ${incidentTitle}`,
          `A critical incident has been reported and requires immediate attention. Incident ID: ${incidentId}`,
          incidentId
        );
      });
      insert.finalize();

      // Mark incident as escalated
      db.run(
        `UPDATE incidents SET is_escalated = 1, escalated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [incidentId]
      );
    }
  );
}

// ─── GET / ─────────────────────────────────────────────────────────────────
router.get('/', authenticateToken, (req, res) => {
  const { site_id, status, severity, category, guard_id, date_from, date_to, is_escalated } = req.query;
  let sql = `
    SELECT i.*,
           s.name as site_name,
           u.full_name as guard_name, u.employee_id as guard_employee_id,
           c.checkpoint_code, c.name as checkpoint_name
    FROM incidents i
    LEFT JOIN sites s ON i.site_id = s.id
    LEFT JOIN users u ON i.guard_id = u.id
    LEFT JOIN checkpoints c ON i.checkpoint_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (site_id)       { sql += ' AND i.site_id = ?';    params.push(site_id); }
  if (status)        { sql += ' AND i.status = ?';     params.push(status); }
  if (severity)      { sql += ' AND i.severity = ?';   params.push(severity); }
  if (category)      { sql += ' AND i.category = ?';   params.push(category); }
  if (guard_id)      { sql += ' AND i.guard_id = ?';   params.push(guard_id); }
  if (date_from)     { sql += ' AND i.reported_at >= ?'; params.push(date_from); }
  if (date_to)       { sql += ' AND i.reported_at <= ?'; params.push(date_to); }
  if (is_escalated !== undefined) {
    sql += ' AND i.is_escalated = ?';
    params.push(is_escalated === 'true' || is_escalated === '1' ? 1 : 0);
  }
  sql += ' ORDER BY i.reported_at DESC LIMIT 500';

  db.all(sql, params, (err, incidents) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ incidents, count: incidents.length });
  });
});

// ─── GET /critical ─────────────────────────────────────────────────────────
router.get('/critical', authenticateToken, (req, res) => {
  db.all(`
    SELECT i.*, s.name as site_name, u.full_name as guard_name
    FROM incidents i
    LEFT JOIN sites s ON i.site_id = s.id
    LEFT JOIN users u ON i.guard_id = u.id
    WHERE (i.severity = 'Critical' OR i.is_escalated = 1)
      AND i.status NOT IN ('Resolved', 'Closed')
    ORDER BY i.reported_at DESC
    LIMIT 50
  `, [], (err, incidents) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ incidents, count: incidents.length });
  });
});

// ─── GET /:id ──────────────────────────────────────────────────────────────
router.get('/:id', authenticateToken, (req, res) => {
  db.get(`
    SELECT i.*, s.name as site_name, u.full_name as guard_name,
           c.checkpoint_code, c.name as checkpoint_name,
           eu.full_name as escalated_to_name
    FROM incidents i
    LEFT JOIN sites s ON i.site_id = s.id
    LEFT JOIN users u ON i.guard_id = u.id
    LEFT JOIN checkpoints c ON i.checkpoint_id = c.id
    LEFT JOIN users eu ON i.escalated_to = eu.id
    WHERE i.id = ?
  `, [req.params.id], (err, incident) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!incident) return res.status(404).json({ error: 'Incident not found' });
    res.json({ incident });
  });
});

// ─── POST / ────────────────────────────────────────────────────────────────
router.post('/', authenticateToken, validate('createIncident'), (req, res) => {
  const { site_id, guard_id, patrol_id, checkpoint_id, category, severity, title, description, latitude, longitude, photo_url } = req.body;
  const ip = req.ip;
  const device = req.headers['user-agent'];

  // Determine if evidence closure is required (critical incidents must stay open until evidence uploaded)
  const requiresEvidence = severity === 'Critical' || category === 'Fire' ? 1 : 0;

  db.run(
    `INSERT INTO incidents
       (site_id, guard_id, patrol_id, checkpoint_id, category, severity, title, description,
        status, latitude, longitude, photo_url, requires_evidence_closure)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Open', ?, ?, ?, ?)`,
    [site_id, guard_id || req.user.id, patrol_id || null, checkpoint_id || null,
     category, severity, title, description || null,
     latitude || null, longitude || null, photo_url || null, requiresEvidence],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      const incidentId = this.lastID;

      auditLog(db, {
        userId: req.user.id,
        action: 'observation_create',
        description: `Reported ${severity} ${category} incident: ${title}`,
        ipAddress: ip,
        deviceInfo: device,
        relatedId: incidentId,
        relatedType: 'incident'
      });

      // Auto-escalate if critical
      if (needsEscalation(category, severity, title, description)) {
        triggerEscalation(db, incidentId, title);
      }

      db.get(`
        SELECT i.*, s.name as site_name, u.full_name as guard_name
        FROM incidents i
        LEFT JOIN sites s ON i.site_id = s.id
        LEFT JOIN users u ON i.guard_id = u.id
        WHERE i.id = ?
      `, [incidentId], (err2, incident) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.status(201).json({ incident, escalated: needsEscalation(category, severity, title, description) });
      });
    }
  );
});

// ─── PATCH /:id ────────────────────────────────────────────────────────────
router.patch('/:id', authenticateToken,
  requireRole('system_admin', 'security_manager', 'security_supervisor'),
  validate('updateIncident'),
  (req, res) => {
    const ip = req.ip;
    const device = req.headers['user-agent'];

    db.get('SELECT * FROM incidents WHERE id = ?', [req.params.id], (err, incident) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!incident) return res.status(404).json({ error: 'Incident not found' });

      // Block closure without evidence if required
      if (req.body.status === 'Closed' && incident.requires_evidence_closure && !incident.closure_evidence_url && !req.body.closure_evidence_url) {
        return res.status(400).json({ error: 'Closure evidence is required before closing this critical incident' });
      }

      const fields = [];
      const values = [];

      if (req.body.status !== undefined) {
        fields.push('status = ?'); values.push(req.body.status);
        if (req.body.status === 'Resolved' || req.body.status === 'Closed') {
          fields.push('resolved_at = CURRENT_TIMESTAMP');
        }
      }
      if (req.body.severity !== undefined) { fields.push('severity = ?'); values.push(req.body.severity); }
      if (req.body.resolution_notes !== undefined) { fields.push('resolution_notes = ?'); values.push(req.body.resolution_notes); }
      if (req.body.closure_evidence_url !== undefined) { fields.push('closure_evidence_url = ?'); values.push(req.body.closure_evidence_url); }
      if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
      values.push(req.params.id);

      db.run(`UPDATE incidents SET ${fields.join(', ')} WHERE id = ?`, values, function(err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Incident not found' });

        auditLog(db, {
          userId: req.user.id,
          action: 'observation_update',
          description: `Updated incident #${req.params.id}: status=${req.body.status || 'unchanged'}`,
          ipAddress: ip,
          deviceInfo: device,
          relatedId: parseInt(req.params.id),
          relatedType: 'incident'
        });

        db.get(`
          SELECT i.*, s.name as site_name, u.full_name as guard_name
          FROM incidents i
          LEFT JOIN sites s ON i.site_id = s.id
          LEFT JOIN users u ON i.guard_id = u.id
          WHERE i.id = ?
        `, [req.params.id], (err3, updated) => {
          if (err3) return res.status(500).json({ error: err3.message });
          res.json({ incident: updated });
        });
      });
    });
  }
);

// ─── DELETE /:id ───────────────────────────────────────────────────────────
router.delete('/:id', authenticateToken, requireRole('system_admin'), (req, res) => {
  db.run('DELETE FROM incidents WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Incident not found' });
    res.status(204).send();
  });
});

module.exports = router;
