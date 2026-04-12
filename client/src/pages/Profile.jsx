import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Profile() {
  const { authFetch, updateUser, user } = useAuth();
  const [form, setForm] = useState({
    name: '', email: '', phone: '',
    blood_group: '', allergies: '', medical_conditions: '',
    current_medications: '', emergency_contact_name: '',
    emergency_contact_phone: '', medical_notes: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const res = await authFetch('/api/profile');
        if (res.ok) {
          const data = await res.json();
          const u = data.user;
          setForm({
            name: u.name || '',
            email: u.email || '',
            phone: u.phone || '',
            blood_group: u.blood_group || '',
            allergies: u.allergies || '',
            medical_conditions: u.medical_conditions || '',
            current_medications: u.current_medications || '',
            emergency_contact_name: u.emergency_contact_name || '',
            emergency_contact_phone: u.emergency_contact_phone || '',
            medical_notes: u.medical_notes || ''
          });
        }
      } catch {
        setError('Failed to load profile.');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [authFetch]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email) {
      setError('Name and email are required.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await authFetch('/api/profile', {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to update profile.');
      } else {
        setSuccess('Profile updated successfully!');
        updateUser({ ...user, name: form.name, email: form.email, phone: form.phone });
        window.scrollTo(0, 0);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="d-flex justify-content-center align-items-center py-5">
      <div className="spinner-border text-danger" role="status"></div>
    </div>
  );

  return (
    <div style={{ background: '#f8f9fa', minHeight: '100vh', paddingBottom: '40px' }}>
      <div className="bg-white border-bottom py-3 px-3">
        <div className="container">
          <h4 className="fw-bold mb-0" style={{ color: '#b71c1c' }}>
            <i className="bi bi-person-circle me-2"></i>My Profile
          </h4>
          <small className="text-muted">Manage your personal and medical information</small>
        </div>
      </div>

      <div className="container py-4">
        <div className="row justify-content-center">
          <div className="col-lg-8">
            {success && (
              <div className="alert alert-success d-flex align-items-center gap-2 mb-4">
                <i className="bi bi-check-circle-fill"></i><span>{success}</span>
                <button className="btn-close ms-auto" onClick={() => setSuccess('')}></button>
              </div>
            )}
            {error && (
              <div className="alert alert-danger d-flex align-items-center gap-2 mb-4">
                <i className="bi bi-exclamation-circle-fill"></i><span>{error}</span>
                <button className="btn-close ms-auto" onClick={() => setError('')}></button>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Personal Info */}
              <div className="page-card mb-4">
                <div className="profile-section-label">
                  <i className="bi bi-person me-1"></i> Personal Information
                </div>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Full Name <span className="text-danger">*</span></label>
                    <input type="text" name="name" className="form-control" value={form.name} onChange={handleChange} required />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Email Address <span className="text-danger">*</span></label>
                    <input type="email" name="email" className="form-control" value={form.email} onChange={handleChange} required />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Phone Number</label>
                    <input type="tel" name="phone" className="form-control" value={form.phone} onChange={handleChange} placeholder="+91 XXXXX XXXXX" />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Role</label>
                    <input type="text" className="form-control" value={user?.role === 'ambulance' ? 'Ambulance Staff' : 'Regular User'} disabled />
                  </div>
                </div>
              </div>

              {/* Medical Info */}
              <div className="page-card mb-4">
                <div className="profile-section-label">
                  <i className="bi bi-file-medical me-1"></i> Medical Profile
                </div>

                <div className="medical-notice">
                  <i className="bi bi-exclamation-triangle-fill" style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: '2px' }}></i>
                  <div>
                    <strong>Important:</strong> This information is automatically shared with emergency responders when you send an SOS alert.
                    Fill in as much as possible — it helps paramedics provide better care before they reach a hospital.
                  </div>
                </div>

                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">
                      <i className="bi bi-droplet-fill text-danger me-1"></i>Blood Group
                    </label>
                    <select name="blood_group" className="form-select" value={form.blood_group} onChange={handleChange}>
                      <option value="">Select blood group</option>
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                        <option key={bg} value={bg}>{bg}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">
                      <i className="bi bi-exclamation-diamond text-warning me-1"></i>Known Allergies
                    </label>
                    <input
                      type="text" name="allergies" className="form-control"
                      value={form.allergies} onChange={handleChange}
                      placeholder="e.g. penicillin, latex, peanuts"
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label">
                      <i className="bi bi-heart-pulse text-danger me-1"></i>Medical Conditions
                    </label>
                    <input
                      type="text" name="medical_conditions" className="form-control"
                      value={form.medical_conditions} onChange={handleChange}
                      placeholder="e.g. diabetes, epilepsy, heart disease, asthma"
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label">
                      <i className="bi bi-capsule text-primary me-1"></i>Current Medications
                    </label>
                    <input
                      type="text" name="current_medications" className="form-control"
                      value={form.current_medications} onChange={handleChange}
                      placeholder="e.g. insulin 10 units, blood thinners, metformin 500mg"
                    />
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="page-card mb-4">
                <div className="profile-section-label">
                  <i className="bi bi-telephone-fill me-1"></i> Emergency Contact
                </div>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Contact Name</label>
                    <input
                      type="text" name="emergency_contact_name" className="form-control"
                      value={form.emergency_contact_name} onChange={handleChange}
                      placeholder="Parent / Spouse / Friend"
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Contact Phone</label>
                    <input
                      type="tel" name="emergency_contact_phone" className="form-control"
                      value={form.emergency_contact_phone} onChange={handleChange}
                      placeholder="+91 XXXXX XXXXX"
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label">Additional Notes for Doctors</label>
                    <textarea
                      name="medical_notes" className="form-control" rows="3"
                      value={form.medical_notes} onChange={handleChange}
                      placeholder="Any other important medical information, past surgeries, implants, etc."
                    />
                  </div>
                </div>
              </div>

              <button type="submit" className="btn btn-danger px-5 py-2 fw-bold" disabled={saving}>
                {saving ? (
                  <><span className="spinner-border spinner-border-sm me-2" role="status"></span>Saving...</>
                ) : (
                  <><i className="bi bi-check-circle me-2"></i>Save Profile</>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
