"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../context/AppContext';

export default function OwnerDashboard({ tab }) {
  const router = useRouter();
  const { 
    currentSalon, 
    customers, 
    visits, 
    staff, 
    payments, 
    reminderLogs,
    plans,
    theme,
    setTheme,
    addStaffMember,
    removeStaffMember,
    changeSubscription,
    sendReminderLog,
    updateSalonSettings
  } = useApp();

  // Settings states
  const [newStylistName, setNewStylistName] = useState('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradePlanId, setUpgradePlanId] = useState('');

  // General settings state
  const [salonName, setSalonName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [salonAddress, setSalonAddress] = useState('');
  const [reminderCadence, setReminderCadence] = useState(30);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Sync state values when currentSalon is populated or switched
  useEffect(() => {
    if (currentSalon) {
      setSalonName(currentSalon.name || '');
      setOwnerName(currentSalon.ownerName || '');
      setSalonAddress(currentSalon.address || '');
      setReminderCadence(currentSalon.reminderCadenceDaysDefault || 30);
    }
  }, [currentSalon]);

  // Clients table search/sort
  const [clientSearch, setClientSearch] = useState('');
  const [clientSortKey, setClientSortKey] = useState('name'); 
  const [clientSortOrder, setClientSortOrder] = useState('asc'); 

  // Reminders sending modal
  const [activeReminderCustomer, setActiveReminderCustomer] = useState(null);
  const [reminderMessage, setReminderMessage] = useState('');
  const [reminderSuccessMessage, setReminderSuccessMessage] = useState('');

  const handleSaveGeneralSettings = (e) => {
    e.preventDefault();
    updateSalonSettings(salonName, ownerName, salonAddress, reminderCadence);
    setSettingsSuccess(true);
    setTimeout(() => {
      setSettingsSuccess(false);
    }, 4000);
  };

  if (!currentSalon) return null;

  // --- 1. Filter Salon specific data ---
  const salonCustomers = customers.filter(c => c.salonId === currentSalon.id);
  const salonStaff = staff.filter(s => s.salonId === currentSalon.id);
  const salonVisits = visits.filter(v => salonCustomers.some(c => c.id === v.customerId));
  const salonReminders = reminderLogs.filter(r => r.salonId === currentSalon.id);
  const salonPayments = payments.filter(p => p.salonId === currentSalon.id);

  // --- 2. Calculate Dashboard Statistics ---
  const totalClientsCount = salonCustomers.length;
  const visitsThisMonthCount = salonVisits.filter(v => {
    const visitDate = new Date(v.date);
    const now = new Date();
    return visitDate.getMonth() === now.getMonth() && visitDate.getFullYear() === now.getFullYear();
  }).length;

  const dueCustomers = salonCustomers.filter(c => {
    const custVisits = salonVisits.filter(v => v.customerId === c.id);
    if (custVisits.length === 0) return false; 

    const sortedVisits = [...custVisits].sort((a, b) => new Date(b.date) - new Date(a.date));
    const lastVisitDate = new Date(sortedVisits[0].date);
    
    const diffTime = Math.abs(new Date() - lastVisitDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays >= currentSalon.reminderCadenceDaysDefault;
  });

  const upcomingRemindersCount = dueCustomers.length;

  // --- 3. Process Customer List Grid Data ---
  const customerListWithStats = salonCustomers.map(c => {
    const custVisits = salonVisits.filter(v => v.customerId === c.id);
    const sortedVisits = [...custVisits].sort((a, b) => new Date(b.date) - new Date(a.date));
    const lastVisit = sortedVisits[0] ? new Date(sortedVisits[0].date) : null;
    return {
      ...c,
      visitCount: custVisits.length,
      lastVisit
    };
  });

  const filteredClients = customerListWithStats.filter(c => 
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.mobileNumber.includes(clientSearch)
  );

  const sortedClients = [...filteredClients].sort((a, b) => {
    let aVal = a[clientSortKey];
    let bVal = b[clientSortKey];

    if (clientSortKey === 'lastVisit') {
      aVal = a.lastVisit ? a.lastVisit.getTime() : 0;
      bVal = b.lastVisit ? b.lastVisit.getTime() : 0;
    }

    if (aVal < bVal) return clientSortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return clientSortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const toggleSort = (key) => {
    if (clientSortKey === key) {
      setClientSortOrder(clientSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setClientSortKey(key);
      setClientSortOrder('asc');
    }
  };

  // --- 4. Reminders operations ---
  const handleOpenReminder = (customer) => {
    setActiveReminderCustomer(customer);
    setReminderMessage(
      `Hey ${customer.name}! It has been ${currentSalon.reminderCadenceDaysDefault} days since your last haircut at ${currentSalon.name}. Ready for a fresh trim? Book your station slot here: snip.mem/${currentSalon.id}`
    );
  };

  const handleSendReminderSubmit = (e) => {
    e.preventDefault();
    sendReminderLog(activeReminderCustomer.id, reminderMessage);
    
    setReminderSuccessMessage(`Mock WhatsApp reminder sent successfully to ${activeReminderCustomer.name}!`);
    setActiveReminderCustomer(null);

    setTimeout(() => {
      setReminderSuccessMessage('');
    }, 4000);
  };

  // --- 5. Stylist Station roster ---
  const handleAddStylistSubmit = (e) => {
    e.preventDefault();
    if (!newStylistName.trim()) return;
    addStaffMember(newStylistName.trim());
    setNewStylistName('');
  };

  // --- 6. Billing/Plan change ---
  const handleUpgradeSubmit = (e) => {
    e.preventDefault();
    if (!upgradePlanId) return;
    changeSubscription(upgradePlanId);
    setShowUpgradeModal(false);
    alert(`Successfully changed plan to ${plans.find(p => p.id === upgradePlanId)?.name}!`);
  };

  return (
    <div className="animate-fade">
      
      {/* Toast Alert Banner */}
      {reminderSuccessMessage && (
        <div style={{ position: 'fixed', top: '1rem', right: '1rem', background: 'var(--success-soft)', border: '1px solid var(--success-color)', color: 'var(--success-color)', padding: '1rem 1.5rem', borderRadius: '8px', zIndex: 1000, boxShadow: 'var(--shadow-lg)' }} className="animate-slide">
          🟢 {reminderSuccessMessage}
        </div>
      )}

      {/* --- METRICS VIEW --- */}
      {tab === 'metrics' && (
        <div>
          {/* Stats Grid */}
          <div className="grid-3" style={{ marginBottom: '2rem' }}>
            <div className="card">
              <span className="admin-stat-label">Total Customers</span>
              <div className="admin-stat-value">{totalClientsCount}</div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Registered in database</span>
            </div>
            <div className="card">
              <span className="admin-stat-label">Visits This Month</span>
              <div className="admin-stat-value">{visitsThisMonthCount}</div>
              <span style={{ fontSize: '0.75rem', color: 'var(--success-color)', fontWeight: '600' }}>+12% vs last month</span>
            </div>
            <div className="card">
              <span className="admin-stat-label">Reminders Pending</span>
              <div className="admin-stat-value">{upcomingRemindersCount}</div>
              <span style={{ fontSize: '0.75rem', color: 'var(--warning-color)' }}>
                {upcomingRemindersCount > 0 ? 'Action required' : 'All clear'}
              </span>
            </div>
          </div>

          {/* Chart Section */}
          <div className="card" style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Weekly Visit Performance</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Number of haircuts completed over the last 6 weeks.
            </p>
            
            <div className="chart-container">
              <div className="bar-chart">
                <div className="bar-column">
                  <div className="bar-fill" style={{ height: '40%' }}>
                    <span className="bar-value">8</span>
                  </div>
                  <span className="bar-label">Week -5</span>
                </div>
                <div className="bar-column">
                  <div className="bar-fill" style={{ height: '55%' }}>
                    <span className="bar-value">11</span>
                  </div>
                  <span className="bar-label">Week -4</span>
                </div>
                <div className="bar-column">
                  <div className="bar-fill" style={{ height: '45%' }}>
                    <span className="bar-value">9</span>
                  </div>
                  <span className="bar-label">Week -3</span>
                </div>
                <div className="bar-column">
                  <div className="bar-fill" style={{ height: '70%' }}>
                    <span className="bar-value">14</span>
                  </div>
                  <span className="bar-label">Week -2</span>
                </div>
                <div className="bar-column">
                  <div className="bar-fill" style={{ height: '60%' }}>
                    <span className="bar-value">12</span>
                  </div>
                  <span className="bar-label">Last Week</span>
                </div>
                <div className="bar-column">
                  <div className="bar-fill" style={{ height: '80%' }}>
                    <span className="bar-value">16</span>
                  </div>
                  <span className="bar-label">Current</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- CLIENTS VIEW --- */}
      {tab === 'dashboard' && (
        <div className="card">
          <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem' }}>Customer Records Directory</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                Search, sort, and select customer style records.
              </p>
            </div>
            
            <input
              type="text"
              className="form-control"
              placeholder="Filter by name or mobile..."
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              style={{ maxWidth: '300px' }}
            />
          </div>

          <div className="table-container">
            {sortedClients.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('name')}>
                      Client Name {clientSortKey === 'name' ? (clientSortOrder === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th>Mobile Phone</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('visitCount')}>
                      Visits Recorded {clientSortKey === 'visitCount' ? (clientSortOrder === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('lastVisit')}>
                      Last Visited {clientSortKey === 'lastVisit' ? (clientSortOrder === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedClients.map(client => (
                    <tr key={client.id}>
                      <td style={{ fontWeight: '600' }}>{client.name}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{client.mobileNumber}</td>
                      <td>
                        <span style={{ background: 'var(--bg-tertiary)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.8125rem' }}>
                          {client.visitCount} visits
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {client.lastVisit ? client.lastVisit.toLocaleDateString() : 'Never'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button 
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            router.push(`/app/barber?customerId=${client.id}`);
                            setTimeout(() => {
                              const event = new CustomEvent('select-customer', { detail: client });
                              window.dispatchEvent(event);
                            }, 50);
                          }}
                        >
                          Styling Index &rarr;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No customer records match your filter criteria.
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- REMINDERS VIEW --- */}
      {tab === 'reminders' && (
        <div className="card">
          <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem' }}>Styling Retention Reminders</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                Clients due for a haircut based on cadence limits.
              </p>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-tertiary)', padding: '0.5rem 1rem', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Sent This Month:</span>
              <strong style={{ color: 'var(--success-color)' }}>{salonReminders.length} dispatched</strong>
            </div>
          </div>

          <div className="table-container">
            {dueCustomers.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Mobile Phone</th>
                    <th>Last Cut Date</th>
                    <th>Overdue Period</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dueCustomers.map(c => {
                    const custVisits = salonVisits.filter(v => v.customerId === c.id);
                    const sortedVisits = [...custVisits].sort((a, b) => new Date(b.date) - new Date(a.date));
                    const lastVisitDate = new Date(sortedVisits[0].date);
                    const diffDays = Math.ceil(Math.abs(new Date() - lastVisitDate) / (1000 * 60 * 60 * 24));
                    
                    return (
                      <tr key={c.id}>
                        <td style={{ fontWeight: '600' }}>{c.name}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{c.mobileNumber}</td>
                        <td>{lastVisitDate.toLocaleDateString()}</td>
                        <td>
                          <span style={{ color: 'var(--warning-color)', fontWeight: '600' }}>
                            {diffDays - currentSalon.reminderCadenceDaysDefault} days late
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button 
                            className="btn btn-primary btn-sm"
                            onClick={() => handleOpenReminder(c)}
                          >
                            Send WhatsApp
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                🎉 Great job! No customers are currently overdue for their haircut reminder follow-up.
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- SETTINGS VIEW --- */}
      {tab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* General Salon Profile Settings */}
          <div className="card">
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Salon Profile & Preferences</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Update your workspace information and client follow-up timing defaults.
            </p>

            {settingsSuccess && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success-color)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.875rem', marginBottom: '1.5rem', border: '1px solid var(--success-color)' }}>
                ✓ General salon preferences saved successfully!
              </div>
            )}

            <form onSubmit={handleSaveGeneralSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Salon Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={salonName}
                    onChange={(e) => setSalonName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Owner Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Salon Address</label>
                <input
                  type="text"
                  className="form-control"
                  value={salonAddress}
                  onChange={(e) => setSalonAddress(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ maxWidth: '360px' }}>
                <label className="form-label">Default Reminder Cadence (Days)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <input
                    type="number"
                    className="form-control"
                    value={reminderCadence}
                    onChange={(e) => setReminderCadence(Number(e.target.value))}
                    min="1"
                    required
                  />
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>days triggers status</span>
                </div>
              </div>

              <div>
                <button type="submit" className="btn btn-primary">
                  Save Preferences
                </button>
              </div>
            </form>
          </div>

          {/* Stylist Stations Manager */}
          <div className="card">
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Stylist Stations & Staff</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Manage your staff roster. Stylists select their station when saving cuts.
            </p>

            <form onSubmit={handleAddStylistSubmit} className="flex-row" style={{ marginBottom: '1.5rem' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Stylist Name (e.g. Tony Stark)"
                value={newStylistName}
                onChange={(e) => setNewStylistName(e.target.value)}
                style={{ maxWidth: '300px' }}
              />
              <button type="submit" className="btn btn-primary">
                + Add Stylist
              </button>
            </form>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
              {salonStaff.map(s => (
                <div 
                  key={s.id} 
                  className="flex-between"
                  style={{ padding: '0.75rem 1rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                >
                  <span style={{ fontWeight: '500' }}>{s.name}</span>
                  <button 
                    type="button" 
                    className="btn btn-text"
                    onClick={() => removeStaffMember(s.id)}
                    style={{ color: 'var(--error-color)', padding: 0 }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Salon Space Theme Card */}
          <div className="card">
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Salon Space Theme</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              Select the color theme of your salon workspace app. This overrides styling elements globally.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem' }}>
              {[
                { id: 'charcoal', name: 'Charcoal Gold 🖤', color: '#d97706' },
                { id: 'barber', name: 'Classic Barber 💈', color: '#3b82f6' },
                { id: 'emerald', name: 'Emerald Luxe 🟢', color: '#10b981' },
                { id: 'rose', name: 'Rose Bronze 🌸', color: '#ec4899' },
                { id: 'cyberpunk', name: 'Cyberpunk Fade ⚡', color: '#d946ef' }
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
                  style={{
                    padding: '1rem',
                    background: 'var(--bg-tertiary)',
                    border: theme === t.id ? `2px solid ${t.color}` : '1px solid var(--border-color)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.2s ease',
                    transform: theme === t.id ? 'scale(1.03)' : 'scale(1)'
                  }}
                >
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: t.color, margin: '0 auto 0.5rem auto' }} />
                  <span style={{ fontSize: '0.8125rem', fontWeight: theme === t.id ? '600' : 'normal', color: 'var(--text-primary)' }}>{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Subscription Settings */}
          <div className="card card-premium">
            <div className="flex-between" style={{ flexWrap: 'wrap', gap: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Subscription & Billing</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  Manage your subscription tier, billing, and system limits.
                </p>
                <div style={{ marginTop: '1.25rem', display: 'flex', gap: '2rem' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Current Plan</span>
                    <strong style={{ fontSize: '1.125rem', color: 'var(--accent-color)' }}>
                      {plans.find(p => p.id === currentSalon.planId)?.name}
                    </strong>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Monthly Cost</span>
                    <strong>
                      ${currentSalon.billingInterval === 'annual' 
                        ? Math.round(plans.find(p => p.id === currentSalon.planId)?.priceAnnual / 12) 
                        : plans.find(p => p.id === currentSalon.planId)?.priceMonthly}/mo
                    </strong>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Capacity Usage</span>
                    <strong>
                      {salonCustomers.length} / {plans.find(p => p.id === currentSalon.planId)?.customerLimit === -1 ? 'Unlimited' : plans.find(p => p.id === currentSalon.planId)?.customerLimit} Clients
                    </strong>
                  </div>
                </div>
              </div>
              <button className="btn btn-primary" onClick={() => { setUpgradePlanId(currentSalon.planId); setShowUpgradeModal(true); }}>
                Upgrade / Change Plan
              </button>
            </div>
            
            {/* Invoice list */}
            <div style={{ marginTop: '2rem' }}>
              <h4 style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Invoice History</h4>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Invoice ID</th>
                      <th>Date</th>
                      <th>Plan Tier</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salonPayments.map(p => (
                      <tr key={p.id}>
                        <td style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{p.id}</td>
                        <td>{new Date(p.date).toLocaleDateString()}</td>
                        <td>{plans.find(pl => pl.id === p.planId)?.name}</td>
                        <td>${p.amount}</td>
                        <td>
                          <span className={`badge ${p.status === 'Success' ? 'badge-active' : 'badge-cancelled'}`}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MOCK WhatsApp dispatch overlay drawer */}
      {activeReminderCustomer && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Preview WhatsApp Broadcast</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Verify details before sending simulated message.
            </p>

            <form onSubmit={handleSendReminderSubmit}>
              <div className="form-group">
                <label className="form-label">Client Mobile Phone</label>
                <input
                  type="text"
                  className="form-control"
                  value={activeReminderCustomer.mobileNumber}
                  disabled
                />
              </div>

              <div className="form-group">
                <label className="form-label">WhatsApp Template Draft</label>
                <textarea
                  className="form-control"
                  rows="4"
                  value={reminderMessage}
                  onChange={(e) => setReminderMessage(e.target.value)}
                />
              </div>

              <div style={{ padding: '0.75rem 1rem', background: 'rgba(16, 185, 129, 0.05)', border: '1px dashed var(--success-color)', borderRadius: '8px', color: 'var(--success-color)', fontSize: '0.8125rem', marginBottom: '1.5rem' }}>
                💡 Click below to simulate sending. This triggers a callback, stores log metadata, and reports success.
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary btn-block" onClick={() => setActiveReminderCustomer(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-block">
                  Dispatch Message
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Plan upgrade options Modal */}
      {showUpgradeModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', textAlign: 'center' }}>Modify Subscription Plan</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '2rem', textAlign: 'center' }}>
              Switch plan levels to adjust salon client limits.
            </p>

            <form onSubmit={handleUpgradeSubmit}>
              <div className="grid-3" style={{ marginBottom: '2rem', alignItems: 'stretch' }}>
                {plans.map(p => {
                  const isCurrent = currentSalon.planId === p.id;
                  const isSelected = upgradePlanId === p.id;
                  
                  return (
                    <div 
                      key={p.id}
                      className="card"
                      style={{ 
                        border: isSelected ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        padding: '1rem',
                        opacity: isCurrent ? 0.75 : 1
                      }}
                      onClick={() => setUpgradePlanId(p.id)}
                    >
                      <div>
                        <h4 style={{ fontSize: '1rem' }}>{p.name}</h4>
                        <div style={{ fontSize: '1.25rem', fontWeight: '800', margin: '0.5rem 0' }}>
                          ${currentSalon.billingInterval === 'annual' ? Math.round(p.priceAnnual / 12) : p.priceMonthly}
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>/mo</span>
                        </div>
                        <ul style={{ padding: 0, listStyle: 'none', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', color: 'var(--text-secondary)' }}>
                          <li>&bull; Limit: {p.customerLimit === -1 ? 'Unlimited' : p.customerLimit} customers</li>
                          {p.features.slice(1, 3).map((f, i) => (
                            <li key={i}>&bull; {f}</li>
                          ))}
                        </ul>
                      </div>
                      
                      <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                        {isCurrent ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--accent-color)', fontWeight: '600' }}>Active Plan</span>
                        ) : (
                          <input 
                            type="radio" 
                            checked={isSelected}
                            onChange={() => setUpgradePlanId(p.id)}
                            style={{ cursor: 'pointer' }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowUpgradeModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={upgradePlanId === currentSalon.planId}>
                  Confirm Plan Change
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
