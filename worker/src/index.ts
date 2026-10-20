import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import type { Env } from './env';
import type { AppEnv } from './types';
import { DAY, now } from './lib/db';
import { ApiError } from './lib/http';
import admin from './routes/admin';
import auth from './routes/auth';
import bills from './routes/bills';
import customers from './routes/customers';
import media from './routes/media';
import publicApi from './routes/public';
import queue from './routes/queue';
import reports from './routes/reports';
import shop from './routes/shop';
import staff, { me } from './routes/staff';

const app = new Hono<AppEnv>();

app.use('*', secureHeaders({ crossOriginResourcePolicy: 'same-origin' }));

// CSRF: cookie-authenticated writes must come from our own pages.
app.use('/api/*', async (c, next) => {
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
    const origin = c.req.header('origin');
    if (origin && new URL(origin).host !== new URL(c.req.url).host) {
      return c.json({ error: { code: 'bad_origin', message: 'Blocked.' } }, 403);
    }
  }
  await next();
  if (!c.res.headers.has('cache-control')) c.res.headers.set('cache-control', 'no-store');
});

app.get('/api/health', (c) => c.json({ ok: true }));
app.route('/api/auth', auth);
app.route('/api/public', publicApi);
app.route('/api/media', media);
app.route('/api/admin', admin);
app.route('/api/shop', shop);
app.route('/api/shop/bills', bills);
app.route('/api/shop/customers', customers);
app.route('/api/shop/staff', staff);
app.route('/api/shop/me', me);
app.route('/api/shop/queue', queue);
app.route('/api/shop/reports', reports);

app.notFound((c) => c.json({ error: { code: 'not_found', message: 'Not found.' } }, 404));

app.onError((err, c) => {
  if (err instanceof ApiError) return c.json({ error: { code: err.code, message: err.message } }, err.status);
  console.error('Unhandled', c.req.method, c.req.path, err);
  return c.json({ error: { code: 'internal', message: 'Something went wrong. Please try again.' } }, 500);
});

export default {
  fetch: app.fetch,
  // Nightly housekeeping. Plan expiry is handled lazily on each request, so nothing here is critical.
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(
      env.DB.batch([
        env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now()),
        env.DB.prepare('DELETE FROM rate_limits WHERE window_start < ?').bind(now() - 2 * DAY),
      ]),
    );
  },
} satisfies ExportedHandler<Env>;
