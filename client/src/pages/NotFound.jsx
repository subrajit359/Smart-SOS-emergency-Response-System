import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function NotFound() {
  const { user } = useAuth();

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa' }}>
      <div className="text-center p-4">
        <div style={{ fontSize: '5rem', marginBottom: '16px' }}>🚧</div>
        <h1 style={{ fontSize: '5rem', fontWeight: 900, color: '#e53935', lineHeight: 1 }}>404</h1>
        <h2 className="fw-bold mt-2 mb-3" style={{ color: '#333' }}>Page Not Found</h2>
        <p className="text-muted mb-4" style={{ maxWidth: '380px', margin: '0 auto 24px' }}>
          The page you're looking for doesn't exist or has been moved. Please check the URL or navigate back.
        </p>
        <div className="d-flex gap-3 justify-content-center flex-wrap">
          <Link
            to={user ? (user.role === 'ambulance' ? '/ambulance-dashboard' : '/dashboard') : '/'}
            className="btn btn-danger px-4 fw-bold"
          >
            <i className="bi bi-house me-2"></i>
            {user ? 'Go to Dashboard' : 'Go Home'}
          </Link>
          <button className="btn btn-outline-secondary px-4" onClick={() => window.history.back()}>
            <i className="bi bi-arrow-left me-2"></i>Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
