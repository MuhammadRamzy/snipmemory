import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv, MemberRow, SalonRow, UserRow } from '../types';
import { audit } from '../lib/audit';
import { hashSecret, newId, randomToken, sha256, verifySecret } from '../lib/crypto';
import { DAY, MINUTE, all, first, now, run } from '../lib/db';
import { badRequest, body, clientIp, conflict, notFound, unauthorized } from '../lib/http';
import { normalizePhone } from '../lib/phone';
import { TRIAL_CREDITS, TRIAL_DAYS, TRIAL_PLAN } from '../lib/plans';
import { rateLimit } from '../lib/ratelimit';
import { serializeSalon, serializeUser } from '../lib/serialize';
import { createSession, currentUser, destroySession, requireUser } from '../lib/session';
import { sendEmail } from '../lib/email';

const auth = new Hono<AppEnv>();

const EURO = new Set(['DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'PT', 'IE', 'AT', 'FI', 'GR']);

export function currencyForCountry(country: string): string {
  const cc = country.toUpperCase();
  if (cc === 'IN') return 'INR';
  if (cc === 'GB') return 'GBP';
  if (cc === 'AE') return 'AED';
  if (EURO.has(cc)) return 'EUR';
  return 'USD';
}

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 40) || 'salon'
  );
}

async function uniqueSlug(db: D1Database, name: string): Promise<string> {
  const base = slugify(name);
  let slug = base;
  for (let i = 0; i < 5; i++) {
    if (!(await first(db, 'SELECT 1 FROM salons WHERE slug = ?', slug))) return slug;
    slug = `${base}-${randomToken(3).toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

const password = z.string().min(8, 'must be at least 8 characters').max(200);

const signupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email().max(200),
  password,
  salonName: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(30).optional(),
  city: z.string().trim().max(100).optional(),
  country: z.string().length(2).default('US'),
  timezone: z.string().max(64).default('UTC'),
  referralCode: z.string().trim().max(20).optional(),
});

/** Members + their salons for the signed-in user. */
export async function membershipsFor(db: D1Database, userId: string) {
  const rows = await all<SalonRow & { member_id: string; role: MemberRow['role'] }>(
    db,
    `SELECT s.*, m.id AS member_id, m.role FROM members m JOIN salons s ON s.id = m.salon_id
     WHERE m.user_id = ? AND m.active = 1 AND s.deleted_at IS NULL ORDER BY s.created_at`,
    userId,
  );
  return rows.map((row) => ({ memberId: row.member_id, role: row.role, salon: serializeSalon(row) }));
}

async function mePayload(c: Parameters<typeof currentUser>[0]) {
  const authed = await currentUser(c);
  if (!authed) return { user: null, memberships: [], impersonating: null };
  const { user, session } = authed;
  if (session.impersonator_id && session.salon_id) {
    const salon = await first<SalonRow>(c.env.DB, 'SELECT * FROM salons WHERE id = ?', session.salon_id);
    return {
      user: { ...serializeUser(user), isPlatformAdmin: false },
      memberships: salon ? [{ memberId: null, role: 'owner' as const, salon: serializeSalon(salon) }] : [],
      impersonating: salon ? { salonId: salon.id, salonName: salon.name } : null,
    };
  }
  return { user: serializeUser(user), memberships: await membershipsFor(c.env.DB, user.id), impersonating: null };
}

auth.get('/me', async (c) => c.json(await mePayload(c)));

auth.post('/signup', async (c) => {
  const input = await body(c, signupSchema);
  await rateLimit(c.env.DB, `signup:${clientIp(c)}`, 10, 60 * MINUTE);
  const db = c.env.DB;
  if (await first(db, 'SELECT 1 FROM users WHERE email = ?', input.email)) {
    throw conflict('An account with this email already exists. Sign in instead.', 'email_taken');
  }
  const t = now();
  const userId = newId('usr');
  const salonId = newId('sal');
  const country = input.country.toUpperCase();
  const admins =
    c.env.APP_ENV === 'production' ? [] : (c.env.PLATFORM_ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  const referrer = input.referralCode
    ? await first<{ id: string }>(db, 'SELECT id FROM salons WHERE referral_code = ?', input.referralCode.toUpperCase())
    : null;
  const phone = input.phone ? normalizePhone(input.phone, country) : null;

  await db.batch([
    db
      .prepare('INSERT INTO users (id, email, name, phone, password_hash, is_platform_admin, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(userId, input.email, input.name, phone, await hashSecret(input.password), admins.includes(input.email.toLowerCase()) ? 1 : 0, t),
    db
      .prepare(
        `INSERT INTO salons (id, slug, name, phone, email, city, country, timezone, currency, plan_id, subscription_status,
           trial_ends_at, message_credits, credits_reset_at, referral_code, referred_by_salon_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'trialing', ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        salonId,
        await uniqueSlug(db, input.salonName),
        input.salonName,
        phone,
        input.email,
        input.city ?? null,
        country,
        input.timezone,
        currencyForCountry(country),
        TRIAL_PLAN,
        t + TRIAL_DAYS * DAY,
        TRIAL_CREDITS,
        t + 30 * DAY,
        randomToken(6).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8),
        referrer?.id ?? null,
        t,
        t,
      ),
    db
      .prepare("INSERT INTO members (id, salon_id, user_id, display_name, role, created_at) VALUES (?, ?, ?, ?, 'owner', ?)")
      .bind(newId('mem'), salonId, userId, input.name, t),
  ]);

  await createSession(c, 'user', { user_id: userId });
  await audit(c, { salonId, action: 'salon.created', targetType: 'salon', targetId: salonId, meta: { referredBy: referrer?.id } });
  return c.json(await mePayload(c), 201);
});

auth.post('/login', async (c) => {
  const input = await body(c, z.object({ email: z.email(), password: z.string().min(1).max(200) }));
  await rateLimit(c.env.DB, `login:${clientIp(c)}`, 20, 15 * MINUTE);
  await rateLimit(c.env.DB, `login:${input.email.toLowerCase()}`, 8, 15 * MINUTE);
  const user = await first<UserRow>(c.env.DB, 'SELECT * FROM users WHERE email = ?', input.email);
  // Always run a hash comparison so response time doesn't reveal whether the email exists.
  const ok = await verifySecret(input.password, user?.password_hash ?? 'pbkdf2$100000$00$00');
  if (!user || !ok || user.disabled_at) throw unauthorized('Incorrect email or password.');
  await run(c.env.DB, 'UPDATE users SET last_login_at = ? WHERE id = ?', now(), user.id);
  await destroySession(c, 'user');
  await createSession(c, 'user', { user_id: user.id });
  return c.json(await mePayload(c));
});

auth.post('/logout', async (c) => {
  await destroySession(c, 'user');
  return c.json({ ok: true });
});

/** Ends a support impersonation session and restores the admin's own session. */
auth.post('/impersonation/stop', requireUser, async (c) => {
  const session = c.get('userSession')!;
  if (!session.impersonator_id) throw badRequest('Not impersonating.');
  await audit(c, { salonId: session.salon_id, action: 'admin.impersonation_ended' });
  const adminId = session.impersonator_id;
  await destroySession(c, 'user');
  await createSession(c, 'user', { user_id: adminId });
  return c.json(await mePayload(c));
});

auth.post('/password', requireUser, async (c) => {
  const input = await body(c, z.object({ currentPassword: z.string(), newPassword: password }));
  const user = c.get('user')!;
  if (!(await verifySecret(input.currentPassword, user.password_hash))) throw badRequest('Current password is incorrect.');
  await run(c.env.DB, 'UPDATE users SET password_hash = ? WHERE id = ?', await hashSecret(input.newPassword), user.id);
  // Sign out every other device.
  await run(c.env.DB, "DELETE FROM sessions WHERE kind = 'user' AND user_id = ? AND id != ?", user.id, c.get('userSession')!.id);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Password reset by email
// ---------------------------------------------------------------------------
auth.post('/password/forgot', async (c) => {
  const input = await body(c, z.object({ email: z.email() }));
  await rateLimit(c.env.DB, `forgot:${clientIp(c)}`, 10, 60 * MINUTE);
  await rateLimit(c.env.DB, `forgot:${input.email.toLowerCase()}`, 3, 60 * MINUTE);
  const user = await first<UserRow>(c.env.DB, 'SELECT * FROM users WHERE email = ? AND disabled_at IS NULL', input.email);
  let devLink: string | undefined;
  if (user) {
    const token = randomToken(24);
    await run(
      c.env.DB,
      'INSERT INTO password_resets (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
      await sha256(token),
      user.id,
      now() + 60 * MINUTE,
      now(),
    );
    const link = `${c.env.APP_URL}/reset/${token}`;
    await sendEmail(c.env, {
      to: user.email,
      subject: 'Reset your SnipMemory password',
      text: `Hi ${user.name},\n\nReset your password here (valid for 1 hour):\n${link}\n\nIf you didn't ask for this, you can ignore this email.`,
    });
    if (c.env.APP_ENV !== 'production') devLink = link;
  }
  // Same response whether or not the email exists.
  return c.json({ ok: true, devLink });
});

auth.post('/password/reset', async (c) => {
  const input = await body(c, z.object({ token: z.string().min(10).max(100), password }));
  const hash = await sha256(input.token);
  const reset = await first<{ user_id: string }>(
    c.env.DB,
    'SELECT user_id FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?',
    hash,
    now(),
  );
  if (!reset) throw badRequest('This reset link has expired. Request a new one.', 'reset_expired');
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE password_resets SET used_at = ? WHERE token_hash = ?').bind(now(), hash),
    c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(await hashSecret(input.password), reset.user_id),
    c.env.DB.prepare("DELETE FROM sessions WHERE kind = 'user' AND user_id = ?").bind(reset.user_id),
  ]);
  await destroySession(c, 'user');
  await createSession(c, 'user', { user_id: reset.user_id });
  return c.json(await mePayload(c));
});

// ---------------------------------------------------------------------------
// Team invites (manager / stylist accounts with their own login)
// ---------------------------------------------------------------------------
interface InviteRow {
  id: string;
  salon_id: string;
  member_id: string | null;
  email: string;
  role: 'manager' | 'stylist';
  expires_at: number;
  accepted_at: number | null;
}

async function findInvite(db: D1Database, token: string) {
  const invite = await first<InviteRow & { salon_name: string }>(
    db,
    `SELECT i.*, s.name AS salon_name FROM invites i JOIN salons s ON s.id = i.salon_id
     WHERE i.token_hash = ? AND i.accepted_at IS NULL AND i.expires_at > ?`,
    await sha256(token),
    now(),
  );
  if (!invite) throw notFound('Invitation');
  return invite;
}

auth.get('/invites/:token', async (c) => {
  const invite = await findInvite(c.env.DB, c.req.param('token'));
  const existing = await first(c.env.DB, 'SELECT 1 FROM users WHERE email = ?', invite.email);
  return c.json({ email: invite.email, role: invite.role, salonName: invite.salon_name, hasAccount: Boolean(existing) });
});

auth.post('/invites/:token/accept', async (c) => {
  const input = await body(c, z.object({ name: z.string().trim().min(1).max(100).optional(), password }));
  const db = c.env.DB;
  const invite = await findInvite(db, c.req.param('token'));
  let user = await first<UserRow>(db, 'SELECT * FROM users WHERE email = ?', invite.email);
  if (user) {
    if (!(await verifySecret(input.password, user.password_hash))) throw unauthorized('Incorrect password for this account.');
  } else {
    const id = newId('usr');
    await run(
      db,
      'INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
      id,
      invite.email,
      input.name ?? invite.email.split('@')[0],
      await hashSecret(input.password),
      now(),
    );
    user = (await first<UserRow>(db, 'SELECT * FROM users WHERE id = ?', id))!;
  }
  const already = await first<MemberRow>(db, 'SELECT * FROM members WHERE salon_id = ? AND user_id = ?', invite.salon_id, user.id);
  if (already) {
    await run(db, 'UPDATE members SET active = 1, role = ? WHERE id = ?', already.role === 'owner' ? 'owner' : invite.role, already.id);
  } else if (invite.member_id) {
    // The owner pre-created a station profile for this person; attach the login to it.
    await run(db, 'UPDATE members SET user_id = ?, role = ?, active = 1 WHERE id = ? AND salon_id = ?', user.id, invite.role, invite.member_id, invite.salon_id);
  } else {
    await run(
      db,
      'INSERT INTO members (id, salon_id, user_id, display_name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      newId('mem'),
      invite.salon_id,
      user.id,
      user.name,
      invite.role,
      now(),
    );
  }
  await run(db, 'UPDATE invites SET accepted_at = ? WHERE id = ?', now(), invite.id);
  await destroySession(c, 'user');
  await createSession(c, 'user', { user_id: user.id });
  return c.json(await mePayload(c));
});

export default auth;
