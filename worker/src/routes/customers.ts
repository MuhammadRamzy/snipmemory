import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv, BillItemRow, BillRow, CustomerRow } from '../types';
import { audit } from '../lib/audit';
import { newId } from '../lib/crypto';
import { DAY, all, first, now, run } from '../lib/db';
import { dayOf } from '../lib/day';
import { ApiError, badRequest, body, conflict, forbidden, notFound, query } from '../lib/http';
import { normalizePhone } from '../lib/phone';
import { requireCap } from '../lib/plans';
import { serializeBill, serializeCustomer } from '../lib/serialize';
import { shopAccess } from '../lib/session';

const customers = new Hono<AppEnv>();

function phoneOrNull(input: string | null | undefined): string | null {
  if (!input?.trim()) return null;
  const phone = normalizePhone(input, 'IN');
  if (!phone || (phone.startsWith('+91') && phone.length !== 13)) throw badRequest('Enter a valid 10-digit mobile number.');
  return phone;
}

export async function findOrCreateCustomer(db: D1Database, shopId: string, rawPhone: string, name: string | null): Promise<CustomerRow> {
  const phone = phoneOrNull(rawPhone)!;
  const existing = await first<CustomerRow>(db, 'SELECT * FROM customers WHERE shop_id = ? AND phone = ? AND deleted_at IS NULL', shopId, phone);
  if (existing) {
    if (name && existing.name === 'Customer') await run(db, 'UPDATE customers SET name = ? WHERE id = ?', name, existing.id);
    return existing;
  }
  const id = newId('cus');
  const t = now();
  await run(
    db,
    'INSERT INTO customers (id, shop_id, name, phone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING',
    id,
    shopId,
    name?.trim() || 'Customer',
    phone,
    t,
    t,
  );
  return (await first<CustomerRow>(db, 'SELECT * FROM customers WHERE shop_id = ? AND phone = ? AND deleted_at IS NULL', shopId, phone))!;
}

const listQuery = z.object({
  q: z.string().max(60).optional(),
  filter: z.enum(['all', 'due', 'advance', 'winback', 'birthday', 'regulars']).default('all'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

customers.get('/', shopAccess('any'), async (c) => {
  const ctx = c.get('ctx');
  const { q, filter, limit, offset } = query(c, listQuery);
  const where = ['shop_id = ?', 'deleted_at IS NULL'];
  const args: unknown[] = [ctx.shop.id];
  if (q?.trim()) {
    const digits = q.replace(/\D/g, '');
    if (digits.length >= 3) {
      where.push('(phone LIKE ? OR name LIKE ?)');
      args.push(`%${digits}%`, `%${q.trim()}%`);
    } else {
      where.push('name LIKE ?');
      args.push(`%${q.trim()}%`);
    }
  }
  let order = 'COALESCE(last_visit_at, created_at) DESC';
  if (filter === 'due') {
    where.push('balance < 0');
    order = 'balance ASC';
  } else if (filter === 'advance') {
    where.push('balance > 0');
    order = 'balance DESC';
  } else if (filter === 'winback') {
    where.push('last_visit_at < ? AND last_visit_at > ? AND phone IS NOT NULL');
    args.push(now() - ctx.shop.winback_days * DAY, now() - 365 * DAY);
    order = 'last_visit_at DESC';
  } else if (filter === 'birthday') {
    const today = dayOf(ctx.shop.timezone).slice(5);
    const week = Array.from({ length: 7 }, (_, i) => dayOf(ctx.shop.timezone, now() + i * DAY).slice(5));
    where.push(`birthday IN (${week.map(() => '?').join(',')})`);
    args.push(...week);
    order = `CASE WHEN birthday = '${today}' THEN 0 ELSE 1 END, birthday`;
  } else if (filter === 'regulars') {
    order = 'visit_count DESC';
  }
  const rows = await all<CustomerRow>(c.env.DB, `SELECT * FROM customers WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?`, ...args, limit + 1, offset);
  const hide = !ctx.isManager && !ctx.shop.staff_see_phone;
  const totals = await first<{ due: number | null; advance: number | null }>(
    c.env.DB,
    'SELECT -SUM(CASE WHEN balance < 0 THEN balance END) AS due, SUM(CASE WHEN balance > 0 THEN balance END) AS advance FROM customers WHERE shop_id = ? AND deleted_at IS NULL',
    ctx.shop.id,
  );
  return c.json({
    customers: rows.slice(0, limit).map((r) => serializeCustomer(r, hide)),
    hasMore: rows.length > limit,
    totals: { due: totals?.due ?? 0, advance: totals?.advance ?? 0 },
  });
});

/** Billing screen: type a number, get the customer back (or nothing). */
customers.get('/lookup', shopAccess('any'), async (c) => {
  const ctx = c.get('ctx');
  const raw = c.req.query('phone') ?? '';
  const phone = normalizePhone(raw, 'IN');
  if (!phone || phone.length < 13) return c.json({ customer: null });
  const row = await first<CustomerRow>(c.env.DB, 'SELECT * FROM customers WHERE shop_id = ? AND phone = ? AND deleted_at IS NULL', ctx.shop.id, phone);
  return c.json({ customer: row ? serializeCustomer(row) : null });
});

const fields = {
  name: z.string().trim().min(1, 'Enter name').max(60),
  phone: z.string().trim().max(16).nullable().optional(),
  gender: z.enum(['male', 'female', 'other']).nullable().optional(),
  birthday: z.string().regex(/^\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
};

customers.post('/', shopAccess('any'), async (c) => {
  const input = await body(c, z.object(fields));
  const ctx = c.get('ctx');
  const phone = phoneOrNull(input.phone);
  if (phone) {
    const dup = await first<CustomerRow>(c.env.DB, 'SELECT * FROM customers WHERE shop_id = ? AND phone = ? AND deleted_at IS NULL', ctx.shop.id, phone);
    if (dup) return c.json({ error: { code: 'exists', message: `${dup.name} already has this number.` }, customer: serializeCustomer(dup) }, 409);
  }
  const id = newId('cus');
  const t = now();
  await run(
    c.env.DB,
    'INSERT INTO customers (id, shop_id, name, phone, gender, birthday, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    id,
    ctx.shop.id,
    input.name,
    phone,
    input.gender ?? null,
    input.birthday ?? null,
    input.notes ?? null,
    t,
    t,
  );
  const row = await first<CustomerRow>(c.env.DB, 'SELECT * FROM customers WHERE id = ?', id);
  return c.json({ customer: serializeCustomer(row!) }, 201);
});

async function loadCustomer(db: D1Database, shopId: string, id: string) {
  const row = await first<CustomerRow>(db, 'SELECT * FROM customers WHERE id = ? AND shop_id = ? AND deleted_at IS NULL', id, shopId);
  if (!row) throw notFound('Customer');
  return row;
}

customers.get('/:id', shopAccess('any'), async (c) => {
  const ctx = c.get('ctx');
  const db = c.env.DB;
  const customer = await loadCustomer(db, ctx.shop.id, c.req.param('id'));
  const bills = await all<BillRow & { staff_name: string | null }>(
    db,
    'SELECT b.*, s.name AS staff_name FROM bills b LEFT JOIN staff s ON s.id = b.staff_id WHERE b.customer_id = ? ORDER BY b.created_at DESC LIMIT 50',
    customer.id,
  );
  const items = bills.length
    ? await all<BillItemRow>(db, `SELECT * FROM bill_items WHERE bill_id IN (${bills.map(() => '?').join(',')})`, ...bills.map((b) => b.id))
    : [];
  const ledger = await all<{ id: string; kind: string; amount: number; mode: string | null; note: string | null; bill_id: string | null; created_at: number }>(
    db,
    'SELECT id, kind, amount, mode, note, bill_id, created_at FROM ledger WHERE customer_id = ? ORDER BY created_at DESC LIMIT 50',
    customer.id,
  );
  const photos = await all<{ id: string; note: string | null; created_at: number }>(
    db,
    'SELECT id, note, created_at FROM photos WHERE customer_id = ? ORDER BY created_at DESC LIMIT 30',
    customer.id,
  );
  const hide = !ctx.isManager && !ctx.shop.staff_see_phone;
  return c.json({
    customer: serializeCustomer(customer, hide),
    bills: bills.map((b) => serializeBill(b, items, hide)),
    ledger: ledger.map((l) => ({ id: l.id, kind: l.kind, amount: l.amount, mode: l.mode, note: l.note, billId: l.bill_id, createdAt: l.created_at })),
    photos: photos.map((p) => ({ id: p.id, note: p.note, url: `/api/media/${p.id}`, createdAt: p.created_at })),
  });
});

customers.patch('/:id', shopAccess('any'), async (c) => {
  const input = await body(c, z.object(fields).partial());
  const ctx = c.get('ctx');
  const customer = await loadCustomer(c.env.DB, ctx.shop.id, c.req.param('id'));
  let phone = customer.phone;
  if (input.phone !== undefined && (ctx.isManager || ctx.shop.staff_see_phone)) {
    phone = phoneOrNull(input.phone);
    if (phone && phone !== customer.phone && (await first(c.env.DB, 'SELECT 1 FROM customers WHERE shop_id = ? AND phone = ? AND deleted_at IS NULL', ctx.shop.id, phone))) {
      throw conflict('Another customer already has this number.');
    }
  }
  await run(
    c.env.DB,
    'UPDATE customers SET name = ?, phone = ?, gender = ?, birthday = ?, notes = ?, updated_at = ? WHERE id = ?',
    input.name ?? customer.name,
    phone,
    input.gender === undefined ? customer.gender : input.gender,
    input.birthday === undefined ? customer.birthday : input.birthday,
    input.notes === undefined ? customer.notes : input.notes,
    now(),
    customer.id,
  );
  return c.json({ customer: serializeCustomer(await loadCustomer(c.env.DB, ctx.shop.id, customer.id)) });
});

customers.delete('/:id', shopAccess('manager'), async (c) => {
  const ctx = c.get('ctx');
  const customer = await loadCustomer(c.env.DB, ctx.shop.id, c.req.param('id'));
  if (customer.balance !== 0) throw badRequest('Settle this customer’s udhaar/advance before deleting.');
  const photos = await all<{ id: string; r2_key: string }>(c.env.DB, 'SELECT id, r2_key FROM photos WHERE customer_id = ?', customer.id);
  if (photos.length) await c.env.MEDIA.delete(photos.map((p) => p.r2_key));
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM photos WHERE customer_id = ?').bind(customer.id),
    c.env.DB.prepare("UPDATE customers SET name = 'Deleted customer', phone = NULL, notes = NULL, birthday = NULL, deleted_at = ? WHERE id = ?").bind(now(), customer.id),
  ]);
  await audit(c, { action: 'customer.deleted', targetId: customer.id });
  return c.json({ ok: true });
});

/** Khata: collect udhaar, take advance, or (owner) adjust. */
customers.post('/:id/ledger', shopAccess('any'), async (c) => {
  const input = await body(
    c,
    z.object({
      kind: z.enum(['due_paid', 'advance_added', 'adjust']),
      amount: z.number().int().min(1).max(10_000_000_00),
      mode: z.enum(['cash', 'upi', 'card']).default('cash'),
      direction: z.enum(['add', 'reduce']).default('add'),
      note: z.string().max(200).nullable().optional(),
    }),
  );
  const ctx = c.get('ctx');
  if (input.kind === 'adjust' && !ctx.isManager) throw forbidden('Only the owner can adjust a balance.');
  const customer = await loadCustomer(c.env.DB, ctx.shop.id, c.req.param('id'));
  if (input.kind === 'due_paid' && input.amount > -customer.balance) throw badRequest('This is more than the udhaar amount. Use “Add advance” for extra money.');
  const signed = input.kind === 'adjust' && input.direction === 'reduce' ? -input.amount : input.amount;
  const t = now();
  await c.env.DB.batch([
    c.env.DB
      .prepare('INSERT INTO ledger (id, shop_id, customer_id, kind, amount, mode, staff_id, note, day, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(newId('led'), ctx.shop.id, customer.id, input.kind, signed, input.kind === 'adjust' ? null : input.mode, ctx.me.id, input.note ?? null, dayOf(ctx.shop.timezone, t), t),
    c.env.DB.prepare('UPDATE customers SET balance = balance + ?, updated_at = ? WHERE id = ?').bind(signed, t, customer.id),
  ]);
  if (input.kind === 'adjust') await audit(c, { action: 'customer.balance_adjusted', targetId: customer.id, meta: { amount: signed, note: input.note } });
  return c.json({ customer: serializeCustomer(await loadCustomer(c.env.DB, ctx.shop.id, customer.id)) });
});

// ---------------------------------------------------------------------------
// Cut photos (Pro): remember how the cut looked.
// ---------------------------------------------------------------------------
const MAX_PHOTO = 4 * 1024 * 1024;

function safeNote(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    return decodeURIComponent(raw).slice(0, 200);
  } catch {
    return null;
  }
}

customers.post('/:id/photos', shopAccess('any'), async (c) => {
  const ctx = c.get('ctx');
  requireCap(ctx, 'photos');
  const customer = await loadCustomer(c.env.DB, ctx.shop.id, c.req.param('id'));
  const type = (c.req.header('content-type') ?? '').split(';')[0];
  if (!['image/jpeg', 'image/webp', 'image/png'].includes(type)) throw badRequest('Upload a photo (JPEG/PNG/WebP).');
  const bytes = await c.req.arrayBuffer();
  if (!bytes.byteLength) throw badRequest('Empty photo.');
  if (bytes.byteLength > MAX_PHOTO) throw new ApiError(413, 'too_large', 'Photo is too large.');
  const id = newId('pho');
  const key = `shops/${ctx.shop.id}/customers/${customer.id}/${id}`;
  await c.env.MEDIA.put(key, bytes, { httpMetadata: { contentType: type } });
  await run(
    c.env.DB,
    'INSERT INTO photos (id, shop_id, customer_id, bill_id, r2_key, bytes, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    id,
    ctx.shop.id,
    customer.id,
    c.req.header('x-bill-id') ?? null,
    key,
    bytes.byteLength,
    safeNote(c.req.header('x-note')),
    now(),
  );
  return c.json({ photo: { id, url: `/api/media/${id}` } }, 201);
});

customers.delete('/:id/photos/:photoId', shopAccess('any'), async (c) => {
  const ctx = c.get('ctx');
  const photo = await first<{ id: string; r2_key: string }>(
    c.env.DB,
    'SELECT id, r2_key FROM photos WHERE id = ? AND customer_id = ? AND shop_id = ?',
    c.req.param('photoId'),
    c.req.param('id'),
    ctx.shop.id,
  );
  if (!photo) throw notFound('Photo');
  await c.env.MEDIA.delete(photo.r2_key);
  await run(c.env.DB, 'DELETE FROM photos WHERE id = ?', photo.id);
  return c.json({ ok: true });
});

export default customers;
