import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv, ClientRow, PhotoRow, VisitRow } from '../types';
import { audit } from '../lib/audit';
import { newId, randomToken } from '../lib/crypto';
import { DAY, all, first, now, run } from '../lib/db';
import { ApiError, badRequest, body, conflict, forbidden, notFound, query } from '../lib/http';
import { issueOtp, verifyOtp } from '../lib/otp';
import { normalizePhone } from '../lib/phone';
import { assertClientQuota, requireCapability } from '../lib/plans';
import { refreshClientSchedule } from '../lib/reminders';
import { serializeClient, serializePhoto } from '../lib/serialize';
import { salonAccess } from '../lib/session';
import { loadVisits, purgePhotos } from '../lib/visits';

const clients = new Hono<AppEnv>();

const listQuery = z.object({
  q: z.string().max(100).optional(),
  filter: z.enum(['all', 'due', 'new', 'lapsed', 'regulars']).default('all'),
  sort: z.enum(['recent', 'name', 'visits']).default('recent'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

clients.get('/', salonAccess('floor'), async (c) => {
  const { q, filter, sort, limit, offset } = query(c, listQuery);
  const { salon } = c.get('access');
  const t = now();
  const where = ['salon_id = ?', 'deleted_at IS NULL'];
  const params: unknown[] = [salon.id];
  if (q?.trim()) {
    const digits = q.replace(/\D/g, '');
    if (digits.length >= 3) {
      where.push('(phone LIKE ? OR name LIKE ?)');
      params.push(`%${digits}%`, `%${q.trim()}%`);
    } else {
      where.push('name LIKE ?');
      params.push(`%${q.trim()}%`);
    }
  }
  if (filter === 'due') {
    where.push('next_reminder_at <= ? AND opted_out_at IS NULL');
    params.push(t);
  } else if (filter === 'new') {
    where.push('created_at >= ?');
    params.push(t - 30 * DAY);
  } else if (filter === 'lapsed') {
    where.push('last_visit_at < ?');
    params.push(t - 90 * DAY);
  } else if (filter === 'regulars') {
    where.push('visit_count >= 5');
  }
  const order = sort === 'name' ? 'name COLLATE NOCASE' : sort === 'visits' ? 'visit_count DESC' : 'COALESCE(last_visit_at, created_at) DESC';
  const rows = await all<ClientRow & { cover_photo: string | null }>(
    c.env.DB,
    `SELECT clients.*, (
        SELECT p.id FROM photos p JOIN visits v ON v.id = p.visit_id
        WHERE v.client_id = clients.id AND v.deleted_at IS NULL AND p.angle = 'front' ORDER BY p.created_at DESC LIMIT 1
      ) AS cover_photo
     FROM clients WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?`,
    ...params,
    limit + 1,
    offset,
  );
  return c.json({
    clients: rows.slice(0, limit).map((r) => ({ ...serializeClient(r), coverPhotoUrl: r.cover_photo ? `/api/media/${r.cover_photo}` : null })),
    hasMore: rows.length > limit,
  });
});

const clientFields = {
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(5).max(30),
  email: z.email().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  hairProfile: z.record(z.string(), z.string().max(200)).optional(),
  cadenceDays: z.number().int().min(7).max(180).nullable().optional(),
  photoConsent: z.boolean().optional(),
  marketingConsent: z.boolean().optional(),
};

async function ensurePassport(db: D1Database, phone: string, name: string): Promise<string> {
  const existing = await first<{ id: string }>(db, 'SELECT id FROM passports WHERE phone = ?', phone);
  if (existing) return existing.id;
  const id = newId('psp');
  await run(db, 'INSERT INTO passports (id, phone, name, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(phone) DO NOTHING', id, phone, name, now());
  return (await first<{ id: string }>(db, 'SELECT id FROM passports WHERE phone = ?', phone))!.id;
}

clients.post('/', salonAccess('floor'), async (c) => {
  const input = await body(c, z.object(clientFields));
  const { salon } = c.get('access');
  const phone = normalizePhone(input.phone, salon.country);
  if (!phone) throw badRequest('Enter a valid mobile number.');
  const dup = await first<ClientRow>(c.env.DB, 'SELECT * FROM clients WHERE salon_id = ? AND phone = ? AND deleted_at IS NULL', salon.id, phone);
  if (dup) {
    return c.json({ error: { code: 'client_exists', message: `${dup.name} already uses this number.` }, client: serializeClient(dup) }, 409);
  }
  await assertClientQuota(c.env.DB, salon);
  const t = now();
  const id = newId('cli');
  await run(
    c.env.DB,
    `INSERT INTO clients (id, salon_id, passport_id, name, phone, email, notes, hair_profile, cadence_days,
       photo_consent_at, marketing_consent_at, unsubscribe_token, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    salon.id,
    await ensurePassport(c.env.DB, phone, input.name),
    input.name,
    phone,
    input.email ?? null,
    input.notes ?? null,
    JSON.stringify(input.hairProfile ?? {}),
    input.cadenceDays ?? null,
    input.photoConsent ? t : null,
    input.marketingConsent ? t : null,
    randomToken(16),
    t,
    t,
  );
  const client = await first<ClientRow>(c.env.DB, 'SELECT * FROM clients WHERE id = ?', id);
  return c.json({ client: serializeClient(client!) }, 201);
});

async function loadClient(c: { env: { DB: D1Database } }, salonId: string, clientId: string) {
  const client = await first<ClientRow>(c.env.DB, 'SELECT * FROM clients WHERE id = ? AND salon_id = ? AND deleted_at IS NULL', clientId, salonId);
  if (!client) throw notFound('Client');
  return client;
}

async function activeShare(db: D1Database, passportId: string | null, salonId: string) {
  if (!passportId) return null;
  return first<{ granted_at: number }>(
    db,
    'SELECT granted_at FROM passport_shares WHERE passport_id = ? AND salon_id = ? AND revoked_at IS NULL',
    passportId,
    salonId,
  );
}

clients.get('/:clientId', salonAccess('floor'), async (c) => {
  const { salon } = c.get('access');
  const client = await loadClient(c, salon.id, c.req.param('clientId'));
  const visits = await loadVisits(c.env.DB, 'v.client_id = ?', [client.id]);
  const share = await activeShare(c.env.DB, client.passport_id, salon.id);
  const otherSalons = client.passport_id
    ? await first<{ n: number }>(
        c.env.DB,
        `SELECT COUNT(DISTINCT c2.salon_id) AS n FROM clients c2 JOIN visits v ON v.client_id = c2.id AND v.deleted_at IS NULL
         WHERE c2.passport_id = ? AND c2.salon_id != ? AND c2.deleted_at IS NULL`,
        client.passport_id,
        salon.id,
      )
    : null;
  const sharedVisits =
    share && client.passport_id
      ? await loadVisits(
          c.env.DB,
          'v.client_id IN (SELECT id FROM clients WHERE passport_id = ? AND salon_id != ? AND deleted_at IS NULL)',
          [client.passport_id, salon.id],
          50,
        )
      : [];
  const messages = await all<{ id: string; channel: string; status: string; body: string; provider: string; created_at: number }>(
    c.env.DB,
    "SELECT id, channel, status, body, provider, created_at FROM messages WHERE client_id = ? AND kind = 'reminder' ORDER BY created_at DESC LIMIT 10",
    client.id,
  );
  return c.json({
    client: serializeClient(client),
    visits,
    passport: {
      shared: Boolean(share),
      sharedAt: share?.granted_at ?? null,
      otherSalonsWithHistory: otherSalons?.n ?? 0,
      visits: sharedVisits,
    },
    reminders: messages.map((m) => ({ id: m.id, channel: m.channel, status: m.status, body: m.body, manual: m.provider === 'manual', createdAt: m.created_at })),
  });
});

clients.patch('/:clientId', salonAccess('floor'), async (c) => {
  const input = await body(c, z.object(clientFields).partial());
  const { salon } = c.get('access');
  const client = await loadClient(c, salon.id, c.req.param('clientId'));
  const t = now();
  let phone = client.phone;
  let passportId = client.passport_id;
  if (input.phone) {
    const normalized = normalizePhone(input.phone, salon.country);
    if (!normalized) throw badRequest('Enter a valid mobile number.');
    if (normalized !== client.phone) {
      if (await first(c.env.DB, 'SELECT 1 FROM clients WHERE salon_id = ? AND phone = ? AND deleted_at IS NULL', salon.id, normalized)) {
        throw conflict('Another client already uses this number.');
      }
      phone = normalized;
      passportId = await ensurePassport(c.env.DB, phone, input.name ?? client.name);
    }
  }
  const consent = (flag: boolean | undefined, current: number | null) => (flag === undefined ? current : flag ? current ?? t : null);
  await run(
    c.env.DB,
    `UPDATE clients SET name = ?, phone = ?, passport_id = ?, email = ?, notes = ?, hair_profile = ?, cadence_days = ?,
       photo_consent_at = ?, marketing_consent_at = ?, updated_at = ? WHERE id = ?`,
    input.name ?? client.name,
    phone,
    passportId,
    input.email === undefined ? client.email : input.email,
    input.notes === undefined ? client.notes : input.notes,
    input.hairProfile ? JSON.stringify(input.hairProfile) : client.hair_profile,
    input.cadenceDays === undefined ? client.cadence_days : input.cadenceDays,
    consent(input.photoConsent, client.photo_consent_at),
    consent(input.marketingConsent, client.marketing_consent_at),
    t,
    client.id,
  );
  if (input.cadenceDays !== undefined) await refreshClientSchedule(c.env.DB, client.id);
  const updated = await loadClient(c, salon.id, client.id);
  return c.json({ client: serializeClient(updated) });
});

/** Right to erasure: removes photos and personal data, keeps anonymous visit counts for the salon's stats. */
clients.delete('/:clientId', salonAccess('manage'), async (c) => {
  const { salon } = c.get('access');
  const client = await loadClient(c, salon.id, c.req.param('clientId'));
  await eraseClient(c.env.DB, c.env.MEDIA, client.id);
  await audit(c, { salonId: salon.id, action: 'client.erased', targetType: 'client', targetId: client.id });
  return c.json({ ok: true });
});

export async function eraseClient(db: D1Database, bucket: R2Bucket, clientId: string) {
  const photos = await all<PhotoRow>(db, 'SELECT p.* FROM photos p JOIN visits v ON v.id = p.visit_id WHERE v.client_id = ?', clientId);
  await purgePhotos(db, bucket, photos);
  const t = now();
  await db.batch([
    db.prepare("UPDATE visits SET notes = NULL, products = NULL, technique = '{}' WHERE client_id = ?").bind(clientId),
    db
      .prepare(
        `UPDATE clients SET name = 'Deleted client', phone = 'deleted:' || id, email = NULL, notes = NULL, hair_profile = '{}',
           passport_id = NULL, next_reminder_at = NULL, opted_out_at = ?, deleted_at = ?, updated_at = ? WHERE id = ?`,
      )
      .bind(t, t, t, clientId),
  ]);
}

clients.get('/export/csv', salonAccess('manage'), async (c) => {
  const { salon } = c.get('access');
  await requireCapability(c.env.DB, salon, 'export');
  const rows = await all<ClientRow>(c.env.DB, 'SELECT * FROM clients WHERE salon_id = ? AND deleted_at IS NULL ORDER BY name', salon.id);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    // Prevent CSV formula injection when opened in spreadsheet apps.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const iso = (t: number | null) => (t ? new Date(t).toISOString() : '');
  const lines = [
    ['name', 'phone', 'email', 'visits', 'total_spend', 'last_visit', 'next_reminder', 'marketing_consent', 'opted_out', 'notes'].join(','),
    ...rows.map((r) =>
      [r.name, r.phone, r.email, r.visit_count, (r.total_spend / 100).toFixed(2), iso(r.last_visit_at), iso(r.next_reminder_at), r.marketing_consent_at ? 'yes' : 'no', r.opted_out_at ? 'yes' : 'no', r.notes]
        .map(esc)
        .join(','),
    ),
  ];
  await audit(c, { salonId: salon.id, action: 'clients.exported', meta: { count: rows.length } });
  return new Response(lines.join('\n'), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${salon.slug}-clients.csv"`,
    },
  });
});

// ---------------------------------------------------------------------------
// Style Passport import: the client approves (via OTP) that this salon may see
// their haircut history from other SnipMemory salons.
// ---------------------------------------------------------------------------
clients.post('/:clientId/passport/request', salonAccess('floor'), async (c) => {
  const { salon } = c.get('access');
  await requireCapability(c.env.DB, salon, 'passport_import');
  const client = await loadClient(c, salon.id, c.req.param('clientId'));
  if (!client.passport_id) throw badRequest('This client has no passport yet.');
  const result = await issueOtp(c.env, { phone: client.phone, purpose: 'passport_share', salonId: salon.id, salonName: salon.name });
  return c.json({ sent: true, ...result });
});

clients.post('/:clientId/passport/verify', salonAccess('floor'), async (c) => {
  const input = await body(c, z.object({ code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code') }));
  const { salon } = c.get('access');
  const client = await loadClient(c, salon.id, c.req.param('clientId'));
  if (!client.passport_id) throw badRequest('This client has no passport yet.');
  const ok = await verifyOtp(c.env, { phone: client.phone, purpose: 'passport_share', code: input.code, salonId: salon.id });
  if (!ok) throw new ApiError(400, 'otp_invalid', 'That code is not correct.');
  const t = now();
  await run(
    c.env.DB,
    `INSERT INTO passport_shares (passport_id, salon_id, granted_at) VALUES (?, ?, ?)
     ON CONFLICT(passport_id, salon_id) DO UPDATE SET granted_at = excluded.granted_at, revoked_at = NULL`,
    client.passport_id,
    salon.id,
    t,
  );
  await run(c.env.DB, 'UPDATE passports SET verified_at = COALESCE(verified_at, ?) WHERE id = ?', t, client.passport_id);
  await audit(c, { salonId: salon.id, action: 'passport.share_granted', targetType: 'client', targetId: client.id });
  return c.json({ shared: true });
});

// ---------------------------------------------------------------------------
// Visits & photos
// ---------------------------------------------------------------------------
const visitFields = {
  service: z.string().trim().min(1).max(80).default('Haircut'),
  styleTags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  technique: z.record(z.string(), z.string().max(200)).default({}),
  notes: z.string().max(4000).nullable().optional(),
  products: z.string().max(500).nullable().optional(),
  durationMinutes: z.number().int().min(1).max(600).nullable().optional(),
  price: z.number().int().min(0).max(100_000_000).nullable().optional(),
  repeatOfVisitId: z.string().nullable().optional(),
  memberId: z.string().nullable().optional(),
};

clients.post('/:clientId/visits', salonAccess('floor'), async (c) => {
  const input = await body(c, z.object(visitFields));
  const { salon, memberId, role, kind } = c.get('access');
  const client = await loadClient(c, salon.id, c.req.param('clientId'));
  let stylist = memberId;
  if (input.memberId && input.memberId !== memberId) {
    // Front desk / managers may log a visit on behalf of another stylist.
    const canAssign = kind === 'user' && (role === 'owner' || role === 'manager');
    if (!canAssign) throw forbidden('You can only record your own visits.');
    if (!(await first(c.env.DB, 'SELECT 1 FROM members WHERE id = ? AND salon_id = ? AND active = 1', input.memberId, salon.id))) {
      throw notFound('Stylist');
    }
    stylist = input.memberId;
  }
  if (input.repeatOfVisitId) {
    const source = await first<{ id: string }>(
      c.env.DB,
      `SELECT v.id FROM visits v JOIN clients c ON c.id = v.client_id
       WHERE v.id = ? AND v.deleted_at IS NULL AND (v.client_id = ? OR (c.passport_id = ? AND EXISTS (
         SELECT 1 FROM passport_shares ps WHERE ps.passport_id = c.passport_id AND ps.salon_id = ? AND ps.revoked_at IS NULL)))`,
      input.repeatOfVisitId,
      client.id,
      client.passport_id,
      salon.id,
    );
    if (!source) throw notFound('Visit to repeat');
  }
  const t = now();
  // Attribution: was the client brought back by a reminder sent since their previous visit?
  const reminder = await first<{ id: string }>(
    c.env.DB,
    `SELECT id FROM messages WHERE client_id = ? AND kind = 'reminder' AND status = 'sent' AND created_at >= ? AND created_at > ?
     ORDER BY created_at DESC LIMIT 1`,
    client.id,
    t - 30 * DAY,
    client.last_visit_at ?? 0,
  );
  const id = newId('vis');
  await run(
    c.env.DB,
    `INSERT INTO visits (id, salon_id, client_id, member_id, service, style_tags, technique, notes, products, duration_minutes, price,
       repeat_of_visit_id, recovered_by_message_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    salon.id,
    client.id,
    stylist,
    input.service,
    JSON.stringify(input.styleTags),
    JSON.stringify(input.technique),
    input.notes ?? null,
    input.products ?? null,
    input.durationMinutes ?? null,
    input.price ?? null,
    input.repeatOfVisitId ?? null,
    reminder?.id ?? null,
    t,
  );
  await refreshClientSchedule(c.env.DB, client.id);
  const [visit] = await loadVisits(c.env.DB, 'v.id = ?', [id]);
  return c.json({ visit }, 201);
});

export const visits = new Hono<AppEnv>();

async function loadVisit(db: D1Database, salonId: string, visitId: string) {
  const visit = await first<VisitRow>(db, 'SELECT * FROM visits WHERE id = ? AND salon_id = ? AND deleted_at IS NULL', visitId, salonId);
  if (!visit) throw notFound('Visit');
  return visit;
}

const EDIT_WINDOW = 2 * DAY;

visits.patch('/:visitId', salonAccess('floor'), async (c) => {
  const input = await body(c, z.object(visitFields).omit({ repeatOfVisitId: true, memberId: true }).partial());
  const { salon, role, memberId, kind } = c.get('access');
  const visit = await loadVisit(c.env.DB, salon.id, c.req.param('visitId'));
  const isManager = kind === 'user' && (role === 'owner' || role === 'manager');
  if (!isManager && (visit.member_id !== memberId || now() - visit.created_at > EDIT_WINDOW)) {
    throw forbidden('Only a manager can edit this visit now.');
  }
  await run(
    c.env.DB,
    `UPDATE visits SET service = ?, style_tags = ?, technique = ?, notes = ?, products = ?, duration_minutes = ?, price = ? WHERE id = ?`,
    input.service ?? visit.service,
    input.styleTags ? JSON.stringify(input.styleTags) : visit.style_tags,
    input.technique ? JSON.stringify(input.technique) : visit.technique,
    input.notes === undefined ? visit.notes : input.notes,
    input.products === undefined ? visit.products : input.products,
    input.durationMinutes === undefined ? visit.duration_minutes : input.durationMinutes,
    input.price === undefined ? visit.price : input.price,
    visit.id,
  );
  await refreshClientSchedule(c.env.DB, visit.client_id);
  const [updated] = await loadVisits(c.env.DB, 'v.id = ?', [visit.id]);
  return c.json({ visit: updated });
});

visits.delete('/:visitId', salonAccess('manage'), async (c) => {
  const { salon } = c.get('access');
  const visit = await loadVisit(c.env.DB, salon.id, c.req.param('visitId'));
  const photos = await all<PhotoRow>(c.env.DB, 'SELECT * FROM photos WHERE visit_id = ?', visit.id);
  await purgePhotos(c.env.DB, c.env.MEDIA, photos);
  await run(c.env.DB, 'UPDATE visits SET deleted_at = ? WHERE id = ?', now(), visit.id);
  await refreshClientSchedule(c.env.DB, visit.client_id);
  await audit(c, { salonId: salon.id, action: 'visit.deleted', targetType: 'visit', targetId: visit.id });
  return c.json({ ok: true });
});

const ANGLES = ['front', 'left', 'right', 'back', 'detail'] as const;
const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
const CONTENT_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png' };

visits.put('/:visitId/photos/:angle', salonAccess('floor'), async (c) => {
  const angle = c.req.param('angle') as (typeof ANGLES)[number];
  if (!ANGLES.includes(angle)) throw badRequest('Unknown photo angle.');
  const { salon } = c.get('access');
  const visit = await loadVisit(c.env.DB, salon.id, c.req.param('visitId'));
  const client = await first<ClientRow>(c.env.DB, 'SELECT * FROM clients WHERE id = ?', visit.client_id);
  if (!client?.photo_consent_at) throw new ApiError(403, 'consent_required', 'Record the client’s photo consent before taking photos.');
  const contentType = (c.req.header('content-type') ?? '').split(';')[0].trim();
  const ext = CONTENT_TYPES[contentType];
  if (!ext) throw badRequest('Upload a JPEG, WebP or PNG image.');
  const declared = Number(c.req.header('content-length') ?? 0);
  if (declared > MAX_PHOTO_BYTES) throw new ApiError(413, 'too_large', 'Photo is too large (max 6 MB).');
  const bytes = await c.req.arrayBuffer();
  if (bytes.byteLength === 0) throw badRequest('Empty upload.');
  if (bytes.byteLength > MAX_PHOTO_BYTES) throw new ApiError(413, 'too_large', 'Photo is too large (max 6 MB).');

  if (angle !== 'detail') {
    const existing = await all<PhotoRow>(c.env.DB, 'SELECT * FROM photos WHERE visit_id = ? AND angle = ?', visit.id, angle);
    await purgePhotos(c.env.DB, c.env.MEDIA, existing);
  } else {
    const details = await first<{ n: number }>(c.env.DB, "SELECT COUNT(*) AS n FROM photos WHERE visit_id = ? AND angle = 'detail'", visit.id);
    if ((details?.n ?? 0) >= 4) throw badRequest('Up to 4 detail photos per visit.');
  }
  const id = newId('pho');
  const key = `salons/${salon.id}/visits/${visit.id}/${angle}-${id}.${ext}`;
  await c.env.MEDIA.put(key, bytes, { httpMetadata: { contentType } });
  const blurred = c.req.header('x-face-blurred') === '1' ? 1 : 0;
  await run(
    c.env.DB,
    'INSERT INTO photos (id, salon_id, visit_id, angle, r2_key, content_type, bytes, blurred, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    id,
    salon.id,
    visit.id,
    angle,
    key,
    contentType,
    bytes.byteLength,
    blurred,
    now(),
  );
  const photo = await first<PhotoRow>(c.env.DB, 'SELECT * FROM photos WHERE id = ?', id);
  return c.json({ photo: serializePhoto(photo!) }, 201);
});

visits.delete('/:visitId/photos/:photoId', salonAccess('floor'), async (c) => {
  const { salon } = c.get('access');
  const photo = await first<PhotoRow>(
    c.env.DB,
    'SELECT * FROM photos WHERE id = ? AND visit_id = ? AND salon_id = ?',
    c.req.param('photoId'),
    c.req.param('visitId'),
    salon.id,
  );
  if (!photo) throw notFound('Photo');
  await purgePhotos(c.env.DB, c.env.MEDIA, [photo]);
  return c.json({ ok: true });
});

export default clients;
