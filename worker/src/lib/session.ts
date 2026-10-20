import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { Access, AppEnv, MemberRow, Role, SalonRow, SessionRow, UserRow } from '../types';
import { randomToken, sha256 } from './crypto';
import { DAY, HOUR, first, now, run } from './db';
import { ApiError, clientIp, forbidden, notFound, unauthorized } from './http';

export const COOKIES = {
  user: 'sm_session',
  station: 'sm_station',
  client: 'sm_passport',
} as const;

const TTL = {
  user: 30 * DAY,
  station: 180 * DAY,
  client: 30 * DAY,
};

/** How long a stylist stays unlocked on a station after entering their PIN. */
export const STATION_UNLOCK_MS = 12 * HOUR;

type Kind = keyof typeof COOKIES;

function secure(c: Context<AppEnv>) {
  return c.env.APP_ENV === 'production' || new URL(c.req.url).protocol === 'https:';
}

export async function createSession(
  c: Context<AppEnv>,
  kind: Kind,
  fields: Partial<Pick<SessionRow, 'user_id' | 'salon_id' | 'passport_id' | 'impersonator_id'>>,
): Promise<SessionRow> {
  const token = randomToken();
  const t = now();
  const row: SessionRow = {
    id: await sha256(token),
    kind,
    user_id: fields.user_id ?? null,
    salon_id: fields.salon_id ?? null,
    passport_id: fields.passport_id ?? null,
    impersonator_id: fields.impersonator_id ?? null,
    acting_member_id: null,
    acting_until: null,
    expires_at: t + TTL[kind],
    created_at: t,
    last_seen_at: t,
  };
  await run(
    c.env.DB,
    `INSERT INTO sessions (id, kind, user_id, salon_id, passport_id, impersonator_id, expires_at, created_at, last_seen_at, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    row.id,
    kind,
    row.user_id,
    row.salon_id,
    row.passport_id,
    row.impersonator_id,
    row.expires_at,
    t,
    t,
    clientIp(c),
    c.req.header('user-agent')?.slice(0, 255) ?? null,
  );
  if (kind === 'user') {
    // Make the new session visible to the rest of this request.
    c.set('userSession', row);
    c.set('user', undefined);
  }
  setCookie(c, COOKIES[kind], token, {
    httpOnly: true,
    secure: secure(c),
    sameSite: 'Lax',
    path: '/',
    maxAge: TTL[kind] / 1000,
  });
  return row;
}

export async function destroySession(c: Context<AppEnv>, kind: Kind): Promise<void> {
  const token = getCookie(c, COOKIES[kind]);
  if (token) await run(c.env.DB, 'DELETE FROM sessions WHERE id = ?', await sha256(token));
  deleteCookie(c, COOKIES[kind], { path: '/' });
  if (kind === 'user') {
    c.set('userSession', null);
    c.set('user', null);
  }
}

export async function loadSession(c: Context<AppEnv>, kind: Kind): Promise<SessionRow | null> {
  const token = getCookie(c, COOKIES[kind]);
  if (!token) return null;
  const id = await sha256(token);
  const session = await first<SessionRow>(c.env.DB, 'SELECT * FROM sessions WHERE id = ? AND kind = ?', id, kind);
  if (!session) return null;
  const t = now();
  if (session.expires_at < t) {
    await run(c.env.DB, 'DELETE FROM sessions WHERE id = ?', id);
    return null;
  }
  // Touch at most every 10 minutes to keep D1 writes low.
  if (t - session.last_seen_at > 10 * 60_000) {
    await run(c.env.DB, 'UPDATE sessions SET last_seen_at = ? WHERE id = ?', t, id);
  }
  return session;
}

/** Loads the signed-in user (email/password session) once per request. */
export async function currentUser(c: Context<AppEnv>): Promise<{ session: SessionRow; user: UserRow } | null> {
  if (c.get('user') === undefined) {
    const pending = c.get('userSession');
    const session = pending === undefined ? await loadSession(c, 'user') : pending;
    const user = session?.user_id
      ? await first<UserRow>(c.env.DB, 'SELECT * FROM users WHERE id = ? AND disabled_at IS NULL', session.user_id)
      : null;
    c.set('userSession', user ? session : null);
    c.set('user', user);
  }
  const user = c.get('user');
  const session = c.get('userSession');
  return user && session ? { session, user } : null;
}

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!(await currentUser(c))) throw unauthorized();
  await next();
};

export const requirePlatformAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const auth = await currentUser(c);
  if (!auth) throw unauthorized();
  // An impersonation session must never carry admin powers.
  if (!auth.user.is_platform_admin || auth.session.impersonator_id) throw forbidden();
  await next();
};

/**
 * Resolves what the caller may do inside `/api/salons/:salonId/*`.
 * Order: a signed-in member (or an admin impersonating the salon) → an unlocked station device.
 */
export async function resolveAccess(c: Context<AppEnv>, salonId: string): Promise<Access> {
  const salon = await first<SalonRow>(c.env.DB, 'SELECT * FROM salons WHERE id = ? AND deleted_at IS NULL', salonId);
  if (!salon) throw notFound('Salon');

  const auth = await currentUser(c);
  if (auth) {
    if (auth.session.impersonator_id) {
      if (auth.session.salon_id === salonId) {
        const owner = await first<MemberRow>(
          c.env.DB,
          "SELECT * FROM members WHERE salon_id = ? AND role = 'owner' AND active = 1 ORDER BY created_at LIMIT 1",
          salonId,
        );
        return { salon, kind: 'user', role: 'owner', memberId: owner?.id ?? null, userId: auth.user.id, impersonatorId: auth.session.impersonator_id };
      }
    } else {
      const member = await first<MemberRow>(
        c.env.DB,
        'SELECT * FROM members WHERE salon_id = ? AND user_id = ? AND active = 1',
        salonId,
        auth.user.id,
      );
      if (member) {
        return { salon, kind: 'user', role: member.role, memberId: member.id, userId: auth.user.id, impersonatorId: null };
      }
    }
  }

  const station = await loadSession(c, 'station');
  if (station && station.salon_id === salonId) {
    let role: Role | null = null;
    let memberId: string | null = null;
    if (station.acting_member_id && (station.acting_until ?? 0) > now()) {
      const member = await first<MemberRow>(
        c.env.DB,
        'SELECT * FROM members WHERE id = ? AND salon_id = ? AND active = 1',
        station.acting_member_id,
        salonId,
      );
      if (member) {
        role = member.role;
        memberId = member.id;
      }
    }
    return { salon, kind: 'station', role, memberId, userId: null, impersonatorId: null };
  }

  throw auth ? forbidden('You are not a member of this salon.') : unauthorized();
}

export type Permission = 'station' | 'floor' | 'manage' | 'owner';

/**
 * - station: any device paired to the salon, even locked (only used for the unlock screen)
 * - floor:   day-to-day work — look up clients, record visits (any member, or an unlocked station)
 * - manage:  owner or manager signed in with their own account
 * - owner:   billing, deleting data
 */
export function salonAccess(permission: Permission): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const access = await resolveAccess(c, c.req.param('salonId') ?? '');
    if (access.salon.suspended_at && !access.impersonatorId && permission !== 'owner') {
      throw forbidden(`This salon is suspended${access.salon.suspended_reason ? `: ${access.salon.suspended_reason}` : ''}. Contact support.`);
    }
    const ok =
      permission === 'station' ||
      (permission === 'floor' && access.role !== null) ||
      (permission === 'manage' && access.kind === 'user' && (access.role === 'owner' || access.role === 'manager')) ||
      (permission === 'owner' && access.kind === 'user' && access.role === 'owner');
    if (!ok) {
      throw access.kind === 'station' && access.role === null
        ? new ApiError(401, 'station_locked', 'Unlock the station with your PIN.')
        : forbidden();
    }
    c.set('access', access);
    await next();
  };
}
