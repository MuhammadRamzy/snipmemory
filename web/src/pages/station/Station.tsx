import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Icons, Logo } from '../../components/icons';
import { Avatar, Button, PageLoader } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import type { Member } from '../../lib/types';

/** Lock screen of a shared salon device. */
export default function Station() {
  const { station, loading, refreshStation } = useAuth();
  const navigate = useNavigate();
  const [member, setMember] = useState<Member | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <PageLoader />;
  if (!station?.paired) {
    return (
      <div className="mx-auto grid min-h-dvh max-w-md place-items-center p-6 text-center">
        <div>
          <Logo className="mb-6 text-xl" />
          <h1 className="text-xl font-bold">This device isn't a salon station yet</h1>
          <p className="mt-2 text-sm text-muted">Sign in as the salon owner on this device, then go to Team → Pair this device.</p>
          <Link to="/login?next=/app/team" className="mt-6 inline-block font-semibold text-accent">
            Sign in as owner
          </Link>
        </div>
      </div>
    );
  }

  const unlock = async (e: FormEvent) => {
    e.preventDefault();
    if (!member) return;
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/station/unlock', { memberId: member.id, pin });
      await refreshStation();
      navigate('/app');
    } catch (err) {
      setError(errorMessage(err));
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  const press = (digit: string) => setPin((p) => (p.length < 6 ? p + digit : p));

  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-10">
      <p className="text-sm font-semibold uppercase tracking-widest text-muted">{station.salon?.name}</p>
      <h1 className="mt-1 text-2xl font-bold">{member ? `Hi ${member.displayName.split(' ')[0]}, enter your PIN` : "Who's cutting?"}</h1>

      {!member ? (
        <div className="mt-8 grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3">
          {station.members?.map((m) => (
            <button key={m.id} onClick={() => setMember(m)} className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-5 transition hover:border-accent">
              <Avatar name={m.displayName} size={64} />
              <span className="font-semibold">{m.displayName}</span>
              {!m.hasPin && <span className="text-xs text-warning">No PIN set</span>}
            </button>
          ))}
        </div>
      ) : (
        <form onSubmit={unlock} className="mt-8 w-full max-w-xs">
          <div className="mb-6 flex justify-center gap-3" aria-label={`${pin.length} digits entered`}>
            {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
              <span key={i} className={`size-4 rounded-full ${i < pin.length ? 'bg-ink' : 'border-2 border-border'}`} />
            ))}
          </div>
          <input className="sr-only" inputMode="numeric" autoFocus value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} aria-label="PIN" />
          <div className="grid grid-cols-3 gap-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
              <button key={d} type="button" onClick={() => press(d)} className="h-16 rounded-2xl bg-surface text-2xl font-semibold shadow-sm active:bg-surface-2">
                {d}
              </button>
            ))}
            <button type="button" onClick={() => { setMember(null); setPin(''); setError(null); }} className="h-16 rounded-2xl text-sm text-muted">
              Back
            </button>
            <button type="button" onClick={() => press('0')} className="h-16 rounded-2xl bg-surface text-2xl font-semibold shadow-sm active:bg-surface-2">
              0
            </button>
            <button type="button" onClick={() => setPin((p) => p.slice(0, -1))} className="grid h-16 place-items-center rounded-2xl text-muted" aria-label="Delete">
              <Icons.chevronLeft />
            </button>
          </div>
          {error && <p className="mt-4 text-center text-sm text-danger">{error}</p>}
          <Button type="submit" size="lg" variant="accent" className="mt-6 w-full" loading={busy} disabled={pin.length < 4}>
            Unlock
          </Button>
        </form>
      )}

      <button
        className="mt-auto pt-10 text-xs text-muted hover:text-text"
        onClick={async () => {
          if (!window.confirm('Unpair this device? An owner will need to pair it again.')) return;
          await api.post('/api/station/unpair');
          await refreshStation();
        }}
      >
        Unpair device
      </button>
    </div>
  );
}
