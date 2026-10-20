import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Icons } from '../../components/icons';
import { Button, ErrorText, Input, Select } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { AuthLayout } from './AuthLayout';
import { COUNTRIES, guessCountry, guessTimezone } from './countries';

export default function Signup() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refresh, setActiveSalonId } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', salonName: '', city: '', phone: '', country: guessCountry() });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/auth/signup', {
        ...form,
        city: form.city || undefined,
        phone: form.phone || undefined,
        timezone: guessTimezone(),
        referralCode: params.get('ref') ?? undefined,
      });
      const me = await refresh();
      if (me.memberships[0]) setActiveSalonId(me.memberships[0].salon.id);
      navigate('/app/welcome');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Start your free trial"
      subtitle={
        <span className="flex flex-wrap gap-x-4 gap-y-1">
          {['14 days of Studio', 'No card needed', 'Free plan after'].map((t) => (
            <span key={t} className="inline-flex items-center gap-1">
              <Icons.check size={14} className="text-success" /> {t}
            </span>
          ))}
        </span>
      }
      footer={
        <>
          Already have an account? <Link to="/login" className="font-semibold text-accent">Sign in</Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Input label="Salon or barbershop name" value={form.salonName} onChange={set('salonName')} required autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Country" value={form.country} onChange={set('country')}>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </Select>
          <Input label="City" value={form.city} onChange={set('city')} />
        </div>
        <Input label="Your name" value={form.name} onChange={set('name')} required autoComplete="name" />
        <Input label="Mobile (WhatsApp)" type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" />
        <Input label="Email" type="email" value={form.email} onChange={set('email')} required autoComplete="email" />
        <Input label="Password" type="password" value={form.password} onChange={set('password')} required minLength={8} autoComplete="new-password" hint="At least 8 characters." />
        <ErrorText error={error} />
        <Button type="submit" size="lg" variant="accent" className="w-full" loading={busy}>
          Create my salon
        </Button>
        <p className="text-center text-xs text-muted">
          By continuing you agree to the <Link to="/terms" className="underline">Terms</Link> and <Link to="/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </form>
    </AuthLayout>
  );
}
