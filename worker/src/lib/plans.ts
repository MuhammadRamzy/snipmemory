import type { PlanRow, SalonRow } from '../types';
import { count, first } from './db';
import { notFound, paymentRequired, parseJson } from './http';

export type Capability =
  | 'automated_reminders'
  | 'analytics'
  | 'station_mode'
  | 'passport_import'
  | 'export'
  | 'branding'
  | 'priority_support';

export const FREE_PLAN = 'free';
export const TRIAL_PLAN = 'studio';
export const TRIAL_DAYS = 14;
export const TRIAL_CREDITS = 50;
/** Days a failed payment is tolerated before the salon falls back to the Free plan. */
export const PAST_DUE_GRACE_DAYS = 14;

export async function getPlan(db: D1Database, id: string): Promise<PlanRow> {
  const plan = await first<PlanRow>(db, 'SELECT * FROM plans WHERE id = ?', id);
  if (!plan) throw notFound('Plan');
  return plan;
}

export function capabilities(plan: PlanRow): Capability[] {
  return parseJson<Capability[]>(plan.capabilities, []);
}

export async function requireCapability(db: D1Database, salon: SalonRow, capability: Capability): Promise<PlanRow> {
  const plan = await getPlan(db, salon.plan_id);
  if (!capabilities(plan).includes(capability)) {
    throw paymentRequired(`Your ${plan.name} plan doesn't include this feature. Upgrade to unlock it.`, 'upgrade_required');
  }
  return plan;
}

export async function assertClientQuota(db: D1Database, salon: SalonRow): Promise<void> {
  const plan = await getPlan(db, salon.plan_id);
  if (plan.max_clients < 0) return;
  const n = await count(db, 'SELECT COUNT(*) AS n FROM clients WHERE salon_id = ? AND deleted_at IS NULL', salon.id);
  if (n >= plan.max_clients) {
    throw paymentRequired(`The ${plan.name} plan holds up to ${plan.max_clients} clients. Upgrade to keep adding new clients — existing ones stay available.`);
  }
}

export async function assertStaffQuota(db: D1Database, salon: SalonRow): Promise<void> {
  const plan = await getPlan(db, salon.plan_id);
  if (plan.max_staff < 0) return;
  const n = await count(db, 'SELECT COUNT(*) AS n FROM members WHERE salon_id = ? AND active = 1', salon.id);
  if (n >= plan.max_staff) {
    throw paymentRequired(`The ${plan.name} plan includes ${plan.max_staff} stylist${plan.max_staff === 1 ? '' : 's'}. Upgrade to add more team members.`);
  }
}

export interface PlanPrice {
  plan_id: string;
  currency: string;
  interval: 'month' | 'year';
  amount: number;
  stripe_price_id: string | null;
}

/** Price in the salon's currency, falling back to USD when a currency isn't configured. */
export async function priceFor(db: D1Database, planId: string, currency: string, interval: 'month' | 'year'): Promise<PlanPrice | null> {
  return (
    (await first<PlanPrice>(db, 'SELECT * FROM plan_prices WHERE plan_id = ? AND currency = ? AND interval = ?', planId, currency, interval)) ??
    (await first<PlanPrice>(db, "SELECT * FROM plan_prices WHERE plan_id = ? AND currency = 'USD' AND interval = ?", planId, interval))
  );
}

/** One-off message credit packs (purchased credits never expire). Amounts in minor units. */
export const CREDIT_PACKS = [
  { id: 'pack_250', credits: 250, prices: { USD: 600, INR: 34900, GBP: 500, AED: 2200, EUR: 550 } },
  { id: 'pack_1000', credits: 1000, prices: { USD: 2000, INR: 119900, GBP: 1700, AED: 7500, EUR: 1900 } },
] as const;

export type CreditPack = (typeof CREDIT_PACKS)[number];

export function packPrice(pack: CreditPack, currency: string): { currency: string; amount: number } {
  const prices = pack.prices as Record<string, number>;
  return prices[currency] ? { currency, amount: prices[currency] } : { currency: 'USD', amount: pack.prices.USD };
}
