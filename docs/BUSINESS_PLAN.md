# SnipMemory — Business Plan (v3: POS + ERP for Indian salons)

> **One line:** *Salon ka poora hisaab, ek phone mein.* Billing with UPI QR, barber-wise commission, udhaar khata, expenses and daily cash for every salon, barber shop and beauty parlour in India, on the Android phone the owner already has. The owner gets one app, and every barber gets their own.

---

## 1. Why we pivoted

v2 was a "haircut memory + reminders" tool. It solved a real but *secondary* pain, and it depended on paid WhatsApp messages. Owners of small Indian shops don't buy that. They buy something that answers the questions they ask every night:

1. **"How much did we make today, and where is it — cash, UPI or udhaar?"**
2. **"How much did each barber do, and how much do I owe him?"**
3. **"Is the galla (cash drawer) short?"**
4. **"Who still owes me money?"**

Today most small shops answer these with a notebook, a calculator and the UPI app's history. Existing salon software (Zylu, Salonist, Dingg and others) is built for chains with a reception desk and a computer, and it costs ₹800–₹3,500 per month. **Nobody serves the 1–6 chair shop that runs on one phone.** That is the gap.

Haircut photos survive as a smaller Pro feature (cut photos on the customer profile). They are not the main product any more.

---

## 2. Who uses it

| Person | Reality | What they need from us | Where in the product |
|---|---|---|---|
| **Owner** (often also cuts hair) | Busy all day, checks the money at night, may run 2 shops | The day's money split by mode and barber, payroll, udhaar, profit, without typing | **Owner app** (teal): Home, Bills, Customers, Staff, Reports, Closing, Settings |
| **Barber / stylist** | Low tech confidence, shared or cheap phone, paid by commission | Make a bill fast, show QR, see "my earning today" | **Staff app** (saffron): one big *New bill* button, My bills, Me (earnings, advances) |
| **Manager / cashier** | Runs the counter in bigger salons | Everything the owner does, except money settings | Owner app with the *manager* role |
| **Customer** | Pays by UPI, wants a bill on WhatsApp | Exact amount pre-filled in their UPI app, a clean bill | QR on the barber's phone, `/b/:token` bill page with a *Pay balance* button |
| **SnipMemory ops** | Small team | Verify subscription UTRs, help owners on WhatsApp, reset PINs | Admin console |

**Designing for low-literacy users** (these are hard rules in the UI):
- Big tiles and buttons (48–64 px), a bottom tab bar, and one main action per screen.
- Login with a mobile number and a **UPI-style PIN pad**: 4 digits for staff, 6 for owners. No passwords or emails.
- Words barbers already use: *udhaar*, *galla*, *kharcha*, *advance*. Every money figure is shown in ₹ with Indian digit grouping (₹1,25,000).
- No browser pop-ups. Bottom sheets with a clear "Yes / No".
- Two apps with two colours, so the owner app and staff app can't be confused.
- Every string goes through `t()`, so **Hindi, Malayalam, Tamil, Telugu, Kannada, Marathi, Bengali and Gujarati** can be added without touching screens. The font (Noto Sans) supports Indic scripts.

---

## 3. Workflows we handle (from real salon days)

| Scenario | How SnipMemory handles it |
|---|---|
| Walk-in, pays by UPI | Tap services → *UPI / QR* → customer scans (amount pre-filled) → *Money received* → bill sent on WhatsApp |
| Cash with change | *Cash* → tap ₹500 → app shows **"Give back ₹350"** |
| Half UPI, half cash | *Part pay / Udhaar* → enter cash and UPI; show a QR for just the UPI part |
| Regular pays later | Customer mobile number + part pay → the rest goes on their **khata** as udhaar |
| Customer clears old udhaar while paying for today | The checkout shows *"Old udhaar ₹200 — collect now"*; one QR collects both |
| Advance (wedding season, monthly regulars) | *Add advance* on the customer; the next bill offers *"Use advance ₹X"* |
| Father + 2 kids, different barbers | The owner sets *who did* each line in the cart; commission is split per line |
| Owner also cuts | The owner is a staff member too and appears in barber-wise reports |
| Barber wants to give a discount | Allowed only within the owner's limit (e.g. 10%). Quietly lowering the price is blocked |
| Owner worried barbers will take customers | Hide customer mobile numbers from staff (setting) |
| Wrong bill | Staff can cancel their own bill within 15 minutes; the owner can cancel any bill. Udhaar, advance and stock are reversed, and a reason is recorded |
| No internet / power cut | Bills are saved on the phone and upload automatically, with no duplicates. The price list is cached |
| Sunday rush | **Token queue**: walk-ins get numbers, barbers tap *Start*, then *Make bill* from the token |
| Bridal / festival booking | Appointment in the queue + advance on the khata |
| Product sale (gel, oil) | Product tiles with stock; product commission %; low-stock warning; stock purchases recorded as an expense |
| Commission-only, salary-only or both | Per-staff service %, product %, fixed salary; advances, bonuses, deductions → **"Still to pay ₹X"** each month |
| Salary advance mid-month | *Give advance* (cash/UPI); it is deducted on the payroll screen and counted in cash closing |
| End of day | **Galla hisaab**: opening + cash bills + cash collections − cash expenses − cash to staff = expected; enter the counted cash, see short or extra |
| Rent, electricity, tea | Expenses by category → **profit estimate** in reports |
| GST-registered salon | GSTIN, 5/12/18%, prices inclusive or exclusive, CGST/SGST on the bill |
| Has a thermal printer | *Print* opens a 58/80 mm receipt layout. Without a printer, the bill goes on WhatsApp |
| Two branches | One login, switch shops from Home; each shop has its own staff, bills and plan |
| Barber forgets PIN / leaves the job | The owner resets the PIN, or removes the barber (logged out instantly, old bills kept) |
| Owner forgets PIN | WhatsApp support verifies the owner and issues a one-time PIN, which must be changed at next login |
| Customer not coming back | *Not coming* filter → one-tap WhatsApp "we miss you"; birthday list with WhatsApp wishes |

---

## 4. Market

- **Size:** roughly **5 lakh unorganised salons** (≈3 lakh barber shops + 2 lakh beauty parlours, by Jawed Habib's company study) plus **13,000+ organised salons**. The Indian salon services market is estimated at **US$7.8–12.6 billion (2025)**, depending on the source.
- **Serviceable now (SAM):** shops whose owner uses a smartphone and accepts UPI. That is nearly all urban and semi-urban shops; we estimate **~2.5 lakh**.
- **Who we beat:**

| | Zylu / Salonist / Dingg-type salon ERPs | Khatabook / Vyapar-type general billing | **SnipMemory** |
|---|---|---|---|
| Built for | Chains, reception desk, computer | Kirana / retail | **1–20 chair salons, phone only** |
| Barber-wise commission & payroll | Yes (complex) | No | **Yes, simple** |
| Separate barber app with PIN | Rare | No | **Yes** |
| UPI QR with the exact amount | Varies | Yes | **Yes, plus split and udhaar** |
| Price per month | ~₹800–₹3,500 (Salonist ~₹1,061–1,698; SalonBoost ₹799–1,199; Dingg-type ₹1,500–3,500 for 3–8 staff) | Free–₹300 | **Free, ₹149, ₹349, ₹699** |

Competitor prices are from public listings and are indicative; confirm with each vendor.

---

## 5. Pricing (self-serve by shop size, all in INR)

Each owner picks a plan by the number of people who make bills. Annual plans give 2 months free. **No payment gateway**: the owner pays our UPI ID from the in-app QR and types the UTR, and we approve after checking the bank statement.

| Plan | For | Monthly | Yearly | Limits & features |
|---|---|---|---|---|
| **Free** | 1-chair shop | ₹0 | ₹0 | Owner + 1 barber, **300 bills/month**, UPI QR bills, WhatsApp bills, customers & udhaar, expenses, today/yesterday report |
| **Starter** | Small shop | **₹149** | ₹1,490 | Up to 4 people, unlimited bills, barber commission & payroll, reports for any date, cash closing, token queue |
| **Pro** ★ | Busy salon | **₹349** | ₹3,490 | Up to 10 people, product stock, GST bills, attendance, cut photos, Excel/CSV export |
| **Business** | Big salon / branches | **₹699** per shop | ₹6,990 | Unlimited staff, all branches under one login, priority WhatsApp support, help moving old data |

- **Trial:** 30 days of Pro for every new shop, with no card. At the end the shop moves **automatically to Free**. Nothing is locked or deleted.
- **Why Free is limited by bills:** a 1-chair shop doing 10 cuts a day (≈300 a month) stays free and spreads the word. A shop doing 15+ cuts a day has the money to pay ₹149.
- **Price anchor:** Starter (₹149) costs less than two haircuts a month. We are 5–10× cheaper than salon ERPs because we have no field installs, no SMS costs and no gateway fees.
- Plans, prices and limits can be edited from the admin console without a deploy.

---

## 6. Operating cost (why we stay profitable at these prices)

**What we removed:** payment gateways, SMS and WhatsApp APIs, and email. Customers get bills through the *owner's* WhatsApp (click-to-send), and payments go to the *owner's* UPI.

**Infrastructure (Cloudflare):** Workers Paid is ~$5/month and includes 10M requests. D1 costs about $0.75/GB-month plus per-row charges, and R2 about $0.015/GB-month with free egress.

| Driver, per shop per month (40 bills/day) | Estimate |
|---|---|
| API requests (~10 per bill) | ~12,000 |
| D1 rows written (~7 per bill) | ~8,400 |
| Data stored (~2 KB per bill) | ~2.5 MB |
| Photos (Pro, optional, ~150 KB each) | ~0–20 MB |
| **Infra cost per shop** | **≈ ₹1–3 per month** |

At 10,000 shops, infrastructure is roughly **₹25,000–40,000/month**, under 2% of revenue.

**The real costs are people:**
- **Payment verification.** At 10k paying shops with 70% on annual plans, that is ~3,600 UTR checks a month (~120/day ≈ 4 hours of one person). This becomes a bank-statement CSV auto-match in admin (roadmap), cutting it to minutes.
- **WhatsApp support** in regional languages: 1 agent per ~2,000 paying shops.
- **Field onboarding** in launch clusters (see GTM).

**Blended ARPA estimate:** 55% Starter, 35% Pro, 10% Business, with 70% on annual plans, comes to **≈ ₹240/month per paying shop**. Gross margin is **~95%** after infrastructure; contribution margin is ~80% after support and verification.

---

## 7. Go-to-market

1. **Cluster field sales.** Barber shops sit in clusters (market roads, bus stands). A field agent signs up 8–12 shops a day by setting up the price list and UPI ID on the owner's phone in 5 minutes and making the first real bill with them. Agents are paid per **activated** shop (10+ bills in 7 days).
2. **The staff app spreads itself.** Every barber added gets an app link on WhatsApp. Barbers change shops often and carry the app to their next employer. Referral reward: **1 month free** for both shops when the referred shop pays (applied from the admin console for now, automatic later).
3. **Supply distributors and brands.** Barber-supply wholesalers and grooming brands bundle 3 months of Starter with trade orders.
4. **Short videos in Hindi, Malayalam, Tamil and Telugu** (YouTube Shorts, Instagram Reels): "End-of-day hisaab in 10 seconds", "Barber's salary without fights".
5. **Launch order:** Kerala and Tamil Nadu (high UPI use, dense barber clusters) → Karnataka and Telangana → Maharashtra and Gujarat → Hindi belt, after the Hindi UI ships.

### Metrics that matter

| Stage | Metric | Target |
|---|---|---|
| Activation | 10+ bills in first 7 days | 60% of signups |
| Habit | Shops billing on 5+ days a week | 70% of active shops |
| Team adoption | Shops where 2+ people bill | 45% |
| Conversion | Trial → paid by day 45 | 15–20% |
| Retention | Monthly paid logo churn | < 3% |
| Expansion | Starter → Pro upgrades within 6 months | 20% |

The admin console already tracks shops, trials, paid shops, MRR, shops billing in the last 7 days, bills and GMV (money billed through the POS), pending payments and signups.

---

## 8. Financial outlook (base case, 36 months)

Assumptions: ARPA ₹240/month; Free → paid conversion grows as features and word of mouth mature; 2.5% monthly churn.

| | Month 6 | Month 12 | Month 24 | Month 36 |
|---|---|---|---|---|
| Free shops | 3,000 | 9,000 | 25,000 | 45,000 |
| Paying shops | 400 | 1,800 | 5,500 | 10,000 |
| MRR | ₹0.96 L | ₹4.3 L | ₹13.2 L | ₹24 L |
| ARR run-rate | ₹11.5 L | ₹52 L | ₹1.6 Cr | ₹2.9 Cr |
| Team | 2 founders + 2 field agents | + 2 support, 4 agents | 15 | 22 |

- **Break-even** is about **₹8–9 L MRR** (≈3,500–3,800 paying shops) on a lean team, expected around **Month 18–20**.
- **Upside** (not in the base case): optional add-ons later, such as a paid Bluetooth-printer bundle, regional-language premium support, and a "SnipMemory Pay" UPI auto-confirmation partnership if owners ask for it.

---

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Owners won't pay | A free plan that genuinely works; ₹149 entry price; pricing tied to shop size; value shown daily (galla match, barber payroll) |
| Fake or wrong UTRs | Approve only after matching the bank statement; UTR uniqueness enforced; audit log |
| Manual verification doesn't scale | Push annual plans; build bank-statement CSV auto-match; later, optional UPI Autopay if the owner wants it |
| Barbers misuse the staff app (fake discounts, deleting bills) | Discount caps, no silent price lowering, 15-minute self-cancel window, every cancellation needs a reason and is audited, owner sees everything |
| Phone lost or shared | Sessions per app, PINs rate-limited (6 tries / 15 min), owner removes staff instantly |
| Internet drops | Offline outbox with idempotent upload; cached catalogue and shop data |
| Data protection (DPDP Act 2023) | Minimal data, private photos, owner can delete customers, no messages sent by us; get a legal review before launch |
| Competitors copy the price | Our cost base (no SMS, no gateway, serverless) lets us stay cheaper, and the barber-app network effect grows with every shop |

---

## 10. Roadmap

**Next (0–3 months)**
- Hindi UI, then Malayalam, Tamil, Telugu, Kannada (the `t()` dictionaries are ready).
- Bank-statement CSV upload in admin to auto-approve matching UTRs.
- Packages and memberships (e.g. "10 haircuts for ₹900"), building on the advance balance.
- Direct Bluetooth thermal printing (ESC/POS) for shops that have a printer.
- Consolidated multi-branch dashboard for Business.

**Later (3–12 months)**
- Appointment reminders through the owner's WhatsApp (click-to-send lists).
- Staff leave and attendance reports, salary slips as PDF.
- Optional UPI payment auto-confirmation through a partner bank. This stays optional, keeping the no-gateway default.
- A supplier marketplace for products (commission revenue).

---

## Sources

- Jawed Habib salon count estimate — [Third Eyesight](https://www.thirdeyesight.in/?p=2838)
- Organised salon count and market size — [Ken Research](https://www.kenresearch.com/industry-reports/india-beauty-salon-market.md), [Deep Market Insights](https://deepmarketinsights.com/vista/insights/salon-services-market/india), [Nexdigm](https://www.nexdigm.com/market-research/report-store/india-salon-market/)
- Competitor prices — [TechImply: Salonist](https://www.techimply.com/profile/salonist), [Capterra: SalonBoost](https://www.capterra.ae/software/1074125/SalonBoost), [Codingclave salon software cost guide](https://codingclave.com/guides/salon-management-software-cost-india-2026), [xpay: Zylu](https://www.xpay.sh/agent-ready-index/zylu-co/)
- Cloudflare pricing — [SpendHound](https://spendhound.com/marketplace/cloudflare-pricing), [MakerKit calculator](https://makerkit.dev/pricing-calculator/cloudflare); confirm on Cloudflare's own pricing page.

Numbers marked as estimates are planning assumptions to be validated in the first two launch cities.
