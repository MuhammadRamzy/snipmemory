import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Icons } from '../../components/icons';
import { Button, Card, Input } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useSalon } from '../../lib/salon';

/** First-run setup right after signup: cycle, booking link, and the team roster. */
export default function Welcome() {
  const { salon, base, reload } = useSalon();
  const navigate = useNavigate();
  const [cadence, setCadence] = useState(String(salon.defaultCadenceDays));
  const [bookingUrl, setBookingUrl] = useState(salon.bookingUrl ?? '');
  const [stylists, setStylists] = useState([{ name: '', pin: '' }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.patch(base, { defaultCadenceDays: Number(cadence), bookingUrl: bookingUrl || null });
      for (const s of stylists.filter((s) => s.name.trim())) {
        await api.post(`${base}/team`, { displayName: s.name.trim(), role: 'stylist', pin: s.pin || undefined });
      }
      await api.post(`${base}/onboarded`);
      await reload();
      navigate('/app/clients?new=1');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-in mx-auto max-w-xl">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-accent text-white">
          <Icons.sparkles />
        </div>
        <h1 className="text-2xl font-bold">Welcome to SnipMemory, {salon.name}</h1>
        <p className="mt-1 text-muted">Your 14-day Studio trial is running. Two quick questions and you're ready for your first client.</p>
      </div>
      <Card className="p-6">
        <form onSubmit={submit} className="space-y-5">
          <Input
            label="How often do your clients usually come back? (days)"
            type="number"
            min={7}
            max={180}
            value={cadence}
            onChange={(e) => setCadence(e.target.value)}
            hint="Barbers: 14–28 days. Salons: 42–60 days. We'll learn each client's real rhythm automatically."
          />
          <Input label="Online booking or WhatsApp link (optional)" type="url" placeholder="https://wa.me/91…" value={bookingUrl} onChange={(e) => setBookingUrl(e.target.value)} hint="Added to reminders so clients can book in one tap." />
          <div className="space-y-2">
            <p className="text-sm font-medium">Who else cuts hair here?</p>
            {stylists.map((s, i) => (
              <div key={i} className="grid grid-cols-[1fr_7rem] gap-2">
                <Input placeholder="Stylist name" value={s.name} onChange={(e) => setStylists((list) => list.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <Input placeholder="PIN" inputMode="numeric" maxLength={6} value={s.pin} onChange={(e) => setStylists((list) => list.map((x, j) => (j === i ? { ...x, pin: e.target.value.replace(/\D/g, '') } : x)))} />
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => setStylists((l) => [...l, { name: '', pin: '' }])}>
              <Icons.plus size={16} /> Add another
            </Button>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" size="lg" variant="accent" className="w-full" loading={busy}>
            Add my first client
          </Button>
          <button type="button" className="w-full text-sm text-muted hover:text-text" onClick={() => navigate('/app')}>
            Skip for now
          </button>
        </form>
      </Card>
    </div>
  );
}
