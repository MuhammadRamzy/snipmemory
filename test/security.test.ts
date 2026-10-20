import { describe, expect, it } from 'vitest';
import { Device, addBarber, clientRef, newShop, svc } from './helpers';

describe('security', () => {
  it('locks a number after repeated wrong PINs, also through the signup path', async () => {
    const { ownerPhone } = await newShop();
    const attacker = new Device('owner');
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) codes.push((await attacker.post('/api/auth/login', { phone: ownerPhone, pin: `5${String(i).padStart(5, '0')}`, app: 'owner' })).status);
    expect(codes.slice(0, 6).every((s) => s === 401)).toBe(true);
    expect(codes[6]).toBe(429);
    // Same number via signup is limited by the same counter.
    const viaSignup = await new Device('owner').post('/api/auth/signup', { name: 'Evil', phone: ownerPhone, pin: '583920', shopName: 'Fake' });
    expect(viaSignup.status).toBe(429);
  });

  it('blocks cross-site writes', async () => {
    const d = new Device('owner');
    const res = await d.request('POST', '/api/auth/login', { phone: '9000000000', pin: '1234', app: 'owner' }, { origin: 'https://evil.example' });
    expect(res.status).toBe(403);
  });

  it('public bill link shows the bill but no khata balance or phone', async () => {
    const { owner, catalog } = await newShop();
    const bill = await owner.post('/api/shop/bills', { clientRef: clientRef(), customerPhone: '9123456780', customerName: 'Ravi', items: [svc(catalog, 'Haircut')], payments: { cash: 4000 } });
    const pub = await new Device().get(`/api/public/bills/${bill.data.bill.token}`);
    expect(pub.status).toBe(200);
    expect(JSON.stringify(pub.data)).not.toContain('9123456780');
    expect(pub.data.customerBalance).toBeUndefined();
    expect((await new Device().get('/api/public/bills/not-a-real-token')).status).toBe(404);
  });

  it('staff cannot touch owner-only APIs or other shops', async () => {
    const { owner } = await newShop();
    const barber = await addBarber(owner);
    for (const [method, path, body] of [
      ['GET', '/api/shop/reports', undefined],
      ['GET', '/api/shop/staff', undefined],
      ['PATCH', '/api/shop/settings', { upiVpa: 'thief@ybl' }],
      ['POST', '/api/shop/expenses', { category: 'Other', amount: 10000 }],
      ['GET', '/api/shop/subscription', undefined],
      ['POST', '/api/shop/services', { name: 'X', price: 100 }],
    ] as const) {
      const res = await barber.device.request(method, path, body);
      expect([401, 403]).toContain(res.status);
    }
    // A staff session cannot be used by the owner app (separate cookies per app).
    const ownerApp = new Device('owner');
    ownerApp.cookies = barber.device.cookies;
    expect((await ownerApp.get('/api/shop/home')).status).toBe(401);
    // Requests without the app header are rejected.
    const noHeader = new Device('admin');
    noHeader.cookies = barber.device.cookies;
    expect((await noHeader.get('/api/shop/catalog')).status).toBe(400);
  });

  it('removed staff are logged out immediately', async () => {
    const { owner } = await newShop();
    const barber = await addBarber(owner);
    expect((await barber.device.get('/api/shop/me/home')).status).toBe(200);
    await owner.patch(`/api/shop/staff/${barber.id}`, { active: false });
    expect((await barber.device.get('/api/shop/me/home')).status).toBe(401);
  });

  it('admin APIs need an admin session', async () => {
    const { owner } = await newShop();
    const asOwner = new Device('admin');
    asOwner.cookies = owner.cookies;
    expect((await asOwner.get('/api/admin/metrics')).status).toBe(401);
    expect((await new Device('admin').post('/api/admin/login', { phone: '9000000001', password: 'x' })).status).toBe(401);
  });
});
