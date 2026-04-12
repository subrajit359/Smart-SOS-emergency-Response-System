const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const pool = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { assignAlertToAmbulance, getNextAvailableAmbulance } = require('../forwarder');

const sosRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: { error: 'Too many SOS alerts sent. Please wait before sending another.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/sos — create new SOS alert
router.post('/', authenticateToken, requireRole('user'), sosRateLimit, async (req, res) => {
  const { latitude, longitude } = req.body;

  if (latitude === undefined || latitude === null || longitude === undefined || longitude === null) {
    return res.status(400).json({ error: 'Latitude and longitude are required.' });
  }

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: 'Latitude and longitude must be valid numbers.' });
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'Invalid GPS coordinates.' });
  }

  try {
    const existing = await pool.query(
      `SELECT id FROM sos_alerts WHERE user_id = $1 AND status IN ('pending', 'accepted') LIMIT 1`,
      [req.user.id]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: 'You already have an active SOS alert. Please wait for it to be resolved.',
        alert_id: existing.rows[0].id
      });
    }

    const result = await pool.query(
      `INSERT INTO sos_alerts (user_id, latitude, longitude, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [req.user.id, lat, lng]
    );

    const alert = result.rows[0];

    const firstAmbulance = await getNextAvailableAmbulance([]);
    if (firstAmbulance) {
      await assignAlertToAmbulance(alert.id, firstAmbulance.id);
      alert.current_ambulance_id = firstAmbulance.id;
    }

    res.status(201).json({ message: 'SOS alert sent successfully.', alert });
  } catch (err) {
    console.error('Create SOS error:', err);
    res.status(500).json({ error: 'Server error creating SOS alert.' });
  }
});

// GET /api/sos — alerts assigned to this ambulance
router.get('/', authenticateToken, requireRole('ambulance'), async (req, res) => {
  try {
    const ambResult = await pool.query(
      'SELECT id, active_alert_id FROM ambulances WHERE user_id = $1',
      [req.user.id]
    );

    if (ambResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ambulance account not found.' });
    }

    const ambulance = ambResult.rows[0];

    const result = await pool.query(
      `SELECT sa.*,
              u.name as victim_name, u.phone as victim_phone,
              u.blood_group, u.allergies, u.medical_conditions,
              u.current_medications, u.emergency_contact_name,
              u.emergency_contact_phone, u.medical_notes,
              a.name as ambulance_name, a.driver_name as ambulance_driver
       FROM sos_alerts sa
       JOIN users u ON sa.user_id = u.id
       LEFT JOIN ambulances a ON sa.assigned_ambulance_id = a.id
       WHERE (
         (sa.status = 'pending' AND sa.current_ambulance_id = $1)
         OR
         (sa.status = 'accepted' AND sa.assigned_ambulance_id = $1)
       )
       ORDER BY sa.created_at DESC`,
      [ambulance.id]
    );

    res.json({ alerts: result.rows, ambulance_id: ambulance.id, active_alert_id: ambulance.active_alert_id });
  } catch (err) {
    console.error('Get ambulance SOS error:', err);
    res.status(500).json({ error: 'Server error fetching alerts.' });
  }
});

// GET /api/sos/my — current user's alert history
router.get('/my', authenticateToken, requireRole('user'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT sa.*,
              a.name as ambulance_name, a.driver_name as ambulance_driver,
              a.phone as ambulance_phone
       FROM sos_alerts sa
       LEFT JOIN ambulances a ON sa.assigned_ambulance_id = a.id
       WHERE sa.user_id = $1
       ORDER BY sa.created_at DESC`,
      [req.user.id]
    );

    res.json({ alerts: result.rows });
  } catch (err) {
    console.error('Get my SOS error:', err);
    res.status(500).json({ error: 'Server error fetching your alerts.' });
  }
});

// GET /api/sos/:id — single alert details
router.get('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  if (isNaN(parseInt(id))) {
    return res.status(400).json({ error: 'Invalid alert ID.' });
  }

  try {
    const result = await pool.query(
      `SELECT sa.*,
              u.name as victim_name, u.phone as victim_phone,
              u.blood_group, u.allergies, u.medical_conditions,
              u.current_medications, u.emergency_contact_name,
              u.emergency_contact_phone, u.medical_notes,
              a.name as ambulance_name, a.driver_name as ambulance_driver, a.phone as ambulance_phone
       FROM sos_alerts sa
       JOIN users u ON sa.user_id = u.id
       LEFT JOIN ambulances a ON sa.assigned_ambulance_id = a.id
       WHERE sa.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found.' });
    }

    const alert = result.rows[0];

    if (req.user.role === 'user' && alert.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    res.json({ alert });
  } catch (err) {
    console.error('Get SOS detail error:', err);
    res.status(500).json({ error: 'Server error fetching alert.' });
  }
});

// PUT /api/sos/:id — accept / complete / cancel alert
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (isNaN(parseInt(id))) {
    return res.status(400).json({ error: 'Invalid alert ID.' });
  }

  const validStatuses = ['accepted', 'resolved', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
  }

  try {
    const alertResult = await pool.query('SELECT * FROM sos_alerts WHERE id = $1', [id]);
    if (alertResult.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found.' });
    }

    const alert = alertResult.rows[0];

    if (req.user.role === 'user' && alert.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    if (req.user.role === 'ambulance') {
      const ambResult = await pool.query(
        'SELECT id, active_alert_id FROM ambulances WHERE user_id = $1',
        [req.user.id]
      );

      if (ambResult.rows.length === 0) {
        return res.status(404).json({ error: 'Ambulance not found.' });
      }

      const ambulance = ambResult.rows[0];

      if (status === 'accepted') {
        if (ambulance.active_alert_id && ambulance.active_alert_id !== parseInt(id)) {
          return res.status(409).json({
            error: 'You already have an active SOS case. Complete it before accepting a new one.',
            active_alert_id: ambulance.active_alert_id
          });
        }

        if (alert.current_ambulance_id !== ambulance.id) {
          return res.status(403).json({ error: 'This alert is not assigned to your ambulance.' });
        }

        await pool.query(
          `UPDATE sos_alerts
           SET status = 'accepted', assigned_ambulance_id = $1, updated_at = NOW()
           WHERE id = $2`,
          [ambulance.id, id]
        );

        await pool.query(
          `UPDATE sos_alert_assignments
           SET response_status = 'accepted', responded_at = NOW()
           WHERE alert_id = $1 AND ambulance_id = $2 AND response_status = 'pending'`,
          [id, ambulance.id]
        );

        await pool.query(
          `UPDATE ambulances SET active_alert_id = $1, available = false WHERE id = $2`,
          [id, ambulance.id]
        );

        const updated = await pool.query('SELECT * FROM sos_alerts WHERE id = $1', [id]);
        return res.json({ message: 'Alert accepted.', alert: updated.rows[0] });
      }

      if (status === 'completed' || status === 'resolved') {
        if (alert.assigned_ambulance_id !== ambulance.id) {
          return res.status(403).json({ error: 'You did not accept this alert.' });
        }

        await pool.query(
          `UPDATE sos_alerts
           SET status = 'resolved', updated_at = NOW(), completed_at = NOW()
           WHERE id = $1`,
          [id]
        );

        await pool.query(
          `UPDATE ambulances SET active_alert_id = NULL, available = true WHERE id = $1`,
          [ambulance.id]
        );

        const updated = await pool.query('SELECT * FROM sos_alerts WHERE id = $1', [id]);
        return res.json({ message: 'Alert completed.', alert: updated.rows[0] });
      }
    }

    if (req.user.role === 'user' && status === 'cancelled') {
      const assignedAmbId = alert.assigned_ambulance_id;

      await pool.query(
        `UPDATE sos_alerts SET status = 'cancelled', updated_at = NOW(), completed_at = NOW() WHERE id = $1`,
        [id]
      );

      if (assignedAmbId) {
        await pool.query(
          `UPDATE ambulances SET active_alert_id = NULL, available = true WHERE id = $1`,
          [assignedAmbId]
        );
      }

      const updated = await pool.query('SELECT * FROM sos_alerts WHERE id = $1', [id]);
      return res.json({ message: 'Alert cancelled.', alert: updated.rows[0] });
    }

    res.status(400).json({ error: 'Invalid action for your role.' });
  } catch (err) {
    console.error('Update SOS error:', err);
    res.status(500).json({ error: 'Server error updating alert.' });
  }
});

module.exports = router;
