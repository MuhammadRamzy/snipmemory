import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv, BillItemRow, BillRow, Ctx, CustomerRow, StaffRow } from '../types';
import { audit } from '../lib/audit';
import { computeBill, type LineInput } from '../../../shared/billing';
import { newId, randomToken } from '../lib/crypto';
import { DAY, all, first, now } from '../lib/db';
import { addDays, dayOf, isDay } from '../lib/day';
import { ApiError, badRequest, body, forbidden, notFound, query } from '../lib/http';
import { assertBillQuota } from '../lib/plans';
import { serializeBill } from '../lib/serialize';
import { shopAccess } from '../lib/session';
import { findOrCreateCustomer } from './customers';

const bills = new Hono<AppEnv>();

const money = z.number().int().min(0).max(10_000_000_00);

const billSchema = z.object({
  clientRef: z.string().min(8).max(64),
  customerId: z.string().nullable().optional(),
  customerName: z.string().trim().max(60).nullable().optional(),
  customerPhone: z.string().trim().max(16).nullable().optional(),
  staffId: z.string().nullable().optional(),
  items: z
    .array(
      z.object({
        kind: z.enum(['service', 'product', 'custom']),
        refId: z.string().nullable().optional(),
        name: z.string().trim().min(1).max(80),
        qty: z.number().int().min(1).max(99),
        unitPrice: money,
        staffId: z.string().nullable().optional(),
      }),
    )
    .min(1, 'Add at least one service')
    .max(40),
  discount: money.default(0),
  payments: z.object({ cash: money.default(0), upi: money.default(0), card: money.default(0), advance: money.default(0) }),
  /** Old udhaar the customer clears together with this bill. */
  collectDue: z.object({ amount: money, mode: z.enum(['cash', 'upi', 'card']) }).nullable().optional(),
  note: z.string().max(300).nullable().optional(),
  queueId: z.string().nullable().optional(),
  /** Device time for bills made offline; accepted if within the last 3 days. */
  createdAt: z.number().int().optional(),
});

export async function loadBill(db: D1Database, shopId: string, where: string, ...params: unknown[]) {
  const bill = await first<BillRow & { staff_name: string | null }>(
    db,
    `SELECT b.*, s.name AS staff_name FROM bills b LEFT JOIN staff s ON s.id = b.staff_id WHERE b.shop_id = ? AND ${where}`,
    shopId,
    ...params,
  );
  if (!bill) return null;
  const items = await all<BillItemRow>(db, 'SELECT * FROM bill_items WHERE bill_id = ? ORDER BY rowid', bill.id);
  return { bill, items };
}

function canSeePhone(ctx: Ctx) {
  return ctx.isManager || Boolean(ctx.shop.staff_see_phone);
}

bills.post('/', shopAccess('any'), async (c) => {
  const input = await body(c, billSchema);
  const ctx = c.get('ctx');
  const db = c.env.DB;
  const shop = ctx.shop;

  // Offline retries send the same clientRef: return the bill that already exists.
  const existing = await loadBill(db, shop.id, 'b.client_ref = ?', input.clientRef);
  if (existing) return c.json({ bill: serializeBill(existing.bill, existing.items), duplicate: true });

  const t = now();
  const createdAt = input.createdAt && input.createdAt <= t && input.createdAt > t - 3 * DAY ? input.createdAt : t;
  const day = dayOf(shop.timezone, createdAt);
  await assertBillQuota(db, ctx, day);

  // Who did the work. The staff app always bills as the logged-in person.
  const team = await all<StaffRow>(db, 'SELECT * FROM staff WHERE shop_id = ?', shop.id);
  const byId = new Map(team.map((s) => [s.id, s]));
  const mainStaff = ctx.app === 'staff' ? ctx.me.id : (input.staffId ?? ctx.me.id);
  if (!byId.get(mainStaff)?.active) throw badRequest('Choose who did the service.');

  // Validate catalogue items and remember list prices (for the staff discount rule).
  const services = new Map((await all<{ id: string; price: number }>(db, 'SELECT id, price FROM services WHERE shop_id = ?', shop.id)).map((s) => [s.id, s]));
  const products = new Map(
    (await all<{ id: string; price: number; cost: number; name: string }>(db, 'SELECT id, price, cost, name FROM products WHERE shop_id = ?', shop.id)).map((p) => [p.id, p]),
  );
  let listTotal = 0;
  const lines: LineInput[] = input.items.map((item) => {
    let listPrice = item.unitPrice;
    if (item.kind === 'service') {
      const svc = item.refId ? services.get(item.refId) : undefined;
      if (!svc) throw badRequest(`"${item.name}" is not in your price list any more. Remove it and add again.`);
      listPrice = svc.price;
    } else if (item.kind === 'product') {
      const prod = item.refId ? products.get(item.refId) : undefined;
      if (!prod) throw badRequest(`Product "${item.name}" was removed. Remove it from the bill.`);
      listPrice = prod.price;
    }
    listTotal += listPrice * item.qty;
    const staffId = ctx.app === 'staff' ? ctx.me.id : (item.staffId ?? mainStaff);
    if (!byId.get(staffId)?.active) throw badRequest('Choose who did each service.');
    return { kind: item.kind, refId: item.refId ?? null, name: item.name, qty: item.qty, unitPrice: item.unitPrice, staffId };
  });

  const totals = computeBill(
    lines,
    input.discount,
    { enabled: Boolean(shop.gst_enabled), rate: shop.gst_rate, inclusive: Boolean(shop.gst_inclusive) },
    (id) => ({ service: byId.get(id)?.commission_pct ?? 0, product: byId.get(id)?.product_commission_pct ?? 0 }),
    (l) => (l.kind === 'product' && l.refId ? (products.get(l.refId)?.cost ?? 0) : 0),
  );

  // Staff can only lower prices within the owner's limit.
  if (ctx.app === 'staff') {
    const given = listTotal - (totals.subtotal - totals.discount);
    if (given > 0) {
      if (!shop.staff_can_discount) throw forbidden('Discounts need the owner’s approval. Ask the owner to bill this.');
      if (given * 100 > listTotal * shop.staff_max_discount) throw forbidden(`You can give up to ${shop.staff_max_discount}% discount.`);
    }
  }

  // Customer (optional for fully paid walk-ins).
  let customer: CustomerRow | null = null;
  if (input.customerId) {
    customer = await first<CustomerRow>(db, 'SELECT * FROM customers WHERE id = ? AND shop_id = ? AND deleted_at IS NULL', input.customerId, shop.id);
    if (!customer) throw notFound('Customer');
  } else if (input.customerPhone) {
    customer = await findOrCreateCustomer(db, shop.id, input.customerPhone, input.customerName ?? null);
  }

  const p = input.payments;
  const paid = p.cash + p.upi + p.card + p.advance;
  if (paid > totals.total) throw badRequest('Payment is more than the bill amount.');
  const due = totals.total - paid;
  if ((due > 0 || p.advance > 0) && !customer) throw badRequest('Add the customer’s mobile number to keep udhaar or use advance.');
  if (p.advance > 0 && p.advance > Math.max(0, customer!.balance)) throw badRequest('Customer does not have that much advance.');
  const oldDue = input.collectDue?.amount ?? 0;
  if (oldDue > 0 && (!customer || oldDue > -customer.balance)) throw badRequest('This is more than the old udhaar.');

  const id = newId('bil');
  const statements = [
    db.prepare('UPDATE shops SET next_bill_no = next_bill_no + 1 WHERE id = ?').bind(shop.id),
    db
      .prepare(
        `INSERT INTO bills (id, shop_id, bill_no, client_ref, public_token, customer_id, customer_name, customer_phone, staff_id, created_by,
           subtotal, discount, tax, total, paid_cash, paid_upi, paid_card, paid_advance, due, note, day, created_at)
         VALUES (?, ?, (SELECT next_bill_no - 1 FROM shops WHERE id = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        shop.id,
        shop.id,
        input.clientRef,
        randomToken(12),
        customer?.id ?? null,
        customer?.name ?? input.customerName ?? null,
        customer?.phone ?? null,
        mainStaff,
        ctx.me.id,
        totals.subtotal,
        totals.discount,
        totals.tax,
        totals.total,
        p.cash,
        p.upi,
        p.card,
        p.advance,
        due,
        input.note ?? null,
        day,
        createdAt,
      ),
    ...totals.lines.map((l) =>
      db
        .prepare(
          'INSERT INTO bill_items (id, bill_id, shop_id, kind, ref_id, name, qty, unit_price, amount, net, staff_id, commission, cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(newId('itm'), id, shop.id, l.kind, l.refId, l.name, l.qty, l.unitPrice, l.amount, l.net, l.staffId, l.commission, l.cost),
    ),
    ...totals.lines
      .filter((l) => l.kind === 'product' && l.refId)
      .map((l) => db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND shop_id = ?').bind(l.qty, l.refId, shop.id)),
  ];
  if (customer) {
    if (due > 0) {
      statements.push(
        db
          .prepare("INSERT INTO ledger (id, shop_id, customer_id, kind, amount, bill_id, staff_id, day, created_at) VALUES (?, ?, ?, 'bill_due', ?, ?, ?, ?, ?)")
          .bind(newId('led'), shop.id, customer.id, -due, id, ctx.me.id, day, createdAt),
      );
    }
    if (p.advance > 0) {
      statements.push(
        db
          .prepare("INSERT INTO ledger (id, shop_id, customer_id, kind, amount, bill_id, staff_id, day, created_at) VALUES (?, ?, ?, 'bill_advance_used', ?, ?, ?, ?, ?)")
          .bind(newId('led'), shop.id, customer.id, -p.advance, id, ctx.me.id, day, createdAt),
      );
    }
    if (oldDue > 0) {
      statements.push(
        db
          .prepare("INSERT INTO ledger (id, shop_id, customer_id, kind, amount, mode, bill_id, staff_id, note, day, created_at) VALUES (?, ?, ?, 'due_paid', ?, ?, ?, ?, ?, ?, ?)")
          .bind(newId('led'), shop.id, customer.id, oldDue, input.collectDue!.mode, id, ctx.me.id, 'Paid with bill', day, createdAt),
      );
    }
    statements.push(
      db
        .prepare(
          `UPDATE customers SET balance = balance - ?, visit_count = visit_count + 1, total_spend = total_spend + ?,
             last_visit_at = MAX(COALESCE(last_visit_at, 0), ?), updated_at = ? WHERE id = ?`,
        )
        .bind(due + p.advance - oldDue, totals.total, createdAt, t, customer.id),
    );
  }
  if (input.queueId) {
    statements.push(
      db.prepare("UPDATE queue SET status = 'done', bill_id = ?, done_at = ? WHERE id = ? AND shop_id = ?").bind(id, t, input.queueId, shop.id),
    );
  }

  try {
    await db.batch(statements);
  } catch (err) {
    // Two devices racing with the same clientRef: the other request won.
    const raced = await loadBill(db, shop.id, 'b.client_ref = ?', input.clientRef);
    if (raced) return c.json({ bill: serializeBill(raced.bill, raced.items), duplicate: true });
    throw err;
  }
  const saved = (await loadBill(db, shop.id, 'b.id = ?', id))!;
  return c.json({ bill: serializeBill(saved.bill, saved.items) }, 201);
});

const listQuery = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  staffId: z.string().optional(),
  mode: z.enum(['all', 'cash', 'upi', 'card', 'due', 'void']).default('all'),
  q: z.string().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

bills.get('/', shopAccess('any'), async (c) => {
  const ctx = c.get('ctx');
  const params = query(c, listQuery);
  const today = dayOf(ctx.shop.timezone);
  const from = isDay(params.from) ? params.from : today;
  const to = isDay(params.to) ? params.to : today;
  // Staff see their own bills for the last 62 days at most.
  const minDay = ctx.app === 'staff' ? addDays(today, -62) : '0000-00-00';
  const where = ['b.shop_id = ?', 'b.day >= ?', 'b.day <= ?'];
  const args: unknown[] = [ctx.shop.id, from < minDay ? minDay : from, to];
  if (ctx.app === 'staff') {
    where.push('(b.staff_id = ? OR b.created_by = ?)');
    args.push(ctx.me.id, ctx.me.id);
  } else if (params.staffId) {
    where.push('b.staff_id = ?');
    args.push(params.staffId);
  }
  if (params.mode === 'void') where.push('b.voided_at IS NOT NULL');
  else {
    where.push('b.voided_at IS NULL');
    if (params.mode === 'cash') where.push('b.paid_cash > 0');
    if (params.mode === 'upi') where.push('b.paid_upi > 0');
    if (params.mode === 'card') where.push('b.paid_card > 0');
    if (params.mode === 'due') where.push('b.due > 0');
  }
  if (params.q?.trim()) {
    const q = params.q.trim();
    where.push('(CAST(b.bill_no AS TEXT) = ? OR b.customer_name LIKE ? OR b.customer_phone LIKE ?)');
    args.push(q.replace(/\D/g, '') || '-1', `%${q}%`, `%${q.replace(/\D/g, '') || '~'}%`);
  }
  const rows = await all<BillRow & { staff_name: string | null }>(
    c.env.DB,
    `SELECT b.*, s.name AS staff_name FROM bills b LEFT JOIN staff s ON s.id = b.staff_id
     WHERE ${where.join(' AND ')} ORDER BY b.created_at DESC LIMIT ? OFFSET ?`,
    ...args,
    params.limit + 1,
    params.offset,
  );
  const page = rows.slice(0, params.limit);
  const items = page.length
    ? await all<BillItemRow>(c.env.DB, `SELECT * FROM bill_items WHERE bill_id IN (${page.map(() => '?').join(',')})`, ...page.map((b) => b.id))
    : [];
  const hide = !canSeePhone(ctx);
  return c.json({ bills: page.map((b) => serializeBill(b, items, hide)), hasMore: rows.length > params.limit, from, to });
});

bills.get('/:id', shopAccess('any'), async (c) => {
  const ctx = c.get('ctx');
  const found = await loadBill(c.env.DB, ctx.shop.id, 'b.id = ?', c.req.param('id'));
  if (!found) throw notFound('Bill');
  if (ctx.app === 'staff' && found.bill.staff_id !== ctx.me.id && found.bill.created_by !== ctx.me.id) throw notFound('Bill');
  return c.json({ bill: serializeBill(found.bill, found.items, !canSeePhone(ctx)) });
});

const STAFF_VOID_WINDOW = 15 * 60_000;

/** Cancel a bill: reverses udhaar/advance, customer totals and product stock. */
bills.post('/:id/void', shopAccess('any'), async (c) => {
  const input = await body(c, z.object({ reason: z.string().trim().min(2, 'Write a reason').max(200) }));
  const ctx = c.get('ctx');
  const db = c.env.DB;
  const found = await loadBill(db, ctx.shop.id, 'b.id = ?', c.req.param('id'));
  if (!found) throw notFound('Bill');
  const { bill, items } = found;
  if (bill.voided_at) throw new ApiError(409, 'already_void', 'This bill is already cancelled.');
  if (!ctx.isManager) {
    if (bill.staff_id !== ctx.me.id && bill.created_by !== ctx.me.id) throw notFound('Bill');
    if (bill.created_by !== ctx.me.id || now() - bill.created_at > STAFF_VOID_WINDOW) {
      throw forbidden('Only the owner can cancel this bill now.');
    }
  }
  const t = now();
  const day = dayOf(ctx.shop.timezone, t);
  const reversal = bill.due + bill.paid_advance;
  const statements = [
    db.prepare('UPDATE bills SET voided_at = ?, void_reason = ?, voided_by = ? WHERE id = ?').bind(t, input.reason, ctx.me.id, bill.id),
    ...items
      .filter((i) => i.kind === 'product' && i.ref_id)
      .map((i) => db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').bind(i.qty, i.ref_id)),
    db.prepare("UPDATE queue SET status = 'waiting', bill_id = NULL, done_at = NULL WHERE bill_id = ?").bind(bill.id),
  ];
  if (bill.customer_id) {
    if (reversal > 0) {
      statements.push(
        db
          .prepare("INSERT INTO ledger (id, shop_id, customer_id, kind, amount, bill_id, staff_id, note, day, created_at) VALUES (?, ?, ?, 'void_reversal', ?, ?, ?, ?, ?, ?)")
          .bind(newId('led'), ctx.shop.id, bill.customer_id, reversal, bill.id, ctx.me.id, `Bill #${bill.bill_no} cancelled`, day, t),
      );
    }
    statements.push(
      db
        .prepare('UPDATE customers SET balance = balance + ?, visit_count = MAX(0, visit_count - 1), total_spend = MAX(0, total_spend - ?), updated_at = ? WHERE id = ?')
        .bind(reversal, bill.total, t, bill.customer_id),
    );
  }
  await db.batch(statements);
  await audit(c, { action: 'bill.voided', targetId: bill.id, meta: { billNo: bill.bill_no, total: bill.total, reason: input.reason } });
  const updated = (await loadBill(db, ctx.shop.id, 'b.id = ?', bill.id))!;
  return c.json({ bill: serializeBill(updated.bill, updated.items) });
});

export default bills;
