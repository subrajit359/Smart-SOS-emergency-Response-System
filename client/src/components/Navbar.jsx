import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (path) => location.pathname === path ? 'active fw-semibold' : '';

  const handleLogout = () => {
    logout();
    navigate('/');
    setMenuOpen(false);
  };

  return (
    <nav className="navbar navbar-expand-lg sos-navbar sticky-top">
      <div className="container">
        <Link className="navbar-brand" to="/">
          <span>🚨</span> SOS Response
        </Link>
        <button
          className="navbar-toggler border-0"
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle navigation"
        >
          <span style={{ color: 'white', fontSize: '1.4rem' }}>
            <i className={`bi ${menuOpen ? 'bi-x-lg' : 'bi-list'}`}></i>
          </span>
        </button>
        <div className={`collapse navbar-collapse ${menuOpen ? 'show' : ''}`}>
          <ul className="navbar-nav ms-auto align-items-lg-center gap-lg-1">

            {!user && (
              <>
                <li className="nav-item">
                  <Link className={`nav-link ${isActive('/')}`} to="/" onClick={() => setMenuOpen(false)}>
                    <i className="bi bi-house me-1"></i> Home
                  </Link>
                </li>
                <li className="nav-item ms-lg-2">
                  <Link to="/login" className="btn btn-outline-light btn-sm px-3" onClick={() => setMenuOpen(false)}>
                    Login
                  </Link>
                </li>
                <li className="nav-item ms-lg-2">
                  <Link to="/register" className="btn btn-light btn-sm px-3 text-danger fw-bold" onClick={() => setMenuOpen(false)}>
                    Register
                  </Link>
                </li>
              </>
            )}

            {user && user.role === 'user' && (
              <>
                <li className="nav-item">
                  <Link className={`nav-link ${isActive('/dashboard')}`} to="/dashboard" onClick={() => setMenuOpen(false)}>
                    <i className="bi bi-grid me-1"></i> Dashboard
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className={`nav-link ${isActive('/alert-history')}`} to="/alert-history" onClick={() => setMenuOpen(false)}>
                    <i className="bi bi-clock-history me-1"></i> History
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className={`nav-link ${isActive('/profile')}`} to="/profile" onClick={() => setMenuOpen(false)}>
                    <i className="bi bi-person me-1"></i> Profile
                  </Link>
                </li>
              </>
            )}

            {user && user.role === 'ambulance' && (
              <>
                <li className="nav-item">
                  <Link className={`nav-link ${isActive('/ambulance-dashboard')}`} to="/ambulance-dashboard" onClick={() => setMenuOpen(false)}>
                    <i className="bi bi-activity me-1"></i> Dashboard
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className={`nav-link ${isActive('/profile')}`} to="/profile" onClick={() => setMenuOpen(false)}>
                    <i className="bi bi-person me-1"></i> Profile
                  </Link>
                </li>
              </>
            )}

            {user && user.role === 'admin' && (
              <>
                <li className="nav-item">
                  <Link className={`nav-link ${isActive('/admin-dashboard')}`} to="/admin-dashboard" onClick={() => setMenuOpen(false)}>
                    <i className="bi bi-shield-fill me-1"></i> Admin Panel
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className={`nav-link ${isActive('/profile')}`} to="/profile" onClick={() => setMenuOpen(false)}>
                    <i className="bi bi-person me-1"></i> Profile
                  </Link>
                </li>
              </>
            )}

            {user && (
              <li className="nav-item ms-lg-2">
                <button className="btn btn-outline-light btn-sm px-3" onClick={handleLogout}>
                  <i className="bi bi-box-arrow-right me-1"></i> Logout
                </button>
              </li>
            )}

          </ul>
        </div>
      </div>
    </nav>
  );
}
