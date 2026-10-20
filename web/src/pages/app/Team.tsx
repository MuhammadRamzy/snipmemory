import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Icons } from '../../components/icons';
import { Alert, Avatar, Badge, Button, Card, CardHeader, ErrorText, Input, Modal, PageHeader, PageLoader, Select } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { date } from '../../lib/format';
import { useSalon } from '../../lib/salon';
import type { Member } from '../../lib/types';
import { useApi } from '../../lib/useApi';

interface TeamData {
  members: Member[];
  invites: { id: string; email: string; role: string; expiresAt: number }[];
}

function AddMember({ onDone }: { onDone: () => void }) {
  const { base } = useSalon();
  const [name, setName] = useState('');
  const [role, setRole] = useState<'stylist' | 'manager'>('stylist');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post(`${base}/team`, { displayName: name, role, pin: pin || undefined });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as 'stylist' | 'manager')}>
        <option value="stylist">Stylist — records visits</option>
        <option value="manager">Manager — also manages team & settings</option>
      </Select>
      <Input label="Station PIN" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} hint="4–6 digits. Used to unlock the shared salon tablet." />
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" className="w-full" loading={busy}>
        Add to team
      </Button>
    </form>
  );
}

function Invite({ member, onDone }: { member?: Member; onDone: () => void }) {
  const { base } = useSalon();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'stylist' | 'manager'>(member?.role === 'manager' ? 'manager' : 'stylist');
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post<{ inviteUrl: string }>(`${base}/team/invites`, { email, role, memberId: member?.id });
      setLink(res.inviteUrl);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  if (link) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">Send this link to {email}. It works once and expires in 7 days.</p>
        <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
        <div className="flex gap-2">
          <Button className="flex-1" variant="secondary" onClick={() => navigator.clipboard?.writeText(link)}>
            <Icons.link size={16} /> Copy
          </Button>
          <a className="flex-1" href={`https://wa.me/?text=${encodeURIComponent(`Join our team on SnipMemory: ${link}`)}`} target="_blank" rel="noreferrer">
            <Button className="w-full" variant="accent" type="button">
              <Icons.whatsapp size={16} /> WhatsApp
            </Button>
          </a>
        </div>
        <Button variant="ghost" className="w-full" onClick={onDone}>
          Done
        </Button>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
      <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as 'stylist' | 'manager')}>
        <option value="stylist">Stylist</option>
        <option value="manager">Manager</option>
      </Select>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" className="w-full" loading={busy}>
        Create invite link
      </Button>
    </form>
  );
}

function SetPin({ member, onDone }: { member: Member; onDone: () => void }) {
  const { base } = useSalon();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.put(`${base}/team/${member.id}/pin`, { pin });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Input label={`New PIN for ${member.displayName}`} inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} required autoFocus />
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" className="w-full" disabled={pin.length < 4}>
        Save PIN
      </Button>
    </form>
  );
}

export default function Team() {
  const { base, has, isOwner, plan, usage, reload: reloadSalon } = useSalon();
  const { refreshStation } = useAuth();
  const navigate = useNavigate();
  const { data, error, reload } = useApi<TeamData>(`${base}/team`);
  const [modal, setModal] = useState<{ kind: 'add' } | { kind: 'invite'; member?: Member } | { kind: 'pin'; member: Member } | null>(null);
  const [pairing, setPairing] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);

  if (error) return <ErrorText error={error} />;
  if (!data) return <PageLoader />;
  const done = () => {
    setModal(null);
    void reload();
    void reloadSalon();
  };
  const atLimit = plan.maxStaff >= 0 && usage.staff >= plan.maxStaff;

  const pair = async () => {
    if (!window.confirm('Turn THIS device into a shared salon station? Stylists will unlock it with their PIN.')) return;
    setPairing(true);
    try {
      await api.post(`${base}/station/pair`);
      await refreshStation();
      navigate('/station');
    } catch (err) {
      setPairError(errorMessage(err));
    } finally {
      setPairing(false);
    }
  };

  const toggleActive = async (m: Member) => {
    try {
      await api.patch(`${base}/team/${m.id}`, { active: !m.active });
      done();
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  return (
    <div className="animate-in space-y-6">
      <PageHeader
        title="Team"
        description={`${usage.staff} of ${plan.maxStaff < 0 ? 'unlimited' : plan.maxStaff} stylist seats used on ${plan.name}`}
        action={
          <>
            <Button variant="secondary" onClick={() => setModal({ kind: 'invite' })} disabled={atLimit}>
              <Icons.link size={16} /> Invite with login
            </Button>
            <Button variant="accent" onClick={() => setModal({ kind: 'add' })} disabled={atLimit}>
              <Icons.plus size={18} /> Add stylist
            </Button>
          </>
        }
      />
      {atLimit && <Alert tone="warning" title="All seats are in use">{isOwner ? 'Upgrade your plan in Billing to add more stylists.' : 'Ask the owner to upgrade the plan.'}</Alert>}

      <Card>
        <ul className="divide-y divide-border">
          {data.members.map((m) => (
            <li key={m.id} className={`flex flex-wrap items-center gap-3 px-5 py-4 ${m.active ? '' : 'opacity-60'}`}>
              <Avatar name={m.displayName} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{m.displayName}</p>
                <p className="text-sm text-muted">{m.email ?? 'Station login only'}</p>
              </div>
              <Badge tone={m.role === 'owner' ? 'accent' : 'neutral'} className="capitalize">{m.role}</Badge>
              {!m.hasPin && m.active && <Badge tone="warning">No PIN</Badge>}
              {!m.active && <Badge>Inactive</Badge>}
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setModal({ kind: 'pin', member: m })}>
                  PIN
                </Button>
                {!m.hasLogin && m.active && (
                  <Button size="sm" variant="ghost" onClick={() => setModal({ kind: 'invite', member: m })}>
                    Give login
                  </Button>
                )}
                {m.role !== 'owner' && (
                  <Button size="sm" variant="ghost" onClick={() => toggleActive(m)}>
                    {m.active ? 'Deactivate' : 'Reactivate'}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {data.invites.length > 0 && (
        <Card>
          <CardHeader title="Pending invites" />
          <ul className="divide-y divide-border text-sm">
            {data.invites.map((i) => (
              <li key={i.id} className="flex items-center justify-between px-5 py-3">
                <span>
                  {i.email} <span className="capitalize text-muted">· {i.role}</span>
                </span>
                <span className="flex items-center gap-3 text-muted">
                  expires {date(i.expiresAt)}
                  <button className="text-danger" onClick={async () => { await api.del(`${base}/team/invites/${i.id}`); void reload(); }}>
                    Revoke
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader title="Shared station device" description="Put a tablet or phone at the front desk or each chair. Stylists tap their name and enter their PIN — no passwords on the floor." />
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">{has('station_mode') ? 'Open SnipMemory on the shared device, sign in as owner, and pair it here.' : 'Station mode is included in Studio and above.'}</p>
          <Button onClick={pair} loading={pairing} disabled={!has('station_mode')}>
            <Icons.phone size={16} /> Pair this device
          </Button>
        </div>
        {pairError && <p className="px-5 pb-4 text-sm text-danger">{pairError}</p>}
      </Card>

      <Modal open={Boolean(modal)} onClose={() => setModal(null)} title={modal?.kind === 'add' ? 'Add stylist' : modal?.kind === 'pin' ? 'Set PIN' : 'Invite with email login'}>
        {modal?.kind === 'add' && <AddMember onDone={done} />}
        {modal?.kind === 'invite' && <Invite member={modal.member} onDone={done} />}
        {modal?.kind === 'pin' && <SetPin member={modal.member} onDone={done} />}
      </Modal>
    </div>
  );
}
