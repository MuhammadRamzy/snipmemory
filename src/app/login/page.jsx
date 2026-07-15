"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../../context/AppContext';

export default function Login() {
  const router = useRouter();
  const { loginSalon, setSalonMode, salons, staff } = useApp();

  const [activeTab, setActiveTab] = useState('owner'); // 'owner' | 'stylist'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Stylist login states
  const [selectedSalonId, setSelectedSalonId] = useState('');
  const [selectedStylistId, setSelectedStylistId] = useState('');
  const [stationPin, setStationPin] = useState('');

  // Forgot password states
  const [forgotMode, setForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  // Filter salons that are active/trial
  const availableSalons = salons ? salons.filter(s => s.subscriptionStatus !== 'Cancelled') : [];

  // Filter staff based on selected salon
  const availableStaff = staff ? staff.filter(st => st.salonId === selectedSalonId) : [];

  // Auto-select first salon/staff when list changes
  useEffect(() => {
    if (availableSalons.length > 0 && !selectedSalonId) {
      setSelectedSalonId(availableSalons[0].id);
    }
  }, [availableSalons, selectedSalonId]);

  useEffect(() => {
    if (availableStaff.length > 0) {
      setSelectedStylistId(availableStaff[0].id);
    } else {
      setSelectedStylistId('');
    }
  }, [availableStaff]);

  const handleOwnerSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter your credentials.');
      return;
    }

    try {
      const logged = loginSalon(email, password);
      // Direct owners straight to dashboard
      setSalonMode('dashboard');
      router.push('/app/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed.');
    }
  };

  const handleStylistSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!selectedSalonId || !stationPin) {
      setError('Please select a salon and enter the station access PIN.');
      return;
    }

    // Accept standard demo PINs 1234 or 0000
    if (stationPin !== '1234' && stationPin !== '0000') {
      setError('Invalid station access PIN code.');
      return;
    }

    const salon = availableSalons.find(s => s.id === selectedSalonId);
    if (!salon) {
      setError('Selected salon not found.');
      return;
    }

    try {
      // Simulate stylist logging into the station session
      loginSalon(salon.email, salon.password);
      setSalonMode('barber');
      router.push('/app/barber');
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
          <div className="logo-brand" style={{ justifyContent: 'center', marginBottom: '0.5rem' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--accent-color)' }}>
              <path d="M4 22V4c0-.5.2-1 .6-1.4C5 2.2 5.5 2 6 2h12c.5 0 1 .2 1.4.6.4.4.6.9.6 1.4v18l-8-4-8 4z" />
            </svg>
            Snip<span>Memory</span>
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>
            {forgotMode ? 'Recover Account' : 'Salon Workspace Access'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginTop: '0.25rem' }}>
            Select portal entry pathway
          </p>
        </div>

        {error && (
          <div style={{ background: 'var(--error-soft)', color: 'var(--error-color)', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.8125rem', fontWeight: '600' }}>
            ⚠️ {error}
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
                💼 Owner Console
              </button>
              <button
                className={`btn btn-sm ${activeTab === 'stylist' ? 'btn-primary' : 'btn-text'}`}
                style={{ flex: 1, borderRadius: '6px', fontSize: '0.8125rem', padding: '0.5rem 0' }}
                onClick={() => { setActiveTab('stylist'); setError(''); }}
              >
                💈 Stylist Station
              </button>
            </div>

            {/* TAB 1: OWNER CONSOLE */}
            {activeTab === 'owner' && (
              <form onSubmit={handleOwnerSubmit} className="animate-fade">
                <div className="form-group">
                  <label className="form-label">Owner Email or Mobile</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="owner@classiccuts.com"
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
                  Enter Administrative Console
                </button>
              </form>
            )}

            {/* TAB 2: STYLIST STATION */}
            {activeTab === 'stylist' && (
              <form onSubmit={handleStylistSubmit} className="animate-fade">
                <div className="form-group">
                  <label className="form-label">Select Salon Shop</label>
                  <select 
                    className="form-select"
                    value={selectedSalonId}
                    onChange={(e) => setSelectedSalonId(e.target.value)}
                    required
                  >
                    {availableSalons.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Select Stylist Profile</label>
                  <select 
                    className="form-select"
                    value={selectedStylistId}
                    onChange={(e) => setSelectedStylistId(e.target.value)}
                    required
                    disabled={!selectedSalonId || availableStaff.length === 0}
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
                  Unlock Barber Station
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
                    placeholder="owner@classiccuts.com"
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
              className="btn btn-secondary btn-block" 
              style={{ marginTop: '1rem' }}
              onClick={() => {
                setForgotMode(false);
                setResetSent(false);
                setResetEmail('');
              }}
            >
              Back to Login
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          Don't have a shop account?{' '}
          <button className="btn-text" style={{ padding: 0, font: 'inherit', color: 'var(--accent-color)', cursor: 'pointer' }} onClick={() => router.push('/signup')}>
            Start Free Trial
          </button>
        </div>
      </div>
    </div>
  );
}
