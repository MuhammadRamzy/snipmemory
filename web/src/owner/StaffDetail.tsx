import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { I } from '../components/icons';
import { Avatar, Button, Card, Chips, ErrorBox, Input, Loading, MoneyInput, Screen, Section, Sheet, useUi } from '../components/ui';
import { api, message } from '../lib/api';
import { dayKey, dayLabel, monthLabel, phoneDisplay, rs } from '../lib/format';
import { t } from '../lib/i18n';
import { useSession } from '../lib/session';
import type { Mode, StaffMember } from '../lib/types';
import { useApi } from '../lib/useApi';

export interface Summary {
  month: string;
  bills: number;
  services: number;
  sales: number;
  productSales: number;
  commission: number;
  salary: number;
  bonus: number;
  deduction: number;
  advance: number;
  payout: number;
  earned: number;
  paid: number;
  balance: number;
  daysPresent: number;
  daily: { day: string; bills: number; sales: number }[];
  txns: { id: string; kind: string; amount: number; mode: string; note: string | null; day: string }[];
}

const KIND_LABEL: Record<string, string> = { advance: 'Advance', payout: 'Salary paid', bonus: 'Bonus', deduction: 'Deduction' };

export function shiftMonth(month: string, n: number) {
  const d = new Date(`${month}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
}

export function PayrollCard({ s, month, setMonth, showCommission }: { s: Summary; month: string; setMonth: (m: string) => void; showCommission: boolean }) {
  const thisMonth = dayKey().slice(0, 7);
  return (
    <>
      <div className="flex items-center gap-2">
        <button onClick={() => setMonth(shiftMonth(month, -1))} className="grid size-12 place-items-center rounded-2xl border-2 border-line bg-surface" aria-label={t('Previous month')}>
          <I.back />
        </button>
        <p className="flex-1 text-center text-lg font-bold">{monthLabel(month)}</p>
        <button onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= thisMonth} className="grid size-12 place-items-center rounded-2xl border-2 border-line bg-surface disabled:opacity-30" aria-label={t('Next month')}>
          <I.right />
        </button>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Box label={t('Bills')} value={String(s.bills)} />
        <Box label={t('Services')} value={String(s.services)} />
        <Box label={t('Sale')} value={rs(s.sales)} />
      </div>
      <Card className="mt-4 p-5">
        <div className="space-y-2 text-[17px]">
          {showCommission && <Line label={t('Commission')} value={rs(s.commission)} />}
          {s.salary > 0 && <Line label={t('Fixed salary')} value={rs(s.salary)} />}
          {s.bonus > 0 && <Line label={t('Bonus')} value={`+ ${rs(s.bonus)}`} />}
          {s.deduction > 0 && <Line label={t('Deduction')} value={`− ${rs(s.deduction)}`} />}
          <Line label={t('Total earned')} value={rs(s.earned)} bold />
          {s.advance > 0 && <Line label={t('Advance taken')} value={`− ${rs(s.advance)}`} />}
          {s.payout > 0 && <Line label={t('Already paid')} value={`− ${rs(s.payout)}`} />}
        </div>
        <div className={`mt-3 flex items-end justify-between rounded-2xl p-3 ${s.balance >= 0 ? 'bg-money-soft text-money' : 'bg-due-soft text-due'}`}>
          <span className="font-bold">{s.balance >= 0 ? t('Still to pay') : t('Paid extra')}</span>
          <span className="text-3xl font-extrabold tabular-nums">{rs(Math.abs(s.balance))}</span>
        </div>
      </Card>
    </>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <p className="text-sm text-muted">{label}</p>
      <p className="font-extrabold tabular-nums">{value}</p>
    </div>
  );
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'border-t border-line pt-2 font-bold' : ''}`}>
      <span className={bold ? '' : 'text-muted'}>{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export default function StaffDetail() {
  const { id } = useParams();
  const { has, isOwner } = useSession();
  const { toast, ask } = useUi();
  const [month, setMonth] = useState(dayKey().slice(0, 7));
  const { data, error, reload } = useApi<{ staff: StaffMember; summary: Summary }>(`/api/shop/staff/${id}/summary?month=${month}`);
  const [txn, setTxn] = useState<null | 'advance' | 'payout' | 'bonus' | 'deduction'>(null);
  const [editing, setEditing] = useState(false);

  if (error) return <Screen title={t('Staff')} back="/owner/staff"><ErrorBox error={error} retry={reload} /></Screen>;
  if (!data) return <Loading />;
  const { staff: s, summary } = data;

  const resetPin = async () => {
    const pin = await ask({ title: t('New PIN for {name}', { name: s.name }), input: { label: t('4-digit PIN'), required: true }, confirm: t('Save PIN'), cancel: t('Cancel') });
    if (typeof pin !== 'string' || !pin) return;
    try {
      await api.post(`/api/shop/staff/${s.id}/pin`, { pin });
      toast(t('PIN changed. Tell {name} the new PIN.', { name: s.name }));
    } catch (err) {
      toast(message(err), 'error');
    }
  };

  const remove = async () => {
    if (!(await ask({ title: t('Remove {name}?', { name: s.name }), body: t('They will be logged out. Their old bills stay in reports.'), confirm: t('Remove'), danger: true }))) return;
    try {
      await api.patch(`/api/shop/staff/${s.id}`, { active: false });
      toast(t('Removed'));
      void reload();
    } catch (err) {
      toast(message(err), 'error');
    }
  };

  return (
    <Screen title={s.name} back="/owner/staff">
      <div className="mb-4 flex items-center gap-4">
        <Avatar name={s.name} color={s.color} size={60} />
        <div>
          <p className="text-xl font-extrabold">{s.name}</p>
          <p className="text-muted">
            {phoneDisplay(s.phone)} · {has('commission') ? t('{n}% commission', { n: s.commissionPct }) : s.role}
          </p>
          {has('attendance') && <p className="text-sm text-muted">{t('{n} days present this month', { n: summary.daysPresent })}</p>}
        </div>
      </div>

      <PayrollCard s={summary} month={month} setMonth={setMonth} showCommission={has('commission')} />

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => setTxn('advance')}>
          {t('Give advance')}
        </Button>
        <Button onClick={() => setTxn('payout')}>{t('Pay salary')}</Button>
        <Button variant="secondary" size="sm" onClick={() => setTxn('bonus')}>
          {t('Bonus')}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setTxn('deduction')}>
          {t('Deduction')}
        </Button>
      </div>

      {summary.txns.length > 0 && (
        <Section title={t('Money given')}>
          <div className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
            {summary.txns.map((x) => (
              <div key={x.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold">{t(KIND_LABEL[x.kind] ?? x.kind)}</p>
                  <p className="text-sm text-muted">
                    {dayLabel(x.day)} · {x.mode.toUpperCase()}
                    {x.note ? ` · ${x.note}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold tabular-nums">{rs(x.amount)}</span>
                  <button
                    className="grid size-10 place-items-center rounded-full text-muted active:bg-surface-2"
                    aria-label={t('Delete')}
                    onClick={async () => {
                      if (await ask({ title: t('Delete this entry?'), confirm: t('Delete'), danger: true })) {
                        await api.del(`/api/shop/staff/txns/${x.id}`);
                        void reload();
                      }
                    }}
                  >
                    <I.trash size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {summary.daily.length > 0 && (
        <Section title={t('Day by day')}>
          <div className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
            {[...summary.daily].reverse().map((d) => (
              <Link key={d.day} to={`/owner/bills?day=${d.day}&staff=${s.id}`} className="flex items-center justify-between p-4 active:bg-surface-2">
                <span className="font-semibold">{dayLabel(d.day)}</span>
                <span className="text-muted">
                  {t('{n} bills', { n: d.bills })} · <span className="font-bold text-ink">{rs(d.sales)}</span>
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {s.role !== 'owner' && (
        <Section title={t('Settings')}>
          <div className="space-y-2">
            <Button block variant="secondary" icon="edit" onClick={() => setEditing(true)}>
              {t('Edit commission / salary')}
            </Button>
            <Button block variant="secondary" icon="lock" onClick={resetPin}>
              {t('Reset PIN')}
            </Button>
            {s.active ? (
              <Button block variant="ghost" className="text-danger" icon="trash" onClick={remove} disabled={s.role === 'manager' && !isOwner}>
                {t('Remove from shop')}
              </Button>
            ) : (
              <Button block variant="secondary" onClick={async () => { try { await api.patch(`/api/shop/staff/${s.id}`, { active: true }); void reload(); } catch (err) { toast(message(err), 'error'); } }}>
                {t('Add back to shop')}
              </Button>
            )}
          </div>
        </Section>
      )}

      <TxnSheet kind={txn} staffId={s.id} onClose={() => setTxn(null)} onDone={() => { setTxn(null); void reload(); }} suggested={txn === 'payout' ? Math.max(0, summary.balance) : 0} />
      <EditSheet open={editing} staff={s} onClose={() => setEditing(false)} onDone={() => { setEditing(false); void reload(); }} />
    </Screen>
  );
}

function TxnSheet({ kind, staffId, suggested, onClose, onDone }: { kind: null | 'advance' | 'payout' | 'bonus' | 'deduction'; staffId: string; suggested: number; onClose: () => void; onDone: () => void }) {
  const { toast } = useUi();
  const [amount, setAmount] = useState(0);
  const [mode, setMode] = useState<Mode>('cash');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/api/shop/staff/${staffId}/txns`, { kind, amount, mode, note: note || null });
      setAmount(0);
      setNote('');
      onDone();
    } catch (err) {
      toast(message(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={Boolean(kind)} onClose={onClose} title={kind ? t(KIND_LABEL[kind]) : ''}>
      <form onSubmit={submit} className="space-y-4">
        {suggested > 0 && (
          <Button type="button" block variant="secondary" onClick={() => setAmount(suggested)}>
            {t('Pay balance {amount}', { amount: rs(suggested) })}
          </Button>
        )}
        <MoneyInput label={t('Amount')} value={amount} onChange={setAmount} autoFocus />
        {kind !== 'deduction' && <Chips value={mode} onChange={setMode} options={[{ value: 'cash', label: t('Cash') }, { value: 'upi', label: 'UPI' }]} />}
        <Input label={t('Note (optional)')} value={note} onChange={(e) => setNote(e.target.value)} />
        <Button type="submit" size="lg" block loading={busy} disabled={amount < 100}>
          {t('Save')}
        </Button>
      </form>
    </Sheet>
  );
}

function EditSheet({ open, staff, onClose, onDone }: { open: boolean; staff: StaffMember; onClose: () => void; onDone: () => void }) {
  const { toast } = useUi();
  const [form, setForm] = useState({ name: staff.name, commission: String(staff.commissionPct), product: String(staff.productCommissionPct), salary: staff.monthlySalary });
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title={t('Edit {name}', { name: staff.name })}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api.patch(`/api/shop/staff/${staff.id}`, { name: form.name, commissionPct: Number(form.commission) || 0, productCommissionPct: Number(form.product) || 0, monthlySalary: form.salary });
            onDone();
          } catch (err) {
            toast(message(err), 'error');
          } finally {
            setBusy(false);
          }
        }}
      >
        <Input label={t('Name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('Commission on services %')} inputMode="numeric" value={form.commission} onChange={(e) => setForm({ ...form, commission: e.target.value.replace(/\D/g, '') })} />
          <Input label={t('On products %')} inputMode="numeric" value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value.replace(/\D/g, '') })} />
        </div>
        <MoneyInput label={t('Fixed monthly salary')} value={form.salary} onChange={(v) => setForm({ ...form, salary: v })} />
        <p className="text-sm text-muted">{t('New commission applies to new bills only.')}</p>
        <Button type="submit" size="lg" block loading={busy}>
          {t('Save')}
        </Button>
      </form>
    </Sheet>
  );
}
