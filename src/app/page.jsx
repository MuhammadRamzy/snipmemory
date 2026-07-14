"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../context/AppContext';

export default function LandingPage() {
  const router = useRouter();
  const { plans } = useApp();
  const [billingInterval, setBillingInterval] = useState('monthly');
  const [activeFaq, setActiveFaq] = useState(null);

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
    <div className="animate-fade">
      {/* Navigation */}
      <header className="marketing-header">
        <div className="container flex-between">
          <div className="logo-brand">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--accent-color)'}}>
              <path d="M4 22V4c0-.5.2-1 .6-1.4C5 2.2 5.5 2 6 2h12c.5 0 1 .2 1.4.6.4.4.6.9.6 1.4v18l-8-4-8 4z"/>
            </svg>
            Snip<span>Memory</span>
          </div>
          <nav className="nav-links">
            <a href="#features" className="nav-link">Features</a>
            <a href="#pricing" className="nav-link">Pricing</a>
            <a href="#faq" className="nav-link">FAQ</a>
            <button className="btn btn-secondary btn-sm" onClick={() => router.push('/login')}>Salon Login</button>
            <button className="btn btn-primary btn-sm" onClick={() => router.push('/signup')}>Start Free Trial</button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero">
        <div className="container" style={{maxWidth: '800px'}}>
          <h1>Never forget a haircut again. Say their number, recreate their cut.</h1>
          <p>
            The premium B2B photo database for barbershops and salons. Take reference photos, store style notes, and send automated client retention reminders in seconds.
          </p>
          <div className="flex-center" style={{gap: '1rem'}}>
            <button className="btn btn-primary btn-lg" onClick={() => router.push('/signup')}>Start 14-Day Free Trial</button>
            <a href="#pricing" className="btn btn-secondary btn-lg">View Pricing Plans</a>
          </div>
          <div style={{marginTop: '4rem', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '16px', background: 'rgba(255,255,255,0.01)', boxShadow: 'var(--shadow-premium)'}}>
            <div style={{height: '350px', background: 'var(--bg-secondary)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.05)', position: 'relative'}}>
              <div style={{textAlign: 'center', padding: '2rem'}}>
                <div style={{display: 'inline-flex', padding: '0.75rem', borderRadius: '50%', background: 'var(--accent-soft)', color: 'var(--accent-color)', marginBottom: '1rem'}}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="m10 15 5-3-5-3v6Z"/></svg>
                </div>
                <h3 style={{fontSize: '1.25rem', marginBottom: '0.5rem'}}>See SnipMemory in Action</h3>
                <p style={{color: 'var(--text-secondary)', fontSize: '0.9375rem', maxWidth: '400px', margin: '0 auto 1.5rem auto'}}>
                  Watch how easily barbers can retrieve previous haircuts on a tablet or phone mid-shift.
                </p>
                <button className="btn btn-outline btn-sm" onClick={() => router.push('/login')}>Try Demo Salon Profile</button>
              </div>
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
                      <div style={{position: 'absolute', top: '1rem', right: '1rem', background: 'var(--accent-color)', color: 'var(--bg-primary)', padding: '0.25rem 0.75rem', borderRadius: '50px', fontSize: '0.75rem', fontWeight: '700'}}>
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
