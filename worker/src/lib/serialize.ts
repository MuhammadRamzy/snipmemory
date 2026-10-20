import type { BillItemRow, BillRow, CustomerRow, PlanRow, ShopRow, StaffRow } from '../types';
import { parseJson } from './http';
import { capabilities } from './plans';

export function serializePlan(plan: PlanRow) {
  return {
    id: plan.id,
    name: plan.name,
    tagline: plan.tagline,
    maxStaff: plan.max_staff,
    monthlyBillLimit: plan.monthly_bill_limit,
    priceMonth: plan.price_month,
    priceYear: plan.price_year,
    features: parseJson<string[]>(plan.features, []),
    capabilities: capabilities(plan),
  };
}

export function serializeShop(shop: ShopRow) {
  return {
    id: shop.id,
    name: shop.name,
    shopType: shop.shop_type,
    phone: shop.phone,
    address: shop.address,
    city: shop.city,
    state: shop.state,
    upiVpa: shop.upi_vpa,
    upiName: shop.upi_name,
    gstEnabled: Boolean(shop.gst_enabled),
    gstin: shop.gstin,
    gstRate: shop.gst_rate,
    gstInclusive: Boolean(shop.gst_inclusive),
    billPrefix: shop.bill_prefix,
    billFooter: shop.bill_footer,
    staffCanDiscount: Boolean(shop.staff_can_discount),
    staffMaxDiscount: shop.staff_max_discount,
    staffSeePhone: Boolean(shop.staff_see_phone),
    winbackDays: shop.winback_days,
    planId: shop.plan_id,
    planExpiresAt: shop.plan_expires_at,
    trial: Boolean(shop.trial),
    onboardedAt: shop.onboarded_at,
    suspendedAt: shop.suspended_at,
    suspendedReason: shop.suspended_reason,
    createdAt: shop.created_at,
  };
}

export function serializeStaff(s: StaffRow & { phone?: string }) {
  return {
    id: s.id,
    name: s.name,
    phone: s.phone ?? null,
    role: s.role,
    commissionPct: s.commission_pct,
    productCommissionPct: s.product_commission_pct,
    monthlySalary: s.monthly_salary,
    color: s.color,
    active: Boolean(s.active),
    createdAt: s.created_at,
  };
}

export function serializeCustomer(c: CustomerRow, hidePhone = false) {
  return {
    id: c.id,
    name: c.name,
    phone: hidePhone && c.phone ? `••••••${c.phone.slice(-4)}` : c.phone,
    gender: c.gender,
    birthday: c.birthday,
    notes: c.notes,
    balance: c.balance,
    visitCount: c.visit_count,
    totalSpend: c.total_spend,
    lastVisitAt: c.last_visit_at,
    createdAt: c.created_at,
  };
}

export function serializeBill(b: BillRow & { staff_name?: string | null }, items: BillItemRow[] = [], hidePhone = false) {
  return {
    id: b.id,
    billNo: b.bill_no,
    clientRef: b.client_ref,
    token: b.public_token,
    customerId: b.customer_id,
    customerName: b.customer_name,
    customerPhone: hidePhone && b.customer_phone ? `••••••${b.customer_phone.slice(-4)}` : b.customer_phone,
    staffId: b.staff_id,
    staffName: b.staff_name ?? null,
    subtotal: b.subtotal,
    discount: b.discount,
    tax: b.tax,
    total: b.total,
    paidCash: b.paid_cash,
    paidUpi: b.paid_upi,
    paidCard: b.paid_card,
    paidAdvance: b.paid_advance,
    due: b.due,
    note: b.note,
    day: b.day,
    createdAt: b.created_at,
    voided: Boolean(b.voided_at),
    voidReason: b.void_reason,
    items: items
      .filter((i) => i.bill_id === b.id)
      .map((i) => ({ id: i.id, kind: i.kind, refId: i.ref_id, name: i.name, qty: i.qty, unitPrice: i.unit_price, amount: i.amount, staffId: i.staff_id, commission: i.commission })),
  };
}
