# Architecture

```
                ┌──────────────────────────── Cloudflare ─────────────────────────────┐
 Browser  ───►  │  Worker "snipmemory"                                                 │
 (React SPA,    │   ├─ Static assets (web/ build) — SPA fallback for every non-API path │
  PWA)          │   ├─ Hono API  /api/*  and  /u/:token (unsubscribe)                   │
                │   └─ Cron */15 min → maintenance + reminder dispatcher               │
                │        │            │                 │                               │
                │        ▼            ▼                 ▼                               │
                │   D1 (SQLite)   R2 (photos,      Outbound HTTPS                      │
                │   all records    private)        Stripe · WhatsApp Cloud · Twilio ·  │
                │                                  Resend                              │
                └──────────────────────────────────────────────────────────────────────┘
```

A single Worker serves the UI and the API, so there's no CORS, cookies stay first-party, and there is one deploy. `@cloudflare/vite-plugin` builds both and runs the Worker in `workerd` during `vite dev`.

## Repository layout

```
worker/src/
  index.ts            Hono app, CSRF origin check, error handler, cron entry
  env.ts, types.ts    Bindings, row and context types
  lib/
    session.ts        Cookie sessions (user / station / client) and salon access resolution
    crypto.ts         PBKDF2 hashing, random tokens, HMAC
    plans.ts          Plan capabilities and quotas, prices, credit packs
    reminders.ts      Smart cadence, template rendering, dispatcher
    messaging.ts      WhatsApp Cloud API / Twilio / log provider, credits
    otp.ts            6-digit codes (hashed, 5 attempts, 10 min)
    stripe.ts         Minimal REST client and webhook signature verification
    email.ts          Resend (or log in dev)
    maintenance.ts    Trial expiry, past-due fallback, credit resets, cleanup
  routes/             auth, salon (settings/dashboard/team), station, clients (+visits/photos),
                      reminders, billing (+Stripe webhook), passport, media, public, admin
web/src/
  App.tsx             Routes (marketing, auth, /app, /station, /passport, /admin)
  lib/                api client, auth & salon contexts, formatting, image processing
  components/         UI kit, AppShell, Camera, VisitCard, ClientForm, PlanCards
  pages/              marketing/, auth/, app/, station/, passport/, admin/
migrations/           D1 schema (applied by wrangler and by tests)
test/                 Integration tests that run inside workerd (@cloudflare/vitest-plugin)
scripts/seed-demo.mjs Local demo data through the real API
```

## Identity & access

| Session cookie | Who | How | Lifetime |
|---|---|---|---|
| `sm_session` | Owners, managers, stylists with a login, platform admins | Email + password (PBKDF2-SHA256, 100k iterations) | 30 days; 1 h for support impersonation |
| `sm_station` | A shared salon device | The owner pairs it from Team; stylists unlock it with a 4–6 digit PIN (hashed, rate limited) | 180 days, unlock lasts 12 h |
| `sm_passport` | End clients | Phone OTP | 30 days |

Tokens are 256-bit random values. Only their SHA-256 hash is stored in `sessions`. Cookies are `HttpOnly; SameSite=Lax; Secure` in production, and mutating `/api/*` requests must also carry a same-origin `Origin` header.

Every salon route goes through `salonAccess(permission)`:

- `station`: any device paired to the salon, even when locked.
- `floor`: look up clients and record visits. Any active member, or an unlocked station.
- `manage`: owner or manager signed in with their own account. Team, settings, erase, export.
- `owner`: billing.

Platform admins pass `requirePlatformAdmin`. An impersonation session never carries admin powers and cannot start a checkout. Starting and ending one is written to `audit_log` along with the reason given.

## Data model (D1)

`plans`, `plan_prices` (per currency and interval) · `users` · `salons` (tenant: plan, status, credits, reminder settings) · `members` (user ↔ salon with role and PIN; stylists may have no login) · `invites` · `sessions` · `passports` (global client identity by E.164 phone) · `clients` (per salon, with consent timestamps, unsubscribe token, cached stats, `next_reminder_at`) · `visits` (service, tags, technique JSON, notes, price, `repeat_of_visit_id`, `recovered_by_message_id`) · `photos` (R2 keys) · `passport_shares` · `otp_codes` · `messages` · `payments` · `webhook_events` · `audit_log` · `announcements` · `rate_limits` · `password_resets`.

Tenancy: every salon-scoped query is filtered by the `salon_id` that comes from the resolved access, never from request input alone.

## Key flows

**Visit capture.** The browser downscales each frame to ≤1440 px JPEG, and the front view can be pixelated (Shape Detection API if available, otherwise the guide's face zone). The visit is created first, then each angle is uploaded with `PUT …/photos/:angle`. The API refuses the upload unless the client's photo consent is recorded. Objects live at `salons/{salon}/visits/{visit}/{angle}-{id}.jpg` and are only served through `GET /api/media/:id` after an access check: the same salon, the client themself, or a salon the client has shared their passport with.

**Smart cadence.** After every visit change, `refreshClientSchedule` recomputes the client's visit count, total spend, last visit and `next_reminder_at`, as last visit plus cadence. Cadence is the per-client override if set; otherwise the median of the last 5 gaps once there are 3 or more visits (gaps under 3 days are ignored, clamped to 7–120 days); otherwise the salon default.

**Reminder dispatch (cron).** It considers salons on a plan with `automated_reminders`, with credits left, inside their local send window (`Intl` time zones). For each due client with marketing consent who hasn't opted out, it spends a credit (monthly allowance first, then purchased credits), sends via WhatsApp template (SMS fallback) or SMS, logs the message and clears `next_reminder_at`. A failed send refunds the credit. Clients without consent stay in the manual queue, where staff send a pre-filled `wa.me` link. That costs nothing and is still logged, so attribution keeps working.

**Attribution.** When a visit is recorded, the most recent sent reminder to that client since their previous visit (within 30 days) is stored in `visits.recovered_by_message_id`. The dashboard and admin metrics add these up.

**Style Passport sharing.** Staff request a code, which goes to the client's phone. The client reads it out, and `passport_shares` (passport, salon) is upserted. The new salon then sees the other salons' visits for that passport and may repeat them. The client can revoke access at any time.

**Billing.** Checkout uses Stripe Checkout, with inline `price_data` when no Stripe price ID is configured, so prices are managed in Admin → Plans. Webhooks are verified with HMAC-SHA256 and are idempotent via `webhook_events`. Without a Stripe key outside production, upgrades activate immediately ("test mode").

**Lifecycle (cron).**
- When a trial ends, the salon moves to Free.
- A salon past due for more than 14 days moves to Free.
- The monthly reminder allowance is reset.
- Expired sessions, OTPs and rate-limit windows are pruned.
- Trial expiries and churn are written to `audit_log` for metrics.

## Scaling notes

- D1 is a single SQLite database. That is comfortably fine for tens of thousands of salons at this write volume. If needed, shard by region (one D1 per region, with routing by salon id prefix).
- The cron dispatcher handles up to 500 messages per run (2,000 per hour). Move to Cloudflare Queues when volume requires it; `sendAutomatedReminder` is already a self-contained unit of work.
- Rate limiting is a D1 fixed window. Swap in the Workers Rate Limiting binding under heavy abuse.
