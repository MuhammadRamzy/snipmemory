"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '../../context/AppContext';

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { plans, signupSalon } = useApp();

  const [salonName, setSalonName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('growth');
  const [billingInterval, setBillingInterval] = useState('monthly');
  const [error, setError] = useState('');

  useEffect(() => {
    const planParam = searchParams.get('plan');
    const intervalParam = searchParams.get('interval');
    if (planParam && plans.some(p => p.id === planParam)) {
      setSelectedPlan(planParam);
    }
    if (intervalParam === 'monthly' || intervalParam === 'annual') {
      setBillingInterval(intervalParam);
    }
  }, [searchParams, plans]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!salonName || !ownerName || !email || !mobileNumber || !password) {
      setError('Please fill in all fields.');
      return;
    }

    try {
      signupSalon(salonName, ownerName, email, mobileNumber, password, selectedPlan, billingInterval);
      router.push('/checkout');
    } catch (err) {
      setError(err.message || 'An error occurred during signup.');
    }
  };

  return (
    <div className="flex-center" style={{ minHeight: '100vh', padding: '2rem' }}>
      <div className="card card-premium animate-slide" style={{ maxWidth: '500px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className="logo-brand" style={{ justifyContent: 'center', marginBottom: '0.5rem' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--accent-color)' }}>
              <path d="M4 22V4c0-.5.2-1 .6-1.4C5 2.2 5.5 2 6 2h12c.5 0 1 .2 1.4.6.4.4.6.9.6 1.4v18l-8-4-8 4z" />
            </svg>
            Snip<span>Memory</span>
          </div>
          <h2 style={{ fontSize: '1.5rem' }}>Create Salon Account</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Start your 14-day free trial. No charge until trial ends.
          </p>
        </div>

        {error && (
          <div style={{ background: 'var(--error-soft)', color: 'var(--error-color)', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.875rem', fontWeight: '500' }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Barbershop / Salon Name</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Classic Cuts & Shaves"
              value={salonName}
              onChange={(e) => setSalonName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Owner's Full Name</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Marcus Vance"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Work Email</label>
              <input
                type="email"
                className="form-control"
                placeholder="owner@salon.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Mobile Number</label>
              <input
                type="tel"
                className="form-control"
                placeholder="+1 (555) 000-0000"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="Min 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-row" style={{ marginTop: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label">Select Plan</label>
              <select
                className="form-select"
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value)}
              >
                {plans.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Billing Cycle</label>
              <select
                className="form-select"
                value={billingInterval}
                onChange={(e) => setBillingInterval(e.target.value)}
              >
                <option value="monthly">Monthly</option>
                <option value="annual">Annual (Save 20%)</option>
              </select>
            </div>
          </div>

          <div style={{ margin: '1.5rem 0', padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div className="flex-between">
              <div>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Selected Plan:</span>
                <span style={{ display: 'block', fontWeight: '700', fontSize: '1rem' }}>
                  {plans.find(p => p.id === selectedPlan)?.name} ({billingInterval})
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Due now:</span>
                <span style={{ display: 'block', fontWeight: '800', fontSize: '1.25rem', color: 'var(--accent-color)' }}>
                  $0.00 <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                    ${billingInterval === 'annual' 
                      ? Math.round(plans.find(p => p.id === selectedPlan)?.priceAnnual / 12) 
                      : plans.find(p => p.id === selectedPlan)?.priceMonthly}/mo
                  </span>
                </span>
              </div>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-block btn-lg" style={{ marginTop: '1rem' }}>
            Continue to Checkout
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <button className="btn-text" style={{ padding: 0, font: 'inherit', color: 'var(--accent-color)', cursor: 'pointer' }} onClick={() => router.push('/login')}>
            Log In
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div style={{ color: 'var(--text-secondary)' }}>Loading registration form...</div>
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}
