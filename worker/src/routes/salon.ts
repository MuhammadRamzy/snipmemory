import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv, MemberRow, SalonRow } from '../types';
import { audit } from '../lib/audit';
import { hashSecret, newId, randomToken, sha256 } from '../lib/crypto';
import { DAY, all, count, first, now, run } from '../lib/db';
import { badRequest, body, forbidden, notFound } from '../lib/http';
import { normalizePhone } from '../lib/phone';
import { assertStaffQuota, getPlan } from '../lib/plans';
import { serializeMember, serializePlan, serializeSalon } from '../lib/serialize';
import { salonAccess } from '../lib/session';
import { sendEmail } from '../lib/email';

const salon = new Hono<AppEnv>();

async function usage(db: D1Database, salonId: string) {
  const [clients, staff, storage] = await Promise.all([
    count(db, 'SELECT COUNT(*) AS n FROM clients WHERE salon_id = ? AND deleted_at IS NULL', salonId),
    count(db, 'SELECT COUNT(*) AS n FROM members WHERE salon_id = ? AND active = 1', salonId),
    count(db, 'SELECT SUM(bytes) AS n FROM photos WHERE salon_id = ?', salonId),
  ]);
  return { clients, staff, storageBytes: storage };
}

salon.get('/', salonAccess('floor'), async (c) => {
  const access = c.get('access');
  const plan = await getPlan(c.env.DB, access.salon.plan_id);
  return c.json({
    salon: serializeSalon(access.salon),
    plan: serializePlan(plan),
    usage: await usage(c.env.DB, access.salon.id),
    viewer: { kind: access.kind, role: access.role, memberId: access.memberId, impersonating: Boolean(access.impersonatorId) },
  });
});

const hour = z.number().int().min(0).max(24);
const settingsSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    phone: z.string().trim().max(30).nullable(),
    email: z.email().nullable(),
    address: z.string().trim().max(300).nullable(),
    city: z.string().trim().max(100).nullable(),
    timezone: z.string().max(64),
    brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    bookingUrl: z.url().max(500).nullable(),
    defaultCadenceDays: z.number().int().min(7).max(180),
    remindersEnabled: z.boolean(),
    reminderChannel: z.enum(['whatsapp', 'sms']),
    reminderTemplate: z.string().trim().max(600).nullable(),
    sendWindowStart: hour,
    sendWindowEnd: hour,
  })
  .partial();

salon.patch('/', salonAccess('manage'), async (c) => {
  const input = await body(c, settingsSchema);
  const s = c.get('access').salon;
  if (input.timezone) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: input.timezone });
    } catch {
      throw badRequest('Unknown time zone.');
    }
  }
  const start = input.sendWindowStart ?? s.send_window_start;
  const end = input.sendWindowEnd ?? s.send_window_end;
  if (start >= end) throw badRequest('Reminder sending window must start before it ends.');

  const columns: Record<string, unknown> = {
    name: input.name,
    phone: input.phone === undefined ? undefined : input.phone ? normalizePhone(input.phone, s.country) : null,
    email: input.email,
    address: input.address,
    city: input.city,
    timezone: input.timezone,
    brand_color: input.brandColor,
    booking_url: input.bookingUrl,
    default_cadence_days: input.defaultCadenceDays,
    reminders_enabled: input.remindersEnabled === undefined ? undefined : Number(input.remindersEnabled),
    reminder_channel: input.reminderChannel,
    reminder_template: input.reminderTemplate,
    send_window_start: input.sendWindowStart,
    send_window_end: input.sendWindowEnd,
  };
  const entries = Object.entries(columns).filter(([, v]) => v !== undefined);
  if (entries.length) {
    await run(
      c.env.DB,
      `UPDATE salons SET ${entries.map(([k]) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
      ...entries.map(([, v]) => v),
      now(),
      s.id,
    );
  }
  if (input.defaultCadenceDays && input.defaultCadenceDays !== s.default_cadence_days) {
    // Shift scheduled reminders of clients that still use the salon default.
    await run(
      c.env.DB,
      `UPDATE clients SET next_reminder_at = last_visit_at + ? WHERE salon_id = ? AND cadence_days IS NULL
       AND last_visit_at IS NOT NULL AND visit_count < 3 AND next_reminder_at IS NOT NULL`,
      input.defaultCadenceDays * DAY,
      s.id,
    );
  }
  await audit(c, { salonId: s.id, action: 'salon.settings_updated', meta: { fields: entries.map(([k]) => k) } });
  const updated = await first<SalonRow>(c.env.DB, 'SELECT * FROM salons WHERE id = ?', s.id);
  return c.json({ salon: serializeSalon(updated!) });
});

salon.post('/onboarded', salonAccess('manage'), async (c) => {
  await run(c.env.DB, 'UPDATE salons SET onboarded_at = COALESCE(onboarded_at, ?) WHERE id = ?', now(), c.get('access').salon.id);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
function localDateKey(timeZone: string, at: number): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  } catch {
    return new Date(at).toISOString().slice(0, 10);
  }
}

salon.get('/dashboard', salonAccess('floor'), async (c) => {
  const { salon: s } = c.get('access');
  const db = c.env.DB;
  const t = now();
  const d30 = t - 30 * DAY;
  const d60 = t - 60 * DAY;
  const today = localDateKey(s.timezone, t);

  const [visits, prevVisits, newClients, totalClients, activeClients, due, remindersSent, stylists] = await Promise.all([
    all<{ created_at: number; price: number | null; recovered_by_message_id: string | null; client_id: string; first_visit: number }>(
      db,
      `SELECT v.created_at, v.price, v.recovered_by_message_id, v.client_id,
         (SELECT MIN(v2.created_at) FROM visits v2 WHERE v2.client_id = v.client_id AND v2.deleted_at IS NULL) AS first_visit
       FROM visits v WHERE v.salon_id = ? AND v.deleted_at IS NULL AND v.created_at >= ?`,
      s.id,
      d30,
    ),
    count(db, 'SELECT COUNT(*) AS n FROM visits WHERE salon_id = ? AND deleted_at IS NULL AND created_at >= ? AND created_at < ?', s.id, d60, d30),
    count(db, 'SELECT COUNT(*) AS n FROM clients WHERE salon_id = ? AND deleted_at IS NULL AND created_at >= ?', s.id, d30),
    count(db, 'SELECT COUNT(*) AS n FROM clients WHERE salon_id = ? AND deleted_at IS NULL', s.id),
    count(db, 'SELECT COUNT(*) AS n FROM clients WHERE salon_id = ? AND deleted_at IS NULL AND last_visit_at >= ?', s.id, t - 90 * DAY),
    count(
      db,
      'SELECT COUNT(*) AS n FROM clients WHERE salon_id = ? AND deleted_at IS NULL AND opted_out_at IS NULL AND next_reminder_at <= ?',
      s.id,
      t,
    ),
    count(db, "SELECT COUNT(*) AS n FROM messages WHERE salon_id = ? AND kind = 'reminder' AND status = 'sent' AND created_at >= ?", s.id, d30),
    all<{ member_id: string; display_name: string; visits: number; revenue: number | null }>(
      db,
      `SELECT v.member_id, m.display_name, COUNT(*) AS visits, SUM(v.price) AS revenue
       FROM visits v JOIN members m ON m.id = v.member_id
       WHERE v.salon_id = ? AND v.deleted_at IS NULL AND v.created_at >= ?
       GROUP BY v.member_id ORDER BY visits DESC LIMIT 10`,
      s.id,
      d30,
    ),
  ]);

  const series = new Map<string, number>();
  for (let i = 29; i >= 0; i--) series.set(localDateKey(s.timezone, t - i * DAY), 0);
  let visitsToday = 0;
  let revenue = 0;
  let recovered = 0;
  let recoveredRevenue = 0;
  let returning = 0;
  for (const v of visits) {
    const key = localDateKey(s.timezone, v.created_at);
    if (series.has(key)) series.set(key, (series.get(key) ?? 0) + 1);
    if (key === today) visitsToday++;
    revenue += v.price ?? 0;
    if (v.first_visit < v.created_at) returning++;
    if (v.recovered_by_message_id) {
      recovered++;
      recoveredRevenue += v.price ?? 0;
    }
  }

  return c.json({
    currency: s.currency,
    visitsToday,
    visits30d: visits.length,
    visitsPrev30d: prevVisits,
    revenue30d: revenue,
    newClients30d: newClients,
    totalClients,
    activeClients90d: activeClients,
    returningRate30d: visits.length ? Math.round((returning / visits.length) * 100) : 0,
    dueReminders: due,
    remindersSent30d: remindersSent,
    recoveredVisits30d: recovered,
    recoveredRevenue30d: recoveredRevenue,
    credits: { monthly: s.message_credits, bonus: s.bonus_credits },
    series: [...series.entries()].map(([date, n]) => ({ date, visits: n })),
    stylists: stylists.map((r) => ({ memberId: r.member_id, name: r.display_name, visits: r.visits, revenue: r.revenue ?? 0 })),
  });
});

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------
salon.get('/team', salonAccess('floor'), async (c) => {
  const { salon: s, role } = c.get('access');
  const members = await all<MemberRow & { email: string | null }>(
    c.env.DB,
    `SELECT m.*, u.email FROM members m LEFT JOIN users u ON u.id = m.user_id WHERE m.salon_id = ?
     ORDER BY m.active DESC, CASE m.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END, m.display_name`,
    s.id,
  );
  const canManage = role === 'owner' || role === 'manager';
  const invites = canManage
    ? await all<{ id: string; email: string; role: string; expires_at: number; created_at: number }>(
        c.env.DB,
        'SELECT id, email, role, expires_at, created_at FROM invites WHERE salon_id = ? AND accepted_at IS NULL AND expires_at > ? ORDER BY created_at DESC',
        s.id,
        now(),
      )
    : [];
  return c.json({
    members: members.map((m) => ({ ...serializeMember(m), email: canManage ? m.email : null })),
    invites: invites.map((i) => ({ id: i.id, email: i.email, role: i.role, expiresAt: i.expires_at, createdAt: i.created_at })),
  });
});

const pinSchema = z.string().regex(/^\d{4,6}$/, 'PIN must be 4–6 digits');

salon.post('/team', salonAccess('manage'), async (c) => {
  const input = await body(
    c,
    z.object({ displayName: z.string().trim().min(1).max(60), role: z.enum(['manager', 'stylist']).default('stylist'), pin: pinSchema.optional() }),
  );
  const { salon: s } = c.get('access');
  await assertStaffQuota(c.env.DB, s);
  const id = newId('mem');
  await run(
    c.env.DB,
    'INSERT INTO members (id, salon_id, display_name, role, pin_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    s.id,
    input.displayName,
    input.role,
    input.pin ? await hashSecret(input.pin) : null,
    now(),
  );
  await audit(c, { salonId: s.id, action: 'team.member_added', targetType: 'member', targetId: id });
  const member = await first<MemberRow>(c.env.DB, 'SELECT * FROM members WHERE id = ?', id);
  return c.json({ member: serializeMember(member!) }, 201);
});

async function loadMember(db: D1Database, salonId: string, memberId: string) {
  const member = await first<MemberRow>(db, 'SELECT * FROM members WHERE id = ? AND salon_id = ?', memberId, salonId);
  if (!member) throw notFound('Team member');
  return member;
}

salon.patch('/team/:memberId', salonAccess('manage'), async (c) => {
  const input = await body(
    c,
    z.object({ displayName: z.string().trim().min(1).max(60), role: z.enum(['owner', 'manager', 'stylist']), active: z.boolean() }).partial(),
  );
  const { salon: s, role: actorRole } = c.get('access');
  const member = await loadMember(c.env.DB, s.id, c.req.param('memberId'));
  if (actorRole !== 'owner' && (member.role === 'owner' || input.role === 'owner')) throw forbidden('Only an owner can change owners.');
  if (input.role === 'owner' && !member.user_id) throw badRequest('Invite this person with an email login before making them an owner.');
  if (member.role === 'owner' && (input.role && input.role !== 'owner' || input.active === false)) {
    const owners = await count(c.env.DB, "SELECT COUNT(*) AS n FROM members WHERE salon_id = ? AND role = 'owner' AND active = 1", s.id);
    if (owners <= 1) throw badRequest('A salon needs at least one owner.');
  }
  if (input.active === true && !member.active) await assertStaffQuota(c.env.DB, s);
  await run(
    c.env.DB,
    'UPDATE members SET display_name = ?, role = ?, active = ? WHERE id = ?',
    input.displayName ?? member.display_name,
    input.role ?? member.role,
    input.active === undefined ? member.active : Number(input.active),
    member.id,
  );
  if (input.active === false) {
    // Lock any station this person had unlocked and sign them out of this salon.
    await run(c.env.DB, 'UPDATE sessions SET acting_member_id = NULL, acting_until = NULL WHERE acting_member_id = ?', member.id);
  }
  await audit(c, { salonId: s.id, action: 'team.member_updated', targetType: 'member', targetId: member.id, meta: input });
  return c.json({ member: serializeMember(await loadMember(c.env.DB, s.id, member.id)) });
});

salon.put('/team/:memberId/pin', salonAccess('floor'), async (c) => {
  const input = await body(c, z.object({ pin: pinSchema }));
  const { salon: s, role, memberId, kind } = c.get('access');
  const member = await loadMember(c.env.DB, s.id, c.req.param('memberId'));
  const isSelf = member.id === memberId && kind === 'user';
  const canManage = kind === 'user' && (role === 'owner' || role === 'manager') && (member.role !== 'owner' || role === 'owner');
  if (!isSelf && !canManage) throw forbidden();
  await run(c.env.DB, 'UPDATE members SET pin_hash = ? WHERE id = ?', await hashSecret(input.pin), member.id);
  await audit(c, { salonId: s.id, action: 'team.pin_set', targetType: 'member', targetId: member.id });
  return c.json({ ok: true });
});

salon.post('/team/invites', salonAccess('manage'), async (c) => {
  const input = await body(c, z.object({ email: z.email(), role: z.enum(['manager', 'stylist']), memberId: z.string().optional() }));
  const { salon: s } = c.get('access');
  if (input.memberId) {
    const member = await loadMember(c.env.DB, s.id, input.memberId);
    if (member.user_id) throw badRequest('This team member already has a login.');
  } else {
    await assertStaffQuota(c.env.DB, s);
  }
  const token = randomToken(24);
  const id = newId('inv');
  await run(
    c.env.DB,
    'INSERT INTO invites (id, salon_id, member_id, email, role, token_hash, created_by, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    id,
    s.id,
    input.memberId ?? null,
    input.email,
    input.role,
    await sha256(token),
    c.get('user')!.id,
    now() + 7 * DAY,
    now(),
  );
  await audit(c, { salonId: s.id, action: 'team.invited', targetType: 'invite', targetId: id, meta: { email: input.email, role: input.role } });
  const inviteUrl = `${c.env.APP_URL}/invite/${token}`;
  // Emailed when an email provider is configured; the link is also returned so the owner can share it on WhatsApp.
  const emailed = await sendEmail(c.env, {
    to: input.email,
    subject: `Join ${s.name} on SnipMemory`,
    text: `${c.get('user')!.name} invited you to join ${s.name} on SnipMemory as ${input.role}.\n\nAccept the invite (valid 7 days):\n${inviteUrl}`,
  });
  return c.json({ id, inviteUrl, emailed }, 201);
});

salon.delete('/team/invites/:inviteId', salonAccess('manage'), async (c) => {
  await run(c.env.DB, 'DELETE FROM invites WHERE id = ? AND salon_id = ?', c.req.param('inviteId'), c.get('access').salon.id);
  return c.json({ ok: true });
});

export default salon;
