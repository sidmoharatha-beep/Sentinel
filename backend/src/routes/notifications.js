const express = require('express');
const { authenticateToken } = require('../auth');
const { db } = require('../database');

const router = express.Router();

// GET /notifications — current user's notifications, unread first
router.get('/', authenticateToken, (req, res) => {
  db.all(`
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY is_read ASC, created_at DESC
    LIMIT 100
  `, [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const unreadCount = rows.filter(r => !r.is_read).length;
    res.json({ notifications: rows, unread_count: unreadCount });
  });
});

// PATCH /notifications/:id/read
router.patch('/:id/read', authenticateToken, (req, res) => {
  db.run(
    'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Notification not found' });
      res.json({ success: true });
    }
  );
});

// PATCH /notifications/read-all
router.patch('/read-all', authenticateToken, (req, res) => {
  db.run(
    'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
    [req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ updated: this.changes });
    }
  );
});

// DELETE /notifications/:id
router.delete('/:id', authenticateToken, (req, res) => {
  db.run(
    'DELETE FROM notifications WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Notification not found' });
      res.status(204).send();
    }
  );
});

module.exports = router;
