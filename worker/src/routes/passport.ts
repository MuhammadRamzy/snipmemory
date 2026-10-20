import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv, ClientRow, SessionRow } from '../types';
import { newId } from '../lib/crypto';
import { MINUTE, all, first, now, run } from '../lib/db';
import { ApiError, badRequest, body, clientIp, notFound, unauthorized } from '../lib/http';
import { issueOtp, verifyOtp } from '../lib/otp';
import { normalizePhone } from '../lib/phone';
import { rateLimit } from '../lib/ratelimit';
import { createSession, destroySession, loadSession } from '../lib/session';
import { loadVisits } from '../lib/visits';
import { eraseClient } from './clients';

/**
 * Style Passport — the end-customer side of SnipMemory.
 * Clients sign in with their phone number to see every cut they've had at any
 * SnipMemory salon, control who can see it, stop reminders and erase their data.
 */
const passport = new Hono<AppEnv>();

const phoneInput = z.object({ phone: z.string().min(5).max(30), country: z.string().length(2).default('US') });

passport.post('/login/request', async (c) => {
  const input = await body(c, phoneInput);
  await rateLimit(c.env.DB, `otp-ip:${clientIp(c)}`, 10, 60 * MINUTE);
  const phone = normalizePhone(input.phone, input.country);
  if (!phone) throw badRequest('Enter a valid mobile number.');
  const known = await first(c.env.DB, 'SELECT 1 FROM passports WHERE phone = ?', phone);
  // Don't reveal whether a number is registered, and don't pay to text unknown numbers.
  if (!known) return c.json({ sent: true, phone });
  const result = await issueOtp(c.env, { phone, purpose: 'passport_login' });
  return c.json({ sent: true, phone, ...result });
});

passport.post('/login/verify', async (c) => {
  const input = await body(c, phoneInput.extend({ code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code') }));
  const phone = normalizePhone(input.phone, input.country);
  if (!phone) throw badRequest('Enter a valid mobile number.');
  const record = await first<{ id: string }>(c.env.DB, 'SELECT id FROM passports WHERE phone = ?', phone);
  if (!record) throw new ApiError(400, 'otp_expired', 'That code has expired. Request a new one.');
  if (!(await verifyOtp(c.env, { phone, purpose: 'passport_login', code: input.code }))) {
    throw new ApiError(400, 'otp_invalid', 'That code is not correct.');
  }
  const t = now();
  await run(c.env.DB, 'UPDATE passports SET verified_at = COALESCE(verified_at, ?), last_login_at = ? WHERE id = ?', t, t, record.id);
  await destroySession(c, 'client');
  await createSession(c, 'client', { passport_id: record.id });
  return c.json({ ok: true });
});

passport.post('/logout', async (c) => {
  await destroySession(c, 'client');
  return c.json({ ok: true });
});

async function requirePassport(c: Parameters<typeof loadSession>[0]): Promise<SessionRow & { passport_id: string }> {
  const session = await loadSession(c, 'client');
  if (!session?.passport_id) throw unauthorized('Sign in with your phone number.');
  return session as SessionRow & { passport_id: string };
}

passport.get('/me', async (c) => {
  const session = await loadSession(c, 'client');
  if (!session?.passport_id) return c.json({ passport: null });
  const db = c.env.DB;
  const record = await first<{ id: string; phone: string; name: string | null; created_at: number }>(
    db,
    'SELECT id, phone, name, created_at FROM passports WHERE id = ?',
    session.passport_id,
  );
  if (!record) return c.json({ passport: null });
  const salons = await all<ClientRow & { salon_name: string; city: string | null; booking_url: string | null; slug: string; shared_at: number | null }>(
    db,
    `SELECT c.*, s.name AS salon_name, s.city, s.booking_url, s.slug,
       (SELECT ps.granted_at FROM passport_shares ps WHERE ps.passport_id = c.passport_id AND ps.salon_id = c.salon_id AND ps.revoked_at IS NULL) AS shared_at
     FROM clients c JOIN salons s ON s.id = c.salon_id
     WHERE c.passport_id = ? AND c.deleted_at IS NULL AND s.deleted_at IS NULL ORDER BY c.last_visit_at DESC`,
    record.id,
  );
  // Salons that were granted access but where the client has no record of their own.
  const shares = await all<{ salon_id: string; salon_name: string; granted_at: number }>(
    db,
    `SELECT ps.salon_id, s.name AS salon_name, ps.granted_at FROM passport_shares ps JOIN salons s ON s.id = ps.salon_id
     WHERE ps.passport_id = ? AND ps.revoked_at IS NULL ORDER BY ps.granted_at DESC`,
    record.id,
  );
  const visits = await loadVisits(db, 'v.client_id IN (SELECT id FROM clients WHERE passport_id = ? AND deleted_at IS NULL)', [record.id], 300);
  return c.json({
    passport: { id: record.id, phone: record.phone, name: record.name ?? salons[0]?.name ?? null, createdAt: record.created_at },
    salons: salons.map((s) => ({
      salonId: s.salon_id,
      salonName: s.salon_name,
      city: s.city,
      bookingUrl: s.booking_url ?? `/s/${s.slug}`,
      visitCount: s.visit_count,
      lastVisitAt: s.last_visit_at,
      nextReminderAt: s.opted_out_at ? null : s.next_reminder_at,
      remindersOff: Boolean(s.opted_out_at),
    })),
    shares: shares.map((s) => ({ salonId: s.salon_id, salonName: s.salon_name, grantedAt: s.granted_at })),
    visits,
  });
});

passport.post('/salons/:salonId/reminders', async (c) => {
  const session = await requirePassport(c);
  const input = await body(c, z.object({ enabled: z.boolean() }));
  const res = await run(
    c.env.DB,
    'UPDATE clients SET opted_out_at = ?, updated_at = ? WHERE passport_id = ? AND salon_id = ? AND deleted_at IS NULL',
    input.enabled ? null : now(),
    now(),
    session.passport_id,
    c.req.param('salonId'),
  );
  if (!res.meta.changes) throw notFound('Salon');
  return c.json({ ok: true });
});

passport.delete('/shares/:salonId', async (c) => {
  const session = await requirePassport(c);
  await run(
    c.env.DB,
    'UPDATE passport_shares SET revoked_at = ? WHERE passport_id = ? AND salon_id = ? AND revoked_at IS NULL',
    now(),
    session.passport_id,
    c.req.param('salonId'),
  );
  return c.json({ ok: true });
});

/** Erase everything one salon holds about me (photos, notes, contact details). */
passport.delete('/salons/:salonId', async (c) => {
  const session = await requirePassport(c);
  const client = await first<{ id: string }>(
    c.env.DB,
    'SELECT id FROM clients WHERE passport_id = ? AND salon_id = ? AND deleted_at IS NULL',
    session.passport_id,
    c.req.param('salonId'),
  );
  if (!client) throw notFound('Salon');
  await eraseClient(c.env.DB, c.env.MEDIA, client.id);
  await run(
    c.env.DB,
    `INSERT INTO audit_log (id, salon_id, action, target_type, target_id, meta, ip, created_at)
     VALUES (?, ?, 'client.erased_by_client', 'client', ?, '{}', ?, ?)`,
    newId('aud'),
    c.req.param('salonId'),
    client.id,
    clientIp(c),
    now(),
  );
  return c.json({ ok: true });
});

/** Data portability: everything we hold about this passport as JSON. */
passport.get('/export', async (c) => {
  const session = await requirePassport(c);
  const db = c.env.DB;
  const record = await first(db, 'SELECT phone, name, created_at, verified_at FROM passports WHERE id = ?', session.passport_id);
  const clients = await all(
    db,
    `SELECT s.name AS salon, c.name, c.phone, c.email, c.visit_count, c.last_visit_at, c.marketing_consent_at, c.photo_consent_at, c.opted_out_at
     FROM clients c JOIN salons s ON s.id = c.salon_id WHERE c.passport_id = ? AND c.deleted_at IS NULL`,
    session.passport_id,
  );
  const visits = await loadVisits(db, 'v.client_id IN (SELECT id FROM clients WHERE passport_id = ? AND deleted_at IS NULL)', [session.passport_id], 1000);
  return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), passport: record, salons: clients, visits }, null, 2), {
    headers: { 'content-type': 'application/json', 'content-disposition': 'attachment; filename="snipmemory-passport.json"' },
  });
});

/** Close the passport: revoke all shares, stop every reminder and unlink salon records. */
passport.delete('/me', async (c) => {
  const session = await requirePassport(c);
  const t = now();
  const db = c.env.DB;
  await db.batch([
    db.prepare('DELETE FROM passport_shares WHERE passport_id = ?').bind(session.passport_id),
    db.prepare('UPDATE clients SET opted_out_at = COALESCE(opted_out_at, ?), passport_id = NULL WHERE passport_id = ?').bind(t, session.passport_id),
    db.prepare("DELETE FROM sessions WHERE kind = 'client' AND passport_id = ?").bind(session.passport_id),
    db.prepare('DELETE FROM passports WHERE id = ?').bind(session.passport_id),
  ]);
  await destroySession(c, 'client');
  return c.json({ ok: true });
});

export default passport;
