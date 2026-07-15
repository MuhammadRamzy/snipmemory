"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../../context/AppContext';

export default function Checkout() {
  const router = useRouter();
  const { tempSignup, plans, completeCheckout } = useApp();

  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('card'); // 'card' or 'upi'
  const [upiId, setUpiId] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  // Redirect if no registration draft found
  useEffect(() => {
    if (!tempSignup) {
      router.push('/signup');
    }
  }, [tempSignup, router]);

  if (!tempSignup) return null;

  const activePlan = plans.find(p => p.id === tempSignup.planId);
  const price = tempSignup.billingInterval === 'annual' 
    ? activePlan?.priceAnnual 
    : activePlan?.priceMonthly;

  const handlePaymentSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (paymentMethod === 'card' && (!cardNumber || !expiry || !cvv || !cardName)) {
      setError('Please fill in all credit card details.');
      return;
    }
    if (paymentMethod === 'upi' && !upiId) {
      setError('Please enter your UPI ID.');
      return;
    }

    setProcessing(true);
    // Simulate API delay
    setTimeout(() => {
      try {
        completeCheckout({
          method: paymentMethod,
          cardName
        });
        setProcessing(false);
        router.push('/onboarding');
      } catch (err) {
        setProcessing(false);
        setError(err.message || 'Payment simulation failed.');
      }
    }, 1500);
  };

  return (
    <div className="flex-center" style={{ minHeight: '100vh', padding: '2rem' }}>
      <div className="card card-premium animate-slide" style={{ maxWidth: '600px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className="logo-brand" style={{ justifyContent: 'center', marginBottom: '0.5rem' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--accent-color)' }}>
              <path d="M4 22V4c0-.5.2-1 .6-1.4C5 2.2 5.5 2 6 2h12c.5 0 1 .2 1.4.6.4.4.6.9.6 1.4v18l-8-4-8 4z" />
            </svg>
            Snip<span>Memory</span>
          </div>
          <h2 style={{ fontSize: '1.5rem' }}>Secure Checkout</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Set up your subscription. Trial active for 14 days.
          </p>
        </div>

        <div className="grid-2" style={{ gap: '2rem', gridTemplateColumns: '1.2fr 0.8fr' }}>
          {/* Form Side */}
          <div>
            <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Payment Method</h3>
            
            {/* Payment type toggle */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <button 
                type="button"
                className={`btn btn-sm btn-block ${paymentMethod === 'card' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPaymentMethod('card')}
                style={{ flex: 1 }}
              >
                Credit Card
              </button>
              <button 
                type="button"
                className={`btn btn-sm btn-block ${paymentMethod === 'upi' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPaymentMethod('upi')}
                style={{ flex: 1 }}
              >
                UPI ID
              </button>
            </div>

            {error && (
              <div style={{ background: 'var(--error-soft)', color: 'var(--error-color)', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.875rem' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{marginRight: '6px', verticalAlign: 'middle', display: 'inline-block'}}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>{error}
              </div>
            )}

            <form onSubmit={handlePaymentSubmit}>
              {paymentMethod === 'card' ? (
                <>
                  <div className="form-group">
                    <label className="form-label">Name on Card</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Marcus Vance"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      disabled={processing}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Card Number</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="4111 2222 3333 4444"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').substring(0, 16))}
                      disabled={processing}
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Expiration</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="MM/YY"
                        value={expiry}
                        onChange={(e) => setExpiry(e.target.value.substring(0, 5))}
                        disabled={processing}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">CVV</label>
                      <input
                        type="password"
                        className="form-control"
                        placeholder="123"
                        value={cvv}
                        onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').substring(0, 4))}
                        disabled={processing}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="form-group">
                  <label className="form-label">UPI Address</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="name@upi"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    disabled={processing}
                  />
                </div>
              )}

              <button 
                type="submit" 
                className="btn btn-primary btn-block btn-lg" 
                style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center' }}
                disabled={processing}
              >
                {processing ? (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="spin-loader" style={{ animation: 'spin-anim 1s linear infinite' }}><circle cx="12" cy="12" r="10" strokeDasharray="40 10"/></svg>
                    Processing...
                  </>
                ) : (
                  `Start Subscription`
                )}
              </button>
            </form>
          </div>

          {/* Details Side */}
          <div style={{ background: 'var(--bg-tertiary)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)', height: 'fit-content' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>Plan Summary</h3>
            <div style={{ fontWeight: '700', fontSize: '1.125rem' }}>{activePlan?.name}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Billed {tempSignup.billingInterval}</div>
            
            <hr style={{ borderColor: 'var(--border-color)', margin: '1rem 0' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
              <div className="flex-between">
                <span style={{ color: 'var(--text-secondary)' }}>Subscription Plan:</span>
                <span>${tempSignup.billingInterval === 'annual' ? activePlan?.priceAnnual : activePlan?.priceMonthly}</span>
              </div>
              <div className="flex-between">
                <span style={{ color: 'var(--text-secondary)' }}>14-Day Free Trial:</span>
                <span style={{ color: 'var(--success-color)' }}>Active</span>
              </div>
              <div className="flex-between">
                <span style={{ color: 'var(--text-secondary)' }}>Due today:</span>
                <span style={{ color: 'var(--accent-color)', fontWeight: '700' }}>$0.00</span>
              </div>
            </div>

            <hr style={{ borderColor: 'var(--border-color)', margin: '1rem 0' }} />

            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              You will not be charged during your 14-day free trial. If you do not cancel before then, you will be billed ${price} {tempSignup.billingInterval === 'annual' ? 'yearly' : 'monthly'} starting on {new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString()}.
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes spin-anim {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
