"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  DEFAULT_PLANS,
  INITIAL_SALONS,
  INITIAL_STAFF,
  INITIAL_CUSTOMERS,
  INITIAL_VISITS,
  INITIAL_PAYMENTS,
  INITIAL_REMINDERS,
  INITIAL_ADMIN
} from './mockData';

const AppContext = createContext();

export const useApp = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  // Initial local states matching seeds
  const [plans, setPlans] = useState(DEFAULT_PLANS);
  const [salons, setSalons] = useState(INITIAL_SALONS);
  const [staff, setStaff] = useState(INITIAL_STAFF);
  const [customers, setCustomers] = useState(INITIAL_CUSTOMERS);
  const [visits, setVisits] = useState(INITIAL_VISITS);
  const [payments, setPayments] = useState(INITIAL_PAYMENTS);
  const [reminderLogs, setReminderLogs] = useState(INITIAL_REMINDERS);
  const [announcement, setAnnouncement] = useState({ active: true, text: '💡 Maintenance warning: System upgrade scheduled for Sunday at 02:00 AM UTC.' });
  const [currentSalon, setCurrentSalon] = useState(null);
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [salonMode, setSalonMode] = useState('barber');
  const [tempSignup, setTempSignup] = useState(null);
  const [theme, setTheme] = useState('charcoal');

  // Load from localStorage on client-mount
  useEffect(() => {
    try {
      const getStored = (key, setter) => {
        const val = localStorage.getItem(`snipmem_${key}`);
        if (val) {
          setter(JSON.parse(val));
        }
      };
      getStored('plans', setPlans);
      getStored('salons', setSalons);
      getStored('staff', setStaff);
      getStored('customers', setCustomers);
      getStored('visits', setVisits);
      getStored('payments', setPayments);
      getStored('reminders', setReminderLogs);
      getStored('announcement', setAnnouncement);
      getStored('current_salon', setCurrentSalon);
      getStored('current_admin', setCurrentAdmin);
      getStored('salon_mode', setSalonMode);
      getStored('temp_signup', setTempSignup);
      getStored('theme', setTheme);
      setIsLoaded(true);
    } catch (e) {
      console.error("Local storage load failed", e);
      setIsLoaded(true);
    }
  }, []);

  // Sync back to local storage when state changes (only write if loaded to avoid clearing database)
  useEffect(() => {
    if (isLoaded) localStorage.setItem('snipmem_plans', JSON.stringify(plans));
  }, [plans, isLoaded]);

  useEffect(() => {
    if (isLoaded) localStorage.setItem('snipmem_salons', JSON.stringify(salons));
  }, [salons, isLoaded]);

  useEffect(() => {
    if (isLoaded) localStorage.setItem('snipmem_staff', JSON.stringify(staff));
  }, [staff, isLoaded]);

  useEffect(() => {
    if (isLoaded) localStorage.setItem('snipmem_customers', JSON.stringify(customers));
  }, [customers, isLoaded]);

  useEffect(() => {
    if (isLoaded) localStorage.setItem('snipmem_visits', JSON.stringify(visits));
  }, [visits, isLoaded]);

  useEffect(() => {
    if (isLoaded) localStorage.setItem('snipmem_payments', JSON.stringify(payments));
  }, [payments, isLoaded]);

  useEffect(() => {
    if (isLoaded) localStorage.setItem('snipmem_reminders', JSON.stringify(reminderLogs));
  }, [reminderLogs, isLoaded]);

  useEffect(() => {
    if (isLoaded) localStorage.setItem('snipmem_announcement', JSON.stringify(announcement));
  }, [announcement, isLoaded]);

  useEffect(() => {
    if (isLoaded) localStorage.setItem('snipmem_current_salon', JSON.stringify(currentSalon));
  }, [currentSalon, isLoaded]);

  useEffect(() => {
    if (isLoaded) localStorage.setItem('snipmem_current_admin', JSON.stringify(currentAdmin));
  }, [currentAdmin, isLoaded]);

  useEffect(() => {
    if (isLoaded) localStorage.setItem('snipmem_salon_mode', JSON.stringify(salonMode));
  }, [salonMode, isLoaded]);

  useEffect(() => {
    if (isLoaded) localStorage.setItem('snipmem_temp_signup', JSON.stringify(tempSignup));
  }, [tempSignup, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('snipmem_theme', JSON.stringify(theme));
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', theme);
      }
    }
  }, [theme, isLoaded]);

  // --- Login Operations ---
  const loginSalon = (email, password) => {
    const salon = salons.find(
      (s) => (s.email.toLowerCase() === email.toLowerCase() || s.mobileNumber === email) && s.password === password
    );
    if (!salon) {
      throw new Error('Invalid email/mobile number or password.');
    }
    if (salon.subscriptionStatus === 'Cancelled') {
      throw new Error('This subscription has been cancelled. Please register a new account.');
    }
    setCurrentSalon(salon);
    setCurrentAdmin(null);
    setSalonMode('barber');
    return salon;
  };

  const loginAdmin = (email, password) => {
    if (email.toLowerCase() === INITIAL_ADMIN.email && password === INITIAL_ADMIN.password) {
      const adminSession = { id: 'admin-1', email: INITIAL_ADMIN.email };
      setCurrentAdmin(adminSession);
      setCurrentSalon(null);
      return adminSession;
    } else {
      throw new Error('Invalid platform administrator credentials.');
    }
  };

  const logout = () => {
    setCurrentSalon(null);
    setCurrentAdmin(null);
    setTempSignup(null);
  };

  // --- Signup Flow ---
  const signupSalon = (name, ownerName, email, mobileNumber, password, planId, billingInterval) => {
    const exists = salons.some((s) => s.email.toLowerCase() === email.toLowerCase());
    if (exists) {
      throw new Error('A salon with this email address is already registered.');
    }
    const newTemp = {
      id: `salon-${Date.now()}`,
      name,
      ownerName,
      email,
      mobileNumber,
      password,
      planId,
      billingInterval,
      subscriptionStatus: 'Trial',
      signupDate: new Date().toISOString(),
      lastActiveDate: new Date().toISOString(),
      reminderCadenceDaysDefault: 30
    };
    setTempSignup(newTemp);
    return newTemp;
  };

  const completeCheckout = (paymentDetails) => {
    if (!tempSignup) {
      throw new Error('No checkout registration session found.');
    }

    const createdSalon = {
      ...tempSignup,
      subscriptionStatus: 'Active'
    };

    setSalons((prev) => [...prev, createdSalon]);

    const selectedPlan = plans.find((p) => p.id === createdSalon.planId);
    const amount = createdSalon.billingInterval === 'annual' ? selectedPlan.priceAnnual : selectedPlan.priceMonthly;

    const newPayment = {
      id: `pay-${Date.now()}`,
      salonId: createdSalon.id,
      amount,
      date: new Date().toISOString(),
      status: 'Success',
      planId: createdSalon.planId
    };

    setPayments((prev) => [...prev, newPayment]);
    setCurrentSalon(createdSalon);
    setTempSignup(null);
    return createdSalon;
  };

  const completeOnboarding = (address, logoUrl, staffNames, cadenceDays) => {
    if (!currentSalon) return;

    setSalons((prev) =>
      prev.map((s) =>
        s.id === currentSalon.id
          ? {
              ...s,
              address,
              logoUrl,
              reminderCadenceDaysDefault: Number(cadenceDays),
              lastActiveDate: new Date().toISOString()
            }
          : s
      )
    );

    setCurrentSalon((prev) => ({
      ...prev,
      address,
      logoUrl,
      reminderCadenceDaysDefault: Number(cadenceDays)
    }));

    const newStaff = staffNames
      .filter((name) => name.trim() !== '')
      .map((name, index) => ({
        id: `staff-${Date.now()}-${index}`,
        salonId: currentSalon.id,
        name
      }));

    if (newStaff.length > 0) {
      setStaff((prev) => [...prev, ...newStaff]);
    }
  };

  // --- Salon Operations ---
  const addCustomer = (name, mobileNumber) => {
    if (!currentSalon) throw new Error('You must be logged in.');

    const normalizedMobile = mobileNumber.replace(/\D/g, '');
    const duplicate = customers.find(
      (c) => c.salonId === currentSalon.id && c.mobileNumber.replace(/\D/g, '') === normalizedMobile
    );

    if (duplicate) {
      throw new Error(`Customer with this mobile number already exists: ${duplicate.name}`);
    }

    const newCustomer = {
      id: `cust-${Date.now()}`,
      salonId: currentSalon.id,
      name,
      mobileNumber,
      createdAt: new Date().toISOString()
    };

    setCustomers((prev) => [...prev, newCustomer]);
    return newCustomer;
  };

  const addVisit = (customerId, staffId, note, styleTags, photos, repeatOfVisitId = null) => {
    if (!currentSalon) throw new Error('You must be logged in.');

    const newVisit = {
      id: `visit-${Date.now()}`,
      customerId,
      staffId,
      date: new Date().toISOString(),
      photos,
      note,
      styleTags,
      repeatOfVisitId
    };

    setVisits((prev) => [newVisit, ...prev]);

    setSalons((prev) =>
      prev.map((s) => (s.id === currentSalon.id ? { ...s, lastActiveDate: new Date().toISOString() } : s))
    );

    return newVisit;
  };

  const sendReminderLog = (customerId, messagePreview) => {
    if (!currentSalon) throw new Error('You must be logged in.');

    const log = {
      id: `rem-${Date.now()}`,
      customerId,
      salonId: currentSalon.id,
      sentAt: new Date().toISOString(),
      messagePreview
    };

    setReminderLogs((prev) => [log, ...prev]);
    return log;
  };

  const addStaffMember = (name) => {
    if (!currentSalon) return;
    const newStylist = {
      id: `staff-${Date.now()}`,
      salonId: currentSalon.id,
      name
    };
    setStaff((prev) => [...prev, newStylist]);
  };

  const removeStaffMember = (staffId) => {
    setStaff((prev) => prev.filter((s) => s.id !== staffId));
  };

  const changeSubscription = (planId) => {
    if (!currentSalon) return;
    setSalons((prev) =>
      prev.map((s) => (s.id === currentSalon.id ? { ...s, planId, subscriptionStatus: 'Active' } : s))
    );
    setCurrentSalon((prev) => ({ ...prev, planId, subscriptionStatus: 'Active' }));

    const targetPlan = plans.find((p) => p.id === planId);
    const amount = currentSalon.billingInterval === 'annual' ? targetPlan.priceAnnual : targetPlan.priceMonthly;

    const newPayment = {
      id: `pay-${Date.now()}`,
      salonId: currentSalon.id,
      amount,
      date: new Date().toISOString(),
      status: 'Success',
      planId
    };
    setPayments((prev) => [...prev, newPayment]);
  };

  const updateSalonSettings = (name, ownerName, address, cadenceDays) => {
    if (!currentSalon) return;
    setSalons((prev) =>
      prev.map((s) =>
        s.id === currentSalon.id
          ? {
              ...s,
              name,
              ownerName,
              address,
              reminderCadenceDaysDefault: Number(cadenceDays)
            }
          : s
      )
    );
    setCurrentSalon((prev) => ({
      ...prev,
      name,
      ownerName,
      address,
      reminderCadenceDaysDefault: Number(cadenceDays)
    }));
  };

  // --- Platform Admin Operations ---
  const changeSalonStatus = (salonId, status) => {
    setSalons((prev) =>
      prev.map((s) => (s.id === salonId ? { ...s, subscriptionStatus: status } : s))
    );
    if (currentSalon && currentSalon.id === salonId) {
      setCurrentSalon((prev) => ({ ...prev, subscriptionStatus: status }));
    }
  };

  const adminChangeSalonPlan = (salonId, planId) => {
    setSalons((prev) => prev.map((s) => (s.id === salonId ? { ...s, planId } : s)));
    if (currentSalon && currentSalon.id === salonId) {
      setCurrentSalon((prev) => ({ ...prev, planId }));
    }
  };

  const updatePricingTiers = (newPlans) => {
    setPlans(newPlans);
  };

  const updateAnnouncement = (active, text) => {
    setAnnouncement({ active, text });
  };

  const resetAllData = () => {
    localStorage.clear();
    setPlans(DEFAULT_PLANS);
    setSalons(INITIAL_SALONS);
    setStaff(INITIAL_STAFF);
    setCustomers(INITIAL_CUSTOMERS);
    setVisits(INITIAL_VISITS);
    setPayments(INITIAL_PAYMENTS);
    setReminderLogs(INITIAL_REMINDERS);
    setCurrentSalon(null);
    setCurrentAdmin(null);
    setTempSignup(null);
    setSalonMode('barber');
    setAnnouncement({ active: true, text: '💡 Maintenance warning: System upgrade scheduled for Sunday at 02:00 AM UTC.' });
  };

  return (
    <AppContext.Provider
      value={{
        plans,
        salons,
        staff,
        customers,
        visits,
        payments,
        reminderLogs,
        announcement,
        currentSalon,
        currentAdmin,
        salonMode,
        tempSignup,
        theme,
        setTheme,
        setSalonMode,
        loginSalon,
        loginAdmin,
        logout,
        signupSalon,
        completeCheckout,
        completeOnboarding,
        addCustomer,
        addVisit,
        sendReminderLog,
        addStaffMember,
        removeStaffMember,
        changeSubscription,
        updateSalonSettings,
        changeSalonStatus,
        adminChangeSalonPlan,
        updatePricingTiers,
        updateAnnouncement,
        resetAllData
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
