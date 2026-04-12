import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

const POLL_INTERVAL = 8000;
const PAGE_SIZE = 20;
const RECENT_ALERTS_LIMIT = 15;

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString();
}

function computeDailyNumbers(alertsList) {
  const sorted = [...alertsList].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const monthCounters = {};
  const map = {};
  for (const a of sorted) {
    const d = new Date(a.created_at);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('default', { month: 'short', year: 'numeric' });
    monthCounters[monthKey] = (monthCounters[monthKey] || 0) + 1;
    map[a.id] = { num: monthCounters[monthKey], day: label };
  }
  return map;
}

function withinDateRange(dateStr, startDate, endDate) {
  if (!startDate && !endDate) return true;
  const d = new Date(dateStr);
  if (isNaN(d)) return true;
  if (startDate && d < new Date(startDate + 'T00:00:00')) return false;
  if (endDate && d > new Date(endDate + 'T23:59:59')) return false;
  return true;
}

function StatCard({ icon, label, value, color = '#b71c1c', sub }) {
  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-body d-flex align-items-center gap-3 py-3">
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: color + '18', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: '1.4rem', color
        }}>
          <i className={`bi ${icon}`}></i>
        </div>
        <div>
          <div className="fw-bold fs-4 lh-1">{value ?? '—'}</div>
          <div className="text-muted small">{label}</div>
          {sub && <div style={{ fontSize: '0.7rem', color }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  const pages = [];
  const delta = 2;
  const left = Math.max(2, page - delta);
  const right = Math.min(totalPages - 1, page + delta);
  pages.push(1);
  if (left > 2) pages.push('...');
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < totalPages - 1) pages.push('...');
  if (totalPages > 1) pages.push(totalPages);

  return (
    <nav className="mt-3 d-flex justify-content-center align-items-center gap-2">
      <button className="btn btn-sm btn-outline-secondary" disabled={page === 1} onClick={() => onChange(page - 1)}>
        <i className="bi bi-chevron-left"></i>
      </button>
      {pages.map((p, i) =>
        p === '...'
          ? <span key={`e_${i}`} className="px-1 text-muted">…</span>
          : <button
              key={p}
              className={`btn btn-sm ${page === p ? 'btn-danger' : 'btn-outline-secondary'}`}
              onClick={() => onChange(p)}
            >{p}</button>
      )}
      <button className="btn btn-sm btn-outline-secondary" disabled={page === totalPages} onClick={() => onChange(page + 1)}>
        <i className="bi bi-chevron-right"></i>
      </button>
    </nav>
  );
}

function DateFilter({ start, end, onStart, onEnd, onClear }) {
  return (
    <div className="d-flex align-items-center gap-2 flex-wrap">
      <label className="small text-muted fw-semibold mb-0">From</label>
      <input type="date" className="form-control form-control-sm" style={{ width: 150 }} value={start} onChange={e => onStart(e.target.value)} />
      <label className="small text-muted fw-semibold mb-0">To</label>
      <input type="date" className="form-control form-control-sm" style={{ width: 150 }} value={end} onChange={e => onEnd(e.target.value)} />
      {(start || end) && (
        <button className="btn btn-sm btn-outline-secondary" onClick={onClear}>
          <i className="bi bi-x-circle me-1"></i>Clear
        </button>
      )}
    </div>
  );
}

function PageInfo({ page, pageSize, total }) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return <small className="text-muted">Showing {from}–{to} of {total}</small>;
}

const STATUS_BADGE = { pending: 'bg-warning text-dark', accepted: 'bg-primary', resolved: 'bg-success', cancelled: 'bg-secondary' };
const ROLE_BADGE = { user: 'bg-info text-dark', ambulance: 'bg-danger', admin: 'bg-dark' };

export default function AdminDashboard() {
  const { authFetch } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [users, setUsers] = useState([]);
  const [ambulances, setAmbulances] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [penalties, setPenalties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editAmbulance, setEditAmbulance] = useState(null);
  const [editForm, setEditForm] = useState({});

  const [alertFilter, setAlertFilter] = useState('all');
  const [userSearch, setUserSearch] = useState('');

  const [alertPage, setAlertPage] = useState(1);
  const [alertDateStart, setAlertDateStart] = useState('');
  const [alertDateEnd, setAlertDateEnd] = useState('');

  const [userPage, setUserPage] = useState(1);
  const [userDateStart, setUserDateStart] = useState('');
  const [userDateEnd, setUserDateEnd] = useState('');

  const [ambPage, setAmbPage] = useState(1);
  const [ambDateStart, setAmbDateStart] = useState('');
  const [ambDateEnd, setAmbDateEnd] = useState('');

  const [penaltyPage, setPenaltyPage] = useState(1);
  const [penaltyDateStart, setPenaltyDateStart] = useState('');
  const [penaltyDateEnd, setPenaltyDateEnd] = useState('');

  const fetchStats = useCallback(async () => {
    try {
      const res = await authFetch('/api/admin/stats');
      if (res.ok) { const data = await res.json(); setStats(data.stats); setRecentAlerts(data.recent_alerts || []); }
    } catch {}
  }, [authFetch]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await authFetch('/api/admin/users');
      if (res.ok) { const data = await res.json(); setUsers(data.users || []); }
    } catch {}
  }, [authFetch]);

  const fetchAmbulances = useCallback(async () => {
    try {
      const res = await authFetch('/api/admin/ambulances');
      if (res.ok) { const data = await res.json(); setAmbulances(data.ambulances || []); }
    } catch {}
  }, [authFetch]);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await authFetch('/api/admin/alerts');
      if (res.ok) { const data = await res.json(); setAlerts(data.alerts || []); }
    } catch {}
  }, [authFetch]);

  const fetchPenalties = useCallback(async () => {
    try {
      const res = await authFetch('/api/admin/penalties');
      if (res.ok) { const data = await res.json(); setPenalties(data.penalties || []); }
    } catch {}
  }, [authFetch]);

  useEffect(() => {
    Promise.all([fetchStats(), fetchUsers(), fetchAmbulances(), fetchAlerts(), fetchPenalties()])
      .finally(() => setLoading(false));
    const interval = setInterval(() => { fetchStats(); fetchAmbulances(); }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchStats, fetchUsers, fetchAmbulances, fetchAlerts, fetchPenalties]);

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'ambulances') fetchAmbulances();
    if (activeTab === 'alerts') fetchAlerts();
    if (activeTab === 'penalties') fetchPenalties();
  }, [activeTab, fetchUsers, fetchAmbulances, fetchAlerts, fetchPenalties]);

  const showMsg = (msg, isError = false) => {
    if (isError) { setError(msg); setTimeout(() => setError(''), 5000); }
    else { setSuccess(msg); setTimeout(() => setSuccess(''), 4000); }
  };

  const changeUserRole = async (userId, newRole) => {
    setActionLoading(p => ({ ...p, [`user_${userId}`]: true }));
    try {
      const res = await authFetch(`/api/admin/users/${userId}`, { method: 'PUT', body: JSON.stringify({ role: newRole }) });
      const data = await res.json();
      if (!res.ok) showMsg(data.error, true);
      else { showMsg(`Role updated to ${newRole}`); fetchUsers(); }
    } catch { showMsg('Network error', true); }
    finally { setActionLoading(p => ({ ...p, [`user_${userId}`]: false })); }
  };

  const deleteUser = async (userId, name) => {
    if (!window.confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    setActionLoading(p => ({ ...p, [`del_${userId}`]: true }));
    try {
      const res = await authFetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) showMsg(data.error, true);
      else { showMsg(`User "${name}" deleted`); fetchUsers(); }
    } catch { showMsg('Network error', true); }
    finally { setActionLoading(p => ({ ...p, [`del_${userId}`]: false })); }
  };

  const saveAmbulance = async () => {
    if (!editAmbulance) return;
    setActionLoading(p => ({ ...p, [`amb_${editAmbulance}`]: true }));
    try {
      const res = await authFetch(`/api/admin/ambulances/${editAmbulance}`, { method: 'PUT', body: JSON.stringify(editForm) });
      const data = await res.json();
      if (!res.ok) showMsg(data.error, true);
      else { showMsg('Ambulance updated'); setEditAmbulance(null); fetchAmbulances(); }
    } catch { showMsg('Network error', true); }
    finally { setActionLoading(p => ({ ...p, [`amb_${editAmbulance}`]: false })); }
  };

  const quickToggleAmbulance = async (amb, field) => {
    setActionLoading(p => ({ ...p, [`amb_toggle_${amb.id}`]: true }));
    try {
      const res = await authFetch(`/api/admin/ambulances/${amb.id}`, { method: 'PUT', body: JSON.stringify({ [field]: !amb[field] }) });
      const data = await res.json();
      if (!res.ok) showMsg(data.error, true);
      else fetchAmbulances();
    } catch { showMsg('Network error', true); }
    finally { setActionLoading(p => ({ ...p, [`amb_toggle_${amb.id}`]: false })); }
  };

  const filteredAlerts = useMemo(() => {
    let list = alertFilter === 'all' ? alerts : alerts.filter(a => a.status === alertFilter);
    list = list.filter(a => withinDateRange(a.created_at, alertDateStart, alertDateEnd));
    return list;
  }, [alerts, alertFilter, alertDateStart, alertDateEnd]);

  const filteredUsers = useMemo(() => {
    let list = users.filter(u =>
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase())
    );
    list = list.filter(u => withinDateRange(u.created_at, userDateStart, userDateEnd));
    return list;
  }, [users, userSearch, userDateStart, userDateEnd]);

  const filteredAmbulances = useMemo(() => {
    return ambulances.filter(a => withinDateRange(a.created_at, ambDateStart, ambDateEnd));
  }, [ambulances, ambDateStart, ambDateEnd]);

  const filteredPenalties = useMemo(() => {
    return penalties.filter(p => withinDateRange(p.assigned_at, penaltyDateStart, penaltyDateEnd));
  }, [penalties, penaltyDateStart, penaltyDateEnd]);

  const alertDailyNumMap = useMemo(() => computeDailyNumbers(alerts), [alerts]);
  const recentAlertDailyNumMap = useMemo(() => computeDailyNumbers(recentAlerts), [recentAlerts]);

  const alertTotalPages = Math.max(1, Math.ceil(filteredAlerts.length / PAGE_SIZE));
  const userTotalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const ambTotalPages = Math.max(1, Math.ceil(filteredAmbulances.length / PAGE_SIZE));
  const penaltyTotalPages = Math.max(1, Math.ceil(filteredPenalties.length / PAGE_SIZE));

  const pagedAlerts = filteredAlerts.slice((alertPage - 1) * PAGE_SIZE, alertPage * PAGE_SIZE);
  const pagedUsers = filteredUsers.slice((userPage - 1) * PAGE_SIZE, userPage * PAGE_SIZE);
  const pagedAmbulances = filteredAmbulances.slice((ambPage - 1) * PAGE_SIZE, ambPage * PAGE_SIZE);
  const pagedPenalties = filteredPenalties.slice((penaltyPage - 1) * PAGE_SIZE, penaltyPage * PAGE_SIZE);

  const tabs = [
    { key: 'overview', label: 'Overview', icon: 'bi-grid' },
    { key: 'ambulances', label: 'Ambulances', icon: 'bi-truck', count: ambulances.length },
    { key: 'users', label: 'Users', icon: 'bi-people', count: users.length },
    { key: 'alerts', label: 'All Alerts', icon: 'bi-bell', count: alerts.length },
    { key: 'penalties', label: 'Penalties', icon: 'bi-exclamation-triangle', count: penalties.length },
  ];

  if (loading) return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '80vh' }}>
      <div className="text-center">
        <div className="spinner-border text-danger mb-3"></div>
        <p className="text-muted">Loading admin dashboard...</p>
      </div>
    </div>
  );

  return (
    <div style={{ background: '#f0f2f5', minHeight: '100vh', paddingBottom: 48 }}>

      <div className="bg-white border-bottom py-3 px-3 mb-3">
        <div className="container-fluid">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
              <h4 className="fw-bold mb-0" style={{ color: '#b71c1c' }}>
                <i className="bi bi-shield-fill me-2"></i>Admin Control Panel
              </h4>
              <small className="text-muted">System-wide management and monitoring</small>
            </div>
            {(stats?.pending_alerts > 0 || stats?.active_alerts > 0) && (
              <div className="d-flex gap-2">
                {stats.pending_alerts > 0 && (
                  <span className="badge bg-warning text-dark rounded-pill px-3 py-2 fs-6">
                    <i className="bi bi-clock me-1"></i>{stats.pending_alerts} Pending SOS
                  </span>
                )}
                {stats.active_alerts > 0 && (
                  <span className="badge bg-danger rounded-pill px-3 py-2 fs-6">
                    <i className="bi bi-truck me-1"></i>{stats.active_alerts} Active
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container-fluid px-3">

        {error && (
          <div className="alert alert-danger d-flex align-items-center gap-2 mb-3">
            <i className="bi bi-exclamation-circle-fill"></i><span>{error}</span>
            <button className="btn-close ms-auto" onClick={() => setError('')}></button>
          </div>
        )}
        {success && (
          <div className="alert alert-success d-flex align-items-center gap-2 mb-3">
            <i className="bi bi-check-circle-fill"></i><span>{success}</span>
          </div>
        )}

        <ul className="nav nav-tabs mb-4">
          {tabs.map(t => (
            <li className="nav-item" key={t.key}>
              <button
                className={`nav-link fw-semibold ${activeTab === t.key ? 'active text-danger' : 'text-muted'}`}
                onClick={() => setActiveTab(t.key)}
              >
                <i className={`bi ${t.icon} me-1`}></i>{t.label}
                {t.count !== undefined && (
                  <span className={`badge ms-1 ${activeTab === t.key ? 'bg-danger' : 'bg-secondary'}`}>{t.count}</span>
                )}
              </button>
            </li>
          ))}
        </ul>

        {/* ── OVERVIEW ── */}
        {activeTab === 'overview' && stats && (
          <div>
            <div className="row g-3 mb-4">
              <div className="col-6 col-md-4 col-lg-2"><StatCard icon="bi-people-fill" label="Total Users" value={stats.total_users} color="#1565c0" /></div>
              <div className="col-6 col-md-4 col-lg-2"><StatCard icon="bi-truck" label="Ambulances" value={stats.total_ambulances} color="#2e7d32" /></div>
              <div className="col-6 col-md-4 col-lg-2"><StatCard icon="bi-circle-fill" label="Available Now" value={stats.available_ambulances} color="#2e7d32" sub="Ready to dispatch" /></div>
              <div className="col-6 col-md-4 col-lg-2"><StatCard icon="bi-clock-fill" label="Pending SOS" value={stats.pending_alerts} color="#f57c00" /></div>
              <div className="col-6 col-md-4 col-lg-2"><StatCard icon="bi-activity" label="Active Cases" value={stats.active_alerts} color="#b71c1c" /></div>
              <div className="col-6 col-md-4 col-lg-2"><StatCard icon="bi-check-circle-fill" label="Resolved Today" value={stats.resolved_today} color="#388e3c" /></div>
              <div className="col-6 col-md-4 col-lg-2"><StatCard icon="bi-x-circle" label="Cancelled Today" value={stats.cancelled_today} color="#757575" /></div>
              <div className="col-6 col-md-4 col-lg-2"><StatCard icon="bi-bell-fill" label="Total Alerts" value={stats.total_alerts} color="#6a1b9a" /></div>
              <div className="col-6 col-md-4 col-lg-2"><StatCard icon="bi-exclamation-triangle-fill" label="Timeout Penalties" value={stats.timeout_penalties} color="#c62828" /></div>
              <div className="col-6 col-md-4 col-lg-2"><StatCard icon="bi-truck" label="On Case Now" value={stats.on_case_ambulances} color="#0277bd" /></div>
            </div>

            <div className="d-flex align-items-center justify-content-between mb-3">
              <h6 className="fw-bold mb-0 text-muted">Recent Alerts</h6>
              <small className="text-muted">Latest {RECENT_ALERTS_LIMIT} cases</small>
            </div>
            <div className="card border-0 shadow-sm">
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-hover mb-0 align-middle">
                    <thead className="table-light">
                      <tr><th>#</th><th>Victim</th><th>Status</th><th>Type</th><th>Ambulance</th><th>Time</th></tr>
                    </thead>
                    <tbody>
                      {recentAlerts.length === 0 ? (
                        <tr><td colSpan={6} className="text-center text-muted py-4">No alerts yet</td></tr>
                      ) : recentAlerts.slice(0, RECENT_ALERTS_LIMIT).map(a => (
                        <tr key={a.id}>
                          <td>
                            <span className="fw-semibold text-danger">#{recentAlertDailyNumMap[a.id]?.num ?? a.id}</span>
                            <div className="text-muted" style={{ fontSize: '0.7rem' }}>{recentAlertDailyNumMap[a.id]?.day ?? ''}</div>
                          </td>
                          <td className="fw-semibold">{a.victim_name}</td>
                          <td><span className={`badge ${STATUS_BADGE[a.status] || 'bg-secondary'}`}>{a.status}</span></td>
                          <td><span className="badge bg-light text-dark">{a.trigger_type || 'manual'}</span></td>
                          <td className="small text-muted">{a.ambulance_name || '—'}</td>
                          <td><small className="text-muted">{timeAgo(a.created_at)}</small></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── AMBULANCES ── */}
        {activeTab === 'ambulances' && (
          <div>
            {editAmbulance && (
              <div className="modal d-flex" style={{ background: 'rgba(0,0,0,0.5)', position: 'fixed', inset: 0, zIndex: 1055, alignItems: 'center', justifyContent: 'center' }}>
                <div className="modal-dialog m-3 w-100" style={{ maxWidth: 480 }}>
                  <div className="modal-content border-0 shadow-lg rounded-4">
                    <div className="modal-header border-0">
                      <h5 className="modal-title fw-bold">Edit Ambulance Unit</h5>
                      <button className="btn-close" onClick={() => setEditAmbulance(null)}></button>
                    </div>
                    <div className="modal-body">
                      <div className="mb-3">
                        <label className="form-label">Unit Name</label>
                        <input className="form-control" value={editForm.name || ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Driver Name</label>
                        <input className="form-control" value={editForm.driver_name || ''} onChange={e => setEditForm(f => ({ ...f, driver_name: e.target.value }))} />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Phone</label>
                        <input className="form-control" value={editForm.phone || ''} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
                      </div>
                      <div className="d-flex gap-3">
                        <div className="form-check form-switch">
                          <input className="form-check-input" type="checkbox" checked={!!editForm.available} onChange={e => setEditForm(f => ({ ...f, available: e.target.checked }))} />
                          <label className="form-check-label">Available</label>
                        </div>
                        <div className="form-check form-switch">
                          <input className="form-check-input" type="checkbox" checked={!!editForm.off_duty} onChange={e => setEditForm(f => ({ ...f, off_duty: e.target.checked }))} />
                          <label className="form-check-label">Off Duty</label>
                        </div>
                      </div>
                    </div>
                    <div className="modal-footer border-0">
                      <button className="btn btn-secondary" onClick={() => setEditAmbulance(null)}>Cancel</button>
                      <button className="btn btn-danger fw-bold" onClick={saveAmbulance} disabled={actionLoading[`amb_${editAmbulance}`]}>
                        {actionLoading[`amb_${editAmbulance}`] ? <span className="spinner-border spinner-border-sm"></span> : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-3">
              <DateFilter
                start={ambDateStart} end={ambDateEnd}
                onStart={v => { setAmbDateStart(v); setAmbPage(1); }}
                onEnd={v => { setAmbDateEnd(v); setAmbPage(1); }}
                onClear={() => { setAmbDateStart(''); setAmbDateEnd(''); setAmbPage(1); }}
              />
              <PageInfo page={ambPage} pageSize={PAGE_SIZE} total={filteredAmbulances.length} />
            </div>

            <div className="card border-0 shadow-sm">
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-hover mb-0 align-middle">
                    <thead className="table-light">
                      <tr><th>Unit</th><th>Driver</th><th>Phone</th><th>Status</th><th>Availability</th><th>Accepted</th><th>Timeouts</th><th>Registered</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {pagedAmbulances.length === 0 ? (
                        <tr><td colSpan={9} className="text-center text-muted py-4">No ambulances found</td></tr>
                      ) : pagedAmbulances.map(amb => (
                        <tr key={amb.id}>
                          <td>
                            <div className="fw-semibold">{amb.name}</div>
                            <small className="text-muted">{amb.staff_email}</small>
                          </td>
                          <td>{amb.driver_name || '—'}</td>
                          <td>{amb.phone || '—'}</td>
                          <td>
                            {amb.active_alert_id ? <span className="badge bg-danger">On Case</span>
                              : amb.off_duty ? <span className="badge bg-secondary">Off Duty</span>
                              : amb.available ? <span className="badge bg-success">Available</span>
                              : <span className="badge bg-warning text-dark">Unavailable</span>}
                          </td>
                          <td>
                            <div className="form-check form-switch mb-0">
                              <input className="form-check-input" type="checkbox" checked={!!amb.available}
                                disabled={!!amb.active_alert_id || !!actionLoading[`amb_toggle_${amb.id}`]}
                                onChange={() => quickToggleAmbulance(amb, 'available')} />
                            </div>
                          </td>
                          <td><span className="badge bg-success">{amb.accepted_count || 0}</span></td>
                          <td><span className={`badge ${parseInt(amb.timeout_count) > 0 ? 'bg-warning text-dark' : 'bg-light text-dark'}`}>{amb.timeout_count || 0}</span></td>
                          <td><small className="text-muted">{timeAgo(amb.created_at)}</small></td>
                          <td>
                            <div className="d-flex gap-1">
                              <button className="btn btn-sm btn-outline-secondary"
                                onClick={() => { setEditAmbulance(amb.id); setEditForm({ name: amb.name, driver_name: amb.driver_name, phone: amb.phone, available: amb.available, off_duty: amb.off_duty }); }}>
                                <i className="bi bi-pencil"></i>
                              </button>
                              <button className={`btn btn-sm ${amb.off_duty ? 'btn-outline-success' : 'btn-outline-warning'}`}
                                title={amb.off_duty ? 'Set On Duty' : 'Set Off Duty'}
                                disabled={!!amb.active_alert_id || !!actionLoading[`amb_toggle_${amb.id}`]}
                                onClick={() => quickToggleAmbulance(amb, 'off_duty')}>
                                <i className={`bi ${amb.off_duty ? 'bi-play-circle' : 'bi-pause-circle'}`}></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <Pagination page={ambPage} totalPages={ambTotalPages} onChange={setAmbPage} />
          </div>
        )}

        {/* ── USERS ── */}
        {activeTab === 'users' && (
          <div>
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-3">
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <input className="form-control form-control-sm" style={{ width: 220 }}
                  placeholder="Search name or email..."
                  value={userSearch}
                  onChange={e => { setUserSearch(e.target.value); setUserPage(1); }} />
                <DateFilter
                  start={userDateStart} end={userDateEnd}
                  onStart={v => { setUserDateStart(v); setUserPage(1); }}
                  onEnd={v => { setUserDateEnd(v); setUserPage(1); }}
                  onClear={() => { setUserDateStart(''); setUserDateEnd(''); setUserPage(1); }}
                />
              </div>
              <PageInfo page={userPage} pageSize={PAGE_SIZE} total={filteredUsers.length} />
            </div>

            <div className="card border-0 shadow-sm">
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-hover mb-0 align-middle">
                    <thead className="table-light">
                      <tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>SOS Count</th><th>Joined</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {pagedUsers.length === 0 ? (
                        <tr><td colSpan={7} className="text-center text-muted py-4">No users found</td></tr>
                      ) : pagedUsers.map(u => (
                        <tr key={u.id}>
                          <td className="fw-semibold">{u.name}</td>
                          <td className="small text-muted">{u.email}</td>
                          <td className="small">{u.phone || '—'}</td>
                          <td><span className={`badge ${ROLE_BADGE[u.role] || 'bg-secondary'}`}>{u.role}</span></td>
                          <td><span className="badge bg-light text-dark">{u.total_sos || 0}</span></td>
                          <td><small className="text-muted">{timeAgo(u.created_at)}</small></td>
                          <td>
                            <div className="d-flex gap-1">
                              <select className="form-select form-select-sm" style={{ width: 'auto' }}
                                value={u.role} disabled={actionLoading[`user_${u.id}`]}
                                onChange={e => changeUserRole(u.id, e.target.value)}>
                                <option value="user">User</option>
                                <option value="ambulance">Ambulance</option>
                                <option value="admin">Admin</option>
                              </select>
                              <button className="btn btn-sm btn-outline-danger"
                                disabled={actionLoading[`del_${u.id}`]}
                                onClick={() => deleteUser(u.id, u.name)}>
                                {actionLoading[`del_${u.id}`]
                                  ? <span className="spinner-border spinner-border-sm"></span>
                                  : <i className="bi bi-trash"></i>}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <Pagination page={userPage} totalPages={userTotalPages} onChange={setUserPage} />
          </div>
        )}

        {/* ── ALL ALERTS ── */}
        {activeTab === 'alerts' && (
          <div>
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-3">
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <div className="d-flex gap-1 flex-wrap">
                  {['all', 'pending', 'accepted', 'resolved', 'cancelled'].map(f => (
                    <button key={f}
                      className={`btn btn-sm ${alertFilter === f ? 'btn-danger' : 'btn-outline-secondary'}`}
                      onClick={() => { setAlertFilter(f); setAlertPage(1); }}>
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                      {' '}({f === 'all' ? alerts.length : alerts.filter(a => a.status === f).length})
                    </button>
                  ))}
                </div>
                <DateFilter
                  start={alertDateStart} end={alertDateEnd}
                  onStart={v => { setAlertDateStart(v); setAlertPage(1); }}
                  onEnd={v => { setAlertDateEnd(v); setAlertPage(1); }}
                  onClear={() => { setAlertDateStart(''); setAlertDateEnd(''); setAlertPage(1); }}
                />
              </div>
              <PageInfo page={alertPage} pageSize={PAGE_SIZE} total={filteredAlerts.length} />
            </div>

            <div className="card border-0 shadow-sm">
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-hover mb-0 align-middle">
                    <thead className="table-light">
                      <tr><th>#</th><th>Victim</th><th>Blood</th><th>Status</th><th>Type</th><th>Ambulance</th><th>Assignments</th><th>Timeouts</th><th>Time</th></tr>
                    </thead>
                    <tbody>
                      {pagedAlerts.length === 0 ? (
                        <tr><td colSpan={9} className="text-center text-muted py-4">No alerts found</td></tr>
                      ) : pagedAlerts.map(a => (
                        <tr key={a.id}>
                          <td>
                            <span className="fw-semibold text-danger">#{alertDailyNumMap[a.id]?.num ?? a.id}</span>
                            <div className="text-muted" style={{ fontSize: '0.7rem' }}>{alertDailyNumMap[a.id]?.day ?? ''}</div>
                          </td>
                          <td>
                            <div className="fw-semibold">{a.victim_name}</div>
                            <small className="text-muted">{a.victim_phone || ''}</small>
                          </td>
                          <td>{a.blood_group ? <span className="badge bg-danger">{a.blood_group}</span> : '—'}</td>
                          <td><span className={`badge ${STATUS_BADGE[a.status] || 'bg-secondary'}`}>{a.status}</span></td>
                          <td><span className="badge bg-light text-dark">{a.trigger_type || 'manual'}</span></td>
                          <td className="small">{a.ambulance_name || '—'}</td>
                          <td><span className="badge bg-light text-dark">{a.assignment_count || 0}</span></td>
                          <td>{parseInt(a.timeout_count) > 0
                            ? <span className="badge bg-warning text-dark">{a.timeout_count}</span>
                            : <span className="text-muted">—</span>}
                          </td>
                          <td><small className="text-muted">{timeAgo(a.created_at)}</small></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <Pagination page={alertPage} totalPages={alertTotalPages} onChange={setAlertPage} />
          </div>
        )}

        {/* ── PENALTIES ── */}
        {activeTab === 'penalties' && (
          <div>
            <div className="alert alert-warning d-flex align-items-center gap-2 mb-3">
              <i className="bi bi-exclamation-triangle-fill"></i>
              <span>Timeout penalties are recorded when an ambulance fails to accept an assigned SOS alert within 3 minutes.</span>
            </div>

            <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-3">
              <DateFilter
                start={penaltyDateStart} end={penaltyDateEnd}
                onStart={v => { setPenaltyDateStart(v); setPenaltyPage(1); }}
                onEnd={v => { setPenaltyDateEnd(v); setPenaltyPage(1); }}
                onClear={() => { setPenaltyDateStart(''); setPenaltyDateEnd(''); setPenaltyPage(1); }}
              />
              <PageInfo page={penaltyPage} pageSize={PAGE_SIZE} total={filteredPenalties.length} />
            </div>

            <div className="card border-0 shadow-sm">
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-hover mb-0 align-middle">
                    <thead className="table-light">
                      <tr><th>Alert #</th><th>Victim</th><th>Ambulance</th><th>Driver</th><th>Assigned At</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {pagedPenalties.length === 0 ? (
                        <tr><td colSpan={6} className="text-center text-muted py-4">No timeout penalties found</td></tr>
                      ) : pagedPenalties.map(p => (
                        <tr key={p.id}>
                          <td>
                            <span className="fw-semibold text-danger">#{alertDailyNumMap[p.alert_id]?.num ?? p.alert_id}</span>
                            <div className="text-muted" style={{ fontSize: '0.7rem' }}>{alertDailyNumMap[p.alert_id]?.day ?? ''}</div>
                          </td>
                          <td className="fw-semibold">{p.victim_name}</td>
                          <td>{p.ambulance_name}</td>
                          <td>{p.driver_name || '—'}</td>
                          <td><small className="text-muted">{formatDate(p.assigned_at)}</small></td>
                          <td><span className="badge bg-warning text-dark"><i className="bi bi-exclamation-triangle me-1"></i>Timeout</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <Pagination page={penaltyPage} totalPages={penaltyTotalPages} onChange={penaltyPage => setPenaltyPage(penaltyPage)} />
          </div>
        )}

      </div>
    </div>
  );
}
