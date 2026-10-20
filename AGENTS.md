# Working on SnipMemory

- Stack: Cloudflare Worker (Hono, `worker/src`) + D1 + R2, and a React 19 SPA (`web/src`) built by Vite with `@cloudflare/vite-plugin`. There is no Next.js in this project any more.
- Schema changes go in a **new** numbered file in `migrations/`. Never edit an applied migration.
- Every salon-scoped route must use `salonAccess(...)` and filter by `c.get('access').salon.id`.
- Before committing, run `npm run typecheck` and `npm test`; both must pass. Tests run inside workerd and apply all migrations.
- Read `docs/ARCHITECTURE.md` for the access model, flows and data model, and `docs/BUSINESS_PLAN.md` for product intent.
