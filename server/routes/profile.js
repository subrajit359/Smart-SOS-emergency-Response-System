const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// GET /api/profile
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, phone, role, blood_group, allergies,
              medical_conditions, current_medications, emergency_contact_name,
              emergency_contact_phone, medical_notes, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Server error fetching profile.' });
  }
});

// PUT /api/profile
router.put('/', authenticateToken, async (req, res) => {
  const {
    name, phone, email,
    blood_group, allergies, medical_conditions,
    current_medications, emergency_contact_name,
    emergency_contact_phone, medical_notes
  } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format.' });
  }

  try {
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND id != $2',
      [email.toLowerCase().trim(), req.user.id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already in use by another account.' });
    }

    const result = await pool.query(
      `UPDATE users SET
         name = $1, phone = $2, email = $3,
         blood_group = $4, allergies = $5, medical_conditions = $6,
         current_medications = $7, emergency_contact_name = $8,
         emergency_contact_phone = $9, medical_notes = $10
       WHERE id = $11
       RETURNING id, name, email, phone, role, blood_group, allergies,
                 medical_conditions, current_medications, emergency_contact_name,
                 emergency_contact_phone, medical_notes, created_at`,
      [
        name, phone || null, email.toLowerCase().trim(),
        blood_group || null, allergies || null, medical_conditions || null,
        current_medications || null, emergency_contact_name || null,
        emergency_contact_phone || null, medical_notes || null,
        req.user.id
      ]
    );

    res.json({ message: 'Profile updated successfully.', user: result.rows[0] });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Server error updating profile.' });
  }
});

module.exports = router;
