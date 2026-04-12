const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const adminOnly = [authenticateToken, requireRole('admin')];

// GET /api/admin/stats — live system overview
router.get('/stats', ...adminOnly, async (req, res) => {
  try {
    const [
      totalUsers, totalAmbulances, pendingAlerts, activeAlerts,
      resolvedToday, cancelledToday, totalAlerts, timeoutPenalties,
      availableAmbulances, onCaseAmbulances
    ] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM users WHERE role = 'user'`),
      pool.query(`SELECT COUNT(*) FROM ambulances`),
      pool.query(`SELECT COUNT(*) FROM sos_alerts WHERE status = 'pending'`),
      pool.query(`SELECT COUNT(*) FROM sos_alerts WHERE status = 'accepted'`),
      pool.query(`SELECT COUNT(*) FROM sos_alerts WHERE status = 'resolved' AND completed_at >= NOW() - INTERVAL '24 hours'`),
      pool.query(`SELECT COUNT(*) FROM sos_alerts WHERE status = 'cancelled' AND updated_at >= NOW() - INTERVAL '24 hours'`),
      pool.query(`SELECT COUNT(*) FROM sos_alerts`),
      pool.query(`SELECT COUNT(*) FROM sos_alert_assignments WHERE response_status = 'timeout'`),
      pool.query(`SELECT COUNT(*) FROM ambulances WHERE available = true AND active_alert_id IS NULL AND off_duty = false`),
      pool.query(`SELECT COUNT(*) FROM ambulances WHERE active_alert_id IS NOT NULL`),
    ]);

    const recentAlerts = await pool.query(
      `SELECT sa.id, sa.status, sa.created_at, sa.trigger_type,
              u.name as victim_name,
              a.name as ambulance_name
       FROM sos_alerts sa
       JOIN users u ON sa.user_id = u.id
       LEFT JOIN ambulances a ON sa.assigned_ambulance_id = a.id
       ORDER BY sa.created_at DESC LIMIT 10`
    );

    res.json({
      stats: {
        total_users: parseInt(totalUsers.rows[0].count),
        total_ambulances: parseInt(totalAmbulances.rows[0].count),
        pending_alerts: parseInt(pendingAlerts.rows[0].count),
        active_alerts: parseInt(activeAlerts.rows[0].count),
        resolved_today: parseInt(resolvedToday.rows[0].count),
        cancelled_today: parseInt(cancelledToday.rows[0].count),
        total_alerts: parseInt(totalAlerts.rows[0].count),
        timeout_penalties: parseInt(timeoutPenalties.rows[0].count),
        available_ambulances: parseInt(availableAmbulances.rows[0].count),
        on_case_ambulances: parseInt(onCaseAmbulances.rows[0].count),
      },
      recent_alerts: recentAlerts.rows,
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Server error fetching stats.' });
  }
});

// GET /api/admin/users — all users
router.get('/users', ...adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, phone, role, created_at,
              (SELECT COUNT(*) FROM sos_alerts WHERE user_id = users.id) as total_sos
       FROM users
       ORDER BY created_at DESC`
    );
    res.json({ users: result.rows });
  } catch (err) {
    console.error('Admin get users error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/admin/users/:id — update role
router.put('/users/:id', ...adminOnly, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!['user', 'ambulance', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role.' });
  }

  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'You cannot change your own role.' });
  }

  try {
    const result = await pool.query(
      `UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, role`,
      [role, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    res.json({ message: 'User updated.', user: result.rows[0] });
  } catch (err) {
    console.error('Admin update user error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/admin/users/:id — delete user
router.delete('/users/:id', ...adminOnly, async (req, res) => {
  const { id } = req.params;

  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account.' });
  }

  try {
    const result = await pool.query(`DELETE FROM users WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    res.json({ message: 'User deleted.' });
  } catch (err) {
    console.error('Admin delete user error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/admin/ambulances — all ambulances with full status
router.get('/ambulances', ...adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*,
              u.name as staff_name, u.email as staff_email,
              (SELECT COUNT(*) FROM sos_alert_assignments WHERE ambulance_id = a.id AND response_status = 'timeout') as timeout_count,
              (SELECT COUNT(*) FROM sos_alert_assignments WHERE ambulance_id = a.id AND response_status = 'accepted') as accepted_count
       FROM ambulances a
       LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.created_at DESC`
    );
    res.json({ ambulances: result.rows });
  } catch (err) {
    console.error('Admin get ambulances error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/admin/ambulances/:id — manage ambulance (availability, off_duty, name)
router.put('/ambulances/:id', ...adminOnly, async (req, res) => {
  const { id } = req.params;
  const { available, off_duty, name, driver_name, phone } = req.body;

  try {
    const fields = [];
    const values = [];
    let i = 1;

    if (available !== undefined) { fields.push(`available = $${i++}`); values.push(Boolean(available)); }
    if (off_duty !== undefined) { fields.push(`off_duty = $${i++}`); values.push(Boolean(off_duty)); }
    if (name !== undefined) { fields.push(`name = $${i++}`); values.push(name); }
    if (driver_name !== undefined) { fields.push(`driver_name = $${i++}`); values.push(driver_name); }
    if (phone !== undefined) { fields.push(`phone = $${i++}`); values.push(phone); }

    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update.' });

    values.push(id);
    const result = await pool.query(
      `UPDATE ambulances SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Ambulance not found.' });
    res.json({ message: 'Ambulance updated.', ambulance: result.rows[0] });
  } catch (err) {
    console.error('Admin update ambulance error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/admin/alerts — all alerts with full info
router.get('/alerts', ...adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT sa.*,
              u.name as victim_name, u.phone as victim_phone, u.blood_group,
              a.name as ambulance_name, a.driver_name as ambulance_driver,
              (SELECT COUNT(*) FROM sos_alert_assignments WHERE alert_id = sa.id) as assignment_count,
              (SELECT COUNT(*) FROM sos_alert_assignments WHERE alert_id = sa.id AND response_status = 'timeout') as timeout_count
       FROM sos_alerts sa
       JOIN users u ON sa.user_id = u.id
       LEFT JOIN ambulances a ON sa.assigned_ambulance_id = a.id
       ORDER BY sa.created_at DESC
       LIMIT 200`
    );
    res.json({ alerts: result.rows });
  } catch (err) {
    console.error('Admin get alerts error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/admin/penalties — all timeout penalties
router.get('/penalties', ...adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT saa.*,
              sa.latitude, sa.longitude, sa.status as alert_status,
              u.name as victim_name,
              a.name as ambulance_name, a.driver_name
       FROM sos_alert_assignments saa
       JOIN sos_alerts sa ON saa.alert_id = sa.id
       JOIN users u ON sa.user_id = u.id
       JOIN ambulances a ON saa.ambulance_id = a.id
       WHERE saa.response_status = 'timeout'
       ORDER BY saa.assigned_at DESC
       LIMIT 100`
    );
    res.json({ penalties: result.rows });
  } catch (err) {
    console.error('Admin get penalties error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
