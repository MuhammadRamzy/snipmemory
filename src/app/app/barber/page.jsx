"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '../../../context/AppContext';

function BarberModeContent() {
  const { 
    currentSalon, 
    customers, 
    visits, 
    staff, 
    addCustomer, 
    addVisit 
  } = useApp();

  const searchParams = useSearchParams();

  // Active view states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Read customerId from query params
  useEffect(() => {
    const customerId = searchParams.get('customerId');
    if (customerId && customers && currentSalon) {
      const found = customers.find(c => c.id === customerId && c.salonId === currentSalon.id);
      if (found) {
        setSelectedCustomer(found);
        setSearchQuery('');
        setShowCaptureWizard(false);
      }
    }
  }, [searchParams, customers, currentSalon]);

  // Read customerId from event bus
  useEffect(() => {
    const handleSelect = (e) => {
      setSelectedCustomer(e.detail);
      setSearchQuery('');
      setShowCaptureWizard(false);
    };
    window.addEventListener('select-customer', handleSelect);
    return () => window.removeEventListener('select-customer', handleSelect);
  }, []);
  
  // Modals / sub-screens
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerMobile, setNewCustomerMobile] = useState('');
  const [customerError, setCustomerError] = useState('');

  // Capture Wizard state
  const [showCaptureWizard, setShowCaptureWizard] = useState(false);
  const [wizardStaffId, setWizardStaffId] = useState('');
  const [wizardNotes, setWizardNotes] = useState('');
  const [wizardTags, setWizardTags] = useState([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [showCustomTagForm, setShowCustomTagForm] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [repeatSourceId, setRepeatSourceId] = useState(null); 

  // 4 photos state
  const [photos, setPhotos] = useState({
    front: '',
    left: '',
    right: '',
    back: ''
  });

  const availableTags = [
    'Fade', 'Crew Cut', 'Layered', 'Bob', 'Undercut', 'Trim', 'Beard Shape-up'
  ];

  // SVG vectors representing haircut angles
  const SVG_ANGLES = {
    front: `<svg viewBox="0 0 100 100" style="background:#202024; width:100%; height:100%;"><circle cx="50" cy="45" r="22" fill="#3a3a42"/><path d="M50 20 C35 20, 30 35, 30 45 C30 55, 35 52, 40 50 C45 48, 55 48, 60 50 C65 52, 70 55, 70 45 C70 35, 65 20, 50 20 Z" fill="#b45309"/><path d="M28 65 C28 55, 35 55, 50 55 C65 55, 72 55, 72 65 C72 75, 75 90, 75 90 H25 C25 90, 28 75, 28 65 Z" fill="#323238"/></svg>`,
    left: `<svg viewBox="0 0 100 100" style="background:#202024; width:100%; height:100%;"><circle cx="50" cy="45" r="22" fill="#3a3a42"/><path d="M55 20 C42 20, 35 28, 35 45 C35 50, 32 55, 36 57 C40 59, 45 42, 50 40 C55 38, 65 35, 68 45 C70 50, 72 40, 70 30 C68 22, 60 20, 55 20 Z" fill="#b45309"/><path d="M28 65 C28 55, 35 55, 50 55 C65 55, 72 55, 72 65 C72 75, 75 90, 75 90 H25 C25 90, 28 75, 28 65 Z" fill="#323238"/></svg>`,
    right: `<svg viewBox="0 0 100 100" style="background:#202024; width:100%; height:100%;"><circle cx="50" cy="45" r="22" fill="#3a3a42"/><path d="M45 20 C58 20, 65 28, 65 45 C65 50, 68 55, 64 57 C60 59, 55 42, 50 40 C45 38, 35 35, 32 45 C30 50, 28 40, 30 30 C32 22, 40 20, 45 20 Z" fill="#b45309"/><path d="M28 65 C28 55, 35 55, 50 55 C65 55, 72 55, 72 65 C72 75, 75 90, 75 90 H25 C25 90, 28 75, 28 65 Z" fill="#323238"/></svg>`,
    back: `<svg viewBox="0 0 100 100" style="background:#202024; width:100%; height:100%;"><circle cx="50" cy="45" r="22" fill="#3a3a42"/><path d="M50 18 C33 18, 26 28, 26 48 C26 58, 30 63, 50 63 C70 63, 74 58, 74 48 C74 28, 67 18, 50 18 Z" fill="#b45309"/><path d="M28 65 C28 55, 35 55, 50 55 C65 55, 72 55, 72 65 C72 75, 75 90, 75 90 H25 C25 90, 28 75, 28 65 Z" fill="#323238"/></svg>`
  };

  // Filter salon specific customers
  const activeCustomers = customers.filter(c => c.salonId === currentSalon.id);
  
  // Search filter
  const matchedCustomers = searchQuery.trim() === '' 
    ? [] 
    : activeCustomers.filter(c => 
        c.mobileNumber.includes(searchQuery) || 
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
      );

  const handleCreateCustomer = (e) => {
    e.preventDefault();
    setCustomerError('');

    if (!newCustomerName || !newCustomerMobile) {
      setCustomerError('Name and mobile number are required.');
      return;
    }

    const existing = customers.find(c => c.mobileNumber === newCustomerMobile && c.salonId === currentSalon.id);
    if (existing) {
      setCustomerError(
        <div>
          <span>A customer with this number already exists: <strong>{existing.name}</strong>.</span>
          <button 
            type="button" 
            className="btn btn-secondary btn-sm" 
            style={{ display: 'block', marginTop: '0.5rem', width: '100%', padding: '0.35rem' }}
            onClick={() => {
              setSelectedCustomer(existing);
              setShowAddCustomerModal(false);
              setNewCustomerName('');
              setNewCustomerMobile('');
              setCustomerError('');
            }}
          >
            View {existing.name}'s Profile
          </button>
        </div>
      );
      return;
    }

    try {
      const added = addCustomer(newCustomerName, newCustomerMobile);
      setSelectedCustomer(added);
      setShowAddCustomerModal(false);
      setNewCustomerName('');
      setNewCustomerMobile('');
      setSearchQuery('');
    } catch (err) {
      setCustomerError(err.message || 'Error creating customer.');
    }
  };

  const handleLaunchCapture = (repeatFromVisit = null) => {
    const salonStaff = staff.filter(s => s.salonId === currentSalon.id);
    setWizardStaffId(salonStaff[0]?.id || '');
    
    if (repeatFromVisit) {
      setWizardNotes(`Repeat cut of visit on ${new Date(repeatFromVisit.date).toLocaleDateString()}. `);
      setWizardTags(repeatFromVisit.styleTags || []);
      setPhotos({ ...repeatFromVisit.photos });
      setRepeatSourceId(repeatFromVisit.id);
    } else {
      setWizardNotes('');
      setWizardTags([]);
      setPhotos({ front: '', left: '', right: '', back: '' });
      setRepeatSourceId(null);
    }
    
    setConsentChecked(false);
    setShowCaptureWizard(true);
  };

  const handleSimulatePhoto = (angle) => {
    setPhotos(prev => ({
      ...prev,
      [angle]: SVG_ANGLES[angle]
    }));
  };

  const handleSimulateAllPhotos = () => {
    setPhotos({ ...SVG_ANGLES });
  };

  const handleTagToggle = (tag) => {
    if (wizardTags.includes(tag)) {
      setWizardTags(wizardTags.filter(t => t !== tag));
    } else {
      setWizardTags([...wizardTags, tag]);
    }
  };

  const handleAddCustomTag = (e) => {
    e.preventDefault();
    if (customTagInput.trim() && !wizardTags.includes(customTagInput.trim())) {
      setWizardTags([...wizardTags, customTagInput.trim()]);
      setCustomTagInput('');
      setShowCustomTagForm(false);
    }
  };

  const handleSaveVisitSubmit = (e) => {
    e.preventDefault();
    if (!wizardStaffId) {
      alert('Please select a stylist.');
      return;
    }
    
    const photoCount = Object.values(photos).filter(p => !!p).length;
    if (photoCount === 0) {
      alert('Please simulate/capture at least one reference photo angle.');
      return;
    }
    if (photoCount < 4) {
      const confirmSave = window.confirm(`You have only captured ${photoCount} of 4 reference views. Save this visit anyway?`);
      if (!confirmSave) return;
    }

    if (!consentChecked) {
      alert('Client consent must be confirmed before saving photos.');
      return;
    }

    addVisit(
      selectedCustomer.id,
      wizardStaffId,
      wizardNotes,
      wizardTags,
      photos,
      repeatSourceId
    );

    setShowCaptureWizard(false);
  };

  const customerVisits = visits.filter(v => v.customerId === selectedCustomer?.id);
  const salonStaff = staff.filter(s => s.salonId === currentSalon.id);

  return (
    <div className="animate-fade">
      {/* Search Header */}
      {!selectedCustomer && !showCaptureWizard && (
        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Find or Add Customer</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            Look up by name or phone, or create a new client record.
          </p>

          <div className="search-container" style={{ maxWidth: '500px', margin: '0 auto' }}>
            <div className="search-input-wrapper">
              <input
                type="text"
                className="form-control"
                placeholder="Search phone or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ padding: '1rem 1.25rem', fontSize: '1.125rem' }}
                autoFocus
              />
              <button 
                className="btn btn-primary"
                onClick={() => setShowAddCustomerModal(true)}
              >
                + New
              </button>
            </div>

            {/* Results Grid */}
            {searchQuery && (
              <div style={{ marginTop: '1rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                {matchedCustomers.length > 0 ? (
                  matchedCustomers.map(c => {
                    const lastVisit = visits.find(v => v.customerId === c.id);
                    return (
                      <div 
                        key={c.id} 
                        className="flex-between"
                        style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', textAlign: 'left' }}
                        onClick={() => { setSelectedCustomer(c); setSearchQuery(''); }}
                      >
                        <div>
                          <div style={{ fontWeight: '600' }}>{c.name}</div>
                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{c.mobileNumber}</div>
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                          {lastVisit ? `Last visit: ${new Date(lastVisit.date).toLocaleDateString()}` : 'No visits recorded'}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
                    No customers found matching "{searchQuery}"
                    <button className="btn btn-secondary btn-sm" style={{ margin: '1rem auto 0 auto', display: 'block' }} onClick={() => {
                      setNewCustomerMobile(searchQuery.replace(/\D/g, ''));
                      setShowAddCustomerModal(true);
                    }}>
                      Create client record for {searchQuery}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Recent Customers List */}
            {!searchQuery && activeCustomers.length > 0 && (
              <div style={{ marginTop: '2rem', textAlign: 'left' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Recent Clients
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {activeCustomers.slice(0, 3).map(c => {
                    const lastVisit = visits.find(v => v.customerId === c.id);
                    return (
                      <div 
                        key={c.id}
                        className="card flex-between"
                        style={{ padding: '0.85rem 1.25rem', cursor: 'pointer' }}
                        onClick={() => setSelectedCustomer(c)}
                      >
                        <div>
                          <span style={{ fontWeight: '600' }}>{c.name}</span>
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginLeft: '1rem' }}>{c.mobileNumber}</span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {lastVisit ? `Active ${new Date(lastVisit.date).toLocaleDateString()}` : 'New Client'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Customer Profile View */}
      {selectedCustomer && !showCaptureWizard && (
        <div className="animate-fade">
          <div className="flex-between" style={{ marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedCustomer(null)} style={{ marginBottom: '0.75rem' }}>
                &larr; Search Directory
              </button>
              <h2 style={{ fontSize: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {selectedCustomer.name}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
                Client ID: {selectedCustomer.id} | Phone: {selectedCustomer.mobileNumber}
              </p>
            </div>
            
            <button className="btn btn-primary" onClick={() => handleLaunchCapture(null)}>
              + Add Haircut Visit
            </button>
          </div>

          <hr style={{ borderColor: 'var(--border-color)', marginBottom: '2rem' }} />

          <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Styling Log History</h3>
          
          {customerVisits.length > 0 ? (
            <div className="visit-timeline">
              {customerVisits.map((visit) => {
                const staffMember = staff.find(s => s.id === visit.staffId);
                return (
                  <div key={visit.id} className="timeline-item">
                    <div className="timeline-marker">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    </div>
                    <div className="timeline-content">
                      <div className="flex-between" style={{ marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div>
                          <span style={{ fontWeight: '700', fontSize: '1rem' }}>
                            {new Date(visit.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                          </span>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginLeft: '0.75rem' }}>
                            by {staffMember?.name || 'Stylist'}
                          </span>
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleLaunchCapture(visit)}>
                          Repeat This Cut &rarr;
                        </button>
                      </div>

                      {/* Photo Grid */}
                      <div className="grid-4" style={{ marginBottom: '1rem', gap: '0.5rem' }}>
                        {['front', 'left', 'right', 'back'].map(angle => (
                          <div key={angle} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', aspectRatio: '1/1', position: 'relative' }}>
                            {visit.photos[angle]?.startsWith('<svg') ? (
                              <div dangerouslySetInnerHTML={{ __html: visit.photos[angle] }} style={{ width: '100%', height: '100%' }} />
                            ) : (
                              <img src={visit.photos[angle]} alt={angle} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            )}
                            <div style={{ position: 'absolute', bottom: '0.25rem', left: '0.25rem', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '0.1rem 0.4rem', fontSize: '0.625rem', textTransform: 'uppercase', borderRadius: '4px' }}>
                              {angle}
                            </div>
                          </div>
                        ))}
                      </div>

                      {visit.note && (
                        <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-tertiary)', borderRadius: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                          <strong>Notes:</strong> {visit.note}
                        </div>
                      )}

                      {visit.styleTags && visit.styleTags.length > 0 && (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {visit.styleTags.map(tag => (
                            <span key={tag} style={{ background: 'var(--accent-soft)', color: 'var(--accent-color)', fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '4px', fontWeight: '600' }}>
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <h3>No visits recorded yet</h3>
              <p style={{ fontSize: '0.875rem', marginTop: '0.25rem', marginBottom: '1.5rem' }}>
                Capture this client's first styling reference photos to seed their timeline profile.
              </p>
              <button className="btn btn-primary btn-sm" onClick={() => handleLaunchCapture(null)}>
                Capture First Cut
              </button>
            </div>
          )}
        </div>
      )}

      {/* Capture Wizard (New Visit Form) */}
      {showCaptureWizard && (
        <div className="animate-slide">
          <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.5rem' }}>
                {repeatSourceId ? 'Replicate Styling cut' : 'New Haircut Reference'}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                Recording reference photos for {selectedCustomer.name}
              </p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowCaptureWizard(false)}>
              Cancel
            </button>
          </div>

          <form onSubmit={handleSaveVisitSubmit}>
            <div className="grid-2" style={{ gap: '2rem', gridTemplateColumns: '1fr 1fr' }}>
              {/* Left Column: Photos Capture */}
              <div>
                <div className="flex-between" style={{ marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '1.125rem' }}>4-Angle Reference Grid</h3>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleSimulateAllPhotos}>
                    Simulate All 4 Angles
                  </button>
                </div>

                <div className="photo-capture-grid">
                  {['front', 'left', 'right', 'back'].map(angle => {
                    const hasImage = !!photos[angle];
                    return (
                      <div 
                        key={angle} 
                        className={`photo-slot ${hasImage ? 'has-image' : ''}`}
                        onClick={() => handleSimulatePhoto(angle)}
                      >
                        <span className="photo-slot-label">{angle}</span>
                        {hasImage ? (
                          photos[angle].startsWith('<svg') ? (
                            <div dangerouslySetInnerHTML={{ __html: photos[angle] }} style={{ width: '100%', height: '100%' }} />
                          ) : (
                            <img src={photos[angle]} alt={angle} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          )
                        ) : (
                          <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginBottom: '0.5rem' }}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                            <div style={{ fontSize: '0.75rem', fontWeight: '600' }}>Tap to Simulate</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4', display: 'block' }}>
                  💡 In this prototype, clicking any card simulates a 3D-styled head model snapshot matching that viewpoint.
                </span>
              </div>

              {/* Right Column: Visit details */}
              <div>
                <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Style Configuration</h3>

                <div className="form-group">
                  <label className="form-label">Active Barber / Stylist</label>
                  <select
                    className="form-select"
                    value={wizardStaffId}
                    onChange={(e) => setWizardStaffId(e.target.value)}
                    required
                  >
                    <option value="" disabled>Select Stylist</option>
                    {salonStaff.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Style Tags</label>
                  <div className="style-tag-selector">
                    {availableTags.map(tag => {
                      const isActive = wizardTags.includes(tag);
                      return (
                        <span 
                          key={tag} 
                          className={`style-tag-chip ${isActive ? 'active' : ''}`}
                          onClick={() => handleTagToggle(tag)}
                        >
                          {tag}
                        </span>
                      );
                    })}
                    <span 
                      className="style-tag-chip" 
                      style={{ borderStyle: 'dashed' }}
                      onClick={() => setShowCustomTagForm(!showCustomTagForm)}
                    >
                      + Custom Tag
                    </span>
                  </div>

                  {showCustomTagForm && (
                    <div className="flex-row animate-fade" style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Tag name (e.g. Buzz Cut)"
                        value={customTagInput}
                        onChange={(e) => setCustomTagInput(e.target.value)}
                        style={{ padding: '0.5rem' }}
                      />
                      <button type="button" className="btn btn-primary btn-sm" onClick={handleAddCustomTag}>
                        Add
                      </button>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Style Notes & Guard Details</label>
                  <textarea
                    className="form-control"
                    placeholder="e.g. Guard #3 on sides, texturized crop on top, razor cleanup on back neck."
                    rows="3"
                    value={wizardNotes}
                    onChange={(e) => setWizardNotes(e.target.value)}
                  />
                </div>

                {/* Consent & Submit */}
                <div style={{ margin: '1.5rem 0', padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <label style={{ display: 'flex', gap: '0.75rem', cursor: 'pointer', alignItems: 'flex-start' }}>
                    <input
                      type="checkbox"
                      checked={consentChecked}
                      onChange={(e) => setConsentChecked(e.target.checked)}
                      style={{ marginTop: '0.2rem' }}
                    />
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                      <strong>Consent Confirmation:</strong> Client confirms permission to store reference photos in their salon style index for future visits.
                    </span>
                  </label>
                </div>

                <button type="submit" className="btn btn-primary btn-block btn-lg">
                  Save Styling Reference &rarr;
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* New Customer Modal */}
      {showAddCustomerModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Create Client Record</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Add a new customer to the salon database.
            </p>

            {customerError && (
              <div style={{ background: 'var(--error-soft)', color: 'var(--error-color)', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', marginBottom: '1rem' }}>
                ⚠️ {customerError}
              </div>
            )}

            <form onSubmit={handleCreateCustomer}>
              <div className="form-group">
                <label className="form-label">Customer's Full Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Alex Mercer"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Mobile Phone Number</label>
                <input
                  type="tel"
                  className="form-control"
                  placeholder="e.g. (206) 555-0123"
                  value={newCustomerMobile}
                  onChange={(e) => setNewCustomerMobile(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary btn-block" onClick={() => { setShowAddCustomerModal(false); setCustomerError(''); }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-block">
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BarberMode() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-secondary)' }}>Loading stylist workspace...</div>
      </div>
    }>
      <BarberModeContent />
    </Suspense>
  );
}
