"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useApp } from '../../context/AppContext';

export default function SalonLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentSalon, salonMode, setSalonMode, logout, announcement } = useApp();
  
  const [showPinGate, setShowPinGate] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    // Wait for the context to load from localStorage before redirecting
    // But since this runs only on the client, checking currentSalon is safe.
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('snipmem_current_salon');
      if (!stored && !currentSalon) {
        router.push('/login');
      }
    }
  }, [currentSalon, router]);

  if (!currentSalon) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div className="animate-fade" style={{ color: 'var(--text-secondary)' }}>Loading salon workspace...</div>
      </div>
    );
  }

  const handleModeToggle = () => {
    if (salonMode === 'barber') {
      setShowPinGate(true);
      setPinInput('');
      setPinError('');
    } else {
      setSalonMode('barber');
      router.push('/app/barber');
    }
  };

  const verifyPin = (e) => {
    e.preventDefault();
    if (pinInput === '1234' || pinInput === '0000') {
      setSalonMode('owner');
      setShowPinGate(false);
      router.push('/app/dashboard');
    } else {
      setPinError('Invalid PIN code. Access denied. (Use 1234 for demo)');
    }
  };

  return (
    <div className="salon-layout">
      {/* 1. Global Announcement Banner */}
      {announcement.active && (
        <div className="announcement-banner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span>{announcement.text}</span>
        </div>
      )}

      {/* 2. Past Due Subscription Alert */}
      {currentSalon.subscriptionStatus === 'PastDue' && (
        <div className="past-due-banner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span>
            Subscription Past Due. Please update payment credentials in Owner settings. Core tools remain accessible for a 7-day grace period.
          </span>
        </div>
      )}

      {/* 3. Header Nav */}
      <header className="salon-header">
        <div className="container flex-between" style={{ padding: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="logo-brand" style={{ fontSize: '1.25rem' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--accent-color)' }}>
                <path d="M4 22V4c0-.5.2-1 .6-1.4C5 2.2 5.5 2 6 2h12c.5 0 1 .2 1.4.6.4.4.6.9.6 1.4v18l-8-4-8 4z" />
              </svg>
              Snip<span>Memory</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>|</span>
              <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>{currentSalon.name}</span>
              <span className={`badge ${
                currentSalon.subscriptionStatus === 'Active' ? 'badge-active' : 
                currentSalon.subscriptionStatus === 'Trial' ? 'badge-trial' : 'badge-pastdue'
              }`} style={{ scale: '0.85' }}>
                {currentSalon.subscriptionStatus}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Owner Navigation Links (Visible only in owner mode) */}
            {salonMode === 'owner' && (
              <nav style={{ display: 'flex', gap: '0.5rem', marginRight: '1rem' }} className="owner-sub-nav">
                <button 
                  className={`btn btn-sm ${pathname === '/app/dashboard' ? 'btn-primary' : 'btn-text'}`}
                  onClick={() => router.push('/app/dashboard')}
                >
                  Metrics
                </button>
                <button 
                  className={`btn btn-sm ${pathname === '/app/clients' ? 'btn-primary' : 'btn-text'}`}
                  onClick={() => router.push('/app/clients')}
                >
                  Clients
                </button>
                <button 
                  className={`btn btn-sm ${pathname === '/app/reminders' ? 'btn-primary' : 'btn-text'}`}
                  onClick={() => router.push('/app/reminders')}
                >
                  Reminders
                </button>
                <button 
                  className={`btn btn-sm ${pathname === '/app/settings' ? 'btn-primary' : 'btn-text'}`}
                  onClick={() => router.push('/app/settings')}
                >
                  Settings
                </button>
              </nav>
            )}

            {/* Mode Switcher */}
            <button className="btn btn-secondary btn-sm" onClick={handleModeToggle} style={{ display: 'flex', gap: '0.25rem' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              <span>{salonMode === 'barber' ? 'Stylist Mode' : 'Owner Panel'}</span>
            </button>

            <button className="btn btn-text btn-sm" onClick={() => { logout(); router.push('/'); }} style={{ color: 'var(--error-color)' }}>
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* 4. Main workspace area */}
      <main className="salon-content animate-fade">
        {children}
      </main>

      {/* PIN Gate modal for Owner mode access */}
      {showPinGate && (
        <div className="modal-backdrop">
          <div className="modal-content animate-slide" style={{ maxWidth: '360px' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', textAlign: 'center' }}>Enter Owner PIN</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem', textAlign: 'center' }}>
              Verification required to access settings and billing records.
            </p>

            {pinError && (
              <div style={{ background: 'var(--error-soft)', color: 'var(--error-color)', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', marginBottom: '1rem', textAlign: 'center' }}>
                {pinError}
              </div>
            )}

            <form onSubmit={verifyPin}>
              <div className="form-group">
                <input
                  type="password"
                  className="form-control"
                  placeholder="Owner PIN (e.g. 1234)"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').substring(0, 4))}
                  autoFocus
                  style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5em', padding: '0.75rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary btn-block" onClick={() => setShowPinGate(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-block">
                  Authorize
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
