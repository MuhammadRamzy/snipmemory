import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { first } from '../lib/db';
import { notFound } from '../lib/http';
import { loadSession } from '../lib/session';

const media = new Hono<AppEnv>();

/** Customer cut photos are private: only people signed in to the same shop can see them. */
media.get('/:id', async (c) => {
  const photo = await first<{ r2_key: string; shop_id: string }>(c.env.DB, 'SELECT r2_key, shop_id FROM photos WHERE id = ?', c.req.param('id'));
  if (!photo) throw notFound('Photo');
  let allowed = false;
  for (const app of ['owner', 'staff'] as const) {
    const s = await loadSession(c, app);
    if (s?.shop_id === photo.shop_id) {
      allowed = Boolean(s.impersonator_id) || Boolean(await first(c.env.DB, 'SELECT 1 FROM staff WHERE shop_id = ? AND user_id = ? AND active = 1', photo.shop_id, s.user_id));
      if (allowed) break;
    }
  }
  if (!allowed) throw notFound('Photo');
  const object = await c.env.MEDIA.get(photo.r2_key);
  if (!object) throw notFound('Photo');
  return new Response(object.body, {
    headers: { 'content-type': object.httpMetadata?.contentType ?? 'image/jpeg', 'cache-control': 'private, max-age=86400', etag: object.httpEtag },
  });
});

export default media;
