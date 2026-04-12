import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import API_BASE_URL from '../config.js';

function defaultRoute(role) {
  if (role === 'ambulance') return '/ambulance-dashboard';
  if (role === 'admin') return '/admin-dashboard';
  return '/dashboard';
}

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role: 'user', admin_code: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password || !form.role) {
      setError('Please fill in all required fields.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (form.role === 'admin' && !form.admin_code) {
      setError('Admin access code is required for admin accounts.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Registration failed. Please try again.');
      } else {
        login(data.token, data.user);
        navigate(defaultRoute(data.user.role));
      }
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper" style={{ minHeight: '100vh' }}>
      <div className="auth-card" style={{ maxWidth: '520px' }}>
        <div className="auth-logo">
          <div className="logo-icon">🚨</div>
          <h1 className="auth-title">Create Account</h1>
          <p className="auth-subtitle">Join the SOS Emergency Response System</p>
        </div>

        {error && (
          <div className="alert alert-danger d-flex align-items-center gap-2 py-2" role="alert">
            <i className="bi bi-exclamation-circle-fill"></i>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-3">
            <label className="form-label">Full Name <span className="text-danger">*</span></label>
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-person"></i></span>
              <input type="text" name="name" className="form-control" placeholder="Your full name"
                value={form.name} onChange={handleChange} required />
            </div>
          </div>
          <div className="mb-3">
            <label className="form-label">Email Address <span className="text-danger">*</span></label>
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-envelope"></i></span>
              <input type="email" name="email" className="form-control" placeholder="you@example.com"
                value={form.email} onChange={handleChange} required />
            </div>
          </div>
          <div className="mb-3">
            <label className="form-label">Phone Number</label>
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-telephone"></i></span>
              <input type="tel" name="phone" className="form-control" placeholder="+91 XXXXX XXXXX"
                value={form.phone} onChange={handleChange} />
            </div>
          </div>
          <div className="mb-3">
            <label className="form-label">Password <span className="text-danger">*</span></label>
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-lock"></i></span>
              <input type="password" name="password" className="form-control" placeholder="Min. 6 characters"
                value={form.password} onChange={handleChange} required />
            </div>
          </div>

          <div className="mb-4">
            <label className="form-label">Account Role <span className="text-danger">*</span></label>
            <div className="row g-2">
              <div className="col-4">
                <div
                  className={`border rounded-3 p-3 text-center ${form.role === 'user' ? 'border-danger bg-danger bg-opacity-10' : 'border-secondary-subtle'}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setForm({ ...form, role: 'user', admin_code: '' })}
                >
                  <div style={{ fontSize: '1.4rem', marginBottom: '4px' }}>👤</div>
                  <div className="fw-semibold" style={{ fontSize: '0.85rem' }}>User</div>
                  <div className="text-muted" style={{ fontSize: '0.7rem' }}>Send SOS</div>
                </div>
              </div>
              <div className="col-4">
                <div
                  className={`border rounded-3 p-3 text-center ${form.role === 'ambulance' ? 'border-danger bg-danger bg-opacity-10' : 'border-secondary-subtle'}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setForm({ ...form, role: 'ambulance', admin_code: '' })}
                >
                  <div style={{ fontSize: '1.4rem', marginBottom: '4px' }}>🚑</div>
                  <div className="fw-semibold" style={{ fontSize: '0.85rem' }}>Ambulance</div>
                  <div className="text-muted" style={{ fontSize: '0.7rem' }}>Respond</div>
                </div>
              </div>
              <div className="col-4">
                <div
                  className={`border rounded-3 p-3 text-center ${form.role === 'admin' ? 'border-dark bg-dark bg-opacity-10' : 'border-secondary-subtle'}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setForm({ ...form, role: 'admin' })}
                >
                  <div style={{ fontSize: '1.4rem', marginBottom: '4px' }}>🛡️</div>
                  <div className="fw-semibold" style={{ fontSize: '0.85rem' }}>Admin</div>
                  <div className="text-muted" style={{ fontSize: '0.7rem' }}>Manage all</div>
                </div>
              </div>
            </div>
          </div>

          {form.role === 'admin' && (
            <div className="mb-4">
              <label className="form-label">Admin Access Code <span className="text-danger">*</span></label>
              <div className="input-group">
                <span className="input-group-text"><i className="bi bi-key"></i></span>
                <input type="password" name="admin_code" className="form-control"
                  placeholder="Enter admin access code"
                  value={form.admin_code} onChange={handleChange} required />
              </div>
              <div className="form-text text-muted">
                <i className="bi bi-info-circle me-1"></i>Contact your system administrator for the access code.
              </div>
            </div>
          )}

          <button type="submit" className="btn btn-danger w-100 py-2 fw-bold" disabled={loading}>
            {loading
              ? <><span className="spinner-border spinner-border-sm me-2" role="status"></span>Creating account...</>
              : <><i className="bi bi-person-plus me-2"></i>Create Account</>}
          </button>
        </form>

        <hr className="my-4" />
        <p className="text-center text-muted mb-0" style={{ fontSize: '0.9rem' }}>
          Already have an account?{' '}
          <Link to="/login" className="text-danger fw-semibold text-decoration-none">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
