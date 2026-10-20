import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { first } from '../lib/db';
import { notFound } from '../lib/http';
import { currentUser, loadSession, resolveAccess } from '../lib/session';

const media = new Hono<AppEnv>();

interface PhotoAccessRow {
  r2_key: string;
  content_type: string;
  salon_id: string;
  passport_id: string | null;
}

/**
 * Photos are never public. A photo can be read by:
 *  1. members / unlocked stations of the salon that took it,
 *  2. the client themself (Style Passport session),
 *  3. another salon the client has shared their passport with.
 */
async function canRead(c: Parameters<typeof resolveAccess>[0], photo: PhotoAccessRow): Promise<boolean> {
  const passport = await loadSession(c, 'client');
  if (passport?.passport_id && passport.passport_id === photo.passport_id) return true;

  const salonIds = new Set<string>([photo.salon_id]);
  if (photo.passport_id) {
    const auth = await currentUser(c);
    if (auth?.session.impersonator_id && auth.session.salon_id) salonIds.add(auth.session.salon_id);
    else if (auth) {
      const { results } = await c.env.DB.prepare(
        `SELECT ps.salon_id FROM passport_shares ps JOIN members m ON m.salon_id = ps.salon_id AND m.user_id = ? AND m.active = 1
         WHERE ps.passport_id = ? AND ps.revoked_at IS NULL`,
      )
        .bind(auth.user.id, photo.passport_id)
        .all<{ salon_id: string }>();
      results.forEach((r) => salonIds.add(r.salon_id));
    }
    const station = await loadSession(c, 'station');
    if (station?.salon_id) salonIds.add(station.salon_id);
  }

  for (const salonId of salonIds) {
    try {
      const access = await resolveAccess(c, salonId);
      if (access.role === null) continue;
      if (salonId === photo.salon_id) return true;
      const share = await first(
        c.env.DB,
        'SELECT 1 FROM passport_shares WHERE passport_id = ? AND salon_id = ? AND revoked_at IS NULL',
        photo.passport_id,
        salonId,
      );
      if (share) return true;
    } catch {
      // not a member of this salon — try the next one
    }
  }
  return false;
}

media.get('/:photoId', async (c) => {
  const photo = await first<PhotoAccessRow>(
    c.env.DB,
    `SELECT p.r2_key, p.content_type, p.salon_id, cl.passport_id FROM photos p
     JOIN visits v ON v.id = p.visit_id JOIN clients cl ON cl.id = v.client_id
     WHERE p.id = ? AND v.deleted_at IS NULL`,
    c.req.param('photoId'),
  );
  // Same response for "missing" and "forbidden" so ids can't be probed.
  if (!photo || !(await canRead(c, photo))) throw notFound('Photo');
  const object = await c.env.MEDIA.get(photo.r2_key);
  if (!object) throw notFound('Photo');
  return new Response(object.body, {
    headers: {
      'content-type': photo.content_type,
      'cache-control': 'private, max-age=86400, immutable',
      etag: object.httpEtag,
    },
  });
});

export default media;
