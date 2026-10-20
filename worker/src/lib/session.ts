import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { App, AppEnv, PlanRow, SessionRow, ShopRow, StaffRow, UserRow } from '../types';
import { newId, randomToken, sha256 } from './crypto';
import { DAY, HOUR, first, now, run } from './db';
import { ApiError, forbidden, unauthorized } from './http';

/** Each installed app keeps its own login, so the owner app and a staff app can live on one phone. */
const COOKIE: Record<App, string> = { owner: 'sm_owner', staff: 'sm_staff', admin: 'sm_admin' };
const TTL: Record<App, number> = { owner: 90 * DAY, staff: 90 * DAY, admin: 12 * HOUR };

function secure(c: Context<AppEnv>) {
  return c.env.APP_ENV === 'production' || new URL(c.req.url).protocol === 'https:';
}

/** The app a request comes from: the SPA sends `x-app: owner | staff`. */
export function appOf(c: Context<AppEnv>): 'owner' | 'staff' {
  const app = c.req.header('x-app');
  if (app === 'owner' || app === 'staff') return app;
  throw new ApiError(400, 'bad_app', 'Missing app header.');
}

export async function createSession(
  c: Context<AppEnv>,
  app: App,
  userId: string,
  shopId: string | null,
  opts: { impersonatorId?: string; ttl?: number } = {},
): Promise<void> {
  const token = randomToken();
  const t = now();
  const ttl = opts.ttl ?? TTL[app];
  await run(
    c.env.DB,
    `INSERT INTO sessions (id, app, user_id, shop_id, impersonator_id, expires_at, created_at, last_seen_at, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    await sha256(token),
    app,
    userId,
    shopId,
    opts.impersonatorId ?? null,
    t + ttl,
    t,
    t,
    c.req.header('user-agent')?.slice(0, 200) ?? null,
  );
  setCookie(c, COOKIE[app], token, { httpOnly: true, secure: secure(c), sameSite: 'Lax', path: '/', maxAge: Math.floor(ttl / 1000) });
}

export async function destroySession(c: Context<AppEnv>, app: App): Promise<void> {
  const token = getCookie(c, COOKIE[app]);
  if (token) await run(c.env.DB, 'DELETE FROM sessions WHERE id = ?', await sha256(token));
  deleteCookie(c, COOKIE[app], { path: '/' });
}

export async function loadSession(c: Context<AppEnv>, app: App): Promise<SessionRow | null> {
  const token = getCookie(c, COOKIE[app]);
  if (!token) return null;
  const id = await sha256(token);
  const session = await first<SessionRow>(c.env.DB, 'SELECT * FROM sessions WHERE id = ? AND app = ?', id, app);
  if (!session) return null;
  const t = now();
  if (session.expires_at < t) {
    await run(c.env.DB, 'DELETE FROM sessions WHERE id = ?', id);
    return null;
  }
  if (t - session.last_seen_at > 15 * 60_000) await run(c.env.DB, 'UPDATE sessions SET last_seen_at = ? WHERE id = ?', t, id);
  return session;
}

/** Downgrades an expired paid plan (or trial) to Free on first use after expiry — no cron dependency. */
export async function effectivePlan(db: D1Database, shop: ShopRow): Promise<{ shop: ShopRow; plan: PlanRow }> {
  if (shop.plan_id !== 'free' && shop.plan_expires_at !== null && shop.plan_expires_at < now()) {
    await run(db, "UPDATE shops SET plan_id = 'free', plan_expires_at = NULL, trial = 0, updated_at = ? WHERE id = ?", now(), shop.id);
    await run(
      db,
      "INSERT INTO audit_log (id, shop_id, action, meta, created_at) VALUES (?, ?, 'plan.expired', ?, ?)",
      newId('aud'),
      shop.id,
      JSON.stringify({ from: shop.plan_id, trial: Boolean(shop.trial) }),
      now(),
    );
    shop = { ...shop, plan_id: 'free', plan_expires_at: null, trial: 0 };
  }
  const plan = await first<PlanRow>(db, 'SELECT * FROM plans WHERE id = ?', shop.plan_id);
  if (!plan) throw new ApiError(500, 'plan_missing', 'Plan not found.');
  return { shop, plan };
}

/**
 * Resolves the caller for `/api/shop/*`.
 * - `any`: anyone working in the shop (owner app or staff app)
 * - `manager`: owner app, role owner or manager
 * - `owner`: owner app, role owner
 */
export function shopAccess(level: 'any' | 'manager' | 'owner' = 'any'): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const app = appOf(c);
    const session = await loadSession(c, app);
    if (!session?.shop_id) throw unauthorized();
    const user = await first<UserRow>(c.env.DB, 'SELECT * FROM users WHERE id = ? AND disabled_at IS NULL', session.user_id);
    if (!user) throw unauthorized();
    const shopRow = await first<ShopRow>(c.env.DB, 'SELECT * FROM shops WHERE id = ? AND deleted_at IS NULL', session.shop_id);
    if (!shopRow) throw unauthorized();
    const me = session.impersonator_id
      ? await first<StaffRow>(c.env.DB, "SELECT * FROM staff WHERE shop_id = ? AND role = 'owner' ORDER BY created_at LIMIT 1", shopRow.id)
      : await first<StaffRow>(c.env.DB, 'SELECT * FROM staff WHERE shop_id = ? AND user_id = ? AND active = 1', shopRow.id, user.id);
    if (!me) throw new ApiError(401, 'removed', 'You are no longer part of this shop.');
    const isManager = app === 'owner' && (me.role === 'owner' || me.role === 'manager');
    if (app === 'owner' && !isManager) throw new ApiError(403, 'not_owner', 'This app is for the shop owner. Please use the Staff app.');
    if (level === 'manager' && !isManager) throw forbidden();
    if (level === 'owner' && !(app === 'owner' && me.role === 'owner')) throw forbidden('Only the shop owner can do this.');
    if (shopRow.suspended_at && !session.impersonator_id && !c.req.path.startsWith('/api/shop/subscription') && c.req.path !== '/api/shop/me') {
      throw new ApiError(403, 'suspended', `This shop is paused${shopRow.suspended_reason ? `: ${shopRow.suspended_reason}` : ''}. Contact SnipMemory support.`);
    }
    const { shop, plan } = await effectivePlan(c.env.DB, shopRow);
    c.set('ctx', {
      app,
      user,
      shop,
      me,
      plan,
      isManager,
      isOwner: app === 'owner' && me.role === 'owner',
      impersonatorId: session.impersonator_id,
      sessionId: session.id,
    });
    await next();
  };
}

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const session = await loadSession(c, 'admin');
  if (!session) throw unauthorized();
  const user = await first<UserRow>(c.env.DB, 'SELECT * FROM users WHERE id = ? AND is_platform_admin = 1 AND disabled_at IS NULL', session.user_id);
  if (!user) throw unauthorized();
  c.set('adminUser', user);
  await next();
};
