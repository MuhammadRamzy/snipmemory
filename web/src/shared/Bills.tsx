import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { I } from '../components/icons';
import { Badge, Chips, Empty, ErrorBox, Loading, Screen, cx } from '../components/ui';
import { dayKey, dayLabel, rs, shiftDay, time } from '../lib/format';
import { t } from '../lib/i18n';
import { useSession } from '../lib/session';
import type { Bill } from '../lib/types';
import { useApi } from '../lib/useApi';

type Mode = 'all' | 'upi' | 'cash' | 'due' | 'void';

export function payBadges(b: Bill) {
  if (b.voided) return <Badge tone="danger">{t('Cancelled')}</Badge>;
  return (
    <span className="flex flex-wrap justify-end gap-1">
      {b.paidUpi > 0 && <Badge tone="brand">UPI</Badge>}
      {b.paidCash > 0 && <Badge tone="money">{t('Cash')}</Badge>}
      {b.paidCard > 0 && <Badge>{t('Card')}</Badge>}
      {b.paidAdvance > 0 && <Badge>{t('Advance')}</Badge>}
      {b.due > 0 && <Badge tone="due">{t('Udhaar')}</Badge>}
    </span>
  );
}

export default function Bills({ app }: { app: 'owner' | 'staff' }) {
  const { me } = useSession();
  const [params, setParams] = useSearchParams();
  const today = dayKey();
  const day = params.get('day') ?? today;
  const [mode, setMode] = useState<Mode>('all');
  const staffFilter = params.get('staff') ?? '';
  const { data, error, reload, loading } = useApi<{ bills: Bill[] }>(`/api/shop/bills?from=${day}&to=${day}&mode=${mode}&limit=200${staffFilter ? `&staffId=${staffFilter}` : ''}`);
  const bills = data?.bills ?? [];
  const total = bills.filter((b) => !b.voided).reduce((s, b) => s + b.total, 0);
  const setDay = (d: string) => setParams((p) => {
    p.set('day', d);
    return p;
  });

  return (
    <Screen title={app === 'owner' ? t('Bills') : t('My bills')}>
      <div className="flex items-center gap-2">
        <button onClick={() => setDay(shiftDay(day, -1))} className="grid size-12 place-items-center rounded-2xl border-2 border-line bg-surface" aria-label={t('Previous day')}>
          <I.back />
        </button>
        <label className="relative flex h-12 flex-1 items-center justify-center rounded-2xl border-2 border-line bg-surface font-bold">
          <I.calendar size={20} className="mr-2 text-muted" />
          {dayLabel(day)}
          <input type="date" value={day} max={today} onChange={(e) => e.target.value && setDay(e.target.value)} className="absolute inset-0 opacity-0" aria-label={t('Choose date')} />
        </label>
        <button onClick={() => setDay(shiftDay(day, 1))} disabled={day >= today} className="grid size-12 place-items-center rounded-2xl border-2 border-line bg-surface disabled:opacity-30" aria-label={t('Next day')}>
          <I.right />
        </button>
      </div>
      <div className="mt-3">
        <Chips
          scroll
          value={mode}
          onChange={setMode}
          options={[
            { value: 'all', label: t('All') },
            { value: 'upi', label: 'UPI' },
            { value: 'cash', label: t('Cash') },
            { value: 'due', label: t('Udhaar') },
            { value: 'void', label: t('Cancelled') },
          ]}
        />
      </div>
      {app === 'owner' && staffFilter && (
        <p className="mt-3 text-sm font-semibold text-muted">
          {t('Showing one staff member')} · <button className="text-brand-text" onClick={() => setParams((p) => { p.delete('staff'); return p; })}>{t('Show all')}</button>
        </p>
      )}

      <div className="mt-4 flex items-end justify-between px-1">
        <span className="font-semibold text-muted">{t('{n} bills', { n: bills.filter((b) => !b.voided).length })}</span>
        <span className="text-2xl font-extrabold tabular-nums">{rs(total)}</span>
      </div>

      <ErrorBox error={error} retry={reload} />
      {loading && !data ? (
        <Loading />
      ) : bills.length === 0 ? (
        <Empty title={t('No bills')}>{day === today ? t('Bills you make today show here.') : t('No bills on this day.')}</Empty>
      ) : (
        <div className="mt-2 divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
          {bills.map((b) => (
            <Link key={b.id} to={`/${app}/bills/${b.id}`} className="flex items-center gap-3 p-4 active:bg-surface-2">
              <div className="min-w-0 flex-1">
                <p className={cx('truncate text-[17px] font-bold', b.voided && 'text-muted line-through')}>{b.customerName || t('Walk-in')}</p>
                <p className="truncate text-sm text-muted">
                  #{me.shop.billPrefix}
                  {b.billNo} · {time(b.createdAt)} · {b.items.map((i) => i.name).join(', ')}
                  {app === 'owner' && b.staffName ? ` · ${b.staffName}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-lg font-extrabold tabular-nums">{rs(b.total)}</span>
                {payBadges(b)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </Screen>
  );
}
