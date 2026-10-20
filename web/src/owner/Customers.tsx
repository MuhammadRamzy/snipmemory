import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { I } from '../components/icons';
import { Avatar, Button, Chips, Empty, ErrorBox, Input, Loading, Screen, Sheet, useUi } from '../components/ui';
import { ApiError, api, message } from '../lib/api';
import { daysAgo, phoneDisplay, rs } from '../lib/format';
import { t } from '../lib/i18n';
import type { Customer } from '../lib/types';
import { useApi } from '../lib/useApi';

type Filter = 'all' | 'due' | 'advance' | 'winback' | 'birthday' | 'regulars';

export default function Customers() {
  const [params, setParams] = useSearchParams();
  const filter = (params.get('filter') as Filter) || 'all';
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [adding, setAdding] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(id);
  }, [q]);
  const { data, error, reload, loading } = useApi<{ customers: Customer[]; totals: { due: number; advance: number } }>(
    `/api/shop/customers?filter=${filter}&q=${encodeURIComponent(debounced)}&limit=100`,
  );

  return (
    <Screen title={t('Customers')} right={<Button size="sm" icon="plus" onClick={() => setAdding(true)}>{t('Add')}</Button>}>
      <span className="flex h-13 items-center gap-2 rounded-2xl border-2 border-line bg-surface px-3">
        <I.search className="text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search name or mobile')} className="h-12 min-w-0 flex-1 bg-transparent outline-none" />
      </span>
      <div className="mt-3">
        <Chips
          scroll
          value={filter}
          onChange={(v) => setParams({ filter: v })}
          options={[
            { value: 'all', label: t('All') },
            { value: 'due', label: t('Udhaar') },
            { value: 'advance', label: t('Advance') },
            { value: 'winback', label: t('Not coming') },
            { value: 'birthday', label: t('Birthdays') },
            { value: 'regulars', label: t('Regulars') },
          ]}
        />
      </div>
      {filter === 'due' && data && (
        <div className="mt-4 rounded-3xl bg-due-soft p-4 text-due">
          <p className="font-semibold">{t('Total udhaar to collect')}</p>
          <p className="text-3xl font-extrabold">{rs(data.totals.due)}</p>
        </div>
      )}
      {filter === 'winback' && <p className="mt-3 px-1 text-sm text-muted">{t('Customers who have not come for a while. Tap one and send a WhatsApp “we miss you”.')}</p>}
      <ErrorBox error={error} retry={reload} />
      {loading && !data ? (
        <Loading />
      ) : !data?.customers.length ? (
        <Empty icon="users" title={debounced ? t('No customer found') : t('No customers yet')}>{t('Customers are saved automatically when you add their mobile number on a bill.')}</Empty>
      ) : (
        <div className="mt-4 divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
          {data.customers.map((c) => (
            <Link key={c.id} to={`/owner/customers/${c.id}`} className="flex items-center gap-3 p-4 active:bg-surface-2">
              <Avatar name={c.name} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[17px] font-bold">{c.name}</p>
                <p className="truncate text-sm text-muted">
                  {phoneDisplay(c.phone)} · {t('{n} visits', { n: c.visitCount })} · {daysAgo(c.lastVisitAt)}
                </p>
              </div>
              {c.balance !== 0 && (
                <span className={`text-right text-sm font-bold ${c.balance < 0 ? 'text-due' : 'text-money'}`}>
                  {c.balance < 0 ? t('Udhaar') : t('Advance')}
                  <span className="block text-base">{rs(Math.abs(c.balance))}</span>
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
      <AddCustomer open={adding} onClose={() => setAdding(false)} />
    </Screen>
  );
}

function AddCustomer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { toast } = useUi();
  const [form, setForm] = useState({ name: '', phone: '', birthday: '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const birthday = form.birthday ? form.birthday.slice(5) : null;
      const res = await api.post<{ customer: Customer }>('/api/shop/customers', { name: form.name, phone: form.phone || null, birthday });
      navigate(`/owner/customers/${res.customer.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const existing = (err.data as { customer: Customer }).customer;
        navigate(`/owner/customers/${existing.id}`);
        toast(err.message);
      } else toast(message(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title={t('New customer')}>
      <form onSubmit={submit} className="space-y-4">
        <Input label={t('Name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus />
        <Input label={t('Mobile')} prefix="+91" type="tel" inputMode="numeric" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <Input label={t('Birthday (optional)')} type="date" value={form.birthday} onChange={(e) => setForm({ ...form, birthday: e.target.value })} hint={t('Only day and month are saved, for birthday wishes.')} />
        <Button type="submit" size="lg" block loading={busy}>
          {t('Save')}
        </Button>
      </form>
    </Sheet>
  );
}
