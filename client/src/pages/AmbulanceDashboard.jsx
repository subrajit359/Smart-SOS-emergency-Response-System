import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

const POLL_INTERVAL = 6000;

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString();
}

export default function AmbulanceDashboard() {
  const { user, authFetch } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [ambulance, setAmbulance] = useState(null);
  const [penalties, setPenalties] = useState([]);
  const [penaltySummary, setPenaltySummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('alerts');

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await authFetch('/api/sos');
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to load alerts.');
      }
    } catch {
      setError('Network error loading alerts.');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  const fetchAmbulanceInfo = useCallback(async () => {
    try {
      const res = await authFetch('/api/ambulances/mine');
      if (res.ok) {
        const data = await res.json();
        setAmbulance(data.ambulance);
      }
    } catch {}
  }, [authFetch]);

  const fetchPenalties = useCallback(async () => {
    try {
      const res = await authFetch('/api/ambulances/penalties');
      if (res.ok) {
        const data = await res.json();
        setPenalties(data.assignments || []);
        setPenaltySummary(data.summary);
      }
    } catch {}
  }, [authFetch]);

  useEffect(() => {
    fetchAmbulanceInfo();
    fetchAlerts();
    fetchPenalties();
    const interval = setInterval(() => {
      fetchAlerts();
      fetchAmbulanceInfo();
      fetchPenalties();
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchAlerts, fetchAmbulanceInfo, fetchPenalties]);

  const handleAccept = async (alertId) => {
    setActionLoading(prev => ({ ...prev, [alertId]: 'accepting' }));
    setError('');
    try {
      const res = await authFetch(`/api/sos/${alertId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'accepted' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to accept alert.');
      } else {
        setSuccess(`Alert #${alertId} accepted! Head to the victim's location.`);
        fetchAlerts();
        fetchAmbulanceInfo();
        setTimeout(() => setSuccess(''), 5000);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setActionLoading(prev => ({ ...prev, [alertId]: null }));
    }
  };

  const handleComplete = async (alertId) => {
    setActionLoading(prev => ({ ...prev, [alertId]: 'completing' }));
    setError('');
    try {
      const res = await authFetch(`/api/sos/${alertId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'completed' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to complete alert.');
      } else {
        setSuccess(`Alert #${alertId} marked as completed.`);
        fetchAlerts();
        fetchAmbulanceInfo();
        fetchPenalties();
        setTimeout(() => setSuccess(''), 5000);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setActionLoading(prev => ({ ...prev, [alertId]: null }));
    }
  };

  const toggleAvailability = async () => {
    if (!ambulance) return;
    setError('');
    try {
      const res = await authFetch(`/api/ambulances/${ambulance.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ available: !ambulance.available }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to update availability.');
      } else {
        setAmbulance(data.ambulance);
      }
    } catch {
      setError('Network error updating availability.');
    }
  };

  const pendingAlerts = alerts.filter(a => a.status === 'pending');
  const activeAlert = alerts.find(a => a.status === 'accepted');
  const hasActiveCase = !!activeAlert;

  return (
    <div style={{ background: '#f8f9fa', minHeight: '100vh', paddingBottom: '40px' }}>

      {/* Header */}
      <div className="bg-white border-bottom py-3 px-3">
        <div className="container">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
              <h4 className="fw-bold mb-0" style={{ color: '#b71c1c' }}>
                <i className="bi bi-activity me-2"></i>Ambulance Dashboard
              </h4>
              <small className="text-muted">Welcome, {user?.name}</small>
            </div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              {hasActiveCase && (
                <span className="badge bg-danger rounded-pill px-3 py-2">
                  <i className="bi bi-truck me-1"></i> Active Case
                </span>
              )}
              {pendingAlerts.length > 0 && (
                <span className="badge bg-warning text-dark rounded-pill px-3 py-2">
                  <i className="bi bi-bell me-1"></i> {pendingAlerts.length} Incoming
                </span>
              )}
              {ambulance && (
                <button
                  className={`btn btn-sm fw-semibold ${ambulance.available && !hasActiveCase ? 'btn-success' : 'btn-outline-secondary'}`}
                  onClick={toggleAvailability}
                  disabled={hasActiveCase}
                  title={hasActiveCase ? 'Complete your active case first' : ''}
                >
                  <i className={`bi ${ambulance.available && !hasActiveCase ? 'bi-circle-fill' : 'bi-circle'} me-1`}></i>
                  {hasActiveCase ? 'On Case' : ambulance.available ? 'Available' : 'Off Duty'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mt-3">

        {error && (
          <div className="alert alert-danger d-flex align-items-center gap-2 mb-3" role="alert">
            <i className="bi bi-exclamation-circle-fill"></i>
            <span>{error}</span>
            <button className="btn-close ms-auto" onClick={() => setError('')}></button>
          </div>
        )}
        {success && (
          <div className="alert alert-success d-flex align-items-center gap-2 mb-3">
            <i className="bi bi-check-circle-fill"></i>
            <span>{success}</span>
          </div>
        )}

        {/* Tabs */}
        <ul className="nav nav-tabs mb-3">
          <li className="nav-item">
            <button
              className={`nav-link fw-semibold ${activeTab === 'alerts' ? 'active text-danger' : 'text-muted'}`}
              onClick={() => setActiveTab('alerts')}
            >
              <i className="bi bi-bell me-1"></i> Alerts
              {(pendingAlerts.length > 0 || hasActiveCase) && (
                <span className="badge bg-danger ms-2">{pendingAlerts.length + (hasActiveCase ? 1 : 0)}</span>
              )}
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link fw-semibold ${activeTab === 'penalties' ? 'active text-danger' : 'text-muted'}`}
              onClick={() => { setActiveTab('penalties'); fetchPenalties(); }}
            >
              <i className="bi bi-exclamation-triangle me-1"></i> Response History
              {penaltySummary?.timeouts > 0 && (
                <span className="badge bg-warning text-dark ms-2">{penaltySummary.timeouts}</span>
              )}
            </button>
          </li>
        </ul>

        {/* ALERTS TAB */}
        {activeTab === 'alerts' && (
          <div>
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-danger"></div>
                <p className="mt-2 text-muted">Loading alerts...</p>
              </div>
            ) : alerts.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <i className="bi bi-shield-check" style={{ fontSize: '3rem', color: '#c8e6c9' }}></i>
                <p className="mt-3 fw-semibold">No active alerts assigned to you</p>
                <small>New SOS alerts will appear here automatically every 6 seconds</small>
              </div>
            ) : (
              <div className="d-flex flex-column gap-3">

                {/* Active accepted case — shown first */}
                {activeAlert && (
                  <div className="card border-0 shadow-sm" style={{ borderLeft: '5px solid #1565c0' }}>
                    <div className="card-body">
                      <div className="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-2">
                        <div>
                          <span className="badge bg-primary me-2">
                            <i className="bi bi-truck me-1"></i>Active Case
                          </span>
                          <span className="badge bg-light text-dark">Alert #{activeAlert.id}</span>
                        </div>
                        <small className="text-muted">{timeAgo(activeAlert.created_at)}</small>
                      </div>

                      <h6 className="fw-bold mb-1">
                        <i className="bi bi-person-fill me-1 text-primary"></i>{activeAlert.victim_name}
                      </h6>
                      {activeAlert.victim_phone && (
                        <p className="mb-1 small text-muted">
                          <i className="bi bi-telephone me-1"></i>{activeAlert.victim_phone}
                        </p>
                      )}

                      <div className="row g-2 mt-1">
                        {activeAlert.blood_group && (
                          <div className="col-auto">
                            <span className="badge bg-danger">{activeAlert.blood_group}</span>
                          </div>
                        )}
                        {activeAlert.allergies && (
                          <div className="col-12">
                            <small className="text-muted"><strong>Allergies:</strong> {activeAlert.allergies}</small>
                          </div>
                        )}
                        {activeAlert.medical_conditions && (
                          <div className="col-12">
                            <small className="text-muted"><strong>Conditions:</strong> {activeAlert.medical_conditions}</small>
                          </div>
                        )}
                        {activeAlert.current_medications && (
                          <div className="col-12">
                            <small className="text-muted"><strong>Medications:</strong> {activeAlert.current_medications}</small>
                          </div>
                        )}
                        {activeAlert.emergency_contact_name && (
                          <div className="col-12">
                            <small className="text-muted">
                              <strong>Emergency Contact:</strong> {activeAlert.emergency_contact_name}
                              {activeAlert.emergency_contact_phone && ` — ${activeAlert.emergency_contact_phone}`}
                            </small>
                          </div>
                        )}
                      </div>

                      <div className="d-flex gap-2 mt-3 flex-wrap">
                        <button
                          className="btn btn-primary fw-bold px-4"
                          onClick={() => handleComplete(activeAlert.id)}
                          disabled={!!actionLoading[activeAlert.id]}
                        >
                          {actionLoading[activeAlert.id] === 'completing'
                            ? <><span className="spinner-border spinner-border-sm me-2"></span>Completing...</>
                            : <><i className="bi bi-check2-all me-2"></i>Mark Completed</>}
                        </button>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${activeAlert.latitude},${activeAlert.longitude}`}
                          target="_blank" rel="noopener noreferrer"
                          className="btn btn-outline-primary px-4"
                        >
                          <i className="bi bi-map me-2"></i>Directions
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* Pending alerts assigned to this ambulance */}
                {pendingAlerts.map(alert => (
                  <div key={alert.id} className="card border-0 shadow-sm" style={{ borderLeft: '5px solid #e53935' }}>
                    <div className="card-body">
                      <div className="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-2">
                        <div>
                          <span className="badge bg-warning text-dark me-2">
                            <i className="bi bi-clock me-1"></i>Incoming — Respond within 3 mins
                          </span>
                          <span className="badge bg-light text-dark">Alert #{alert.id}</span>
                          {alert.trigger_type === 'auto' && (
                            <span className="badge bg-danger ms-2">
                              <i className="bi bi-phone-vibrate me-1"></i>Crash Detection
                            </span>
                          )}
                        </div>
                        <small className="text-muted">{timeAgo(alert.created_at)}</small>
                      </div>

                      <h6 className="fw-bold mb-1">
                        <i className="bi bi-person-fill me-1 text-danger"></i>{alert.victim_name}
                      </h6>
                      {alert.victim_phone && (
                        <p className="mb-1 small text-muted">
                          <i className="bi bi-telephone me-1"></i>{alert.victim_phone}
                        </p>
                      )}

                      <div className="row g-2 mt-1">
                        {alert.blood_group && (
                          <div className="col-auto">
                            <span className="badge bg-danger">{alert.blood_group}</span>
                          </div>
                        )}
                        {alert.allergies && (
                          <div className="col-12">
                            <small className="text-muted"><strong>Allergies:</strong> {alert.allergies}</small>
                          </div>
                        )}
                        {alert.medical_conditions && (
                          <div className="col-12">
                            <small className="text-muted"><strong>Conditions:</strong> {alert.medical_conditions}</small>
                          </div>
                        )}
                        {alert.current_medications && (
                          <div className="col-12">
                            <small className="text-muted"><strong>Medications:</strong> {alert.current_medications}</small>
                          </div>
                        )}
                        {alert.emergency_contact_name && (
                          <div className="col-12">
                            <small className="text-muted">
                              <strong>Emergency Contact:</strong> {alert.emergency_contact_name}
                              {alert.emergency_contact_phone && ` — ${alert.emergency_contact_phone}`}
                            </small>
                          </div>
                        )}
                      </div>

                      <div className="d-flex gap-2 mt-3 flex-wrap">
                        {hasActiveCase ? (
                          <div className="alert alert-warning py-2 px-3 mb-0 small w-100">
                            <i className="bi bi-exclamation-triangle me-1"></i>
                            You have an active case. Complete it before accepting a new alert.
                            If you don't respond in 3 minutes, this will be forwarded to another ambulance.
                          </div>
                        ) : (
                          <button
                            className="btn btn-success fw-bold px-4"
                            onClick={() => handleAccept(alert.id)}
                            disabled={!!actionLoading[alert.id]}
                          >
                            {actionLoading[alert.id] === 'accepting'
                              ? <><span className="spinner-border spinner-border-sm me-2"></span>Accepting...</>
                              : <><i className="bi bi-check2 me-2"></i>Accept Alert</>}
                          </button>
                        )}
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${alert.latitude},${alert.longitude}`}
                          target="_blank" rel="noopener noreferrer"
                          className="btn btn-outline-danger px-4"
                        >
                          <i className="bi bi-map me-2"></i>Directions
                        </a>
                      </div>
                    </div>
                  </div>
                ))}

              </div>
            )}
          </div>
        )}

        {/* RESPONSE HISTORY / PENALTIES TAB */}
        {activeTab === 'penalties' && (
          <div>
            {penaltySummary && (
              <div className="row g-3 mb-4">
                <div className="col-4">
                  <div className="card border-0 shadow-sm text-center py-3">
                    <div className="fw-bold fs-4">{penaltySummary.total}</div>
                    <small className="text-muted">Total Assigned</small>
                  </div>
                </div>
                <div className="col-4">
                  <div className="card border-0 shadow-sm text-center py-3">
                    <div className="fw-bold fs-4 text-success">{penaltySummary.accepted}</div>
                    <small className="text-muted">Accepted</small>
                  </div>
                </div>
                <div className="col-4">
                  <div className="card border-0 shadow-sm text-center py-3">
                    <div className="fw-bold fs-4 text-warning">{penaltySummary.timeouts}</div>
                    <small className="text-muted">Timeouts</small>
                  </div>
                </div>
              </div>
            )}

            {penalties.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <i className="bi bi-clipboard-check" style={{ fontSize: '3rem', color: '#c8e6c9' }}></i>
                <p className="mt-3 fw-semibold">No response history yet</p>
              </div>
            ) : (
              <div className="d-flex flex-column gap-2">
                {penalties.map(p => (
                  <div key={p.id} className="card border-0 shadow-sm">
                    <div className="card-body py-3">
                      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                        <div>
                          <span className={`badge me-2 ${
                            p.response_status === 'accepted' ? 'bg-success' :
                            p.response_status === 'timeout' ? 'bg-warning text-dark' :
                            'bg-secondary'
                          }`}>
                            {p.response_status === 'timeout' ? (
                              <><i className="bi bi-exclamation-triangle me-1"></i>Timeout Penalty</>
                            ) : p.response_status === 'accepted' ? (
                              <><i className="bi bi-check2 me-1"></i>Accepted</>
                            ) : (
                              <><i className="bi bi-clock me-1"></i>Pending</>
                            )}
                          </span>
                          <span className="text-muted small">
                            Alert #{p.alert_id} — {p.victim_name}
                          </span>
                        </div>
                        <small className="text-muted">{formatDateTime(p.assigned_at)}</small>
                      </div>
                      {p.response_status === 'timeout' && (
                        <small className="text-danger mt-1 d-block">
                          <i className="bi bi-info-circle me-1"></i>
                          Alert was forwarded to the next available ambulance after 3 minutes without a response. This is recorded as a penalty.
                        </small>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
