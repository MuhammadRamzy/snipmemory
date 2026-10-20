import type { ClientRow, MemberRow, PhotoRow, PlanRow, SalonRow, UserRow, VisitRow } from '../types';
import { parseJson } from './http';
import { capabilities } from './plans';

export function serializeUser(user: UserRow) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    isPlatformAdmin: Boolean(user.is_platform_admin),
    createdAt: user.created_at,
  };
}

export function serializePlan(plan: PlanRow) {
  return {
    id: plan.id,
    name: plan.name,
    tagline: plan.tagline,
    maxStaff: plan.max_staff,
    maxClients: plan.max_clients,
    monthlyMessageCredits: plan.monthly_message_credits,
    features: parseJson<string[]>(plan.features, []),
    capabilities: capabilities(plan),
  };
}

export function serializeSalon(salon: SalonRow) {
  return {
    id: salon.id,
    slug: salon.slug,
    name: salon.name,
    phone: salon.phone,
    email: salon.email,
    address: salon.address,
    city: salon.city,
    country: salon.country,
    timezone: salon.timezone,
    currency: salon.currency,
    brandColor: salon.brand_color,
    bookingUrl: salon.booking_url,
    defaultCadenceDays: salon.default_cadence_days,
    remindersEnabled: Boolean(salon.reminders_enabled),
    reminderChannel: salon.reminder_channel,
    reminderTemplate: salon.reminder_template,
    sendWindowStart: salon.send_window_start,
    sendWindowEnd: salon.send_window_end,
    planId: salon.plan_id,
    billingInterval: salon.billing_interval,
    subscriptionStatus: salon.subscription_status,
    trialEndsAt: salon.trial_ends_at,
    currentPeriodEnd: salon.current_period_end,
    messageCredits: salon.message_credits,
    bonusCredits: salon.bonus_credits,
    referralCode: salon.referral_code,
    onboardedAt: salon.onboarded_at,
    suspendedAt: salon.suspended_at,
    suspendedReason: salon.suspended_reason,
    hasBillingAccount: Boolean(salon.stripe_customer_id),
    createdAt: salon.created_at,
  };
}

export function serializeMember(member: MemberRow & { email?: string | null }) {
  return {
    id: member.id,
    displayName: member.display_name,
    role: member.role,
    hasPin: Boolean(member.pin_hash),
    hasLogin: Boolean(member.user_id),
    email: member.email ?? null,
    active: Boolean(member.active),
    createdAt: member.created_at,
  };
}

export function serializeClient(client: ClientRow) {
  return {
    id: client.id,
    name: client.name,
    phone: client.phone,
    email: client.email,
    notes: client.notes,
    hairProfile: parseJson<Record<string, string>>(client.hair_profile, {}),
    cadenceDays: client.cadence_days,
    photoConsent: Boolean(client.photo_consent_at),
    marketingConsent: Boolean(client.marketing_consent_at),
    optedOut: Boolean(client.opted_out_at),
    hasPassport: Boolean(client.passport_id),
    visitCount: client.visit_count,
    totalSpend: client.total_spend,
    lastVisitAt: client.last_visit_at,
    nextReminderAt: client.next_reminder_at,
    lastRemindedAt: client.last_reminded_at,
    createdAt: client.created_at,
  };
}

export function serializePhoto(photo: PhotoRow) {
  return { id: photo.id, angle: photo.angle, blurred: Boolean(photo.blurred), url: `/api/media/${photo.id}` };
}

export function serializeVisit(visit: VisitRow & { stylist_name?: string | null; salon_name?: string | null }, photos: PhotoRow[]) {
  return {
    id: visit.id,
    clientId: visit.client_id,
    memberId: visit.member_id,
    stylistName: visit.stylist_name ?? null,
    salonName: visit.salon_name ?? null,
    service: visit.service,
    styleTags: parseJson<string[]>(visit.style_tags, []),
    technique: parseJson<Record<string, string>>(visit.technique, {}),
    notes: visit.notes,
    products: visit.products,
    durationMinutes: visit.duration_minutes,
    price: visit.price,
    repeatOfVisitId: visit.repeat_of_visit_id,
    recovered: Boolean(visit.recovered_by_message_id),
    photos: photos.filter((p) => p.visit_id === visit.id).map(serializePhoto),
    createdAt: visit.created_at,
  };
}
