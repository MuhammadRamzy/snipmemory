import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ClientForm } from '../../components/ClientForm';
import { Icons } from '../../components/icons';
import { VisitCard } from '../../components/VisitCard';
import { Alert, Avatar, Badge, Button, Card, CardHeader, EmptyState, ErrorText, Input, Modal, PageHeader, PageLoader } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { date, dateTime, money, plural, relative } from '../../lib/format';
import { useSalon } from '../../lib/salon';
import type { ClientDetail as Detail } from '../../lib/types';
import { useApi } from '../../lib/useApi';

function PassportImport({ detail, reload }: { detail: Detail; reload: () => void }) {
  const { base, has } = useSalon();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<{ devCode?: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { client, passport } = detail;
  if (passport.shared || passport.otherSalonsWithHistory === 0) return null;

  const request = async () => {
    setBusy(true);
    setError(null);
    try {
      setSent(await api.post<{ devCode?: string }>(`${base}/clients/${client.id}/passport/request`));
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
      await api.post(`${base}/clients/${client.id}/passport/verify`, { code });
      setOpen(false);
      reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Alert
        tone="accent"
        title={`${client.name.split(' ')[0]} has a Style Passport`}
        action={
          <Button size="sm" variant="accent" onClick={() => setOpen(true)}>
            Import history
          </Button>
        }
      >
        They have haircut history at {passport.otherSalonsWithHistory} other SnipMemory salon{passport.otherSalonsWithHistory === 1 ? '' : 's'}. With their OK you can see exactly how it was cut.
      </Alert>
      <Modal open={open} onClose={() => setOpen(false)} title="Import Style Passport">
        {!has('passport_import') ? (
          <p className="text-sm text-muted">Passport import is part of the Studio plan and above. Ask the owner to upgrade.</p>
        ) : !sent ? (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              We'll text a 6-digit code to {client.phone}. When {client.name.split(' ')[0]} reads it to you, their past cuts — photos, clipper settings and notes — appear here.
            </p>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button className="w-full" onClick={request} loading={busy}>
              Send code to client
            </Button>
          </div>
        ) : (
          <form onSubmit={verify} className="space-y-4">
            <Input label="Code from the client" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
            {sent.devCode && <p className="text-xs text-muted">Test mode code: {sent.devCode}</p>}
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button className="w-full" type="submit" loading={busy} disabled={code.length !== 6}>
              Unlock history
            </Button>
          </form>
        )}
      </Modal>
    </>
  );
}

export default function ClientDetail() {
  const { clientId } = useParams();
  const { base, salon, canManage } = useSalon();
  const navigate = useNavigate();
  const { data, error, reload } = useApi<Detail>(`${base}/clients/${clientId}`);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (error) return <ErrorText error={error} />;
  if (!data) return <PageLoader />;
  const { client, visits, passport, reminders } = data;
  const last = visits[0];
  const startVisit = (repeat?: string) => navigate(`/app/clients/${client.id}/visit${repeat ? `?repeat=${repeat}` : ''}`);
  const whatsapp = `https://wa.me/${client.phone.replace(/\D/g, '')}`;

  const erase = async () => {
    if (!window.confirm(`Permanently erase ${client.name}'s photos and personal details? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.del(`${base}/clients/${client.id}`);
      navigate('/app/clients');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="animate-in space-y-6">
      <PageHeader
        back="/app/clients"
        title={
          <span className="flex items-center gap-3">
            <Avatar name={client.name} src={last?.photos.find((p) => p.angle === 'front')?.url} size={48} />
            <span className="min-w-0">
              <span className="block truncate">{client.name}</span>
              <span className="block text-sm font-normal text-muted">{client.phone}</span>
            </span>
          </span>
        }
        action={
          <>
            <a href={whatsapp} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm font-semibold hover:bg-surface-2">
              <Icons.whatsapp size={16} /> Chat
            </a>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Icons.edit size={16} /> Edit
            </Button>
            {last && (
              <Button variant="secondary" onClick={() => startVisit(last.id)}>
                <Icons.repeat size={16} /> Repeat last cut
              </Button>
            )}
            <Button variant="accent" onClick={() => startVisit()}>
              <Icons.camera size={18} /> New visit
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge tone={client.photoConsent ? 'success' : 'warning'}>{client.photoConsent ? 'Photo consent' : 'No photo consent'}</Badge>
        <Badge tone={client.optedOut ? 'danger' : client.marketingConsent ? 'success' : 'neutral'}>
          {client.optedOut ? 'Reminders stopped' : client.marketingConsent ? 'Reminders on' : 'Manual reminders only'}
        </Badge>
        {client.visitCount > 0 && <Badge>{plural(client.visitCount, 'visit')} · {money(client.totalSpend, salon.currency)}</Badge>}
        {client.nextReminderAt && !client.optedOut && <Badge tone="accent">Next reminder {relative(client.nextReminderAt)}</Badge>}
        {passport.shared && <Badge tone="accent">Passport shared {date(passport.sharedAt)}</Badge>}
      </div>

      <PassportImport detail={data} reload={reload} />

      {client.notes && (
        <Card className="p-4 text-sm">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Client notes</p>
          <p className="whitespace-pre-line">{client.notes}</p>
        </Card>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Style history</h2>
        {visits.length ? (
          visits.map((v, i) => <VisitCard key={v.id} visit={v} currency={salon.currency} highlight={i === 0} onRepeat={() => startVisit(v.id)} />)
        ) : (
          <Card>
            <EmptyState icon={<Icons.camera />} title="No visits yet" action={<Button variant="accent" onClick={() => startVisit()}>Capture this cut</Button>}>
              Take 4 quick photos and note the clipper settings — next time anyone on your team can repeat it perfectly.
            </EmptyState>
          </Card>
        )}
      </section>

      {passport.visits.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">From their Style Passport</h2>
          {passport.visits.map((v) => (
            <VisitCard key={v.id} visit={v} showSalon onRepeat={() => startVisit(v.id)} />
          ))}
        </section>
      )}

      {reminders.length > 0 && (
        <Card>
          <CardHeader title="Reminders sent" />
          <ul className="divide-y divide-border text-sm">
            {reminders.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <span className="text-muted">{dateTime(r.createdAt)}</span>
                <span className="flex gap-2">
                  <Badge>{r.manual ? 'WhatsApp (manual)' : r.channel}</Badge>
                  <Badge tone={r.status === 'sent' ? 'success' : 'danger'}>{r.status}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {canManage && (
        <div className="border-t border-border pt-6">
          <Button variant="danger-ghost" onClick={erase} loading={deleting}>
            <Icons.trash size={16} /> Erase client data
          </Button>
        </div>
      )}

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit client">
        <ClientForm
          client={client}
          onSaved={() => {
            setEditing(false);
            reload();
          }}
        />
      </Modal>
    </div>
  );
}
