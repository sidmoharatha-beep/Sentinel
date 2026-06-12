const express = require('express');
const { authenticateToken, requireRole, generateToken, comparePassword, hashPassword, auditLog } = require('../auth');
const { db } = require('../database');
const { validate } = require('../validators');

const router = express.Router();

// ─── LOGIN (Employee ID + Password) ────────────────────────────────────────
router.post('/login', validate('login'), (req, res) => {
  const { employee_id, password } = req.body;
  const ip = req.ip || req.connection.remoteAddress;
  const device = req.headers['user-agent'] || 'unknown';

  // Look up by employee_id OR username (backward compat)
  db.get(
    'SELECT * FROM users WHERE employee_id = ? OR username = ?',
    [employee_id, employee_id],
    (err, user) => {
      if (err) return res.status(500).json({ error: err.message });

      if (!user || !comparePassword(password, user.password_hash)) {
        // Log failed attempt
        auditLog(db, {
          userId: user ? user.id : null,
          action: 'login',
          description: `Failed login attempt for employee_id: ${employee_id}`,
          ipAddress: ip,
          deviceInfo: device
        });
        return res.status(401).json({ error: 'Invalid Employee ID or password' });
      }

      if (!user.is_active) {
        return res.status(403).json({ error: 'Account is deactivated' });
      }

      const token = generateToken(user);

      // Log successful login
      auditLog(db, {
        userId: user.id,
        action: 'login',
        description: `Successful login`,
        ipAddress: ip,
        deviceInfo: device,
        relatedId: user.id,
        relatedType: 'user'
      });

      res.json({
        token,
        user: {
          id: user.id,
          employee_id: user.employee_id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          shift: user.shift,
          phone: user.phone
        }
      });
    }
  );
});

// ─── LOGOUT ────────────────────────────────────────────────────────────────
router.post('/logout', authenticateToken, (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  const device = req.headers['user-agent'] || 'unknown';

  auditLog(db, {
    userId: req.user.id,
    action: 'logout',
    description: 'User logged out',
    ipAddress: ip,
    deviceInfo: device,
    relatedId: req.user.id,
    relatedType: 'user'
  });

  res.json({ message: 'Logged out successfully' });
});

// ─── CURRENT USER ──────────────────────────────────────────────────────────
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// ─── LIST USERS ────────────────────────────────────────────────────────────
router.get('/users', authenticateToken, requireRole('system_admin', 'security_manager', 'security_supervisor'), (req, res) => {
  const { role, search, is_active, shift } = req.query;
  let sql = 'SELECT id, employee_id, username, email, full_name, role, phone, shift, is_active, created_at FROM users WHERE 1=1';
  const params = [];

  if (role) { sql += ' AND role = ?'; params.push(role); }
  if (shift) { sql += ' AND shift = ?'; params.push(shift); }
  if (is_active !== undefined) {
    sql += ' AND is_active = ?';
    params.push(is_active === 'true' || is_active === '1' ? 1 : 0);
  }
  if (search) {
    sql += ' AND (employee_id LIKE ? OR username LIKE ? OR full_name LIKE ? OR email LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  sql += ' ORDER BY employee_id ASC';

  db.all(sql, params, (err, users) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ users, count: users.length });
  });
});

// ─── GET USER ──────────────────────────────────────────────────────────────
router.get('/users/:id', authenticateToken, (req, res) => {
  db.get(
    'SELECT id, employee_id, username, email, full_name, role, phone, shift, is_active, created_at FROM users WHERE id = ?',
    [req.params.id],
    (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json({ user });
    }
  );
});

// ─── CREATE USER ───────────────────────────────────────────────────────────
router.post('/users', authenticateToken, requireRole('system_admin'), validate('createUser'), (req, res) => {
  const { employee_id, username, email, password, full_name, role, phone, shift } = req.body;
  db.run(
    'INSERT INTO users (employee_id, username, email, password_hash, full_name, role, phone, shift) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [employee_id, username, email, hashPassword(password), full_name, role, phone || null, shift || null],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({ error: 'Employee ID, username or email already exists' });
        }
        return res.status(500).json({ error: err.message });
      }
      auditLog(db, {
        userId: req.user.id,
        action: 'user_create',
        description: `Created user ${employee_id} (${full_name})`,
        relatedId: this.lastID,
        relatedType: 'user'
      });
      db.get(
        'SELECT id, employee_id, username, email, full_name, role, phone, shift, is_active, created_at FROM users WHERE id = ?',
        [this.lastID],
        (err2, user) => {
          if (err2) return res.status(500).json({ error: err2.message });
          res.status(201).json({ user });
        }
      );
    }
  );
});

// ─── UPDATE USER ───────────────────────────────────────────────────────────
router.patch('/users/:id', authenticateToken, requireRole('system_admin'), validate('updateUser'), (req, res) => {
  const fields = [];
  const values = [];

  if (req.body.email !== undefined) { fields.push('email = ?'); values.push(req.body.email); }
  if (req.body.full_name !== undefined) { fields.push('full_name = ?'); values.push(req.body.full_name); }
  if (req.body.role !== undefined) { fields.push('role = ?'); values.push(req.body.role); }
  if (req.body.phone !== undefined) { fields.push('phone = ?'); values.push(req.body.phone); }
  if (req.body.shift !== undefined) { fields.push('shift = ?'); values.push(req.body.shift); }
  if (req.body.is_active !== undefined) { fields.push('is_active = ?'); values.push(req.body.is_active ? 1 : 0); }
  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(req.params.id);

  db.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'User not found' });

    auditLog(db, {
      userId: req.user.id,
      action: 'user_update',
      description: `Updated user id ${req.params.id}`,
      relatedId: parseInt(req.params.id),
      relatedType: 'user'
    });

    db.get(
      'SELECT id, employee_id, username, email, full_name, role, phone, shift, is_active, created_at FROM users WHERE id = ?',
      [req.params.id],
      (err2, user) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ user });
      }
    );
  });
});

// ─── DELETE USER ───────────────────────────────────────────────────────────
router.delete('/users/:id', authenticateToken, requireRole('system_admin'), (req, res) => {
  db.run('DELETE FROM users WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'User not found' });
    res.status(204).send();
  });
});

module.exports = router;
