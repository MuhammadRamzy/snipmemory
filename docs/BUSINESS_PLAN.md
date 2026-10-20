# SnipMemory — Business Plan (v2)

> **One line:** SnipMemory is the memory of every haircut. It keeps 4-angle photos and the exact clipper and scissor settings for every client, and it sends a WhatsApp nudge when a client is due back. Regulars stay regular.

---

## 1. Why v1 had to be rebuilt

The first version showed the idea well, but it could not have made money in that form:

| v1 | Problem | v2 |
|---|---|---|
| All data in the browser's `localStorage`, plaintext passwords, a "magic" OTP of `123456`, simulated billing | It was a demo, not a product. Clients couldn't be shared across devices, and the data was lost when the cache was cleared. | Cloudflare Workers + D1 + R2, hashed credentials, real OTP and Stripe |
| Priced **per client count**, at $29/$79/$149 | It punished salons for growing, and it cost too much for barbershops in the markets that need this most (India, GCC). | Priced **per chair/location** with localized prices. A Free tier drives product-led growth |
| Positioned as a generic "premium B2B SaaS" with feature sprawl (clipper timer, product recommender, glassmorphic card forms) | No sharp job-to-be-done, and it took effort to explain. | Two jobs, done well: **repeat the cut** and **bring them back** |
| Cross-salon "transfer" copied another salon's data with a fake OTP | A privacy and legal liability | **Style Passport**: the client owns their history, sharing is consent-first by OTP, and the client can revoke access or erase their data |
| No measurement of value | Owners couldn't see ROI, so they would churn | **Recovered-revenue attribution**: "reminders brought back 14 clients, ₹6,300" |

---

## 2. Who it is for

### Customer segments (who pays)

| Segment | Size of shop | What they care about | Plan fit |
|---|---|---|---|
| **Independent barber / booth renter** | 1 chair | Remembering 200+ regulars and keeping the chair full | Free → Solo |
| **Neighbourhood barbershop** (core) | 2–6 chairs | Consistency when the regular's barber is off, and fewer lost regulars | Studio |
| **Unisex / women's salon** | 3–10 chairs | Colour formulas, layer and length notes, longer cycles (6–8 weeks) | Studio |
| **Chains & franchises** | 3–100 locations | Brand consistency, stylist performance, multi-branch clients | Multi-location |
| **Barber academies** | — | Teaching students to document cuts. A distribution channel | Partner programme |

### Users (who touches it)

| User | Job to be done | Where in the product |
|---|---|---|
| **Owner** | "Show me it's making money; keep my team consistent; keep me compliant" | Dashboard (recovered revenue), Team, Billing, Settings, CSV export |
| **Manager / front desk** | "Find the client fast, log the visit for the right stylist, nudge overdue clients" | Clients, Reminders, assign stylist on visits |
| **Stylist / barber** | "Who's this? How did we cut them last time? Save today's cut in 20 seconds" | Station mode (PIN), search, Repeat last cut, guided camera |
| **Client (end consumer)** | "Get the same cut anywhere; don't spam me; let me delete my photos" | Style Passport (`/passport`), one-tap opt-out link |
| **SnipMemory ops** | "Grow MRR, support salons safely, catch problems early" | Admin console: metrics, salon controls, audited impersonation, plans, announcements, message log |

### Key scenarios the product is built around

1. **The regular walks in.** The stylist types 4 digits of the phone number, sees the last cut's photos and recipe, and taps *Repeat last cut*.
2. **The regular's barber is off.** Another stylist opens the same record and gets the exact guard numbers and the neckline. The client leaves happy and stays with the shop.
3. **A new client who has been to another SnipMemory salon.** The new salon requests the Style Passport, the client reads out an OTP, and the history is unlocked. The client's approval is recorded.
4. **A colour client.** The formula, developer and timing are kept per visit, so there's no guessing at the next root touch-up.
5. **A client drifting away.** Day 24 of a 21-day rhythm: an automatic WhatsApp goes out inside salon hours. The client books, and the visit is credited as *recovered*.
6. **A Free-plan barber with no budget.** The reminders queue gives a one-tap *WhatsApp* button with a pre-written message, sent from the barber's own WhatsApp at no cost.
7. **A shared tablet at the front desk.** The owner pairs it once. Stylists tap their name and enter a PIN, and every visit is attributed correctly.
8. **A client asks to be forgotten.** They erase their data at that salon from the passport, or the owner erases it from the client page. Photos are purged from R2.
9. **A support ticket.** Admin opens the salon as support. This requires a reason, lasts 1 hour, records every action in the audit log, and blocks billing actions.
10. **A failed card.** The salon goes to *past due* and the owner sees a banner. After 14 days it falls back to Free. Nothing is deleted, and automated reminders stop.

---

## 3. Positioning & competition

**Positioning:** *the memory layer for the chair*. SnipMemory **sits next to** whatever the shop uses for bookings (Fresha, Booksy, Squire, Square, WhatsApp, a paper diary). The salon's booking link is placed in every reminder. We don't ask a shop to switch its booking system, and that removes the biggest objection in this market.

| | Booking suites (Booksy, Fresha, Squire, Vagaro) | Indian salon ERPs (Zylu, Salonist, Dingg, Easy Salon) | **SnipMemory** |
|---|---|---|---|
| Core job | Appointments, payments, marketplace | Billing/POS, inventory, staff payroll | **Repeat the cut + bring them back** |
| Haircut photos | Generic attachments, if any | Rare | **Guided 4-angle capture, face blur, "last time" overlay** |
| Structured cut recipe | Free-text notes | Free-text notes | **Sides / top / neckline / beard / colour fields** |
| Return reminders | Fixed-interval campaigns | SMS blasts | **Learns each client's rhythm; WhatsApp-first; attribution** |
| Portable client history | No | No | **Style Passport (network effect)** |
| Price signal | Booksy ≈ $29.99/mo + $20/extra staff; Fresha "free" + ~2.19% + $0.20 per payment; Squire $30–$250/mo | ₹500–₹3,000/mo | **Free → ₹299 / $12 per chair** |

**Moat over time:** the Style Passport. Every client who sees their history at salon A makes salon B more likely to adopt SnipMemory, because "your new client's history is waiting for you". The more salons in a city use it, the more valuable it is for every salon there, and that is hard to copy for a booking app whose marketplace competes with its own shops.

---

## 4. Market

### Sizing (conservative, bottom-up)

| Market | Shops (estimate) | Basis |
|---|---|---|
| United States — barbershops only | **~155,000** businesses (2025) | IBISWorld |
| India — organized salons | **~13,000** organized + several hundred thousand unorganized outlets; ~110,000 rural salons alone | Ken Research |
| GCC (UAE, KSA, Qatar, Kuwait, Oman, Bahrain) | ~25,000–35,000 (our estimate, high barbershop density per capita) | Assumption, to validate |
| UK & Ireland | ~40,000 hair & barber businesses (our estimate) | Assumption, to validate |

- **SAM (serviceable now):** urban shops with 1–10 chairs where the owner runs the business on a smartphone and WhatsApp, in India (top 30 cities), the GCC, the UK and the US. Our working estimate is **~350,000 shops**.
- **SOM (36 months):** 1.2% of SAM is **~4,000 paying shops** (plus ~15,000 Free shops feeding the passport network).
- Market value context: India salon services are ~US$7.8–12.6 B (2025, varies by source); US barbershop revenue is ~US$7.0 B.

### Launch sequence

1. **Home market: India (South India first), WhatsApp-native.** Field sales are cheap, density is high, and barber–client loyalty is strong. INR pricing is tuned for this market.
2. **GCC (Month 6+):** a large South Asian barber workforce with operator networks that span India and the GCC, high ticket prices and AED pricing. Strong word of mouth along that corridor.
3. **UK (Month 9+):** a dense barbershop culture with high WhatsApp usage, UK GDPR-ready from day one.
4. **US (Month 12+):** the largest pool of barbershops. Positioned as a Booksy/Squire *companion*. SMS-first channel.

---

## 5. Pricing (implemented in `migrations/0001_init.sql`, editable in Admin → Plans)

The value metric is **chairs and reminders**, never clients. Annual billing gives 2 months free.

| Plan | Who | INR / mo | USD / mo | GBP | AED | Includes |
|---|---|---|---|---|---|---|
| **Free** | 1 chair trying it | ₹0 | $0 | £0 | 0 | 1 stylist, 75 clients, photos & recipes, click-to-send WhatsApp, passport |
| **Solo** | Independent barber | ₹299 | $12 | £10 | 45 | Unlimited clients, 100 automated reminders, smart cycle, recovered-revenue report |
| **Studio** ★ | 2–6 chairs | ₹899 | $39 | £32 | 145 | 6 stylists, station mode + PINs, 400 reminders, passport import, team analytics, CSV |
| **Multi-location** | Chains (per location) | ₹1,999 | $79 | £65 | 290 | Unlimited stylists, 1,000 reminders, branding, priority support, migration |

- **Trial:** 14 days of Studio with 50 reminder credits and no card. At the end the salon **falls back to Free automatically** and no data is deleted. A lockout would cause churn and resentment; falling back to Free keeps the salon in the passport network and keeps it upgradeable.
- **Usage revenue:** reminder credit packs (250 for ₹349 / $6; 1,000 for ₹1,199 / $20) that never expire.
- **Referral:** when a referred salon converts to paid, both salons get 250 credits. The cost to us is cents, and it is seen as worth about ₹350.

### Why these numbers

- A Studio shop with 300 active clients typically has ~75 clients a month go past their usual return date. If reminders win back **6%** of them at a ₹400 ticket, that is **₹1,800/month recovered, 2× the price**. The in-app ROI calculator shows exactly this.
- Solo is priced below a single haircut in every market. That price clears the impulse threshold for owner-operators.

---

## 6. Unit economics

**Infrastructure (Cloudflare).** A photo is ~120–250 KB after on-device compression, so a visit with 4 angles is ≈ 0.7 MB. A busy Studio shop doing 1,000 visits a month adds ~0.7 GB/month. At R2's **$0.015/GB-month** that is about **$0.01 per month**, and egress is free. Workers and D1 costs stay in single-digit dollars per month until we reach thousands of salons. **Infrastructure is <2% of revenue.**

**Messaging, the real cost of goods sold.** Rebooking nudges count as *marketing* messages on WhatsApp.

| Market | Cost / reminder (approx.) | Studio at 100% credit use | Studio at expected ~35% use |
|---|---|---|---|
| India (WhatsApp marketing ≈ ₹0.86 + 18% GST ≈ ₹1.02) | ₹1.02 | ₹408 of ₹899 (45%) | ₹143 (16%) |
| US (SMS ≈ $0.011 incl. carrier fees) | $0.011 | $4.40 of $39 (11%) | $1.54 (4%) |
| UK/GCC (WhatsApp marketing ≈ $0.03–0.05) | ~$0.04 | $16 of $39 (41%) | $5.60 (14%) |

- **Blended gross margin target: ≥ 80%.** Levers: the credit caps per plan (admin-editable); free click-to-send as the default for Free/Solo; credit packs priced at ~35% margin over the WhatsApp rate; OTP and passport codes are platform cost but go out only on demand and are rate limited.
- **Watch item:** heavy Indian Studio users. If median credit usage goes above 50%, cut Studio's included reminders to 300 for INR, or add a per-currency credit allowance.

**Acquisition and payback** (targets, to be validated in the pilot):

| | India (field + referral) | UK/GCC/US (digital + partners) |
|---|---|---|
| Blended CAC per paying shop | ₹2,500 (~$30) | $120 |
| ARPA (incl. packs) | ₹850 (~$10) | $42 |
| Gross-margin payback | ~3.5 months | ~3.5 months |
| Target logo churn | < 3% / month | < 2.5% / month |
| LTV : CAC | ≥ 3 : 1 | ≥ 3 : 1 |

---

## 7. Go-to-market

1. **Field "demo in the chair" (India, GCC).** A rep sits in on a slow afternoon, adds the shop's 10 most loyal regulars with photos, and leaves. Within 2 weeks the owner sees *"3 clients are due"*. The goal is **activation before the sales pitch**.
2. **Supplier partnerships.** Barber supply distributors and product brands (clippers, styling products) bundle 3 months of Studio with their trade orders, and we share credits as their loyalty currency.
3. **Barber academies.** Students use Free to build a documented portfolio. When they open a shop, they upgrade.
4. **Passport-led virality.** Every reminder and passport page carries "Powered by SnipMemory". A client who asks a non-user salon "can you see my passport?" gives us a warm lead (an invite-your-salon link is on the roadmap).
5. **Content on Instagram and YouTube.** Before/after "same cut, different barber" challenges, which show the product doing its job.
6. **Booking-app companion listing.** Partner listings and integrations (Booksy, Fresha, Square) in Year 2. Until then, a booking link field is enough.

### Activation & retention metrics (instrumented in the product)

| Stage | Metric | Target |
|---|---|---|
| Activation | ≥ 10 visits with photos in the first 7 days | 45% of signups |
| Habit | Weekly active shops (≥ 1 visit logged) | 70% of paid |
| Value | Recovered visits / shop / month (Dashboard "Brought back by reminders") | ≥ 4 |
| Conversion | Trial → paid | 18% (India), 25% (UK/US) |
| Expansion | Credit pack attach rate | 15% of paid shops |
| Network | Passport share requests / month | Grows with city density |

The admin console already reports signups, trial expiries, churn, MRR by currency, message delivery and recovered visits.

---

## 8. Financial outlook (36 months, base case)

Assumptions: 70% of paying shops in India (ARPA ~$10) and 30% elsewhere (ARPA ~$42), for a blended ARPA of ≈ $19.6. Monthly churn is 2.8%. Messaging is 12% of revenue and infrastructure 2%.

| | Month 6 | Month 12 | Month 24 | Month 36 |
|---|---|---|---|---|
| Free shops (passport network) | 900 | 3,000 | 9,000 | 15,000 |
| Paying shops | 150 | 600 | 2,000 | 4,000 |
| MRR | ~$2.9k | ~$11.8k | ~$39k | ~$78k |
| ARR run-rate | ~$35k | ~$141k | ~$470k | ~$940k |
| Gross margin | 82% | 84% | 85% | 86% |
| Team | 2 founders + 1 field rep | + 2 reps, 1 support | 8 people | 12 people |

- **Break-even** is reached at roughly 1,600–1,800 paying shops (about Month 20–22), on a lean team with a ~$30k monthly burn.
- **Capital need:** ~$250–350k pre-seed/angel to reach break-even with buffer. Most of it goes to field sales in two cities and WhatsApp Business API onboarding.

---

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| WhatsApp price rises or policy changes for marketing templates | Click-to-send fallback (free); SMS fallback; credit caps; prices editable per plan without deploys |
| Privacy and regulation (GDPR/UK GDPR, India DPDP Act 2023, UAE PDPL): photos of faces | Per-client photo consent, enforced by the API; on-device face blur; private R2 objects served only to authorised viewers; erasure and export for salons and clients; audited support access. **Get a legal review before launch** in each market |
| Booking platforms add photo notes | Our depth (structured recipe, cycle learning, attribution) and the cross-salon passport network |
| Stylists won't take photos when busy | 20-second guided capture, *Shoot all 4* auto-advance and station PINs. "Repeat last cut" pays the stylist back on the next visit |
| Salons fear competitors seeing their clients via the passport | Sharing happens only with the client's OTP; the client chooses. Salon notes are framed as a benefit to the client, which builds loyalty |
| Low willingness to pay in India | Free plan, ₹299 entry point, ROI shown in rupees on the dashboard, credits as a low-friction upsell |

---

## 10. Product roadmap

**Now (v2, this rebuild):** everything described above.

**Next 3 months**
- Inbound WhatsApp webhook: treat a "STOP" reply as an opt-out, track delivery and read receipts.
- Booking-link deep links (Fresha / Booksy / Square) and a "Book" button in the passport.
- Email verification at signup. Self-serve salon deletion with a 30-day grace period.
- Offline capture queue (Service Worker + IndexedDB) for flaky salon Wi-Fi.
- Razorpay as a payment provider for India (UPI AutoPay mandates).

**3–9 months**
- Client self check-in by QR at the door, which pulls up the record for the stylist automatically.
- Passport "invite this salon" flow (viral loop).
- Multi-location dashboard and cross-branch clients for chains.
- Stylist portfolio pages (opt-in public gallery with blurred faces) for client acquisition.

**9–18 months**
- AI cut recipe: suggest technique fields from the 4 photos and describe the cut in plain words for the next stylist (on-device first, privacy-preserving).
- Product retail recommendations and affiliate revenue with supplier partners.
- API and integrations marketplace.

---

## Sources

- IBISWorld — [Barber Shops in the US: number of businesses](https://www.ibisworld.com/united-states/number-of-businesses/barber-shops/5806/) and [market size](https://www.ibisworld.com/united-states/market-size/barber-shops/5806/)
- Ken Research — [India Beauty Salon Market](https://www.kenresearch.com/industry-reports/india-beauty-salon-market.md)
- Deep Market Insights — [India Salon Services Market](https://deepmarketinsights.com/vista/insights/salon-services-market/india)
- WhatsApp India rates — [Monty Mobile](https://montymobile.com/blogs/whatsapp-business-api-pricing-in-india-inr-rates-gst-and-the-2026-currency-migration-deadline), [baat.ai](https://baat.ai/blog/whatsapp-api-pricing-india), [MyOperator](https://myoperator.com/blog/whatsapp-business-api-pricing-india-2026)
- Competitor pricing — [Squire vs Booksy](https://getsquire.com/compare/squire-vs-booksy), [Software Advice: Squire](https://www.softwareadvice.com/barbershop-software/squire-profile/), [Capterra: Squire](https://www.capterra.co.za/reviews/153899/squire-barber-appointment-app)

Figures marked "estimate" or "assumption" must be validated during the pilot. Messaging rates change several times a year, so check Meta's and Twilio's current rate cards before budgeting.
