import { describe, expect, it } from 'vitest';
import { Browser, JPEG, signup } from './helpers';

describe('auth', () => {
  it('signs up an owner with a trialing salon', async () => {
    const { me } = await signup();
    expect(me.user.email).toMatch(/@example.com$/);
    expect(me.memberships).toHaveLength(1);
    expect(me.memberships[0].role).toBe('owner');
    expect(me.memberships[0].salon.subscriptionStatus).toBe('trialing');
    expect(me.memberships[0].salon.planId).toBe('studio');
    expect(me.memberships[0].salon.currency).toBe('INR');
  });

  it('rejects duplicate emails and wrong passwords, accepts the right one', async () => {
    const { me } = await signup();
    const b = new Browser();
    const dup = await b.post('/api/auth/signup', { name: 'X', email: me.user.email, password: 'another password', salonName: 'Another' });
    expect(dup.status).toBe(409);
    expect((await b.post('/api/auth/login', { email: me.user.email, password: 'nope nope nope' })).status).toBe(401);
    const ok = await b.post('/api/auth/login', { email: me.user.email, password: 'correct horse battery' });
    expect(ok.status).toBe(200);
    expect((await b.get('/api/auth/me')).data.user.email).toBe(me.user.email);
    await b.post('/api/auth/logout');
    expect((await b.get('/api/auth/me')).data.user).toBeNull();
  });

  it('blocks cross-site mutations', async () => {
    const b = new Browser();
    const res = await b.request('POST', '/api/auth/login', { email: 'a@b.co', password: 'x' }, { origin: 'https://evil.example' });
    expect(res.status).toBe(403);
  });
});

describe('clients & visits', () => {
  it('normalises phones, prevents duplicates and records visits with photos', async () => {
    const { browser, salonId } = await signup();
    const created = await browser.post(`/api/salons/${salonId}/clients`, { name: 'Arjun Nair', phone: '098470 12345', photoConsent: true, marketingConsent: true });
    expect(created.status).toBe(201);
    expect(created.data.client.phone).toBe('+919847012345');

    const dup = await browser.post(`/api/salons/${salonId}/clients`, { name: 'Someone', phone: '+91 98470 12345' });
    expect(dup.status).toBe(409);
    expect(dup.data.client.id).toBe(created.data.client.id);

    const clientId = created.data.client.id;
    const visit = await browser.post(`/api/salons/${salonId}/clients/${clientId}/visits`, {
      service: 'Skin fade',
      styleTags: ['Fade', 'Textured crop'],
      technique: { sides: '#0.5 to #2', top: 'Scissor 3cm, point cut' },
      notes: 'Likes it tight around the ears',
      price: 45000,
    });
    expect(visit.status).toBe(201);
    const visitId = visit.data.visit.id;

    const upload = await browser.put(`/api/salons/${salonId}/visits/${visitId}/photos/front`, JPEG, { 'content-type': 'image/jpeg', 'x-face-blurred': '1' });
    expect(upload.status).toBe(201);
    expect(upload.data.photo.blurred).toBe(true);

    const detail = await browser.get(`/api/salons/${salonId}/clients/${clientId}`);
    expect(detail.data.client.visitCount).toBe(1);
    expect(detail.data.client.nextReminderAt).toBeGreaterThan(Date.now());
    expect(detail.data.visits[0].technique.sides).toBe('#0.5 to #2');
    expect(detail.data.visits[0].photos).toHaveLength(1);

    const image = await browser.get(upload.data.photo.url);
    expect(image.status).toBe(200);
    expect(image.headers.get('content-type')).toBe('image/jpeg');

    // Another salon can neither read the client nor the photo.
    const other = await signup();
    expect((await other.browser.get(`/api/salons/${salonId}/clients/${clientId}`)).status).toBe(403);
    expect((await other.browser.get(upload.data.photo.url)).status).toBe(404);
    expect((await new Browser().get(upload.data.photo.url)).status).toBe(404);
  });

  it('requires photo consent before uploading', async () => {
    const { browser, salonId } = await signup();
    const client = await browser.post(`/api/salons/${salonId}/clients`, { name: 'No Photos', phone: '9000000001' });
    const visit = await browser.post(`/api/salons/${salonId}/clients/${client.data.client.id}/visits`, { service: 'Trim' });
    const upload = await browser.put(`/api/salons/${salonId}/visits/${visit.data.visit.id}/photos/back`, JPEG, { 'content-type': 'image/jpeg' });
    expect(upload.status).toBe(403);
    expect(upload.data.error.code).toBe('consent_required');
  });

  it('erases a client and their photos', async () => {
    const { browser, salonId } = await signup();
    const client = await browser.post(`/api/salons/${salonId}/clients`, { name: 'Forget Me', phone: '9000000002', photoConsent: true });
    const visit = await browser.post(`/api/salons/${salonId}/clients/${client.data.client.id}/visits`, { service: 'Trim', notes: 'secret' });
    const photo = await browser.put(`/api/salons/${salonId}/visits/${visit.data.visit.id}/photos/left`, JPEG, { 'content-type': 'image/jpeg' });
    expect((await browser.del(`/api/salons/${salonId}/clients/${client.data.client.id}`)).status).toBe(200);
    expect((await browser.get(`/api/salons/${salonId}/clients/${client.data.client.id}`)).status).toBe(404);
    expect((await browser.get(photo.data.photo.url)).status).toBe(404);
    // The number can be registered again afterwards.
    expect((await browser.post(`/api/salons/${salonId}/clients`, { name: 'New', phone: '9000000002' })).status).toBe(201);
  });
});

describe('team & station mode', () => {
  it('lets a stylist unlock a shared device with a PIN and record visits as themself', async () => {
    const { browser: owner, salonId } = await signup();
    const member = await owner.post(`/api/salons/${salonId}/team`, { displayName: 'Ravi', role: 'stylist', pin: '4321' });
    expect(member.status).toBe(201);

    const tablet = new Browser();
    // Pair the tablet: the owner signs in on it, pairs, then signs out.
    const ownerEmail = (await owner.get('/api/auth/me')).data.user.email;
    await tablet.post('/api/auth/login', { email: ownerEmail, password: 'correct horse battery' });
    expect((await tablet.post(`/api/salons/${salonId}/station/pair`)).status).toBe(200);
    await tablet.post('/api/auth/logout');

    const status = await tablet.get('/api/station');
    expect(status.data.paired).toBe(true);
    expect(status.data.acting).toBeNull();

    const locked = await tablet.get(`/api/salons/${salonId}/clients`);
    expect(locked.status).toBe(401);
    expect(locked.data.error.code).toBe('station_locked');

    expect((await tablet.post('/api/station/unlock', { memberId: member.data.member.id, pin: '0000' })).status).toBe(401);
    expect((await tablet.post('/api/station/unlock', { memberId: member.data.member.id, pin: '4321' })).status).toBe(200);

    const client = await tablet.post(`/api/salons/${salonId}/clients`, { name: 'Walk In', phone: '9000000003' });
    const visit = await tablet.post(`/api/salons/${salonId}/clients/${client.data.client.id}/visits`, { service: 'Beard trim' });
    expect(visit.data.visit.stylistName).toBe('Ravi');

    // Stations can't touch owner-only areas.
    expect((await tablet.get(`/api/salons/${salonId}/billing`)).status).toBe(403);
    expect((await tablet.patch(`/api/salons/${salonId}`, { name: 'Hacked' })).status).toBe(403);
  });

  it('creates invite links that grant a login', async () => {
    const { browser: owner, salonId } = await signup();
    const invite = await owner.post(`/api/salons/${salonId}/team/invites`, { email: `mgr-${Date.now()}@example.com`, role: 'manager' });
    expect(invite.status).toBe(201);
    const token = invite.data.inviteUrl.split('/invite/')[1];
    const manager = new Browser();
    expect((await manager.get(`/api/auth/invites/${token}`)).data.role).toBe('manager');
    const accepted = await manager.post(`/api/auth/invites/${token}/accept`, { name: 'Maya', password: 'manager password' });
    expect(accepted.status).toBe(200);
    expect(accepted.data.memberships[0].role).toBe('manager');
    expect((await manager.get(`/api/salons/${salonId}/dashboard`)).status).toBe(200);
    expect((await manager.get(`/api/salons/${salonId}/billing`)).status).toBe(403);
  });
});

describe('password reset', () => {
  it('resets a password with a single-use link and signs out other sessions', async () => {
    const { browser, me } = await signup();
    const anon = new Browser();
    const unknown = await anon.post('/api/auth/password/forgot', { email: 'nobody@example.com' });
    expect(unknown.status).toBe(200);
    expect(unknown.data.devLink).toBeUndefined();

    const res = await anon.post('/api/auth/password/forgot', { email: me.user.email });
    const token = res.data.devLink.split('/reset/')[1];
    expect((await anon.post('/api/auth/password/reset', { token, password: 'short' })).status).toBe(422);
    const ok = await anon.post('/api/auth/password/reset', { token, password: 'a brand new password' });
    expect(ok.status).toBe(200);
    expect(ok.data.user.email).toBe(me.user.email);
    // Old session is gone, the link can't be reused, the new password works.
    expect((await browser.get('/api/auth/me')).data.user).toBeNull();
    expect((await anon.post('/api/auth/password/reset', { token, password: 'another new password' })).status).toBe(400);
    expect((await new Browser().post('/api/auth/login', { email: me.user.email, password: 'a brand new password' })).status).toBe(200);
  });
});
