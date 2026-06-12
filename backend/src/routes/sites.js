const express = require('express');
const { authenticateToken, requireRole } = require('../auth');
const { db } = require('../database');
const { validate } = require('../validators');

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  const { search, is_active } = req.query;
  let sql = 'SELECT * FROM sites WHERE 1=1';
  const params = [];

  if (is_active !== undefined) { sql += ' AND is_active = ?'; params.push(is_active === 'true' || is_active === '1' ? 1 : 0); }
  if (search) {
    sql += ' AND (name LIKE ? OR address LIKE ? OR city LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  sql += ' ORDER BY created_at DESC';

  db.all(sql, params, (err, sites) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ sites, count: sites.length });
  });
});

router.get('/:id', authenticateToken, (req, res) => {
  db.get('SELECT * FROM sites WHERE id = ?', [req.params.id], (err, site) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!site) return res.status(404).json({ error: 'Site not found' });

    db.all('SELECT * FROM checkpoints WHERE site_id = ? AND is_active = 1 ORDER BY id', [req.params.id], (err2, checkpoints) => {
      if (err2) return res.status(500).json({ error: err2.message });
      db.all('SELECT * FROM patrol_routes WHERE site_id = ? AND is_active = 1 ORDER BY id', [req.params.id], (err3, routes) => {
        if (err3) return res.status(500).json({ error: err3.message });
        res.json({ site, checkpoints, routes });
      });
    });
  });
});

router.post('/', authenticateToken, requireRole('admin', 'manager'), validate('createSite'), (req, res) => {
  const { name, address, city, state, zip, contact_name, contact_phone, contact_email } = req.body;
  db.run(
    'INSERT INTO sites (name, address, city, state, zip, contact_name, contact_phone, contact_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [name, address, city || null, state || null, zip || null, contact_name || null, contact_phone || null, contact_email || null],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT * FROM sites WHERE id = ?', [this.lastID], (err2, site) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.status(201).json({ site });
      });
    }
  );
});

router.patch('/:id', authenticateToken, requireRole('admin', 'manager'), validate('updateSite'), (req, res) => {
  const fields = [];
  const values = [];
  const allowed = ['name', 'address', 'city', 'state', 'zip', 'contact_name', 'contact_phone', 'contact_email', 'is_active'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) { fields.push(`${key} = ?`); values.push(req.body[key]); }
  }
  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
  values.push(req.params.id);

  db.run(`UPDATE sites SET ${fields.join(', ')} WHERE id = ?`, values, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Site not found' });
    db.get('SELECT * FROM sites WHERE id = ?', [req.params.id], (err2, site) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ site });
    });
  });
});

router.delete('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  db.run('DELETE FROM sites WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Site not found' });
    res.status(204).send();
  });
});

router.get('/:id/checkpoints', authenticateToken, (req, res) => {
  db.all('SELECT * FROM checkpoints WHERE site_id = ? ORDER BY id', [req.params.id], (err, checkpoints) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ checkpoints, count: checkpoints.length });
  });
});

router.post('/:id/checkpoints', authenticateToken, requireRole('admin', 'manager'), validate('createCheckpoint'), (req, res) => {
  const { name, description, qr_code, latitude, longitude } = req.body;
  const siteId = req.params.id;

  db.get('SELECT id FROM sites WHERE id = ?', [siteId], (err, site) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!site) return res.status(404).json({ error: 'Site not found' });

    db.run(
      'INSERT INTO checkpoints (site_id, name, description, qr_code, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?)',
      [siteId, name, description || null, qr_code || null, latitude || null, longitude || null],
      function(err2) {
        if (err2) {
          if (err2.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'QR code already exists' });
          }
          return res.status(500).json({ error: err2.message });
        }
        db.get('SELECT * FROM checkpoints WHERE id = ?', [this.lastID], (err3, checkpoint) => {
          if (err3) return res.status(500).json({ error: err3.message });
          res.status(201).json({ checkpoint });
        });
      }
    );
  });
});

module.exports = router;
