import type { Env } from './env';

export type Role = 'owner' | 'manager' | 'stylist';

export interface UserRow {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  password_hash: string;
  is_platform_admin: number;
  disabled_at: number | null;
  created_at: number;
  last_login_at: number | null;
}

export interface SessionRow {
  id: string;
  kind: 'user' | 'station' | 'client';
  user_id: string | null;
  salon_id: string | null;
  passport_id: string | null;
  impersonator_id: string | null;
  acting_member_id: string | null;
  acting_until: number | null;
  expires_at: number;
  created_at: number;
  last_seen_at: number;
}

export interface SalonRow {
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
  brand_color: string;
  booking_url: string | null;
  default_cadence_days: number;
  reminders_enabled: number;
  reminder_channel: 'whatsapp' | 'sms';
  reminder_template: string | null;
  send_window_start: number;
  send_window_end: number;
  plan_id: string;
  billing_interval: 'month' | 'year';
  subscription_status: 'trialing' | 'active' | 'past_due' | 'canceled';
  trial_ends_at: number | null;
  current_period_end: number | null;
  past_due_since: number | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  message_credits: number;
  bonus_credits: number;
  credits_reset_at: number | null;
  referral_code: string | null;
  referred_by_salon_id: string | null;
  onboarded_at: number | null;
  suspended_at: number | null;
  suspended_reason: string | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

export interface MemberRow {
  id: string;
  salon_id: string;
  user_id: string | null;
  display_name: string;
  role: Role;
  pin_hash: string | null;
  active: number;
  created_at: number;
}

export interface ClientRow {
  id: string;
  salon_id: string;
  passport_id: string | null;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  hair_profile: string;
  cadence_days: number | null;
  photo_consent_at: number | null;
  marketing_consent_at: number | null;
  opted_out_at: number | null;
  unsubscribe_token: string;
  visit_count: number;
  total_spend: number;
  last_visit_at: number | null;
  next_reminder_at: number | null;
  last_reminded_at: number | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

export interface VisitRow {
  id: string;
  salon_id: string;
  client_id: string;
  member_id: string | null;
  service: string;
  style_tags: string;
  technique: string;
  notes: string | null;
  products: string | null;
  duration_minutes: number | null;
  price: number | null;
  repeat_of_visit_id: string | null;
  recovered_by_message_id: string | null;
  created_at: number;
  deleted_at: number | null;
}

export interface PhotoRow {
  id: string;
  salon_id: string;
  visit_id: string;
  angle: 'front' | 'left' | 'right' | 'back' | 'detail';
  r2_key: string;
  content_type: string;
  bytes: number;
  blurred: number;
  created_at: number;
}

export interface PlanRow {
  id: string;
  name: string;
  tagline: string;
  max_staff: number;
  max_clients: number;
  monthly_message_credits: number;
  features: string;
  capabilities: string;
  is_public: number;
  sort_order: number;
}

/** Resolved permissions of the caller for one salon. */
export interface Access {
  salon: SalonRow;
  kind: 'user' | 'station';
  role: Role | null;
  memberId: string | null;
  userId: string | null;
  impersonatorId: string | null;
}

export type AppEnv = {
  Bindings: Env;
  Variables: {
    userSession: SessionRow | null | undefined;
    user: UserRow | null | undefined;
    access: Access;
  };
};
