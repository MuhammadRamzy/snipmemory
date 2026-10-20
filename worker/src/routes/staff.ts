import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type { AppEnv, Ctx, StaffRow, UserRow } from '../types';
import { audit } from '../lib/audit';
import { hashSecret, newId } from '../lib/crypto';
import { all, count, first, now, run } from '../lib/db';
import { addDays, dayOf, monthStart } from '../lib/day';
import { badRequest, body, conflict, forbidden, notFound } from '../lib/http';
import { assertStaffQuota, has, requireCap } from '../lib/plans';
import { serializeStaff } from '../lib/serialize';
import { shopAccess } from '../lib/session';
import { assertStrongPin, indianPhone } from './auth';

const staff = new Hono<AppEnv>();

const pct = z.number().int().min(0).max(100);
const COLORS = ['#0f766e', '#b45309', '#7c3aed', '#be123c', '#1d4ed8', '#15803d', '#a21caf', '#0e7490', '#c2410c', '#4d7c0f'];

staff.get('/', shopAccess('manager'), async (c) => {
  const ctx = c.get('ctx');
  const today = dayOf(ctx.shop.timezone);
  const rows = await all<StaffRow & { phone: string; month_sales: number; month_commission: number; present: number | null }>(
    c.env.DB,
    `SELECT s.*, u.phone,
       COALESCE((SELECT SUM(i.net) FROM bill_items i JOIN bills b ON b.id = i.bill_id WHERE i.staff_id = s.id AND b.day >= ?1 AND b.voided_at IS NULL), 0) AS month_sales,
       COALESCE((SELECT SUM(i.commission) FROM bill_items i JOIN bills b ON b.id = i.bill_id WHERE i.staff_id = s.id AND b.day >= ?1 AND b.voided_at IS NULL), 0) AS month_commission,
       (SELECT in_at FROM attendance a WHERE a.staff_id = s.id AND a.day = ?2) AS present
     FROM staff s JOIN users u ON u.id = s.user_id WHERE s.shop_id = ?3
     ORDER BY s.active DESC, CASE s.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END, s.name`,
    monthStart(today),
    today,
    ctx.shop.id,
  );
  return c.json({
    staff: rows.map((r) => ({ ...serializeStaff(r), monthSales: r.month_sales, monthCommission: r.month_commission, presentToday: r.present !== null })),
  });
});

const staffFields = {
  name: z.string().trim().min(1, 'Enter name').max(40),
  role: z.enum(['manager', 'staff']).default('staff'),
  commissionPct: pct.default(0),
  productCommissionPct: pct.default(0),
  monthlySalary: z.number().int().min(0).max(10_000_000_00).default(0),
};

staff.post('/', shopAccess('manager'), async (c) => {
  const input = await body(c, z.object({ ...staffFields, phone: z.string().trim().min(10).max(16), pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits') }));
  const ctx = c.get('ctx');
  if (input.role === 'manager' && !ctx.isOwner) throw forbidden('Only the owner can add a manager.');
  await assertStaffQuota(c.env.DB, ctx);
  const phone = indianPhone(input.phone);
  assertStrongPin(input.pin);
  const db = c.env.DB;
  let user = await first<UserRow>(db, 'SELECT * FROM users WHERE phone = ?', phone);
  let existingUser = Boolean(user);
  if (user) {
    const already = await first<StaffRow>(db, 'SELECT * FROM staff WHERE shop_id = ? AND user_id = ?', ctx.shop.id, user.id);
    if (already?.active) throw conflict(`${already.name} is already in your team.`);
    if (already) {
      await run(db, 'UPDATE staff SET active = 1, name = ?, role = ? WHERE id = ?', input.name, input.role, already.id);
      return c.json({ id: already.id, existingUser }, 200);
    }
  } else {
    const id = newId('usr');
    await run(db, 'INSERT INTO users (id, phone, name, pin_hash, created_at) VALUES (?, ?, ?, ?, ?)', id, phone, input.name, await hashSecret(input.pin), now());
    user = (await first<UserRow>(db, 'SELECT * FROM users WHERE id = ?', id))!;
    existingUser = false;
  }
  const n = await count(db, 'SELECT COUNT(*) AS n FROM staff WHERE shop_id = ?', ctx.shop.id);
  const id = newId('stf');
  await run(
    db,
    'INSERT INTO staff (id, shop_id, user_id, name, role, commission_pct, product_commission_pct, monthly_salary, color, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    id,
    ctx.shop.id,
    user.id,
    input.name,
    input.role,
    input.commissionPct,
    input.productCommissionPct,
    input.monthlySalary,
    COLORS[n % COLORS.length],
    now(),
  );
  await audit(c, { action: 'staff.added', targetId: id, meta: { name: input.name, role: input.role } });
  // An existing SnipMemory user keeps their own PIN.
  return c.json({ id, existingUser }, 201);
});

async function loadStaff(db: D1Database, shopId: string, id: string) {
  const row = await first<StaffRow & { phone: string }>(db, 'SELECT s.*, u.phone FROM staff s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.shop_id = ?', id, shopId);
  if (!row) throw notFound('Staff member');
  return row;
}

staff.patch('/:id', shopAccess('manager'), async (c) => {
  const input = await body(c, z.object({ ...staffFields, active: z.boolean() }).partial());
  const ctx = c.get('ctx');
  const s = await loadStaff(c.env.DB, ctx.shop.id, c.req.param('id'));
  if (s.role === 'owner' && (input.role || input.active === false)) throw badRequest('The owner cannot be removed or changed.');
  if ((s.role === 'manager' || input.role === 'manager') && !ctx.isOwner) throw forbidden('Only the owner can change a manager.');
  if (input.active === true && !s.active) await assertStaffQuota(c.env.DB, ctx);
  await run(
    c.env.DB,
    'UPDATE staff SET name = ?, role = ?, commission_pct = ?, product_commission_pct = ?, monthly_salary = ?, active = ? WHERE id = ?',
    input.name ?? s.name,
    input.role ?? s.role,
    input.commissionPct ?? s.commission_pct,
    input.productCommissionPct ?? s.product_commission_pct,
    input.monthlySalary ?? s.monthly_salary,
    input.active === undefined ? s.active : Number(input.active),
    s.id,
  );
  if (input.active === false) await run(c.env.DB, 'DELETE FROM sessions WHERE user_id = ? AND shop_id = ?', s.user_id, ctx.shop.id);
  await audit(c, { action: 'staff.updated', targetId: s.id, meta: input });
  return c.json({ staff: serializeStaff(await loadStaff(c.env.DB, ctx.shop.id, s.id)) });
});

/** Owner resets a barber's forgotten PIN. Not allowed for people who own/manage any shop or work elsewhere. */
staff.post('/:id/pin', shopAccess('manager'), async (c) => {
  const input = await body(c, z.object({ pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits') }));
  const ctx = c.get('ctx');
  assertStrongPin(input.pin);
  const s = await loadStaff(c.env.DB, ctx.shop.id, c.req.param('id'));
  const elsewhere = await count(
    c.env.DB,
    "SELECT COUNT(*) AS n FROM staff WHERE user_id = ? AND (shop_id != ? OR role IN ('owner', 'manager'))",
    s.user_id,
    ctx.shop.id,
  );
  if (elsewhere > 0) throw forbidden('This person also manages or works at another shop. They must contact SnipMemory support to reset their PIN.');
  await run(c.env.DB, 'UPDATE users SET pin_hash = ?, pin_must_change = 0 WHERE id = ?', await hashSecret(input.pin), s.user_id);
  await run(c.env.DB, 'DELETE FROM sessions WHERE user_id = ?', s.user_id);
  await audit(c, { action: 'staff.pin_reset', targetId: s.id });
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Payroll: commission + salary − advances/payouts for a month
// ---------------------------------------------------------------------------
async function monthSummary(db: D1Database, ctx: Ctx, s: StaffRow, month: string) {
  const from = `${month}-01`;
  const to = addDays(addDays(from, 31).slice(0, 8) + '01', -1);
  const [work, products, txns, attendance, daily] = await Promise.all([
    first<{ bills: number; services: number; sales: number; commission: number }>(
      db,
      `SELECT COUNT(DISTINCT b.id) AS bills, COALESCE(SUM(CASE WHEN i.kind != 'product' THEN i.qty END), 0) AS services,
         COALESCE(SUM(i.net), 0) AS sales, COALESCE(SUM(i.commission), 0) AS commission
       FROM bill_items i JOIN bills b ON b.id = i.bill_id WHERE i.staff_id = ? AND b.day BETWEEN ? AND ? AND b.voided_at IS NULL`,
      s.id,
      from,
      to,
    ),
    first<{ sales: number }>(
      db,
      `SELECT COALESCE(SUM(i.net), 0) AS sales FROM bill_items i JOIN bills b ON b.id = i.bill_id
       WHERE i.staff_id = ? AND i.kind = 'product' AND b.day BETWEEN ? AND ? AND b.voided_at IS NULL`,
      s.id,
      from,
      to,
    ),
    all<{ id: string; kind: string; amount: number; mode: string; note: string | null; day: string }>(
      db,
      'SELECT id, kind, amount, mode, note, day FROM staff_txns WHERE staff_id = ? AND day BETWEEN ? AND ? AND deleted_at IS NULL ORDER BY day DESC, created_at DESC',
      s.id,
      from,
      to,
    ),
    count(db, 'SELECT COUNT(*) AS n FROM attendance WHERE staff_id = ? AND day BETWEEN ? AND ?', s.id, from, to),
    all<{ day: string; bills: number; sales: number }>(
      db,
      `SELECT b.day, COUNT(DISTINCT b.id) AS bills, COALESCE(SUM(i.net), 0) AS sales FROM bill_items i JOIN bills b ON b.id = i.bill_id
       WHERE i.staff_id = ? AND b.day BETWEEN ? AND ? AND b.voided_at IS NULL GROUP BY b.day ORDER BY b.day`,
      s.id,
      from,
      to,
    ),
  ]);
  const sum = (k: string) => txns.filter((t) => t.kind === k).reduce((a, t) => a + t.amount, 0);
  const commission = has(ctx, 'commission') ? (work?.commission ?? 0) : 0;
  const earned = commission + s.monthly_salary + sum('bonus') - sum('deduction');
  const paid = sum('advance') + sum('payout');
  return {
    month,
    bills: work?.bills ?? 0,
    services: work?.services ?? 0,
    sales: work?.sales ?? 0,
    productSales: products?.sales ?? 0,
    commission,
    salary: s.monthly_salary,
    bonus: sum('bonus'),
    deduction: sum('deduction'),
    advance: sum('advance'),
    payout: sum('payout'),
    earned,
    paid,
    balance: earned - paid,
    daysPresent: attendance,
    daily,
    txns: txns.map((t) => ({ id: t.id, kind: t.kind, amount: t.amount, mode: t.mode, note: t.note, day: t.day })),
  };
}

function monthParam(c: Context<AppEnv>, ctx: Ctx) {
  const m = c.req.query('month');
  return m && /^\d{4}-\d{2}$/.test(m) ? m : dayOf(ctx.shop.timezone).slice(0, 7);
}

staff.get('/:id/summary', shopAccess('manager'), async (c) => {
  const ctx = c.get('ctx');
  const s = await loadStaff(c.env.DB, ctx.shop.id, c.req.param('id'));
  return c.json({ staff: serializeStaff(s), summary: await monthSummary(c.env.DB, ctx, s, monthParam(c, ctx)) });
});

staff.post('/:id/txns', shopAccess('manager'), async (c) => {
  const input = await body(
    c,
    z.object({
      kind: z.enum(['advance', 'payout', 'bonus', 'deduction']),
      amount: z.number().int().min(100, 'Enter amount').max(10_000_000_00),
      mode: z.enum(['cash', 'upi', 'card']).default('cash'),
      note: z.string().max(200).nullable().optional(),
    }),
  );
  const ctx = c.get('ctx');
  const s = await loadStaff(c.env.DB, ctx.shop.id, c.req.param('id'));
  const id = newId('stx');
  await run(
    c.env.DB,
    'INSERT INTO staff_txns (id, shop_id, staff_id, kind, amount, mode, note, day, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    id,
    ctx.shop.id,
    s.id,
    input.kind,
    input.amount,
    input.mode,
    input.note ?? null,
    dayOf(ctx.shop.timezone),
    ctx.me.id,
    now(),
  );
  await audit(c, { action: `staff.${input.kind}`, targetId: s.id, meta: { amount: input.amount } });
  return c.json({ id }, 201);
});

staff.delete('/txns/:txnId', shopAccess('manager'), async (c) => {
  const ctx = c.get('ctx');
  await run(c.env.DB, 'UPDATE staff_txns SET deleted_at = ? WHERE id = ? AND shop_id = ?', now(), c.req.param('txnId'), ctx.shop.id);
  return c.json({ ok: true });
});

staff.get('/attendance/today', shopAccess('manager'), async (c) => {
  const ctx = c.get('ctx');
  requireCap(ctx, 'attendance');
  const rows = await all<{ staff_id: string; in_at: number; out_at: number | null }>(
    c.env.DB,
    'SELECT staff_id, in_at, out_at FROM attendance WHERE shop_id = ? AND day = ?',
    ctx.shop.id,
    dayOf(ctx.shop.timezone),
  );
  return c.json({ attendance: rows.map((r) => ({ staffId: r.staff_id, inAt: r.in_at, outAt: r.out_at })) });
});

// ---------------------------------------------------------------------------
// "Me" — the logged-in barber's own numbers (staff app and owner app)
// ---------------------------------------------------------------------------
export const me = new Hono<AppEnv>();

me.get('/home', shopAccess('any'), async (c) => {
  const ctx = c.get('ctx');
  const db = c.env.DB;
  const today = dayOf(ctx.shop.timezone);
  const [todayWork, monthWork, attendance, queue] = await Promise.all([
    first<{ bills: number; sales: number; commission: number; services: number }>(
      db,
      `SELECT COUNT(DISTINCT b.id) AS bills, COALESCE(SUM(i.net), 0) AS sales, COALESCE(SUM(i.commission), 0) AS commission,
         COALESCE(SUM(CASE WHEN i.kind != 'product' THEN i.qty END), 0) AS services
       FROM bill_items i JOIN bills b ON b.id = i.bill_id WHERE i.staff_id = ? AND b.day = ? AND b.voided_at IS NULL`,
      ctx.me.id,
      today,
    ),
    first<{ bills: number; sales: number; commission: number }>(
      db,
      `SELECT COUNT(DISTINCT b.id) AS bills, COALESCE(SUM(i.net), 0) AS sales, COALESCE(SUM(i.commission), 0) AS commission
       FROM bill_items i JOIN bills b ON b.id = i.bill_id WHERE i.staff_id = ? AND b.day >= ? AND b.voided_at IS NULL`,
      ctx.me.id,
      monthStart(today),
    ),
    first<{ in_at: number; out_at: number | null }>(db, 'SELECT in_at, out_at FROM attendance WHERE staff_id = ? AND day = ?', ctx.me.id, today),
    count(db, "SELECT COUNT(*) AS n FROM queue WHERE shop_id = ? AND day = ? AND status = 'waiting' AND (staff_id IS NULL OR staff_id = ?)", ctx.shop.id, today, ctx.me.id),
  ]);
  const showCommission = has(ctx, 'commission');
  return c.json({
    day: today,
    today: { ...todayWork, commission: showCommission ? todayWork?.commission : null },
    month: { ...monthWork, commission: showCommission ? monthWork?.commission : null },
    attendance: attendance ? { inAt: attendance.in_at, outAt: attendance.out_at } : null,
    attendanceEnabled: has(ctx, 'attendance'),
    queueWaiting: queue,
  });
});

me.get('/summary', shopAccess('any'), async (c) => {
  const ctx = c.get('ctx');
  return c.json({ summary: await monthSummary(c.env.DB, ctx, ctx.me, monthParam(c, ctx)) });
});

me.post('/attendance', shopAccess('any'), async (c) => {
  const input = await body(c, z.object({ action: z.enum(['in', 'out']) }));
  const ctx = c.get('ctx');
  requireCap(ctx, 'attendance');
  const day = dayOf(ctx.shop.timezone);
  const t = now();
  if (input.action === 'in') {
    await run(c.env.DB, 'INSERT INTO attendance (shop_id, staff_id, day, in_at) VALUES (?, ?, ?, ?) ON CONFLICT(staff_id, day) DO UPDATE SET out_at = NULL', ctx.shop.id, ctx.me.id, day, t);
  } else {
    const res = await run(c.env.DB, 'UPDATE attendance SET out_at = ? WHERE staff_id = ? AND day = ?', t, ctx.me.id, day);
    if (!res.meta.changes) throw badRequest('Tap “Start work” first.');
  }
  return c.json({ ok: true });
});

export default staff;
