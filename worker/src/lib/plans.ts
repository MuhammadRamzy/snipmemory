import type { Ctx, PlanRow } from '../types';
import { count } from './db';
import { ApiError, parseJson } from './http';

export type Capability =
  | 'reports'
  | 'commission'
  | 'closing'
  | 'queue'
  | 'inventory'
  | 'gst'
  | 'attendance'
  | 'photos'
  | 'export'
  | 'multi_shop'
  | 'priority_support';

export const TRIAL_PLAN = 'pro';
export const TRIAL_DAYS = 30;

export function capabilities(plan: PlanRow): Capability[] {
  return parseJson<Capability[]>(plan.capabilities, []);
}

export function has(ctx: Ctx, cap: Capability): boolean {
  return capabilities(ctx.plan).includes(cap);
}

const CAP_LABEL: Record<Capability, string> = {
  reports: 'Reports',
  commission: 'Staff commission',
  closing: 'Cash closing',
  queue: 'Token queue',
  inventory: 'Product stock',
  gst: 'GST bills',
  attendance: 'Attendance',
  photos: 'Customer photos',
  export: 'Export',
  multi_shop: 'Multiple shops',
  priority_support: 'Priority support',
};

export function requireCap(ctx: Ctx, cap: Capability): void {
  if (!has(ctx, cap)) {
    throw new ApiError(402, 'upgrade_required', `${CAP_LABEL[cap]} is not in your ${ctx.plan.name} plan. Upgrade to use it.`);
  }
}

export async function assertStaffQuota(db: D1Database, ctx: Ctx): Promise<void> {
  if (ctx.plan.max_staff < 0) return;
  const n = await count(db, 'SELECT COUNT(*) AS n FROM staff WHERE shop_id = ? AND active = 1', ctx.shop.id);
  if (n >= ctx.plan.max_staff) {
    throw new ApiError(402, 'staff_limit', `Your ${ctx.plan.name} plan allows ${ctx.plan.max_staff} people. Upgrade to add more staff.`);
  }
}

/** Bills this calendar month (by business day prefix). */
export async function assertBillQuota(db: D1Database, ctx: Ctx, day: string): Promise<void> {
  if (ctx.plan.monthly_bill_limit < 0) return;
  const n = await count(db, 'SELECT COUNT(*) AS n FROM bills WHERE shop_id = ? AND day LIKE ?', ctx.shop.id, `${day.slice(0, 7)}%`);
  if (n >= ctx.plan.monthly_bill_limit) {
    throw new ApiError(
      402,
      'bill_limit',
      `You have made ${ctx.plan.monthly_bill_limit} bills this month — the Free plan limit. Upgrade to Starter (₹149/month) for unlimited bills.`,
    );
  }
}
