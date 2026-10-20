import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { I } from '../components/icons';
import { Avatar, Button, Card, ErrorBox, Loading, Notice, Section, Sheet, cx } from '../components/ui';
import { api } from '../lib/api';
import { rs } from '../lib/format';
import { t } from '../lib/i18n';
import { useSession } from '../lib/session';
import { useApi } from '../lib/useApi';
import { InstallTip } from '../shared/InstallTip';

interface Sums {
  bills: number;
  sales: number;
  cash: number;
  upi: number;
  card: number;
  due: number;
  advance: number;
}

interface HomeData {
  day: string;
  today: Sums;
  yesterday: Sums;
  month: Sums;
  collectedToday: { cash: number; upi: number };
  expensesToday: number;
  byStaff: { id: string; name: string; color: string; bills: number; sales: number; commission: number }[];
  queueWaiting: number;
  udhaar: { amount: number; people: number };
  lowStock: number;
  upiMissing: boolean;
}

export default function Home() {
  const { me, has, refresh } = useSession();
  const { data, error, reload } = useApi<HomeData>('/api/shop/home');
  const [switching, setSwitching] = useState(false);
  const navigate = useNavigate();
  const shop = me.shop;
  const trialDays = shop.trial && shop.planExpiresAt ? Math.max(0, Math.ceil((shop.planExpiresAt - Date.now()) / 86_400_000)) : null;
  const billLimit = me.plan.monthlyBillLimit;

  return (
    <div className="mx-auto max-w-xl px-4 pb-32">
      <header className="pt-safe flex items-center justify-between py-4">
        <button onClick={() => setSwitching(true)} className="min-w-0 text-left">
          <p className="text-sm font-semibold text-muted">{t('Namaste, {name}', { name: me.me.name.split(' ')[0] })}</p>
          <p className="flex items-center gap-1 truncate text-xl font-extrabold">
            {shop.name} <I.down size={20} className="shrink-0 text-muted" />
          </p>
        </button>
        <Link to="/owner/help" className="grid size-12 place-items-center rounded-full bg-surface" aria-label={t('Help')}>
          <I.help />
        </Link>
      </header>

      <ErrorBox error={error} retry={reload} />
      {!data && !error && <Loading />}
      {data && (
        <div className="rise space-y-4">
          <Card className="overflow-hidden">
            <div className="bg-brand p-5 text-brand-ink">
              <p className="font-semibold opacity-85">{t('Today’s sale')}</p>
              <p className="text-5xl font-extrabold tabular-nums">{rs(data.today.sales)}</p>
              <p className="mt-1 opacity-85">
                {t('{n} bills', { n: data.today.bills })}
                {data.yesterday.sales > 0 && ` · ${t('Yesterday {amount}', { amount: rs(data.yesterday.sales) })}`}
              </p>
            </div>
            <div className="grid grid-cols-3 divide-x divide-line text-center">
              <Split label={t('UPI')} value={data.today.upi + data.collectedToday.upi} />
              <Split label={t('Cash')} value={data.today.cash + data.collectedToday.cash} />
              <Split label={t('Udhaar')} value={data.today.due} due />
            </div>
          </Card>

          {data.upiMissing && (
            <Notice tone="warn" icon="qr" title={t('Add your UPI ID to show QR on bills')} action={<Button size="sm" onClick={() => navigate('/owner/settings')}>{t('Add UPI ID')}</Button>} />
          )}
          {trialDays !== null && trialDays <= 7 && (
            <Notice tone="brand" icon="star" title={t('Pro trial ends in {n} days', { n: trialDays })} action={<Button size="sm" onClick={() => navigate('/owner/plan')}>{t('See plans')}</Button>}>
              {t('After that you move to the Free plan. Your data stays safe.')}
            </Notice>
          )}
          {billLimit > 0 && me.usage.billsThisMonth >= billLimit * 0.8 && (
            <Notice tone={me.usage.billsThisMonth >= billLimit ? 'danger' : 'warn'} icon="receipt" title={t('{n} of {max} free bills used this month', { n: me.usage.billsThisMonth, max: billLimit })} action={<Button size="sm" onClick={() => navigate('/owner/plan')}>{t('Upgrade')}</Button>} />
          )}

          <div className="grid grid-cols-4 gap-2">
            <Quick to="/owner/bill" icon="plus" label={t('New bill')} primary />
            <Quick to="/owner/expenses?add=1" icon="wallet2" label={t('Expense')} />
            <Quick to="/owner/customers?filter=due" icon="book" label={t('Udhaar')} />
            {has('queue') ? <Quick to="/owner/queue" icon="ticket" label={t('Queue')} badge={data.queueWaiting} /> : <Quick to="/owner/reports" icon="chart" label={t('Reports')} />}
          </div>

          <Section title={t('Barbers today')} action={<Link to="/owner/staff" className="text-sm font-bold text-brand-text">{t('All staff')}</Link>}>
            <Card className="divide-y divide-line">
              {data.byStaff.map((s) => (
                <Link key={s.id} to={`/owner/staff/${s.id}`} className="flex items-center gap-3 p-4 active:bg-surface-2">
                  <Avatar name={s.name} color={s.color} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[17px] font-bold">{s.name}</p>
                    <p className="text-sm text-muted">
                      {t('{n} bills', { n: s.bills })}
                      {has('commission') && s.commission > 0 && ` · ${t('earned {amount}', { amount: rs(s.commission) })}`}
                    </p>
                  </div>
                  <span className="text-lg font-extrabold tabular-nums">{rs(s.sales)}</span>
                </Link>
              ))}
            </Card>
          </Section>

          <Section title={t('This month')}>
            <div className="grid grid-cols-2 gap-3">
              <Mini label={t('Sale')} value={rs(data.month.sales)} sub={t('{n} bills', { n: data.month.bills })} />
              <Link to="/owner/customers?filter=due">
                <Mini label={t('Udhaar to collect')} value={rs(data.udhaar.amount)} sub={t('{n} customers', { n: data.udhaar.people })} due={data.udhaar.amount > 0} />
              </Link>
              <Mini label={t('Expenses today')} value={rs(data.expensesToday)} />
              {has('inventory') ? (
                <Link to="/owner/products">
                  <Mini label={t('Low stock')} value={String(data.lowStock)} sub={t('products')} due={data.lowStock > 0} />
                </Link>
              ) : (
                <Link to="/owner/reports">
                  <Mini label={t('Reports')} value="→" sub={t('Sales, profit, staff')} />
                </Link>
              )}
            </div>
          </Section>

          {has('closing') && (
            <Link to="/owner/closing" className="flex items-center gap-3 rounded-3xl border border-line bg-surface p-4">
              <span className="grid size-11 place-items-center rounded-2xl bg-money-soft text-money">
                <I.cash />
              </span>
              <span className="flex-1">
                <span className="block font-bold">{t('Close the day (galla hisaab)')}</span>
                <span className="block text-sm text-muted">{t('Count cash and match with bills')}</span>
              </span>
              <I.right className="text-muted" />
            </Link>
          )}
          <InstallTip appName={t('Owner app')} />
        </div>
      )}

      <Sheet open={switching} onClose={() => setSwitching(false)} title={t('Your shops')}>
        <div className="space-y-2">
          {me.shops.map((s) => (
            <button
              key={s.id}
              onClick={async () => {
                if (s.id !== shop.id) {
                  await api.post('/api/auth/switch', { shopId: s.id });
                  await refresh();
                  void reload();
                }
                setSwitching(false);
              }}
              className={cx('flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left', s.id === shop.id ? 'border-brand bg-brand-soft' : 'border-line bg-surface')}
            >
              <I.store />
              <span className="flex-1">
                <span className="block font-bold">{s.name}</span>
                {s.city && <span className="block text-sm text-muted">{s.city}</span>}
              </span>
              {s.id === shop.id && <I.check className="text-brand-text" />}
            </button>
          ))}
          <Button block variant="secondary" icon="plus" onClick={() => { setSwitching(false); navigate('/owner/settings#branch'); }}>
            {t('Add another branch')}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

function Split({ label, value, due }: { label: string; value: number; due?: boolean }) {
  return (
    <div className="p-3">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className={cx('text-lg font-extrabold tabular-nums', due && value > 0 && 'text-due')}>{rs(value)}</p>
    </div>
  );
}

function Quick({ to, icon, label, primary, badge }: { to: string; icon: 'plus' | 'wallet2' | 'book' | 'ticket' | 'chart'; label: string; primary?: boolean; badge?: number }) {
  const Icon = I[icon];
  return (
    <Link to={to} className={cx('relative flex flex-col items-center gap-1.5 rounded-3xl p-3 text-center text-sm font-bold active:scale-95', primary ? 'bg-brand text-brand-ink' : 'border border-line bg-surface')}>
      <Icon size={26} />
      {label}
      {badge ? <span className="absolute right-2 top-2 grid min-w-6 place-items-center rounded-full bg-due px-1.5 text-xs text-white">{badge}</span> : null}
    </Link>
  );
}

function Mini({ label, value, sub, due }: { label: string; value: string; sub?: string; due?: boolean }) {
  return (
    <div className="h-full rounded-3xl border border-line bg-surface p-4">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className={cx('text-xl font-extrabold tabular-nums', due && 'text-due')}>{value}</p>
      {sub && <p className="text-sm text-muted">{sub}</p>}
    </div>
  );
}
