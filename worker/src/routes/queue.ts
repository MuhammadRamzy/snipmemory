import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../types';
import { newId } from '../lib/crypto';
import { all, first, now, run } from '../lib/db';
import { dayOf } from '../lib/day';
import { badRequest, body, notFound } from '../lib/http';
import { normalizePhone } from '../lib/phone';
import { requireCap } from '../lib/plans';
import { shopAccess } from '../lib/session';

/** Walk-in tokens ("next please") and simple same-day / future appointments. */
const queue = new Hono<AppEnv>();

interface QueueRow {
  id: string;
  token: number;
  day: string;
  customer_id: string | null;
  name: string;
  phone: string | null;
  staff_id: string | null;
  note: string | null;
  scheduled_at: number | null;
  status: string;
  bill_id: string | null;
  created_at: number;
  started_at: number | null;
}

const serialize = (r: QueueRow) => ({
  id: r.id,
  token: r.token,
  day: r.day,
  customerId: r.customer_id,
  name: r.name,
  phone: r.phone,
  staffId: r.staff_id,
  note: r.note,
  scheduledAt: r.scheduled_at,
  status: r.status,
  billId: r.bill_id,
  createdAt: r.created_at,
  startedAt: r.started_at,
});

queue.get('/', shopAccess('any'), async (c) => {
  const ctx = c.get('ctx');
  requireCap(ctx, 'queue');
  const today = dayOf(ctx.shop.timezone);
  const rows = await all<QueueRow>(
    c.env.DB,
    `SELECT * FROM queue WHERE shop_id = ? AND ((day = ? AND status IN ('waiting', 'serving')) OR (day > ? AND status = 'waiting'))
     ORDER BY day, CASE status WHEN 'serving' THEN 0 ELSE 1 END, COALESCE(scheduled_at, created_at)`,
    ctx.shop.id,
    today,
    today,
  );
  const done = await first<{ n: number }>(c.env.DB, "SELECT COUNT(*) AS n FROM queue WHERE shop_id = ? AND day = ? AND status = 'done'", ctx.shop.id, today);
  return c.json({ day: today, items: rows.map(serialize), doneToday: done?.n ?? 0 });
});

queue.post('/', shopAccess('any'), async (c) => {
  const input = await body(
    c,
    z.object({
      name: z.string().trim().min(1, 'Enter name').max(60),
      phone: z.string().trim().max(16).nullable().optional(),
      customerId: z.string().nullable().optional(),
      staffId: z.string().nullable().optional(),
      note: z.string().max(200).nullable().optional(),
      scheduledAt: z.number().int().nullable().optional(),
    }),
  );
  const ctx = c.get('ctx');
  requireCap(ctx, 'queue');
  const phone = input.phone?.trim() ? normalizePhone(input.phone, 'IN') : null;
  if (input.phone?.trim() && !phone) throw badRequest('Enter a valid mobile number.');
  const day = dayOf(ctx.shop.timezone, input.scheduledAt ?? now());
  if (day < dayOf(ctx.shop.timezone)) throw badRequest('Choose a time today or later.');
  const id = newId('que');
  await run(
    c.env.DB,
    `INSERT INTO queue (id, shop_id, token, day, customer_id, name, phone, staff_id, note, scheduled_at, created_at)
     VALUES (?, ?, (SELECT COALESCE(MAX(token), 0) + 1 FROM queue WHERE shop_id = ? AND day = ?), ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    ctx.shop.id,
    ctx.shop.id,
    day,
    day,
    input.customerId ?? null,
    input.name,
    phone,
    input.staffId ?? null,
    input.note ?? null,
    input.scheduledAt ?? null,
    now(),
  );
  const row = await first<QueueRow>(c.env.DB, 'SELECT * FROM queue WHERE id = ?', id);
  return c.json({ item: serialize(row!) }, 201);
});

queue.patch('/:id', shopAccess('any'), async (c) => {
  const input = await body(c, z.object({ status: z.enum(['waiting', 'serving', 'done', 'cancelled']).optional(), staffId: z.string().nullable().optional() }));
  const ctx = c.get('ctx');
  const row = await first<QueueRow>(c.env.DB, 'SELECT * FROM queue WHERE id = ? AND shop_id = ?', c.req.param('id'), ctx.shop.id);
  if (!row) throw notFound('Token');
  // A barber who starts a customer takes them.
  const staffId = input.status === 'serving' && ctx.app === 'staff' ? ctx.me.id : input.staffId === undefined ? row.staff_id : input.staffId;
  await run(
    c.env.DB,
    'UPDATE queue SET status = ?, staff_id = ?, started_at = CASE WHEN ? = \'serving\' THEN ? ELSE started_at END, done_at = CASE WHEN ? IN (\'done\', \'cancelled\') THEN ? ELSE done_at END WHERE id = ?',
    input.status ?? row.status,
    staffId,
    input.status ?? '',
    now(),
    input.status ?? '',
    now(),
    row.id,
  );
  const updated = await first<QueueRow>(c.env.DB, 'SELECT * FROM queue WHERE id = ?', row.id);
  return c.json({ item: serialize(updated!) });
});

export default queue;
