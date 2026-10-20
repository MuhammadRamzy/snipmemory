import { Hono } from 'hono';
import type { AppEnv, BillItemRow, BillRow, ShopRow } from '../types';
import { all, first, now } from '../lib/db';
import { notFound } from '../lib/http';
import { splitGst } from '../lib/billing';
import { plansPublic } from './auth';

const publicApi = new Hono<AppEnv>();

/** Digital bill the customer opens from WhatsApp. Anyone with the link can view it. */
publicApi.get('/bills/:token', async (c) => {
  const bill = await first<BillRow & { staff_name: string }>(
    c.env.DB,
    'SELECT b.*, s.name AS staff_name FROM bills b JOIN staff s ON s.id = b.staff_id WHERE b.public_token = ?',
    c.req.param('token'),
  );
  if (!bill) throw notFound('Bill');
  const shop = await first<ShopRow>(c.env.DB, 'SELECT * FROM shops WHERE id = ?', bill.shop_id);
  if (!shop) throw notFound('Bill');
  const items = await all<BillItemRow>(c.env.DB, 'SELECT * FROM bill_items WHERE bill_id = ? ORDER BY rowid', bill.id);
  const balance = bill.customer_id
    ? await first<{ balance: number }>(c.env.DB, 'SELECT balance FROM customers WHERE id = ?', bill.customer_id)
    : null;
  return c.json({
    shop: {
      name: shop.name,
      address: [shop.address, shop.city, shop.state].filter(Boolean).join(', '),
      phone: shop.phone,
      gstin: shop.gst_enabled ? shop.gstin : null,
      upiVpa: shop.upi_vpa,
      upiName: shop.upi_name || shop.name,
      footer: shop.bill_footer,
    },
    bill: {
      number: `${shop.bill_prefix}${bill.bill_no}`,
      date: bill.created_at,
      customerName: bill.customer_name,
      staffName: bill.staff_name,
      items: items.map((i) => ({ name: i.name, qty: i.qty, unitPrice: i.unit_price, amount: i.amount })),
      subtotal: bill.subtotal,
      discount: bill.discount,
      tax: bill.tax,
      gst: bill.tax ? { rate: shop.gst_rate, ...splitGst(bill.tax) } : null,
      total: bill.total,
      paid: { cash: bill.paid_cash, upi: bill.paid_upi, card: bill.paid_card, advance: bill.paid_advance },
      due: bill.due,
      cancelled: Boolean(bill.voided_at),
    },
    customerBalance: balance?.balance ?? null,
  });
});

publicApi.get('/plans', async (c) => c.json({ plans: await plansPublic(c.env.DB) }));

publicApi.get('/announcements', async (c) => {
  const rows = await all<{ id: string; message: string; level: string }>(
    c.env.DB,
    'SELECT id, message, level FROM announcements WHERE active = 1 AND (expires_at IS NULL OR expires_at > ?) ORDER BY created_at DESC LIMIT 3',
    now(),
  );
  return c.json({ announcements: rows });
});

publicApi.get('/support', (c) => c.json({ whatsapp: c.env.SUPPORT_WHATSAPP }));

export default publicApi;
