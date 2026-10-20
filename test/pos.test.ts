import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { computeBill } from '../shared/billing';
import { OWNER_PIN, Device, addBarber, clientRef, newShop, phone, svc } from './helpers';

const noGst = { enabled: false, rate: 18, inclusive: true };
const flat = (pct: number) => () => ({ service: pct, product: 10 });

describe('bill maths', () => {
  it('spreads discount across lines and pays commission on the discounted amount', () => {
    const t = computeBill(
      [
        { kind: 'service', refId: 'a', name: 'Haircut', qty: 1, unitPrice: 10000, staffId: 's1' },
        { kind: 'service', refId: 'b', name: 'Shave', qty: 1, unitPrice: 5000, staffId: 's1' },
      ],
      3000,
      noGst,
      flat(40),
    );
    expect(t.subtotal).toBe(15000);
    expect(t.total).toBe(12000);
    expect(t.lines.map((l) => l.net)).toEqual([8000, 4000]);
    expect(t.lines.map((l) => l.commission)).toEqual([3200, 1600]);
  });

  it('handles GST inclusive and exclusive', () => {
    const line = [{ kind: 'service' as const, refId: 'a', name: 'Facial', qty: 1, unitPrice: 118000, staffId: 's' }];
    const inc = computeBill(line, 0, { enabled: true, rate: 18, inclusive: true }, flat(10));
    expect(inc.total).toBe(118000);
    expect(inc.tax).toBe(18000);
    expect(inc.lines[0].commission).toBe(10000); // 10% of the pre-GST ₹1000
    const exc = computeBill(line, 0, { enabled: true, rate: 18, inclusive: false }, flat(10));
    expect(exc.total).toBe(139240);
    expect(exc.tax).toBe(21240);
  });

  it('never lets discount exceed the subtotal', () => {
    const t = computeBill([{ kind: 'custom', refId: null, name: 'X', qty: 2, unitPrice: 5000, staffId: 's' }], 999999, noGst, flat(0));
    expect(t.total).toBe(0);
    expect(t.discount).toBe(10000);
  });
});

describe('signup & login', () => {
  it('creates a shop on a 30-day Pro trial with a starter price list', async () => {
    const { me, catalog } = await newShop();
    expect(me.shop.name).toBe('Style Point');
    expect(me.plan.id).toBe('pro');
    expect(me.shop.trial).toBe(true);
    expect(me.me.role).toBe('owner');
    expect(catalog.services.find((s: any) => s.name === 'Haircut').price).toBe(10000);
  });

  it('rejects weak PINs and wrong PINs; separates owner and staff apps', async () => {
    const weak = await new Device().post('/api/auth/signup', { name: 'Abdul', phone: phone(), pin: '123456', shopName: 'X Salon' });
    expect(weak.status).toBe(400);

    const { owner, ownerPhone } = await newShop();
    const d = new Device('owner');
    expect((await d.post('/api/auth/login', { phone: ownerPhone, pin: '000111', app: 'owner' })).status).toBe(401);
    expect((await d.post('/api/auth/login', { phone: ownerPhone, pin: OWNER_PIN, app: 'owner' })).status).toBe(200);

    const barber = await addBarber(owner);
    const wrongApp = new Device('owner');
    const res = await wrongApp.post('/api/auth/login', { phone: barber.phone, pin: '4826', app: 'owner' });
    expect(res.status).toBe(403);
    expect(res.data.error.code).toBe('use_staff_app');
    // The staff app can't reach owner-only data.
    expect((await barber.device.get('/api/shop/home')).status).toBe(403);
    expect((await barber.device.get('/api/shop/reports')).status).toBe(403);
    expect((await barber.device.get('/api/shop/me/home')).status).toBe(200);
  });

  it('keeps shops apart', async () => {
    const a = await newShop();
    const b = await newShop();
    const bill = await a.owner.post('/api/shop/bills', { clientRef: clientRef(), items: [svc(a.catalog, 'Haircut')], payments: { cash: 10000 } });
    expect((await b.owner.get(`/api/shop/bills/${bill.data.bill.id}`)).status).toBe(404);
    expect((await b.owner.get('/api/shop/bills')).data.bills).toHaveLength(0);
  });
});

describe('billing', () => {
  it('bills a walk-in with UPI and cash split, numbers bills and is idempotent for offline retries', async () => {
    const { owner, catalog } = await newShop();
    const ref = clientRef();
    const payload = { clientRef: ref, items: [svc(catalog, 'Haircut'), svc(catalog, 'Shave')], payments: { cash: 5000, upi: 10000 } };
    const first = await owner.post('/api/shop/bills', payload);
    expect(first.status).toBe(201);
    expect(first.data.bill.billNo).toBe(1);
    expect(first.data.bill.total).toBe(15000);
    const again = await owner.post('/api/shop/bills', payload);
    expect(again.data.duplicate).toBe(true);
    expect(again.data.bill.id).toBe(first.data.bill.id);
    const second = await owner.post('/api/shop/bills', { ...payload, clientRef: clientRef() });
    expect(second.data.bill.billNo).toBe(2);

    // Overpayment is refused (change is handled on the phone, not recorded).
    expect((await owner.post('/api/shop/bills', { ...payload, clientRef: clientRef(), payments: { cash: 20000 } })).status).toBe(400);

    const pub = await new Device().get(`/api/public/bills/${first.data.bill.token}`);
    expect(pub.data.bill.total).toBe(15000);
    expect(pub.data.shop.name).toBe('Style Point');
  });

  it('keeps udhaar on the customer khata and collects it later', async () => {
    const { owner, catalog } = await newShop();
    // Udhaar without a customer is refused.
    expect((await owner.post('/api/shop/bills', { clientRef: clientRef(), items: [svc(catalog, 'Haircut')], payments: { cash: 4000 } })).status).toBe(400);
    const custPhone = phone();
    const bill = await owner.post('/api/shop/bills', {
      clientRef: clientRef(),
      customerPhone: custPhone,
      customerName: 'Anil',
      items: [svc(catalog, 'Haircut')],
      payments: { cash: 4000 },
    });
    expect(bill.data.bill.due).toBe(6000);
    const list = await owner.get('/api/shop/customers?filter=due');
    expect(list.data.customers[0].balance).toBe(-6000);
    expect(list.data.totals.due).toBe(6000);
    const id = list.data.customers[0].id;
    expect((await owner.post(`/api/shop/customers/${id}/ledger`, { kind: 'due_paid', amount: 9000, mode: 'upi' })).status).toBe(400);
    // Clear part of the old udhaar while paying for today's cut.
    const withDue = await owner.post('/api/shop/bills', {
      clientRef: clientRef(),
      customerId: id,
      items: [svc(catalog, 'Shave')],
      payments: { upi: 5000 },
      collectDue: { amount: 2000, mode: 'upi' },
    });
    expect(withDue.status).toBe(201);
    expect((await owner.get(`/api/shop/customers/${id}`)).data.customer.balance).toBe(-4000);
    const paid = await owner.post(`/api/shop/customers/${id}/ledger`, { kind: 'due_paid', amount: 4000, mode: 'upi' });
    expect(paid.data.customer.balance).toBe(0);

    // Advance, then use it on the next bill.
    await owner.post(`/api/shop/customers/${id}/ledger`, { kind: 'advance_added', amount: 50000, mode: 'cash' });
    const next = await owner.post('/api/shop/bills', { clientRef: clientRef(), customerId: id, items: [svc(catalog, 'Haircut')], payments: { advance: 10000 } });
    expect(next.status).toBe(201);
    const detail = await owner.get(`/api/shop/customers/${id}`);
    expect(detail.data.customer.balance).toBe(40000);
    expect(detail.data.customer.visitCount).toBe(3);
    expect(detail.data.ledger.length).toBeGreaterThanOrEqual(4);
  });

  it('cancelling a bill reverses udhaar, stock and visits', async () => {
    const { owner, catalog } = await newShop();
    await owner.post('/api/shop/products', { name: 'Hair gel', price: 15000, cost: 9000, stock: 5 });
    const products = (await owner.get('/api/shop/catalog')).data.products;
    const gel = products[0];
    const bill = await owner.post('/api/shop/bills', {
      clientRef: clientRef(),
      customerPhone: phone(),
      items: [svc(catalog, 'Haircut'), { kind: 'product', refId: gel.id, name: gel.name, qty: 2, unitPrice: gel.price }],
      payments: { upi: 20000 },
    });
    expect(bill.data.bill.due).toBe(20000);
    expect((await owner.get('/api/shop/catalog')).data.products[0].stock).toBe(3);
    const voided = await owner.post(`/api/shop/bills/${bill.data.bill.id}/void`, { reason: 'Wrong entry' });
    expect(voided.data.bill.voided).toBe(true);
    expect((await owner.get('/api/shop/catalog')).data.products[0].stock).toBe(5);
    const cust = await owner.get(`/api/shop/customers/${bill.data.bill.customerId}`);
    expect(cust.data.customer.balance).toBe(0);
    expect(cust.data.customer.visitCount).toBe(0);
    expect((await owner.post(`/api/shop/bills/${bill.data.bill.id}/void`, { reason: 'again' })).status).toBe(409);
  });

  it('staff bill as themselves, within the discount limit, and see only their own bills', async () => {
    const { owner, catalog } = await newShop();
    await owner.patch('/api/shop/settings', { staffMaxDiscount: 10, staffSeePhone: false });
    const a = await addBarber(owner, { name: 'Suresh', commissionPct: 40 });
    const b = await addBarber(owner, { name: 'Vinod', commissionPct: 50 });
    const haircut = svc(catalog, 'Haircut');

    // Trying to credit someone else is ignored: the bill is Suresh's.
    const ok = await a.device.post('/api/shop/bills', { clientRef: clientRef(), staffId: b.id, items: [{ ...haircut, staffId: b.id }], discount: 1000, payments: { upi: 9000 } });
    expect(ok.status).toBe(201);
    expect(ok.data.bill.staffId).toBe(a.id);
    expect(ok.data.bill.items[0].commission).toBe(3600);

    // 30% off is above the 10% limit; so is quietly lowering the price.
    expect((await a.device.post('/api/shop/bills', { clientRef: clientRef(), items: [haircut], discount: 3000, payments: { cash: 7000 } })).status).toBe(403);
    expect((await a.device.post('/api/shop/bills', { clientRef: clientRef(), items: [{ ...haircut, unitPrice: 5000 }], payments: { cash: 5000 } })).status).toBe(403);

    await b.device.post('/api/shop/bills', { clientRef: clientRef(), items: [haircut], payments: { cash: 10000 } });
    expect((await a.device.get('/api/shop/bills')).data.bills).toHaveLength(1);
    expect((await b.device.get(`/api/shop/bills/${ok.data.bill.id}`)).status).toBe(404);
    expect((await owner.get('/api/shop/bills')).data.bills).toHaveLength(2);

    // Staff can cancel their own fresh bill, not someone else's.
    expect((await b.device.post(`/api/shop/bills/${ok.data.bill.id}/void`, { reason: 'mistake' })).status).toBe(404);
    expect((await a.device.post(`/api/shop/bills/${ok.data.bill.id}/void`, { reason: 'mistake' })).status).toBe(200);

    // Phone numbers hidden from staff when the owner says so.
    await a.device.post('/api/shop/bills', { clientRef: clientRef(), customerPhone: phone(), customerName: 'Raj', items: [haircut], payments: { cash: 10000 } });
    const custs = await a.device.get('/api/shop/customers');
    expect(custs.data.customers[0].phone).toMatch(/^••••••\d{4}$/);
  });
});

describe('owner views', () => {
  it('shows barber-wise sales, payroll and reports', async () => {
    const { owner, catalog } = await newShop();
    const a = await addBarber(owner, { name: 'Suresh', commissionPct: 40 });
    for (let i = 0; i < 3; i++) await a.device.post('/api/shop/bills', { clientRef: clientRef(), items: [svc(catalog, 'Haircut')], payments: { cash: 10000 } });
    await owner.post('/api/shop/bills', { clientRef: clientRef(), items: [svc(catalog, 'Facial')], payments: { upi: 60000 } });
    await owner.post('/api/shop/expenses', { category: 'Tea & snacks', amount: 5000, mode: 'cash' });

    const home = await owner.get('/api/shop/home');
    expect(home.data.today.sales).toBe(90000);
    expect(home.data.today.cash).toBe(30000);
    expect(home.data.today.upi).toBe(60000);
    expect(home.data.byStaff.find((s: any) => s.name === 'Suresh')).toMatchObject({ bills: 3, sales: 30000, commission: 12000 });

    await owner.post(`/api/shop/staff/${a.id}/txns`, { kind: 'advance', amount: 5000, mode: 'cash' });
    const pay = await owner.get(`/api/shop/staff/${a.id}/summary`);
    expect(pay.data.summary).toMatchObject({ bills: 3, commission: 12000, advance: 5000, balance: 7000 });
    const mine = await a.device.get('/api/shop/me/summary');
    expect(mine.data.summary.balance).toBe(7000);

    const report = await owner.get('/api/shop/reports');
    expect(report.data.sales.total).toBe(90000);
    expect(report.data.expenses.total).toBe(5000);
    expect(report.data.profit).toBe(90000 - 5000 - 12000);
    expect(report.data.byService[0].name).toBe('Facial');

    // Cash closing: 30000 cash sales − 5000 tea − 5000 advance = 20000 expected.
    const closing = await owner.get('/api/shop/closing');
    expect(closing.data.expected).toBe(20000);
    const closed = await owner.post('/api/shop/closing', { day: closing.data.day, countedCash: 19500 });
    expect(closed.data.difference).toBe(-500);
  });

  it('enforces Free-plan limits after the trial', async () => {
    const { owner, catalog } = await newShop();
    const shopId = (await owner.get('/api/auth/me')).data.shop.id;
    await env.DB.prepare('UPDATE shops SET plan_expires_at = ? WHERE id = ?').bind(Date.now() - 1000, shopId).run();
    const me = await owner.get('/api/auth/me');
    expect(me.data.plan.id).toBe('free');
    // Free: owner + 1 barber.
    await addBarber(owner);
    expect((await owner.post('/api/shop/staff', { name: 'Third', phone: phone(), pin: '4826' })).status).toBe(402);
    // Reports beyond yesterday need a paid plan.
    expect((await owner.get('/api/shop/reports?from=2026-01-01&to=2026-01-31')).status).toBe(402);
    expect((await owner.get('/api/shop/reports')).status).toBe(200);
    // 300 bills a month.
    const day = me.data.shop && (await owner.get('/api/shop/home')).data.day;
    const stmt = env.DB.prepare(
      "INSERT INTO bills (id, shop_id, bill_no, client_ref, public_token, staff_id, created_by, subtotal, total, day, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, 0)",
    );
    const staffId = me.data.me.id;
    await env.DB.batch(Array.from({ length: 300 }, (_, i) => stmt.bind(`b${i}${shopId}`, shopId, 1000 + i, `r${i}`, `t${i}${shopId}`, staffId, staffId, day)));
    const blocked = await owner.post('/api/shop/bills', { clientRef: clientRef(), items: [svc(catalog, 'Haircut')], payments: { cash: 10000 } });
    expect(blocked.status).toBe(402);
    expect(blocked.data.error.code).toBe('bill_limit');
  });
});

describe('subscription by UPI + admin', () => {
  it('owner submits a UTR; admin approves and the plan is extended', async () => {
    const { owner } = await newShop();
    const sub = await owner.get('/api/shop/subscription');
    expect(sub.data.pay.vpa).toContain('@');
    expect((await owner.post('/api/shop/subscription', { planId: 'starter', period: 'year', utr: '12' })).status).toBe(422);
    const utr = `${Date.now()}12`.slice(0, 12);
    expect((await owner.post('/api/shop/subscription', { planId: 'starter', period: 'year', utr })).status).toBe(201);
    expect((await owner.post('/api/shop/subscription', { planId: 'starter', period: 'year', utr })).status).toBe(409);

    // Create an admin directly (production does this with scripts/create-admin.mjs).
    const adminPhone = phone();
    const { hashSecret } = await import('../worker/src/lib/crypto');
    await env.DB.prepare("INSERT INTO users (id, phone, name, pin_hash, password_hash, is_platform_admin, created_at) VALUES (?, ?, 'Ops', 'x', ?, 1, 0)")
      .bind(`usr_admin${adminPhone}`, `+91${adminPhone}`, await hashSecret('a-long-admin-password'))
      .run();
    const adm = new Device('admin');
    expect((await adm.get('/api/admin/metrics')).status).toBe(401);
    expect((await adm.post('/api/admin/login', { phone: adminPhone, password: 'a-long-admin-password' })).status).toBe(200);
    const pending = await adm.get('/api/admin/payments?status=pending');
    const p = pending.data.payments.find((x: any) => x.utr === utr);
    expect(p).toBeTruthy();
    expect((await adm.post(`/api/admin/payments/${p.id}/approve`, {})).status).toBe(200);
    const me = await owner.get('/api/auth/me');
    expect(me.data.plan.id).toBe('starter');
    expect(me.data.shop.trial).toBe(false);
    expect(me.data.shop.planExpiresAt).toBeGreaterThan(Date.now() + 360 * 86_400_000);

    // A regular owner can't reach admin.
    expect((await new Device('admin').get('/api/admin/shops')).status).toBe(401);

    // Support PIN reset gives a temporary PIN the owner must change.
    const reset = await adm.post(`/api/admin/shops/${me.data.shop.id}/reset-owner-pin`, {});
    const relog = new Device('owner');
    expect((await relog.post('/api/auth/login', { phone: me.data.user.phone, pin: reset.data.tempPin, app: 'owner' })).status).toBe(200);
    expect((await relog.get('/api/auth/me')).data.user.mustChangePin).toBe(true);
    expect((await relog.post('/api/auth/pin', { currentPin: reset.data.tempPin, newPin: '739182' })).status).toBe(200);
  });
});

describe('queue', () => {
  it('gives tokens and closes them when the bill is made', async () => {
    const { owner, catalog } = await newShop();
    const t1 = await owner.post('/api/shop/queue', { name: 'Walk-in 1' });
    const t2 = await owner.post('/api/shop/queue', { name: 'Walk-in 2' });
    expect([t1.data.item.token, t2.data.item.token]).toEqual([1, 2]);
    const barber = await addBarber(owner);
    const started = await barber.device.patch(`/api/shop/queue/${t1.data.item.id}`, { status: 'serving' });
    expect(started.data.item.staffId).toBe(barber.id);
    await barber.device.post('/api/shop/bills', { clientRef: clientRef(), queueId: t1.data.item.id, items: [svc(catalog, 'Haircut')], payments: { cash: 10000 } });
    const q = await owner.get('/api/shop/queue');
    expect(q.data.items.map((i: any) => i.token)).toEqual([2]);
    expect(q.data.doneToday).toBe(1);
  });
});
