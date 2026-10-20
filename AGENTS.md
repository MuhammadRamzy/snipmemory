# Working on SnipMemory

- Product: POS + ERP for Indian salons. Two PWAs (`/owner`, `/staff`) plus `/admin`, all served by one Cloudflare Worker (Hono + D1 + R2). No payment gateway, SMS or email providers — keep it that way unless asked.
- Users are barbers with little tech experience: big touch targets, bottom sheets (never `window.confirm`), PIN pads, plain words (udhaar, galla, kharcha). Wrap every UI string in `t()` from `web/src/lib/i18n.ts`.
- Bill maths lives in `shared/billing.ts` and is used by both the Worker and the SPA — change it in one place and keep the tests green.
- Every `/api/shop/*` route must use `shopAccess(...)` and filter by `c.get('ctx').shop.id`. Enforce staff restrictions on the server, not just in the UI.
- Schema changes go in a new numbered file in `migrations/`; never edit an applied migration.
- Before committing: `npm run typecheck` and `npm test` must pass.
