// Shapes returned by the Worker API (see worker/src/lib/serialize.ts).

export type Role = 'owner' | 'manager' | 'stylist';
export type Capability = 'automated_reminders' | 'analytics' | 'station_mode' | 'passport_import' | 'export' | 'branding' | 'priority_support';

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  isPlatformAdmin: boolean;
}

export interface Salon {
  id: string;
  slug: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  country: string;
  timezone: string;
  currency: string;
  brandColor: string;
  bookingUrl: string | null;
  defaultCadenceDays: number;
  remindersEnabled: boolean;
  reminderChannel: 'whatsapp' | 'sms';
  reminderTemplate: string | null;
  sendWindowStart: number;
  sendWindowEnd: number;
  planId: string;
  billingInterval: 'month' | 'year';
  subscriptionStatus: 'trialing' | 'active' | 'past_due' | 'canceled';
  trialEndsAt: number | null;
  currentPeriodEnd: number | null;
  messageCredits: number;
  bonusCredits: number;
  referralCode: string | null;
  onboardedAt: number | null;
  suspendedAt: number | null;
  suspendedReason: string | null;
  hasBillingAccount: boolean;
  createdAt: number;
}

export interface Plan {
  id: string;
  name: string;
  tagline: string;
  maxStaff: number;
  maxClients: number;
  monthlyMessageCredits: number;
  features: string[];
  capabilities: Capability[];
}

export interface Price {
  amount: number;
  currency: string;
}

export interface PricedPlan extends Plan {
  prices: { month: Price | null; year: Price | null };
}

export interface Membership {
  memberId: string | null;
  role: Role;
  salon: Salon;
}

export interface Me {
  user: User | null;
  memberships: Membership[];
  impersonating: { salonId: string; salonName: string } | null;
}

export interface Viewer {
  kind: 'user' | 'station';
  role: Role | null;
  memberId: string | null;
  impersonating: boolean;
}

export interface SalonContextData {
  salon: Salon;
  plan: Plan;
  usage: { clients: number; staff: number; storageBytes: number };
  viewer: Viewer;
}

export interface Member {
  id: string;
  displayName: string;
  role: Role;
  hasPin: boolean;
  hasLogin: boolean;
  email: string | null;
  active: boolean;
  createdAt: number;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  hairProfile: Record<string, string>;
  cadenceDays: number | null;
  photoConsent: boolean;
  marketingConsent: boolean;
  optedOut: boolean;
  hasPassport: boolean;
  visitCount: number;
  totalSpend: number;
  lastVisitAt: number | null;
  nextReminderAt: number | null;
  lastRemindedAt: number | null;
  createdAt: number;
  coverPhotoUrl?: string | null;
}

export type Angle = 'front' | 'left' | 'right' | 'back' | 'detail';

export interface Photo {
  id: string;
  angle: Angle;
  blurred: boolean;
  url: string;
}

export interface Visit {
  id: string;
  clientId: string;
  memberId: string | null;
  stylistName: string | null;
  salonName: string | null;
  service: string;
  styleTags: string[];
  technique: Record<string, string>;
  notes: string | null;
  products: string | null;
  durationMinutes: number | null;
  price: number | null;
  repeatOfVisitId: string | null;
  recovered: boolean;
  photos: Photo[];
  createdAt: number;
}

export interface ClientDetail {
  client: Client;
  visits: Visit[];
  passport: { shared: boolean; sharedAt: number | null; otherSalonsWithHistory: number; visits: Visit[] };
  reminders: { id: string; channel: string; status: string; body: string; manual: boolean; createdAt: number }[];
}
