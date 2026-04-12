import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function AlertHistory() {
  const { authFetch } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAlerts = async () => {
      setLoading(true);
      try {
        const res = await authFetch('/api/sos/my');
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Failed to load alert history.');
        } else {
          const data = await res.json();
          setAlerts(data.alerts || []);
        }
      } catch {
        setError('Network error loading alerts.');
      } finally {
        setLoading(false);
      }
    };
    fetchAlerts();
  }, [authFetch]);

  const statusIcon = {
    pending: 'bi-clock-fill text-warning',
    accepted: 'bi-check-circle-fill text-success',
    completed: 'bi-check2-all text-primary',
    cancelled: 'bi-x-circle-fill text-secondary',
  };

  return (
    <div style={{ background: '#f8f9fa', minHeight: '100vh', paddingBottom: '40px' }}>
      <div className="bg-white border-bottom py-3 px-3">
        <div className="container">
          <h4 className="fw-bold mb-0" style={{ color: '#b71c1c' }}>
            <i className="bi bi-clock-history me-2"></i>Alert History
          </h4>
          <small className="text-muted">All your past and active SOS alerts</small>
        </div>
      </div>

      <div className="container py-4">
        {loading && (
          <div className="text-center py-5">
            <div className="spinner-border text-danger" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3 text-muted">Loading alert history...</p>
          </div>
        )}

        {!loading && error && (
          <div className="alert alert-danger"><i className="bi bi-exclamation-circle me-2"></i>{error}</div>
        )}

        {!loading && !error && alerts.length === 0 && (
          <div className="empty-state page-card">
            <i className="bi bi-clock-history"></i>
            <h5>No Alerts Yet</h5>
            <p>You haven't sent any SOS alerts. Hopefully you never need to!</p>
          </div>
        )}

        {!loading && !error && alerts.length > 0 && (
          <div>
            <p className="text-muted mb-4 small">{alerts.length} alert{alerts.length !== 1 ? 's' : ''} found</p>
            {alerts.map(alert => (
              <div key={alert.id} className={`alert-card ${alert.status}`}>
                <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                  <div className="d-flex align-items-center gap-3">
                    <div style={{ fontSize: '1.5rem' }}>
                      {alert.status === 'completed' ? '✅' : alert.status === 'cancelled' ? '❌' : alert.status === 'accepted' ? '🚑' : '🆘'}
                    </div>
                    <div>
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <span className={`status-badge status-${alert.status}`}>
                          <i className={`bi ${statusIcon[alert.status] || 'bi-question'}`}></i>
                          {alert.status}
                        </span>
                        <span className="text-muted small">Alert #{alert.id}</span>
                      </div>
                      <div className="fw-semibold" style={{ fontSize: '0.95rem' }}>
                        {new Date(alert.created_at).toLocaleString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </div>
                  </div>
                  {alert.completed_at && (
                    <div className="text-end">
                      <div className="small text-muted">Resolved at</div>
                      <div className="small fw-semibold">
                        {new Date(alert.completed_at).toLocaleTimeString('en-IN', {
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-3 row g-2">
                  <div className="col-sm-6">
                    <div className="small text-muted">
                      <i className="bi bi-geo-alt me-1 text-danger"></i>
                      <strong>Location:</strong>{' '}
                      <a
                        href={`https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="map-link"
                      >
                        {parseFloat(alert.latitude).toFixed(5)}, {parseFloat(alert.longitude).toFixed(5)}
                        <i className="bi bi-box-arrow-up-right ms-1" style={{ fontSize: '0.7rem' }}></i>
                      </a>
                    </div>
                  </div>
                  {(alert.ambulance_name || alert.ambulance_driver) && (
                    <div className="col-sm-6">
                      <div className="small text-muted">
                        <i className="bi bi-truck me-1 text-success"></i>
                        <strong>Ambulance:</strong> {alert.ambulance_name || 'N/A'}
                        {alert.ambulance_driver && ` (${alert.ambulance_driver})`}
                      </div>
                    </div>
                  )}
                  {alert.ambulance_phone && (
                    <div className="col-sm-6">
                      <div className="small text-muted">
                        <i className="bi bi-telephone me-1 text-primary"></i>
                        <strong>Driver Phone:</strong> {alert.ambulance_phone}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
