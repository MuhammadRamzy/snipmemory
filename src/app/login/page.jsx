"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../../context/AppContext';

export default function Login() {
  const router = useRouter();
  const { loginSalon } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  // Forgot password views
  const [forgotMode, setForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter your email/mobile and password.');
      return;
    }

    try {
      loginSalon(email, password);
      router.push('/app/barber');
    } catch (err) {
      setError(err.message || 'Login failed.');
    }
  };

  const handleResetSubmit = (e) => {
    e.preventDefault();
    if (!resetEmail) return;
    setResetSent(true);
  };

  const handleDemoAccess = (demoEmail) => {
    try {
      loginSalon(demoEmail, 'password123');
      router.push('/app/barber');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex-center" style={{ minHeight: '100vh', padding: '2rem' }}>
      <div className="card card-premium animate-slide" style={{ maxWidth: '420px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className="logo-brand" style={{ justifyContent: 'center', marginBottom: '0.5rem' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--accent-color)' }}>
              <path d="M4 22V4c0-.5.2-1 .6-1.4C5 2.2 5.5 2 6 2h12c.5 0 1 .2 1.4.6.4.4.6.9.6 1.4v18l-8-4-8 4z" />
            </svg>
            Snip<span>Memory</span>
          </div>
          <h2 style={{ fontSize: '1.5rem' }}>
            {forgotMode ? 'Reset Password' : 'Salon Portal Login'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            {forgotMode ? 'Recover your account details' : 'Access your barber station tools'}
          </p>
        </div>

        {error && (
          <div style={{ background: 'var(--error-soft)', color: 'var(--error-color)', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.875rem', fontWeight: '500' }}>
            ⚠️ {error}
          </div>
        )}

        {!forgotMode ? (
          /* Standard Login Form */
          <form onSubmit={handleLoginSubmit}>
            <div className="form-group">
              <label className="form-label">Email or Mobile Number</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. owner@classiccuts.com"
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

            <button type="submit" className="btn btn-primary btn-block btn-lg" style={{ marginTop: '1.5rem' }}>
              Log In to Station
            </button>

            {/* Quick Demo Logins Helper */}
            <div style={{ marginTop: '2rem', padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <span style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.75rem', fontWeight: '600' }}>
                Demo Shortcuts (Prototype Seed)
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary btn-sm" 
                  style={{ justifyContent: 'space-between', width: '100%', fontSize: '0.8125rem' }}
                  onClick={() => handleDemoAccess('owner@classiccuts.com')}
                >
                  <span>Classic Cuts (Active Pro)</span>
                  <span style={{ color: 'var(--success-color)' }}>Active &rarr;</span>
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary btn-sm" 
                  style={{ justifyContent: 'space-between', width: '100%', fontSize: '0.8125rem' }}
                  onClick={() => handleDemoAccess('owner@goldenscissors.com')}
                >
                  <span>Golden Scissors (PastDue)</span>
                  <span style={{ color: 'var(--warning-color)' }}>PastDue &rarr;</span>
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* Forgot Password Mock Form */
          <form onSubmit={handleResetSubmit}>
            {!resetSent ? (
              <>
                <div className="form-group">
                  <label className="form-label">Registered Email</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="e.g. owner@classiccuts.com"
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
              <div style={{ textAlign: 'center', padding: '1rem 0' }} className="animate-fade">
                <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: '50%', background: 'var(--success-soft)', color: 'var(--success-color)', marginBottom: '1rem' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <h3 style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>Reset Link Dispatched</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: '1.5', marginBottom: '1.5rem' }}>
                  We've sent an email to <strong>{resetEmail}</strong> containing credentials reset instructions. No real delivery occurs in prototype.
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

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Don't have a shop account?{' '}
          <button className="btn-text" style={{ padding: 0, font: 'inherit', color: 'var(--accent-color)', cursor: 'pointer' }} onClick={() => router.push('/signup')}>
            Start Free Trial
          </button>
        </div>
      </div>
    </div>
  );
}
