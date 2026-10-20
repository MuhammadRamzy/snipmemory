import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { I, Logo, type IconName } from '../components/icons';
import { Chips, cx } from '../components/ui';
import { rs } from '../lib/format';
import { qrSvg } from '../lib/upi';
import type { Plan } from '../lib/types';
import { useApi } from '../lib/useApi';

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  { icon: 'receipt', title: 'Bill in 10 seconds', body: 'Tap Haircut, tap Shave, done. Big buttons, your own prices, no typing.' },
  { icon: 'qr', title: 'UPI QR with exact amount', body: 'Customer scans with GPay, PhonePe or Paytm — amount already filled. Money goes straight to your bank.' },
  { icon: 'whatsapp', title: 'WhatsApp bill — no printer', body: 'Send a neat bill to the customer’s WhatsApp. Have a printer? Print a small receipt too.' },
  { icon: 'users', title: 'Barber-wise earnings', body: 'Every barber bills from their own phone. You see who did how many cuts and how much they earned.' },
  { icon: 'book', title: 'Udhaar khata', body: 'Keep pending amounts and advances. Send a polite WhatsApp reminder in one tap.' },
  { icon: 'cash', title: 'Galla hisaab', body: 'At night, count the cash and see if it matches the bills. No more guessing.' },
  { icon: 'wallet2', title: 'Expenses & real profit', body: 'Rent, current bill, tea, products — see what you actually earned this month.' },
  { icon: 'ticket', title: 'Token queue', body: 'Give walk-ins a token number. No fights about who is next.' },
  { icon: 'offline', title: 'Works without internet', body: 'Bills save on the phone and upload when the net comes back.' },
];

const FAQ = [
  ['Do I need a computer or printer?', 'No. Everything works on a normal Android phone. A printer is optional.'],
  ['Does SnipMemory take a cut of my UPI payments?', 'Never. The QR uses your own UPI ID, so money goes straight from the customer to you. We only charge the fixed monthly plan.'],
  ['My barbers are not good with phones. Will they manage?', 'Yes. The Staff app has one big “New bill” button, picture-like tiles for services and a 4-digit PIN — like a UPI app.'],
  ['What happens after the free trial?', 'You move to the Free plan automatically. No card, no auto-debit, nothing deleted.'],
  ['Can my barbers see my total sales?', 'No. Each barber sees only their own bills and earnings. Only the owner sees the whole shop.'],
  ['How do I pay for a plan?', 'Pay by UPI to SnipMemory and type the UTR number in the app. We activate it within a few hours.'],
];

export default function Landing({ scrollTo }: { scrollTo?: string }) {
  const [period, setPeriod] = useState<'month' | 'year'>('year');
  const { data } = useApi<{ plans: Plan[] }>('/api/public/plans');
  useEffect(() => {
    if (scrollTo) setTimeout(() => document.getElementById(scrollTo)?.scrollIntoView({ behavior: 'smooth' }), 200);
  }, [scrollTo]);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <nav className="flex items-center gap-2 text-sm font-bold">
            <a href="#pricing" className="hidden px-3 py-2 text-muted sm:block">Pricing</a>
            <Link to="/staff" className="hidden px-3 py-2 text-muted sm:block">Staff login</Link>
            <Link to="/owner" className="rounded-xl bg-brand px-4 py-2.5 text-brand-ink">Owner login</Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:py-20 lg:grid-cols-2">
        <div>
          <p className="inline-flex rounded-full bg-brand-soft px-3 py-1 text-sm font-bold text-brand-text">For salons, barber shops & beauty parlours in India</p>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
            Salon ka poora hisaab,
            <br />
            <span className="text-brand-text">ek phone mein.</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted">
            Billing with UPI QR, barber-wise commission, udhaar khata, expenses and daily cash — on any Android phone. Owner gets one app, every barber gets their own.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/owner/signup" className="flex h-14 items-center justify-center rounded-2xl bg-brand px-7 text-lg font-extrabold text-brand-ink">
              Start free — 30 days Pro
            </Link>
            <Link to="/staff" className="flex h-14 items-center justify-center rounded-2xl border-2 border-line bg-surface px-7 text-lg font-bold">
              I am a barber
            </Link>
          </div>
          <p className="mt-3 text-sm text-muted">No card. No payment gateway. Free forever for small shops.</p>
        </div>

        <div className="mx-auto w-full max-w-[320px]">
          <div className="rounded-[2.6rem] border-[10px] border-ink bg-bg p-4 shadow-2xl">
            <p className="text-center text-sm font-semibold text-muted">Customer scans with any UPI app</p>
            <p className="text-center text-5xl font-extrabold">₹250</p>
            <div className="mx-auto mt-3 size-44 rounded-2xl bg-white p-2 [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: qrSvg('https://snipmemory.app') }} />
            <p className="mt-2 text-center font-bold">Style Point Salon</p>
            <div className="mt-3 rounded-2xl bg-money py-3 text-center font-extrabold text-white">✓ Money received</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-center text-sm font-bold">
              <span className="rounded-xl border-2 border-line bg-surface py-2">Haircut ₹100</span>
              <span className="rounded-xl border-2 border-line bg-surface py-2">Beard ₹60</span>
              <span className="rounded-xl border-2 border-line bg-surface py-2">Massage ₹90</span>
              <span className="rounded-xl border-2 border-brand bg-brand-soft py-2">Suresh</span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-3 px-4 py-6 text-sm font-bold text-muted">
          {['Gents salon', 'Unisex salon', 'Ladies parlour', 'Spa', '1 chair to 20 chairs', 'Many branches'].map((s) => (
            <span key={s} className="rounded-full bg-surface-2 px-4 py-2">{s}</span>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Everything a salon does in a day</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = I[f.icon];
            return (
              <div key={f.title} className="rounded-3xl border border-line bg-surface p-6">
                <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-text">
                  <Icon />
                </span>
                <h3 className="mt-4 text-lg font-extrabold">{f.title}</h3>
                <p className="mt-1 text-muted">{f.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-surface py-16">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 md:grid-cols-2">
          <div className="rounded-3xl bg-[#0f766e] p-8 text-white">
            <p className="text-sm font-bold uppercase tracking-widest opacity-80">Owner app</p>
            <h3 className="mt-2 text-2xl font-extrabold">See your whole shop</h3>
            <ul className="mt-4 space-y-2 opacity-95">
              <li>• Today’s sale: UPI, cash and udhaar</li>
              <li>• Every barber’s cuts and commission</li>
              <li>• Salary, advances and payouts</li>
              <li>• Expenses, profit, cash closing</li>
              <li>• Prices, products, stock, GST</li>
            </ul>
          </div>
          <div className="rounded-3xl bg-[#c2410c] p-8 text-white">
            <p className="text-sm font-bold uppercase tracking-widest opacity-80">Staff app</p>
            <h3 className="mt-2 text-2xl font-extrabold">Each barber bills from their phone</h3>
            <ul className="mt-4 space-y-2 opacity-95">
              <li>• One big “New bill” button</li>
              <li>• Show UPI QR, take cash, give change</li>
              <li>• See only their own cuts and earning</li>
              <li>• Start / end work (attendance)</li>
              <li>• Login with mobile + 4-digit PIN</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-4 py-16">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Simple prices. Pick by your shop size.</h2>
          <p className="mt-2 text-muted">Less than the price of one haircut a week. Start with 30 days of Pro free.</p>
          <div className="mt-6 flex justify-center">
            <Chips value={period} onChange={setPeriod} options={[{ value: 'year', label: 'Yearly — 2 months free' }, { value: 'month', label: 'Monthly' }]} />
          </div>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {data?.plans.map((p) => {
            const price = period === 'year' ? p.priceYear : p.priceMonth;
            return (
              <div key={p.id} className={cx('flex flex-col rounded-3xl border bg-surface p-6', p.id === 'pro' ? 'border-2 border-brand' : 'border-line')}>
                <p className="text-xl font-extrabold">{p.name}</p>
                <p className="text-muted">{p.tagline}</p>
                <p className="mt-4 text-4xl font-extrabold">{price ? rs(period === 'year' ? Math.round(price / 12) : price) : '₹0'}</p>
                <p className="text-sm text-muted">{price ? (period === 'year' ? `per month · ${rs(price)} a year` : 'per month') : 'forever'}</p>
                <ul className="mt-4 flex-1 space-y-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2 text-[15px]">
                      <I.check size={18} className="mt-0.5 shrink-0 text-money" /> {f}
                    </li>
                  ))}
                </ul>
                <Link to="/owner/signup" className={cx('mt-6 flex h-12 items-center justify-center rounded-2xl font-bold', p.id === 'pro' ? 'bg-brand text-brand-ink' : 'border-2 border-line')}>
                  {p.id === 'free' ? 'Start free' : 'Try free for 30 days'}
                </Link>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-center text-sm text-muted">Prices include everything. No per-bill fees, no cut on UPI, no SMS charges.</p>
      </section>

      <section className="border-t border-line bg-surface py-16">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-3xl font-extrabold">Questions</h2>
          <div className="mt-6 space-y-3">
            {FAQ.map(([q, a]) => (
              <details key={q} className="rounded-3xl border border-line bg-bg p-5">
                <summary className="cursor-pointer list-none text-lg font-bold">{q}</summary>
                <p className="mt-2 text-muted">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <Logo size={28} />
        <div className="flex flex-wrap gap-5">
          <Link to="/owner">Owner app</Link>
          <Link to="/staff">Staff app</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
        </div>
      </footer>
    </div>
  );
}
