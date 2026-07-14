"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../../context/AppContext';

export default function AdminDashboard() {
  const router = useRouter();
  const {
    currentAdmin,
    salons,
    customers,
    visits,
    staff,
    payments,
    reminderLogs,
    plans,
    announcement,
    logout,
    changeSalonStatus,
    adminChangeSalonPlan,
    updatePricingTiers,
    updateAnnouncement,
    resetAllData
  } = useApp();

  // Navigation state
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'salons' | 'billing' | 'settings'
  const [selectedSalonId, setSelectedSalonId] = useState(null); // Inside salons inspector

  // Salons grid filters
  const [salonSearch, setSalonSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [salonSortKey, setSalonSortKey] = useState('name');
  const [salonSortOrder, setSalonSortOrder] = useState('asc');

  // Announcement settings form
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementActive, setAnnouncementActive] = useState(false);

  // Pricing tier editor state
  const [editingPlans, setEditingPlans] = useState([]);

  useEffect(() => {
    if (!currentAdmin) {
      router.push('/admin/login');
    }
  }, [currentAdmin, router]);

  useEffect(() => {
    if (announcement) {
      setAnnouncementText(announcement.text);
      setAnnouncementActive(announcement.active);
    }
  }, [announcement]);

  useEffect(() => {
    if (plans) {
      setEditingPlans(JSON.parse(JSON.stringify(plans))); // Deep clone plans for editing
    }
  }, [plans, activeTab]);

  if (!currentAdmin) return null;

  // --- Calculate Metrics ---
  const totalSalons = salons.length;
  const trialSalons = salons.filter(s => s.subscriptionStatus === 'Trial').length;
  const activeSalons = salons.filter(s => s.subscriptionStatus === 'Active').length;
  const pastDueSalons = salons.filter(s => s.subscriptionStatus === 'PastDue').length;

  const totalGlobalCustomers = customers.length;
  const totalGlobalVisits = visits.length;
  const totalGlobalReminders = reminderLogs.length;

  // MRR Calculation (Active salons only)
  const currentMrr = salons.reduce((sum, s) => {
    if (s.subscriptionStatus !== 'Active') return sum;
    const plan = plans.find(p => p.id === s.planId);
    if (!plan) return sum;
    
    const monthlyRate = s.billingInterval === 'annual' 
      ? Math.round(plan.priceAnnual / 12) 
      : plan.priceMonthly;
    
    return sum + monthlyRate;
  }, 0);

  // --- Salons Table List Operations ---
  const salonsWithStats = salons.map(s => {
    const salonCusts = customers.filter(c => c.salonId === s.id);
    const salonVisits = visits.filter(v => salonCusts.some(c => c.id === v.customerId));
    const salonStaff = staff ? staff.filter(st => st.salonId === s.id) : [];
    return {
      ...s,
      customerCount: salonCusts.length,
      visitCount: salonVisits.length,
      staffCount: salonStaff.length
    };
  });

  const filteredSalons = salonsWithStats.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(salonSearch.toLowerCase()) || 
                          s.ownerName.toLowerCase().includes(salonSearch.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.subscriptionStatus === statusFilter;
    const matchesPlan = planFilter === 'all' || s.planId === planFilter;
    return matchesSearch && matchesStatus && matchesPlan;
  });

  const sortedSalons = [...filteredSalons].sort((a, b) => {
    let aVal = a[salonSortKey];
    let bVal = b[salonSortKey];
    if (aVal < bVal) return salonSortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return salonSortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const toggleSalonSort = (key) => {
    if (salonSortKey === key) {
      setSalonSortOrder(salonSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSalonSortKey(key);
      setSalonSortOrder('asc');
    }
  };

  // --- Inspector Details ---
  const selectedSalon = salonsWithStats.find(s => s.id === selectedSalonId);
  const selectedSalonPayments = selectedSalon ? payments.filter(p => p.salonId === selectedSalon.id) : [];

  // Detail Action Handlers
  const handleSetStatus = (salonId, status) => {
    changeSalonStatus(salonId, status);
    alert(`Salon status changed to ${status}`);
  };

  const handleSetPlan = (salonId, planId) => {
    adminChangeSalonPlan(salonId, planId);
    alert(`Salon plan changed to ${plans.find(p => p.id === planId)?.name}`);
  };

  // --- Settings Form Handlers ---
  const handleSaveAnnouncement = (e) => {
    e.preventDefault();
    updateAnnouncement(announcementActive, announcementText);
    alert('Global platform announcement text saved successfully.');
  };

  const handlePlanEditChange = (index, field, value) => {
    const updated = [...editingPlans];
    updated[index][field] = value;
    setEditingPlans(updated);
  };

  const handlePlanFeaturesChange = (planIdx, featIdx, value) => {
    const updated = [...editingPlans];
    updated[planIdx].features[featIdx] = value;
    setEditingPlans(updated);
  };

  const handleSavePricing = (e) => {
    e.preventDefault();
    updatePricingTiers(editingPlans);
    alert('Subscription pricing models updated successfully.');
  };

  return (
    <div className="animate-fade" style={{ display: 'flex', minHeight: '100vh', background: '#0a0a0f' }}>
      
      {/* 1. Admin Sidebar Nav */}
      <aside className="admin-sidebar">
        <div className="logo-brand" style={{ marginBottom: '2.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--accent-color)' }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          Snip<span>Admin</span>
        </div>

        <nav style={{ flex: 1 }}>
          <button 
            className={`admin-nav-item btn-block ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => { setActiveTab('overview'); setSelectedSalonId(null); }}
          >
            Dashboard Overview
          </button>
          <button 
            className={`admin-nav-item btn-block ${activeTab === 'salons' ? 'active' : ''}`}
            onClick={() => { setActiveTab('salons'); }}
          >
            Manage Salons ({totalSalons})
          </button>
          <button 
            className={`admin-nav-item btn-block ${activeTab === 'billing' ? 'active' : ''}`}
            onClick={() => { setActiveTab('billing'); setSelectedSalonId(null); }}
          >
            Billing & Invoices
          </button>
          <button 
            className={`admin-nav-item btn-block ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => { setActiveTab('settings'); setSelectedSalonId(null); }}
          >
            Platform Settings
          </button>
        </nav>

        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          <button 
            className="btn btn-secondary btn-block btn-sm"
            onClick={resetAllData}
            style={{ marginBottom: '0.75rem', borderColor: 'var(--error-color)', color: 'var(--error-color)' }}
          >
            Reset Platform DB
          </button>
          <button 
            className="btn btn-text btn-block btn-sm"
            onClick={() => { logout(); router.push('/admin/login'); }}
            style={{ color: 'var(--text-secondary)' }}
          >
            Logout Operator
          </button>
        </div>
      </aside>

      {/* 2. Admin Workspace Content */}
      <main className="admin-main">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem' }}>
              {activeTab === 'overview' && 'Platform Command Console'}
              {activeTab === 'salons' && (selectedSalonId ? 'Salon Inspector Details' : 'Salons Records Database')}
              {activeTab === 'billing' && 'Revenue & Billing Audits'}
              {activeTab === 'settings' && 'Platform Settings Console'}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginTop: '0.25rem' }}>
              Logged in as: {currentAdmin.email} (Administrator)
            </p>
          </div>
          
          <button className="btn btn-secondary btn-sm" onClick={() => router.push('/')}>
            View Public Site
          </button>
        </div>

        {/* --- OVERVIEW TAB --- */}
        {activeTab === 'overview' && (
          <div className="animate-fade">
            {/* Stat Counters Grid */}
            <div className="admin-stats-grid">
              <div className="admin-stat-card">
                <span className="admin-stat-label">Total Salons</span>
                <div className="admin-stat-value">{totalSalons}</div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {activeSalons} Active | {trialSalons} Trial | {pastDueSalons} Past Due
                </span>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-label">Estimated MRR</span>
                <div className="admin-stat-value" style={{ color: 'var(--success-color)' }}>
                  ${currentMrr}
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Recurrent subscription rate
                </span>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-label">Global Visits</span>
                <div className="admin-stat-value">{totalGlobalVisits}</div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Haircuts archived cross-platform
                </span>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-label">Reminders Dispatched</span>
                <div className="admin-stat-value">{totalGlobalReminders}</div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  WhatsApp retention follow-ups
                </span>
              </div>
            </div>

            {/* Signup Trend */}
            <div className="card" style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>Monthly Salon Registrations</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                Total shops registered on the platform by calendar month.
              </p>
              <div className="chart-container">
                <div className="bar-chart" style={{ height: '120px' }}>
                  <div className="bar-column">
                    <div className="bar-fill" style={{ height: '10%' }}><span className="bar-value">1</span></div>
                    <span className="bar-label">Jan</span>
                  </div>
                  <div className="bar-column">
                    <div className="bar-fill" style={{ height: '10%' }}><span className="bar-value">1</span></div>
                    <span className="bar-label">Feb</span>
                  </div>
                  <div className="bar-column">
                    <div className="bar-fill" style={{ height: '20%' }}><span className="bar-value">2</span></div>
                    <span className="bar-label">Mar</span>
                  </div>
                  <div className="bar-column">
                    <div className="bar-fill" style={{ height: '20%' }}><span className="bar-value">2</span></div>
                    <span className="bar-label">Apr</span>
                  </div>
                  <div className="bar-column">
                    <div className="bar-fill" style={{ height: '30%' }}><span className="bar-value">3</span></div>
                    <span className="bar-label">May</span>
                  </div>
                  <div className="bar-column">
                    <div className="bar-fill" style={{ height: '40%' }}><span className="bar-value">4</span></div>
                    <span className="bar-label">Jun</span>
                  </div>
                  <div className="bar-column">
                    <div className="bar-fill" style={{ height: '60%' }}><span className="bar-value">6</span></div>
                    <span className="bar-label">Jul (Cur)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- SALONS TAB --- */}
        {activeTab === 'salons' && !selectedSalonId && (
          <div className="card animate-fade">
            {/* Filters Bar */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Search salons or owners..."
                value={salonSearch}
                onChange={(e) => setSalonSearch(e.target.value)}
                style={{ flex: 2, minWidth: '200px' }}
              />
              <select 
                className="form-select" 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ flex: 1, minWidth: '120px' }}
              >
                <option value="all">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Trial">Trial</option>
                <option value="PastDue">Past Due</option>
                <option value="Cancelled">Cancelled</option>
              </select>
              <select 
                className="form-select" 
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value)}
                style={{ flex: 1, minWidth: '120px' }}
              >
                <option value="all">All Plans</option>
                <option value="starter">Starter</option>
                <option value="growth">Growth</option>
                <option value="pro">Pro</option>
              </select>
            </div>

            {/* Salons Table */}
            <div className="table-container">
              {sortedSalons.length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ cursor: 'pointer' }} onClick={() => toggleSalonSort('name')}>
                        Shop Name {salonSortKey === 'name' ? (salonSortOrder === 'asc' ? '▲' : '▼') : ''}
                      </th>
                      <th>Owner</th>
                      <th>Status</th>
                      <th>Plan Level</th>
                      <th style={{ cursor: 'pointer' }} onClick={() => toggleSalonSort('customerCount')}>
                        Clients Stored {salonSortKey === 'customerCount' ? (salonSortOrder === 'asc' ? '▲' : '▼') : ''}
                      </th>
                      <th>Stylists</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSalons.map(s => (
                      <tr key={s.id}>
                        <td style={{ fontWeight: '600' }}>{s.name}</td>
                        <td>
                          <div>{s.ownerName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{s.email}</div>
                        </td>
                        <td>
                          <span className={`badge ${
                            s.subscriptionStatus === 'Active' ? 'badge-active' :
                            s.subscriptionStatus === 'Trial' ? 'badge-trial' :
                            s.subscriptionStatus === 'PastDue' ? 'badge-pastdue' : 'badge-cancelled'
                          }`}>
                            {s.subscriptionStatus}
                          </span>
                        </td>
                        <td style={{ textTransform: 'capitalize' }}>{s.planId}</td>
                        <td>{s.customerCount} records</td>
                        <td>{s.staffCount} stations</td>
                        <td style={{ textAlign: 'right' }}>
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => setSelectedSalonId(s.id)}
                          >
                            Inspect &rarr;
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No salons found matching the current search parameters.
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- SALONS INSPECTOR DETAIL VIEW --- */}
        {activeTab === 'salons' && selectedSalonId && selectedSalon && (
          <div className="animate-fade">
            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedSalonId(null)} style={{ marginBottom: '1.5rem' }}>
              &larr; Return to Database List
            </button>

            <div className="grid-2" style={{ gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem' }}>
              {/* Left Side: Stats & Billing */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div className="card">
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Usage Metrics</h3>
                  <div className="grid-3" style={{ textAlign: 'center' }}>
                    <div style={{ padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Clients</span>
                      <strong style={{ display: 'block', fontSize: '1.5rem', color: 'var(--accent-color)' }}>{selectedSalon.customerCount}</strong>
                    </div>
                    <div style={{ padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Visits</span>
                      <strong style={{ display: 'block', fontSize: '1.5rem' }}>{selectedSalon.visitCount}</strong>
                    </div>
                    <div style={{ padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Stations</span>
                      <strong style={{ display: 'block', fontSize: '1.5rem' }}>{selectedSalon.staffCount}</strong>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Salon Invoices History</h3>
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Invoice ID</th>
                          <th>Date</th>
                          <th>Amount</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSalonPayments.length > 0 ? (
                          selectedSalonPayments.map(p => (
                            <tr key={p.id}>
                              <td style={{ fontFamily: 'monospace' }}>{p.id}</td>
                              <td>{new Date(p.date).toLocaleDateString()}</td>
                              <td>${p.amount}</td>
                              <td>
                                <span className={`badge ${p.status === 'Success' ? 'badge-active' : 'badge-cancelled'}`}>
                                  {p.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="4" style={{ textAlign: 'center', padding: '1.5rem' }}>No payments logged</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Right Side: Admin controls */}
              <div className="card card-premium">
                <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem' }}>Salon Roster Controls</h3>
                
                <div style={{ marginBottom: '1.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block' }}>Salon Name</span>
                  <strong style={{ fontSize: '1.125rem' }}>{selectedSalon.name}</strong>
                  <span style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    Owner: {selectedSalon.ownerName} | {selectedSalon.mobileNumber}
                  </span>
                </div>

                <hr style={{ borderColor: 'var(--border-color)', margin: '1.25rem 0' }} />

                <div className="form-group">
                  <label className="form-label">Subscription Plan</label>
                  <select 
                    className="form-select"
                    value={selectedSalon.planId}
                    onChange={(e) => handleSetPlan(selectedSalon.id, e.target.value)}
                  >
                    <option value="starter">Starter</option>
                    <option value="growth">Growth</option>
                    <option value="pro">Pro</option>
                  </select>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label">Administrative Action States</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <button 
                      className="btn btn-secondary btn-block btn-sm" 
                      style={{ color: 'var(--success-color)', justifyContent: 'flex-start' }}
                      onClick={() => handleSetStatus(selectedSalon.id, 'Active')}
                      disabled={selectedSalon.subscriptionStatus === 'Active'}
                    >
                      🟢 Mark Subscription Active
                    </button>
                    <button 
                      className="btn btn-secondary btn-block btn-sm" 
                      style={{ color: 'var(--warning-color)', justifyContent: 'flex-start' }}
                      onClick={() => handleSetStatus(selectedSalon.id, 'PastDue')}
                      disabled={selectedSalon.subscriptionStatus === 'PastDue'}
                    >
                      🟡 Flag Subscription PastDue (Trigger Banner)
                    </button>
                    <button 
                      className="btn btn-secondary btn-block btn-sm" 
                      style={{ color: 'var(--error-color)', justifyContent: 'flex-start' }}
                      onClick={() => handleSetStatus(selectedSalon.id, 'Cancelled')}
                      disabled={selectedSalon.subscriptionStatus === 'Cancelled'}
                    >
                      🔴 Suspend Account / Set Cancelled
                    </button>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Quick Message to Owner</label>
                  <textarea 
                    className="form-control" 
                    placeholder="Send a simulated message regarding their account status..."
                    rows="3"
                  />
                  <button 
                    type="button" 
                    className="btn btn-primary btn-block btn-sm" 
                    style={{ marginTop: '0.75rem' }}
                    onClick={() => alert('Message dispatch simulated!')}
                  >
                    Send System Notice
                  </button>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* --- BILLING TAB --- */}
        {activeTab === 'billing' && (
          <div className="card animate-fade">
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Platform Billing Invoices Ledger</h3>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice ID</th>
                    <th>Salon Shop</th>
                    <th>Date</th>
                    <th>Subtotal</th>
                    <th>Payment Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => {
                    const salonObj = salons.find(s => s.id === p.salonId);
                    return (
                      <tr key={p.id}>
                        <td style={{ fontFamily: 'monospace' }}>{p.id}</td>
                        <td style={{ fontWeight: '600' }}>{salonObj ? salonObj.name : 'Unknown Salon'}</td>
                        <td>{new Date(p.date).toLocaleDateString()}</td>
                        <td>${p.amount}</td>
                        <td>
                          <span className={`badge ${p.status === 'Success' ? 'badge-active' : 'badge-cancelled'}`}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- SETTINGS TAB --- */}
        {activeTab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }} className="animate-fade">
            
            {/* Global Warning Banner */}
            <div className="card">
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Platform Announcement Banner</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                Toggle a warning banner rendered at the top of all salon-facing dashboard pages.
              </p>

              <form onSubmit={handleSaveAnnouncement}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input 
                      type="checkbox"
                      checked={announcementActive}
                      onChange={(e) => setAnnouncementActive(e.target.checked)}
                    />
                    <span>Enable banner display</span>
                  </label>
                </div>

                <div className="form-group">
                  <label className="form-label">Banner Message Text</label>
                  <input
                    type="text"
                    className="form-control"
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary">
                  Save Announcement Config
                </button>
              </form>
            </div>

            {/* Pricing Tier Settings */}
            <div className="card">
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Pricing Tiers Configurator</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '2rem' }}>
                Configure the subscription plans shown on the public marketing page.
              </p>

              <form onSubmit={handleSavePricing}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                  {editingPlans.map((p, pIdx) => (
                    <div key={p.id} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem' }}>
                      <h4 style={{ fontSize: '1.125rem', color: 'var(--accent-color)', marginBottom: '1rem', textTransform: 'capitalize' }}>
                        {p.name} Tier
                      </h4>
                      
                      <div className="grid-4">
                        <div className="form-group">
                          <label className="form-label">Plan Name</label>
                          <input 
                            type="text" 
                            className="form-control" 
                            value={p.name}
                            onChange={(e) => handlePlanEditChange(pIdx, 'name', e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Price Monthly ($)</label>
                          <input 
                            type="number" 
                            className="form-control" 
                            value={p.priceMonthly}
                            onChange={(e) => handlePlanEditChange(pIdx, 'priceMonthly', Number(e.target.value))}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Price Annual ($)</label>
                          <input 
                            type="number" 
                            className="form-control" 
                            value={p.priceAnnual}
                            onChange={(e) => handlePlanEditChange(pIdx, 'priceAnnual', Number(e.target.value))}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Client Capacity Limit (-1 = Unlimited)</label>
                          <input 
                            type="number" 
                            className="form-control" 
                            value={p.customerLimit}
                            onChange={(e) => handlePlanEditChange(pIdx, 'customerLimit', Number(e.target.value))}
                          />
                        </div>
                      </div>

                      {/* Feature rows */}
                      <div style={{ marginTop: '0.5rem' }}>
                        <label className="form-label">Bullet Highlights</label>
                        <div className="grid-3" style={{ gap: '0.75rem' }}>
                          {p.features.map((feat, fIdx) => (
                            <input 
                              key={fIdx}
                              type="text"
                              className="form-control"
                              value={feat}
                              onChange={(e) => handlePlanFeaturesChange(pIdx, fIdx, e.target.value)}
                              style={{ fontSize: '0.8125rem' }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button type="submit" className="btn btn-primary" style={{ marginTop: '1.5rem' }}>
                  Update Subscription Packages
                </button>
              </form>
            </div>

          </div>
        )}

      </main>

    </div>
  );
}
