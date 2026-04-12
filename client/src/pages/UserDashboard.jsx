import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import CrashDetection from '../components/CrashDetection.jsx';

const POLL_INTERVAL = 5000;

export default function UserDashboard() {
  const { user, authFetch } = useAuth();
  const [location, setLocation] = useState(null);
  const [locError, setLocError] = useState('');
  const [activeAlert, setActiveAlert] = useState(null);
  const [alertHistory, setAlertHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sosSuccess, setSosSuccess] = useState('');
  const [sosError, setSosError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [sosTriggeredType, setSosTriggeredType] = useState(null);

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocError('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocError('');
      },
      (err) => {
        setLocError(`Location access denied: ${err.message}. Please enable GPS to send SOS.`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await authFetch('/api/sos/my');
      if (res.ok) {
        const data = await res.json();
        const alerts = data.alerts || [];
        setAlertHistory(alerts);
        const active = alerts.find(a => a.status === 'pending' || a.status === 'accepted');
        setActiveAlert(active || null);
      }
    } catch {
      // silent poll failure
    }
  }, [authFetch]);

  useEffect(() => {
    getLocation();
    fetchAlerts();
    const interval = setInterval(fetchAlerts, POLL_INTERVAL);

    let watchId = null;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocError('');
        },
        (err) => {
          setLocError(`Location access denied: ${err.message}. Please enable GPS to send SOS.`);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );
    }

    return () => {
      clearInterval(interval);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [getLocation, fetchAlerts]);

  const sendSOS = async (triggerType = 'manual') => {
    if (!location) {
      setSosError('Cannot send SOS — GPS location is not available. Please enable location access.');
      return;
    }
    if (activeAlert) {
      setSosError('You already have an active SOS alert. Wait for it to be resolved first.');
      return;
    }
    setLoading(true);
    setSosError('');
    setSosSuccess('');
    try {
      const res = await authFetch('/api/sos', {
        method: 'POST',
        body: JSON.stringify({ latitude: location.lat, longitude: location.lng }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSosError(data.error || 'Failed to send SOS alert. Please try again.');
      } else {
        setSosSuccess(triggerType === 'auto'
          ? '🚨 Auto SOS triggered! Help is being dispatched to your location.'
          : '🚨 SOS alert sent! Emergency services have been notified.');
        fetchAlerts();
      }
    } catch {
      setSosError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };

  const handleSOSClick = () => {
    if (activeAlert) {
      setSosError('You already have an active alert in progress.');
      return;
    }
    setShowConfirm(true);
  };

  const cancelAlert = async () => {
    if (!activeAlert) return;
    setLoading(true);
    try {
      const res = await authFetch(`/api/sos/${activeAlert.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'cancelled' }),
      });
      if (res.ok) {
        setSosSuccess('Alert cancelled successfully.');
        fetchAlerts();
      }
    } catch {
      setSosError('Failed to cancel alert.');
    } finally {
      setLoading(false);
    }
  };

  const sendSOSRef = useRef(sendSOS);
  sendSOSRef.current = sendSOS;

  const handleCrashSOS = useCallback(() => {
    sendSOSRef.current('auto');
  }, []);

  const getStatusText = (status) => {
    if (status === 'pending') return 'Waiting for ambulance...';
    if (status === 'accepted') return 'Help is on the way!';
    return status;
  };

  const recentAlerts = alertHistory.slice(0, 3);

  return (
    <div style={{ background: '#f8f9fa', minHeight: '100vh', paddingBottom: '40px' }}>
      <CrashDetection onSosTriggered={handleCrashSOS} />

      {/* Header */}
      <div className="bg-white border-bottom py-3 px-3">
        <div className="container">
          <div className="d-flex align-items-center justify-content-between">
            <div>
              <h4 className="fw-bold mb-0" style={{ color: '#b71c1c' }}>
                <i className="bi bi-grid me-2"></i>My Dashboard
              </h4>
              <small className="text-muted">Welcome back, {user?.name}</small>
            </div>
            <Link to="/profile" className="btn btn-outline-secondary btn-sm">
              <i className="bi bi-person me-1"></i> Profile
            </Link>
          </div>
        </div>
      </div>

      <div className="container py-4">
        {/* Dismiss success/error */}
        {sosSuccess && (
          <div className="alert alert-success d-flex align-items-center gap-2 mb-4">
            <i className="bi bi-check-circle-fill"></i>
            <span>{sosSuccess}</span>
            <button className="btn-close ms-auto" onClick={() => setSosSuccess('')}></button>
          </div>
        )}
        {sosError && (
          <div className="alert alert-danger d-flex align-items-center gap-2 mb-4">
            <i className="bi bi-exclamation-circle-fill"></i>
            <span>{sosError}</span>
            <button className="btn-close ms-auto" onClick={() => setSosError('')}></button>
          </div>
        )}

        <div className="row g-4">
          {/* SOS Section */}
          <div className="col-lg-6">
            <div className="page-card h-100 text-center">
              <h5 className="fw-bold mb-1">Emergency SOS</h5>
              <p className="text-muted small mb-4">Tap the button to send an immediate SOS alert</p>

              <div className="sos-button-container">
                <button
                  className="sos-btn"
                  onClick={handleSOSClick}
                  disabled={loading || !!activeAlert}
                  aria-label="Send SOS Alert"
                >
                  <i className="bi bi-exclamation-triangle-fill"></i>
                  <span>SOS</span>
                </button>
              </div>

              {activeAlert && (
                <p className="text-muted small mt-3">SOS button disabled — active alert in progress</p>
              )}

              <div className="mt-4">
                <div className="location-card">
                  <div className="d-flex align-items-center gap-2">
                    <i className="bi bi-geo-alt-fill loc-icon"></i>
                    <div className="text-start">
                      <div className="fw-semibold small" style={{ color: '#1565c0' }}>GPS Location</div>
                      {location ? (
                        <div className="small text-muted">
                          {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                          <a
                            href={`https://www.google.com/maps?q=${location.lat},${location.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="map-link ms-2"
                          >
                            <i className="bi bi-map"></i> View Map
                          </a>
                        </div>
                      ) : locError ? (
                        <div className="small text-danger">{locError}</div>
                      ) : (
                        <div className="small text-muted">Fetching location...</div>
                      )}
                    </div>
                    <button
                      className="btn btn-sm btn-outline-primary ms-auto"
                      onClick={getLocation}
                      title="Refresh location"
                    >
                      <i className="bi bi-arrow-clockwise"></i>
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-3 p-3 rounded-3 bg-light">
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-phone-vibrate text-warning"></i>
                  <span className="small text-muted">
                    <strong>Crash detection active</strong> — monitoring for sudden impact
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Active Alert Status */}
          <div className="col-lg-6">
            <div className="page-card h-100">
              <h5 className="fw-bold mb-4">
                <i className="bi bi-activity me-2 text-danger"></i>Alert Status
              </h5>

              {activeAlert ? (
                <div>
                  <div className={`active-alert-card ${activeAlert.status}`}>
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <div>
                        <span className={`status-badge status-${activeAlert.status} mb-2 d-inline-block`}>
                          <i className={`bi bi-${activeAlert.status === 'accepted' ? 'check-circle' : 'clock'}-fill`}></i>
                          {activeAlert.status}
                        </span>
                        <div className="fw-bold" style={{ fontSize: '1.1rem' }}>
                          {getStatusText(activeAlert.status)}
                        </div>
                      </div>
                      {activeAlert.status === 'accepted' && (
                        <span style={{ fontSize: '2rem' }}>🚑</span>
                      )}
                    </div>

                    <div className="small text-muted mb-2">
                      <i className="bi bi-clock me-1"></i>
                      Sent at {new Date(activeAlert.created_at).toLocaleTimeString()}
                    </div>
                    <div className="small text-muted mb-3">
                      <i className="bi bi-geo-alt me-1"></i>
                      {parseFloat(activeAlert.latitude).toFixed(5)}, {parseFloat(activeAlert.longitude).toFixed(5)}
                    </div>

                    {activeAlert.ambulance_name && (
                      <div className="alert alert-success py-2 px-3 mb-0" style={{ fontSize: '0.85rem' }}>
                        <i className="bi bi-truck me-2"></i>
                        <strong>{activeAlert.ambulance_name}</strong> has accepted your alert
                      </div>
                    )}
                  </div>

                  <button
                    className="btn btn-outline-secondary btn-sm mt-3"
                    onClick={cancelAlert}
                    disabled={loading}
                  >
                    {loading ? <span className="spinner-border spinner-border-sm me-1"></span> : null}
                    <i className="bi bi-x-circle me-1"></i> Cancel Alert
                  </button>
                </div>
              ) : (
                <div className="empty-state">
                  <i className="bi bi-shield-check"></i>
                  <h5>No Active Alert</h5>
                  <p className="small">You don't have any active SOS alert right now. Stay safe!</p>
                </div>
              )}

              {/* Recent Alerts */}
              <div className="mt-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="fw-bold mb-0">Recent Alerts</h6>
                  <Link to="/alert-history" className="small text-danger text-decoration-none fw-semibold">View All</Link>
                </div>
                {recentAlerts.filter(a => a.status === 'completed' || a.status === 'cancelled').length === 0 ? (
                  <p className="text-muted small">No past alerts yet.</p>
                ) : (
                  recentAlerts.filter(a => a.status === 'completed' || a.status === 'cancelled').map(alert => (
                    <div key={alert.id} className="d-flex align-items-center gap-2 py-2 border-bottom">
                      <span className={`status-badge status-${alert.status}`} style={{ fontSize: '0.7rem' }}>
                        {alert.status}
                      </span>
                      <span className="small text-muted">{new Date(alert.created_at).toLocaleDateString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SOS Confirmation Modal */}
      {showConfirm && (
        <div className="modal d-flex" style={{ background: 'rgba(0,0,0,0.65)', zIndex: 1055, position: 'fixed', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-dialog m-3 w-100" style={{ maxWidth: '420px' }}>
            <div className="modal-content rounded-4 border-0 shadow-lg">
              <div className="modal-header border-0 pb-0">
                <div className="modal-title d-flex align-items-center gap-2">
                  <span style={{ fontSize: '1.5rem' }}>🚨</span>
                  <span className="fw-bold">Confirm SOS Alert</span>
                </div>
              </div>
              <div className="modal-body pt-2">
                <p className="text-muted mb-0">
                  Are you sure you want to send an SOS alert? This will immediately notify nearby ambulances with your location and medical details.
                </p>
                {location && (
                  <div className="mt-3 p-2 bg-light rounded-3 small text-muted">
                    <i className="bi bi-geo-alt-fill text-danger me-1"></i>
                    Location: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                  </div>
                )}
              </div>
              <div className="modal-footer border-0 d-flex gap-2 pt-0">
                <button className="btn btn-secondary flex-fill" onClick={() => setShowConfirm(false)}>
                  <i className="bi bi-x me-1"></i> Cancel
                </button>
                <button
                  className="btn btn-danger flex-fill fw-bold"
                  onClick={() => sendSOS('manual')}
                  disabled={loading}
                >
                  {loading ? <span className="spinner-border spinner-border-sm me-1"></span> : null}
                  <i className="bi bi-exclamation-triangle me-1"></i> Yes, Send SOS!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
