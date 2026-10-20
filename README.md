# SnipMemory

**The memory of every haircut.** SnipMemory saves 4-angle photos and the exact cut recipe (guards, lengths, neckline, beard, colour formula) for every client. When a client is due back, it sends a WhatsApp/SMS nudge. Any stylist can repeat any cut, and regulars stay regular.

- **Salons and barbershops** get client lookup by phone, guided photo capture with on-device face blur, *Repeat last cut*, smart return-cycle reminders with revenue attribution, a team with station PINs, and billing.
- **Clients** get a free **Style Passport** (`/passport`). They can see every cut, share their history with a new salon by OTP, stop reminders, download their data or erase it.
- **SnipMemory operators** get an admin console with MRR, signups, churn, salon controls, audited support access, a plan and price editor, announcements, message delivery and the audit log.

See [`docs/BUSINESS_PLAN.md`](docs/BUSINESS_PLAN.md) for customers, market, pricing and go-to-market, and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how it's built.

## Stack

| Layer | Tech |
|---|---|
| API | Cloudflare Workers + [Hono](https://hono.dev), Zod validation |
| Database | Cloudflare D1 (SQLite) with SQL migrations in `migrations/` |
| Photos | Cloudflare R2 (private; served through an authorised endpoint) |
| Jobs | Cron Trigger every 15 min (reminders, trials, credits, cleanup) |
| Web | React 19 SPA + React Router + Tailwind CSS v4, built by Vite and served by the same Worker |
| Payments | Stripe Checkout, Billing Portal and webhooks |
| Messaging | WhatsApp Cloud API (templates) with Twilio SMS fallback; Resend for email |
| Tests | Vitest inside `workerd` via `@cloudflare/vitest-plugin` |

## Run it locally

```bash
npm install
npm run db:migrate:local      # create the local D1 schema
npm run dev                   # http://localhost:5173 — Worker + SPA with local D1/R2
npm run seed:demo             # in a second terminal: demo salon, team, clients, photos
```

Demo logins created by the seeder:

| Who | Login |
|---|---|
| Salon owner (Fade Lab) | `demo@snipmemory.app` / `demo-password` |
| Platform admin | `admin@snipmemory.app` / `admin-password` → `/admin` |
| Stylists (after pairing a device from **Team → Pair this device**) | Ravi PIN `1111`, Maya PIN `2222` |
| Client passport | `/passport`, India, `98470 12345` |

In development, nothing is sent externally. Messages are only logged, OTP codes and reset links are shown on screen, and upgrades activate without payment ("test mode").

```bash
npm test          # API integration tests in workerd
npm run typecheck
npm run build
```

## Deploy to Cloudflare

```bash
npx wrangler login
npx wrangler d1 create snipmemory                 # paste database_id into wrangler.jsonc (top level and env.production)
npx wrangler r2 bucket create snipmemory-media
npm run db:migrate:remote -- --env production

# secrets (only the ones you use)
npx wrangler secret put STRIPE_SECRET_KEY --env production
npx wrangler secret put STRIPE_WEBHOOK_SECRET --env production
npx wrangler secret put WHATSAPP_TOKEN --env production
npx wrangler secret put WHATSAPP_PHONE_NUMBER_ID --env production
npx wrangler secret put WHATSAPP_REMINDER_TEMPLATE --env production   # e.g. rebooking_reminder:en
npx wrangler secret put WHATSAPP_OTP_TEMPLATE --env production        # e.g. passport_code:en
npx wrangler secret put TWILIO_ACCOUNT_SID --env production
npx wrangler secret put TWILIO_AUTH_TOKEN --env production
npx wrangler secret put TWILIO_FROM --env production
npx wrangler secret put RESEND_API_KEY --env production
npx wrangler secret put EMAIL_FROM --env production

CLOUDFLARE_ENV=production npm run build
npx wrangler deploy
```

Then:

1. **Stripe:** add a webhook endpoint at `https://<your-domain>/api/webhooks/stripe` for `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid` and `invoice.payment_failed`, and enable the Billing Portal. Plan prices come from Admin → Plans (inline `price_data`), or set Stripe price IDs there.
2. **WhatsApp:** get two templates approved:
   - a *marketing* template whose body takes `{{1}}` first name, `{{2}}` salon, `{{3}}` days and `{{4}}` booking link;
   - an *authentication* template with a copy-code button.
3. **Platform admin:** for safety, admin rights are never granted by signup in production. Sign up normally, then run:
   ```bash
   npx wrangler d1 execute snipmemory --remote --env production \
     --command "UPDATE users SET is_platform_admin = 1 WHERE email = 'you@yourcompany.com'"
   ```

## Configuration

| Variable | Purpose |
|---|---|
| `APP_ENV` | `development` / `production`. Production hides dev codes and disables test-mode billing |
| `APP_URL` | Public origin, used in links (reminders, invites, Stripe return URLs) |
| `MESSAGING_PROVIDER` | `log` (dev) or `live` |
| `OTP_CHANNEL` | `sms` or `whatsapp` |
| `PLATFORM_ADMIN_EMAILS` | Dev-only convenience: these signups become admins (ignored in production) |

## What changed from v1

v1 was a Next.js front-end prototype: data in `localStorage`, plaintext passwords, a hard-coded OTP, and simulated billing and admin. v2 is a full rebuild with a real multi-tenant backend on Cloudflare. The reasoning, and the revised pricing and go-to-market, are in the business plan.
