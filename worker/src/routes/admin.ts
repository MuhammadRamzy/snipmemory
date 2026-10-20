import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv, PlanRow, ShopRow, UserRow } from '../types';
import { audit } from '../lib/audit';
import { hashSecret, newId, randomDigits, verifySecret } from '../lib/crypto';
import { DAY, HOUR, MINUTE, all, count, first, now, run } from '../lib/db';
import { badRequest, body, clientIp, notFound, unauthorized } from '../lib/http';
import { rateLimit } from '../lib/ratelimit';
import { serializePlan, serializeShop } from '../lib/serialize';
import { createSession, destroySession, requireAdmin } from '../lib/session';
import { indianPhone, phoneField } from './auth';

const admin = new Hono<AppEnv>();

admin.post('/login', async (c) => {
  const input = await body(c, z.object({ phone: phoneField, password: z.string().min(1).max(200) }));
  await rateLimit(c.env.DB, `admin-login:${clientIp(c)}`, 10, 15 * MINUTE);
  const phone = indianPhone(input.phone);
  await rateLimit(c.env.DB, `admin-login:${phone}`, 5, 15 * MINUTE);
  await rateLimit(c.env.DB, `admin-login-day:${phone}`, 20, DAY);
  const user = await first<UserRow>(c.env.DB, 'SELECT * FROM users WHERE phone = ? AND is_platform_admin = 1 AND disabled_at IS NULL', phone);
  const ok = await verifySecret(input.password, user?.password_hash ?? 'pbkdf2$100000$00$00');
  if (!user || !ok) throw unauthorized('Wrong phone or password.');
  await destroySession(c, 'admin');
  await createSession(c, 'admin', user.id, null);
  return c.json({ ok: true, name: user.name });
});

admin.post('/logout', async (c) => {
  await destroySession(c, 'admin');
  return c.json({ ok: true });
});

admin.use('*', requireAdmin);

admin.get('/me', (c) => c.json({ name: c.get('adminUser').name, phone: c.get('adminUser').phone }));

admin.get('/metrics', async (c) => {
  const db = c.env.DB;
  const t = now();
  const d30 = t - 30 * DAY;
  const [shops, trial, paidRows, active7, pending, signups, bills30, approved30, series] = await Promise.all([
    count(db, 'SELECT COUNT(*) AS n FROM shops WHERE deleted_at IS NULL'),
    count(db, 'SELECT COUNT(*) AS n FROM shops WHERE trial = 1 AND plan_expires_at > ? AND deleted_at IS NULL', t),
    all<{ plan_id: string; price_month: number; price_year: number; period: string | null }>(
      db,
      `SELECT s.plan_id, p.price_month, p.price_year,
         (SELECT sp.period FROM subscription_payments sp WHERE sp.shop_id = s.id AND sp.status = 'approved' ORDER BY sp.reviewed_at DESC LIMIT 1) AS period
       FROM shops s JOIN plans p ON p.id = s.plan_id WHERE s.trial = 0 AND s.plan_id != 'free' AND s.plan_expires_at > ? AND s.deleted_at IS NULL`,
      t,
    ),
    count(db, 'SELECT COUNT(DISTINCT shop_id) AS n FROM bills WHERE created_at > ?', t - 7 * DAY),
    count(db, "SELECT COUNT(*) AS n FROM subscription_payments WHERE status = 'pending'"),
    count(db, 'SELECT COUNT(*) AS n FROM shops WHERE created_at > ?', d30),
    first<{ n: number; gmv: number | null }>(db, 'SELECT COUNT(*) AS n, SUM(total) AS gmv FROM bills WHERE created_at > ? AND voided_at IS NULL', d30),
    count(db, "SELECT COALESCE(SUM(amount), 0) AS n FROM subscription_payments WHERE status = 'approved' AND reviewed_at > ?", d30),
    all<{ created_at: number }>(db, 'SELECT created_at FROM shops WHERE created_at > ?', d30),
  ]);
  const mrr = paidRows.reduce((s, r) => s + (r.period === 'year' ? Math.round(r.price_year / 12) : r.price_month), 0);
  const byPlan: Record<string, number> = {};
  for (const r of paidRows) byPlan[r.plan_id] = (byPlan[r.plan_id] ?? 0) + 1;
  const days = new Map<string, number>();
  for (let i = 29; i >= 0; i--) days.set(new Date(t - i * DAY + 5.5 * HOUR).toISOString().slice(0, 10), 0);
  for (const s of series) {
    const k = new Date(s.created_at + 5.5 * HOUR).toISOString().slice(0, 10);
    if (days.has(k)) days.set(k, (days.get(k) ?? 0) + 1);
  }
  return c.json({
    shops,
    trial,
    paid: paidRows.length,
    free: shops - trial - paidRows.length,
    active7d: active7,
    mrr,
    byPlan,
    pendingPayments: pending,
    signups30d: signups,
    bills30d: bills30?.n ?? 0,
    gmv30d: bills30?.gmv ?? 0,
    collected30d: approved30,
    signupSeries: [...days.entries()].map(([day, n]) => ({ day, n })),
  });
});

admin.get('/shops', async (c) => {
  const q = c.req.query('q')?.trim() ?? '';
  const filter = c.req.query('filter') ?? 'all';
  const where = ['s.deleted_at IS NULL'];
  const args: unknown[] = [];
  if (q) {
    where.push('(s.name LIKE ? OR s.city LIKE ? OR u.phone LIKE ? OR u.name LIKE ?)');
    args.push(`%${q}%`, `%${q}%`, `%${q.replace(/\D/g, '') || '~'}%`, `%${q}%`);
  }
  if (filter === 'trial') where.push('s.trial = 1');
  if (filter === 'paid') where.push("s.trial = 0 AND s.plan_id != 'free'");
  if (filter === 'free') where.push("s.plan_id = 'free'");
  if (filter === 'suspended') where.push('s.suspended_at IS NOT NULL');
  const rows = await all<ShopRow & { owner_name: string; owner_phone: string; staff_count: number; bills_7d: number; last_bill: number | null }>(
    c.env.DB,
    `SELECT s.*, u.name AS owner_name, u.phone AS owner_phone,
       (SELECT COUNT(*) FROM staff st WHERE st.shop_id = s.id AND st.active = 1) AS staff_count,
       (SELECT COUNT(*) FROM bills b WHERE b.shop_id = s.id AND b.created_at > ?) AS bills_7d,
       (SELECT MAX(created_at) FROM bills b WHERE b.shop_id = s.id) AS last_bill
     FROM shops s JOIN users u ON u.id = s.owner_user_id WHERE ${where.join(' AND ')} ORDER BY s.created_at DESC LIMIT 200`,
    now() - 7 * DAY,
    ...args,
  );
  return c.json({
    shops: rows.map((r) => ({ ...serializeShop(r), ownerName: r.owner_name, ownerPhone: r.owner_phone, staffCount: r.staff_count, bills7d: r.bills_7d, lastBillAt: r.last_bill })),
  });
});

async function loadShop(db: D1Database, id: string) {
  const shop = await first<ShopRow>(db, 'SELECT * FROM shops WHERE id = ?', id);
  if (!shop) throw notFound('Shop');
  return shop;
}

admin.get('/shops/:id', async (c) => {
  const db = c.env.DB;
  const shop = await loadShop(db, c.req.param('id'));
  const [owner, staff, payments, auditRows, stats] = await Promise.all([
    first<{ name: string; phone: string; last_login_at: number | null }>(db, 'SELECT name, phone, last_login_at FROM users WHERE id = ?', shop.owner_user_id),
    all<{ id: string; name: string; role: string; active: number; phone: string }>(db, 'SELECT s.id, s.name, s.role, s.active, u.phone FROM staff s JOIN users u ON u.id = s.user_id WHERE s.shop_id = ?', shop.id),
    all(db, 'SELECT id, plan_id AS planId, period, amount, utr, status, note, created_at AS createdAt FROM subscription_payments WHERE shop_id = ? ORDER BY created_at DESC', shop.id),
    all(db, 'SELECT id, action, meta, impersonator_id AS impersonatorId, created_at AS createdAt FROM audit_log WHERE shop_id = ? ORDER BY created_at DESC LIMIT 50', shop.id),
    first<{ bills: number; gmv: number | null; customers: number }>(
      db,
      `SELECT (SELECT COUNT(*) FROM bills WHERE shop_id = ?1 AND voided_at IS NULL) AS bills,
              (SELECT SUM(total) FROM bills WHERE shop_id = ?1 AND voided_at IS NULL AND created_at > ?2) AS gmv,
              (SELECT COUNT(*) FROM customers WHERE shop_id = ?1 AND deleted_at IS NULL) AS customers`,
      shop.id,
      now() - 30 * DAY,
    ),
  ]);
  return c.json({ shop: serializeShop(shop), owner, staff, payments, audit: auditRows, stats: { bills: stats?.bills ?? 0, gmv30d: stats?.gmv ?? 0, customers: stats?.customers ?? 0 } });
});

admin.patch('/shops/:id', async (c) => {
  const input = await body(
    c,
    z.object({
      planId: z.string().optional(),
      extendDays: z.number().int().min(1).max(800).optional(),
      suspended: z.boolean().optional(),
      suspendedReason: z.string().max(200).optional(),
    }),
  );
  const shop = await loadShop(c.env.DB, c.req.param('id'));
  if (input.planId && !(await first(c.env.DB, 'SELECT 1 FROM plans WHERE id = ?', input.planId))) throw notFound('Plan');
  const planId = input.planId ?? shop.plan_id;
  let expires = shop.plan_expires_at;
  if (planId === 'free') expires = null;
  else if (input.extendDays) expires = Math.max(expires ?? now(), now()) + input.extendDays * DAY;
  else if (input.planId && input.planId !== shop.plan_id) expires = now() + 30 * DAY;
  await run(
    c.env.DB,
    'UPDATE shops SET plan_id = ?, plan_expires_at = ?, trial = CASE WHEN ? THEN 0 ELSE trial END, suspended_at = ?, suspended_reason = ?, updated_at = ? WHERE id = ?',
    planId,
    expires,
    input.planId !== undefined ? 1 : 0,
    input.suspended === undefined ? shop.suspended_at : input.suspended ? now() : null,
    input.suspended === false ? null : (input.suspendedReason ?? shop.suspended_reason),
    now(),
    shop.id,
  );
  await audit(c, { shopId: shop.id, action: 'admin.shop_updated', meta: input });
  return c.json({ shop: serializeShop(await loadShop(c.env.DB, shop.id)) });
});

/** Support PIN reset after verifying the owner on a call/WhatsApp. Returns a temporary PIN. */
admin.post('/shops/:id/reset-owner-pin', async (c) => {
  const shop = await loadShop(c.env.DB, c.req.param('id'));
  const pin = randomDigits(6);
  await run(c.env.DB, 'UPDATE users SET pin_hash = ?, pin_must_change = 1 WHERE id = ?', await hashSecret(pin), shop.owner_user_id);
  await run(c.env.DB, 'DELETE FROM sessions WHERE user_id = ?', shop.owner_user_id);
  await audit(c, { shopId: shop.id, action: 'admin.owner_pin_reset' });
  return c.json({ tempPin: pin });
});

/** Open the owner app as this shop for support (1 hour, audited). */
admin.post('/shops/:id/impersonate', async (c) => {
  const input = await body(c, z.object({ reason: z.string().trim().min(5, 'Write why').max(200) }));
  const shop = await loadShop(c.env.DB, c.req.param('id'));
  await audit(c, { shopId: shop.id, action: 'admin.impersonation', meta: { reason: input.reason } });
  await destroySession(c, 'owner');
  await createSession(c, 'owner', c.get('adminUser').id, shop.id, { impersonatorId: c.get('adminUser').id, ttl: HOUR });
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Subscription payments (UPI + UTR) — verify against the bank statement, then approve.
// ---------------------------------------------------------------------------
admin.get('/payments', async (c) => {
  const status = c.req.query('status') ?? 'pending';
  const rows = await all(
    c.env.DB,
    `SELECT p.id, p.shop_id AS shopId, s.name AS shopName, s.city, u.phone AS ownerPhone, p.plan_id AS planId, p.period, p.amount, p.utr, p.status, p.note,
       p.created_at AS createdAt, p.reviewed_at AS reviewedAt
     FROM subscription_payments p JOIN shops s ON s.id = p.shop_id JOIN users u ON u.id = s.owner_user_id
     WHERE p.status = ? ORDER BY p.created_at ${status === 'pending' ? 'ASC' : 'DESC'} LIMIT 200`,
    status,
  );
  return c.json({ payments: rows });
});

admin.post('/payments/:id/:decision', async (c) => {
  const decision = c.req.param('decision');
  if (decision !== 'approve' && decision !== 'reject') throw notFound('Action');
  const input = await body(c, z.object({ note: z.string().max(200).optional() }));
  const payment = await first<{ id: string; shop_id: string; plan_id: string; period: string; status: string }>(
    c.env.DB,
    'SELECT * FROM subscription_payments WHERE id = ?',
    c.req.param('id'),
  );
  if (!payment) throw notFound('Payment');
  if (payment.status !== 'pending') throw badRequest('Already reviewed.');
  const t = now();
  const statements = [
    c.env.DB
      .prepare('UPDATE subscription_payments SET status = ?, note = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?')
      .bind(decision === 'approve' ? 'approved' : 'rejected', input.note ?? null, c.get('adminUser').id, t, payment.id),
  ];
  if (decision === 'approve') {
    const shop = await loadShop(c.env.DB, payment.shop_id);
    const sameActivePlan = shop.plan_id === payment.plan_id && !shop.trial && (shop.plan_expires_at ?? 0) > t;
    const base = sameActivePlan ? shop.plan_expires_at! : t;
    const expires = base + (payment.period === 'year' ? 365 : 30) * DAY;
    statements.push(
      c.env.DB.prepare('UPDATE shops SET plan_id = ?, plan_expires_at = ?, trial = 0, updated_at = ? WHERE id = ?').bind(payment.plan_id, expires, t, shop.id),
    );
  }
  await c.env.DB.batch(statements);
  await audit(c, { shopId: payment.shop_id, action: `subscription.${decision}d`, targetId: payment.id });
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Plans, announcements, audit
// ---------------------------------------------------------------------------
admin.get('/plans', async (c) => {
  const plans = await all<PlanRow>(c.env.DB, 'SELECT * FROM plans ORDER BY sort_order');
  return c.json({ plans: plans.map((p) => ({ ...serializePlan(p), isPublic: Boolean(p.is_public) })) });
});

admin.put('/plans/:id', async (c) => {
  const input = await body(
    c,
    z.object({
      name: z.string().min(1).max(40),
      tagline: z.string().max(100),
      maxStaff: z.number().int().min(-1),
      monthlyBillLimit: z.number().int().min(-1),
      priceMonth: z.number().int().min(0),
      priceYear: z.number().int().min(0),
      features: z.array(z.string().max(100)).max(12),
      isPublic: z.boolean(),
    }),
  );
  const id = c.req.param('id');
  if (id === 'free' && (input.priceMonth || input.priceYear)) throw badRequest('Free must stay free.');
  const res = await run(
    c.env.DB,
    'UPDATE plans SET name = ?, tagline = ?, max_staff = ?, monthly_bill_limit = ?, price_month = ?, price_year = ?, features = ?, is_public = ?, updated_at = ? WHERE id = ?',
    input.name,
    input.tagline,
    input.maxStaff,
    input.monthlyBillLimit,
    input.priceMonth,
    input.priceYear,
    JSON.stringify(input.features),
    Number(input.isPublic),
    now(),
    id,
  );
  if (!res.meta.changes) throw notFound('Plan');
  await audit(c, { action: 'admin.plan_updated', targetId: id, meta: { priceMonth: input.priceMonth, priceYear: input.priceYear } });
  return c.json({ ok: true });
});

admin.get('/announcements', async (c) =>
  c.json({ announcements: await all(c.env.DB, 'SELECT id, message, level, active, expires_at AS expiresAt, created_at AS createdAt FROM announcements ORDER BY created_at DESC LIMIT 50') }),
);

admin.post('/announcements', async (c) => {
  const input = await body(c, z.object({ message: z.string().trim().min(3).max(300), level: z.enum(['info', 'warning', 'critical']), hours: z.number().int().min(1).max(2000).optional() }));
  const id = newId('ann');
  await run(c.env.DB, 'INSERT INTO announcements (id, message, level, expires_at, created_at) VALUES (?, ?, ?, ?, ?)', id, input.message, input.level, input.hours ? now() + input.hours * HOUR : null, now());
  return c.json({ id }, 201);
});

admin.patch('/announcements/:id', async (c) => {
  const input = await body(c, z.object({ active: z.boolean() }));
  await run(c.env.DB, 'UPDATE announcements SET active = ? WHERE id = ?', Number(input.active), c.req.param('id'));
  return c.json({ ok: true });
});

admin.get('/audit', async (c) =>
  c.json({
    entries: await all(
      c.env.DB,
      `SELECT a.id, a.shop_id AS shopId, s.name AS shopName, a.action, u.name AS userName, a.impersonator_id AS impersonatorId, a.meta, a.created_at AS createdAt
       FROM audit_log a LEFT JOIN shops s ON s.id = a.shop_id LEFT JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC LIMIT 200`,
    ),
  }),
);

export default admin;
