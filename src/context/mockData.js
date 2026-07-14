// Initial mock data definitions for SnipMemory SaaS Platform

export const DEFAULT_PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    priceMonthly: 29,
    priceAnnual: 290,
    customerLimit: 100,
    features: [
      'Up to 100 customer records',
      '4-angle haircut photo storage',
      'Basic text reminders',
      'Standard support (email)',
      'Single station access'
    ]
  },
  {
    id: 'growth',
    name: 'Growth',
    priceMonthly: 79,
    priceAnnual: 790,
    customerLimit: 500,
    features: [
      'Up to 500 customer records',
      'Unlimited photos & style notes',
      'Automated WhatsApp reminders',
      'Multi-stylist staff accounts',
      'Salon-level dashboard analytics',
      'Priority email/chat support'
    ]
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 149,
    priceAnnual: 1490,
    customerLimit: -1, // Unlimited
    features: [
      'Unlimited customer records',
      'Custom branding & white-labeling',
      'Advanced analytics & staff metrics',
      'Full PWA support for tablets',
      'Instant repeat-cut fast checkout',
      'Dedicated account manager & phone support'
    ]
  }
];

export const INITIAL_SALONS = [
  {
    id: 'salon-classic',
    name: 'Classic Cuts & Shaves',
    ownerName: 'Marcus Vance',
    email: 'owner@classiccuts.com',
    mobileNumber: '+15551002001',
    password: 'password123',
    logoUrl: '',
    address: '142 Baker St, London, UK',
    planId: 'pro',
    billingInterval: 'monthly',
    subscriptionStatus: 'Active',
    signupDate: '2026-01-15T08:30:00Z',
    lastActiveDate: '2026-07-14T15:30:00Z',
    reminderCadenceDaysDefault: 30
  },
  {
    id: 'salon-fade',
    name: 'The Fade Laboratory',
    ownerName: 'Dexter King',
    email: 'owner@fadelab.com',
    mobileNumber: '+15551002002',
    password: 'password123',
    logoUrl: '',
    address: '89 Broadway, New York, NY',
    planId: 'growth',
    billingInterval: 'monthly',
    subscriptionStatus: 'Trial',
    signupDate: '2026-07-01T12:00:00Z',
    lastActiveDate: '2026-07-14T14:45:00Z',
    reminderCadenceDaysDefault: 21
  },
  {
    id: 'salon-golden',
    name: 'Golden Scissors',
    ownerName: 'Helena Geller',
    email: 'owner@goldenscissors.com',
    mobileNumber: '+15551002003',
    password: 'password123',
    logoUrl: '',
    address: '742 Evergreen Terrace, Springfield',
    planId: 'pro',
    billingInterval: 'annual',
    subscriptionStatus: 'PastDue',
    signupDate: '2025-07-10T10:00:00Z',
    lastActiveDate: '2026-07-13T18:20:00Z',
    reminderCadenceDaysDefault: 45
  },
  {
    id: 'salon-vintage',
    name: 'Vintage Barbershop',
    ownerName: 'Arthur Dent',
    email: 'owner@vintage.com',
    mobileNumber: '+15551002004',
    password: 'password123',
    logoUrl: '',
    address: '42 Ring Road, Cardiff, Wales',
    planId: 'starter',
    billingInterval: 'monthly',
    subscriptionStatus: 'Cancelled',
    signupDate: '2026-03-01T09:00:00Z',
    lastActiveDate: '2026-06-30T17:00:00Z',
    reminderCadenceDaysDefault: 28
  }
];

export const INITIAL_STAFF = [
  // Classic Cuts & Shaves
  { id: 'staff-marcus', salonId: 'salon-classic', name: 'Marcus Vance' },
  { id: 'staff-sarah', salonId: 'salon-classic', name: 'Sarah Connor' },
  { id: 'staff-john', salonId: 'salon-classic', name: 'John Doe' },
  
  // Fade Lab
  { id: 'staff-dexter', salonId: 'salon-fade', name: 'Dexter King' },
  { id: 'staff-leroy', salonId: 'salon-fade', name: 'Leroy Jenkins' },

  // Golden Scissors
  { id: 'staff-helena', salonId: 'salon-golden', name: 'Helena Geller' },
  { id: 'staff-tony', salonId: 'salon-golden', name: 'Tony Stark' },

  // Vintage
  { id: 'staff-arthur', salonId: 'salon-vintage', name: 'Arthur Dent' }
];

export const INITIAL_CUSTOMERS = [
  // Classic Cuts
  { id: 'cust-101', salonId: 'salon-classic', name: 'Alex Mercer', mobileNumber: '2065550123', createdAt: '2026-02-10T11:00:00Z' },
  { id: 'cust-102', salonId: 'salon-classic', name: 'Bruce Wayne', mobileNumber: '3125550189', createdAt: '2026-03-04T14:30:00Z' },
  { id: 'cust-103', salonId: 'salon-classic', name: 'Clara Oswald', mobileNumber: '5035550156', createdAt: '2026-04-12T09:15:00Z' },
  { id: 'cust-104', salonId: 'salon-classic', name: 'David Jones', mobileNumber: '6175550172', createdAt: '2026-05-20T16:00:00Z' },

  // Fade Lab
  { id: 'cust-201', salonId: 'salon-fade', name: 'Eric Cartman', mobileNumber: '3035550111', createdAt: '2026-07-02T10:00:00Z' },
  { id: 'cust-202', salonId: 'salon-fade', name: 'Fiona Gallagher', mobileNumber: '7735550122', createdAt: '2026-07-05T13:45:00Z' },

  // Golden Scissors
  { id: 'cust-301', salonId: 'salon-golden', name: 'Geralt Rivia', mobileNumber: '4155550199', createdAt: '2025-08-01T15:00:00Z' },
  { id: 'cust-302', salonId: 'salon-golden', name: 'Harry Potter', mobileNumber: '2125550144', createdAt: '2025-09-12T11:20:00Z' }
];

// SVG templates for styling simulation haircuts
const MOCK_HAIRCUT_SVGS = {
  front: `<svg viewBox="0 0 100 100" width="100%" height="100%" style="background:#202024;"><circle cx="50" cy="45" r="22" fill="#3a3a42"/><path d="M50 20 C35 20, 30 35, 30 45 C30 55, 35 52, 40 50 C45 48, 55 48, 60 50 C65 52, 70 55, 70 45 C70 35, 65 20, 50 20 Z" fill="#b45309"/><path d="M28 65 C28 55, 35 55, 50 55 C65 55, 72 55, 72 65 C72 75, 75 90, 75 90 H25 C25 90, 28 75, 28 65 Z" fill="#323238"/></svg>`,
  left: `<svg viewBox="0 0 100 100" width="100%" height="100%" style="background:#202024;"><circle cx="50" cy="45" r="22" fill="#3a3a42"/><path d="M55 20 C42 20, 35 28, 35 45 C35 50, 32 55, 36 57 C40 59, 45 42, 50 40 C55 38, 65 35, 68 45 C70 50, 72 40, 70 30 C68 22, 60 20, 55 20 Z" fill="#b45309"/><path d="M28 65 C28 55, 35 55, 50 55 C65 55, 72 55, 72 65 C72 75, 75 90, 75 90 H25 C25 90, 28 75, 28 65 Z" fill="#323238"/></svg>`,
  right: `<svg viewBox="0 0 100 100" width="100%" height="100%" style="background:#202024;"><circle cx="50" cy="45" r="22" fill="#3a3a42"/><path d="M45 20 C58 20, 65 28, 65 45 C65 50, 68 55, 64 57 C60 59, 55 42, 50 40 C45 38, 35 35, 32 45 C30 50, 28 40, 30 30 C32 22, 40 20, 45 20 Z" fill="#b45309"/><path d="M28 65 C28 55, 35 55, 50 55 C65 55, 72 55, 72 65 C72 75, 75 90, 75 90 H25 C25 90, 28 75, 28 65 Z" fill="#323238"/></svg>`,
  back: `<svg viewBox="0 0 100 100" width="100%" height="100%" style="background:#202024;"><circle cx="50" cy="45" r="22" fill="#3a3a42"/><path d="M50 18 C33 18, 26 28, 26 48 C26 58, 30 63, 50 63 C70 63, 74 58, 74 48 C74 28, 67 18, 50 18 Z" fill="#b45309"/><path d="M28 65 C28 55, 35 55, 50 55 C65 55, 72 55, 72 65 C72 75, 75 90, 75 90 H25 C25 90, 28 75, 28 65 Z" fill="#323238"/></svg>`
};

export const INITIAL_VISITS = [
  // Classic Cuts
  {
    id: 'visit-101-1',
    customerId: 'cust-101',
    staffId: 'staff-marcus',
    date: '2026-05-10T12:00:00Z',
    photos: { ...MOCK_HAIRCUT_SVGS },
    note: 'Classic side part with a low taper fade. Styled with pomade.',
    styleTags: ['Fade', 'Trim', 'Custom']
  },
  {
    id: 'visit-101-2',
    customerId: 'cust-101',
    staffId: 'staff-marcus',
    date: '2026-06-12T11:30:00Z',
    photos: { ...MOCK_HAIRCUT_SVGS },
    note: 'Repeat of low taper. Cut slightly shorter on the top this time.',
    styleTags: ['Fade', 'Trim'],
    repeatOfVisitId: 'visit-101-1'
  },
  {
    id: 'visit-102-1',
    customerId: 'cust-102',
    staffId: 'staff-sarah',
    date: '2026-06-18T15:00:00Z',
    photos: { ...MOCK_HAIRCUT_SVGS },
    note: 'Sleek texturized crop. Styled with matte clay.',
    styleTags: ['Crew Cut', 'Fade']
  },
  {
    id: 'visit-103-1',
    customerId: 'cust-103',
    staffId: 'staff-john',
    date: '2026-07-02T10:15:00Z',
    photos: { ...MOCK_HAIRCUT_SVGS },
    note: 'Bob cut with framing bangs. Soft layers around the back.',
    styleTags: ['Bob', 'Layered']
  },

  // Fade Lab
  {
    id: 'visit-201-1',
    customerId: 'cust-201',
    staffId: 'staff-leroy',
    date: '2026-07-02T10:30:00Z',
    photos: { ...MOCK_HAIRCUT_SVGS },
    note: 'High skin fade with buzz cut on top. Clean lineup.',
    styleTags: ['Fade', 'Undercut']
  },

  // Golden Scissors
  {
    id: 'visit-301-1',
    customerId: 'cust-301',
    staffId: 'staff-helena',
    date: '2026-06-15T16:30:00Z',
    photos: { ...MOCK_HAIRCUT_SVGS },
    note: 'Long layered trim with beard shape up.',
    styleTags: ['Layered', 'Beard Shape-up']
  }
];

export const INITIAL_PAYMENTS = [
  // Classic Cuts
  { id: 'pay-1', salonId: 'salon-classic', amount: 149, date: '2026-05-15T00:00:00Z', status: 'Success', planId: 'pro' },
  { id: 'pay-2', salonId: 'salon-classic', amount: 149, date: '2026-06-15T00:00:00Z', status: 'Success', planId: 'pro' },
  { id: 'pay-3', salonId: 'salon-classic', amount: 149, date: '2026-07-15T00:00:00Z', status: 'Success', planId: 'pro' },

  // Fade Lab
  { id: 'pay-4', salonId: 'salon-fade', amount: 0, date: '2026-07-01T12:00:00Z', status: 'Success', planId: 'growth' }, // Trial has $0 initial payment record

  // Golden Scissors
  { id: 'pay-5', salonId: 'salon-golden', amount: 1490, date: '2025-07-10T10:00:00Z', status: 'Success', planId: 'pro' },
  { id: 'pay-6', salonId: 'salon-golden', amount: 1490, date: '2026-07-10T10:00:00Z', status: 'Failed', planId: 'pro' } // Failed annual renewal leads to PastDue state
];

export const INITIAL_REMINDERS = [
  { id: 'rem-1', customerId: 'cust-101', salonId: 'salon-classic', sentAt: '2026-06-08T09:00:00Z', messagePreview: 'Hey Alex! It has been 4 weeks since your last haircut at Classic Cuts. Ready for a trim? Book here: snip.mem/classic' },
  { id: 'rem-2', customerId: 'cust-102', salonId: 'salon-classic', sentAt: '2026-07-12T10:00:00Z', messagePreview: 'Hey Bruce! Keep that crop looking sharp. It has been 24 days since your last visit. Book your slot now.' }
];

export const INITIAL_ADMIN = {
  email: 'admin@snipmemory.com',
  password: 'admin'
};
