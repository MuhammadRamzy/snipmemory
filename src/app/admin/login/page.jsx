"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../../../context/AppContext';

export default function AdminLogin() {
  const router = useRouter();
  const { loginAdmin } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in both admin credential fields.');
      return;
    }

    try {
      loginAdmin(email, password);
      router.push('/admin');
    } catch (err) {
      setError(err.message || 'Access Denied.');
    }
  };

  return (
    <div className="flex-center" style={{ minHeight: '100vh', padding: '2rem', background: '#09090b' }}>
      <div className="card card-premium animate-slide" style={{ maxWidth: '400px', width: '100%', borderTop: '4px solid var(--accent-color)' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div className="logo-brand" style={{ justifyContent: 'center', marginBottom: '0.75rem' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--accent-color)' }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Snip<span>Admin</span>
          </div>
          <h2 style={{ fontSize: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
            Platform operator terminal
          </h2>
        </div>

        {error && (
          <div style={{ background: 'var(--error-soft)', color: 'var(--error-color)', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.875rem', fontWeight: '500', textAlign: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{marginRight: '6px', verticalAlign: 'middle', display: 'inline-block'}}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>{error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Operator Email</label>
            <input
              type="email"
              className="form-control"
              placeholder="admin@snipmemory.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ background: '#121216' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Security Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ background: '#121216' }}
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block btn-lg" style={{ marginTop: '1.5rem', letterSpacing: '0.05em' }}>
            Initialize Admin Session
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <button 
            type="button" 
            className="btn btn-secondary btn-sm"
            onClick={() => router.push('/')}
            style={{ fontSize: '0.8125rem' }}
          >
            &larr; Return to Public Site
          </button>
        </div>

        {/* Demo Tip */}
        <div style={{ marginTop: '1.5rem', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', border: '1px solid var(--border-color)' }}>
          [Info] Demo credentials: <strong>admin@snipmemory.com</strong> / <strong>admin</strong>
        </div>

      </div>
    </div>
  );
}
