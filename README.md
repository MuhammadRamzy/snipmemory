# SnipMemory

**Salon ka poora hisaab, ek phone mein.** POS + ERP for Indian salons, barber shops and beauty parlours, from a single chair to many branches, on any Android phone.

- **Owner app** (`/owner`): today's sale by UPI, cash and udhaar; barber-wise sales and commission; staff payroll (salary, advances, payouts); customers with udhaar/advance khata; expenses and profit; daily cash closing (galla); token queue; products and stock; GST bills; price list; branches; plan payment.
- **Staff app** (`/staff`): every barber logs in with mobile + 4-digit PIN, makes bills, shows the **UPI QR with the exact amount**, gives change, sends the bill on WhatsApp, and sees only their own cuts and earnings.
- **Customer bill** (`/b/:token`): WhatsApp-friendly bill with a *Pay balance* UPI button and a thermal-printer layout.
- **Admin** (`/admin`): MRR, active shops, UPI subscription verification, shop controls, owner PIN reset, support access, plan pricing.

No payment gateway, no SMS: payments go straight to the shop's UPI ID, and messages go through the owner's own WhatsApp. Bills work **offline** and sync later.

Read [`docs/BUSINESS_PLAN.md`](docs/BUSINESS_PLAN.md) for customers, workflows, pricing (Free / ₹149 / ₹349 / ₹699) and go-to-market, and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how it is built.

## Stack

Cloudflare Workers (Hono) · D1 · R2 · React 19 + React Router + Tailwind CSS v4 (Vite, `@cloudflare/vite-plugin`) · two PWAs with a service worker · Vitest in workerd.

## Run locally

```bash
npm install
npm run db:migrate:local
npm run dev            # http://localhost:5173
npm run seed:demo      # second terminal: demo salon with barbers, bills, udhaar, expenses
```

| App | URL | Login |
|---|---|---|
| Owner | `/owner` | mobile `9847000001`, PIN `482913` |
| Staff | `/staff` | Suresh `9847000002` PIN `4826`, Vinod `9847000003` PIN `7391` |
| Admin | `/admin` | phone `9847000099`, password `local-admin-password` |

On a phone, open the URL and choose **Add to Home screen**: the Owner and Staff apps install as two separate apps.

```bash
npm test           # API tests (workerd + D1)
npm run typecheck
npm run build
```

## Deploy

```bash
npx wrangler login
npx wrangler d1 create snipmemory               # put the id in wrangler.jsonc (top level and env.production)
npx wrangler r2 bucket create snipmemory-media
npm run db:migrate:remote -- --env production
# set PLATFORM_UPI_VPA, PLATFORM_UPI_NAME, SUPPORT_WHATSAPP, APP_URL in wrangler.jsonc → env.production.vars
CLOUDFLARE_ENV=production npm run build
npx wrangler deploy
node scripts/create-admin.mjs 98XXXXXXXX "Your Name" 'a-strong-password' --remote --env production
```

There are no secrets to configure: there is no gateway, SMS or email provider.

## Configuration (`wrangler.jsonc` vars)

| Var | Meaning |
|---|---|
| `APP_ENV` | `development` / `production` |
| `APP_URL` | Public URL used in links |
| `PLATFORM_UPI_VPA`, `PLATFORM_UPI_NAME` | Where shops pay their SnipMemory subscription |
| `SUPPORT_WHATSAPP` | Support number (digits with country code) shown in the apps |
