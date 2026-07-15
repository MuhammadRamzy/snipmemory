"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../context/AppContext';

export default function LandingPage() {
  const router = useRouter();
  const { plans, customers, visits, salons, staff } = useApp();
  
  const [billingInterval, setBillingInterval] = useState('monthly');
  const [activeFaq, setActiveFaq] = useState(null);

  // Live Simulator States
  const [simStep, setSimStep] = useState(1); // 1: Search, 2: Profile, 3: Camera
  const [simPhone, setSimPhone] = useState('');
  const [simFaceBlurred, setSimFaceBlurred] = useState(false);
  const [simSuccessMsg, setSimSuccessMsg] = useState('');

  // Feature Showcase tabs
  const [activeFeatureTab, setActiveFeatureTab] = useState('camera'); // 'camera' | 'reminders' | 'discovery'

  // Interactive Pricing Slider State
  const [stylistCount, setStylistCount] = useState(3);

  // Client History Portal States
  const [clientPhone, setClientPhone] = useState('');
  const [clientOtp, setClientOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [clientVerified, setClientVerified] = useState(false);
  const [clientCustomerRecord, setClientCustomerRecord] = useState(null);
  const [clientVisits, setClientVisits] = useState([]);
  const [clientError, setClientError] = useState('');
  const [clientSuccessMsg, setClientSuccessMsg] = useState('');

  // Live Activity Ticker Log State
  const [tickerLogs, setTickerLogs] = useState([
    { id: 1, time: 'Just now', event: 'Classic Cuts & Shaves captured 4-angle alignment for David K.' },
    { id: 2, time: '2m ago', event: 'The Fade Laboratory dispatched automated WhatsApp follow-up.' },
    { id: 3, time: '5m ago', event: 'Stylist Alexander registered new customer style tag #low-taper' }
  ]);

  // Typing simulator effect
  useEffect(() => {
    if (simStep === 1) {
      setSimPhone('');
      const targetPhone = '(206) 555-0123';
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

  // Rotate ticker logs to simulate real-time operations
  useEffect(() => {
    const eventsPool = [
      'Gold Scissors adjusted default client cadence to 21 Days.',
      'Classic Cuts & Shaves added new styling tag #mid-drop-fade.',
      'Vance Barber Shop completed checkout for Pro Subscription.',
      'The Fade Laboratory verified styling index transfer via OTP.',
      'Stylist Samantha saved quiff details for client Michael S.',
      'Metropolitan Trim uploaded Front alignment view with face blur.'
    ];

    const interval = setInterval(() => {
      const randomEvent = eventsPool[Math.floor(Math.random() * eventsPool.length)];
      setTickerLogs(prev => [
        { id: Date.now(), time: 'Just now', event: randomEvent },
        ...prev.map(item => ({
          ...item,
          time: item.time === 'Just now' ? '1m ago' : item.time === '1m ago' ? '3m ago' : '7m ago'
        })).slice(0, 2)
      ]);
    }, 4500);

    return () => clearInterval(interval);
  }, []);

  const toggleFaq = (index) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  const selectPlan = (planId) => {
    router.push(`/signup?plan=${planId}&interval=${billingInterval}`);
  };

  // Pricing Recommendation Logic based on Slider
  const getRecommendedPlan = (count) => {
    if (count <= 1) return { id: 'starter', name: 'Starter', price: 29, text: 'Best for independent barbers operating at a single station.' };
    if (count <= 5) return { id: 'growth', name: 'Growth', price: 79, text: 'Perfect for small team setups & automated WhatsApp reminders.' };
    return { id: 'pro', name: 'Pro', price: 149, text: 'Recommended for multi-location networks & high-volume salons.' };
  };

  const recommended = getRecommendedPlan(stylistCount);

  // Client History Lookup Handlers
  const handleClientPhoneSubmit = (e) => {
    e.preventDefault();
    setClientError('');
    setClientSuccessMsg('');
    const normalized = clientPhone.replace(/\D/g, '');
    if (!normalized) {
      setClientError('Please enter a valid mobile number.');
      return;
    }
    // Match against active customer records
    const found = customers.find(c => c.mobileNumber.replace(/\D/g, '') === normalized);
    if (!found) {
      setClientError('No styling record found for this mobile number. Try seed phone: 2065550123');
      return;
    }
    setClientCustomerRecord(found);
    setOtpSent(true);
    setClientSuccessMsg('Demo OTP code sent! Use bypass code: 123456');
  };

  const handleClientOtpVerify = (e) => {
    e.preventDefault();
    setClientError('');
    setClientSuccessMsg('');
    if (clientOtp !== '123456') {
      setClientError('Invalid OTP code. Enter bypass code 123456 for testing.');
      return;
    }
    // Load historical visits
    const foundVisits = visits.filter(v => v.customerId === clientCustomerRecord.id);
    // Sort visits chronologically
    const sorted = [...foundVisits].sort((a, b) => new Date(b.date) - new Date(a.date));
    setClientVisits(sorted);
    setClientVerified(true);
  };

  const handleClientLogout = () => {
    setClientPhone('');
    setClientOtp('');
    setOtpSent(false);
    setClientVerified(false);
    setClientCustomerRecord(null);
    setClientVisits([]);
    setClientError('');
    setClientSuccessMsg('');
  };

  const getSalonName = (salonId) => {
    const s = salons.find(item => item.id === salonId);
    return s ? s.name : 'Professional Salon';
  };

  const getStylistName = (staffId) => {
    const st = staff.find(item => item.id === staffId);
    return st ? st.name : 'Master Stylist';
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
    <div className="animate-fade" style={{ background: '#07080c', minHeight: '100vh', position: 'relative', overflowX: 'hidden', color: '#f3f4f6' }}>
      
      {/* Dynamic Spotlights */}
      <div className="spotlight spotlight-left" style={{ position: 'absolute', top: '-10%', left: '10%', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
      <div className="spotlight spotlight-right" style={{ position: 'absolute', top: '35%', right: '-10%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(236, 72, 153, 0.08) 0%, transparent 70%)', filter: 'blur(90px)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Navigation Header */}
      <header className="marketing-header" style={{ position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(7, 8, 12, 0.75)', backdropFilter: 'blur(16px)' }}>
        <div className="container flex-between" style={{ padding: '0.85rem 1.5rem' }}>
          <div className="logo-brand" style={{ cursor: 'pointer' }} onClick={() => router.push('/')}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{color: '#6366f1'}}>
              <path d="M4 22V4c0-.5.2-1 .6-1.4C5 2.2 5.5 2 6 2h12c.5 0 1 .2 1.4.6.4.4.6.9.6 1.4v18l-8-4-8 4z"/>
            </svg>
            Snip<span style={{ color: '#fff' }}>Memory</span>
          </div>
          <nav className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: '1.75rem' }}>
            <a href="#features" className="nav-link" style={{ fontSize: '0.9375rem', color: '#9ca3af' }}>Features</a>
            <a href="#client-portal" className="nav-link" style={{ fontSize: '0.9375rem', color: '#9ca3af' }}>My Haircut History</a>
            <a href="#calculator" className="nav-link" style={{ fontSize: '0.9375rem', color: '#9ca3af' }}>Estimate Plan</a>
            <a href="#pricing" className="nav-link" style={{ fontSize: '0.9375rem', color: '#9ca3af' }}>Pricing</a>
            <a href="#faq" className="nav-link" style={{ fontSize: '0.9375rem', color: '#9ca3af' }}>FAQ</a>
            <button className="btn btn-secondary btn-sm" onClick={() => router.push('/discovery')} style={{ borderColor: '#6366f1', color: '#818cf8', background: 'rgba(99, 102, 241, 0.08)' }}>Search Salons</button>
            <button className="btn btn-primary btn-sm" onClick={() => router.push('/signup')} style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', border: 'none' }}>Start Trial &rarr;</button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero" style={{ padding: '5.5rem 0 4rem 0', position: 'relative', zIndex: 1 }}>
        <div className="container grid-2" style={{ alignItems: 'center', maxWidth: '1200px', gap: '3rem' }}>
          
          {/* Hero Left Content */}
          <div style={{ textAlign: 'left' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.25)', padding: '0.4rem 0.95rem', borderRadius: '50px', marginBottom: '1.75rem', fontSize: '0.8125rem', color: '#a5b4fc', fontWeight: '600' }}>
              <span style={{ display: 'inline-block', width: '6px', height: '6px', background: '#10b981', borderRadius: '50%', marginRight: '4px' }}></span>
              Double-Sided Styling Network
            </div>
            
            <h1 style={{ fontSize: '3.35rem', lineHeight: '1.12', marginBottom: '1.25rem', fontWeight: '800', background: 'linear-gradient(135deg, #ffffff 30%, #94a3b8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.03em' }}>
              Style consistency for salons. History log for clients.
            </h1>
            
            <p style={{ fontSize: '1.125rem', color: '#94a3b8', marginBottom: '2.5rem', lineHeight: '1.6', maxWidth: '520px' }}>
              The high-performance B2B reference database for salons coupled with a secure B2C personal haircut timeline search engine for style-conscious clients.
            </p>
            
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button className="btn btn-primary btn-lg" onClick={() => router.push('/signup')} style={{ padding: '0.95rem 2rem', fontSize: '1rem', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', border: 'none' }}>
                Start 14-Day Free Trial
              </button>
              <a href="#client-portal" className="btn btn-secondary btn-lg" style={{ padding: '0.95rem 2rem', fontSize: '1rem' }}>
                Retrieve My Haircut History
              </a>
            </div>

            {/* Live Operational Ticker */}
            <div style={{ marginTop: '3.5rem', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700', display: 'block', marginBottom: '0.75rem' }}>
                Live Network Operations
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {tickerLogs.map(log => (
                  <div key={log.id} className="animate-slide" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8125rem', color: '#94a3b8' }}>
                    <span style={{ color: '#6366f1', fontFamily: 'monospace', fontSize: '0.75rem' }}>{log.time}</span>
                    <span style={{ width: '4px', height: '4px', background: 'rgba(255,255,255,0.3)', borderRadius: '50%' }}></span>
                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{log.event}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Hero Right: Live Interactive Tablet Simulator Mockup */}
          <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '10%', left: '10%', right: '10%', bottom: '10%', background: 'rgba(99, 102, 241, 0.2)', filter: 'blur(60px)', zIndex: 0 }} />

            <div 
              className="device-frame"
              style={{ 
                width: '325px', 
                height: '570px', 
                background: '#090a0f', 
                border: '12px solid #1e293b', 
                borderRadius: '40px', 
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 50px rgba(99, 102, 241, 0.2)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                position: 'relative',
                zIndex: 1
              }}
            >
              {/* Device Camera Notch */}
              <div style={{ position: 'absolute', top: '0', left: '50%', transform: 'translateX(-50%)', width: '120px', height: '18px', background: '#1e293b', borderRadius: '0 0 14px 14px', zIndex: 20 }} />

              {/* Simulated App Header */}
              <div style={{ background: '#111219', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '1.35rem 1rem 0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '800', letterSpacing: '0.05em', color: '#6366f1' }}>SNIP SYSTEM</span>
                <span style={{ fontSize: '0.625rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: '700' }}>Active Station</span>
              </div>

              {/* Simulated App Body */}
              <div style={{ flex: 1, padding: '1.25rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', overflowY: 'auto' }}>
                
                {simStep === 1 && (
                  <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', justifyContent: 'center', flex: 1, textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', alignSelf: 'center', padding: '0.95rem', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }}>
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    </div>
                    <div>
                      <strong style={{ fontSize: '0.9375rem', display: 'block', marginBottom: '0.35rem' }}>Client Database Search</strong>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Type phone number to load cut specs</span>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <input 
                        type="text" 
                        className="form-control" 
                        readOnly 
                        value={simPhone}
                        style={{ textAlign: 'center', background: '#161722', border: '1px solid #6366f1', fontSize: '0.95rem', fontWeight: '600', color: '#fff' }}
                      />
                    </div>

                    <button 
                      type="button"
                      className="btn btn-primary btn-block btn-sm"
                      onClick={() => setSimStep(2)}
                      style={{ marginTop: '0.5rem', background: '#6366f1' }}
                    >
                      Locate Styling Profile
                    </button>
                  </div>
                )}

                {simStep === 2 && (
                  <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {/* Client Header Info */}
                    <div style={{ background: '#111219', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '0.85rem', textAlign: 'left' }}>
                      <div className="flex-between">
                        <strong style={{ fontSize: '0.875rem', color: '#fff' }}>Alexander Wright</strong>
                        <span style={{ fontSize: '0.625rem', color: '#64748b' }}>#9901</span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>(206) 555-0100</span>
                      
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
                        <span style={{ fontSize: '0.625rem', padding: '0.2rem 0.4rem', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', borderRadius: '4px' }}>#LowFade</span>
                        <span style={{ fontSize: '0.625rem', padding: '0.2rem 0.4rem', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', borderRadius: '4px' }}>#Quiff</span>
                        <span style={{ fontSize: '0.625rem', padding: '0.2rem 0.4rem', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', borderRadius: '4px' }}>#Lineup</span>
                      </div>
                    </div>

                    {/* Cut visual profiles grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                      <div style={{ position: 'relative', aspectRatio: '1/1', background: '#111219', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: simFaceBlurred ? 'repeating-conic-gradient(#27273a 0% 25%, #1e1e2f 0% 50%) 50% / 12px 12px' : 'none' }}>
                          {!simFaceBlurred && (
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{color: '#6366f1'}}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                          )}
                        </div>
                        <span style={{ position: 'absolute', bottom: '0.35rem', left: '0.35rem', fontSize: '0.625rem', background: 'rgba(0,0,0,0.7)', padding: '0.15rem 0.35rem', borderRadius: '4px' }}>Front</span>
                      </div>
                      
                      <div style={{ position: 'relative', aspectRatio: '1/1', background: '#111219', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{color: '#6366f1'}}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        <span style={{ position: 'absolute', bottom: '0.35rem', left: '0.35rem', fontSize: '0.625rem', background: 'rgba(0,0,0,0.7)', padding: '0.15rem 0.35rem', borderRadius: '4px' }}>Left Side</span>
                      </div>
                    </div>

                    <div style={{ background: '#161722', padding: '0.75rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)', fontSize: '0.75rem', color: '#94a3b8', textAlign: 'left' }}>
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
                  <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', flex: 1, justifyContent: 'center' }}>
                    <strong style={{ fontSize: '0.9375rem', color: '#fff' }}>Stylist Camera Viewfinder</strong>
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>
                      Try the dynamic face mask pixelation used for client privacy settings.
                    </p>

                    <div 
                      style={{ 
                        aspectRatio: '1.3/1', 
                        background: '#040406', 
                        borderRadius: '8px', 
                        border: '1px solid #6366f1', 
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden'
                      }}
                    >
                      {/* SVG Outline overlay */}
                      <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', stroke: 'rgba(99, 102, 241, 0.4)', fill: 'none', strokeWidth: '0.6', pointerEvents: 'none' }}>
                        <ellipse cx="50" cy="45" rx="18" ry="24" />
                        <line x1="50" y1="10" x2="50" y2="80" strokeDasharray="3" />
                      </svg>

                      {/* Mock client head */}
                      <div 
                        style={{ 
                          width: '45px', 
                          height: '45px', 
                          borderRadius: '50%', 
                          background: simFaceBlurred ? 'repeating-conic-gradient(#222 0% 25%, #4f46e5 0% 50%) 50% / 6px 6px' : '#6366f1', 
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s'
                        }}
                      >
                        {!simFaceBlurred && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{color: '#fff'}}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
                      </div>
                    </div>

                    <div className="flex-between" style={{ background: '#111219', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Face Blur Active</span>
                      <input 
                        type="checkbox" 
                        checked={simFaceBlurred}
                        onChange={(e) => setSimFaceBlurred(e.target.checked)}
                        style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#6366f1' }}
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

              {/* Toast notifier */}
              {simSuccessMsg && (
                <div style={{ position: 'absolute', bottom: '1.25rem', left: '1rem', right: '1rem', background: '#10b981', color: '#fff', fontSize: '0.75rem', fontWeight: '700', padding: '0.55rem', borderRadius: '6px', textAlign: 'center', zIndex: 30 }} className="animate-slide">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{marginRight: '6px', verticalAlign: 'middle', display: 'inline-block'}}><polyline points="20 6 9 17 4 12"/></svg>
                  {simSuccessMsg}
                </div>
              )}
            </div>

          </div>

        </div>
      </section>

      {/* --- CLIENT PORTAL (STYLE HISTORY LOOKUP) SECTION --- */}
      <section id="client-portal" style={{ padding: '6.5rem 0', background: '#0b0c13', borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="container" style={{ maxWidth: '900px' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#6366f1', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Client Portal Access</span>
            <h2 style={{ fontSize: '2.5rem', fontWeight: '800', letterSpacing: '-0.02em', marginTop: '0.25rem' }}>Retrieve Your Style Reference History</h2>
            <p style={{ color: '#94a3b8', fontSize: '1rem', marginTop: '0.5rem', maxWidth: '500px', margin: '0.5rem auto 0 auto' }}>
              Instantly view your past style outlines, custom lengths, and dates logged across any SnipMemory-powered barbershop.
            </p>
          </div>

          <div className="card" style={{ background: '#11121c', padding: '2.5rem', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
            
            {clientError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 'bold' }}>⚠️</span> {clientError}
              </div>
            )}

            {clientSuccessMsg && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                {clientSuccessMsg}
              </div>
            )}

            {/* Authentication Gateway */}
            {!clientVerified ? (
              <div style={{ maxWidth: '480px', margin: '0 auto' }}>
                {!otpSent ? (
                  <form onSubmit={handleClientPhoneSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ color: '#cbd5e1' }}>Register / Mobile Number</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="e.g. 2065550123" 
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        required
                        style={{ background: '#090a0f', borderColor: 'rgba(255,255,255,0.1)', padding: '0.85rem' }}
                      />
                      <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginTop: '0.35rem' }}>
                        Hint: Use seed number <strong>2065550123</strong> to test the demo profile history lookup.
                      </span>
                    </div>

                    <button type="submit" className="btn btn-primary btn-block" style={{ padding: '0.85rem' }}>
                      Request Access Passcode
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleClientOtpVerify} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '1rem', borderRadius: '8px', fontSize: '0.8125rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                      <strong>Demo Bypass:</strong> A mock SMS OTP has been generated for client verification. Type <strong>123456</strong> to retrieve Alexander's styling timeline.
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ color: '#cbd5e1' }}>Enter 6-Digit Verification Code</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="e.g. 123456" 
                        value={clientOtp}
                        onChange={(e) => setClientOtp(e.target.value)}
                        maxLength={6}
                        required
                        style={{ background: '#090a0f', borderColor: 'rgba(255,255,255,0.1)', textAlign: 'center', letterSpacing: '0.25em', fontSize: '1.25rem', padding: '0.75rem' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="button" className="btn btn-secondary btn-block" onClick={() => setOtpSent(false)}>
                        Change Phone
                      </button>
                      <button type="submit" className="btn btn-primary btn-block">
                        Verify & Load History
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              /* Verified Client Timeline display */
              <div className="animate-fade">
                <div className="flex-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '1.25rem', marginBottom: '2rem' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700' }}>Active Session</span>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '800', margin: '0.25rem 0 0 0', color: '#fff' }}>{clientCustomerRecord.name}</h3>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={handleClientLogout}>
                    Logout Profile
                  </button>
                </div>

                {clientVisits.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', position: 'relative' }}>
                    
                    {/* Vertical connector line */}
                    <div style={{ position: 'absolute', top: '10px', bottom: '10px', left: '16px', width: '2px', background: 'rgba(99, 102, 241, 0.15)', zIndex: 0 }} />

                    {clientVisits.map((visit, index) => (
                      <div key={visit.id} className="animate-slide" style={{ display: 'flex', gap: '1.5rem', position: 'relative', zIndex: 1 }}>
                        
                        {/* Circle node indicator */}
                        <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#6366f1', border: '6px solid #11121c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ width: '6px', height: '6px', background: '#fff', borderRadius: '50%' }}></span>
                        </div>

                        {/* Card details */}
                        <div style={{ flex: 1, background: '#090a0f', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1.5rem' }}>
                          <div className="flex-between" style={{ flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                            <div>
                              <strong style={{ fontSize: '1rem', color: '#fff' }}>{getSalonName(visit.salonId)}</strong>
                              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginTop: '0.15rem' }}>
                                Handled by stylist: <strong>{getStylistName(visit.staffId)}</strong>
                              </span>
                            </div>
                            <span style={{ fontSize: '0.8125rem', color: '#cbd5e1', background: 'rgba(255,255,255,0.05)', padding: '0.25rem 0.65rem', borderRadius: '50px' }}>
                              {new Date(visit.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                            </span>
                          </div>

                          <div style={{ background: '#111219', border: '1px solid rgba(255,255,255,0.04)', padding: '0.85rem 1rem', borderRadius: '8px', fontSize: '0.875rem', color: '#cbd5e1', marginBottom: '1.25rem' }}>
                            <strong>Barber Notes:</strong> {visit.note}
                          </div>

                          {/* 4-Angle captures */}
                          <div>
                            <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700', display: 'block', marginBottom: '0.75rem' }}>
                              Visual Cut Alignment Guides
                            </span>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.75rem' }}>
                              {Object.entries(visit.photos || {}).map(([angle, svgContent]) => (
                                <div key={angle} style={{ background: '#111219', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '0.5rem', textAlign: 'center' }}>
                                  <div 
                                    style={{ width: '100%', aspectRatio: '1/1', overflow: 'hidden', borderRadius: '6px', marginBottom: '0.4rem' }}
                                    dangerouslySetInnerHTML={{ __html: svgContent }}
                                  />
                                  <span style={{ fontSize: '0.6875rem', color: '#cbd5e1', textTransform: 'capitalize', fontWeight: '500' }}>
                                    {angle} Profile
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Style Tags */}
                          {visit.styleTags && visit.styleTags.length > 0 && (
                            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '1.25rem' }}>
                              {visit.styleTags.map(tag => (
                                <span key={tag} style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: 'rgba(99, 102, 241, 0.12)', color: '#a5b4fc', borderRadius: '4px', border: '1px solid rgba(99, 102, 241, 0.15)' }}>
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}

                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                    No visit details have been logged yet for your profile. Check back after your next styling appointment!
                  </div>
                )}

              </div>
            )}

          </div>

        </div>
      </section>

      {/* Dynamic Feature Switcher Showcase */}
      <section id="features" style={{ padding: '6rem 0', background: '#07080c' }}>
        <div className="container" style={{ maxWidth: '1000px' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <h2 style={{ fontSize: '2.5rem', fontWeight: '800', letterSpacing: '-0.02em' }}>Built Specifically for Professional Salons</h2>
            <p style={{ color: '#94a3b8', maxWidth: '550px', margin: '0.5rem auto 0 auto', fontSize: '1rem' }}>
              Eliminate memory guesswork. Replicate styles consistently and drive client retention with ease.
            </p>
          </div>

          {/* Interactive Showcase Tabs */}
          <div className="flex-center" style={{ gap: '1rem', marginBottom: '3rem', flexWrap: 'wrap' }}>
            <button 
              className={`btn btn-sm ${activeFeatureTab === 'camera' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveFeatureTab('camera')}
              style={{ borderRadius: '50px', padding: '0.55rem 1.35rem', fontSize: '0.875rem' }}
            >
              Precision 4-Angle Camera
            </button>
            <button 
              className={`btn btn-sm ${activeFeatureTab === 'reminders' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveFeatureTab('reminders')}
              style={{ borderRadius: '50px', padding: '0.55rem 1.35rem', fontSize: '0.875rem' }}
            >
              WhatsApp Retention Reminders
            </button>
            <button 
              className={`btn btn-sm ${activeFeatureTab === 'discovery' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveFeatureTab('discovery')}
              style={{ borderRadius: '50px', padding: '0.55rem 1.35rem', fontSize: '0.875rem' }}
            >
              Public discovery Platform
            </button>
          </div>

          {/* Feature Showcase Box */}
          <div className="card" style={{ background: '#11121c', padding: '2.5rem', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem', alignItems: 'center' }}>
            
            {activeFeatureTab === 'camera' && (
              <>
                <div className="animate-fade" style={{ textAlign: 'left' }}>
                  <span style={{ fontSize: '0.75rem', color: '#6366f1', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Visual Reference Library</span>
                  <h3 style={{ fontSize: '1.75rem', fontWeight: '800', margin: '0.5rem 0' }}>Capture perfection in 15 seconds</h3>
                  <p style={{ color: '#94a3b8', fontSize: '0.9375rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                    Barbers photograph clients from four clean angles (Front, Left, Right, Back). Our specialized layout lets stylists overlay alignment grids to verify vertical guide lines. Ensures repeat haircuts look exactly the same.
                  </p>
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', listStyle: 'none', padding: 0 }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#cbd5e1' }}>
                      <span style={{ color: '#10b981' }}>✓</span> Client-side face blur privacy shields.
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#cbd5e1' }}>
                      <span style={{ color: '#10b981' }}>✓</span> Secure Cloudflare R2 image vault storage.
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#cbd5e1' }}>
                      <span style={{ color: '#10b981' }}>✓</span> Instant profile retrieval during styling seat check-in.
                    </li>
                  </ul>
                </div>
                <div className="animate-fade flex-center" style={{ background: '#090a0f', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', padding: '2rem', height: '220px', position: 'relative' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div style={{ width: '60px', height: '80px', background: '#161722', border: '1px solid #6366f1', borderRadius: '6px', position: 'relative' }}>
                      <span style={{ position: 'absolute', bottom: '4px', left: '4px', fontSize: '0.55rem', color: '#94a3b8' }}>Front</span>
                    </div>
                    <div style={{ width: '60px', height: '80px', background: '#161722', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', position: 'relative' }}>
                      <span style={{ position: 'absolute', bottom: '4px', left: '4px', fontSize: '0.55rem', color: '#94a3b8' }}>Left</span>
                    </div>
                    <div style={{ width: '60px', height: '80px', background: '#161722', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', position: 'relative' }}>
                      <span style={{ position: 'absolute', bottom: '4px', left: '4px', fontSize: '0.55rem', color: '#94a3b8' }}>Right</span>
                    </div>
                    <div style={{ width: '60px', height: '80px', background: '#161722', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', position: 'relative' }}>
                      <span style={{ position: 'absolute', bottom: '4px', left: '4px', fontSize: '0.55rem', color: '#94a3b8' }}>Back</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeFeatureTab === 'reminders' && (
              <>
                <div className="animate-fade" style={{ textAlign: 'left' }}>
                  <span style={{ fontSize: '0.75rem', color: '#ec4899', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Smart Retention Engine</span>
                  <h3 style={{ fontSize: '1.75rem', fontWeight: '800', margin: '0.5rem 0' }}>Automated WhatsApp dispatch</h3>
                  <p style={{ color: '#94a3b8', fontSize: '0.9375rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                    SnipMemory monitors customer styling dates. When clients cross their average visit frequency (e.g. 3 weeks), they appear in your retention log. Draft custom message templates and dispatch them directly via WhatsApp.
                  </p>
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', listStyle: 'none', padding: 0 }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#cbd5e1' }}>
                      <span style={{ color: '#10b981' }}>✓</span> Direct click-to-chat integration.
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#cbd5e1' }}>
                      <span style={{ color: '#10b981' }}>✓</span> Custom retention templates per barber shop.
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#cbd5e1' }}>
                      <span style={{ color: '#10b981' }}>✓</span> Dashboard analytics showing returned clients.
                    </li>
                  </ul>
                </div>
                <div className="animate-fade flex-center" style={{ background: '#090a0f', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', padding: '1.5rem', height: '220px' }}>
                  <div style={{ width: '100%', maxWidth: '240px', background: '#052e16', borderRadius: '8px', border: '1px solid #14532d', padding: '0.85rem' }}>
                    <span style={{ fontSize: '0.625rem', color: '#a7f3d0', display: 'block', textTransform: 'uppercase', fontWeight: '700' }}>Simulated Message</span>
                    <p style={{ fontSize: '0.75rem', color: '#fff', margin: '0.35rem 0', lineHeight: '1.4' }}>
                      "Hi Liam! It's been 24 days since your last low skin-fade at Classic Cuts. Tap here to book your chair: classiccuts.com/book"
                    </p>
                    <span style={{ fontSize: '0.625rem', color: '#6ee7b7', textAlign: 'right', display: 'block' }}>✓ Sent via SnipReminder</span>
                  </div>
                </div>
              </>
            )}

            {activeFeatureTab === 'discovery' && (
              <>
                <div className="animate-fade" style={{ textAlign: 'left' }}>
                  <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Discovery Network</span>
                  <h3 style={{ fontSize: '1.75rem', fontWeight: '800', margin: '0.5rem 0' }}>Showcase your style authority</h3>
                  <p style={{ color: '#94a3b8', fontSize: '0.9375rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                    Every registered salon joins our public Discovery Map. Clients search their local area, view verified hair stylist profiles, check customer reviews, and browse lookbook styles.
                  </p>
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', listStyle: 'none', padding: 0 }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#cbd5e1' }}>
                      <span style={{ color: '#10b981' }}>✓</span> Real-time stylist team roster displays.
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#cbd5e1' }}>
                      <span style={{ color: '#10b981' }}>✓</span> Simple client feedback review portals.
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#cbd5e1' }}>
                      <span style={{ color: '#10b981' }}>✓</span> Direct private workspace login shortcut modules.
                    </li>
                  </ul>
                </div>
                <div className="animate-fade flex-center" style={{ background: '#090a0f', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', padding: '1.5rem', height: '220px' }}>
                  <div style={{ width: '100%', maxWidth: '240px', background: '#111219', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '0.75rem' }}>
                    <strong style={{ fontSize: '0.875rem', display: 'block' }}>The Fade Laboratory</strong>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>89 Broadway, NY</span>
                    <div style={{ display: 'flex', gap: '4px', marginTop: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#fbbf24' }}>★★★★★</span>
                      <span style={{ fontSize: '0.7rem', color: '#cbd5e1' }}>(18 reviews)</span>
                    </div>
                  </div>
                </div>
              </>
            )}

          </div>

        </div>
      </section>

      {/* Interactive Pricing Estimator */}
      <section id="calculator" style={{ padding: '6rem 0', position: 'relative', background: '#0b0c13' }}>
        <div className="container" style={{ maxWidth: '800px' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#6366f1', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Interactive Estimator</span>
            <h2 style={{ fontSize: '2.5rem', fontWeight: '800', letterSpacing: '-0.02em', marginTop: '0.25rem' }}>Calculate the perfect plan for your team</h2>
            <p style={{ color: '#94a3b8', fontSize: '1rem', marginTop: '0.5rem' }}>
              Drag the slider to set your active stylist stations and see our recommendation.
            </p>
          </div>

          <div className="card" style={{ background: '#11121c', padding: '2.5rem', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
            
            {/* Slider Widget */}
            <div style={{ marginBottom: '2.5rem' }}>
              <div className="flex-between" style={{ marginBottom: '1rem' }}>
                <span style={{ fontWeight: '600', color: '#94a3b8' }}>Active Barbers / Stations:</span>
                <strong style={{ fontSize: '1.75rem', color: '#6366f1' }}>{stylistCount} {stylistCount === 1 ? 'Station' : 'Stations'}</strong>
              </div>
              <input 
                type="range" 
                min="1" 
                max="15" 
                value={stylistCount}
                onChange={(e) => setStylistCount(Number(e.target.value))}
                style={{ width: '100%', height: '8px', background: '#27273a', borderRadius: '5px', outline: 'none', cursor: 'pointer', accentColor: '#6366f1' }}
              />
              <div className="flex-between" style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
                <span>1 Barber</span>
                <span>5 Barbers</span>
                <span>10 Barbers</span>
                <span>15+ Barbers</span>
              </div>
            </div>

            {/* Recommendation Display Box */}
            <div style={{ background: '#090a0f', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.05)', display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.7rem', background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', padding: '0.2rem 0.55rem', borderRadius: '4px', fontWeight: '800', textTransform: 'uppercase' }}>Recommended Plan</span>
                <h4 style={{ fontSize: '1.5rem', fontWeight: '800', margin: '0.5rem 0 0.25rem 0' }}>{recommended.name} Package</h4>
                <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0 }}>{recommended.text}</p>
              </div>
              <div style={{ textAlign: 'right', borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: '2rem' }}>
                <span style={{ fontSize: '2rem', fontWeight: '800', color: '#fff' }}>${recommended.price}</span>
                <span style={{ fontSize: '0.875rem', color: '#64748b' }}>/month</span>
                <button 
                  className="btn btn-primary btn-block btn-sm" 
                  style={{ marginTop: '0.85rem' }}
                  onClick={() => selectPlan(recommended.id)}
                >
                  Choose {recommended.name}
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" style={{ padding: '6rem 0', background: '#07080c' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <h2 style={{ fontSize: '2.5rem', fontWeight: '800', letterSpacing: '-0.02em' }}>Transparent Plans for Every Roster</h2>
            <p style={{ color: '#94a3b8', marginBottom: '2.5rem' }}>
              Start free for 14 days. Billing increments only begin after trial validation.
            </p>
            
            {/* Toggle Switch */}
            <div className="flex-center" style={{ gap: '0.5rem', background: '#111219', padding: '0.35rem', borderRadius: '50px', display: 'inline-flex', border: '1px solid rgba(255,255,255,0.05)' }}>
              <button
                className={`btn btn-sm ${billingInterval === 'monthly' ? 'btn-primary' : 'btn-text'}`}
                onClick={() => setBillingInterval('monthly')}
                style={{ borderRadius: '50px', padding: '0.5rem 1.35rem', fontSize: '0.875rem' }}
              >
                Monthly
              </button>
              <button
                className={`btn btn-sm ${billingInterval === 'annual' ? 'btn-primary' : 'btn-text'}`}
                onClick={() => setBillingInterval('annual')}
                style={{ borderRadius: '50px', padding: '0.5rem 1.35rem', fontSize: '0.875rem' }}
              >
                Annual (20% Off)
              </button>
            </div>
          </div>

          <div className="grid-3" style={{ alignItems: 'stretch', gap: '2rem' }}>
            {plans.map((plan) => {
              const price = billingInterval === 'annual' ? Math.round(plan.priceAnnual / 12) : plan.priceMonthly;
              const isPopular = plan.id === 'growth';
              
              return (
                <div 
                  key={plan.id} 
                  className={`card ${isPopular ? 'card-premium' : ''}`} 
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    justifyContent: 'space-between',
                    background: '#111219',
                    border: isPopular ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '16px',
                    padding: '2.25rem',
                    position: 'relative'
                  }}
                >
                  {isPopular && (
                    <div style={{ position: 'absolute', top: '-12px', right: '1.5rem', background: '#6366f1', color: '#fff', padding: '0.25rem 0.75rem', borderRadius: '50px', fontSize: '0.6875rem', fontWeight: '800', letterSpacing: '0.05em' }}>
                      MOST POPULAR
                    </div>
                  )}
                  
                  <div>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.5rem' }}>{plan.name}</h3>
                    
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem', marginBottom: '1.75rem' }}>
                      <span style={{ fontSize: '2.75rem', fontWeight: '800', color: '#fff' }}>${price}</span>
                      <span style={{ color: '#64748b', fontSize: '0.875rem' }}>/month</span>
                    </div>
                    
                    <hr style={{ borderColor: 'rgba(255,255,255,0.05)', margin: '1.25rem 0' }} />
                    
                    <ul style={{ listStyle: 'none', padding: 0, margin: '1.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      {plan.features.map((feature, idx) => (
                        <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.9rem', color: '#94a3b8' }}>
                          <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <button 
                    className={`btn ${isPopular ? 'btn-primary' : 'btn-secondary'} btn-block`} 
                    style={{ marginTop: 'auto', background: isPopular ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : '' }}
                    onClick={() => selectPlan(plan.id)}
                  >
                    Choose {plan.name} Plan
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section style={{ padding: '6rem 0', background: '#0b0c13' }}>
        <div className="container" style={{ maxWidth: '900px' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#ec4899', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Endorsements</span>
            <h2 style={{ fontSize: '2.5rem', fontWeight: '800', letterSpacing: '-0.02em', marginTop: '0.25rem' }}>Loved by Master Barbers</h2>
          </div>

          <div className="grid-2" style={{ gap: '2rem' }}>
            <div className="card" style={{ background: '#11121c', border: '1px solid rgba(255,255,255,0.05)', padding: '2rem', borderRadius: '16px' }}>
              <div style={{ color: '#fbbf24', fontSize: '1.25rem', marginBottom: '0.75rem' }}>★★★★★</div>
              <p style={{ color: '#cbd5e1', fontSize: '0.9375rem', lineHeight: '1.6', fontStyle: 'italic', marginBottom: '1.25rem' }}>
                "SnipMemory completely changed our consultation process. When clients come back, we search their phone and immediately see the guard size and length notes from last month. Perfect consistency."
              </p>
              <div>
                <strong style={{ display: 'block', fontSize: '0.875rem' }}>Marcus Vance</strong>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Owner, Classic Cuts & Shaves</span>
              </div>
            </div>

            <div className="card" style={{ background: '#11121c', border: '1px solid rgba(255,255,255,0.05)', padding: '2rem', borderRadius: '16px' }}>
              <div style={{ color: '#fbbf24', fontSize: '1.25rem', marginBottom: '0.75rem' }}>★★★★★</div>
              <p style={{ color: '#cbd5e1', fontSize: '0.9375rem', lineHeight: '1.6', fontStyle: 'italic', marginBottom: '1.25rem' }}>
                "We get about 12-15 repeat appointments every single week just by checking who is overdue on the dashboard and tapping reminder. It pays for the Growth plan in the first three days."
              </p>
              <div>
                <strong style={{ display: 'block', fontSize: '0.875rem' }}>Dexter King</strong>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Lead Stylist, The Fade Laboratory</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" style={{ padding: '6rem 0', background: '#07080c', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="container" style={{ maxWidth: '800px' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <h2 style={{ fontSize: '2.5rem', fontWeight: '800', letterSpacing: '-0.02em' }}>Frequently Asked Questions</h2>
            <p style={{ color: '#94a3b8', marginTop: '0.5rem' }}>
              Everything you need to know about the SnipMemory workspace platform.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {faqs.map((faq, index) => (
              <div 
                key={index} 
                style={{
                  background: '#111219', 
                  border: '1px solid rgba(255,255,255,0.05)', 
                  borderRadius: '12px', 
                  overflow: 'hidden',
                  cursor: 'pointer'
                }}
                onClick={() => toggleFaq(index)}
              >
                <div className="flex-between" style={{ padding: '1.35rem 1.5rem', fontWeight: '600', color: '#fff' }}>
                  <span>{faq.question}</span>
                  <span style={{ color: '#6366f1', fontSize: '1.25rem', transform: activeFaq === index ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }}>+</span>
                </div>
                {activeFaq === index && (
                  <div style={{ padding: '0 1.5rem 1.5rem 1.5rem', color: '#cbd5e1', fontSize: '0.9375rem', lineHeight: '1.6', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '1rem' }}>
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '5rem 0 3rem 0', borderTop: '1px solid rgba(255,255,255,0.05)', background: '#07080c' }}>
        <div className="container flex-between" style={{ flexWrap: 'wrap', gap: '2.5rem' }}>
          <div>
            <div className="logo-brand" style={{ marginBottom: '1.25rem' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: '#6366f1' }}>
                <path d="M4 22V4c0-.5.2-1 .6-1.4C5 2.2 5.5 2 6 2h12c.5 0 1 .2 1.4.6.4.4.6.9.6 1.4v18l-8-4-8 4z"/>
              </svg>
              Snip<span style={{ color: '#fff' }}>Memory</span>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.875rem', maxWidth: '320px', lineHeight: '1.5' }}>
              Premium reference photo vault and automated customer retention reminders for modern barbershops.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <h4 style={{ fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94a3b8', fontWeight: '800' }}>Product</h4>
              <a href="#features" style={{ color: '#64748b', fontSize: '0.875rem', transition: 'color 0.2s' }}>Features</a>
              <a href="#pricing" style={{ color: '#64748b', fontSize: '0.875rem', transition: 'color 0.2s' }}>Pricing</a>
              <a href="#faq" style={{ color: '#64748b', fontSize: '0.875rem', transition: 'color 0.2s' }}>FAQ</a>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <h4 style={{ fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.7em', color: '#94a3b8', fontWeight: '800' }}>Operator</h4>
              <button onClick={() => router.push('/admin/login')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.875rem', cursor: 'pointer', textDecoration: 'none', textAlign: 'left', padding: 0 }}>
                Admin Console
              </button>
              <a href="#/" style={{ color: '#64748b', fontSize: '0.875rem' }}>Terms</a>
              <a href="#/" style={{ color: '#64748b', fontSize: '0.875rem' }}>Privacy</a>
            </div>
          </div>
        </div>
        <div className="container" style={{ marginTop: '3.5rem', paddingTop: '1.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center', color: '#475569', fontSize: '0.8125rem' }}>
          &copy; {new Date().getFullYear()} SnipMemory. All rights reserved. Built for professional barbershops and salons.
        </div>
      </footer>
    </div>
  );
}
