import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { cadenceDays, dispatchReminders } from '../worker/src/lib/reminders';
import { verifyStripeSignature } from '../worker/src/lib/stripe';
import { hmacSha256 } from '../worker/src/lib/crypto';
import { normalizePhone } from '../worker/src/lib/phone';
import { runMaintenance } from '../worker/src/lib/maintenance';
import { Browser, JPEG, signup } from './helpers';

const DAY = 86_400_000;

describe('unit helpers', () => {
  it('learns a client’s return cycle from their visit history', () => {
    const start = Date.UTC(2026, 0, 1);
    expect(cadenceDays([start], null, 28)).toBe(28);
    expect(cadenceDays([start, start + 21 * DAY, start + 42 * DAY, start + 64 * DAY], null, 28)).toBe(21);
    expect(cadenceDays([start, start + 21 * DAY, start + 42 * DAY], 35, 28)).toBe(35);
    // a same-week touch-up is ignored
    expect(cadenceDays([start, start + 2 * DAY, start + 30 * DAY, start + 60 * DAY], null, 28)).toBe(29);
  });

  it('normalises international numbers', () => {
    expect(normalizePhone('07700 900123', 'GB')).toBe('+447700900123');
    expect(normalizePhone('+1 (415) 555-0100', 'IN')).toBe('+14155550100');
    expect(normalizePhone('00971 50 123 4567', 'US')).toBe('+971501234567');
    expect(normalizePhone('919847012345', 'IN')).toBe('+919847012345');
    expect(normalizePhone('12', 'IN')).toBeNull();
  });

  it('verifies Stripe webhook signatures', async () => {
    const payload = '{"id":"evt_1"}';
    const t = Math.floor(Date.now() / 1000);
    const sig = await hmacSha256('whsec_test', `${t}.${payload}`);
    expect(await verifyStripeSignature(payload, `t=${t},v1=${sig}`, 'whsec_test')).toBe(true);
    expect(await verifyStripeSignature(payload, `t=${t},v1=${sig}`, 'whsec_other')).toBe(false);
    expect(await verifyStripeSignature(payload, `t=${t - 1000},v1=${sig}`, 'whsec_test')).toBe(false);
  });
});

describe('style passport', () => {
  it('lets a client sign in, see history across salons and share it with a new salon', async () => {
    const a = await signup({ salonName: 'Salon A' });
    const phone = '9847055555';
    const clientA = await a.browser.post(`/api/salons/${a.salonId}/clients`, { name: 'Neha', phone, photoConsent: true });
    const visit = await a.browser.post(`/api/salons/${a.salonId}/clients/${clientA.data.client.id}/visits`, {
      service: 'Long layers',
      technique: { length: 'Remove 2 inches', layers: 'Face-framing from chin' },
    });
    const photo = await a.browser.put(`/api/salons/${a.salonId}/visits/${visit.data.visit.id}/photos/back`, JPEG, { 'content-type': 'image/jpeg' });

    // Client signs in to their passport.
    const client = new Browser();
    const req = await client.post('/api/passport/login/request', { phone, country: 'IN' });
    expect(req.data.devCode).toMatch(/^\d{6}$/);
    expect((await client.post('/api/passport/login/verify', { phone, country: 'IN', code: '000000' === req.data.devCode ? '111111' : '000000' })).status).toBe(400);
    expect((await client.post('/api/passport/login/verify', { phone, country: 'IN', code: req.data.devCode })).status).toBe(200);
    const me = await client.get('/api/passport/me');
    expect(me.data.salons).toHaveLength(1);
    expect(me.data.visits[0].salonName).toBe('Salon A');
    expect((await client.get(photo.data.photo.url)).status).toBe(200);

    // A new salon adds the same person and asks for their history.
    const b = await signup({ salonName: 'Salon B' });
    const clientB = await b.browser.post(`/api/salons/${b.salonId}/clients`, { name: 'Neha K', phone: '+919847055555' });
    const before = await b.browser.get(`/api/salons/${b.salonId}/clients/${clientB.data.client.id}`);
    expect(before.data.passport.otherSalonsWithHistory).toBe(1);
    expect(before.data.passport.visits).toHaveLength(0);
    expect((await b.browser.get(photo.data.photo.url)).status).toBe(404);

    const shareReq = await b.browser.post(`/api/salons/${b.salonId}/clients/${clientB.data.client.id}/passport/request`);
    expect(shareReq.status).toBe(200);
    const granted = await b.browser.post(`/api/salons/${b.salonId}/clients/${clientB.data.client.id}/passport/verify`, { code: shareReq.data.devCode });
    expect(granted.status).toBe(200);
    const after = await b.browser.get(`/api/salons/${b.salonId}/clients/${clientB.data.client.id}`);
    expect(after.data.passport.shared).toBe(true);
    expect(after.data.passport.visits[0].technique.layers).toBe('Face-framing from chin');
    expect((await b.browser.get(photo.data.photo.url)).status).toBe(200);

    // B can repeat A's cut.
    const repeat = await b.browser.post(`/api/salons/${b.salonId}/clients/${clientB.data.client.id}/visits`, { service: 'Long layers', repeatOfVisitId: visit.data.visit.id });
    expect(repeat.status).toBe(201);

    // The client revokes access.
    expect((await client.del(`/api/passport/shares/${b.salonId}`)).status).toBe(200);
    expect((await b.browser.get(photo.data.photo.url)).status).toBe(404);

    // ...and turns off reminders from salon A.
    await client.post(`/api/passport/salons/${a.salonId}/reminders`, { enabled: false });
    expect((await a.browser.get(`/api/salons/${a.salonId}/clients/${clientA.data.client.id}`)).data.client.optedOut).toBe(true);
  });

  it('does not text unknown numbers', async () => {
    const res = await new Browser().post('/api/passport/login/request', { phone: '9999911111', country: 'IN' });
    expect(res.status).toBe(200);
    expect(res.data.devCode).toBeUndefined();
  });
});

describe('reminders', () => {
  it('sends due reminders inside the send window, spends credits and attributes the comeback visit', async () => {
    const { browser, salonId } = await signup();
    await browser.patch(`/api/salons/${salonId}`, { sendWindowStart: 0, sendWindowEnd: 24 });
    const consenting = await browser.post(`/api/salons/${salonId}/clients`, { name: 'Kiran Das', phone: '9000000010', marketingConsent: true });
    const silent = await browser.post(`/api/salons/${salonId}/clients`, { name: 'No Consent', phone: '9000000011' });
    for (const c of [consenting, silent]) {
      await browser.post(`/api/salons/${salonId}/clients/${c.data.client.id}/visits`, { service: 'Fade', price: 30000 });
    }
    // Pretend the visits happened 40 days ago.
    await env.DB.prepare('UPDATE visits SET created_at = created_at - ? WHERE salon_id = ?').bind(40 * DAY, salonId).run();
    await env.DB.prepare('UPDATE clients SET last_visit_at = last_visit_at - ?, next_reminder_at = next_reminder_at - ? WHERE salon_id = ?')
      .bind(40 * DAY, 40 * DAY, salonId)
      .run();

    const queue = await browser.get(`/api/salons/${salonId}/reminders`);
    expect(queue.data.due).toHaveLength(2);
    expect(queue.data.due[0].whatsappUrl).toMatch(/^https:\/\/wa\.me\/91900000001\d\?text=/);
    expect(queue.data.due[0].message).toContain('40 days');

    const stats = await dispatchReminders(env);
    expect(stats.sent).toBe(1);
    const salon = await browser.get(`/api/salons/${salonId}`);
    expect(salon.data.salon.messageCredits).toBe(49);

    // The client comes back: the visit is credited to the reminder.
    await browser.post(`/api/salons/${salonId}/clients/${consenting.data.client.id}/visits`, { service: 'Fade', price: 30000 });
    const dash = await browser.get(`/api/salons/${salonId}/dashboard`);
    expect(dash.data.recoveredVisits30d).toBe(1);
    expect(dash.data.recoveredRevenue30d).toBe(30000);

    // Manual click-to-send for the non-consenting client is free and logged.
    const manual = await browser.post(`/api/salons/${salonId}/reminders/${silent.data.client.id}/manual`);
    expect(manual.data.whatsappUrl).toContain('wa.me');
    expect((await browser.get(`/api/salons/${salonId}/reminders`)).data.due).toHaveLength(0);
  });

  it('honours one-click unsubscribe links', async () => {
    const { browser, salonId } = await signup();
    const c = await browser.post(`/api/salons/${salonId}/clients`, { name: 'Stop Me', phone: '9000000020', marketingConsent: true });
    const row = await env.DB.prepare('SELECT unsubscribe_token FROM clients WHERE id = ?').bind(c.data.client.id).first<{ unsubscribe_token: string }>();
    const anon = new Browser();
    const page = await anon.get(`/u/${row!.unsubscribe_token}`);
    expect(page.data).toContain('Stop reminders?');
    await anon.post(`/u/${row!.unsubscribe_token}`);
    expect((await browser.get(`/api/salons/${salonId}/clients/${c.data.client.id}`)).data.client.optedOut).toBe(true);
  });
});

describe('plans & billing', () => {
  it('falls back to Free after the trial and enforces Free limits without deleting data', async () => {
    const { browser, salonId } = await signup();
    await env.DB.prepare('UPDATE salons SET trial_ends_at = ? WHERE id = ?').bind(Date.now() - 1000, salonId).run();
    await runMaintenance(env);
    const salon = await browser.get(`/api/salons/${salonId}`);
    expect(salon.data.salon.planId).toBe('free');
    expect(salon.data.plan.maxClients).toBe(75);

    // Free has a single stylist (the owner).
    expect((await browser.post(`/api/salons/${salonId}/team`, { displayName: 'Extra' })).status).toBe(402);
    // Automated reminders are a paid capability.
    const c = await browser.post(`/api/salons/${salonId}/clients`, { name: 'A', phone: '9000000030', marketingConsent: true });
    expect((await browser.post(`/api/salons/${salonId}/reminders/${c.data.client.id}/send`)).status).toBe(402);

    // Upgrading (dev billing mode) restores capabilities.
    const checkout = await browser.post(`/api/salons/${salonId}/billing/checkout`, { planId: 'solo', interval: 'month' });
    expect(checkout.data.activated).toBe(true);
    const billing = await browser.get(`/api/salons/${salonId}/billing`);
    expect(billing.data.payments[0].amount).toBe(29900);
    expect(billing.data.payments[0].currency).toBe('INR');
    expect((await browser.get(`/api/salons/${salonId}`)).data.salon.messageCredits).toBe(100);
  });

  it('stops at the client limit on Free', async () => {
    const { browser, salonId } = await signup();
    await env.DB.prepare("UPDATE salons SET plan_id = 'free', subscription_status = 'active' WHERE id = ?").bind(salonId).run();
    const stmt = env.DB.prepare(
      "INSERT INTO clients (id, salon_id, name, phone, unsubscribe_token, created_at, updated_at) VALUES (?, ?, 'Bulk', ?, ?, 0, 0)",
    );
    await env.DB.batch(Array.from({ length: 75 }, (_, i) => stmt.bind(`cli_bulk${i}_${salonId}`, salonId, `+9170000${String(i).padStart(5, '0')}`, `tok${i}${salonId}`)));
    const res = await browser.post(`/api/salons/${salonId}/clients`, { name: 'One too many', phone: '9000000099' });
    expect(res.status).toBe(402);
  });
});

describe('platform admin', () => {
  it('is restricted to platform admins and supports audited impersonation', async () => {
    const regular = await signup();
    expect((await regular.browser.get('/api/admin/metrics')).status).toBe(403);

    const { browser: adm } = await signup({ email: 'admin@snipmemory.app', salonName: 'HQ' });
    const metrics = await adm.get('/api/admin/metrics');
    expect(metrics.status).toBe(200);
    expect(metrics.data.salons.total).toBeGreaterThanOrEqual(2);

    const list = await adm.get(`/api/admin/salons?q=${encodeURIComponent('Fade Lab')}`);
    expect(list.data.salons.some((s: { id: string }) => s.id === regular.salonId)).toBe(true);

    await adm.patch(`/api/admin/salons/${regular.salonId}`, { addCredits: 500, extendTrialDays: 7 });
    expect((await regular.browser.get(`/api/salons/${regular.salonId}`)).data.salon.bonusCredits).toBe(500);

    expect((await adm.post(`/api/admin/salons/${regular.salonId}/impersonate`, { reason: 'x' })).status).toBe(422);
    expect((await adm.post(`/api/admin/salons/${regular.salonId}/impersonate`, { reason: 'Owner asked for help with reminders' })).status).toBe(200);
    const me = await adm.get('/api/auth/me');
    expect(me.data.impersonating.salonId).toBe(regular.salonId);
    expect((await adm.get(`/api/salons/${regular.salonId}/clients`)).status).toBe(200);
    // No admin powers while impersonating.
    expect((await adm.get('/api/admin/metrics')).status).toBe(403);

    const back = await adm.post('/api/auth/impersonation/stop');
    expect(back.data.user.isPlatformAdmin).toBe(true);
    const auditLog = await adm.get(`/api/admin/audit?salonId=${regular.salonId}`);
    const actions = auditLog.data.entries.map((e: { action: string }) => e.action);
    expect(actions).toContain('admin.impersonation_started');
    expect(actions).toContain('admin.impersonation_ended');
  });
});
