"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '../../../../context/AppContext';

const SVG_GUIDES = {
  front: (
    <svg viewBox="0 0 100 100" fill="none" stroke="var(--accent-color)" strokeWidth="1.5" style={{ width: '100%', height: '100%', opacity: 0.85 }}>
      <ellipse cx="50" cy="45" rx="20" ry="26" strokeDasharray="3 3"/>
      <path d="M50 19 L50 71" strokeDasharray="1 3"/>
      <path d="M30 45 L70 45" strokeDasharray="1 3"/>
      <path d="M38 71 C38 85, 62 85, 62 71" />
    </svg>
  ),
  left: (
    <svg viewBox="0 0 100 100" fill="none" stroke="var(--accent-color)" strokeWidth="1.5" style={{ width: '100%', height: '100%', opacity: 0.85 }}>
      <path d="M35 45 C35 25, 65 25, 65 45 C65 60, 45 70, 35 70 C30 65, 30 55, 35 45 Z" strokeDasharray="3 3"/>
      <path d="M30 45 L32 46 L30 48" />
      <path d="M48 70 C48 85, 68 85, 68 70"/>
    </svg>
  ),
  right: (
    <svg viewBox="0 0 100 100" fill="none" stroke="var(--accent-color)" strokeWidth="1.5" style={{ width: '100%', height: '100%', opacity: 0.85 }}>
      <path d="M65 45 C65 25, 35 25, 35 45 C35 60, 55 70, 65 70 C70 65, 70 55, 65 45 Z" strokeDasharray="3 3"/>
      <path d="M70 45 L68 46 L70 48" />
      <path d="M52 70 C52 85, 32 85, 32 70"/>
    </svg>
  ),
  back: (
    <svg viewBox="0 0 100 100" fill="none" stroke="var(--accent-color)" strokeWidth="1.5" style={{ width: '100%', height: '100%', opacity: 0.85 }}>
      <ellipse cx="50" cy="42" rx="20" ry="23" strokeDasharray="3 3"/>
      <path d="M35 65 L65 65" strokeDasharray="2 2"/>
      <path d="M38 65 C38 82, 62 82, 62 65"/>
    </svg>
  )
};

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

  // Camera Modal States
  const [activeCameraAngle, setActiveCameraAngle] = useState(null);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [faceBlurActive, setFaceBlurActive] = useState(false);

  // Cross-salon styling transfer OTP states
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpPhone, setOtpPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpStep, setOtpStep] = useState(1);
  const [importedVisits, setImportedVisits] = useState([]);

  // Stylist Toolbox states
  const [showToolbox, setShowToolbox] = useState(true);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [hairTexture, setHairTexture] = useState('fine');
  const [stylingGoal, setStylingGoal] = useState('matte');

  useEffect(() => {
    let interval = null;
    if (timerActive) {
      interval = setInterval(() => {
        setTimerSeconds(s => s + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [timerActive]);

  const formatTime = (totalSecs) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSelectClipperGuard = (guardName, lengthInfo) => {
    setWizardNotes(prev => {
      const spacing = prev.trim() ? ' ' : '';
      return `${prev}${spacing}[Used ${guardName} (${lengthInfo})]`;
    });
  };

  const getProductRecommendation = () => {
    if (hairTexture === 'fine' && stylingGoal === 'matte') return 'Lightweight Matte Paste / Clay Dust';
    if (hairTexture === 'fine' && stylingGoal === 'shine') return 'Water-Based Pomade (Medium Hold)';
    if (hairTexture === 'fine' && stylingGoal === 'volume') return 'Volumizing Boost Powder / Sea Salt Spray';
    if (hairTexture === 'thick' && stylingGoal === 'matte') return 'Heavy Styling Clay / Clay Wax';
    if (hairTexture === 'thick' && stylingGoal === 'shine') return 'Classic Wax Pomade / Strong Shine Paste';
    if (hairTexture === 'thick' && stylingGoal === 'volume') return 'Matte Texture Spray / Fiber Pomade';
    if (hairTexture === 'coarse' && stylingGoal === 'matte') return 'Matte Pomade / Hydrating Styling Butter';
    if (hairTexture === 'coarse' && stylingGoal === 'shine') return 'High-Shine Hair Styling Oil / Strong Hold Gel';
    if (hairTexture === 'coarse' && stylingGoal === 'volume') return 'Conditioning Styling Cream / Volumizing Mousse';
    return 'Texture Paste';
  }; 

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

  const compressImage = (base64Str, maxWidth = 800, maxHeight = 800, quality = 0.7) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      img.onerror = () => {
        resolve(base64Str);
      };
    });
  };

  const processFaceBlurOnDataUrl = (dataUrl) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        // Define a face oval that resides lower down (below the hairline) and is centered
        const faceX = canvas.width * 0.5;
        const faceY = canvas.height * 0.53; // Shifted down to preserve hair on top
        const radiusX = canvas.width * 0.15; // Focus on face center width-wise
        const radiusY = canvas.height * 0.18; // Focus on eyes, nose, mouth only

        // 1. Create a tiny offscreen canvas for pixelation
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 16;
        tempCanvas.height = 16;
        const tempCtx = tempCanvas.getContext('2d');

        // Draw only the face bounding box onto the tiny canvas
        tempCtx.drawImage(
          canvas, 
          faceX - radiusX, 
          faceY - radiusY, 
          radiusX * 2, 
          radiusY * 2, 
          0, 
          0, 
          tempCanvas.width, 
          tempCanvas.height
        );

        // 2. Draw the pixelated face back onto the main canvas inside an elliptical mask
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(faceX, faceY, radiusX, radiusY, 0, 0, Math.PI * 2);
        ctx.clip();
        
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          tempCanvas, 
          0, 
          0, 
          tempCanvas.width, 
          tempCanvas.height, 
          faceX - radiusX, 
          faceY - radiusY, 
          radiusX * 2, 
          radiusY * 2
        );
        ctx.restore();

        resolve(canvas.toDataURL('image/jpeg'));
      };
      img.onerror = () => resolve(dataUrl);
    });
  };

  const startCamera = async (angle) => {
    setActiveCameraAngle(angle);
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      setCameraStream(stream);
      setTimeout(() => {
        const videoEl = document.getElementById('camera-preview-video');
        if (videoEl) {
          videoEl.srcObject = stream;
          videoEl.play().catch(err => console.error("Error playing video:", err));
        }
      }, 300);
    } catch (err) {
      console.error("Camera access failed:", err);
      setCameraError("Camera access denied or unavailable. Please select/drag a local photo instead.");
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setActiveCameraAngle(null);
  };

  const capturePhotoFromVideo = async () => {
    const video = document.getElementById('camera-preview-video');
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    let dataUrl = canvas.toDataURL('image/jpeg');

    if (activeCameraAngle === 'front' && faceBlurActive) {
      dataUrl = await processFaceBlurOnDataUrl(dataUrl);
    }

    const compressed = await compressImage(dataUrl);
    setPhotos(prev => ({ ...prev, [activeCameraAngle]: compressed }));
    stopCamera();
  };

  const handleCameraFileInput = async (e, angle) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      let dataUrl = event.target.result;
      
      if (angle === 'front' && faceBlurActive) {
        dataUrl = await processFaceBlurOnDataUrl(dataUrl);
      }
      
      const compressed = await compressImage(dataUrl);
      setPhotos(prev => ({ ...prev, [angle]: compressed }));
      stopCamera();
    };
    reader.readAsDataURL(file);
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setOtpError('');
    const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
    setOtpCode(generatedCode);
    setOtpSent(true);
    setOtpStep(2);
    alert(`[SMS Dispatch Simulation] OTP to authorize styling transfer: ${generatedCode}`);
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setOtpError('');
    if (enteredOtp !== otpCode) {
      setOtpError('Incorrect verification code. Please try again.');
      return;
    }
    
    try {
      const cleanPhone = otpPhone.replace(/\D/g, '');
      const response = await fetch(`/api/search/users?phone=${cleanPhone}`);
      const data = await response.json();
      
      if (data.visits && data.visits.length > 0) {
        setImportedVisits(data.visits);
        setOtpStep(3);
      } else {
        setOtpError('No external styling logs found for this number.');
      }
    } catch (err) {
      console.error(err);
      setOtpError('Failed to retrieve external records. Please check API connectivity.');
    }
  };

  const handleCopyImportedVisit = (visit) => {
    setPhotos({ ...visit.photos });
    setWizardNotes(`Imported styling from salon visit on ${new Date(visit.date).toLocaleDateString()}: ${visit.notes || ''}`);
    setWizardTags(visit.styleTags || []);
    setShowOtpModal(false);
    setShowCaptureWizard(true);
    alert('Styling specifications successfully copied to capture wizard! Ready to replicate.');
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

          <div className="flex-between" style={{ marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: 0 }}>Styling Log History</h3>
            <button 
              type="button"
              className="btn btn-secondary btn-sm" 
              onClick={() => {
                setOtpStep(1);
                setOtpSent(false);
                setOtpCode('');
                setEnteredOtp('');
                setOtpError('');
                setImportedVisits([]);
                setOtpPhone(selectedCustomer.mobileNumber || '');
                setShowOtpModal(true);
              }}
              style={{ borderColor: 'var(--accent-color)', color: 'var(--accent-color)' }}
            >
              📲 Request Styling History Transfer
            </button>
          </div>
          
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
            <div className="grid-2" style={{ gap: '2rem' }}>
              {/* Left Column: Photos Capture */}
              <div>
                <div className="flex-between" style={{ marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '1.125rem' }}>4-Angle Reference Grid</h3>
                </div>

                <div className="photo-capture-grid">
                  {['front', 'left', 'right', 'back'].map(angle => {
                    const hasImage = !!photos[angle];
                    return (
                      <div 
                        key={angle} 
                        className={`photo-slot ${hasImage ? 'has-image' : ''}`}
                        onClick={() => startCamera(angle)}
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
                            <div style={{ fontSize: '0.75rem', fontWeight: '600' }}>Tap to Capture</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4', display: 'block' }}>
                  [Tip] Clicking any card activates the camera feed with viewpoint guidelines to ensure exact haircut replications.
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

          {/* --- STYLIST UTILITY TOOLBOX PANEL --- */}
          <div className="card" style={{ marginTop: '2rem', border: '1px solid var(--accent-color)', background: 'rgba(217, 119, 6, 0.03)' }}>
            <div className="flex-between" style={{ cursor: 'pointer' }} onClick={() => setShowToolbox(!showToolbox)}>
              <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-color)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                </svg>
                Stylist Toolbox & Guides
              </h3>
              <span className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8125rem' }}>
                {showToolbox ? 'Hide Tools' : 'Open Tools'}
              </span>
            </div>

            {showToolbox && (
              <div className="animate-fade" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.75rem', borderTop: '1px dashed var(--border-color)', paddingTop: '1.5rem' }}>
                
                {/* 1. Stopwatch Session Cut Timer */}
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem' }}>
                  <h4 style={{ fontSize: '0.9375rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ 
                      display: 'inline-block', 
                      width: '10px', 
                      height: '10px', 
                      borderRadius: '50%', 
                      backgroundColor: timerActive ? 'var(--success-color)' : 'var(--text-muted)',
                      boxShadow: timerActive ? '0 0 8px var(--success-color)' : 'none'
                    }} />
                    Active Cut Timer
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '2rem', fontWeight: '700', color: timerActive ? 'var(--accent-color)' : 'var(--text-primary)' }}>
                      {formatTime(timerSeconds)}
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className={`btn btn-sm ${timerActive ? 'btn-secondary' : 'btn-primary'}`}
                        onClick={() => setTimerActive(!timerActive)}
                        style={{ minWidth: '80px' }}
                      >
                        {timerActive ? 'Pause' : 'Start Timer'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => { setTimerActive(false); setTimerSeconds(0); }}
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. Interactive Clipper Guard Reference */}
                <div>
                  <h4 style={{ fontSize: '0.9375rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                    Clipper Guard Guide (Tap to copy details to cut notes)
                  </h4>
                  <div className="grid-4" style={{ gap: '0.5rem' }}>
                    {[
                      { name: '#0.5', length: '1.5mm (1/16")' },
                      { name: '#1', length: '3mm (1/8")' },
                      { name: '#1.5', length: '4.5mm (3/16")' },
                      { name: '#2', length: '6mm (1/4")' },
                      { name: '#3', length: '10mm (3/8")' },
                      { name: '#4', length: '13mm (1/2")' },
                      { name: '#6', length: '19mm (3/4")' },
                      { name: '#8', length: '25mm (1")' }
                    ].map(g => (
                      <button
                        key={g.name}
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          handleSelectClipperGuard(g.name, g.length);
                          alert(`Added Clipper ${g.name} (${g.length}) to styling notes.`);
                        }}
                        style={{ padding: '0.75rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}
                      >
                        <strong style={{ fontSize: '0.9375rem', color: 'var(--text-primary)' }}>{g.name}</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{g.length.split(' ')[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Product Recommendation Engine */}
                <div>
                  <h4 style={{ fontSize: '0.9375rem', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
                    Stylist Hair Product Recommender
                  </h4>
                  <div className="grid-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8125rem' }}>Hair Texture</label>
                      <select
                        className="form-select"
                        value={hairTexture}
                        onChange={(e) => setHairTexture(e.target.value)}
                        style={{ padding: '0.5rem 0.75rem' }}
                      >
                        <option value="fine">Fine / Thin Hair</option>
                        <option value="thick">Thick / Dense Hair</option>
                        <option value="coarse">Coarse / Curly Hair</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8125rem' }}>Aesthetic Goal</label>
                      <select
                        className="form-select"
                        value={stylingGoal}
                        onChange={(e) => setStylingGoal(e.target.value)}
                        style={{ padding: '0.5rem 0.75rem' }}
                      >
                        <option value="matte">Matte Natural Hold</option>
                        <option value="shine">Classic High Shine</option>
                        <option value="volume">Maximum Volume & Lift</option>
                      </select>
                    </div>
                  </div>
                  
                  <div style={{ 
                    background: 'var(--bg-secondary)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '8px', 
                    padding: '1rem', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem'
                  }}>
                    <div>
                      <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Ideal Choice
                      </span>
                      <strong style={{ fontSize: '0.9375rem', color: 'var(--accent-color)' }}>{getProductRecommendation()}</strong>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setWizardNotes(prev => {
                          const spacing = prev.trim() ? ' ' : '';
                          return `${prev}${spacing}[Recommended styling: ${getProductRecommendation()}]`;
                        });
                        alert('Product recommendation appended to cut notes.');
                      }}
                    >
                      Copy to notes
                    </button>
                  </div>
                </div>

              </div>
            )}
          </div>
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
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{marginRight: '4px', verticalAlign: 'middle'}}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>{customerError}
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

      {/* Live Camera Feed overlay */}
      {activeCameraAngle && (
        <div className="modal-backdrop" style={{ zIndex: 2000 }}>
          <div className="modal-content animate-slide" style={{ maxWidth: '480px', width: '100%', padding: '1.5rem' }}>
            <div className="flex-between" style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.25rem', textTransform: 'capitalize' }}>
                Capture {activeCameraAngle} View
              </h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={stopCamera}>
                Close
              </button>
            </div>

            {/* Camera Viewport Wrapper */}
            <div 
              style={{ 
                position: 'relative', 
                width: '100%', 
                height: '320px', 
                background: '#000', 
                borderRadius: '8px', 
                overflow: 'hidden',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {!cameraError ? (
                <>
                  <video 
                    id="camera-preview-video" 
                    playsInline 
                    muted 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />

                  {/* SVG Guide Overlay */}
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                    {SVG_GUIDES[activeCameraAngle]}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  <p style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>{cameraError}</p>
                  <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                    Select Image File
                    <input 
                      type="file" 
                      accept="image/*" 
                      style={{ display: 'none' }}
                      onChange={(e) => handleCameraFileInput(e, activeCameraAngle)}
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Privacy Face Blur Toggle */}
            {activeCameraAngle === 'front' && (
              <div 
                className="flex-between" 
                style={{ 
                  marginTop: '1rem', 
                  padding: '0.75rem', 
                  background: 'var(--bg-secondary)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '8px' 
                }}
              >
                <div>
                  <strong style={{ fontSize: '0.875rem', display: 'block' }}>Privacy Face Blur</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Obscure and pixelate facial features dynamically.
                  </span>
                </div>
                <input 
                  type="checkbox" 
                  checked={faceBlurActive}
                  onChange={(e) => setFaceBlurActive(e.target.checked)}
                  style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                />
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
              {!cameraError && (
                <>
                  <button type="button" className="btn btn-primary btn-block" onClick={capturePhotoFromVideo}>
                    📸 Take Snapshot
                  </button>
                  <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0 }}>
                    📁 File
                    <input 
                      type="file" 
                      accept="image/*" 
                      style={{ display: 'none' }}
                      onChange={(e) => handleCameraFileInput(e, activeCameraAngle)}
                    />
                  </label>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* OTP verification / styling transfer modal */}
      {showOtpModal && (
        <div className="modal-backdrop" style={{ zIndex: 2000 }}>
          <div className="modal-content animate-slide" style={{ maxWidth: '500px', width: '100%' }}>
            <div className="flex-between" style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.25rem' }}>Cross-Salon Styling Transfer</h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowOtpModal(false)}>
                Cancel
              </button>
            </div>

            {otpStep === 1 && (
              <form onSubmit={handleSendOtp}>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                  To transfer haircut logs and notes from another salon, we'll send a 6-digit OTP verification code to the client's phone number.
                </p>

                <div className="form-group">
                  <label className="form-label">Client Mobile Phone</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="e.g. (206) 555-0100" 
                    value={otpPhone}
                    onChange={(e) => setOtpPhone(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: '1.5rem' }}>
                  Send Verification SMS
                </button>
              </form>
            )}

            {otpStep === 2 && (
              <form onSubmit={handleVerifyOtp}>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                  A one-time passcode was sent to <strong>{otpPhone}</strong>. Enter the 6-digit authorization code below:
                </p>

                {otpError && (
                  <div style={{ background: 'var(--error-soft)', border: '1px solid var(--error-color)', color: 'var(--error-color)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.875rem', marginBottom: '1rem' }}>
                    {otpError}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">One-Time Code (OTP)</label>
                  <input 
                    type="text" 
                    maxLength={6}
                    className="form-control" 
                    placeholder="e.g. 123456" 
                    value={enteredOtp}
                    onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                    required
                    style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '4px', fontFamily: 'monospace' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
                  <button type="button" className="btn btn-secondary btn-block" onClick={() => setOtpStep(1)}>
                    Back
                  </button>
                  <button type="submit" className="btn btn-primary btn-block">
                    Authorize & Retrieve
                  </button>
                </div>
              </form>
            )}

            {otpStep === 3 && (
              <div>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                  🔓 Authorization success! Found <strong>{importedVisits.length}</strong> previous styling logs for this client. Select a style configuration to copy it:
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '350px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                  {importedVisits.map((visit, index) => (
                    <div 
                      key={visit.id || index} 
                      style={{ 
                        border: '1px solid var(--border-color)', 
                        borderRadius: '8px', 
                        padding: '1rem', 
                        background: 'var(--bg-secondary)'
                      }}
                    >
                      <div className="flex-between" style={{ marginBottom: '0.75rem' }}>
                        <div>
                          <strong style={{ fontSize: '0.9375rem', display: 'block' }}>
                            Visit on {new Date(visit.date).toLocaleDateString()}
                          </strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            Tags: {visit.styleTags?.join(', ') || 'None'}
                          </span>
                        </div>
                        <button 
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => handleCopyImportedVisit(visit)}
                        >
                          📋 Copy Specs
                        </button>
                      </div>
                      
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '0.5rem 0' }}>
                        {visit.notes || 'No style notes.'}
                      </p>

                      {/* Photo preview */}
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {['front', 'left', 'right', 'back'].map(angle => (
                          <div 
                            key={angle} 
                            style={{ 
                              width: '45px', 
                              height: '45px', 
                              borderRadius: '4px', 
                              border: '1px solid var(--border-color)', 
                              overflow: 'hidden', 
                              position: 'relative' 
                            }}
                          >
                            {visit.photos?.[angle]?.startsWith('<svg') ? (
                              <div dangerouslySetInnerHTML={{ __html: visit.photos[angle] }} style={{ width: '100%', height: '100%' }} />
                            ) : (
                              <img src={visit.photos?.[angle]} alt={angle} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <button 
                  type="button" 
                  className="btn btn-secondary btn-block" 
                  style={{ marginTop: '1.5rem' }}
                  onClick={() => setShowOtpModal(false)}
                >
                  Done
                </button>
              </div>
            )}
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
