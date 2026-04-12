import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Home() {
  const { user } = useAuth();

  return (
    <div>
      {/* Hero */}
      <section className="hero-section">
        <div className="container position-relative" style={{ zIndex: 1 }}>
          <div className="row align-items-center">
            <div className="col-lg-7">
              <div className="hero-badge">
                <i className="bi bi-shield-check me-1"></i> Life-Saving Technology
              </div>
              <h1 className="hero-title">Smart SOS Emergency Response System</h1>
              <p className="hero-subtitle">
                One tap sends your exact location and full medical profile to the nearest ambulance.
                Crash detection automatically alerts help even when you can't.
              </p>
              <div className="d-flex flex-wrap gap-3">
                {user ? (
                  <Link
                    to={user.role === 'ambulance' ? '/ambulance-dashboard' : '/dashboard'}
                    className="btn btn-light btn-lg px-4 fw-bold text-danger"
                  >
                    <i className="bi bi-grid me-2"></i> Go to Dashboard
                  </Link>
                ) : (
                  <>
                    <Link to="/register" className="btn btn-light btn-lg px-4 fw-bold text-danger">
                      <i className="bi bi-person-plus me-2"></i> Create Account
                    </Link>
                    <Link to="/login" className="btn btn-outline-light btn-lg px-4">
                      <i className="bi bi-box-arrow-in-right me-2"></i> Sign In
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="hero-sos-icon">🚨</div>
      </section>

      {/* Features */}
      <section className="py-5" style={{ background: '#f8f9fa' }}>
        <div className="container py-3">
          <div className="text-center mb-5">
            <h2 className="fw-800" style={{ fontWeight: 800, fontSize: '2rem' }}>Why SOS Response?</h2>
            <p className="text-muted" style={{ fontSize: '1rem' }}>Designed for emergencies. Built for speed.</p>
          </div>
          <div className="row g-4">
            <div className="col-md-6 col-lg-3">
              <div className="feature-card">
                <div className="feature-icon red">
                  <i className="bi bi-geo-alt-fill"></i>
                </div>
                <h5 className="fw-bold mb-2">Live GPS Location</h5>
                <p className="text-muted small mb-0">Your exact coordinates are shared instantly with the responding ambulance team.</p>
              </div>
            </div>
            <div className="col-md-6 col-lg-3">
              <div className="feature-card">
                <div className="feature-icon orange">
                  <i className="bi bi-phone-vibrate"></i>
                </div>
                <h5 className="fw-bold mb-2">Crash Detection</h5>
                <p className="text-muted small mb-0">Accelerometer monitors for sudden impact. Auto-alerts if no response within 20 seconds.</p>
              </div>
            </div>
            <div className="col-md-6 col-lg-3">
              <div className="feature-card">
                <div className="feature-icon blue">
                  <i className="bi bi-file-medical"></i>
                </div>
                <h5 className="fw-bold mb-2">Medical Profile</h5>
                <p className="text-muted small mb-0">Blood group, allergies, medications — all sent to the ambulance before they arrive.</p>
              </div>
            </div>
            <div className="col-md-6 col-lg-3">
              <div className="feature-card">
                <div className="feature-icon green">
                  <i className="bi bi-lightning-fill"></i>
                </div>
                <h5 className="fw-bold mb-2">Instant Alert</h5>
                <p className="text-muted small mb-0">One tap sends the SOS. Ambulance staff see it immediately on their dashboard.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-5 bg-white">
        <div className="container py-3">
          <div className="text-center mb-5">
            <h2 style={{ fontWeight: 800, fontSize: '2rem' }}>How It Works</h2>
            <p className="text-muted">Three simple steps in a crisis</p>
          </div>
          <div className="row g-4 justify-content-center">
            <div className="col-md-4">
              <div className="step-card">
                <div className="step-number">1</div>
                <h5 className="fw-bold mb-2">Trigger SOS</h5>
                <p className="text-muted small">Tap the big red button or let crash detection trigger it automatically when impact is detected.</p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="step-card">
                <div className="step-number">2</div>
                <h5 className="fw-bold mb-2">Location Sent</h5>
                <p className="text-muted small">Your GPS coordinates and full medical profile are immediately sent to available ambulances.</p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="step-card">
                <div className="step-number">3</div>
                <h5 className="fw-bold mb-2">Help Arrives</h5>
                <p className="text-muted small">Ambulance staff accept the alert and head to your location. You see live status updates.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-5" style={{ background: 'linear-gradient(135deg, #b71c1c, #e53935)' }}>
        <div className="container py-3 text-center text-white">
          <h2 style={{ fontWeight: 800, fontSize: '2rem', marginBottom: '12px' }}>Ready for Any Emergency?</h2>
          <p className="mb-4" style={{ opacity: 0.9, fontSize: '1.05rem' }}>
            Register now and set up your medical profile — it could save your life.
          </p>
          {!user && (
            <Link to="/register" className="btn btn-light btn-lg px-5 fw-bold text-danger">
              <i className="bi bi-shield-plus me-2"></i> Get Protected Now
            </Link>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-4 bg-dark text-center text-white-50">
        <small>
          &copy; {new Date().getFullYear()} Smart SOS Emergency Response System &mdash; B.Tech Final Year Project
        </small>
      </footer>
    </div>
  );
}
