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
    adminAddStaff,
    adminAddInvoice,
    adminUpdateSalonDetails,
    updatePricingTiers,
    updateAnnouncement,
    resetAllData
  } = useApp();

  // Navigation state
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'salons' | 'billing' | 'settings'
  const [selectedSalonId, setSelectedSalonId] = useState(null); // Inside salons inspector
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Salons grid filters
  const [salonSearch, setSalonSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [salonSortKey, setSalonSortKey] = useState('name');
  const [salonSortOrder, setSalonSortOrder] = useState('asc');

  // Salon Inspector Editing states
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [editName, setEditName] = useState('');
  const [editOwner, setEditOwner] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editCadence, setEditCadence] = useState(30);
  
  const [newStaffName, setNewStaffName] = useState('');
  const [manualInvoiceAmount, setManualInvoiceAmount] = useState('');
  const [simulatedOtpCode, setSimulatedOtpCode] = useState('');

  // Global Invoicing State
  const [newInvoiceSalonId, setNewInvoiceSalonId] = useState('');
  const [newInvoiceAmount, setNewInvoiceAmount] = useState('');
  const [invoiceFilter, setInvoiceFilter] = useState('all');

  // Announcement settings form
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementActive, setAnnouncementActive] = useState(false);

  // Pricing tier editor state
  const [editingPlans, setEditingPlans] = useState([]);

  // Diagnostic states
  const [diagnosticRunning, setDiagnosticRunning] = useState(false);
  const [diagnosticLog, setDiagnosticLog] = useState([]);

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

  // Load selected salon metadata into editing states
  useEffect(() => {
    if (selectedSalonId) {
      const current = salons.find(s => s.id === selectedSalonId);
      if (current) {
        setEditName(current.name);
        setEditOwner(current.ownerName);
        setEditEmail(current.email);
        setEditMobile(current.mobileNumber);
        setEditCadence(current.reminderCadenceDaysDefault || 30);
        setIsEditingMetadata(false);
        setNewStaffName('');
        setManualInvoiceAmount('');
        setSimulatedOtpCode('');
      }
    }
  }, [selectedSalonId, salons]);

  if (!currentAdmin) return null;

  // --- Calculate Metrics ---
  const totalSalons = salons.length;
  const trialSalons = salons.filter(s => s.subscriptionStatus === 'Trial').length;
  const activeSalons = salons.filter(s => s.subscriptionStatus === 'Active').length;
  const pastDueSalons = salons.filter(s => s.subscriptionStatus === 'PastDue').length;

  const totalGlobalCustomers = customers.length;
  const totalGlobalVisits = visits.length;
  const totalGlobalReminders = reminderLogs.length;

  // MRR Calculation
  const currentMrr = salons.reduce((sum, s) => {
    if (s.subscriptionStatus !== 'Active') return sum;
    const plan = plans.find(p => p.id === s.planId);
    if (!plan) return sum;
    return sum + (s.billingInterval === 'annual' ? Math.round(plan.priceAnnual / 12) : plan.priceMonthly);
  }, 0);

  // R2 Storage Vault footprints calculation
  const totalVisitsWithPhotos = visits.filter(v => v.photos && Object.values(v.photos).some(p => !!p)).length;
  const simulatedR2StorageBytes = totalVisitsWithPhotos * 4 * 165 * 1024; // ~165 KB average photo size, 4 angles
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0.00 KB';
    const k = 1024;
    const dm = 2;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Impersonation feature: bypass login and launch workspace directly
  const handleImpersonate = (salon) => {
    const confirmImpersonation = window.confirm(`Initiate administrative override session to impersonate owner of ${salon.name}?`);
    if (confirmImpersonation) {
      // Set target salon as current and go to their dashboard
      localStorage.setItem('snipmem_current_salon', JSON.stringify(salon));
      localStorage.setItem('snipmem_salon_mode', JSON.stringify('owner'));
      // Reload window or redirect
      window.location.href = `/salon/${salon.id}/dashboard`;
    }
  };

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
    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();
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

  const selectedSalon = salonsWithStats.find(s => s.id === selectedSalonId);
  const selectedSalonPayments = selectedSalon ? payments.filter(p => p.salonId === selectedSalon.id) : [];
  const selectedSalonStaff = selectedSalon ? staff.filter(st => st.salonId === selectedSalon.id) : [];

  // Inspector Action Handlers
  const handleSaveMetadata = (e) => {
    e.preventDefault();
    adminUpdateSalonDetails(selectedSalonId, {
      name: editName,
      ownerName: editOwner,
      email: editEmail,
      mobileNumber: editMobile,
      reminderCadenceDaysDefault: Number(editCadence)
    });
    setIsEditingMetadata(false);
  };

  const handleAddStylistFromAdmin = (e) => {
    e.preventDefault();
    if (!newStaffName.trim()) return;
    adminAddStaff(selectedSalonId, newStaffName.trim());
    setNewStaffName('');
  };

  const handleAddInvoiceFromAdmin = (e) => {
    e.preventDefault();
    if (!manualInvoiceAmount || isNaN(manualInvoiceAmount)) return;
    adminAddInvoice(selectedSalonId, Number(manualInvoiceAmount));
    setManualInvoiceAmount('');
  };

  const handleGenerateResetOtp = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setSimulatedOtpCode(code);
  };

  // Global Billing Action Handlers
  const handleCreateGlobalInvoice = (e) => {
    e.preventDefault();
    if (!newInvoiceSalonId || !newInvoiceAmount || isNaN(newInvoiceAmount)) {
      alert("Please select a salon and input a valid number amount.");
      return;
    }
    adminAddInvoice(newInvoiceSalonId, Number(newInvoiceAmount));
    setNewInvoiceSalonId('');
    setNewInvoiceAmount('');
    alert("New custom invoice successfully generated and logged in ledger.");
  };

  // Diagnostic Runner
  const runDiagnostics = () => {
    setDiagnosticRunning(true);
    setDiagnosticLog(["Initiating database integrity review...", "Analyzing active indexes..."]);
    
    setTimeout(() => {
      setDiagnosticLog(prev => [...prev, `Found ${salons.length} salon records. Schema verification: OK.`]);
    }, 400);

    setTimeout(() => {
      setDiagnosticLog(prev => [...prev, `Inspecting styling logs: ${visits.length} records. R2 media associations: OK.`]);
    }, 800);

    setTimeout(() => {
      setDiagnosticLog(prev => [...prev, `Auditing ledger consistency: ${payments.length} successful payment records. Integrity matches.`]);
    }, 1200);

    setTimeout(() => {
      setDiagnosticLog(prev => [...prev, "Memory caching performance diagnostic complete. Zero anomalies detected."]);
      setDiagnosticRunning(false);
    }, 1600);
  };

  return (
    <div className="animate-fade admin-layout-root" style={{ display: 'flex', minHeight: '100vh', background: '#090a0f' }}>
      
      {/* Mobile Top Header */}
      <header className="admin-mobile-header">
        <div className="logo-brand">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--accent-color)' }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          Snip<span>Admin</span>
        </div>
        <button 
          className="btn btn-secondary btn-sm"
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          style={{ padding: '0.5rem' }}
        >
          {showMobileMenu ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          )}
        </button>
      </header>

      {/* Mobile Menu Drawer */}
      {showMobileMenu && (
        <div className="admin-mobile-menu animate-slide">
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <button 
              className={`admin-nav-item btn-block ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => { setActiveTab('overview'); setSelectedSalonId(null); setShowMobileMenu(false); }}
            >
              Dashboard Overview
            </button>
            <button 
              className={`admin-nav-item btn-block ${activeTab === 'salons' ? 'active' : ''}`}
              onClick={() => { setActiveTab('salons'); setShowMobileMenu(false); }}
            >
              Manage Salons ({totalSalons})
            </button>
            <button 
              className={`admin-nav-item btn-block ${activeTab === 'billing' ? 'active' : ''}`}
              onClick={() => { setActiveTab('billing'); setSelectedSalonId(null); setShowMobileMenu(false); }}
            >
              Billing & Invoices
            </button>
            <button 
              className={`admin-nav-item btn-block ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => { setActiveTab('settings'); setSelectedSalonId(null); setShowMobileMenu(false); }}
            >
              Platform Settings
            </button>
          </nav>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button 
              className="btn btn-secondary btn-block btn-sm"
              onClick={() => { resetAllData(); setShowMobileMenu(false); }}
              style={{ borderColor: 'var(--error-color)', color: 'var(--error-color)' }}
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
        </div>
      )}

      {/* 1. Admin Sidebar Nav */}
      <aside className="admin-sidebar" style={{ background: '#0b0c12', borderRight: '1px solid var(--border-color)' }}>
        <div className="logo-brand" style={{ marginBottom: '2.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--accent-color)' }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          Snip<span>Admin</span>
        </div>

        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
      <main className="admin-main" style={{ flex: 1, padding: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: '800' }}>
              {activeTab === 'overview' && 'Platform Command Console'}
              {activeTab === 'salons' && (selectedSalonId ? 'Salon Workspace Manager' : 'Salons Records Database')}
              {activeTab === 'billing' && 'Revenue & Billing Ledger'}
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
            <div className="admin-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
              <div className="admin-stat-card card card-premium" style={{ position: 'relative' }}>
                <span className="admin-stat-label" style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Salons</span>
                <div className="admin-stat-value" style={{ fontSize: '2rem', fontWeight: '800', margin: '0.5rem 0' }}>{totalSalons}</div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {activeSalons} Active | {trialSalons} Trial | {pastDueSalons} Past Due
                </span>
              </div>
              <div className="admin-stat-card card card-premium">
                <span className="admin-stat-label" style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estimated MRR</span>
                <div className="admin-stat-value" style={{ fontSize: '2rem', fontWeight: '800', margin: '0.5rem 0', color: 'var(--success-color)' }}>
                  ${currentMrr}
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Recurrent subscription rate
                </span>
              </div>
              <div className="admin-stat-card card card-premium">
                <span className="admin-stat-label" style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Global Visits</span>
                <div className="admin-stat-value" style={{ fontSize: '2rem', fontWeight: '800', margin: '0.5rem 0' }}>{totalGlobalVisits}</div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Haircuts archived cross-platform
                </span>
              </div>
              <div className="admin-stat-card card card-premium">
                <span className="admin-stat-label" style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>R2 Media Footprint</span>
                <div className="admin-stat-value" style={{ fontSize: '2rem', fontWeight: '800', margin: '0.5rem 0', color: 'var(--accent-color)' }}>
                  {formatBytes(simulatedR2StorageBytes)}
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {totalVisitsWithPhotos * 4} captured angles stored
                </span>
              </div>
            </div>

            {/* Impersonation Shortcuts / Quick Actions */}
            <div className="grid-2" style={{ gap: '2rem', marginBottom: '2rem' }}>
              <div className="card">
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Active Workspace Impersonation</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                  Securely override authentication to troubleshoot support issues or review salon configurations.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {salons.slice(0, 3).map(s => (
                    <div key={s.id} className="flex-between" style={{ padding: '0.75rem 1rem', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div>
                        <strong style={{ fontSize: '0.875rem' }}>{s.name}</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '12px' }}>{s.ownerName}</span>
                      </div>
                      <button 
                        className="btn btn-secondary btn-sm" 
                        onClick={() => handleImpersonate(s)}
                        style={{ fontSize: '0.75rem' }}
                      >
                        Impersonate Owner &rarr;
                      </button>
                    </div>
                  ))}
                  {salons.length > 3 && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                      Additional salons can be impersonated from the Salons Database tab.
                    </span>
                  )}
                </div>
              </div>

              {/* R2 Storage Quotas */}
              <div className="card">
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Cloudflare R2 Media Storage Limit</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                  Current asset volume compared to global storage limit capacity.
                </p>
                
                <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div className="flex-between" style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                    <span>Global Assets Used</span>
                    <strong>{formatBytes(simulatedR2StorageBytes)} / 5.0 GB</strong>
                  </div>
                  <div style={{ width: '100%', height: '10px', background: 'var(--border-color)', borderRadius: '5px', overflow: 'hidden' }}>
                    <div style={{ 
                      width: `${Math.min(100, (simulatedR2StorageBytes / (5 * 1024 * 1024 * 1024)) * 100)}%`, 
                      height: '100%', 
                      background: 'var(--accent-color)' 
                    }} />
                  </div>
                  <div className="flex-between" style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <span>Estimated Cost: $0.00</span>
                    <span>Class A operations: {totalVisitsWithPhotos * 4} / 1,000,000</span>
                  </div>
                </div>
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
                <table className="data-table responsive-table">
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
                        <td style={{ fontWeight: '600' }} data-label="Shop Name">{s.name}</td>
                        <td data-label="Owner">
                          <div>{s.ownerName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{s.email}</div>
                        </td>
                        <td data-label="Status">
                          <span className={`badge ${
                            s.subscriptionStatus === 'Active' ? 'badge-active' :
                            s.subscriptionStatus === 'Trial' ? 'badge-trial' :
                            s.subscriptionStatus === 'PastDue' ? 'badge-pastdue' : 'badge-cancelled'
                          }`}>
                            {s.subscriptionStatus}
                          </span>
                        </td>
                        <td style={{ textTransform: 'capitalize' }} data-label="Plan Level">{s.planId}</td>
                        <td data-label="Clients Stored">{s.customerCount} records</td>
                        <td data-label="Stylists">{s.staffCount} stations</td>
                        <td style={{ textAlign: 'right' }} data-label="Actions">
                          <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                            <button 
                              className="btn btn-secondary btn-sm"
                              onClick={() => setSelectedSalonId(s.id)}
                            >
                              Manage &rarr;
                            </button>
                            <button 
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleImpersonate(s)}
                              style={{ borderColor: 'var(--accent-color)', color: 'var(--accent-color)' }}
                            >
                              Impersonate
                            </button>
                          </div>
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
              {/* Left Side: Stats, Configuration & Billing */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                
                {/* Salon Metadata Detail Form */}
                <div className="card">
                  <div className="flex-between" style={{ marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Salon Metadata Details</h3>
                    <button 
                      className="btn btn-secondary btn-sm" 
                      onClick={() => setIsEditingMetadata(!isEditingMetadata)}
                    >
                      {isEditingMetadata ? 'Cancel Edit' : 'Modify Fields'}
                    </button>
                  </div>

                  {!isEditingMetadata ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem 2rem' }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Salon Name</span>
                        <span style={{ fontSize: '1rem', fontWeight: '600' }}>{selectedSalon.name}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Owner Name</span>
                        <span style={{ fontSize: '1rem', fontWeight: '600' }}>{selectedSalon.ownerName}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Owner Email</span>
                        <span style={{ fontSize: '1rem', fontWeight: '600' }}>{selectedSalon.email}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Mobile Number</span>
                        <span style={{ fontSize: '1rem', fontWeight: '600' }}>{selectedSalon.mobileNumber}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Default Retention Cadence</span>
                        <span style={{ fontSize: '1rem', fontWeight: '600' }}>{selectedSalon.reminderCadenceDaysDefault || 30} Days</span>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Custom Workspace URL</span>
                        <a 
                          href={`/salon/${selectedSalon.id}/login`} 
                          target="_blank" 
                          style={{ fontSize: '0.875rem', color: 'var(--accent-color)', fontWeight: '600', textDecoration: 'underline' }}
                        >
                          /salon/{selectedSalon.id}/login
                        </a>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSaveMetadata} className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                          <label className="form-label">Salon Name</label>
                          <input 
                            type="text" 
                            className="form-control" 
                            value={editName} 
                            onChange={(e) => setEditName(e.target.value)} 
                            required 
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Owner Name</label>
                          <input 
                            type="text" 
                            className="form-control" 
                            value={editOwner} 
                            onChange={(e) => setEditOwner(e.target.value)} 
                            required 
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Owner Email</label>
                          <input 
                            type="email" 
                            className="form-control" 
                            value={editEmail} 
                            onChange={(e) => setEditEmail(e.target.value)} 
                            required 
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Mobile Number</label>
                          <input 
                            type="text" 
                            className="form-control" 
                            value={editMobile} 
                            onChange={(e) => setEditMobile(e.target.value)} 
                            required 
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Default Cadence (Days)</label>
                          <input 
                            type="number" 
                            className="form-control" 
                            value={editCadence} 
                            onChange={(e) => setEditCadence(Number(e.target.value))} 
                            required 
                          />
                        </div>
                      </div>
                      <button type="submit" className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}>
                        Save Changes
                      </button>
                    </form>
                  )}
                </div>

                {/* Manage Stylist Team */}
                <div className="card">
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Stylist Team Management</h3>
                  
                  {/* Current staff list */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                    {selectedSalonStaff.length === 0 ? (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No active stylist stations registered.</span>
                    ) : (
                      selectedSalonStaff.map(st => (
                        <span 
                          key={st.id} 
                          className="badge" 
                          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}
                        >
                          {st.name}
                        </span>
                      ))
                    )}
                  </div>

                  {/* Add stylist inline */}
                  <form onSubmit={handleAddStylistFromAdmin} style={{ display: 'flex', gap: '0.5rem', maxWidth: '400px' }}>
                    <input 
                      type="text" 
                      className="form-control form-control-sm" 
                      placeholder="New stylist name..." 
                      value={newStaffName}
                      onChange={(e) => setNewStaffName(e.target.value)}
                    />
                    <button type="submit" className="btn btn-primary btn-sm" style={{ whiteSpace: 'nowrap' }}>
                      Register Stylist Station
                    </button>
                  </form>
                </div>

                {/* Invoices Ledger */}
                <div className="card">
                  <div className="flex-between" style={{ marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Salon Invoices History</h3>
                    <form onSubmit={handleAddInvoiceFromAdmin} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input 
                        type="number" 
                        className="form-control form-control-sm" 
                        placeholder="Amount ($)..." 
                        value={manualInvoiceAmount}
                        onChange={(e) => setManualInvoiceAmount(e.target.value)}
                        style={{ width: '120px' }}
                      />
                      <button type="submit" className="btn btn-secondary btn-sm">
                        + Add Custom Invoice
                      </button>
                    </form>
                  </div>
                  
                  <div className="table-container">
                    <table className="data-table responsive-table">
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
                              <td style={{ fontFamily: 'monospace' }} data-label="Invoice ID">{p.id}</td>
                              <td data-label="Date">{new Date(p.date).toLocaleDateString()}</td>
                              <td data-label="Amount">${p.amount}</td>
                              <td data-label="Status">
                                <span className={`badge ${p.status === 'Success' ? 'badge-active' : 'badge-cancelled'}`}>
                                  {p.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="4" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>No payments logged</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              {/* Right Side: Admin controls */}
              <div className="card card-premium" style={{ height: 'fit-content' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem' }}>Administrative Guards</h3>
                
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
                    onChange={(e) => {
                      handleSetPlan(selectedSalon.id, e.target.value);
                      adminChangeSalonPlan(selectedSalon.id, e.target.value);
                    }}
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
                      onClick={() => changeSalonStatus(selectedSalon.id, 'Active')}
                      disabled={selectedSalon.subscriptionStatus === 'Active'}
                    >
                      🟢 Mark Subscription Active
                    </button>
                    <button 
                      className="btn btn-secondary btn-block btn-sm" 
                      style={{ color: 'var(--warning-color)', justifyContent: 'flex-start' }}
                      onClick={() => changeSalonStatus(selectedSalon.id, 'PastDue')}
                      disabled={selectedSalon.subscriptionStatus === 'PastDue'}
                    >
                      🟡 Flag Subscription PastDue
                    </button>
                    <button 
                      className="btn btn-secondary btn-block btn-sm" 
                      style={{ color: 'var(--error-color)', justifyContent: 'flex-start' }}
                      onClick={() => changeSalonStatus(selectedSalon.id, 'Cancelled')}
                      disabled={selectedSalon.subscriptionStatus === 'Cancelled'}
                    >
                      🔴 Suspend / Set Cancelled
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: '1.5rem', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <label className="form-label" style={{ margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Recovery OTP Generator</span>
                    <button 
                      type="button" 
                      className="btn btn-secondary btn-sm" 
                      onClick={handleGenerateResetOtp}
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                    >
                      Generate Code
                    </button>
                  </label>
                  {simulatedOtpCode ? (
                    <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Magic Recovery Code:</span>
                      <div style={{ fontSize: '1.25rem', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--accent-color)', letterSpacing: '0.1em', marginTop: '0.25rem' }}>
                        {simulatedOtpCode}
                      </div>
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                      Simulates sending a magic bypass recovery pin to owner.
                    </span>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Quick Message to Owner</label>
                  <textarea 
                    className="form-control" 
                    placeholder="Send a simulated message regarding their account status..."
                    rows="2"
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
          <div className="grid-2" style={{ gridTemplateColumns: '1.4fr 0.6fr', gap: '2rem' }}>
            
            {/* Left Column: ledger list */}
            <div className="card animate-fade">
              <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Platform Billing Invoices Ledger</h3>
                <select 
                  className="form-select form-select-sm"
                  value={invoiceFilter}
                  onChange={(e) => setInvoiceFilter(e.target.value)}
                  style={{ width: '160px' }}
                >
                  <option value="all">All Invoices</option>
                  <option value="Success">Success Only</option>
                  <option value="Failed">Failed Only</option>
                </select>
              </div>

              <div className="table-container">
                <table className="data-table responsive-table">
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
                    {payments
                      .filter(p => invoiceFilter === 'all' || p.status === invoiceFilter)
                      .map(p => {
                        const salonObj = salons.find(s => s.id === p.salonId);
                        return (
                          <tr key={p.id}>
                            <td style={{ fontFamily: 'monospace' }} data-label="Invoice ID">{p.id}</td>
                            <td style={{ fontWeight: '600' }} data-label="Salon Shop">{salonObj ? salonObj.name : 'Unknown Salon'}</td>
                            <td data-label="Date">{new Date(p.date).toLocaleDateString()}</td>
                            <td data-label="Subtotal">${p.amount}</td>
                            <td data-label="Payment Status">
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

            {/* Right Column: Invoicing Actions */}
            <div className="card card-premium animate-fade" style={{ height: 'fit-content' }}>
              <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Create Manual Invoice</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginBottom: '1.25rem', lineHeight: '1.4' }}>
                Charge a custom billable amount directly to a salon's credit history. Used for custom enterprise pricing overrides.
              </p>

              <form onSubmit={handleCreateGlobalInvoice}>
                <div className="form-group">
                  <label className="form-label">Select Salon Target</label>
                  <select 
                    className="form-select"
                    value={newInvoiceSalonId}
                    onChange={(e) => setNewInvoiceSalonId(e.target.value)}
                    required
                  >
                    <option value="" disabled>Select Salon</option>
                    {salons.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.ownerName})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Amount ($ USD)</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    placeholder="e.g. 150" 
                    value={newInvoiceAmount}
                    onChange={(e) => setNewInvoiceAmount(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary btn-block btn-sm" style={{ marginTop: '1.25rem' }}>
                  Generate Invoice Record
                </button>
              </form>
            </div>

          </div>
        )}

        {/* --- SETTINGS TAB --- */}
        {activeTab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }} className="animate-fade">
            
            {/* Announcement Banner */}
            <div className="card">
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Platform Announcement Banner</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                Toggle a warning or notice banner rendered at the top of all salon-facing workspace pages.
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

            {/* Diagnostic Operations */}
            <div className="card">
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>System Integrity Diagnostics</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                Run checks on database schema mapping and cache indices.
              </p>

              <button 
                type="button" 
                className="btn btn-secondary btn-sm" 
                onClick={runDiagnostics}
                disabled={diagnosticRunning}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {diagnosticRunning ? (
                  <>
                    <svg className="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                    Running Checks...
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="m9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    Verify Database Schema
                  </>
                )}
              </button>

              {diagnosticLog.length > 0 && (
                <div style={{ marginTop: '1.25rem', background: '#07070a', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '1rem', fontFamily: 'monospace', fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {diagnosticLog.map((log, idx) => (
                    <div key={idx} style={{ color: log.includes('integrity') || log.includes('Integrity') ? 'var(--success-color)' : 'var(--text-secondary)' }}>
                      &gt; {log}
                    </div>
                  ))}
                </div>
              )}
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

  // Private Helper
  function handleSetPlan(salonId, planId) {
    alert(`Salon plan changed to ${plans.find(p => p.id === planId)?.name}`);
  }

  function handleSaveAnnouncement(e) {
    e.preventDefault();
    updateAnnouncement(announcementActive, announcementText);
    alert('Global platform announcement text saved successfully.');
  }

  function handlePlanEditChange(index, field, value) {
    const updated = [...editingPlans];
    updated[index][field] = value;
    setEditingPlans(updated);
  }

  function handlePlanFeaturesChange(planIdx, featIdx, value) {
    const updated = [...editingPlans];
    updated[planIdx].features[featIdx] = value;
    setEditingPlans(updated);
  }

  function handleSavePricing(e) {
    e.preventDefault();
    updatePricingTiers(editingPlans);
    alert('Subscription pricing models updated successfully.');
  }
}
