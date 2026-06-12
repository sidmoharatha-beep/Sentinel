const express = require('express');
const { authenticateToken, requireRole } = require('../auth');
const { db } = require('../database');
const { validate } = require('../validators');

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  const { site_id, record_type, status } = req.query;
  let sql = `
    SELECT c.*, s.name as site_name, u.full_name as reviewed_by_name
    FROM compliance_records c
    LEFT JOIN sites s ON c.site_id = s.id
    LEFT JOIN users u ON c.reviewed_by = u.id
    WHERE 1=1
  `;
  const params = [];

  if (site_id) { sql += ' AND c.site_id = ?'; params.push(site_id); }
  if (record_type) { sql += ' AND c.record_type = ?'; params.push(record_type); }
  if (status) { sql += ' AND c.status = ?'; params.push(status); }
  sql += ' ORDER BY c.created_at DESC';

  db.all(sql, params, (err, records) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ records, count: records.length });
  });
});

router.get('/:id', authenticateToken, (req, res) => {
  db.get(`
    SELECT c.*, s.name as site_name, u.full_name as reviewed_by_name
    FROM compliance_records c
    LEFT JOIN sites s ON c.site_id = s.id
    LEFT JOIN users u ON c.reviewed_by = u.id
    WHERE c.id = ?
  `, [req.params.id], (err, record) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!record) return res.status(404).json({ error: 'Compliance record not found' });
    res.json({ record });
  });
});

router.post('/', authenticateToken, requireRole('admin', 'supervisor', 'manager'), validate('createCompliance'), (req, res) => {
  const { site_id, record_type, details } = req.body;

  db.get('SELECT id FROM sites WHERE id = ?', [site_id], (err, site) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!site) return res.status(404).json({ error: 'Site not found' });

    db.run(
      'INSERT INTO compliance_records (site_id, record_type, details) VALUES (?, ?, ?)',
      [site_id, record_type, details || null],
      function(err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        db.get(`
          SELECT c.*, s.name as site_name
          FROM compliance_records c
          LEFT JOIN sites s ON c.site_id = s.id
          WHERE c.id = ?
        `, [this.lastID], (err3, record) => {
          if (err3) return res.status(500).json({ error: err3.message });
          res.status(201).json({ record });
        });
      }
    );
  });
});

router.patch('/:id', authenticateToken, requireRole('admin', 'supervisor', 'manager'), validate('updateCompliance'), (req, res) => {
  const fields = [];
  const values = [];

  if (req.body.status !== undefined) { fields.push('status = ?'); values.push(req.body.status); }
  if (req.body.score !== undefined) { fields.push('score = ?'); values.push(req.body.score); }
  if (req.body.details !== undefined) { fields.push('details = ?'); values.push(req.body.details); }
  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
  values.push(req.params.id);

  db.run(`UPDATE compliance_records SET ${fields.join(', ')} WHERE id = ?`, values, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Compliance record not found' });
    db.get(`
      SELECT c.*, s.name as site_name, u.full_name as reviewed_by_name
      FROM compliance_records c
      LEFT JOIN sites s ON c.site_id = s.id
      LEFT JOIN users u ON c.reviewed_by = u.id
      WHERE c.id = ?
    `, [req.params.id], (err2, record) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ record });
    });
  });
});

router.post('/:id/review', authenticateToken, requireRole('admin', 'supervisor', 'manager'), (req, res) => {
  const { score, details } = req.body;
  db.run(
    'UPDATE compliance_records SET reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, score = ?, details = COALESCE(?, details) WHERE id = ?',
    [req.user.id, score !== undefined ? score : null, details || null, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Compliance record not found' });
      db.get(`
        SELECT c.*, s.name as site_name, u.full_name as reviewed_by_name
        FROM compliance_records c
        LEFT JOIN sites s ON c.site_id = s.id
        LEFT JOIN users u ON c.reviewed_by = u.id
        WHERE c.id = ?
      `, [req.params.id], (err2, record) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ record });
      });
    }
  );
});

router.delete('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  db.run('DELETE FROM compliance_records WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Compliance record not found' });
    res.status(204).send();
  });
});

module.exports = router;
