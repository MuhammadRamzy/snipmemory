import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Icons } from '../../components/icons';
import { Card, LinkButton } from '../../components/ui';
import { money } from '../../lib/format';
import { currencyForVisitor, MarketingLayout } from './MarketingLayout';

const ROI_DEFAULTS: Record<string, { ticket: number; plan: number }> = {
  INR: { ticket: 40000, plan: 89900 },
  USD: { ticket: 3500, plan: 3900 },
  GBP: { ticket: 2500, plan: 3200 },
  AED: { ticket: 8000, plan: 14500 },
  EUR: { ticket: 3000, plan: 3500 },
};

function RoiCalculator() {
  const currency = currencyForVisitor();
  const defaults = ROI_DEFAULTS[currency] ?? ROI_DEFAULTS.USD;
  const [clients, setClients] = useState(300);
  const [ticket, setTicket] = useState(defaults.ticket / 100);
  const [recover, setRecover] = useState(6);
  const result = useMemo(() => {
    // ~25% of a salon's active clients drift past their usual return date each month.
    const lapsing = clients * 0.25;
    const recovered = Math.round((lapsing * recover) / 100);
    const revenue = recovered * ticket * 100;
    return { recovered, revenue, multiple: revenue / defaults.plan };
  }, [clients, ticket, recover, defaults.plan]);

  return (
    <Card className="grid gap-6 p-6 sm:p-8 md:grid-cols-2">
      <div className="space-y-5">
        <label className="block">
          <span className="flex justify-between text-sm font-medium">
            Active clients <span className="tabular-nums text-muted">{clients}</span>
          </span>
          <input type="range" min={50} max={2000} step={50} value={clients} onChange={(e) => setClients(Number(e.target.value))} className="mt-2 w-full accent-[var(--accent)]" />
        </label>
        <label className="block">
          <span className="flex justify-between text-sm font-medium">
            Average ticket <span className="tabular-nums text-muted">{money(ticket * 100, currency)}</span>
          </span>
          <input
            type="range"
            min={defaults.ticket / 400}
            max={(defaults.ticket / 100) * 4}
            step={defaults.ticket / 2000}
            value={ticket}
            onChange={(e) => setTicket(Number(e.target.value))}
            className="mt-2 w-full accent-[var(--accent)]"
          />
        </label>
        <label className="block">
          <span className="flex justify-between text-sm font-medium">
            Lapsing clients a reminder wins back <span className="tabular-nums text-muted">{recover}%</span>
          </span>
          <input type="range" min={2} max={20} value={recover} onChange={(e) => setRecover(Number(e.target.value))} className="mt-2 w-full accent-[var(--accent)]" />
        </label>
        <p className="text-xs text-muted">Assumes about a quarter of your clients pass their usual return date each month. SnipMemory tracks the real number for you.</p>
      </div>
      <div className="flex flex-col justify-center rounded-2xl bg-accent p-6 text-white">
        <p className="text-sm text-white/80">Extra revenue every month</p>
        <p className="mt-1 text-4xl font-extrabold tracking-tight">{money(result.revenue, currency)}</p>
        <p className="mt-2 text-sm text-white/80">
          {result.recovered} clients back in the chair — {result.multiple >= 1 ? `${result.multiple.toFixed(1)}× the price of Studio` : 'more than Solo costs'}.
        </p>
        <LinkButton to="/signup" variant="secondary" className="mt-6 self-start">
          Start your free trial
        </LinkButton>
      </div>
    </Card>
  );
}

const FEATURES = [
  { icon: 'camera', title: '4-angle photos in 20 seconds', body: 'Guided front, sides and back shots with a "last time" overlay. Optional on-device face blur for privacy.' },
  { icon: 'scissors', title: 'The exact recipe', body: 'Guard numbers, fade height, scissor length, neckline, beard, colour formula and products — structured, searchable, repeatable.' },
  { icon: 'repeat', title: 'Repeat last cut', body: 'One tap loads the previous cut as the brief. Any stylist on your team can deliver it when the regular is off.' },
  { icon: 'bell', title: 'Reminders that learn', body: "SnipMemory learns each client's real return rhythm and nudges them on WhatsApp right when they're due — inside your hours." },
  { icon: 'chart', title: 'Proof it pays', body: 'See exactly which clients a reminder brought back and the revenue they spent. No guesswork.' },
  { icon: 'phone', title: 'Station mode', body: 'One shared tablet, a PIN per stylist. No logins on the shop floor, every visit credited to the right person.' },
] as const;

const FAQ = [
  ['Do I need to replace my booking app?', 'No. SnipMemory sits next to whatever you use for bookings — Fresha, Booksy, Square, WhatsApp or a paper diary. Add your booking link and reminders send clients straight there.'],
  ['What happens after the 14-day trial?', "If you don't pick a plan you move to Free automatically: 1 stylist, 75 clients, unlimited history and click-to-send WhatsApp reminders. Nothing is deleted."],
  ['Are client photos safe?', 'Photos are stored privately on Cloudflare R2 and only shown to your team and the client. Consent is recorded per client, faces can be blurred on the device before upload, and clients can erase their data at any time.'],
  ['How do automated reminders work?', 'Clients who opted in get a WhatsApp message (SMS fallback) when they pass their usual return date, during the hours you choose. Every message has a one-tap opt-out. Each plan includes monthly reminder credits; top-ups never expire.'],
  ['What is the Style Passport?', "It's the client's own copy of their haircut history. When a client visits a new SnipMemory salon, they can approve — with a code sent to their phone — that the new stylist sees how they were cut before."],
  ['Can I use it on my phone?', 'Yes. SnipMemory is a web app that installs to your home screen on iPhone, Android and tablets.'],
];

export default function Landing() {
  return (
    <MarketingLayout>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-96 max-w-3xl rounded-full bg-accent/20 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:py-24 lg:grid-cols-2">
          <div className="animate-in">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-muted">
              <Icons.sparkles size={14} className="text-accent" /> For barbershops & salons
            </p>
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
              Never forget <span className="text-accent">how you cut them.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              SnipMemory saves 4-angle photos and the exact clipper settings for every client, then sends a WhatsApp reminder when they're due — so regulars stay regular.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton to="/signup" size="lg" variant="accent">
                Start free — no card
              </LinkButton>
              <LinkButton to="/pricing" size="lg" variant="secondary">
                See pricing
              </LinkButton>
            </div>
            <p className="mt-4 text-sm text-muted">14-day Studio trial · Free plan forever after · Set up in 5 minutes</p>
          </div>
          <div className="relative mx-auto w-full max-w-sm">
            <div className="rounded-[2.5rem] border-8 border-ink/90 bg-surface p-4 shadow-2xl">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="font-bold">Arjun Nair</p>
                  <p className="text-xs text-muted">Every 3 weeks · 14 visits</p>
                </div>
                <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">Due today</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {['Front', 'Left', 'Right', 'Back'].map((a, i) => (
                  <div key={a} className="relative aspect-[3/4] overflow-hidden rounded-lg bg-gradient-to-b from-surface-2 to-border">
                    <svg viewBox="0 0 30 40" className="absolute inset-0 size-full text-muted/60">
                      <ellipse cx="15" cy="17" rx={i === 0 || i === 3 ? 7 : 6} ry="8.5" fill="currentColor" opacity="0.35" />
                      <path d={i === 3 ? 'M8 12c1-6 13-6 14 0v6H8z' : 'M8 13c1-7 13-7 14 0-4-2-10-2-14 0z'} fill="currentColor" />
                      <path d="M5 40c1-8 5-11 10-11s9 3 10 11" fill="currentColor" opacity="0.35" />
                    </svg>
                    <span className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 text-[8px] font-semibold text-white">{a}</span>
                  </div>
                ))}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                {[
                  ['Sides', '#0.5 → #2 mid fade'],
                  ['Top', 'Scissor 4cm, textured'],
                  ['Neckline', 'Tapered'],
                  ['Beard', '#3, sharp line-up'],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-surface-2 p-2">
                    <dt className="text-[10px] uppercase tracking-wide text-muted">{k}</dt>
                    <dd className="font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-3 rounded-2xl rounded-bl-sm bg-success-soft p-3 text-xs">
                Hi Arjun, it's been 21 days since your last skin fade at Fade Lab. Ready for a fresh one? 💈 Book: fadelab.in
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <span className="rounded-xl bg-ink py-2 text-center text-xs font-semibold text-on-ink">Repeat last cut</span>
                <span className="rounded-xl border border-border py-2 text-center text-xs font-semibold">New visit</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-3">
          {[
            ['“Same as last time”', 'is the most common request in any chair — and the hardest to deliver when the notes live in someone’s head.'],
            ['Your regular is off today', 'and the client walks out unhappy, or never books with a different stylist again.'],
            ['Clients drift away quietly', 'Most don’t leave because of a bad cut. They just forget to rebook — and then try the shop next door.'],
          ].map(([title, body]) => (
            <div key={title}>
              <h3 className="text-lg font-bold">{title}</h3>
              <p className="mt-1 text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">Everything a busy chair needs. Nothing it doesn't.</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = Icons[f.icon];
            return (
              <Card key={f.title} className="p-6">
                <div className="mb-4 grid size-10 place-items-center rounded-xl bg-accent-soft text-accent">
                  <Icon />
                </div>
                <h3 className="font-bold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted">{f.body}</p>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="bg-surface py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-accent">Style Passport</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Clients own their history. You get the brief.</h2>
            <p className="mt-4 text-muted">
              Every client gets a free Style Passport. When someone new sits in your chair and they've been to another SnipMemory salon, ask for their history — they approve with a
              code on their phone, and you see exactly how they were cut, photos included.
            </p>
            <ul className="mt-6 space-y-2 text-sm">
              {['Consent-first: nothing is shared without the client’s code', 'Clients can revoke access, stop reminders or erase their data any time', 'Free for clients, forever'].map((t) => (
                <li key={t} className="flex gap-2">
                  <Icons.check size={18} className="shrink-0 text-success" /> {t}
                </li>
              ))}
            </ul>
            <Link to="/passport" className="mt-6 inline-flex items-center gap-1 font-semibold text-accent">
              Open your passport <Icons.chevronRight size={16} />
            </Link>
          </div>
          <Card className="p-6">
            <p className="text-sm text-muted">New client · Sana K.</p>
            <p className="mt-1 font-semibold">Has history at 2 other SnipMemory salons</p>
            <div className="mt-4 flex gap-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <span key={i} className="grid h-12 flex-1 place-items-center rounded-xl border border-border text-xl font-bold">
                  {'482916'[i]}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">Sana reads the code from her phone → 9 past cuts unlocked.</p>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">What one returning client a week is worth</h2>
        <p className="mt-2 max-w-2xl text-muted">Move the sliders. Most shops pay for SnipMemory with the first two or three clients it brings back each month.</p>
        <div className="mt-8">
          <RoiCalculator />
        </div>
      </section>

      <section className="border-t border-border bg-surface py-20">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-3xl font-extrabold tracking-tight">Questions</h2>
          <div className="mt-8 divide-y divide-border">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
                  {q}
                  <Icons.plus size={18} className="text-muted transition group-open:rotate-45" />
                </summary>
                <p className="mt-2 text-muted">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 text-center">
        <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl">Your next client is already due.</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted">Set up before your next appointment. Free for 14 days, then free forever for a single chair.</p>
        <LinkButton to="/signup" size="lg" variant="accent" className="mt-8">
          Create your salon
        </LinkButton>
      </section>
    </MarketingLayout>
  );
}
