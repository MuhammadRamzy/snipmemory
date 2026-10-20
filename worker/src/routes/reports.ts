import { Hono } from 'hono';
import type { AppEnv, BillRow } from '../types';
import { all, count, first } from '../lib/db';
import { addDays, dayOf, isDay } from '../lib/day';
import { badRequest } from '../lib/http';
import { has, requireCap } from '../lib/plans';
import { shopAccess } from '../lib/session';

const reports = new Hono<AppEnv>();

function range(c: { req: { query: (k: string) => string | undefined } }, today: string) {
  const from = isDay(c.req.query('from')) ? c.req.query('from')! : today;
  const to = isDay(c.req.query('to')) ? c.req.query('to')! : today;
  if (from > to) throw badRequest('Start date is after end date.');
  if (addDays(from, 400) < to) throw badRequest('Choose a range of up to 1 year.');
  return { from, to };
}

reports.get('/', shopAccess('manager'), async (c) => {
  const ctx = c.get('ctx');
  const db = c.env.DB;
  const today = dayOf(ctx.shop.timezone);
  const { from, to } = range(c, today);
  // Free plan: today and yesterday only.
  if (!has(ctx, 'reports') && from < addDays(today, -1)) requireCap(ctx, 'reports');
  const id = ctx.shop.id;
  const [sales, items, ledgerIn, expenses, byStaff, byService, daily, customers, newCustomers, staffPaid] = await Promise.all([
    first<{ bills: number; total: number; discount: number; tax: number; cash: number; upi: number; card: number; advance: number; due: number; voids: number }>(
      db,
      `SELECT COUNT(CASE WHEN voided_at IS NULL THEN 1 END) AS bills,
         COALESCE(SUM(CASE WHEN voided_at IS NULL THEN total END), 0) AS total,
         COALESCE(SUM(CASE WHEN voided_at IS NULL THEN discount END), 0) AS discount,
         COALESCE(SUM(CASE WHEN voided_at IS NULL THEN tax END), 0) AS tax,
         COALESCE(SUM(CASE WHEN voided_at IS NULL THEN paid_cash END), 0) AS cash,
         COALESCE(SUM(CASE WHEN voided_at IS NULL THEN paid_upi END), 0) AS upi,
         COALESCE(SUM(CASE WHEN voided_at IS NULL THEN paid_card END), 0) AS card,
         COALESCE(SUM(CASE WHEN voided_at IS NULL THEN paid_advance END), 0) AS advance,
         COALESCE(SUM(CASE WHEN voided_at IS NULL THEN due END), 0) AS due,
         COUNT(CASE WHEN voided_at IS NOT NULL THEN 1 END) AS voids
       FROM bills WHERE shop_id = ? AND day BETWEEN ? AND ?`,
      id,
      from,
      to,
    ),
    first<{ services: number; products: number; commission: number; cost: number }>(
      db,
      `SELECT COALESCE(SUM(CASE WHEN i.kind != 'product' THEN i.net END), 0) AS services,
         COALESCE(SUM(CASE WHEN i.kind = 'product' THEN i.net END), 0) AS products,
         COALESCE(SUM(i.commission), 0) AS commission, COALESCE(SUM(i.cost), 0) AS cost
       FROM bill_items i JOIN bills b ON b.id = i.bill_id WHERE b.shop_id = ? AND b.day BETWEEN ? AND ? AND b.voided_at IS NULL`,
      id,
      from,
      to,
    ),
    first<{ due_cash: number; due_online: number; adv_cash: number; adv_online: number }>(
      db,
      `SELECT COALESCE(SUM(CASE WHEN kind = 'due_paid' AND mode = 'cash' THEN amount END), 0) AS due_cash,
         COALESCE(SUM(CASE WHEN kind = 'due_paid' AND mode != 'cash' THEN amount END), 0) AS due_online,
         COALESCE(SUM(CASE WHEN kind = 'advance_added' AND mode = 'cash' THEN amount END), 0) AS adv_cash,
         COALESCE(SUM(CASE WHEN kind = 'advance_added' AND mode != 'cash' THEN amount END), 0) AS adv_online
       FROM ledger WHERE shop_id = ? AND day BETWEEN ? AND ?`,
      id,
      from,
      to,
    ),
    all<{ category: string; amount: number }>(
      db,
      'SELECT category, SUM(amount) AS amount FROM expenses WHERE shop_id = ? AND day BETWEEN ? AND ? AND deleted_at IS NULL GROUP BY category ORDER BY amount DESC',
      id,
      from,
      to,
    ),
    all<{ id: string; name: string; color: string; bills: number; services: number; sales: number; commission: number }>(
      db,
      `SELECT s.id, s.name, s.color, COUNT(DISTINCT b.id) AS bills, COALESCE(SUM(CASE WHEN i.kind != 'product' THEN i.qty END), 0) AS services,
         COALESCE(SUM(i.net), 0) AS sales, COALESCE(SUM(i.commission), 0) AS commission
       FROM bill_items i JOIN bills b ON b.id = i.bill_id JOIN staff s ON s.id = i.staff_id
       WHERE b.shop_id = ? AND b.day BETWEEN ? AND ? AND b.voided_at IS NULL GROUP BY s.id ORDER BY sales DESC`,
      id,
      from,
      to,
    ),
    all<{ name: string; kind: string; qty: number; sales: number }>(
      db,
      `SELECT i.name, i.kind, SUM(i.qty) AS qty, SUM(i.net) AS sales FROM bill_items i JOIN bills b ON b.id = i.bill_id
       WHERE b.shop_id = ? AND b.day BETWEEN ? AND ? AND b.voided_at IS NULL GROUP BY i.name, i.kind ORDER BY sales DESC LIMIT 30`,
      id,
      from,
      to,
    ),
    all<{ day: string; bills: number; total: number }>(
      db,
      'SELECT day, COUNT(*) AS bills, SUM(total) AS total FROM bills WHERE shop_id = ? AND day BETWEEN ? AND ? AND voided_at IS NULL GROUP BY day ORDER BY day',
      id,
      from,
      to,
    ),
    count(db, 'SELECT COUNT(DISTINCT customer_id) AS n FROM bills WHERE shop_id = ? AND day BETWEEN ? AND ? AND voided_at IS NULL', id, from, to),
    count(db, 'SELECT COUNT(*) AS n FROM customers WHERE shop_id = ? AND deleted_at IS NULL AND created_at >= ? AND created_at < ?', id, Date.parse(`${from}T00:00:00+05:30`), Date.parse(`${addDays(to, 1)}T00:00:00+05:30`)),
    first<{ salary_paid: number }>(
      db,
      "SELECT COALESCE(SUM(CASE WHEN kind IN ('advance', 'payout', 'bonus') THEN amount END), 0) AS salary_paid FROM staff_txns WHERE shop_id = ? AND day BETWEEN ? AND ? AND deleted_at IS NULL",
      id,
      from,
      to,
    ),
  ]);
  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const net = (sales?.total ?? 0) - (sales?.tax ?? 0);
  return c.json({
    from,
    to,
    sales: { ...sales, services: items?.services ?? 0, products: items?.products ?? 0 },
    collected: ledgerIn,
    money: {
      // Money that actually came in during the period
      cashIn: (sales?.cash ?? 0) + (ledgerIn?.due_cash ?? 0) + (ledgerIn?.adv_cash ?? 0),
      onlineIn: (sales?.upi ?? 0) + (sales?.card ?? 0) + (ledgerIn?.due_online ?? 0) + (ledgerIn?.adv_online ?? 0),
    },
    expenses: { total: expenseTotal, byCategory: expenses },
    staffCost: { commission: items?.commission ?? 0, paidToStaff: staffPaid?.salary_paid ?? 0 },
    productCost: items?.cost ?? 0,
    // Estimate: sales without GST − expenses − commission − product cost. Fixed salaries appear when paid (in expenses if recorded there).
    profit: net - expenseTotal - (items?.commission ?? 0) - (items?.cost ?? 0),
    customers: { served: customers, new: newCustomers },
    byStaff,
    byService,
    daily,
  });
});

reports.get('/bills.csv', shopAccess('manager'), async (c) => {
  const ctx = c.get('ctx');
  requireCap(ctx, 'export');
  const { from, to } = range(c, dayOf(ctx.shop.timezone));
  const rows = await all<BillRow & { staff_name: string; items: string }>(
    c.env.DB,
    `SELECT b.*, s.name AS staff_name, (SELECT GROUP_CONCAT(i.name || ' x' || i.qty, '; ') FROM bill_items i WHERE i.bill_id = b.id) AS items
     FROM bills b JOIN staff s ON s.id = b.staff_id WHERE b.shop_id = ? AND b.day BETWEEN ? AND ? ORDER BY b.created_at`,
    ctx.shop.id,
    from,
    to,
  );
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const r = (p: number) => (p / 100).toFixed(2);
  const lines = [
    'date,bill_no,customer,phone,staff,items,subtotal,discount,gst,total,cash,upi,card,advance_used,udhaar,status',
    ...rows.map((b) =>
      [b.day, `${ctx.shop.bill_prefix}${b.bill_no}`, b.customer_name, b.customer_phone, b.staff_name, b.items, r(b.subtotal), r(b.discount), r(b.tax), r(b.total), r(b.paid_cash), r(b.paid_upi), r(b.paid_card), r(b.paid_advance), r(b.due), b.voided_at ? 'cancelled' : 'ok']
        .map(esc)
        .join(','),
    ),
  ];
  return new Response(`﻿${lines.join('\n')}`, {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="bills-${from}-to-${to}.csv"` },
  });
});

export default reports;
