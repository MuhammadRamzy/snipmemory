import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv, PlanRow, ShopRow, StaffRow } from '../types';
import { audit } from '../lib/audit';
import { newId } from '../lib/crypto';
import { all, count, first, now, run } from '../lib/db';
import { addDays, dayOf, isDay, monthStart } from '../lib/day';
import { EXPENSE_CATEGORIES } from '../lib/defaults';
import { badRequest, body, conflict, notFound } from '../lib/http';
import { normalizePhone } from '../lib/phone';
import { requireCap } from '../lib/plans';
import { serializePlan, serializeShop } from '../lib/serialize';
import { shopAccess } from '../lib/session';

const shop = new Hono<AppEnv>();

const rupees = z.number().int().min(0).max(10_000_000_00);
export const UPI_VPA = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
shop.patch('/settings', shopAccess('owner'), async (c) => {
  const input = await body(
    c,
    z
      .object({
        name: z.string().trim().min(2).max(80),
        shopType: z.enum(['gents', 'unisex', 'ladies', 'spa']),
        phone: z.string().trim().max(16).nullable(),
        address: z.string().trim().max(200).nullable(),
        city: z.string().trim().max(60).nullable(),
        state: z.string().trim().max(60).nullable(),
        upiVpa: z.string().trim().max(100).nullable(),
        upiName: z.string().trim().max(60).nullable(),
        gstEnabled: z.boolean(),
        gstin: z.string().trim().toUpperCase().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/, 'GSTIN looks wrong (15 characters)').nullable(),
        gstRate: z.number().int().min(0).max(28),
        gstInclusive: z.boolean(),
        billPrefix: z.string().trim().max(8),
        billFooter: z.string().trim().max(200).nullable(),
        staffCanDiscount: z.boolean(),
        staffMaxDiscount: z.number().int().min(0).max(100),
        staffSeePhone: z.boolean(),
        winbackDays: z.number().int().min(7).max(180),
      })
      .partial(),
  );
  const ctx = c.get('ctx');
  if (input.upiVpa && !UPI_VPA.test(input.upiVpa)) throw badRequest('UPI ID looks wrong. It is like name@okaxis or 98xxxxxx@ybl.');
  if (input.gstEnabled) requireCap(ctx, 'gst');
  if (input.gstEnabled && !(input.gstin ?? ctx.shop.gstin)) throw badRequest('Enter your GSTIN to make GST bills.');
  const cols: Record<string, unknown> = {
    name: input.name,
    shop_type: input.shopType,
    phone: input.phone === undefined ? undefined : input.phone ? normalizePhone(input.phone, 'IN') : null,
    address: input.address,
    city: input.city,
    state: input.state,
    upi_vpa: input.upiVpa === undefined ? undefined : input.upiVpa ? input.upiVpa.toLowerCase() : null,
    upi_name: input.upiName,
    gst_enabled: input.gstEnabled === undefined ? undefined : Number(input.gstEnabled),
    gstin: input.gstin,
    gst_rate: input.gstRate,
    gst_inclusive: input.gstInclusive === undefined ? undefined : Number(input.gstInclusive),
    bill_prefix: input.billPrefix,
    bill_footer: input.billFooter,
    staff_can_discount: input.staffCanDiscount === undefined ? undefined : Number(input.staffCanDiscount),
    staff_max_discount: input.staffMaxDiscount,
    staff_see_phone: input.staffSeePhone === undefined ? undefined : Number(input.staffSeePhone),
    winback_days: input.winbackDays,
  };
  const entries = Object.entries(cols).filter(([, v]) => v !== undefined);
  if (entries.length) {
    await run(c.env.DB, `UPDATE shops SET ${entries.map(([k]) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`, ...entries.map(([, v]) => v), now(), ctx.shop.id);
  }
  if (input.upiVpa !== undefined) await audit(c, { action: 'shop.upi_changed', meta: { upi: input.upiVpa } });
  const updated = await first<ShopRow>(c.env.DB, 'SELECT * FROM shops WHERE id = ?', ctx.shop.id);
  return c.json({ shop: serializeShop(updated!) });
});

shop.post('/onboarded', shopAccess('owner'), async (c) => {
  await run(c.env.DB, 'UPDATE shops SET onboarded_at = COALESCE(onboarded_at, ?) WHERE id = ?', now(), c.get('ctx').shop.id);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Catalogue — everything the billing screen needs (cached on the phone for offline billing)
// ---------------------------------------------------------------------------
shop.get('/catalog', shopAccess('any'), async (c) => {
  const ctx = c.get('ctx');
  const db = c.env.DB;
  const [services, products, team] = await Promise.all([
    all<{ id: string; name: string; category: string; price: number; minutes: number; active: number }>(
      db,
      `SELECT id, name, category, price, minutes, active FROM services WHERE shop_id = ? ${ctx.isManager ? '' : 'AND active = 1'} ORDER BY sort_order, name`,
      ctx.shop.id,
    ),
    all<{ id: string; name: string; price: number; cost: number; stock: number; low_stock: number; active: number }>(
      db,
      `SELECT id, name, price, cost, stock, low_stock, active FROM products WHERE shop_id = ? ${ctx.isManager ? '' : 'AND active = 1'} ORDER BY name`,
      ctx.shop.id,
    ),
    all<StaffRow>(db, 'SELECT * FROM staff WHERE shop_id = ? AND active = 1 ORDER BY role, name', ctx.shop.id),
  ]);
  return c.json({
    services: services.map((s) => ({ id: s.id, name: s.name, category: s.category, price: s.price, minutes: s.minutes, active: Boolean(s.active) })),
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      cost: ctx.isManager ? p.cost : undefined,
      stock: p.stock,
      lowStock: p.low_stock,
      active: Boolean(p.active),
    })),
    staff: team.map((s) => ({ id: s.id, name: s.name, color: s.color, role: s.role })),
    expenseCategories: EXPENSE_CATEGORIES,
  });
});

const serviceFields = {
  name: z.string().trim().min(1, 'Enter service name').max(60),
  category: z.string().trim().min(1).max(30).default('Hair'),
  price: rupees,
  minutes: z.number().int().min(5).max(600).default(20),
  active: z.boolean().optional(),
};

shop.post('/services', shopAccess('manager'), async (c) => {
  const input = await body(c, z.object(serviceFields));
  const ctx = c.get('ctx');
  const n = await count(c.env.DB, 'SELECT COUNT(*) AS n FROM services WHERE shop_id = ?', ctx.shop.id);
  if (n >= 300) throw badRequest('You can have up to 300 services.');
  const id = newId('svc');
  await run(
    c.env.DB,
    'INSERT INTO services (id, shop_id, name, category, price, minutes, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    id,
    ctx.shop.id,
    input.name,
    input.category,
    input.price,
    input.minutes,
    n,
    now(),
  );
  return c.json({ id }, 201);
});

shop.patch('/services/:id', shopAccess('manager'), async (c) => {
  const input = await body(c, z.object(serviceFields).partial());
  const ctx = c.get('ctx');
  const svc = await first<{ id: string; name: string; category: string; price: number; minutes: number; active: number }>(
    c.env.DB,
    'SELECT * FROM services WHERE id = ? AND shop_id = ?',
    c.req.param('id'),
    ctx.shop.id,
  );
  if (!svc) throw notFound('Service');
  await run(
    c.env.DB,
    'UPDATE services SET name = ?, category = ?, price = ?, minutes = ?, active = ? WHERE id = ?',
    input.name ?? svc.name,
    input.category ?? svc.category,
    input.price ?? svc.price,
    input.minutes ?? svc.minutes,
    input.active === undefined ? svc.active : Number(input.active),
    svc.id,
  );
  if (input.price !== undefined && input.price !== svc.price) await audit(c, { action: 'service.price_changed', targetId: svc.id, meta: { name: svc.name, from: svc.price, to: input.price } });
  return c.json({ ok: true });
});

const productFields = {
  name: z.string().trim().min(1, 'Enter product name').max(60),
  price: rupees,
  cost: rupees.default(0),
  stock: z.number().int().min(-9999).max(99999).default(0),
  lowStock: z.number().int().min(0).max(9999).default(2),
  active: z.boolean().optional(),
};

shop.post('/products', shopAccess('manager'), async (c) => {
  const input = await body(c, z.object(productFields));
  const ctx = c.get('ctx');
  const id = newId('prd');
  await run(
    c.env.DB,
    'INSERT INTO products (id, shop_id, name, price, cost, stock, low_stock, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    id,
    ctx.shop.id,
    input.name,
    input.price,
    input.cost,
    input.stock,
    input.lowStock,
    now(),
  );
  return c.json({ id }, 201);
});

shop.patch('/products/:id', shopAccess('manager'), async (c) => {
  const input = await body(c, z.object(productFields).omit({ stock: true }).partial());
  const ctx = c.get('ctx');
  const p = await first<{ id: string; name: string; price: number; cost: number; low_stock: number; active: number }>(
    c.env.DB,
    'SELECT * FROM products WHERE id = ? AND shop_id = ?',
    c.req.param('id'),
    ctx.shop.id,
  );
  if (!p) throw notFound('Product');
  await run(
    c.env.DB,
    'UPDATE products SET name = ?, price = ?, cost = ?, low_stock = ?, active = ? WHERE id = ?',
    input.name ?? p.name,
    input.price ?? p.price,
    input.cost ?? p.cost,
    input.lowStock ?? p.low_stock,
    input.active === undefined ? p.active : Number(input.active),
    p.id,
  );
  return c.json({ ok: true });
});

/** Stock in (purchase) or correction. A purchase can be recorded as an expense in one go. */
shop.post('/products/:id/stock', shopAccess('manager'), async (c) => {
  const input = await body(
    c,
    z.object({ change: z.number().int().min(-9999).max(9999), paid: rupees.optional(), mode: z.enum(['cash', 'upi', 'card']).default('cash') }),
  );
  const ctx = c.get('ctx');
  requireCap(ctx, 'inventory');
  const p = await first<{ id: string; name: string }>(c.env.DB, 'SELECT id, name FROM products WHERE id = ? AND shop_id = ?', c.req.param('id'), ctx.shop.id);
  if (!p) throw notFound('Product');
  const statements = [c.env.DB.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').bind(input.change, p.id)];
  if (input.paid && input.change > 0) {
    statements.push(
      c.env.DB
        .prepare("INSERT INTO expenses (id, shop_id, category, amount, mode, note, day, created_by, created_at) VALUES (?, ?, 'Products & stock', ?, ?, ?, ?, ?, ?)")
        .bind(newId('exp'), ctx.shop.id, input.paid, input.mode, `${input.change} × ${p.name}`, dayOf(ctx.shop.timezone), ctx.me.id, now()),
    );
  }
  await c.env.DB.batch(statements);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Expenses (kharcha)
// ---------------------------------------------------------------------------
shop.get('/expenses', shopAccess('manager'), async (c) => {
  const ctx = c.get('ctx');
  const today = dayOf(ctx.shop.timezone);
  const from = isDay(c.req.query('from')) ? c.req.query('from')! : monthStart(today);
  const to = isDay(c.req.query('to')) ? c.req.query('to')! : today;
  const rows = await all<{ id: string; category: string; amount: number; mode: string; note: string | null; day: string; created_at: number }>(
    c.env.DB,
    'SELECT id, category, amount, mode, note, day, created_at FROM expenses WHERE shop_id = ? AND deleted_at IS NULL AND day BETWEEN ? AND ? ORDER BY day DESC, created_at DESC LIMIT 500',
    ctx.shop.id,
    from,
    to,
  );
  return c.json({
    from,
    to,
    total: rows.reduce((s, r) => s + r.amount, 0),
    expenses: rows.map((r) => ({ id: r.id, category: r.category, amount: r.amount, mode: r.mode, note: r.note, day: r.day, createdAt: r.created_at })),
  });
});

shop.post('/expenses', shopAccess('manager'), async (c) => {
  const input = await body(
    c,
    z.object({
      category: z.string().trim().min(1).max(40),
      amount: z.number().int().min(100, 'Enter amount').max(10_000_000_00),
      mode: z.enum(['cash', 'upi', 'card']).default('cash'),
      note: z.string().max(200).nullable().optional(),
      day: z.string().optional(),
    }),
  );
  const ctx = c.get('ctx');
  const today = dayOf(ctx.shop.timezone);
  const day = isDay(input.day) && input.day <= today && input.day >= addDays(today, -60) ? input.day : today;
  const id = newId('exp');
  await run(
    c.env.DB,
    'INSERT INTO expenses (id, shop_id, category, amount, mode, note, day, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    id,
    ctx.shop.id,
    input.category,
    input.amount,
    input.mode,
    input.note ?? null,
    day,
    ctx.me.id,
    now(),
  );
  return c.json({ id }, 201);
});

shop.delete('/expenses/:id', shopAccess('manager'), async (c) => {
  const ctx = c.get('ctx');
  await run(c.env.DB, 'UPDATE expenses SET deleted_at = ? WHERE id = ? AND shop_id = ?', now(), c.req.param('id'), ctx.shop.id);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Owner home: today at a glance
// ---------------------------------------------------------------------------
shop.get('/home', shopAccess('manager'), async (c) => {
  const ctx = c.get('ctx');
  const db = c.env.DB;
  const today = dayOf(ctx.shop.timezone);
  const yesterday = addDays(today, -1);
  const sums = `COUNT(*) AS bills, COALESCE(SUM(total), 0) AS sales, COALESCE(SUM(paid_cash), 0) AS cash, COALESCE(SUM(paid_upi), 0) AS upi,
    COALESCE(SUM(paid_card), 0) AS card, COALESCE(SUM(due), 0) AS due, COALESCE(SUM(paid_advance), 0) AS advance`;
  type Sums = { bills: number; sales: number; cash: number; upi: number; card: number; due: number; advance: number };
  const [todaySums, yesterdaySums, monthSums, byStaff, waiting, outstanding, lowStock, collected, expensesToday] = await Promise.all([
    first<Sums>(db, `SELECT ${sums} FROM bills WHERE shop_id = ? AND day = ? AND voided_at IS NULL`, ctx.shop.id, today),
    first<Sums>(db, `SELECT ${sums} FROM bills WHERE shop_id = ? AND day = ? AND voided_at IS NULL`, ctx.shop.id, yesterday),
    first<Sums>(db, `SELECT ${sums} FROM bills WHERE shop_id = ? AND day >= ? AND voided_at IS NULL`, ctx.shop.id, monthStart(today)),
    all<{ id: string; name: string; color: string; bills: number; sales: number; commission: number }>(
      db,
      `SELECT s.id, s.name, s.color,
         (SELECT COUNT(*) FROM bills b WHERE b.staff_id = s.id AND b.day = ?1 AND b.voided_at IS NULL) AS bills,
         COALESCE((SELECT SUM(i.net) FROM bill_items i JOIN bills b ON b.id = i.bill_id WHERE i.staff_id = s.id AND b.day = ?1 AND b.voided_at IS NULL), 0) AS sales,
         COALESCE((SELECT SUM(i.commission) FROM bill_items i JOIN bills b ON b.id = i.bill_id WHERE i.staff_id = s.id AND b.day = ?1 AND b.voided_at IS NULL), 0) AS commission
       FROM staff s WHERE s.shop_id = ?2 AND s.active = 1 ORDER BY sales DESC`,
      today,
      ctx.shop.id,
    ),
    count(db, "SELECT COUNT(*) AS n FROM queue WHERE shop_id = ? AND day = ? AND status IN ('waiting', 'serving')", ctx.shop.id, today),
    first<{ n: number | null; people: number }>(db, 'SELECT -SUM(balance) AS n, COUNT(*) AS people FROM customers WHERE shop_id = ? AND balance < 0 AND deleted_at IS NULL', ctx.shop.id),
    count(db, 'SELECT COUNT(*) AS n FROM products WHERE shop_id = ? AND active = 1 AND stock <= low_stock', ctx.shop.id),
    first<{ cash: number; upi: number }>(
      db,
      "SELECT COALESCE(SUM(CASE WHEN mode = 'cash' THEN amount END), 0) AS cash, COALESCE(SUM(CASE WHEN mode != 'cash' THEN amount END), 0) AS upi FROM ledger WHERE shop_id = ? AND day = ? AND kind IN ('due_paid', 'advance_added')",
      ctx.shop.id,
      today,
    ),
    count(db, 'SELECT COALESCE(SUM(amount), 0) AS n FROM expenses WHERE shop_id = ? AND day = ? AND deleted_at IS NULL', ctx.shop.id, today),
  ]);
  return c.json({
    day: today,
    today: todaySums,
    yesterday: yesterdaySums,
    month: monthSums,
    collectedToday: collected,
    expensesToday,
    byStaff,
    queueWaiting: waiting,
    udhaar: { amount: outstanding?.n ?? 0, people: outstanding?.people ?? 0 },
    lowStock,
    upiMissing: !ctx.shop.upi_vpa,
  });
});

// ---------------------------------------------------------------------------
// Cash closing (galla hisaab)
// ---------------------------------------------------------------------------
async function cashFor(db: D1Database, shopId: string, day: string) {
  const [sales, collected, expenses, staffPaid, prev] = await Promise.all([
    count(db, 'SELECT COALESCE(SUM(paid_cash), 0) AS n FROM bills WHERE shop_id = ? AND day = ? AND voided_at IS NULL', shopId, day),
    count(db, "SELECT COALESCE(SUM(amount), 0) AS n FROM ledger WHERE shop_id = ? AND day = ? AND mode = 'cash' AND kind IN ('due_paid', 'advance_added')", shopId, day),
    count(db, "SELECT COALESCE(SUM(amount), 0) AS n FROM expenses WHERE shop_id = ? AND day = ? AND mode = 'cash' AND deleted_at IS NULL", shopId, day),
    count(db, "SELECT COALESCE(SUM(amount), 0) AS n FROM staff_txns WHERE shop_id = ? AND day = ? AND mode = 'cash' AND kind IN ('advance', 'payout', 'bonus') AND deleted_at IS NULL", shopId, day),
    first<{ counted_cash: number }>(db, 'SELECT counted_cash FROM closings WHERE shop_id = ? AND day < ? ORDER BY day DESC LIMIT 1', shopId, day),
  ]);
  const opening = prev?.counted_cash ?? 0;
  return { opening, cashSales: sales, cashCollected: collected, cashExpenses: expenses, cashToStaff: staffPaid, expected: opening + sales + collected - expenses - staffPaid };
}

shop.get('/closing', shopAccess('manager'), async (c) => {
  const ctx = c.get('ctx');
  requireCap(ctx, 'closing');
  const today = dayOf(ctx.shop.timezone);
  const day = isDay(c.req.query('day')) ? c.req.query('day')! : today;
  const numbers = await cashFor(c.env.DB, ctx.shop.id, day);
  const closed = await first<{ counted_cash: number; expected_cash: number; note: string | null; created_at: number }>(
    c.env.DB,
    'SELECT counted_cash, expected_cash, note, created_at FROM closings WHERE shop_id = ? AND day = ?',
    ctx.shop.id,
    day,
  );
  const history = await all<{ day: string; expected_cash: number; counted_cash: number }>(
    c.env.DB,
    'SELECT day, expected_cash, counted_cash FROM closings WHERE shop_id = ? ORDER BY day DESC LIMIT 14',
    ctx.shop.id,
  );
  return c.json({
    day,
    ...numbers,
    closed: closed ? { counted: closed.counted_cash, expected: closed.expected_cash, note: closed.note, at: closed.created_at } : null,
    history: history.map((h) => ({ day: h.day, expected: h.expected_cash, counted: h.counted_cash, difference: h.counted_cash - h.expected_cash })),
  });
});

shop.post('/closing', shopAccess('manager'), async (c) => {
  const input = await body(c, z.object({ day: z.string(), countedCash: z.number().int().min(0).max(10_000_000_00), note: z.string().max(200).nullable().optional() }));
  const ctx = c.get('ctx');
  requireCap(ctx, 'closing');
  if (!isDay(input.day) || input.day > dayOf(ctx.shop.timezone)) throw badRequest('Choose a valid date.');
  const n = await cashFor(c.env.DB, ctx.shop.id, input.day);
  await run(
    c.env.DB,
    `INSERT INTO closings (shop_id, day, opening_cash, expected_cash, counted_cash, note, closed_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(shop_id, day) DO UPDATE SET opening_cash = excluded.opening_cash, expected_cash = excluded.expected_cash,
       counted_cash = excluded.counted_cash, note = excluded.note, closed_by = excluded.closed_by, created_at = excluded.created_at`,
    ctx.shop.id,
    input.day,
    n.opening,
    n.expected,
    input.countedCash,
    input.note ?? null,
    ctx.me.id,
    now(),
  );
  return c.json({ ok: true, difference: input.countedCash - n.expected });
});

// ---------------------------------------------------------------------------
// SnipMemory subscription — pay by UPI, submit the UTR, we verify.
// ---------------------------------------------------------------------------
shop.get('/subscription', shopAccess('owner'), async (c) => {
  const ctx = c.get('ctx');
  const plans = await all<PlanRow>(c.env.DB, 'SELECT * FROM plans WHERE is_public = 1 ORDER BY sort_order');
  const payments = await all<{ id: string; plan_id: string; period: string; amount: number; utr: string; status: string; note: string | null; created_at: number }>(
    c.env.DB,
    'SELECT * FROM subscription_payments WHERE shop_id = ? ORDER BY created_at DESC LIMIT 20',
    ctx.shop.id,
  );
  const staffCount = await count(c.env.DB, 'SELECT COUNT(*) AS n FROM staff WHERE shop_id = ? AND active = 1', ctx.shop.id);
  return c.json({
    plans: plans.map(serializePlan),
    current: { planId: ctx.plan.id, expiresAt: ctx.shop.plan_expires_at, trial: Boolean(ctx.shop.trial) },
    staffCount,
    pay: { vpa: c.env.PLATFORM_UPI_VPA, name: c.env.PLATFORM_UPI_NAME, reference: `SM${ctx.shop.id.slice(4, 12).toUpperCase()}` },
    payments: payments.map((p) => ({ id: p.id, planId: p.plan_id, period: p.period, amount: p.amount, utr: p.utr, status: p.status, note: p.note, createdAt: p.created_at })),
  });
});

shop.post('/subscription', shopAccess('owner'), async (c) => {
  const input = await body(
    c,
    z.object({ planId: z.string(), period: z.enum(['month', 'year']), utr: z.string().trim().regex(/^[A-Za-z0-9]{10,22}$/, 'UTR / transaction ID is usually 12 digits') }),
  );
  const ctx = c.get('ctx');
  const plan = await first<PlanRow>(c.env.DB, 'SELECT * FROM plans WHERE id = ? AND is_public = 1', input.planId);
  if (!plan || plan.id === 'free') throw notFound('Plan');
  const pending = await count(c.env.DB, "SELECT COUNT(*) AS n FROM subscription_payments WHERE shop_id = ? AND status = 'pending'", ctx.shop.id);
  if (pending >= 3) throw badRequest('You already have payments waiting for confirmation. We will confirm them soon.');
  if (await first(c.env.DB, "SELECT 1 FROM subscription_payments WHERE utr = ? AND status != 'rejected'", input.utr.toUpperCase())) {
    throw conflict('This UTR was already submitted.');
  }
  const id = newId('sub');
  await run(
    c.env.DB,
    'INSERT INTO subscription_payments (id, shop_id, plan_id, period, amount, utr, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    id,
    ctx.shop.id,
    plan.id,
    input.period,
    input.period === 'year' ? plan.price_year : plan.price_month,
    input.utr.toUpperCase(),
    ctx.me.id,
    now(),
  );
  await audit(c, { action: 'subscription.payment_submitted', targetId: id, meta: { plan: plan.id, period: input.period } });
  return c.json({ id, status: 'pending' }, 201);
});

export default shop;
