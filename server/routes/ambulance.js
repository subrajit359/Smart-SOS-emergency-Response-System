const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/ambulances — list all ambulances
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, u.name as staff_name, u.email as staff_email
       FROM ambulances a
       LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.created_at DESC`
    );
    res.json({ ambulances: result.rows });
  } catch (err) {
    console.error('Get ambulances error:', err);
    res.status(500).json({ error: 'Server error fetching ambulances.' });
  }
});

// GET /api/ambulances/mine — get this ambulance's own info
router.get('/mine', authenticateToken, requireRole('ambulance'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, u.name as staff_name, u.email as staff_email
       FROM ambulances a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE a.user_id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ambulance not found.' });
    }

    res.json({ ambulance: result.rows[0] });
  } catch (err) {
    console.error('Get mine ambulance error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/ambulances/penalties — forwarding/penalty history for this ambulance
router.get('/penalties', authenticateToken, requireRole('ambulance'), async (req, res) => {
  try {
    const ambResult = await pool.query(
      'SELECT id FROM ambulances WHERE user_id = $1',
      [req.user.id]
    );

    if (ambResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ambulance not found.' });
    }

    const ambulanceId = ambResult.rows[0].id;

    const result = await pool.query(
      `SELECT saa.*,
              sa.latitude, sa.longitude, sa.status as alert_status,
              sa.created_at as alert_created_at,
              u.name as victim_name
       FROM sos_alert_assignments saa
       JOIN sos_alerts sa ON saa.alert_id = sa.id
       JOIN users u ON sa.user_id = u.id
       WHERE saa.ambulance_id = $1
       ORDER BY saa.assigned_at DESC
       LIMIT 50`,
      [ambulanceId]
    );

    const timeouts = result.rows.filter(r => r.response_status === 'timeout').length;
    const accepted = result.rows.filter(r => r.response_status === 'accepted').length;

    res.json({
      assignments: result.rows,
      summary: { total: result.rows.length, timeouts, accepted }
    });
  } catch (err) {
    console.error('Get penalties error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/ambulances/:id/status — toggle availability
router.put('/:id/status', authenticateToken, requireRole('ambulance'), async (req, res) => {
  const { id } = req.params;
  const { available } = req.body;

  if (isNaN(parseInt(id))) {
    return res.status(400).json({ error: 'Invalid ambulance ID.' });
  }

  if (available === undefined || available === null) {
    return res.status(400).json({ error: 'available field (true/false) is required.' });
  }

  try {
    const ambResult = await pool.query(
      'SELECT * FROM ambulances WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (ambResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ambulance not found or not linked to your account.' });
    }

    if (ambResult.rows[0].active_alert_id) {
      return res.status(409).json({ error: 'Cannot change availability while handling an active SOS case.' });
    }

    const result = await pool.query(
      'UPDATE ambulances SET available = $1 WHERE id = $2 RETURNING *',
      [Boolean(available), id]
    );

    res.json({ message: 'Ambulance status updated.', ambulance: result.rows[0] });
  } catch (err) {
    console.error('Update ambulance status error:', err);
    res.status(500).json({ error: 'Server error updating ambulance status.' });
  }
});

module.exports = router;
