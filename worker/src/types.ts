import type { Env } from './env';

export type Role = 'owner' | 'manager' | 'staff';
export type App = 'owner' | 'staff' | 'admin';
export type Mode = 'cash' | 'upi' | 'card';

export interface UserRow {
  id: string;
  phone: string;
  name: string;
  pin_hash: string;
  pin_must_change: number;
  password_hash: string | null;
  is_platform_admin: number;
  language: string;
  disabled_at: number | null;
  created_at: number;
  last_login_at: number | null;
}

export interface SessionRow {
  id: string;
  app: App;
  user_id: string;
  shop_id: string | null;
  impersonator_id: string | null;
  expires_at: number;
  created_at: number;
  last_seen_at: number;
}

export interface ShopRow {
  id: string;
  owner_user_id: string;
  name: string;
  shop_type: 'gents' | 'unisex' | 'ladies' | 'spa';
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  timezone: string;
  upi_vpa: string | null;
  upi_name: string | null;
  gst_enabled: number;
  gstin: string | null;
  gst_rate: number;
  gst_inclusive: number;
  bill_prefix: string;
  next_bill_no: number;
  bill_footer: string | null;
  staff_can_discount: number;
  staff_max_discount: number;
  staff_see_phone: number;
  winback_days: number;
  plan_id: string;
  plan_expires_at: number | null;
  trial: number;
  onboarded_at: number | null;
  suspended_at: number | null;
  suspended_reason: string | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

export interface StaffRow {
  id: string;
  shop_id: string;
  user_id: string;
  name: string;
  role: Role;
  commission_pct: number;
  product_commission_pct: number;
  monthly_salary: number;
  color: string;
  active: number;
  created_at: number;
}

export interface PlanRow {
  id: string;
  name: string;
  tagline: string;
  max_staff: number;
  monthly_bill_limit: number;
  price_month: number;
  price_year: number;
  features: string;
  capabilities: string;
  is_public: number;
  sort_order: number;
}

export interface CustomerRow {
  id: string;
  shop_id: string;
  name: string;
  phone: string | null;
  gender: string | null;
  birthday: string | null;
  notes: string | null;
  balance: number;
  visit_count: number;
  total_spend: number;
  last_visit_at: number | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

export interface BillRow {
  id: string;
  shop_id: string;
  bill_no: number;
  client_ref: string;
  public_token: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  staff_id: string;
  created_by: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid_cash: number;
  paid_upi: number;
  paid_card: number;
  paid_advance: number;
  due: number;
  note: string | null;
  day: string;
  created_at: number;
  voided_at: number | null;
  void_reason: string | null;
  voided_by: string | null;
}

export interface BillItemRow {
  id: string;
  bill_id: string;
  shop_id: string;
  kind: 'service' | 'product' | 'custom';
  ref_id: string | null;
  name: string;
  qty: number;
  unit_price: number;
  amount: number;
  net: number;
  staff_id: string;
  commission: number;
  cost: number;
}

/** Who is calling, resolved from the session for `/api/shop/*`. */
export interface Ctx {
  app: 'owner' | 'staff';
  user: UserRow;
  shop: ShopRow;
  me: StaffRow;
  plan: PlanRow;
  /** owner-app with owner/manager role */
  isManager: boolean;
  isOwner: boolean;
  impersonatorId: string | null;
  sessionId: string;
}

export type AppEnv = {
  Bindings: Env;
  Variables: {
    ctx: Ctx;
    adminUser: UserRow;
  };
};
