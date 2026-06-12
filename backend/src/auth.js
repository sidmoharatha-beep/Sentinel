const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { db } = require('./database');

const JWT_SECRET = process.env.JWT_SECRET || 'sentinel_jwt_secret_key_2024_secure_random_string';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

function generateToken(user) {
  return jwt.sign(
    { id: user.id, employee_id: user.employee_id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function comparePassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  db.get(
    'SELECT id, employee_id, username, email, full_name, role, shift, is_active FROM users WHERE id = ?',
    [decoded.id],
    (err, user) => {
      if (err || !user || !user.is_active) {
        return res.status(403).json({ error: 'User not found or inactive' });
      }
      req.user = user;
      next();
    }
  );
}

/**
 * Role hierarchy:
 *   system_admin > security_manager > security_supervisor > security_guard
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

/**
 * Log an action to audit_logs.
 * Call this from any route that needs audit trail.
 */
function auditLog(db, { userId, action, description, ipAddress, deviceInfo, relatedId, relatedType }) {
  db.run(
    `INSERT INTO audit_logs (user_id, action, description, ip_address, device_info, related_id, related_type)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId || null, action, description || null, ipAddress || null, deviceInfo || null, relatedId || null, relatedType || null],
    (err) => {
      if (err) console.error('Audit log error:', err.message);
    }
  );
}

module.exports = {
  generateToken,
  verifyToken,
  hashPassword,
  comparePassword,
  authenticateToken,
  requireRole,
  auditLog
};
