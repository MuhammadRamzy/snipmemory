import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Avatar, Badge, Button, Chips, ErrorBox, Input, Loading, MoneyInput, Notice, Screen, Sheet, useUi } from '../components/ui';
import { api, message } from '../lib/api';
import { rs } from '../lib/format';
import { t } from '../lib/i18n';
import { useSession } from '../lib/session';
import { whatsapp } from '../lib/share';
import type { StaffMember } from '../lib/types';
import { useApi } from '../lib/useApi';

type Row = StaffMember & { monthSales: number; monthCommission: number; presentToday: boolean };

export default function Staff() {
  const { me, has, isOwner } = useSession();
  const { data, error, reload } = useApi<{ staff: Row[] }>('/api/shop/staff');
  const [adding, setAdding] = useState(false);
  const navigate = useNavigate();
  const active = data?.staff.filter((s) => s.active) ?? [];
  const atLimit = me.plan.maxStaff >= 0 && active.length >= me.plan.maxStaff;

  return (
    <Screen title={t('Staff')} back="/owner/more" right={<Button size="sm" icon="plus" disabled={atLimit} onClick={() => setAdding(true)}>{t('Add')}</Button>}>
      {atLimit && (
        <div className="mb-4">
          <Notice tone="warn" icon="users" title={t('Your {plan} plan allows {n} people', { plan: me.plan.name, n: me.plan.maxStaff })} action={<Button size="sm" onClick={() => navigate('/owner/plan')}>{t('Upgrade')}</Button>} />
        </div>
      )}
      <ErrorBox error={error} retry={reload} />
      {!data ? (
        <Loading />
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
          {data.staff.map((s) => (
            <Link key={s.id} to={`/owner/staff/${s.id}`} className={`flex items-center gap-3 p-4 active:bg-surface-2 ${s.active ? '' : 'opacity-50'}`}>
              <Avatar name={s.name} color={s.color} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-[17px] font-bold">
                  <span className="truncate">{s.name}</span>
                  {s.role !== 'staff' && <Badge tone="brand">{s.role === 'owner' ? t('Owner') : t('Manager')}</Badge>}
                  {has('attendance') && s.presentToday && <Badge tone="money">{t('Present')}</Badge>}
                  {!s.active && <Badge>{t('Removed')}</Badge>}
                </p>
                <p className="text-sm text-muted">
                  {t('This month {amount}', { amount: rs(s.monthSales) })}
                  {has('commission') && s.commissionPct > 0 && ` · ${s.commissionPct}% = ${rs(s.monthCommission)}`}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
      <AddStaff open={adding} canManager={isOwner} onClose={() => setAdding(false)} onDone={() => { setAdding(false); void reload(); }} />
    </Screen>
  );
}

function AddStaff({ open, canManager, onClose, onDone }: { open: boolean; canManager: boolean; onClose: () => void; onDone: () => void }) {
  const { me } = useSession();
  const { toast } = useUi();
  const [form, setForm] = useState({ name: '', phone: '', pin: '', commission: '40', productCommission: '10', salary: 0, role: 'staff' as 'staff' | 'manager' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ name: string; phone: string; pin: string; existing: boolean } | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const phone = form.phone.replace(/\D/g, '').slice(-10);
      const res = await api.post<{ id: string; existingUser: boolean }>('/api/shop/staff', {
        name: form.name.trim(),
        phone,
        pin: form.pin,
        role: form.role,
        commissionPct: Number(form.commission) || 0,
        productCommissionPct: Number(form.productCommission) || 0,
        monthlySalary: form.salary,
      });
      setDone({ name: form.name.trim(), phone, pin: form.pin, existing: res.existingUser });
    } catch (err) {
      toast(message(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  const close = () => {
    if (done) onDone();
    else onClose();
    setDone(null);
    setForm({ ...form, name: '', phone: '', pin: '' });
  };
  const link = `${window.location.origin}/${form.role === 'manager' ? 'owner' : 'staff'}`;
  return (
    <Sheet open={open} onClose={close} title={done ? t('Added!') : t('Add staff')}>
      {done ? (
        <div className="space-y-4">
          <p className="text-lg">
            {done.existing
              ? t('{name} already uses SnipMemory and logs in with their own PIN.', { name: done.name })
              : t('{name} can now log in with mobile {phone} and PIN {pin}.', { name: done.name, phone: done.phone, pin: done.pin })}
          </p>
          <Button
            block
            size="lg"
            variant="money"
            icon="whatsapp"
            onClick={() =>
              whatsapp(
                `91${done.phone}`,
                t('Hi {name}, you are added to {shop} on SnipMemory. Open {link} → login with your number{pin}. Then tap “Add to Home screen”.', {
                  name: done.name,
                  shop: me.shop.name,
                  link,
                  pin: done.existing ? '' : ` and PIN ${done.pin}`,
                }),
              )
            }
          >
            {t('Send app link on WhatsApp')}
          </Button>
          <Button block variant="secondary" size="lg" onClick={close}>
            {t('Done')}
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Input label={t('Name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus />
          <Input label={t('Mobile number')} prefix="+91" type="tel" inputMode="numeric" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
          <Input label={t('4-digit PIN for the Staff app')} inputMode="numeric" maxLength={4} value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })} hint={t('Tell them this PIN. Not 1234 or 0000.')} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('Commission on services %')} inputMode="numeric" maxLength={3} value={form.commission} onChange={(e) => setForm({ ...form, commission: e.target.value.replace(/\D/g, '') })} />
            <Input label={t('On products %')} inputMode="numeric" maxLength={3} value={form.productCommission} onChange={(e) => setForm({ ...form, productCommission: e.target.value.replace(/\D/g, '') })} />
          </div>
          <MoneyInput label={t('Fixed monthly salary (if any)')} value={form.salary} onChange={(v) => setForm({ ...form, salary: v })} />
          {canManager && (
            <Chips
              value={form.role}
              onChange={(role) => setForm({ ...form, role })}
              options={[
                { value: 'staff', label: t('Barber / Staff') },
                { value: 'manager', label: t('Manager (uses Owner app)') },
              ]}
            />
          )}
          <Button type="submit" size="lg" block loading={busy} disabled={form.pin.length !== 4}>
            {t('Add')}
          </Button>
        </form>
      )}
    </Sheet>
  );
}
