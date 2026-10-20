import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import type { Env } from './env';
import type { AppEnv } from './types';
import { ApiError } from './lib/http';
import { runMaintenance } from './lib/maintenance';
import { dispatchReminders } from './lib/reminders';
import admin from './routes/admin';
import auth from './routes/auth';
import billing, { stripeWebhook } from './routes/billing';
import clients, { visits } from './routes/clients';
import media from './routes/media';
import passport from './routes/passport';
import publicApi, { unsubscribe } from './routes/public';
import reminders from './routes/reminders';
import salon from './routes/salon';
import station, { stationPairing } from './routes/station';

const app = new Hono<AppEnv>();

app.use('*', secureHeaders({ crossOriginResourcePolicy: 'same-origin' }));

// CSRF: cookie-authenticated mutations must come from our own origin.
app.use('/api/*', async (c, next) => {
  const method = c.req.method;
  if (method !== 'GET' && method !== 'HEAD' && !c.req.path.startsWith('/api/webhooks/')) {
    const origin = c.req.header('origin');
    const host = new URL(c.req.url).host;
    if (origin && new URL(origin).host !== host) {
      return c.json({ error: { code: 'bad_origin', message: 'Cross-site request blocked.' } }, 403);
    }
  }
  await next();
  if (!c.res.headers.has('cache-control')) c.res.headers.set('cache-control', 'no-store');
});

app.get('/api/health', (c) => c.json({ ok: true, env: c.env.APP_ENV }));
app.route('/api/auth', auth);
app.route('/api/public', publicApi);
app.route('/api/passport', passport);
app.route('/api/station', station);
app.route('/api/media', media);
app.route('/api/admin', admin);
app.route('/api/webhooks/stripe', stripeWebhook);
app.route('/api/salons/:salonId', salon);
app.route('/api/salons/:salonId/station', stationPairing);
app.route('/api/salons/:salonId/clients', clients);
app.route('/api/salons/:salonId/visits', visits);
app.route('/api/salons/:salonId/reminders', reminders);
app.route('/api/salons/:salonId/billing', billing);
app.route('/u', unsubscribe);

app.notFound((c) => c.json({ error: { code: 'not_found', message: 'Not found.' } }, 404));

app.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json({ error: { code: err.code, message: err.message } }, err.status);
  }
  console.error('Unhandled error', c.req.method, c.req.path, err);
  return c.json({ error: { code: 'internal', message: 'Something went wrong. Please try again.' } }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(
      (async () => {
        await runMaintenance(env);
        const stats = await dispatchReminders(env);
        if (stats.sent || stats.failed) console.log('reminders dispatched', stats);
      })(),
    );
  },
} satisfies ExportedHandler<Env>;

export { app };
