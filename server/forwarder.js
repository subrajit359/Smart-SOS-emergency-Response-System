const pool = require('./db');

const FORWARD_TIMEOUT_MS = 3 * 60 * 1000;
const CHECK_INTERVAL_MS = 30 * 1000;

async function getNextAvailableAmbulance(excludeIds = []) {
  const exclude = excludeIds.length > 0 ? excludeIds : [0];
  const result = await pool.query(
    `SELECT a.id FROM ambulances a
     WHERE a.available = true
       AND a.active_alert_id IS NULL
       AND a.id NOT IN (${exclude.map((_, i) => `$${i + 1}`).join(',')})
     ORDER BY a.created_at ASC
     LIMIT 1`,
    exclude
  );
  return result.rows[0] || null;
}

async function assignAlertToAmbulance(alertId, ambulanceId) {
  await pool.query(
    `UPDATE sos_alerts SET current_ambulance_id = $1, updated_at = NOW() WHERE id = $2`,
    [ambulanceId, alertId]
  );
  await pool.query(
    `INSERT INTO sos_alert_assignments (alert_id, ambulance_id, assigned_at, response_status)
     VALUES ($1, $2, NOW(), 'pending')`,
    [alertId, ambulanceId]
  );
}

async function forwardPendingAlerts() {
  try {
    const staleAlerts = await pool.query(
      `SELECT sa.id, sa.current_ambulance_id,
              saa.id as assignment_id, saa.assigned_at
       FROM sos_alerts sa
       JOIN sos_alert_assignments saa
         ON saa.alert_id = sa.id
        AND saa.ambulance_id = sa.current_ambulance_id
        AND saa.response_status = 'pending'
       WHERE sa.status = 'pending'
         AND sa.current_ambulance_id IS NOT NULL
         AND saa.assigned_at < NOW() - INTERVAL '${FORWARD_TIMEOUT_MS / 1000} seconds'`
    );

    for (const alert of staleAlerts.rows) {
      await pool.query(
        `UPDATE sos_alert_assignments
         SET response_status = 'timeout', responded_at = NOW()
         WHERE id = $1`,
        [alert.assignment_id]
      );

      const alreadyTried = await pool.query(
        `SELECT ambulance_id FROM sos_alert_assignments WHERE alert_id = $1`,
        [alert.id]
      );
      const triedIds = alreadyTried.rows.map(r => r.ambulance_id);

      const next = await getNextAvailableAmbulance(triedIds);

      if (next) {
        await assignAlertToAmbulance(alert.id, next.id);
        console.log(`[FORWARDER] Alert #${alert.id} forwarded from ambulance #${alert.current_ambulance_id} to #${next.id} (timeout penalty recorded)`);
      } else {
        await pool.query(
          `UPDATE sos_alerts SET current_ambulance_id = NULL, updated_at = NOW() WHERE id = $1`,
          [alert.id]
        );
        console.log(`[FORWARDER] Alert #${alert.id} has no available ambulances — waiting in queue`);
      }
    }

    const unassignedAlerts = await pool.query(
      `SELECT id FROM sos_alerts WHERE status = 'pending' AND current_ambulance_id IS NULL`
    );

    for (const alert of unassignedAlerts.rows) {
      const tried = await pool.query(
        `SELECT ambulance_id FROM sos_alert_assignments WHERE alert_id = $1`,
        [alert.id]
      );
      const triedIds = tried.rows.map(r => r.ambulance_id);
      const next = await getNextAvailableAmbulance(triedIds.length > 0 ? triedIds : []);
      if (next) {
        await assignAlertToAmbulance(alert.id, next.id);
        console.log(`[FORWARDER] Unassigned alert #${alert.id} assigned to ambulance #${next.id}`);
      }
    }
  } catch (err) {
    console.error('[FORWARDER] Error during forwarding check:', err.message);
  }
}

function startForwarder() {
  console.log('[FORWARDER] Started — checking every 30s, timeout after 3 mins');
  setInterval(forwardPendingAlerts, CHECK_INTERVAL_MS);
  setTimeout(forwardPendingAlerts, 3000);
}

module.exports = { startForwarder, assignAlertToAmbulance, getNextAvailableAmbulance };
