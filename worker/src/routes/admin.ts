import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv, MemberRow, PlanRow, SalonRow, UserRow } from '../types';
import { audit } from '../lib/audit';
import { newId } from '../lib/crypto';
import { DAY, HOUR, all, count, first, now, run } from '../lib/db';
import { badRequest, body, notFound, query } from '../lib/http';
import { getPlan } from '../lib/plans';
import { serializeMember, serializePlan, serializeSalon, serializeUser } from '../lib/serialize';
import { createSession, destroySession, requirePlatformAdmin } from '../lib/session';

const admin = new Hono<AppEnv>();
admin.use('*', requirePlatformAdmin);

/** Rough FX to show a single headline MRR. Per-currency figures are exact. */
const USD_RATE: Record<string, number> = { USD: 1, INR: 0.012, GBP: 1.27, AED: 0.272, EUR: 1.08 };

admin.get('/metrics', async (c) => {
  const db = c.env.DB;
  const t = now();
  const d30 = t - 30 * DAY;
  const [statusRows, mrrRows, signups30, signups7, visits30, clients, photos, messages30, recovered30, trialsExpired30, churned30, signupSeries, topSalons] =
    await Promise.all([
      all<{ status: string; plan_id: string; n: number }>(
        db,
        'SELECT subscription_status AS status, plan_id, COUNT(*) AS n FROM salons WHERE deleted_at IS NULL GROUP BY 1, 2',
      ),
      all<{ currency: string; monthly: number; n: number }>(
        db,
        `SELECT COALESCE(pp.currency, pu.currency) AS currency,
           SUM(CASE WHEN s.billing_interval = 'year' THEN COALESCE(pp.amount, pu.amount) / 12.0 ELSE COALESCE(pp.amount, pu.amount) END) AS monthly,
           COUNT(*) AS n
         FROM salons s
         LEFT JOIN plan_prices pp ON pp.plan_id = s.plan_id AND pp.interval = s.billing_interval AND pp.currency = s.currency
         LEFT JOIN plan_prices pu ON pu.plan_id = s.plan_id AND pu.interval = s.billing_interval AND pu.currency = 'USD'
         WHERE s.deleted_at IS NULL AND s.suspended_at IS NULL AND s.subscription_status IN ('active', 'past_due') AND s.plan_id != 'free'
         GROUP BY 1`,
      ),
      count(db, 'SELECT COUNT(*) AS n FROM salons WHERE created_at >= ?', d30),
      count(db, 'SELECT COUNT(*) AS n FROM salons WHERE created_at >= ?', t - 7 * DAY),
      count(db, 'SELECT COUNT(*) AS n FROM visits WHERE created_at >= ? AND deleted_at IS NULL', d30),
      count(db, 'SELECT COUNT(*) AS n FROM clients WHERE deleted_at IS NULL'),
      first<{ n: number; bytes: number | null }>(db, 'SELECT COUNT(*) AS n, SUM(bytes) AS bytes FROM photos'),
      all<{ kind: string; status: string; n: number; credits: number | null }>(
        db,
        'SELECT kind, status, COUNT(*) AS n, SUM(credits) AS credits FROM messages WHERE created_at >= ? GROUP BY 1, 2',
        d30,
      ),
      count(db, 'SELECT COUNT(*) AS n FROM visits WHERE recovered_by_message_id IS NOT NULL AND created_at >= ?', d30),
      count(db, "SELECT COUNT(*) AS n FROM audit_log WHERE action = 'trial.expired' AND created_at >= ?", d30),
      count(db, "SELECT COUNT(*) AS n FROM audit_log WHERE action = 'billing.churned' AND created_at >= ?", d30),
      all<{ created_at: number }>(db, 'SELECT created_at FROM salons WHERE created_at >= ?', d30),
      all<{ id: string; name: string; visits: number }>(
        db,
        `SELECT s.id, s.name, COUNT(v.id) AS visits FROM salons s JOIN visits v ON v.salon_id = s.id AND v.created_at >= ? AND v.deleted_at IS NULL
         GROUP BY s.id ORDER BY visits DESC LIMIT 10`,
        d30,
      ),
    ]);

  const byStatus = { trialing: 0, paid: 0, free: 0, pastDue: 0, total: 0 };
  for (const row of statusRows) {
    byStatus.total += row.n;
    if (row.status === 'trialing') byStatus.trialing += row.n;
    else if (row.status === 'past_due') byStatus.pastDue += row.n;
    else if (row.plan_id === 'free') byStatus.free += row.n;
    else byStatus.paid += row.n;
  }
  const mrr = mrrRows.map((r) => ({ currency: r.currency, amount: Math.round(r.monthly), salons: r.n }));
  const mrrUsd = mrr.reduce((sum, r) => sum + r.amount * (USD_RATE[r.currency] ?? 1), 0);
  const series = new Map<string, number>();
  for (let i = 29; i >= 0; i--) series.set(new Date(t - i * DAY).toISOString().slice(0, 10), 0);
  for (const s of signupSeries) {
    const key = new Date(s.created_at).toISOString().slice(0, 10);
    if (series.has(key)) series.set(key, (series.get(key) ?? 0) + 1);
  }

  return c.json({
    salons: byStatus,
    mrr,
    mrrUsdApprox: Math.round(mrrUsd),
    arrUsdApprox: Math.round(mrrUsd * 12),
    signups30d: signups30,
    signups7d: signups7,
    trialsExpired30d: trialsExpired30,
    churned30d: churned30,
    visits30d: visits30,
    clients,
    photos: { count: photos?.n ?? 0, bytes: photos?.bytes ?? 0 },
    messages30d: messages30,
    recoveredVisits30d: recovered30,
    signupSeries: [...series.entries()].map(([date, n]) => ({ date, signups: n })),
    topSalons,
  });
});

const listQuery = z.object({
  q: z.string().max(100).optional(),
  status: z.enum(['all', 'trialing', 'active', 'past_due', 'free', 'suspended']).default('all'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

admin.get('/salons', async (c) => {
  const { q, status, limit, offset } = query(c, listQuery);
  const where = ['s.deleted_at IS NULL'];
  const params: unknown[] = [];
  if (q) {
    where.push('(s.name LIKE ? OR s.slug LIKE ? OR s.email LIKE ? OR s.city LIKE ?)');
    params.push(...Array(4).fill(`%${q}%`));
  }
  if (status === 'free') where.push("s.plan_id = 'free'");
  else if (status === 'suspended') where.push('s.suspended_at IS NOT NULL');
  else if (status === 'active') where.push("s.subscription_status = 'active' AND s.plan_id != 'free'");
  else if (status !== 'all') {
    where.push('s.subscription_status = ?');
    params.push(status);
  }
  const rows = await all<SalonRow & { clients: number; members: number; last_visit_at: number | null; owner_email: string | null }>(
    c.env.DB,
    `SELECT s.*,
       (SELECT COUNT(*) FROM clients c WHERE c.salon_id = s.id AND c.deleted_at IS NULL) AS clients,
       (SELECT COUNT(*) FROM members m WHERE m.salon_id = s.id AND m.active = 1) AS members,
       (SELECT MAX(v.created_at) FROM visits v WHERE v.salon_id = s.id) AS last_visit_at,
       (SELECT u.email FROM members m JOIN users u ON u.id = m.user_id WHERE m.salon_id = s.id AND m.role = 'owner' ORDER BY m.created_at LIMIT 1) AS owner_email
     FROM salons s WHERE ${where.join(' AND ')} ORDER BY s.created_at DESC LIMIT ? OFFSET ?`,
    ...params,
    limit + 1,
    offset,
  );
  return c.json({
    salons: rows.slice(0, limit).map((r) => ({
      ...serializeSalon(r),
      ownerEmail: r.owner_email,
      clients: r.clients,
      members: r.members,
      lastVisitAt: r.last_visit_at,
    })),
    hasMore: rows.length > limit,
  });
});

async function loadSalon(db: D1Database, id: string) {
  const salon = await first<SalonRow>(db, 'SELECT * FROM salons WHERE id = ?', id);
  if (!salon) throw notFound('Salon');
  return salon;
}

admin.get('/salons/:id', async (c) => {
  const db = c.env.DB;
  const salon = await loadSalon(db, c.req.param('id'));
  const [plan, members, payments, auditRows, stats] = await Promise.all([
    getPlan(db, salon.plan_id),
    all<MemberRow & { email: string | null }>(db, 'SELECT m.*, u.email FROM members m LEFT JOIN users u ON u.id = m.user_id WHERE m.salon_id = ? ORDER BY m.created_at', salon.id),
    all(db, 'SELECT id, amount, currency, status, description, provider, created_at AS createdAt FROM payments WHERE salon_id = ? ORDER BY created_at DESC LIMIT 25', salon.id),
    all(db, 'SELECT id, action, actor_user_id AS actorUserId, impersonator_id AS impersonatorId, meta, created_at AS createdAt FROM audit_log WHERE salon_id = ? ORDER BY created_at DESC LIMIT 50', salon.id),
    first<{ clients: number; visits30: number; photos: number; bytes: number | null; messages30: number }>(
      db,
      `SELECT (SELECT COUNT(*) FROM clients WHERE salon_id = ?1 AND deleted_at IS NULL) AS clients,
              (SELECT COUNT(*) FROM visits WHERE salon_id = ?1 AND deleted_at IS NULL AND created_at >= ?2) AS visits30,
              (SELECT COUNT(*) FROM photos WHERE salon_id = ?1) AS photos,
              (SELECT SUM(bytes) FROM photos WHERE salon_id = ?1) AS bytes,
              (SELECT COUNT(*) FROM messages WHERE salon_id = ?1 AND created_at >= ?2) AS messages30`,
      salon.id,
      now() - 30 * DAY,
    ),
  ]);
  return c.json({
    salon: serializeSalon(salon),
    plan: serializePlan(plan),
    members: members.map(serializeMember),
    payments,
    audit: auditRows,
    stats: { ...stats, bytes: stats?.bytes ?? 0 },
  });
});

admin.patch('/salons/:id', async (c) => {
  const input = await body(
    c,
    z.object({
      planId: z.string().optional(),
      subscriptionStatus: z.enum(['trialing', 'active', 'past_due', 'canceled']).optional(),
      extendTrialDays: z.number().int().min(1).max(90).optional(),
      addCredits: z.number().int().min(-100000).max(100000).optional(),
      suspended: z.boolean().optional(),
      suspendedReason: z.string().max(200).optional(),
    }),
  );
  const db = c.env.DB;
  const salon = await loadSalon(db, c.req.param('id'));
  if (input.planId) await getPlan(db, input.planId);
  const trialEnd = input.extendTrialDays ? Math.max(salon.trial_ends_at ?? now(), now()) + input.extendTrialDays * DAY : salon.trial_ends_at;
  await run(
    db,
    `UPDATE salons SET plan_id = ?, subscription_status = ?, trial_ends_at = ?, bonus_credits = MAX(0, bonus_credits + ?),
       suspended_at = ?, suspended_reason = ?, updated_at = ? WHERE id = ?`,
    input.planId ?? salon.plan_id,
    input.extendTrialDays ? 'trialing' : (input.subscriptionStatus ?? salon.subscription_status),
    trialEnd,
    input.addCredits ?? 0,
    input.suspended === undefined ? salon.suspended_at : input.suspended ? now() : null,
    input.suspended === false ? null : (input.suspendedReason ?? salon.suspended_reason),
    now(),
    salon.id,
  );
  await audit(c, { salonId: salon.id, action: 'admin.salon_updated', targetType: 'salon', targetId: salon.id, meta: input });
  return c.json({ salon: serializeSalon(await loadSalon(db, salon.id)) });
});

admin.post('/salons/:id/payments', async (c) => {
  const input = await body(c, z.object({ amount: z.number().int().min(0), description: z.string().min(1).max(200), status: z.enum(['paid', 'refunded']).default('paid') }));
  const salon = await loadSalon(c.env.DB, c.req.param('id'));
  const id = newId('pay');
  await run(
    c.env.DB,
    "INSERT INTO payments (id, salon_id, amount, currency, status, description, provider, created_at) VALUES (?, ?, ?, ?, ?, ?, 'manual', ?)",
    id,
    salon.id,
    input.amount,
    salon.currency,
    input.status,
    input.description,
    now(),
  );
  await audit(c, { salonId: salon.id, action: 'admin.payment_recorded', targetType: 'payment', targetId: id, meta: input });
  return c.json({ id }, 201);
});

/** Support impersonation: a 1-hour, fully audited owner session for one salon. */
admin.post('/salons/:id/impersonate', async (c) => {
  const input = await body(c, z.object({ reason: z.string().trim().min(5).max(300) }));
  const salon = await loadSalon(c.env.DB, c.req.param('id'));
  const adminUser = c.get('user')!;
  await audit(c, { salonId: salon.id, action: 'admin.impersonation_started', meta: { reason: input.reason, admin: adminUser.email } });
  await destroySession(c, 'user');
  const session = await createSession(c, 'user', { user_id: adminUser.id, salon_id: salon.id, impersonator_id: adminUser.id });
  await run(c.env.DB, 'UPDATE sessions SET expires_at = ? WHERE id = ?', now() + HOUR, session.id);
  return c.json({ ok: true, salonId: salon.id });
});

// ---------------------------------------------------------------------------
// Plans & pricing
// ---------------------------------------------------------------------------
admin.get('/plans', async (c) => {
  const plans = await all<PlanRow>(c.env.DB, 'SELECT * FROM plans ORDER BY sort_order');
  const prices = await all<{ plan_id: string; currency: string; interval: string; amount: number; stripe_price_id: string | null }>(
    c.env.DB,
    'SELECT * FROM plan_prices ORDER BY currency, interval',
  );
  return c.json({
    plans: plans.map((p) => ({
      ...serializePlan(p),
      isPublic: Boolean(p.is_public),
      prices: prices.filter((x) => x.plan_id === p.id).map((x) => ({ currency: x.currency, interval: x.interval, amount: x.amount, stripePriceId: x.stripe_price_id })),
    })),
  });
});

const CAPS = ['automated_reminders', 'analytics', 'station_mode', 'passport_import', 'export', 'branding', 'priority_support'] as const;

admin.put('/plans/:id', async (c) => {
  const input = await body(
    c,
    z.object({
      name: z.string().min(1).max(50),
      tagline: z.string().max(120).default(''),
      maxStaff: z.number().int().min(-1),
      maxClients: z.number().int().min(-1),
      monthlyMessageCredits: z.number().int().min(0),
      features: z.array(z.string().max(120)).max(12),
      capabilities: z.array(z.enum(CAPS)),
      isPublic: z.boolean(),
      prices: z
        .array(
          z.object({
            currency: z.string().length(3).toUpperCase(),
            interval: z.enum(['month', 'year']),
            amount: z.number().int().min(0),
            stripePriceId: z.string().max(100).nullable().optional(),
          }),
        )
        .max(40),
    }),
  );
  const id = c.req.param('id');
  if (!/^[a-z0-9_-]{2,30}$/.test(id)) throw badRequest('Plan id must be lowercase letters, numbers, - or _.');
  if (id === 'free' && input.prices.some((p) => p.amount > 0)) throw badRequest('The Free plan cannot have a price.');
  const db = c.env.DB;
  const t = now();
  await db.batch([
    db
      .prepare(
        `INSERT INTO plans (id, name, tagline, max_staff, max_clients, monthly_message_credits, features, capabilities, is_public, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM plans), ?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, tagline = excluded.tagline, max_staff = excluded.max_staff,
           max_clients = excluded.max_clients, monthly_message_credits = excluded.monthly_message_credits, features = excluded.features,
           capabilities = excluded.capabilities, is_public = excluded.is_public, updated_at = excluded.updated_at`,
      )
      .bind(id, input.name, input.tagline, input.maxStaff, input.maxClients, input.monthlyMessageCredits, JSON.stringify(input.features), JSON.stringify(input.capabilities), Number(input.isPublic), t, t),
    db.prepare('DELETE FROM plan_prices WHERE plan_id = ?').bind(id),
    ...input.prices.map((p) =>
      db.prepare('INSERT INTO plan_prices (plan_id, currency, interval, amount, stripe_price_id) VALUES (?, ?, ?, ?, ?)').bind(id, p.currency, p.interval, p.amount, p.stripePriceId ?? null),
    ),
  ]);
  await audit(c, { action: 'admin.plan_saved', targetType: 'plan', targetId: id });
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Announcements, audit, messages, users
// ---------------------------------------------------------------------------
admin.get('/announcements', async (c) =>
  c.json({ announcements: await all(c.env.DB, 'SELECT id, message, level, active, expires_at AS expiresAt, created_at AS createdAt FROM announcements ORDER BY created_at DESC LIMIT 50') }),
);

admin.post('/announcements', async (c) => {
  const input = await body(c, z.object({ message: z.string().trim().min(3).max(300), level: z.enum(['info', 'warning', 'critical']), expiresInHours: z.number().int().min(1).max(24 * 90).optional() }));
  const id = newId('ann');
  await run(
    c.env.DB,
    'INSERT INTO announcements (id, message, level, active, expires_at, created_at) VALUES (?, ?, ?, 1, ?, ?)',
    id,
    input.message,
    input.level,
    input.expiresInHours ? now() + input.expiresInHours * HOUR : null,
    now(),
  );
  await audit(c, { action: 'admin.announcement_created', targetId: id, meta: { message: input.message } });
  return c.json({ id }, 201);
});

admin.patch('/announcements/:id', async (c) => {
  const input = await body(c, z.object({ active: z.boolean() }));
  await run(c.env.DB, 'UPDATE announcements SET active = ? WHERE id = ?', Number(input.active), c.req.param('id'));
  return c.json({ ok: true });
});

admin.get('/audit', async (c) => {
  const salonId = c.req.query('salonId');
  const rows = await all(
    c.env.DB,
    `SELECT a.id, a.salon_id AS salonId, s.name AS salonName, a.action, u.email AS actorEmail, a.impersonator_id AS impersonatorId,
       a.target_type AS targetType, a.target_id AS targetId, a.meta, a.ip, a.created_at AS createdAt
     FROM audit_log a LEFT JOIN salons s ON s.id = a.salon_id LEFT JOIN users u ON u.id = a.actor_user_id
     WHERE (? IS NULL OR a.salon_id = ?) ORDER BY a.created_at DESC LIMIT 200`,
    salonId ?? null,
    salonId ?? null,
  );
  return c.json({ entries: rows });
});

admin.get('/messages', async (c) => {
  const status = c.req.query('status');
  const rows = await all(
    c.env.DB,
    `SELECT m.id, m.salon_id AS salonId, s.name AS salonName, m.channel, m.kind, m.status, m.provider, m.error, m.credits,
       substr(m.to_phone, 1, length(m.to_phone) - 4) || '••••' AS toPhone, m.created_at AS createdAt
     FROM messages m LEFT JOIN salons s ON s.id = m.salon_id
     WHERE (? IS NULL OR m.status = ?) ORDER BY m.created_at DESC LIMIT 200`,
    status ?? null,
    status ?? null,
  );
  return c.json({ messages: rows });
});

admin.get('/users', async (c) => {
  const q = c.req.query('q') ?? '';
  const users = await all<UserRow>(c.env.DB, 'SELECT * FROM users WHERE email LIKE ? OR name LIKE ? ORDER BY created_at DESC LIMIT 50', `%${q}%`, `%${q}%`);
  return c.json({ users: users.map((u) => ({ ...serializeUser(u), disabled: Boolean(u.disabled_at), lastLoginAt: u.last_login_at })) });
});

admin.patch('/users/:id', async (c) => {
  const input = await body(c, z.object({ disabled: z.boolean() }));
  const id = c.req.param('id');
  if (id === c.get('user')!.id) throw badRequest('You cannot disable yourself.');
  await run(c.env.DB, 'UPDATE users SET disabled_at = ? WHERE id = ?', input.disabled ? now() : null, id);
  if (input.disabled) await run(c.env.DB, 'DELETE FROM sessions WHERE user_id = ?', id);
  await audit(c, { action: input.disabled ? 'admin.user_disabled' : 'admin.user_enabled', targetType: 'user', targetId: id });
  return c.json({ ok: true });
});

export default admin;
