import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type { AppEnv, PlanRow, ShopRow, StaffRow, UserRow } from '../types';
import { hashSecret, newId, verifySecret } from '../lib/crypto';
import { DAY, MINUTE, all, count, first, now, run } from '../lib/db';
import { dayOf } from '../lib/day';
import { defaultServices } from '../lib/defaults';
import { ApiError, badRequest, body, clientIp, conflict, unauthorized } from '../lib/http';
import { normalizePhone } from '../lib/phone';
import { TRIAL_DAYS, TRIAL_PLAN } from '../lib/plans';
import { rateLimit } from '../lib/ratelimit';
import { serializePlan, serializeShop, serializeStaff } from '../lib/serialize';
import { appOf, createSession, destroySession, effectivePlan, loadSession } from '../lib/session';

const auth = new Hono<AppEnv>();

export const phoneField = z.string().trim().min(10, 'Enter a 10-digit mobile number').max(16);
const ownerPin = z.string().regex(/^\d{6}$/, 'PIN must be 6 digits');
const anyPin = z.string().regex(/^\d{4,6}$/, 'PIN must be 4 to 6 digits');
const shopType = z.enum(['gents', 'unisex', 'ladies', 'spa']);

/** 0000, 1111, 1234, 123456, 9876… are the first PINs anyone tries. */
export function assertStrongPin(pin: string): void {
  if (/^(\d)\1+$/.test(pin) || '0123456789'.includes(pin) || '9876543210'.includes(pin)) {
    throw badRequest('This PIN is too easy to guess. Choose another.');
  }
}

export function indianPhone(input: string): string {
  const phone = normalizePhone(input, 'IN');
  if (!phone || (phone.startsWith('+91') && phone.length !== 13)) throw badRequest('Enter a valid 10-digit mobile number.');
  return phone;
}

/** Creates a shop with its owner staff row and a starter price list. */
export async function createShop(
  db: D1Database,
  owner: { id: string; name: string; phone: string },
  input: { shopName: string; city?: string; shopType: z.infer<typeof shopType> },
  withTrial: boolean,
): Promise<string> {
  const t = now();
  const shopId = newId('shp');
  const statements = [
    db
      .prepare(
        `INSERT INTO shops (id, owner_user_id, name, shop_type, phone, city, upi_name, plan_id, plan_expires_at, trial, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(shopId, owner.id, input.shopName, input.shopType, owner.phone, input.city ?? null, input.shopName, withTrial ? TRIAL_PLAN : 'free', withTrial ? t + TRIAL_DAYS * DAY : null, withTrial ? 1 : 0, t, t),
    db
      .prepare("INSERT INTO staff (id, shop_id, user_id, name, role, created_at) VALUES (?, ?, ?, ?, 'owner', ?)")
      .bind(newId('stf'), shopId, owner.id, owner.name, t),
    ...defaultServices(input.shopType).map(([name, category, rupees, minutes], i) =>
      db
        .prepare('INSERT INTO services (id, shop_id, name, category, price, minutes, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(newId('svc'), shopId, name, category, rupees * 100, minutes, i, t),
    ),
  ];
  await db.batch(statements);
  return shopId;
}

/** Shops this user can open in the given app. */
async function shopsFor(db: D1Database, userId: string, app: 'owner' | 'staff') {
  return all<ShopRow & { role: StaffRow['role'] }>(
    db,
    `SELECT s.*, st.role FROM staff st JOIN shops s ON s.id = st.shop_id
     WHERE st.user_id = ? AND st.active = 1 AND s.deleted_at IS NULL ${app === 'owner' ? "AND st.role IN ('owner', 'manager')" : ''}
     ORDER BY s.created_at`,
    userId,
  );
}

export async function mePayload(c: Context<AppEnv>, app: 'owner' | 'staff') {
  const session = await loadSession(c, app);
  if (!session?.shop_id) return { user: null };
  const user = await first<UserRow>(c.env.DB, 'SELECT * FROM users WHERE id = ? AND disabled_at IS NULL', session.user_id);
  const shopRow = await first<ShopRow>(c.env.DB, 'SELECT * FROM shops WHERE id = ? AND deleted_at IS NULL', session.shop_id);
  if (!user || !shopRow) return { user: null };
  const me = session.impersonator_id
    ? await first<StaffRow>(c.env.DB, "SELECT * FROM staff WHERE shop_id = ? AND role = 'owner' LIMIT 1", shopRow.id)
    : await first<StaffRow>(c.env.DB, 'SELECT * FROM staff WHERE shop_id = ? AND user_id = ? AND active = 1', shopRow.id, user.id);
  if (!me) return { user: null };
  const { shop, plan } = await effectivePlan(c.env.DB, shopRow);
  const billsThisMonth = await count(c.env.DB, 'SELECT COUNT(*) AS n FROM bills WHERE shop_id = ? AND day LIKE ?', shop.id, `${dayOf(shop.timezone).slice(0, 7)}%`);
  const shops = session.impersonator_id ? [shop] : await shopsFor(c.env.DB, user.id, app);
  return {
    user: { id: user.id, name: user.name, phone: user.phone, language: user.language, mustChangePin: Boolean(user.pin_must_change) },
    shop: serializeShop(shop),
    me: serializeStaff(me),
    plan: serializePlan(plan),
    usage: { billsThisMonth },
    shops: shops.map((s) => ({ id: s.id, name: s.name, city: s.city })),
    impersonating: Boolean(session.impersonator_id),
    support: { whatsapp: c.env.SUPPORT_WHATSAPP },
  };
}

auth.get('/me', async (c) => c.json(await mePayload(c, appOf(c))));

auth.post('/signup', async (c) => {
  const input = await body(
    c,
    z.object({
      name: z.string().trim().min(2, 'Enter your name').max(60),
      phone: phoneField,
      pin: ownerPin,
      shopName: z.string().trim().min(2, 'Enter shop name').max(80),
      city: z.string().trim().max(60).optional(),
      shopType: shopType.default('gents'),
    }),
  );
  await rateLimit(c.env.DB, `signup:${clientIp(c)}`, 10, 60 * MINUTE);
  const phone = indianPhone(input.phone);
  assertStrongPin(input.pin);
  const db = c.env.DB;
  let user = await first<UserRow>(db, 'SELECT * FROM users WHERE phone = ?', phone);
  if (user) {
    // Existing number (e.g. a barber opening their own shop): the PIN must match.
    if (!(await verifySecret(input.pin, user.pin_hash))) {
      throw conflict('This number is already registered. Log in, or use your existing PIN to add a new shop.', 'phone_taken');
    }
  } else {
    const id = newId('usr');
    await run(db, 'INSERT INTO users (id, phone, name, pin_hash, created_at) VALUES (?, ?, ?, ?, ?)', id, phone, input.name, await hashSecret(input.pin), now());
    user = (await first<UserRow>(db, 'SELECT * FROM users WHERE id = ?', id))!;
  }
  const ownsShop = await count(db, 'SELECT COUNT(*) AS n FROM shops WHERE owner_user_id = ?', user.id);
  const shopId = await createShop(db, { id: user.id, name: input.name, phone }, input, ownsShop === 0);
  await run(db, "INSERT INTO audit_log (id, shop_id, user_id, action, meta, created_at) VALUES (?, ?, ?, 'shop.created', ?, ?)", newId('aud'), shopId, user.id, JSON.stringify({ type: input.shopType }), now());
  await destroySession(c, 'owner');
  await createSession(c, 'owner', user.id, shopId);
  return c.json({ ok: true }, 201);
});

auth.post('/login', async (c) => {
  const input = await body(c, z.object({ phone: phoneField, pin: anyPin, app: z.enum(['owner', 'staff']) }));
  const phone = indianPhone(input.phone);
  await rateLimit(c.env.DB, `login-ip:${clientIp(c)}`, 30, 15 * MINUTE);
  await rateLimit(c.env.DB, `login:${phone}`, 6, 15 * MINUTE);
  const user = await first<UserRow>(c.env.DB, 'SELECT * FROM users WHERE phone = ?', phone);
  const ok = await verifySecret(input.pin, user?.pin_hash ?? 'pbkdf2$100000$00$00');
  if (!user || !ok || user.disabled_at) throw unauthorized('Wrong mobile number or PIN.');
  const shops = await shopsFor(c.env.DB, user.id, input.app);
  if (!shops.length) {
    if (input.app === 'owner' && (await first(c.env.DB, 'SELECT 1 FROM staff WHERE user_id = ? AND active = 1', user.id))) {
      throw new ApiError(403, 'use_staff_app', 'You are added as staff. Please open the Staff app.');
    }
    throw new ApiError(403, 'no_shop', 'This number is not added to any shop yet. Ask your shop owner to add you.');
  }
  // Re-open the shop used most recently in this app.
  const last = await first<{ shop_id: string }>(
    c.env.DB,
    'SELECT shop_id FROM sessions WHERE user_id = ? AND app = ? ORDER BY created_at DESC LIMIT 1',
    user.id,
    input.app,
  );
  const shopId = shops.find((s) => s.id === last?.shop_id)?.id ?? shops[0].id;
  await run(c.env.DB, 'UPDATE users SET last_login_at = ? WHERE id = ?', now(), user.id);
  await destroySession(c, input.app);
  await createSession(c, input.app, user.id, shopId);
  return c.json({ ok: true });
});

auth.post('/logout', async (c) => {
  await destroySession(c, appOf(c));
  return c.json({ ok: true });
});

auth.post('/pin', async (c) => {
  const app = appOf(c);
  const input = await body(c, z.object({ currentPin: anyPin, newPin: anyPin }));
  const session = await loadSession(c, app);
  if (!session) throw unauthorized();
  await rateLimit(c.env.DB, `pin-change:${session.user_id}`, 6, 15 * MINUTE);
  const user = await first<UserRow>(c.env.DB, 'SELECT * FROM users WHERE id = ?', session.user_id);
  if (!user || !(await verifySecret(input.currentPin, user.pin_hash))) throw badRequest('Current PIN is wrong.');
  const owns = await first(c.env.DB, "SELECT 1 FROM staff WHERE user_id = ? AND role IN ('owner', 'manager') AND active = 1", user.id);
  if (owns && input.newPin.length !== 6) throw badRequest('Owners need a 6-digit PIN.');
  assertStrongPin(input.newPin);
  await run(c.env.DB, 'UPDATE users SET pin_hash = ?, pin_must_change = 0 WHERE id = ?', await hashSecret(input.newPin), user.id);
  await run(c.env.DB, 'DELETE FROM sessions WHERE user_id = ? AND id != ?', user.id, session.id);
  return c.json({ ok: true });
});

auth.post('/switch', async (c) => {
  const app = appOf(c);
  const input = await body(c, z.object({ shopId: z.string() }));
  const session = await loadSession(c, app);
  if (!session || session.impersonator_id) throw unauthorized();
  const shops = await shopsFor(c.env.DB, session.user_id, app);
  if (!shops.some((s) => s.id === input.shopId)) throw badRequest('You are not part of that shop.');
  await run(c.env.DB, 'UPDATE sessions SET shop_id = ? WHERE id = ?', input.shopId, session.id);
  return c.json({ ok: true });
});

/** Owner opens another branch. Extra branches start on Free; each shop has its own plan. */
auth.post('/shops', async (c) => {
  const input = await body(c, z.object({ shopName: z.string().trim().min(2).max(80), city: z.string().trim().max(60).optional(), shopType: shopType.default('gents') }));
  const session = await loadSession(c, 'owner');
  if (!session || session.impersonator_id) throw unauthorized();
  const user = await first<UserRow>(c.env.DB, 'SELECT * FROM users WHERE id = ?', session.user_id);
  if (!user) throw unauthorized();
  const owned = await count(c.env.DB, 'SELECT COUNT(*) AS n FROM shops WHERE owner_user_id = ? AND deleted_at IS NULL', user.id);
  if (owned >= 20) throw badRequest('Contact support to add more than 20 shops.');
  const shopId = await createShop(c.env.DB, user, input, false);
  await run(c.env.DB, 'UPDATE sessions SET shop_id = ? WHERE id = ?', shopId, session.id);
  return c.json({ shopId }, 201);
});

export const plansPublic = async (db: D1Database) =>
  (await all<PlanRow>(db, 'SELECT * FROM plans WHERE is_public = 1 ORDER BY sort_order')).map(serializePlan);

export default auth;
