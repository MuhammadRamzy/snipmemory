"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../context/AppContext';

export default function LandingPage() {
  const router = useRouter();
  const { plans } = useApp();
  const [billingInterval, setBillingInterval] = useState('monthly');
  const [activeFaq, setActiveFaq] = useState(null);

  // Interactive Live Simulator States
  const [simStep, setSimStep] = useState(1); // 1: Search, 2: Profile, 3: Camera Blur Demo
  const [simPhone, setSimPhone] = useState('');
  const [simFaceBlurred, setSimFaceBlurred] = useState(false);
  const [simSuccessMsg, setSimSuccessMsg] = useState('');

  // Simulate typing effect on mount
  useEffect(() => {
    if (simStep === 1) {
      setSimPhone('');
      const targetPhone = '(206) 555-0100';
      let currentIdx = 0;
      const interval = setInterval(() => {
        if (currentIdx < targetPhone.length) {
          setSimPhone(prev => prev + targetPhone[currentIdx]);
          currentIdx++;
        } else {
          clearInterval(interval);
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [simStep]);

  const toggleFaq = (index) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  const selectPlan = (planId) => {
    router.push(`/signup?plan=${planId}&interval=${billingInterval}`);
  };

  const faqs = [
    {
      question: "How does the haircut photo capture work in a busy shop?",
      answer: "It takes less than 15 seconds. Barbers take four quick photos (Front, Left, Right, Back) on any tablet or smartphone, write a quick style note (e.g. Fade, Trim), and save. Next time the client comes in, just type their mobile number to see exactly how they like it."
    },
    {
      question: "Do I need to install anything from the App Store?",
      answer: "No. SnipMemory is a Progressive Web App (PWA). You just open it in your tablet or phone's web browser, and you can add it directly to your home screen. It works on iOS, Android, iPads, and desktop computers."
    },
    {
      question: "How do WhatsApp reminders get sent?",
      answer: "Based on each client's average visit cadence (or your default salon setting), clients who are due for a haircut will appear on your dashboard. With one tap, you can preview and send a pre-formatted reminder template. The platform handles the message draft for quick sending."
    },
    {
      question: "Can I manage multiple staff members or stations?",
      answer: "Yes. Our Growth and Pro plans allow you to add your entire staff roster. Barbers can select their name when saving a cut so you can track visits and style consistency across the shop."
    }
  ];

  return (
    <div className="animate-fade" style={{ background: 'var(--bg-primary)', minHeight: '100vh', position: 'relative', overflowX: 'hidden' }}>
      
      {/* Decorative Glowing Spotlights */}
      <div style={{ position: 'absolute', top: '-10%', left: '30%', width: '400px', height: '400px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.08)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', top: '40%', right: '-10%', width: '350px', height: '350px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.06)', filter: 'blur(70px)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Frosted Glass Navigation Header */}
      <header className="marketing-header" style={{ position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid var(--border-color)', background: 'rgba(9, 10, 15, 0.8)', backdropFilter: 'blur(12px)' }}>
        <div className="container flex-between" style={{ padding: '0.75rem 1.5rem' }}>
          <div className="logo-brand">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--accent-color)'}}>
              <path d="M4 22V4c0-.5.2-1 .6-1.4C5 2.2 5.5 2 6 2h12c.5 0 1 .2 1.4.6.4.4.6.9.6 1.4v18l-8-4-8 4z"/>
            </svg>
            Snip<span>Memory</span>
          </div>
          <nav className="nav-links" style={{ gap: '1.5rem' }}>
            <a href="#features" className="nav-link" style={{ fontSize: '0.9375rem' }}>Features</a>
            <a href="#pricing" className="nav-link" style={{ fontSize: '0.9375rem' }}>Pricing</a>
            <a href="#faq" className="nav-link" style={{ fontSize: '0.9375rem' }}>FAQ</a>
            <button className="btn btn-secondary btn-sm" onClick={() => router.push('/discovery')} style={{ borderColor: 'var(--accent-color)', color: 'var(--accent-color)' }}>Search Salons</button>
            <button className="btn btn-secondary btn-sm" onClick={() => router.push('/login')}>Salon Login</button>
            <button className="btn btn-primary btn-sm" onClick={() => router.push('/signup')}>Start Trial</button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero" style={{ padding: '5rem 0 3rem 0', position: 'relative', zIndex: 1 }}>
        <div className="container grid-2" style={{ alignItems: 'center', maxWidth: '1200px' }}>
          
          {/* Hero Left Content */}
          <div style={{ textAlign: 'left' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--accent-soft)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '0.35rem 0.85rem', borderRadius: '50px', marginBottom: '1.5rem', fontSize: '0.8125rem', color: 'var(--accent-text)', fontWeight: '600' }}>
              ✂️ The Salon Stylist & Owner Workspace
            </div>
            <h1 style={{ fontSize: '3rem', lineHeight: '1.15', marginBottom: '1.5rem', fontWeight: '800', background: 'linear-gradient(135deg, #ffffff 0%, #a1a1aa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.03em' }}>
              Never forget a haircut. Recreate styles perfectly.
            </h1>
            <p style={{ fontSize: '1.125rem', color: 'var(--text-secondary)', marginBottom: '2.5rem', lineHeight: '1.6' }}>
              The high-performance B2B reference database for modern barbershops. Archive client styling preferences, visual 4-angle captures, and coordinate smart retention reminders in seconds.
            </p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button className="btn btn-primary btn-lg" onClick={() => router.push('/signup')}>Start 14-Day Free Trial</button>
              <button className="btn btn-secondary btn-lg" onClick={() => router.push('/discovery')}>Search Local Salons</button>
            </div>
          </div>

          {/* Hero Right: Live Interactive Mobile App Simulator */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div 
              style={{ 
                width: '320px', 
                height: '560px', 
                background: '#090a0f', 
                border: '10px solid #1f2937', 
                borderRadius: '36px', 
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(99, 102, 241, 0.15)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                position: 'relative'
              }}
            >
              {/* Phone Speaker & Camera Notch */}
              <div style={{ position: 'absolute', top: '0', left: '50%', transform: 'translateX(-50%)', width: '100px', height: '18px', background: '#1f2937', borderRadius: '0 0 12px 12px', zIndex: 20 }} />

              {/* Simulated App Header */}
              <div style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', padding: '1.25rem 1rem 0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--accent-text)' }}>💈 SNIP STATION</span>
                <span style={{ fontSize: '0.625rem', background: 'var(--success-soft)', color: 'var(--success-color)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: '700' }}>Active Station</span>
              </div>

              {/* Simulated App Content Body */}
              <div style={{ flex: 1, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto' }}>
                
                {simStep === 1 && (
                  <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center', flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem' }}>🔍</div>
                    <div>
                      <strong style={{ fontSize: '0.875rem', display: 'block', marginBottom: '0.25rem' }}>Client Database Search</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Type number to fetch cut specs</span>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <input 
                        type="text" 
                        className="form-control" 
                        readOnly 
                        value={simPhone}
                        style={{ textAlign: 'center', background: 'var(--bg-tertiary)', border: '1px solid var(--border-focus)', fontSize: '0.9375rem', fontWeight: '600' }}
                      />
                    </div>

                    <button 
                      type="button"
                      className="btn btn-primary btn-block btn-sm"
                      onClick={() => setSimStep(2)}
                      style={{ marginTop: '0.5rem' }}
                    >
                      Search Roster
                    </button>
                  </div>
                )}

                {simStep === 2 && (
                  <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {/* Client Header */}
                    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.75rem', textAlign: 'left' }}>
                      <div className="flex-between">
                        <strong style={{ fontSize: '0.875rem' }}>Alexander Wright</strong>
                        <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>ID: #9901</span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>(206) 555-0100</span>
                      
                      {/* Specs Tags */}
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                        <span style={{ fontSize: '0.625rem', padding: '0.15rem 0.35rem', background: 'var(--accent-soft)', color: 'var(--accent-text)', borderRadius: '4px' }}>#LowFade</span>
                        <span style={{ fontSize: '0.625rem', padding: '0.15rem 0.35rem', background: 'var(--accent-soft)', color: 'var(--accent-text)', borderRadius: '4px' }}>#Quiff</span>
                        <span style={{ fontSize: '0.625rem', padding: '0.15rem 0.35rem', background: 'var(--accent-soft)', color: 'var(--accent-text)', borderRadius: '4px' }}>#Lineup</span>
                      </div>
                    </div>

                    {/* Cut visual list */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                      <div style={{ position: 'relative', aspectRatio: '1/1', background: 'var(--bg-tertiary)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: simFaceBlurred ? 'repeating-conic-gradient(#555 0% 25%, #666 0% 50%) 50% / 12px 12px' : 'none' }}>
                          {!simFaceBlurred && <span style={{ fontSize: '1.25rem' }}>👨</span>}
                        </div>
                        <span style={{ position: 'absolute', bottom: '0.25rem', left: '0.25rem', fontSize: '0.625rem', background: 'rgba(0,0,0,0.6)', padding: '0.1rem 0.3rem', borderRadius: '2px' }}>Front</span>
                      </div>
                      <div style={{ position: 'relative', aspectRatio: '1/1', background: 'var(--bg-tertiary)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '1.25rem' }}>💇‍♂️</span>
                        <span style={{ position: 'absolute', bottom: '0.25rem', left: '0.25rem', fontSize: '0.625rem', background: 'rgba(0,0,0,0.6)', padding: '0.1rem 0.3rem', borderRadius: '2px' }}>Left Profile</span>
                      </div>
                    </div>

                    <div style={{ background: 'var(--bg-secondary)', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'left' }}>
                      <strong>Stylist Note:</strong> Low fade with number 2 guard on sides. Leave textured quiff on top.
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <button className="btn btn-secondary btn-block btn-sm" onClick={() => setSimStep(1)}>
                        Back
                      </button>
                      <button className="btn btn-primary btn-block btn-sm" onClick={() => setSimStep(3)}>
                        Verify Camera
                      </button>
                    </div>
                  </div>
                )}

                {simStep === 3 && (
                  <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, justifyContent: 'center' }}>
                    <strong style={{ fontSize: '0.875rem' }}>Stylist Camera Pipeline</strong>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                      Try the dynamic pixelation face mask used for privacy settings.
                    </p>

                    <div 
                      style={{ 
                        aspectRatio: '1.3/1', 
                        background: '#000', 
                        borderRadius: '6px', 
                        border: '1px solid var(--border-focus)', 
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden'
                      }}
                    >
                      {/* SVG Outline Overlay */}
                      <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', stroke: 'rgba(99, 102, 241, 0.4)', fill: 'none', strokeWidth: '0.5', pointerEvents: 'none' }}>
                        <ellipse cx="50" cy="45" rx="20" ry="26" />
                        <line x1="50" y1="10" x2="50" y2="80" strokeDasharray="2" />
                      </svg>

                      {/* Mock Client portrait */}
                      <div 
                        style={{ 
                          width: '40px', 
                          height: '40px', 
                          borderRadius: '50%', 
                          background: simFaceBlurred ? 'repeating-conic-gradient(#333 0% 25%, #888 0% 50%) 50% / 6px 6px' : 'var(--accent-color)', 
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s'
                        }}
                      >
                        {!simFaceBlurred && <span style={{ fontSize: '1rem' }}>😊</span>}
                      </div>
                    </div>

                    <div className="flex-between" style={{ background: 'var(--bg-secondary)', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.75rem' }}>Face Blur Active</span>
                      <input 
                        type="checkbox" 
                        checked={simFaceBlurred}
                        onChange={(e) => setSimFaceBlurred(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                    </div>

                    <button 
                      className="btn btn-primary btn-block btn-sm"
                      onClick={() => {
                        setSimSuccessMsg('Photo saved to R2 vault!');
                        setTimeout(() => setSimSuccessMsg(''), 2000);
                        setSimStep(2);
                      }}
                    >
                      Capture Snapshot
                    </button>
                    <button className="btn btn-secondary btn-block btn-sm" onClick={() => setSimStep(2)}>
                      Back
                    </button>
                  </div>
                )}

              </div>

              {/* Sim Success Toast */}
              {simSuccessMsg && (
                <div style={{ position: 'absolute', bottom: '1rem', left: '1rem', right: '1rem', background: 'var(--success-color)', color: '#fff', fontSize: '0.75rem', fontWeight: '700', padding: '0.5rem', borderRadius: '4px', textAlign: 'center', zIndex: 30 }} className="animate-slide">
                  ✅ {simSuccessMsg}
                </div>
              )}
            </div>
          </div>

        </div>
      </section>

      {/* How it Works */}
      <section id="features" style={{padding: '5rem 0', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)'}}>
        <div className="container">
          <div style={{textAlign: 'center', marginBottom: '4rem'}}>
            <h2 style={{fontSize: '2.25rem', marginBottom: '1rem'}}>Say Goodbye to Memory Guesswork</h2>
            <p style={{color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto'}}>
              Deliver consistent styling quality, build unmatched client trust, and drive repeat visits automatically.
            </p>
          </div>
          
          <div className="grid-3">
            <div className="card" style={{padding: '2rem'}}>
              <div style={{display: 'inline-flex', padding: '0.75rem', borderRadius: '12px', background: 'var(--accent-soft)', color: 'var(--accent-color)', marginBottom: '1.25rem'}}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              </div>
              <h3 style={{fontSize: '1.25rem', marginBottom: '0.75rem'}}>1. Capture Reference Photos</h3>
              <p style={{color: 'var(--text-secondary)', fontSize: '0.9375rem'}}>
                Take 4 quick reference photos (Front, Left, Right, Back) on any device. Note down specific details like guard lengths or hair products used.
              </p>
            </div>

            <div className="card" style={{padding: '2rem'}}>
              <div style={{display: 'inline-flex', padding: '0.75rem', borderRadius: '12px', background: 'var(--accent-soft)', color: 'var(--accent-color)', marginBottom: '1.25rem'}}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>
              <h3 style={{fontSize: '1.25rem', marginBottom: '0.75rem'}}>2. Retrieve Instantly Next Visit</h3>
              <p style={{color: 'var(--text-secondary)', fontSize: '0.9375rem'}}>
                When the client returns, search their mobile number. Instantly display their entire chronological cut history to replicate the style perfectly.
              </p>
            </div>

            <div className="card" style={{padding: '2rem'}}>
              <div style={{display: 'inline-flex', padding: '0.75rem', borderRadius: '12px', background: 'var(--accent-soft)', color: 'var(--accent-color)', marginBottom: '1.25rem'}}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
              <h3 style={{fontSize: '1.25rem', marginBottom: '0.75rem'}}>3. Retain with Smart Reminders</h3>
              <p style={{color: 'var(--text-secondary)', fontSize: '0.9375rem'}}>
                Identify clients overdue for a haircut. Send personalized booking reminder links on WhatsApp with a single tap, increasing monthly revenue.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" style={{padding: '5rem 0'}}>
        <div className="container">
          <div style={{textAlign: 'center', marginBottom: '3rem'}}>
            <h2 style={{fontSize: '2.25rem', marginBottom: '1rem'}}>Simple, Transparent Pricing</h2>
            <p style={{color: 'var(--text-secondary)', marginBottom: '2rem'}}>
              Choose the plan that fits your shop. Start free for 14 days, cancel anytime.
            </p>
            
            {/* Interval Toggle */}
            <div className="flex-center" style={{gap: '1rem', background: 'var(--bg-secondary)', padding: '0.35rem', borderRadius: '50px', display: 'inline-flex', border: '1px solid var(--border-color)'}}>
              <button
                className={`btn btn-sm ${billingInterval === 'monthly' ? 'btn-primary' : 'btn-text'}`}
                onClick={() => setBillingInterval('monthly')}
                style={{borderRadius: '50px', padding: '0.5rem 1.25rem'}}
              >
                Monthly Billing
              </button>
              <button
                className={`btn btn-sm ${billingInterval === 'annual' ? 'btn-primary' : 'btn-text'}`}
                onClick={() => setBillingInterval('annual')}
                style={{borderRadius: '50px', padding: '0.5rem 1.25rem'}}
              >
                Annual (Save 20%)
              </button>
            </div>
          </div>

          <div className="grid-3" style={{alignItems: 'stretch'}}>
            {plans.map((plan) => {
              const price = billingInterval === 'annual' ? Math.round(plan.priceAnnual / 12) : plan.priceMonthly;
              
              return (
                <div key={plan.id} className={`card ${plan.id === 'growth' ? 'card-premium' : ''}`} style={{display: 'flex', flexDirection: 'column', justifyContent: 'between'}}>
                  <div>
                    {plan.id === 'growth' && (
                      <div style={{position: 'absolute', top: '1rem', right: '1rem', background: 'var(--accent-color)', color: '#fff', padding: '0.25rem 0.75rem', borderRadius: '50px', fontSize: '0.75rem', fontWeight: '700'}}>
                        POPULAR
                      </div>
                    )}
                    <h3 style={{fontSize: '1.5rem', marginBottom: '0.5rem'}}>{plan.name}</h3>
                    <div style={{display: 'flex', alignItems: 'baseline', gap: '0.25rem', marginBottom: '1.5rem'}}>
                      <span style={{fontSize: '2.5rem', fontWeight: '800'}}>${price}</span>
                      <span style={{color: 'var(--text-secondary)'}}>/month</span>
                      {billingInterval === 'annual' && (
                        <span style={{fontSize: '0.8125rem', color: 'var(--success-color)', marginLeft: '0.5rem', fontWeight: '600'}}>Billed Annually</span>
                      )}
                    </div>
                    
                    <hr style={{borderColor: 'var(--border-color)', margin: '1rem 0'}} />
                    
                    <ul style={{listStyle: 'none', padding: 0, margin: '1.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
                      {plan.features.map((feature, idx) => (
                        <li key={idx} style={{display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9375rem'}}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{color: 'var(--success-color)'}}><polyline points="20 6 9 17 4 12"/></svg>
                          <span style={{color: 'var(--text-secondary)'}}>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <button 
                    className={`btn ${plan.id === 'growth' ? 'btn-primary' : 'btn-secondary'} btn-block`} 
                    style={{marginTop: 'auto'}}
                    onClick={() => selectPlan(plan.id)}
                  >
                    Start 14-Day Trial
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" style={{padding: '5rem 0', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)'}}>
        <div className="container" style={{maxWidth: '800px'}}>
          <div style={{textAlign: 'center', marginBottom: '3rem'}}>
            <h2 style={{fontSize: '2.25rem', marginBottom: '1rem'}}>Frequently Asked Questions</h2>
            <p style={{color: 'var(--text-secondary)'}}>
              Got questions? We've got answers.
            </p>
          </div>

          <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
            {faqs.map((faq, index) => (
              <div 
                key={index} 
                style={{
                  background: 'var(--bg-primary)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '12px', 
                  overflow: 'hidden',
                  cursor: 'pointer'
                }}
                onClick={() => toggleFaq(index)}
              >
                <div className="flex-between" style={{padding: '1.25rem 1.5rem', fontWeight: '600'}}>
                  <span>{faq.question}</span>
                  <span style={{color: 'var(--accent-color)', fontSize: '1.25rem', transform: activeFaq === index ? 'rotate(45deg)' : 'none', transition: 'transform var(--transition-fast)'}}>+</span>
                </div>
                {activeFaq === index && (
                  <div style={{padding: '0 1.5rem 1.5rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: '1.6'}}>
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{padding: '4rem 0 2rem 0', borderTop: '1px solid var(--border-color)', background: 'var(--bg-primary)'}}>
        <div className="container flex-between" style={{flexWrap: 'wrap', gap: '2rem'}}>
          <div>
            <div className="logo-brand" style={{marginBottom: '1rem'}}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{color: 'var(--accent-color)'}}>
                <path d="M4 22V4c0-.5.2-1 .6-1.4C5 2.2 5.5 2 6 2h12c.5 0 1 .2 1.4.6.4.4.6.9.6 1.4v18l-8-4-8 4z"/>
              </svg>
              Snip<span>Memory</span>
            </div>
            <p style={{color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: '300px'}}>
              Premium reference photo vault and automated customer retention reminders for modern barbershops.
            </p>
          </div>
          <div style={{display: 'flex', gap: '4rem'}}>
            <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
              <h4 style={{fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-primary)'}}>Product</h4>
              <a href="#features" style={{color: 'var(--text-secondary)', fontSize: '0.875rem'}}>Features</a>
              <a href="#pricing" style={{color: 'var(--text-secondary)', fontSize: '0.875rem'}}>Pricing</a>
              <a href="#faq" style={{color: 'var(--text-secondary)', fontSize: '0.875rem'}}>FAQ</a>
            </div>
            <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
              <h4 style={{fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-primary)'}}>Operator</h4>
              <button onClick={() => router.push('/admin/login')} style={{background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.875rem', cursor: 'pointer', textDecoration: 'none', textAlign: 'left'}}>
                Admin Portal
              </button>
              <a href="#/" style={{color: 'var(--text-secondary)', fontSize: '0.875rem'}}>Terms of Service</a>
              <a href="#/" style={{color: 'var(--text-secondary)', fontSize: '0.875rem'}}>Privacy Policy</a>
            </div>
          </div>
        </div>
        <div className="container" style={{marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem'}}>
          &copy; {new Date().getFullYear()} SnipMemory. All rights reserved. Made for professional styling shops.
        </div>
      </footer>
    </div>
  );
}
