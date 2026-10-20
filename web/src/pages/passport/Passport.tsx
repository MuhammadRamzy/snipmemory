import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Icons, Logo } from '../../components/icons';
import { VisitCard } from '../../components/VisitCard';
import { Alert, Button, Card, CardHeader, EmptyState, ErrorText, Input, PageLoader, Select, Toggle } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { date, plural, relative } from '../../lib/format';
import type { Visit } from '../../lib/types';
import { useApi } from '../../lib/useApi';
import { COUNTRIES, guessCountry } from '../auth/countries';

interface PassportData {
  passport: { id: string; phone: string; name: string | null; createdAt: number } | null;
  salons?: { salonId: string; salonName: string; city: string | null; bookingUrl: string; visitCount: number; lastVisitAt: number | null; nextReminderAt: number | null; remindersOff: boolean }[];
  shares?: { salonId: string; salonName: string; grantedAt: number }[];
  visits?: Visit[];
}

function SignIn({ onDone }: { onDone: () => void }) {
  const [country, setCountry] = useState(guessCountry());
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const request = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ devCode?: string }>('/api/passport/login/request', { phone, country });
      setDevCode(res.devCode ?? null);
      setStep('code');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/passport/login/verify', { phone, country, code });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Link to="/">
        <Logo className="text-lg" />
      </Link>
      <h1 className="mt-10 text-3xl font-extrabold tracking-tight">Your Style Passport</h1>
      <p className="mt-2 text-muted">Every haircut you've had at a SnipMemory salon — photos, clipper settings and notes — in one place. Take it to any barber.</p>
      <Card className="mt-8 p-6">
        {step === 'phone' ? (
          <form onSubmit={request} className="space-y-4">
            <div className="grid grid-cols-[8rem_1fr] gap-2">
              <Select aria-label="Country" value={country} onChange={(e) => setCountry(e.target.value)}>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code}
                  </option>
                ))}
              </Select>
              <Input type="tel" inputMode="tel" placeholder="Mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} required autoFocus aria-label="Mobile number" />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" size="lg" className="w-full" loading={busy}>
              Send me a code
            </Button>
            <p className="text-xs text-muted">Your passport exists once a SnipMemory salon has recorded a visit for you.</p>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-4">
            <Input label="6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus required />
            {devCode && <p className="text-xs text-muted">Test mode code: {devCode}</p>}
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" size="lg" className="w-full" loading={busy} disabled={code.length !== 6}>
              Open my passport
            </Button>
            <button type="button" className="w-full text-sm text-muted" onClick={() => setStep('phone')}>
              Use a different number
            </button>
            <p className="text-xs text-muted">No code? If no salon has registered this number yet, there's nothing to show — ask your barber to add you.</p>
          </form>
        )}
      </Card>
    </div>
  );
}

export default function Passport() {
  const { data, error, reload, loading } = useApi<PassportData>('/api/passport/me');
  const [busy, setBusy] = useState<string | null>(null);

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorText error={error} />;
  if (!data?.passport) return <SignIn onDone={reload} />;

  const act = async (key: string, fn: () => Promise<unknown>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(key);
    try {
      await fn();
      await reload();
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const { passport, salons = [], shares = [], visits = [] } = data;
  const latest = visits[0];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between">
        <Logo />
        <Button variant="ghost" size="sm" onClick={() => act('logout', () => api.post('/api/passport/logout'))}>
          <Icons.logout size={16} /> Sign out
        </Button>
      </header>
      <h1 className="text-3xl font-extrabold tracking-tight">{passport.name ? `${passport.name.split(' ')[0]}'s` : 'Your'} Style Passport</h1>
      <p className="mt-1 text-muted">
        {passport.phone} · {plural(visits.length, 'cut')} at {plural(salons.length, 'salon')}
      </p>

      <div className="mt-6">
        <Alert tone="accent" title="Trying a new barber?">
          Give them your mobile number. If they use SnipMemory they can request your history — you'll get a code, and only you can approve it.
        </Alert>
      </div>

      <section className="mt-8 space-y-4">
        <h2 className="text-lg font-semibold">{latest ? 'Your latest cut' : 'Your cuts'}</h2>
        {visits.length === 0 ? (
          <Card>
            <EmptyState icon={<Icons.scissors />} title="No cuts recorded yet" />
          </Card>
        ) : (
          visits.map((v, i) => <VisitCard key={v.id} visit={v} showSalon highlight={i === 0} />)
        )}
      </section>

      <Card className="mt-8">
        <CardHeader title="Your salons" description="Choose who can remind you, and erase your data anywhere." />
        <ul className="divide-y divide-border">
          {salons.map((s) => (
            <li key={s.salonId} className="space-y-3 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{s.salonName}</p>
                  <p className="text-sm text-muted">
                    {s.city ? `${s.city} · ` : ''}
                    {plural(s.visitCount, 'visit')} · last {relative(s.lastVisitAt)}
                  </p>
                </div>
                <a href={s.bookingUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-accent">
                  Book again
                </a>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Toggle
                  checked={!s.remindersOff}
                  onChange={(enabled) => act(`rem-${s.salonId}`, () => api.post(`/api/passport/salons/${s.salonId}/reminders`, { enabled }))}
                  label="Rebooking reminders"
                  description={!s.remindersOff && s.nextReminderAt ? `Next ${relative(s.nextReminderAt)}` : undefined}
                />
                <Button
                  size="sm"
                  variant="danger-ghost"
                  loading={busy === `erase-${s.salonId}`}
                  onClick={() => act(`erase-${s.salonId}`, () => api.del(`/api/passport/salons/${s.salonId}`), `Erase your photos and details at ${s.salonName}? This cannot be undone.`)}
                >
                  Erase my data here
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {shares.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Salons that can see your full history" />
          <ul className="divide-y divide-border text-sm">
            {shares.map((s) => (
              <li key={s.salonId} className="flex items-center justify-between px-5 py-3">
                <span>
                  <span className="font-medium">{s.salonName}</span> <span className="text-muted">since {date(s.grantedAt)}</span>
                </span>
                <Button size="sm" variant="secondary" onClick={() => act(`share-${s.salonId}`, () => api.del(`/api/passport/shares/${s.salonId}`))}>
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-8 flex flex-wrap gap-3 border-t border-border pt-6">
        <a href="/api/passport/export" className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-semibold hover:bg-surface-2">
          <Icons.download size={16} /> Download my data
        </a>
        <Button
          variant="danger-ghost"
          onClick={() =>
            act('delete', () => api.del('/api/passport/me'), 'Close your passport? All sharing is revoked and every salon stops sending you reminders. Salons keep their own records unless you erase them above.')
          }
        >
          Close my passport
        </Button>
      </div>
    </div>
  );
}
