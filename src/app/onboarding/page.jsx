"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../../context/AppContext';

export default function Onboarding() {
  const router = useRouter();
  const { currentSalon, completeOnboarding } = useApp();

  const [step, setStep] = useState(1);
  const [address, setAddress] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [staffList, setStaffList] = useState(['']);
  const [cadence, setCadence] = useState(30);

  // Redirect if not logged in
  useEffect(() => {
    if (!currentSalon) {
      router.push('/login');
    }
  }, [currentSalon, router]);

  if (!currentSalon) return null;

  const handleAddStaffField = () => {
    setStaffList([...staffList, '']);
  };

  const handleStaffChange = (index, value) => {
    const updated = [...staffList];
    updated[index] = value;
    setStaffList(updated);
  };

  const handleRemoveStaffField = (index) => {
    if (staffList.length === 1) {
      setStaffList(['']);
    } else {
      setStaffList(staffList.filter((_, i) => i !== index));
    }
  };

  const handleNext = () => {
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleFinish = () => {
    completeOnboarding(address, logoUrl, staffList, cadence);
    router.push('/app/dashboard');
  };

  return (
    <div className="flex-center" style={{ minHeight: '100vh', padding: '2rem' }}>
      <div className="card card-premium animate-slide" style={{ maxWidth: '550px', width: '100%', minHeight: '400px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        
        {/* Progress header */}
        <div>
          <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-color)', fontWeight: '700' }}>
              Setup Wizard - Step {step} of 3
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <div style={{ width: '20px', height: '4px', borderRadius: '2px', background: step >= 1 ? 'var(--accent-color)' : 'var(--border-color)' }} />
              <div style={{ width: '20px', height: '4px', borderRadius: '2px', background: step >= 2 ? 'var(--accent-color)' : 'var(--border-color)' }} />
              <div style={{ width: '20px', height: '4px', borderRadius: '2px', background: step >= 3 ? 'var(--accent-color)' : 'var(--border-color)' }} />
            </div>
          </div>

          {step === 1 && (
            <div className="animate-fade">
              <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Tell us about {currentSalon.name}</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                Provide your address and branding details.
              </p>

              <div className="form-group">
                <label className="form-label">Shop Address</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. 123 Grooming Lane, Seattle, WA"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Salon Logo URL (Optional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="https://example.com/logo.png"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                  If left empty, we'll display a styled geometric brand avatar.
                </span>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade">
              <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Add Stylists & Barbers</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                Add the roster of staff working at your stations.
              </p>

              <div style={{ maxHeight: '200px', overflowY: 'auto', paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                {staffList.map((stylist, index) => (
                  <div key={index} className="flex-row">
                    <input
                      type="text"
                      className="form-control"
                      placeholder={`Stylist #${index + 1} Name`}
                      value={stylist}
                      onChange={(e) => handleStaffChange(index, e.target.value)}
                    />
                    <button 
                      type="button" 
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleRemoveStaffField(index)}
                      style={{ padding: '0.75rem', color: 'var(--error-color)' }}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>

              <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddStaffField}>
                + Add Stylist Station
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="animate-fade">
              <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Configure reminders</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                Establish when clients will appear on your follow-up roster.
              </p>

              <div className="form-group">
                <label className="form-label">Default Haircut Cadence (Days)</label>
                <select
                  className="form-select"
                  value={cadence}
                  onChange={(e) => setCadence(Number(e.target.value))}
                >
                  <option value={15}>15 Days (Very Short fades)</option>
                  <option value={21}>21 Days (3 Weeks)</option>
                  <option value={30}>30 Days (4 Weeks - Standard)</option>
                  <option value={45}>45 Days (6 Weeks - Longer Styles)</option>
                  <option value={60}>60 Days (2 Months)</option>
                </select>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.5rem', lineHeight: '1.4' }}>
                  If a customer doesn't return within this timeframe, we'll queue a pre-formatted message for their stylist or shop owner to send.
                </span>
              </div>

              <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ fontSize: '0.875rem', color: 'var(--accent-color)', marginBottom: '0.25rem' }}>WhatsApp Reminder Preview</h4>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: '1.4' }}>
                  "Hey [Client Name]! It has been {cadence} days since your last haircut at {currentSalon.name}. Ready for a fresh trim? Book your station slot here!"
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex-between" style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
          {step > 1 ? (
            <button type="button" className="btn btn-secondary" onClick={handleBack}>
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button type="button" className="btn btn-primary" onClick={handleNext}>
              Next Step
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={handleFinish}>
              Finish Setup & Launch
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
