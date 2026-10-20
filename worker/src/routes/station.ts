import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv, MemberRow, SalonRow } from '../types';
import { audit } from '../lib/audit';
import { verifySecret } from '../lib/crypto';
import { MINUTE, all, first, now, run } from '../lib/db';
import { ApiError, body, notFound, unauthorized } from '../lib/http';
import { requireCapability } from '../lib/plans';
import { serializeMember, serializeSalon } from '../lib/serialize';
import { STATION_UNLOCK_MS, createSession, destroySession, loadSession, salonAccess } from '../lib/session';
import { rateLimit } from '../lib/ratelimit';

/**
 * Station mode: a shared tablet/phone at the front desk or a chair is paired once by the owner.
 * Stylists then tap their name and enter a PIN — no email logins on the shop floor.
 */
export const stationPairing = new Hono<AppEnv>();

stationPairing.post('/pair', salonAccess('manage'), async (c) => {
  const { salon } = c.get('access');
  await requireCapability(c.env.DB, salon, 'station_mode');
  await destroySession(c, 'station');
  await createSession(c, 'station', { salon_id: salon.id });
  await audit(c, { salonId: salon.id, action: 'station.paired' });
  return c.json({ ok: true });
});

const station = new Hono<AppEnv>();

async function requireStation(c: Parameters<typeof loadSession>[0]) {
  const session = await loadSession(c, 'station');
  if (!session?.salon_id) throw unauthorized('This device is not paired with a salon.');
  const salon = await first<SalonRow>(c.env.DB, 'SELECT * FROM salons WHERE id = ? AND deleted_at IS NULL', session.salon_id);
  if (!salon) throw notFound('Salon');
  return { session, salon };
}

station.get('/', async (c) => {
  const session = await loadSession(c, 'station');
  if (!session?.salon_id) return c.json({ paired: false });
  const { salon } = await requireStation(c);
  const members = await all<MemberRow>(
    c.env.DB,
    'SELECT * FROM members WHERE salon_id = ? AND active = 1 ORDER BY display_name',
    salon.id,
  );
  const acting = session.acting_member_id && (session.acting_until ?? 0) > now()
    ? members.find((m) => m.id === session.acting_member_id) ?? null
    : null;
  return c.json({
    paired: true,
    salon: serializeSalon(salon),
    members: members.map(serializeMember),
    acting: acting ? { ...serializeMember(acting), until: session.acting_until } : null,
  });
});

station.post('/unlock', async (c) => {
  const input = await body(c, z.object({ memberId: z.string(), pin: z.string().regex(/^\d{4,6}$/) }));
  const { session, salon } = await requireStation(c);
  await rateLimit(c.env.DB, `pin:${session.id}`, 8, 5 * MINUTE);
  await rateLimit(c.env.DB, `pin:${input.memberId}`, 10, 15 * MINUTE);
  const member = await first<MemberRow>(
    c.env.DB,
    'SELECT * FROM members WHERE id = ? AND salon_id = ? AND active = 1',
    input.memberId,
    salon.id,
  );
  if (!member) throw notFound('Team member');
  if (!member.pin_hash) throw new ApiError(400, 'no_pin', 'No PIN set yet. Ask the owner to set your PIN in Team settings.');
  if (!(await verifySecret(input.pin, member.pin_hash))) throw unauthorized('Wrong PIN.');
  const until = now() + STATION_UNLOCK_MS;
  await run(c.env.DB, 'UPDATE sessions SET acting_member_id = ?, acting_until = ? WHERE id = ?', member.id, until, session.id);
  return c.json({ acting: { ...serializeMember(member), until } });
});

station.post('/lock', async (c) => {
  const { session } = await requireStation(c);
  await run(c.env.DB, 'UPDATE sessions SET acting_member_id = NULL, acting_until = NULL WHERE id = ?', session.id);
  return c.json({ ok: true });
});

station.post('/unpair', async (c) => {
  await destroySession(c, 'station');
  return c.json({ ok: true });
});

export default station;
