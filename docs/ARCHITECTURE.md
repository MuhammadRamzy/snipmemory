# Architecture

```
  Owner app (PWA, /owner) ─┐
  Staff app (PWA, /staff) ─┼──►  Cloudflare Worker "snipmemory"
  Admin (/admin)          ─┤      ├─ static assets: React SPA (Vite build), service worker
  Customer bill (/b/:id)  ─┘      ├─ Hono API /api/*
                                  └─ nightly cron (cleanup)
                                        │              │
                                        ▼              ▼
                                   D1 (SQLite)     R2 (cut photos, private)
```

There are no third-party services in the request path: no payment gateway, no SMS or WhatsApp API, no email. UPI QR codes are generated **on the phone** from the shop's own UPI ID, and WhatsApp messages open the user's own WhatsApp with a prepared text.

## Two installable apps, one codebase

- `/owner/*` and `/staff/*` are separate PWAs. An inline script in `index.html` picks `owner.webmanifest` or `staff.webmanifest` (different `id`, name, icon and theme colour) before the browser reads the manifest, so both can be installed side by side.
- Every API call carries `x-app: owner|staff`. The server keeps a **separate session cookie per app** (`sm_owner`, `sm_staff`, `sm_admin`), so the owner's phone can also run the staff app.
- `web/public/sw.js` caches the app shell and hashed assets: the app opens instantly and works offline. `/api/*` is never cached.

## Offline billing

1. The billing screen uses a cached catalogue (`localStorage`, per shop) and computes totals with `shared/billing.ts`, the **same module the server uses**.
2. Each bill gets a `clientRef` (UUID) when the bill screen opens.
3. If the POST fails with no network, the bill goes to the **outbox** (`web/src/lib/outbox.ts`) and the done screen says "Saved on this phone".
4. The outbox flushes on `online` events, every 30 s and on app start. The server treats `(shop_id, client_ref)` as unique and returns the existing bill on retries, so there are never duplicates. Bills rejected by the server (for example, the plan limit was reached) stay visible with the error until the user removes them.
5. Offline bills keep their device time, accepted if it is within the last 3 days.

## Data model (D1) — `migrations/0001_init.sql`

| Table | Purpose |
|---|---|
| `plans` | Free / Starter / Pro / Business: staff limit, monthly bill limit, INR prices, capability flags |
| `users` | People, keyed by phone (E.164). `pin_hash` (PBKDF2); `password_hash` only for platform admins |
| `shops` | Tenant: UPI ID, GST settings, bill numbering, staff rules, plan + expiry, trial flag |
| `staff` | User ↔ shop with role (`owner`/`manager`/`staff`), commission %, product commission %, salary |
| `services`, `products` | Price list; products carry cost and stock |
| `customers` | Per shop; `balance` (> 0 advance, < 0 udhaar) is a cache of `ledger` |
| `ledger` | Every khata movement: bill due, advance used, due paid, advance added, adjustment, cancellation reversal |
| `bills`, `bill_items` | POS records. Item-level `staff_id`, `net` (after discount share) and `commission`; `day` is the shop's local business date |
| `expenses`, `staff_txns`, `attendance`, `queue`, `closings`, `photos` | ERP modules |
| `subscription_payments` | Owner-submitted UPI UTRs awaiting admin approval |
| `sessions`, `rate_limits`, `audit_log`, `announcements` | Platform plumbing |

Money is integer paise. Bill numbers are allocated atomically inside the same D1 batch as the insert (`UPDATE shops SET next_bill_no …` then `INSERT … (SELECT next_bill_no - 1 …)`).

## Access control

`shopAccess(level)` resolves `{ app, user, shop, me (staff row), plan }` from the session:

- `any`: owner app or staff app user who is active in the shop.
- `manager`: owner app, role owner or manager.
- `owner`: owner app, role owner (shop settings, plan payments).

Staff-app rules are enforced on the server, not only in the UI:
- A bill's staff is always the logged-in person.
- Discounts and price reductions are limited by `staff_max_discount`.
- Staff only see their own bills (last 62 days).
- Staff can cancel only their own bill within 15 minutes.
- Phone numbers are masked when `staff_see_phone` is off.

Plan capabilities (`reports`, `commission`, `closing`, `queue`, `inventory`, `gst`, `attendance`, `photos`, `export`, `multi_shop`, …) are checked with `requireCap`. Quotas are checked with `assertStaffQuota` and `assertBillQuota`. An expired paid plan or trial is downgraded to Free **lazily** on the next request, so the business logic doesn't depend on the cron.

Security basics:
- PBKDF2-SHA256 with 100k iterations for PINs and passwords.
- Opaque random session tokens, stored hashed.
- Weak-PIN blocklist.
- Login rate limits per phone and per IP.
- `Origin` check on mutating requests (CSRF).
- Private R2 photos, served only to people signed in to that shop.
- Audit log for price changes, cancellations, PIN resets, staff changes, support access and subscription decisions.

## Subscriptions without a gateway

1. The owner chooses a plan in the app, which shows a UPI QR for SnipMemory's VPA (`PLATFORM_UPI_VPA`) with the exact amount and a shop reference.
2. The owner submits the UTR (unique across all non-rejected payments).
3. An admin checks the bank statement and approves. The shop's `plan_expires_at` is extended (stacked on any remaining time of the same plan).

## Code map

```
shared/billing.ts            Pure bill maths (discount split, GST incl/excl, commission) — used by Worker and SPA
worker/src/index.ts          Hono app, CSRF check, error handler, cron
worker/src/lib/              session (per-app cookies, shopAccess), plans (capabilities/quotas), crypto, day (IST dates), defaults (starter price lists)
worker/src/routes/           auth, shop (settings/catalogue/services/products/expenses/home/closing/subscription),
                             bills, customers (+ledger, photos), staff (+payroll, me, attendance), queue, reports, public, media, admin
web/src/owner|staff|admin    The three apps
web/src/shared/              BillFlow (POS), BillDone, Bills, BillDetail, Queue, Login, ChangePin, Help, offline banner
web/src/lib/                 api (x-app header), session, catalogue cache, outbox, upi (link + QR), receipt text, i18n, format (₹, IST)
test/pos.test.ts             API integration tests in workerd
scripts/                     seed-demo.mjs (local demo), create-admin.mjs
```
