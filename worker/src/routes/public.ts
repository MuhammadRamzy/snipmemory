import { Hono } from 'hono';
import type { AppEnv, PlanRow, SalonRow } from '../types';
import { all, first, now, run } from '../lib/db';
import { notFound } from '../lib/http';
import { SUPPORTED_COUNTRIES } from '../lib/phone';
import { priceFor } from '../lib/plans';
import { serializePlan } from '../lib/serialize';

const publicApi = new Hono<AppEnv>();

publicApi.get('/plans', async (c) => {
  const currency = (c.req.query('currency') ?? 'USD').toUpperCase();
  const plans = await all<PlanRow>(c.env.DB, 'SELECT * FROM plans WHERE is_public = 1 ORDER BY sort_order');
  return c.json({
    currency,
    plans: await Promise.all(
      plans.map(async (plan) => {
        const month = await priceFor(c.env.DB, plan.id, currency, 'month');
        const year = await priceFor(c.env.DB, plan.id, currency, 'year');
        return {
          ...serializePlan(plan),
          prices: {
            month: month ? { amount: month.amount, currency: month.currency } : null,
            year: year ? { amount: year.amount, currency: year.currency } : null,
          },
        };
      }),
    ),
  });
});

publicApi.get('/announcements', async (c) => {
  const rows = await all<{ id: string; message: string; level: string }>(
    c.env.DB,
    'SELECT id, message, level FROM announcements WHERE active = 1 AND (expires_at IS NULL OR expires_at > ?) ORDER BY created_at DESC LIMIT 3',
    now(),
  );
  return c.json({ announcements: rows });
});

publicApi.get('/countries', (c) => c.json({ countries: SUPPORTED_COUNTRIES }));

publicApi.get('/salons/:slug', async (c) => {
  const salon = await first<SalonRow>(c.env.DB, 'SELECT * FROM salons WHERE slug = ? AND deleted_at IS NULL AND suspended_at IS NULL', c.req.param('slug'));
  if (!salon) throw notFound('Salon');
  return c.json({
    salon: {
      name: salon.name,
      slug: salon.slug,
      city: salon.city,
      address: salon.address,
      phone: salon.phone,
      bookingUrl: salon.booking_url,
      brandColor: salon.brand_color,
    },
  });
});

export default publicApi;

// ---------------------------------------------------------------------------
// One-click unsubscribe from reminder links: /u/:token
// GET shows a confirmation page (link scanners prefetch GETs), POST opts out.
// ---------------------------------------------------------------------------
export const unsubscribe = new Hono<AppEnv>();

const page = (title: string, body: string) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>body{font-family:system-ui,sans-serif;background:#f6f6f9;color:#111;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px}
main{background:#fff;border-radius:16px;padding:32px;max-width:420px;box-shadow:0 8px 30px #0001;text-align:center}button{background:#111;color:#fff;border:0;border-radius:10px;padding:12px 20px;font-size:16px;cursor:pointer}
p{color:#555;line-height:1.5}@media(prefers-color-scheme:dark){body{background:#0b0b10;color:#eee}main{background:#16161d}p{color:#aaa}button{background:#fff;color:#111}}</style></head><body><main>${body}</main></body></html>`;

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

unsubscribe.get('/:token', async (c) => {
  const row = await first<{ salon_name: string; opted_out_at: number | null }>(
    c.env.DB,
    'SELECT s.name AS salon_name, c.opted_out_at FROM clients c JOIN salons s ON s.id = c.salon_id WHERE c.unsubscribe_token = ?',
    c.req.param('token'),
  );
  if (!row) return c.html(page('Link expired', '<h1>Link expired</h1><p>This link is no longer valid.</p>'), 404);
  const name = escapeHtml(row.salon_name);
  if (row.opted_out_at) return c.html(page('Unsubscribed', `<h1>You're unsubscribed</h1><p>${name} won't send you reminders.</p>`));
  return c.html(
    page(
      'Stop reminders',
      `<h1>Stop reminders?</h1><p>You won't get haircut reminders from ${name} any more. Your style history stays safe.</p>
       <form method="post"><button type="submit">Stop reminders</button></form>`,
    ),
  );
});

unsubscribe.post('/:token', async (c) => {
  const res = await run(c.env.DB, 'UPDATE clients SET opted_out_at = COALESCE(opted_out_at, ?), next_reminder_at = NULL WHERE unsubscribe_token = ?', now(), c.req.param('token'));
  if (!res.meta.changes) return c.html(page('Link expired', '<h1>Link expired</h1><p>This link is no longer valid.</p>'), 404);
  return c.html(page('Unsubscribed', "<h1>Done</h1><p>You won't receive reminders any more. You can turn them back on from your Style Passport.</p>"));
});
