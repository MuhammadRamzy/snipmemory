import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Avatar, Button, Card, Chips, ErrorBox, Input, Loading, MoneyInput, Screen, Section, Sheet, TextArea, useUi } from '../components/ui';
import { api, message } from '../lib/api';
import { dateTime, daysAgo, phoneDisplay, rs } from '../lib/format';
import { t } from '../lib/i18n';
import { compressPhoto } from '../lib/image';
import { useSession } from '../lib/session';
import { callPhone, whatsapp } from '../lib/share';
import type { Bill, Customer, Mode } from '../lib/types';
import { useApi } from '../lib/useApi';
import { payBadges } from '../shared/Bills';

interface Detail {
  customer: Customer;
  bills: Bill[];
  ledger: { id: string; kind: string; amount: number; mode: string | null; note: string | null; createdAt: number }[];
  photos: { id: string; url: string; note: string | null; createdAt: number }[];
}

const LEDGER_LABEL: Record<string, string> = {
  bill_due: 'Udhaar on bill',
  bill_advance_used: 'Advance used',
  due_paid: 'Udhaar paid',
  advance_added: 'Advance given',
  adjust: 'Adjusted',
  void_reversal: 'Bill cancelled',
};

export default function CustomerDetail() {
  const { id } = useParams();
  const { me, has, isOwner } = useSession();
  const { toast, ask } = useUi();
  const navigate = useNavigate();
  const { data, error, reload } = useApi<Detail>(`/api/shop/customers/${id}`);
  const [money, setMoney] = useState<null | 'due_paid' | 'advance_added'>(null);
  const [editing, setEditing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  if (error) return <Screen title={t('Customer')} back="/owner/customers"><ErrorBox error={error} retry={reload} /></Screen>;
  if (!data) return <Loading />;
  const c = data.customer;
  const first = c.name.split(' ')[0];
  const shop = me.shop.name;
  const templates = [
    c.balance < 0 && { label: t('Udhaar reminder'), text: t('Namaste {name}, a balance of {amount} is pending at {shop}. Please pay on your next visit or by UPI. Thank you 🙏', { name: first, amount: rs(-c.balance), shop }) },
    { label: t('We miss you'), text: t('Hi {name}! It has been a while since your last visit to {shop}. Come in this week — we will keep your chair ready 💈', { name: first, shop }) },
    { label: t('Birthday wish'), text: t('Happy birthday {name}! 🎉 Enjoy a special treat at {shop} this week.', { name: first, shop }) },
    { label: t('Offer'), text: t('Hi {name}, this week at {shop}: ', { name: first, shop }) },
  ].filter(Boolean) as { label: string; text: string }[];

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      await api.upload(`/api/shop/customers/${c.id}/photos`, await compressPhoto(file));
      toast(t('Photo saved'));
      void reload();
    } catch (err) {
      toast(message(err), 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Screen title={c.name} back="/owner/customers">
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <Avatar name={c.name} size={60} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-extrabold">{c.name}</p>
            <p className="text-muted">{phoneDisplay(c.phone) || t('No mobile number')}</p>
            <p className="text-sm text-muted">
              {t('{n} visits', { n: c.visitCount })} · {t('spent {amount}', { amount: rs(c.totalSpend) })} · {t('last {when}', { when: daysAgo(c.lastVisitAt) })}
            </p>
          </div>
        </div>
        {c.phone && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Button size="sm" variant="secondary" icon="phone" onClick={() => callPhone(c.phone!)}>
              {t('Call')}
            </Button>
            <Button size="sm" variant="secondary" icon="whatsapp" onClick={() => whatsapp(c.phone, `Hi ${first}`)}>
              WhatsApp
            </Button>
            <Button size="sm" icon="plus" onClick={() => navigate(`/owner/bill?phone=${encodeURIComponent(c.phone!)}&name=${encodeURIComponent(c.name)}`)}>
              {t('Bill')}
            </Button>
          </div>
        )}
      </Card>

      <Card className={`mt-4 p-5 ${c.balance < 0 ? 'bg-due-soft' : c.balance > 0 ? 'bg-money-soft' : ''}`}>
        <p className="font-semibold text-muted">{c.balance < 0 ? t('Udhaar (customer owes you)') : c.balance > 0 ? t('Advance (you owe customer)') : t('Khata balance')}</p>
        <p className={`text-4xl font-extrabold tabular-nums ${c.balance < 0 ? 'text-due' : c.balance > 0 ? 'text-money' : ''}`}>{rs(Math.abs(c.balance))}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant={c.balance < 0 ? 'brand' : 'secondary'} disabled={c.balance >= 0} onClick={() => setMoney('due_paid')}>
            {t('Collect udhaar')}
          </Button>
          <Button variant="secondary" onClick={() => setMoney('advance_added')}>
            {t('Add advance')}
          </Button>
        </div>
      </Card>

      {c.phone && (
        <Section title={t('Send on WhatsApp')}>
          <div className="flex flex-wrap gap-2">
            {templates.map((tpl) => (
              <Button key={tpl.label} size="sm" variant="secondary" icon="whatsapp" onClick={() => whatsapp(c.phone, tpl.text)}>
                {tpl.label}
              </Button>
            ))}
          </div>
        </Section>
      )}

      {has('photos') && (
        <Section
          title={t('Cut photos')}
          action={
            <>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
              <Button size="sm" variant="secondary" icon="camera" loading={uploading} onClick={() => fileRef.current?.click()}>
                {t('Add')}
              </Button>
            </>
          }
        >
          {data.photos.length ? (
            <div className="grid grid-cols-3 gap-2">
              {data.photos.map((p) => (
                <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="aspect-[3/4] overflow-hidden rounded-2xl bg-surface-2">
                  <img src={p.url} alt="" loading="lazy" className="size-full object-cover" />
                </a>
              ))}
            </div>
          ) : (
            <p className="px-1 text-muted">{t('Save a photo after the cut — next time any barber can give the same style.')}</p>
          )}
        </Section>
      )}

      {c.notes && (
        <Section title={t('Notes')}>
          <Card className="whitespace-pre-line p-4">{c.notes}</Card>
        </Section>
      )}

      <Section title={t('Visits')}>
        {data.bills.length ? (
          <div className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
            {data.bills.map((b) => (
              <Link key={b.id} to={`/owner/bills/${b.id}`} className="flex items-center gap-3 p-4 active:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{b.items.map((i) => i.name).join(', ')}</p>
                  <p className="text-sm text-muted">
                    {dateTime(b.createdAt)} · {b.staffName}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-extrabold tabular-nums">{rs(b.total)}</span>
                  {payBadges(b)}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="px-1 text-muted">{t('No visits yet.')}</p>
        )}
      </Section>

      {data.ledger.length > 0 && (
        <Section title={t('Khata history')}>
          <div className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
            {data.ledger.map((l) => (
              <div key={l.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold">{t(LEDGER_LABEL[l.kind] ?? l.kind)}</p>
                  <p className="text-sm text-muted">
                    {dateTime(l.createdAt)}
                    {l.mode ? ` · ${l.mode.toUpperCase()}` : ''}
                  </p>
                </div>
                <span className={`font-bold tabular-nums ${l.amount < 0 ? 'text-due' : 'text-money'}`}>
                  {l.amount < 0 ? '−' : '+'}
                  {rs(Math.abs(l.amount))}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button variant="secondary" icon="edit" onClick={() => setEditing(true)}>
          {t('Edit')}
        </Button>
        {isOwner && (
          <Button
            variant="ghost"
            className="text-danger"
            icon="trash"
            onClick={async () => {
              if (!(await ask({ title: t('Delete {name}?', { name: c.name }), body: t('Their photos and details will be removed. Old bills stay in reports.'), confirm: t('Delete'), danger: true }))) return;
              try {
                await api.del(`/api/shop/customers/${c.id}`);
                navigate('/owner/customers');
              } catch (err) {
                toast(message(err), 'error');
              }
            }}
          >
            {t('Delete')}
          </Button>
        )}
      </div>

      <MoneySheet kind={money} customer={c} onClose={() => setMoney(null)} onDone={() => { setMoney(null); void reload(); }} />
      <EditSheet open={editing} customer={c} onClose={() => setEditing(false)} onDone={() => { setEditing(false); void reload(); }} />
    </Screen>
  );
}

function MoneySheet({ kind, customer, onClose, onDone }: { kind: null | 'due_paid' | 'advance_added'; customer: Customer; onClose: () => void; onDone: () => void }) {
  const { toast } = useUi();
  const [amount, setAmount] = useState(0);
  const [mode, setMode] = useState<Mode>('cash');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/api/shop/customers/${customer.id}/ledger`, { kind, amount, mode });
      toast(kind === 'due_paid' ? t('Udhaar collected') : t('Advance added'));
      setAmount(0);
      onDone();
    } catch (err) {
      toast(message(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={Boolean(kind)} onClose={onClose} title={kind === 'due_paid' ? t('Collect udhaar') : t('Add advance')}>
      <form onSubmit={submit} className="space-y-4">
        {kind === 'due_paid' && (
          <Button type="button" variant="secondary" block onClick={() => setAmount(-customer.balance)}>
            {t('Full amount {amount}', { amount: rs(-customer.balance) })}
          </Button>
        )}
        <MoneyInput label={t('Amount')} value={amount} onChange={setAmount} autoFocus />
        <Chips value={mode} onChange={setMode} options={[{ value: 'cash', label: t('Cash') }, { value: 'upi', label: 'UPI' }, { value: 'card', label: t('Card') }]} />
        <Button type="submit" size="lg" block loading={busy} disabled={!amount}>
          {t('Save')}
        </Button>
      </form>
    </Sheet>
  );
}

function EditSheet({ open, customer, onClose, onDone }: { open: boolean; customer: Customer; onClose: () => void; onDone: () => void }) {
  const { toast } = useUi();
  const [form, setForm] = useState({ name: customer.name, phone: customer.phone?.replace(/^\+91/, '') ?? '', notes: customer.notes ?? '' });
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title={t('Edit customer')}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api.patch(`/api/shop/customers/${customer.id}`, { name: form.name, phone: form.phone || null, notes: form.notes || null });
            onDone();
          } catch (err) {
            toast(message(err), 'error');
          } finally {
            setBusy(false);
          }
        }}
      >
        <Input label={t('Name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <Input label={t('Mobile')} prefix="+91" type="tel" inputMode="numeric" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <TextArea label={t('Notes (style, allergies, preferences)')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <Button type="submit" size="lg" block loading={busy}>
          {t('Save')}
        </Button>
      </form>
    </Sheet>
  );
}
