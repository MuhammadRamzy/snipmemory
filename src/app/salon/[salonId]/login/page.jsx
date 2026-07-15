"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useApp } from '../../../../context/AppContext';

export default function SalonTenantLogin() {
  const router = useRouter();
  const params = useParams();
  const salonId = params.salonId;
  const { salons, staff, loginSalon, setSalonMode } = useApp();

  const [salon, setSalon] = useState(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [activeTab, setActiveTab] = useState('owner'); // 'owner' | 'stylist'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedStylistId, setSelectedStylistId] = useState('');
  const [stationPin, setStationPin] = useState('');
  const [error, setError] = useState('');
  const [forgotMode, setForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (salons) {
      const found = salons.find(s => s.id === salonId);
      setSalon(found || null);
      setLoading(false);
    }
  }, [salons, salonId]);

  // Filter stylists for this salon only
  const availableStaff = salon ? staff.filter(st => st.salonId === salon.id) : [];

  useEffect(() => {
    if (availableStaff.length > 0) {
      setSelectedStylistId(availableStaff[0].id);
    } else {
      setSelectedStylistId('');
    }
  }, [availableStaff]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div style={{ color: 'var(--text-secondary)' }}>Verifying salon credentials...</div>
      </div>
    );
  }

  if (!salon) {
    return (
      <div className="flex-center" style={{ minHeight: '100vh', padding: '1.5rem', background: 'var(--bg-primary)' }}>
        <div className="card card-premium animate-slide" style={{ maxWidth: '450px', width: '100%', textAlign: 'center', padding: '2.5rem' }}>
          <div style={{ display: 'inline-flex', padding: '1rem', borderRadius: '50%', background: 'var(--error-soft)', color: 'var(--error-color)', marginBottom: '1.5rem' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>Salon Portal Not Found</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: '1.6', marginBottom: '2rem' }}>
            The requested salon path <strong>"{salonId}"</strong> does not exist in our systems. Please check the spelling or explore registered salons on the directory.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button className="btn btn-primary btn-block" onClick={() => router.push('/discovery')}>
              Search Salon Directory
            </button>
            <button className="btn btn-secondary btn-block" onClick={() => router.push('/')}>
              Go to Landing Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleOwnerSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter your email/mobile and password.');
      return;
    }

    try {
      const logged = loginSalon(email, password);
      // Double check that the logged in salon matches this tenant ID
      if (logged.id !== salon.id) {
        setError('Incorrect owner credentials for this salon shop.');
        return;
      }
      setSalonMode('owner');
      router.push(`/salon/${salon.id}/dashboard`);
    } catch (err) {
      setError(err.message || 'Login failed.');
    }
  };

  const handleStylistSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!selectedStylistId || !stationPin) {
      setError('Please select your stylist profile and enter the PIN.');
      return;
    }

    if (stationPin !== '1234' && stationPin !== '0000') {
      setError('Invalid station access PIN code. (Use 1234 or 0000 for demo)');
      return;
    }

    try {
      // Log the stylist into this salon
      loginSalon(salon.email, salon.password);
      setSalonMode('barber');
      router.push(`/salon/${salon.id}/barber`);
    } catch (err) {
      setError(err.message || 'Failed to authenticate station.');
    }
  };

  const handleResetSubmit = (e) => {
    e.preventDefault();
    if (!resetEmail) return;
    setResetSent(true);
  };

  return (
    <div className="flex-center" style={{ minHeight: '100vh', padding: '1.5rem', background: 'var(--bg-primary)', position: 'relative' }}>
      
      {/* Decorative Glows */}
      <div style={{ position: 'absolute', top: '20%', left: '10%', width: '300px', height: '300px', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '20%', right: '10%', width: '300px', height: '300px', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none' }} />

      <div className="card card-premium animate-slide" style={{ maxWidth: '420px', width: '100%', border: '1px solid var(--border-color)', borderRadius: '16px', background: 'rgba(17, 18, 25, 0.7)', backdropFilter: 'blur(16px)', padding: '2rem', zIndex: 10 }}>
        
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          {salon.logoUrl ? (
            <img src={salon.logoUrl} alt={salon.name} style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover', marginBottom: '0.75rem', border: '1px solid var(--border-color)' }} />
          ) : (
            <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: '12px', background: 'var(--accent-soft)', color: 'var(--accent-color)', marginBottom: '0.75rem' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 22V4c0-.5.2-1 .6-1.4C5 2.2 5.5 2 6 2h12c.5 0 1 .2 1.4.6.4.4.6.9.6 1.4v18l-8-4-8 4z" /></svg>
            </div>
          )}
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>
            {forgotMode ? 'Recover Account' : salon.name}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginTop: '0.25rem' }}>
            {forgotMode ? 'Verify your identity' : 'Workspace Login'}
          </p>
        </div>

        {error && (
          <div style={{ background: 'var(--error-soft)', color: 'var(--error-color)', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.8125rem', fontWeight: '600' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{marginRight: '6px', verticalAlign: 'middle', display: 'inline-block'}}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>{error}
          </div>
        )}

        {!forgotMode ? (
          <>
            {/* Tabs */}
            <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: '0.25rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
              <button
                className={`btn btn-sm ${activeTab === 'owner' ? 'btn-primary' : 'btn-text'}`}
                style={{ flex: 1, borderRadius: '6px', fontSize: '0.8125rem', padding: '0.5rem 0' }}
                onClick={() => { setActiveTab('owner'); setError(''); }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{marginRight: '4px', verticalAlign: 'middle'}}><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> Owner Portal
              </button>
              <button
                className={`btn btn-sm ${activeTab === 'stylist' ? 'btn-primary' : 'btn-text'}`}
                style={{ flex: 1, borderRadius: '6px', fontSize: '0.8125rem', padding: '0.5rem 0' }}
                onClick={() => { setActiveTab('stylist'); setError(''); }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{marginRight: '4px', verticalAlign: 'middle'}}><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg> Stylist Station
              </button>
            </div>

            {/* TAB 1: OWNER PORTAL */}
            {activeTab === 'owner' && (
              <form onSubmit={handleOwnerSubmit} className="animate-fade">
                <div className="form-group">
                  <label className="form-label">Owner Email or Mobile</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="owner@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                    <label className="form-label" style={{ margin: 0 }}>Password</label>
                    <button 
                      type="button" 
                      className="btn-text" 
                      style={{ padding: 0, font: 'inherit', fontSize: '0.8125rem', color: 'var(--accent-color)', cursor: 'pointer' }}
                      onClick={() => { setForgotMode(true); setError(''); }}
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary btn-block btn-lg" style={{ marginTop: '1.5rem', fontSize: '0.9375rem' }}>
                  Open Owner Panel
                </button>
              </form>
            )}

            {/* TAB 2: STYLIST STATION */}
            {activeTab === 'stylist' && (
              <form onSubmit={handleStylistSubmit} className="animate-fade">
                <div className="form-group">
                  <label className="form-label">Select Your Profile</label>
                  <select 
                    className="form-select"
                    value={selectedStylistId}
                    onChange={(e) => setSelectedStylistId(e.target.value)}
                    required
                    disabled={availableStaff.length === 0}
                  >
                    {availableStaff.length > 0 ? (
                      availableStaff.map(st => (
                        <option key={st.id} value={st.id}>{st.name}</option>
                      ))
                    ) : (
                      <option value="">No stylists registered</option>
                    )}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Station Access PIN</label>
                  <input
                    type="password"
                    maxLength={4}
                    className="form-control"
                    placeholder="••••"
                    value={stationPin}
                    onChange={(e) => setStationPin(e.target.value.replace(/\D/g, ''))}
                    required
                    style={{ letterSpacing: '0.5em', textAlign: 'center', fontSize: '1.25rem' }}
                  />
                </div>

                <button type="submit" className="btn btn-primary btn-block btn-lg" style={{ marginTop: '1.5rem', fontSize: '0.9375rem' }}>
                  Unlock Stylist Workspace
                </button>
              </form>
            )}
          </>
        ) : (
          /* FORGOT MODE */
          <form onSubmit={handleResetSubmit} className="animate-fade">
            {!resetSent ? (
              <>
                <div className="form-group">
                  <label className="form-label">Registered Owner Email</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="owner@example.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-block btn-lg" style={{ marginTop: '1rem' }}>
                  Send Password Reset Link
                </button>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: '50%', background: 'var(--success-soft)', color: 'var(--success-color)', marginBottom: '1rem' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.5rem' }}>Reset Link Dispatched</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', lineHeight: '1.5', marginBottom: '1.5rem' }}>
                  We've sent reset instructions to <strong>{resetEmail}</strong>.
                </p>
              </div>
            )}
            
            <button 
              type="button" 
              className="btn btn-secondary btn-block btn-sm" 
              style={{ marginTop: '1rem' }} 
              onClick={() => { setForgotMode(false); setResetSent(false); }}
            >
              Back to Login
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
