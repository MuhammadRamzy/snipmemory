"use client";

import React, { useState, useEffect, useRef } from 'react';
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

  // Inspector nested tabs
  const [inspectorTab, setInspectorTab] = useState('metadata'); // 'metadata' | 'staff' | 'invoices'

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

  // Live Console logs ticker state
  const [consoleLogs, setConsoleLogs] = useState([
    { id: 1, text: 'SYSTEM: Operator admin session authenticated.', type: 'info', time: '11:54:10' },
    { id: 2, text: 'R2 VAULT: 12 static assets loaded successfully.', type: 'success', time: '11:54:12' },
    { id: 3, text: 'DB: D1 schema mapping check matched default specs.', type: 'info', time: '11:54:15' }
  ]);

  const logIndexRef = useRef(4);

  // Simulate real-time console log events in the background
  useEffect(() => {
    const logTemplates = [
      { text: 'D1 DB: SELECT * FROM salons WHERE status = "Active" (12ms)', type: 'info' },
      { text: 'R2 STORAGE: GET bucket/visit-101-1_front.svg (304 status - cache hit)', type: 'success' },
      { text: 'CRON: WhatsApp retention reminder scanner completed. (0 queued)', type: 'info' },
      { text: 'API: Request PUT /api/salon/salon-classic/details - 200 OK (45ms)', type: 'info' },
      { text: 'AUTH: Access token refreshed for stylist station marcus', type: 'success' },
      { text: 'LEDGER: Auto-generated renewal invoice rec-4491-success ($79.00)', type: 'success' },
      { text: 'OTP SERVICE: 6-digit access code verified for user 2065550123', type: 'success' },
      { text: 'ANALYTICS: Re-calculated platform MRR target benchmark ($295/mo)', type: 'info' }
    ];

    const interval = setInterval(() => {
      const template = logTemplates[Math.floor(Math.random() * logTemplates.length)];
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      setConsoleLogs(prev => [
        ...prev,
        { id: logIndexRef.current++, text: template.text, type: template.type, time: timeStr }
      ].slice(-7)); // Keep last 7 logs
    }, 4000);

    return () => clearInterval(interval);
  }, []);

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
      setEditingPlans(JSON.parse(JSON.stringify(plans)));
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
  const simulatedR2StorageBytes = totalVisitsWithPhotos * 4 * 165 * 1024;
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0.00 KB';
    const k = 1024;
    const dm = 2;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const handleImpersonate = (salon) => {
    const confirmImpersonation = window.confirm(`Initiate administrative override session to impersonate owner of ${salon.name}?`);
    if (confirmImpersonation) {
      localStorage.setItem('snipmem_current_salon', JSON.stringify(salon));
      localStorage.setItem('snipmem_salon_mode', JSON.stringify('owner'));
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
    <div className="animate-fade admin-layout-root" style={{ display: 'flex', minHeight: '100vh', background: '#07080b', color: '#f3f4f6' }}>
      
      {/* Mobile Top Header */}
      <header className="admin-mobile-header" style={{ background: '#0b0c10', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="logo-brand">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: '#ec4899' }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          Snip<span style={{ color: '#fff' }}>Admin</span>
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
        <div className="admin-mobile-menu animate-slide" style={{ background: '#0b0c10', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
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

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button 
              className="btn btn-secondary btn-block btn-sm"
              onClick={() => { resetAllData(); setShowMobileMenu(false); }}
              style={{ borderColor: '#ef4444', color: '#ef4444' }}
            >
              Reset Platform DB
            </button>
            <button 
              className="btn btn-text btn-block btn-sm"
              onClick={() => { logout(); router.push('/admin/login'); }}
              style={{ color: '#9ca3af' }}
            >
              Logout Operator
            </button>
          </div>
        </div>
      )}

      {/* 1. Admin Sidebar Nav */}
      <aside className="admin-sidebar" style={{ background: '#0a0b10', borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '2rem 1.5rem', width: '270px', height: '100vh', position: 'fixed', top: 0, left: 0 }}>
        <div>
          <div className="logo-brand" style={{ marginBottom: '2.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1.25rem' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: '#ec4899' }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Snip<span style={{ color: '#fff' }}>Admin</span>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <button 
              className={`admin-nav-item btn-block ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => { setActiveTab('overview'); setSelectedSalonId(null); }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.9375rem', fontWeight: '600', color: activeTab === 'overview' ? '#ec4899' : '#9ca3af', backgroundColor: activeTab === 'overview' ? 'rgba(236, 72, 153, 0.08)' : 'transparent' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
              Overview
            </button>
            <button 
              className={`admin-nav-item btn-block ${activeTab === 'salons' ? 'active' : ''}`}
              onClick={() => { setActiveTab('salons'); }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.9375rem', fontWeight: '600', color: activeTab === 'salons' ? '#ec4899' : '#9ca3af', backgroundColor: activeTab === 'salons' ? 'rgba(236, 72, 153, 0.08)' : 'transparent' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Salons Database
            </button>
            <button 
              className={`admin-nav-item btn-block ${activeTab === 'billing' ? 'active' : ''}`}
              onClick={() => { setActiveTab('billing'); setSelectedSalonId(null); }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.9375rem', fontWeight: '600', color: activeTab === 'billing' ? '#ec4899' : '#9ca3af', backgroundColor: activeTab === 'billing' ? 'rgba(236, 72, 153, 0.08)' : 'transparent' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
              Billing Ledger
            </button>
            <button 
              className={`admin-nav-item btn-block ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => { setActiveTab('settings'); setSelectedSalonId(null); }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.9375rem', fontWeight: '600', color: activeTab === 'settings' ? '#ec4899' : '#9ca3af', backgroundColor: activeTab === 'settings' ? 'rgba(236, 72, 153, 0.08)' : 'transparent' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              Platform Settings
            </button>
          </nav>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.25rem' }}>
          <button 
            className="btn btn-secondary btn-block btn-sm"
            onClick={resetAllData}
            style={{ marginBottom: '0.75rem', borderColor: '#ef4444', color: '#ef4444', background: 'rgba(239, 68, 68, 0.05)', width: '100%' }}
          >
            Reset Database
          </button>
          <button 
            className="btn btn-text btn-block btn-sm"
            onClick={() => { logout(); router.push('/admin/login'); }}
            style={{ color: '#9ca3af', width: '100%', textAlign: 'left', padding: '0.5rem 0' }}
          >
            Logout Operator
          </button>
        </div>
      </aside>

      {/* 2. Admin Workspace Content */}
      <main className="admin-main" style={{ flex: 1, padding: '2.5rem', marginLeft: '270px', minHeight: '100vh', boxSizing: 'border-box' }}>
        
        {/* Header Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: '2.25rem', fontWeight: '800', letterSpacing: '-0.02em', margin: 0 }}>
              {activeTab === 'overview' && 'Command Dashboard'}
              {activeTab === 'salons' && (selectedSalonId ? 'Salon Account Manager' : 'Salons Registry')}
              {activeTab === 'billing' && 'Revenue Ledger'}
              {activeTab === 'settings' && 'Platform Settings'}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem' }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', background: '#10b981', borderRadius: '50%', boxShadow: '0 0 10px #10b981' }}></span>
              <span style={{ fontSize: '0.8125rem', color: '#10b981', fontWeight: '700', marginRight: '8px' }}>SYSTEMS OPERATIONAL</span>
              <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>| Logged in: {currentAdmin.email}</span>
            </div>
          </div>
          
          <button className="btn btn-secondary btn-sm" onClick={() => router.push('/')} style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            View Public Site
          </button>
        </div>

        {/* --- OVERVIEW TAB --- */}
        {activeTab === 'overview' && (
          <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            
            {/* Stat Counters Grid */}
            <div className="admin-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
              
              <div className="admin-stat-card card card-premium" style={{ background: '#11121b', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1.5rem' }}>
                <span className="admin-stat-label" style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Salons</span>
                <div className="admin-stat-value" style={{ fontSize: '2.25rem', fontWeight: '800', margin: '0.5rem 0', color: '#fff' }}>{totalSalons}</div>
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', margin: '0.65rem 0' }}>
                  <div style={{ width: `${(activeSalons / totalSalons) * 100}%`, height: '100%', background: '#10b981', borderRadius: '10px' }}></div>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>
                  {activeSalons} Active | {trialSalons} Trial | {pastDueSalons} Past Due
                </span>
              </div>

              <div className="admin-stat-card card card-premium" style={{ background: '#11121b', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1.5rem' }}>
                <span className="admin-stat-label" style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estimated MRR</span>
                <div className="admin-stat-value" style={{ fontSize: '2.25rem', fontWeight: '800', margin: '0.5rem 0', color: '#10b981' }}>${currentMrr}</div>
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', margin: '0.65rem 0' }}>
                  <div style={{ width: '70%', height: '100%', background: '#10b981', borderRadius: '10px' }}></div>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>
                  70% to monthly operational target
                </span>
              </div>

              <div className="admin-stat-card card card-premium" style={{ background: '#11121b', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1.5rem' }}>
                <span className="admin-stat-label" style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Global Visits</span>
                <div className="admin-stat-value" style={{ fontSize: '2.25rem', fontWeight: '800', margin: '0.5rem 0', color: '#fff' }}>{totalGlobalVisits}</div>
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', margin: '0.65rem 0' }}>
                  <div style={{ width: '85%', height: '100%', background: '#818cf8', borderRadius: '10px' }}></div>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>
                  {totalGlobalCustomers} registered style profiles
                </span>
              </div>

              <div className="admin-stat-card card card-premium" style={{ background: '#11121b', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1.5rem' }}>
                <span className="admin-stat-label" style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>R2 Media Footprint</span>
                <div className="admin-stat-value" style={{ fontSize: '2.25rem', fontWeight: '800', margin: '0.5rem 0', color: '#ec4899' }}>{formatBytes(simulatedR2StorageBytes)}</div>
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', margin: '0.65rem 0' }}>
                  <div style={{ width: `${(simulatedR2StorageBytes / (1024 * 1024 * 1024)) * 100}%`, height: '100%', background: '#ec4899', borderRadius: '10px' }}></div>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>
                  {totalVisitsWithPhotos * 4} alignment photos stored
                </span>
              </div>
            </div>

            {/* Live Terminal & Diagnostics */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem', alignItems: 'stretch' }}>
              
              {/* Operator Live Terminal Logs (MONOSPACED, DYNAMIC LOGGING DISPLAY) */}
              <div className="card" style={{ background: '#0b0c13', border: '1px solid rgba(255,255,255,0.05)', padding: '1.75rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '800', margin: 0 }}>System Logs Terminal Ticker</h3>
                    <span style={{ fontSize: '0.7rem', color: '#10b981', padding: '0.2rem 0.5rem', background: 'rgba(16,185,129,0.1)', borderRadius: '4px', fontWeight: '700' }}>LIVE STREAMING</span>
                  </div>
                  
                  <div style={{ background: '#050508', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '1.25rem', fontFamily: 'monospace', fontSize: '0.8125rem', minHeight: '210px', display: 'flex', flexDirection: 'column', gap: '0.6rem', boxSizing: 'border-box' }}>
                    {consoleLogs.map(log => (
                      <div key={log.id} style={{ display: 'flex', gap: '0.75rem', lineHeight: '1.4' }} className="animate-slide">
                        <span style={{ color: '#4b5563' }}>[{log.time}]</span>
                        <span style={{ color: log.type === 'success' ? '#10b981' : '#a5b4fc' }}>
                          {log.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '1rem', display: 'block' }}>
                  Diagnostic event listeners automatically aggregate telemetry from API gateways.
                </span>
              </div>

              {/* R2 storage limits container */}
              <div className="card" style={{ background: '#11121c', border: '1px solid rgba(255,255,255,0.05)', padding: '1.75rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '800', marginBottom: '0.5rem' }}>Cloudflare R2 Storage Quotas</h3>
                  <p style={{ color: '#94a3b8', fontSize: '0.8125rem', lineHeight: '1.4', marginBottom: '1.25rem' }}>
                    Verify visual alignment data limits. Clean or purge cache files if limits are exceeded.
                  </p>
                  
                  <div style={{ background: '#090a0f', padding: '1.25rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)', marginBottom: '1.25rem' }}>
                    <div className="flex-between" style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                      <span style={{ color: '#94a3b8' }}>Global Volume</span>
                      <strong style={{ color: '#fff' }}>{formatBytes(simulatedR2StorageBytes)} / 5.0 GB</strong>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '5px', overflow: 'hidden' }}>
                      <div style={{ 
                        width: `${Math.max(4, (simulatedR2StorageBytes / (5 * 1024 * 1024 * 1024)) * 100)}%`, 
                        height: '100%', 
                        background: '#ec4899' 
                      }} />
                    </div>
                    <div className="flex-between" style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#64748b' }}>
                      <span>Class A Writes: {totalVisitsWithPhotos * 4}</span>
                      <span>Class B Reads: {totalVisitsWithPhotos * 18}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-secondary btn-block btn-sm" onClick={() => alert('Storage cache index flushed successfully!')}>
                    Flush Cache
                  </button>
                  <button className="btn btn-primary btn-block btn-sm" onClick={runDiagnostics}>
                    Run Checks
                  </button>
                </div>
              </div>

            </div>

            {/* Quick Impersonation and Signup Trend Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              
              <div className="card" style={{ background: '#11121c', padding: '1.75rem', borderRadius: '16px' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '800', marginBottom: '0.5rem' }}>Salon Impersonation Portal</h3>
                <p style={{ color: '#94a3b8', fontSize: '0.8125rem', marginBottom: '1.5rem' }}>
                  Launch client session bypass keys to override tenant portals and debug salon owner accounts.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {salons.slice(0, 3).map(s => (
                    <div key={s.id} className="flex-between" style={{ padding: '0.75rem 1rem', background: '#090a0f', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div>
                        <strong style={{ fontSize: '0.875rem', color: '#fff' }}>{s.name}</strong>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '10px' }}>Owner: {s.ownerName}</span>
                      </div>
                      <button 
                        className="btn btn-secondary btn-sm" 
                        onClick={() => handleImpersonate(s)}
                        style={{ fontSize: '0.75rem', borderColor: '#ec4899', color: '#ec4899' }}
                      >
                        Override Session &rarr;
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Vector Bar Chart (STYLISH CSS/SVG METRIC CHART) */}
              <div className="card" style={{ background: '#11121c', padding: '1.75rem', borderRadius: '16px' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '800', marginBottom: '0.5rem' }}>Monthly Salon Registrations</h3>
                <p style={{ color: '#94a3b8', fontSize: '0.8125rem', marginBottom: '1.5rem' }}>
                  Shop subscription acquisitions plotted across calendar quarters.
                </p>
                
                <div style={{ height: '140px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', position: 'relative' }}>
                  
                  {/* Grid Lines */}
                  <div style={{ position: 'absolute', left: 0, right: 0, top: '25%', borderTop: '1px dashed rgba(255,255,255,0.05)', height: 0 }} />
                  <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', borderTop: '1px dashed rgba(255,255,255,0.05)', height: 0 }} />
                  <div style={{ position: 'absolute', left: 0, right: 0, top: '75%', borderTop: '1px dashed rgba(255,255,255,0.05)', height: 0 }} />

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', zIndex: 1 }}>
                    <div style={{ width: '100%', height: '15px', background: 'linear-gradient(to top, #6366f1, #818cf8)', borderRadius: '4px 4px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '0.55rem', fontWeight: 'bold' }}>1</span>
                    </div>
                    <span style={{ fontSize: '#64748b', fontSize: '0.7rem' }}>Q1</span>
                  </div>
                  
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', zIndex: 1 }}>
                    <div style={{ width: '100%', height: '40px', background: 'linear-gradient(to top, #6366f1, #818cf8)', borderRadius: '4px 4px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '0.55rem', fontWeight: 'bold' }}>3</span>
                    </div>
                    <span style={{ fontSize: '#64748b', fontSize: '0.7rem' }}>Q2</span>
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', zIndex: 1 }}>
                    <div style={{ width: '100%', height: '90px', background: 'linear-gradient(to top, #ec4899, #f472b6)', borderRadius: '4px 4px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '0.55rem', fontWeight: 'bold' }}>8</span>
                    </div>
                    <span style={{ fontSize: '#64748b', fontSize: '0.7rem' }}>Q3 (Cur)</span>
                  </div>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* --- SALONS TAB --- */}
        {activeTab === 'salons' && !selectedSalonId && (
          <div className="card animate-fade" style={{ background: '#11121c', padding: '2rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            
            {/* Filters Bar */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Search salons or owners..."
                value={salonSearch}
                onChange={(e) => setSalonSearch(e.target.value)}
                style={{ flex: 2, minWidth: '220px', background: '#090a0f', borderColor: 'rgba(255,255,255,0.1)' }}
              />
              <select 
                className="form-select" 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ flex: 1, minWidth: '130px', background: '#090a0f', color: '#fff', borderColor: 'rgba(255,255,255,0.1)' }}
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
                style={{ flex: 1, minWidth: '130px', background: '#090a0f', color: '#fff', borderColor: 'rgba(255,255,255,0.1)' }}
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
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <th style={{ cursor: 'pointer', padding: '1rem' }} onClick={() => toggleSalonSort('name')}>
                        Shop Name {salonSortKey === 'name' ? (salonSortOrder === 'asc' ? '▲' : '▼') : ''}
                      </th>
                      <th style={{ padding: '1rem' }}>Owner</th>
                      <th style={{ padding: '1rem' }}>Status</th>
                      <th style={{ padding: '1rem' }}>Plan Level</th>
                      <th style={{ cursor: 'pointer', padding: '1rem' }} onClick={() => toggleSalonSort('customerCount')}>
                        Clients Stored {salonSortKey === 'customerCount' ? (salonSortOrder === 'asc' ? '▲' : '▼') : ''}
                      </th>
                      <th style={{ padding: '1rem' }}>Stylists</th>
                      <th style={{ textAlign: 'right', padding: '1rem' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSalons.map(s => (
                      <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ fontWeight: '600', padding: '1.25rem 1rem' }} data-label="Shop Name">{s.name}</td>
                        <td style={{ padding: '1.25rem 1rem' }} data-label="Owner">
                          <div style={{ color: '#fff', fontWeight: '500' }}>{s.ownerName}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{s.email}</div>
                        </td>
                        <td style={{ padding: '1.25rem 1rem' }} data-label="Status">
                          <span className={`badge ${
                            s.subscriptionStatus === 'Active' ? 'badge-active' :
                            s.subscriptionStatus === 'Trial' ? 'badge-trial' :
                            s.subscriptionStatus === 'PastDue' ? 'badge-pastdue' : 'badge-cancelled'
                          }`} style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem', borderRadius: '4px' }}>
                            {s.subscriptionStatus}
                          </span>
                        </td>
                        <td style={{ textTransform: 'capitalize', padding: '1.25rem 1rem' }} data-label="Plan Level">{s.planId}</td>
                        <td style={{ padding: '1.25rem 1rem' }} data-label="Clients Stored">{s.customerCount} records</td>
                        <td style={{ padding: '1.25rem 1rem' }} data-label="Stylists">{s.staffCount} stations</td>
                        <td style={{ textAlign: 'right', padding: '1.25rem 1rem' }} data-label="Actions">
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                            <button 
                              className="btn btn-secondary btn-sm"
                              onClick={() => setSelectedSalonId(s.id)}
                            >
                              Manage &rarr;
                            </button>
                            <button 
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleImpersonate(s)}
                              style={{ borderColor: '#ec4899', color: '#ec4899', background: 'rgba(236,72,153,0.04)' }}
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
                <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                  No salons found matching the current search parameters.
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- SALONS INSPECTOR DETAIL VIEW (TABS SELECTOR ADDED) --- */}
        {activeTab === 'salons' && selectedSalonId && selectedSalon && (
          <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedSalonId(null)} style={{ alignSelf: 'flex-start', borderColor: 'rgba(255,255,255,0.1)' }}>
              &larr; Return to Database List
            </button>

            {/* Inspector Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.7fr', gap: '2rem', alignItems: 'stretch' }}>
              
              {/* Left Column: Tabbed View for detailed inspection */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* Inspector Nested Tab Bar */}
                <div style={{ display: 'flex', gap: '0.5rem', background: '#11121c', padding: '0.35rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <button 
                    className="btn btn-sm" 
                    onClick={() => setInspectorTab('metadata')}
                    style={{ flex: 1, borderRadius: '6px', background: inspectorTab === 'metadata' ? '#ec4899' : 'transparent', color: '#fff', border: 'none', padding: '0.55rem 0' }}
                  >
                    Workspace Details
                  </button>
                  <button 
                    className="btn btn-sm" 
                    onClick={() => setInspectorTab('staff')}
                    style={{ flex: 1, borderRadius: '6px', background: inspectorTab === 'staff' ? '#ec4899' : 'transparent', color: '#fff', border: 'none', padding: '0.55rem 0' }}
                  >
                    Stylists Team ({selectedSalonStaff.length})
                  </button>
                  <button 
                    className="btn btn-sm" 
                    onClick={() => setInspectorTab('invoices')}
                    style={{ flex: 1, borderRadius: '6px', background: inspectorTab === 'invoices' ? '#ec4899' : 'transparent', color: '#fff', border: 'none', padding: '0.55rem 0' }}
                  >
                    Invoices Ledger ({selectedSalonPayments.length})
                  </button>
                </div>

                {/* Sub Tab Content: 1. Workspace Details */}
                {inspectorTab === 'metadata' && (
                  <div className="card animate-fade" style={{ background: '#11121c', padding: '2rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="flex-between" style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
                      <h3 style={{ fontSize: '1.25rem', margin: 0, fontWeight: '800' }}>General Metadata Config</h3>
                      <button 
                        className="btn btn-secondary btn-sm" 
                        onClick={() => setIsEditingMetadata(!isEditingMetadata)}
                        style={{ fontSize: '0.75rem' }}
                      >
                        {isEditingMetadata ? 'Cancel Edit' : 'Edit Configuration'}
                      </button>
                    </div>

                    {!isEditingMetadata ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem 2rem' }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: '700' }}>Salon Shop Name</span>
                          <span style={{ fontSize: '1rem', fontWeight: '600', color: '#fff' }}>{selectedSalon.name}</span>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: '700' }}>Owner Name</span>
                          <span style={{ fontSize: '1rem', fontWeight: '600', color: '#fff' }}>{selectedSalon.ownerName}</span>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: '700' }}>Owner Email Address</span>
                          <span style={{ fontSize: '1rem', fontWeight: '600', color: '#fff' }}>{selectedSalon.email}</span>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: '700' }}>Mobile Contact</span>
                          <span style={{ fontSize: '1rem', fontWeight: '600', color: '#fff' }}>{selectedSalon.mobileNumber}</span>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: '700' }}>Default Retention cadence</span>
                          <span style={{ fontSize: '1rem', fontWeight: '600', color: '#fff' }}>{selectedSalon.reminderCadenceDaysDefault || 30} Days</span>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: '700' }}>Client Workspace Address</span>
                          <a 
                            href={`/salon/${selectedSalon.id}/login`} 
                            target="_blank" 
                            style={{ fontSize: '0.875rem', color: '#818cf8', fontWeight: '600', textDecoration: 'underline' }}
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
                )}

                {/* Sub Tab Content: 2. Stylists Team */}
                {inspectorTab === 'staff' && (
                  <div className="card animate-fade" style={{ background: '#11121c', padding: '2rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', fontWeight: '800' }}>Active Stylist Stations</h3>
                    
                    <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
                      {selectedSalonStaff.length === 0 ? (
                        <span style={{ color: '#64748b', fontSize: '0.875rem' }}>No staff stations registered yet.</span>
                      ) : (
                        selectedSalonStaff.map(st => (
                          <div 
                            key={st.id} 
                            style={{ background: '#090a0f', border: '1px solid rgba(255,255,255,0.06)', padding: '0.6rem 1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                          >
                            <span style={{ width: '8px', height: '8px', background: '#818cf8', borderRadius: '50%' }}></span>
                            <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff' }}>{st.name}</span>
                          </div>
                        ))
                      )}
                    </div>

                    <form onSubmit={handleAddStylistFromAdmin} style={{ display: 'flex', gap: '0.5rem', maxWidth: '450px' }}>
                      <input 
                        type="text" 
                        className="form-control form-control-sm" 
                        placeholder="Stylist name..." 
                        value={newStaffName}
                        onChange={(e) => setNewStaffName(e.target.value)}
                        style={{ background: '#090a0f', borderColor: 'rgba(255,255,255,0.1)' }}
                      />
                      <button type="submit" className="btn btn-primary btn-sm" style={{ whiteSpace: 'nowrap' }}>
                        Register Stylist
                      </button>
                    </form>
                  </div>
                )}

                {/* Sub Tab Content: 3. Invoices Ledger */}
                {inspectorTab === 'invoices' && (
                  <div className="card animate-fade" style={{ background: '#11121c', padding: '2rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
                      <h3 style={{ fontSize: '1.25rem', margin: 0, fontWeight: '800' }}>Invoice History</h3>
                      
                      <form onSubmit={handleAddInvoiceFromAdmin} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input 
                          type="number" 
                          className="form-control form-control-sm" 
                          placeholder="Amt ($)..." 
                          value={manualInvoiceAmount}
                          onChange={(e) => setManualInvoiceAmount(e.target.value)}
                          style={{ width: '100px', background: '#090a0f', borderColor: 'rgba(255,255,255,0.1)' }}
                        />
                        <button type="submit" className="btn btn-secondary btn-sm" style={{ whiteSpace: 'nowrap' }}>
                          + Add Invoice
                        </button>
                      </form>
                    </div>

                    <div className="table-container">
                      <table className="data-table responsive-table">
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                            <th style={{ padding: '0.75rem' }}>Invoice ID</th>
                            <th style={{ padding: '0.75rem' }}>Billing Date</th>
                            <th style={{ padding: '0.75rem' }}>Amount</th>
                            <th style={{ padding: '0.75rem' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedSalonPayments.length > 0 ? (
                            selectedSalonPayments.map(p => (
                              <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ fontFamily: 'monospace', padding: '1rem 0.75rem' }} data-label="Invoice ID">{p.id}</td>
                                <td style={{ padding: '1rem 0.75rem' }} data-label="Date">{new Date(p.date).toLocaleDateString()}</td>
                                <td style={{ padding: '1rem 0.75rem' }} data-label="Amount">${p.amount}</td>
                                <td style={{ padding: '1rem 0.75rem' }} data-label="Status">
                                  <span className={`badge ${p.status === 'Success' ? 'badge-active' : 'badge-cancelled'}`}>
                                    {p.status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="4" style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>No invoices logged for this account.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>

              {/* Right Column: Administrative Actions Panel */}
              <div className="card card-premium" style={{ background: '#11121c', padding: '2rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', height: 'fit-content' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', fontWeight: '800' }}>Access Controls</h3>
                
                <div style={{ marginBottom: '1.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', display: 'block', fontWeight: '700' }}>Active Target</span>
                  <strong style={{ fontSize: '1.125rem', color: '#fff' }}>{selectedSalon.name}</strong>
                  <span style={{ display: 'block', fontSize: '0.8125rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                    Owner: {selectedSalon.ownerName}
                  </span>
                </div>

                <hr style={{ borderColor: 'rgba(255,255,255,0.05)', margin: '1.25rem 0' }} />

                <div className="form-group">
                  <label className="form-label" style={{ color: '#cbd5e1' }}>Modify Plan Level</label>
                  <select 
                    className="form-select"
                    value={selectedSalon.planId}
                    onChange={(e) => {
                      handleSetPlan(selectedSalon.id, e.target.value);
                      adminChangeSalonPlan(selectedSalon.id, e.target.value);
                    }}
                    style={{ background: '#090a0f', color: '#fff', borderColor: 'rgba(255,255,255,0.1)' }}
                  >
                    <option value="starter">Starter</option>
                    <option value="growth">Growth</option>
                    <option value="pro">Pro</option>
                  </select>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label" style={{ color: '#cbd5e1' }}>Set Status Flag Override</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <button 
                      className="btn btn-secondary btn-block btn-sm" 
                      style={{ color: '#10b981', justifyContent: 'flex-start', background: 'rgba(16,185,129,0.04)' }}
                      onClick={() => changeSalonStatus(selectedSalon.id, 'Active')}
                      disabled={selectedSalon.subscriptionStatus === 'Active'}
                    >
                      🟢 Mark Active
                    </button>
                    <button 
                      className="btn btn-secondary btn-block btn-sm" 
                      style={{ color: '#f59e0b', justifyContent: 'flex-start', background: 'rgba(245,158,11,0.04)' }}
                      onClick={() => changeSalonStatus(selectedSalon.id, 'PastDue')}
                      disabled={selectedSalon.subscriptionStatus === 'PastDue'}
                    >
                      🟡 Flag PastDue
                    </button>
                    <button 
                      className="btn btn-secondary btn-block btn-sm" 
                      style={{ color: '#ef4444', justifyContent: 'flex-start', background: 'rgba(239,68,68,0.04)' }}
                      onClick={() => changeSalonStatus(selectedSalon.id, 'Cancelled')}
                      disabled={selectedSalon.subscriptionStatus === 'Cancelled'}
                    >
                      🔴 Suspend Account
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: '1.5rem', background: '#090a0f', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <label className="form-label" style={{ margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Recovery OTP Generator</span>
                    <button 
                      type="button" 
                      className="btn btn-secondary btn-sm" 
                      onClick={handleGenerateResetOtp}
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                    >
                      Generate
                    </button>
                  </label>
                  {simulatedOtpCode ? (
                    <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Magic Bypass Passcode:</span>
                      <div style={{ fontSize: '1.25rem', fontFamily: 'monospace', fontWeight: 'bold', color: '#ec4899', letterSpacing: '0.1em', marginTop: '0.25rem' }}>
                        {simulatedOtpCode}
                      </div>
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginTop: '0.25rem' }}>
                      Generates bypass passcode to override login page.
                    </span>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ color: '#cbd5e1' }}>Send Global System Notice</label>
                  <textarea 
                    className="form-control" 
                    placeholder="Type system notice message here..."
                    rows="2"
                    style={{ background: '#090a0f', borderColor: 'rgba(255,255,255,0.1)' }}
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
          <div className="animate-fade" style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.6fr', gap: '2rem' }}>
            
            {/* Left Column: ledger list */}
            <div className="card" style={{ background: '#11121c', padding: '2rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', margin: 0, fontWeight: '800' }}>Platform Billing Invoices Ledger</h3>
                <select 
                  className="form-select form-select-sm"
                  value={invoiceFilter}
                  onChange={(e) => setInvoiceFilter(e.target.value)}
                  style={{ width: '160px', background: '#090a0f', color: '#fff', borderColor: 'rgba(255,255,255,0.1)' }}
                >
                  <option value="all">All Invoices</option>
                  <option value="Success">Success Only</option>
                  <option value="Failed">Failed Only</option>
                </select>
              </div>

              <div className="table-container">
                <table className="data-table responsive-table">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <th style={{ padding: '0.75rem' }}>Invoice ID</th>
                      <th style={{ padding: '0.75rem' }}>Salon Shop</th>
                      <th style={{ padding: '0.75rem' }}>Date</th>
                      <th style={{ padding: '0.75rem' }}>Subtotal</th>
                      <th style={{ padding: '0.75rem' }}>Payment Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments
                      .filter(p => invoiceFilter === 'all' || p.status === invoiceFilter)
                      .map(p => {
                        const salonObj = salons.find(s => s.id === p.salonId);
                        return (
                          <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ fontFamily: 'monospace', padding: '1rem 0.75rem' }} data-label="Invoice ID">{p.id}</td>
                            <td style={{ fontWeight: '600', padding: '1rem 0.75rem' }} data-label="Salon Shop">{salonObj ? salonObj.name : 'Unknown Salon'}</td>
                            <td style={{ padding: '1rem 0.75rem' }} data-label="Date">{new Date(p.date).toLocaleDateString()}</td>
                            <td style={{ padding: '1rem 0.75rem' }} data-label="Subtotal">${p.amount}</td>
                            <td style={{ padding: '1rem 0.75rem' }} data-label="Payment Status">
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
            <div className="card card-premium" style={{ background: '#11121c', padding: '2rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', height: 'fit-content' }}>
              <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem', fontWeight: '800' }}>Create Manual Invoice</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.8125rem', marginBottom: '1.25rem', lineHeight: '1.4' }}>
                Charge a custom billable amount directly to a salon's credit history. Used for custom enterprise pricing overrides.
              </p>

              <form onSubmit={handleCreateGlobalInvoice}>
                <div className="form-group">
                  <label className="form-label" style={{ color: '#cbd5e1' }}>Select Salon Target</label>
                  <select 
                    className="form-select"
                    value={newInvoiceSalonId}
                    onChange={(e) => setNewInvoiceSalonId(e.target.value)}
                    required
                    style={{ background: '#090a0f', color: '#fff', borderColor: 'rgba(255,255,255,0.1)' }}
                  >
                    <option value="" disabled>Select Salon</option>
                    {salons.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.ownerName})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ color: '#cbd5e1' }}>Amount ($ USD)</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    placeholder="e.g. 150" 
                    value={newInvoiceAmount}
                    onChange={(e) => setNewInvoiceAmount(e.target.value)}
                    required
                    style={{ background: '#090a0f', borderColor: 'rgba(255,255,255,0.1)' }}
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
            <div className="card" style={{ background: '#11121c', padding: '2rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', fontWeight: '800' }}>Platform Announcement Banner</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                Toggle a warning or notice banner rendered at the top of all salon-facing workspace pages.
              </p>

              <form onSubmit={handleSaveAnnouncement}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input 
                      type="checkbox"
                      checked={announcementActive}
                      onChange={(e) => setAnnouncementActive(e.target.checked)}
                      style={{ cursor: 'pointer', accentColor: '#ec4899' }}
                    />
                    <span>Enable banner display</span>
                  </label>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ color: '#cbd5e1' }}>Banner Message Text</label>
                  <input
                    type="text"
                    className="form-control"
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    required
                    style={{ background: '#090a0f', borderColor: 'rgba(255,255,255,0.1)' }}
                  />
                </div>

                <button type="submit" className="btn btn-primary btn-sm">
                  Save Announcement Config
                </button>
              </form>
            </div>

            {/* Diagnostic Operations */}
            <div className="card" style={{ background: '#11121c', padding: '2rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', fontWeight: '800' }}>System Integrity Diagnostics</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                Run checks on database schema mapping and cache indices.
              </p>

              <button 
                type="button" 
                className="btn btn-secondary btn-sm" 
                onClick={runDiagnostics}
                disabled={diagnosticRunning}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', borderColor: 'rgba(255,255,255,0.1)' }}
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
                <div style={{ marginTop: '1.25rem', background: '#07070a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '1rem', fontFamily: 'monospace', fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {diagnosticLog.map((log, idx) => (
                    <div key={idx} style={{ color: log.includes('integrity') || log.includes('Integrity') ? '#10b981' : '#cbd5e1' }}>
                      &gt; {log}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pricing Tier Settings */}
            <div className="card" style={{ background: '#11121c', padding: '2rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', fontWeight: '800' }}>Pricing Tiers Configurator</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '2rem' }}>
                Configure the subscription plans shown on the public marketing page.
              </p>

              <form onSubmit={handleSavePricing}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                  {editingPlans.map((p, pIdx) => (
                    <div key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1.5rem' }}>
                      <h4 style={{ fontSize: '1.125rem', color: '#ec4899', marginBottom: '1rem', textTransform: 'capitalize', fontWeight: '800' }}>
                        {p.name} Tier
                      </h4>
                      
                      <div className="grid-4" style={{ gap: '1rem' }}>
                        <div className="form-group">
                          <label className="form-label" style={{ color: '#cbd5e1' }}>Plan Name</label>
                          <input 
                            type="text" 
                            className="form-control" 
                            value={p.name}
                            onChange={(e) => handlePlanEditChange(pIdx, 'name', e.target.value)}
                            style={{ background: '#090a0f', borderColor: 'rgba(255,255,255,0.1)' }}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label" style={{ color: '#cbd5e1' }}>Price Monthly ($)</label>
                          <input 
                            type="number" 
                            className="form-control" 
                            value={p.priceMonthly}
                            onChange={(e) => handlePlanEditChange(pIdx, 'priceMonthly', Number(e.target.value))}
                            style={{ background: '#090a0f', borderColor: 'rgba(255,255,255,0.1)' }}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label" style={{ color: '#cbd5e1' }}>Price Annual ($)</label>
                          <input 
                            type="number" 
                            className="form-control" 
                            value={p.priceAnnual}
                            onChange={(e) => handlePlanEditChange(pIdx, 'priceAnnual', Number(e.target.value))}
                            style={{ background: '#090a0f', borderColor: 'rgba(255,255,255,0.1)' }}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label" style={{ color: '#cbd5e1' }}>Client Limit (-1 = Unlimited)</label>
                          <input 
                            type="number" 
                            className="form-control" 
                            value={p.customerLimit}
                            onChange={(e) => handlePlanEditChange(pIdx, 'customerLimit', Number(e.target.value))}
                            style={{ background: '#090a0f', borderColor: 'rgba(255,255,255,0.1)' }}
                          />
                        </div>
                      </div>

                      {/* Feature rows */}
                      <div style={{ marginTop: '0.75rem' }}>
                        <label className="form-label" style={{ color: '#cbd5e1' }}>Bullet Highlights</label>
                        <div className="grid-3" style={{ gap: '0.75rem' }}>
                          {p.features.map((feat, fIdx) => (
                            <input 
                              key={fIdx}
                              type="text"
                              className="form-control"
                              value={feat}
                              onChange={(e) => handlePlanFeaturesChange(pIdx, fIdx, e.target.value)}
                              style={{ fontSize: '0.8125rem', background: '#090a0f', borderColor: 'rgba(255,255,255,0.1)' }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button type="submit" className="btn btn-primary btn-sm" style={{ marginTop: '1.5rem' }}>
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
