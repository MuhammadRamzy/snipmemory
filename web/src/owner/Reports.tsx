import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Avatar, Button, Card, Chips, ErrorBox, Input, Loading, Notice, Screen, Section, useUi } from '../components/ui';
import { getApp } from '../lib/api';
import { dayKey, dayLabel, rs, shiftDay } from '../lib/format';
import { t } from '../lib/i18n';
import { useSession } from '../lib/session';
import { useApi } from '../lib/useApi';
import { shiftMonth } from './StaffDetail';

interface Report {
  from: string;
  to: string;
  sales: { bills: number; total: number; discount: number; tax: number; cash: number; upi: number; card: number; advance: number; due: number; voids: number; services: number; products: number };
  money: { cashIn: number; onlineIn: number };
  collected: { due_cash: number; due_online: number; adv_cash: number; adv_online: number };
  expenses: { total: number; byCategory: { category: string; amount: number }[] };
  staffCost: { commission: number; paidToStaff: number };
  productCost: number;
  profit: number;
  customers: { served: number; new: number };
  byStaff: { id: string; name: string; color: string; bills: number; services: number; sales: number; commission: number }[];
  byService: { name: string; kind: string; qty: number; sales: number }[];
  daily: { day: string; bills: number; total: number }[];
}

type Preset = 'today' | 'yesterday' | 'week' | 'month' | 'last_month' | 'custom';

function rangeFor(p: Preset, custom: { from: string; to: string }) {
  const today = dayKey();
  if (p === 'today') return { from: today, to: today };
  if (p === 'yesterday') return { from: shiftDay(today, -1), to: shiftDay(today, -1) };
  if (p === 'week') return { from: shiftDay(today, -6), to: today };
  if (p === 'month') return { from: `${today.slice(0, 7)}-01`, to: today };
  if (p === 'last_month') {
    const m = shiftMonth(today.slice(0, 7), -1);
    return { from: `${m}-01`, to: shiftDay(`${today.slice(0, 7)}-01`, -1) };
  }
  return custom;
}

export default function Reports() {
  const { has } = useSession();
  const { toast } = useUi();
  const navigate = useNavigate();
  const [preset, setPreset] = useState<Preset>('today');
  const [custom, setCustom] = useState({ from: shiftDay(dayKey(), -30), to: dayKey() });
  const locked = !has('reports') && !['today', 'yesterday'].includes(preset);
  const { from, to } = rangeFor(preset, custom);
  const { data, error, reload } = useApi<Report>(locked ? null : `/api/shop/reports?from=${from}&to=${to}`);

  const exportCsv = async () => {
    try {
      const res = await fetch(`/api/shop/reports/bills.csv?from=${from}&to=${to}`, { headers: { 'x-app': getApp() } });
      if (!res.ok) throw new Error((await res.json()).error?.message ?? 'Export failed');
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `bills-${from}-to-${to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Export failed', 'error');
    }
  };

  const maxDay = Math.max(1, ...(data?.daily.map((d) => d.total) ?? [1]));

  return (
    <Screen title={t('Reports')} back="/owner/more">
      <Chips
        scroll
        value={preset}
        onChange={setPreset}
        options={[
          { value: 'today', label: t('Today') },
          { value: 'yesterday', label: t('Yesterday') },
          { value: 'week', label: t('7 days') },
          { value: 'month', label: t('This month') },
          { value: 'last_month', label: t('Last month') },
          { value: 'custom', label: t('Pick dates') },
        ]}
      />
      {preset === 'custom' && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Input type="date" label={t('From')} value={custom.from} max={custom.to} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
          <Input type="date" label={t('To')} value={custom.to} max={dayKey()} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
        </div>
      )}
      {locked ? (
        <div className="mt-5">
          <Notice tone="brand" icon="chart" title={t('Older reports are in Starter and above')} action={<Button size="sm" onClick={() => navigate('/owner/plan')}>{t('See plans')}</Button>}>
            {t('Free plan shows today and yesterday.')}
          </Notice>
        </div>
      ) : (
        <>
          <ErrorBox error={error} retry={reload} />
          {!data ? (
            <Loading />
          ) : (
            <div className="rise">
              <p className="mt-4 px-1 font-semibold text-muted">{from === to ? dayLabel(from) : `${dayLabel(from)} – ${dayLabel(to)}`}</p>
              <Card className="mt-2 overflow-hidden">
                <div className="bg-brand p-5 text-brand-ink">
                  <p className="font-semibold opacity-85">{t('Total sale')}</p>
                  <p className="text-4xl font-extrabold tabular-nums">{rs(data.sales.total)}</p>
                  <p className="opacity-85">
                    {t('{n} bills', { n: data.sales.bills })} · {t('{n} saved customers', { n: data.customers.served })} · {t('{n} new', { n: data.customers.new })}
                  </p>
                </div>
                <div className="grid grid-cols-2 divide-x divide-y divide-line">
                  <Cell label={t('Services')} value={rs(data.sales.services)} />
                  <Cell label={t('Products')} value={rs(data.sales.products)} />
                  <Cell label={t('Cash received')} value={rs(data.money.cashIn)} />
                  <Cell label={t('UPI / card received')} value={rs(data.money.onlineIn)} />
                  <Cell label={t('Udhaar given')} value={rs(data.sales.due)} due />
                  <Cell label={t('Discounts given')} value={rs(data.sales.discount)} />
                </div>
              </Card>

              <Section title={t('Profit (estimate)')}>
                <Card className="p-5">
                  <div className="space-y-2 text-[17px]">
                    <Line label={t('Sale')} value={rs(data.sales.total - data.sales.tax)} />
                    {data.sales.tax > 0 && <Line label={t('GST collected (not yours)')} value={rs(data.sales.tax)} muted />}
                    <Line label={t('− Expenses')} value={rs(data.expenses.total)} />
                    {has('commission') && <Line label={t('− Staff commission')} value={rs(data.staffCost.commission)} />}
                    {data.productCost > 0 && <Line label={t('− Product cost')} value={rs(data.productCost)} />}
                  </div>
                  <div className={`mt-3 flex items-end justify-between rounded-2xl p-3 ${data.profit >= 0 ? 'bg-money-soft text-money' : 'bg-due-soft text-due'}`}>
                    <span className="font-bold">{data.profit >= 0 ? t('Profit') : t('Loss')}</span>
                    <span className="text-3xl font-extrabold tabular-nums">{rs(Math.abs(data.profit))}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted">{t('Fixed salaries count when you add them as an expense or pay them.')}</p>
                </Card>
              </Section>

              {data.byStaff.length > 0 && (
                <Section title={t('Barber-wise')}>
                  <div className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
                    {data.byStaff.map((s) => (
                      <div key={s.id} className="flex items-center gap-3 p-4">
                        <Avatar name={s.name} color={s.color} size={40} />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold">{s.name}</p>
                          <p className="text-sm text-muted">
                            {t('{n} bills', { n: s.bills })} · {t('{n} services', { n: s.services })}
                            {has('commission') && ` · ${t('earned {amount}', { amount: rs(s.commission) })}`}
                          </p>
                        </div>
                        <span className="font-extrabold tabular-nums">{rs(s.sales)}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {data.daily.length > 1 && (
                <Section title={t('Day by day')}>
                  <Card className="p-4">
                    <div className="flex h-36 items-end gap-1" role="img" aria-label={t('Sales per day')}>
                      {data.daily.map((d) => (
                        <div key={d.day} className="flex-1 rounded-t-md bg-brand" style={{ height: `${Math.max(4, (d.total / maxDay) * 100)}%` }} title={`${dayLabel(d.day)}: ${rs(d.total)}`} />
                      ))}
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-muted">
                      <span>{dayLabel(data.daily[0].day)}</span>
                      <span>{dayLabel(data.daily[data.daily.length - 1].day)}</span>
                    </div>
                  </Card>
                </Section>
              )}

              {data.byService.length > 0 && (
                <Section title={t('Top services')}>
                  <div className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
                    {data.byService.slice(0, 12).map((s) => (
                      <div key={`${s.kind}-${s.name}`} className="flex items-center justify-between p-4">
                        <span className="font-semibold">
                          {s.name} <span className="text-muted">× {s.qty}</span>
                        </span>
                        <span className="font-bold tabular-nums">{rs(s.sales)}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {data.expenses.byCategory.length > 0 && (
                <Section title={t('Expenses')}>
                  <div className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
                    {data.expenses.byCategory.map((e) => (
                      <div key={e.category} className="flex items-center justify-between p-4">
                        <span className="font-semibold">{e.category}</span>
                        <span className="font-bold tabular-nums">{rs(e.amount)}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              <div className="mt-6">
                {has('export') ? (
                  <Button block variant="secondary" size="lg" icon="download" onClick={exportCsv}>
                    {t('Download bills (Excel/CSV)')}
                  </Button>
                ) : (
                  <p className="text-center text-sm text-muted">{t('Excel download is in Pro.')}</p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </Screen>
  );
}

function Cell({ label, value, due }: { label: string; value: string; due?: boolean }) {
  return (
    <div className="p-4">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className={`text-lg font-extrabold tabular-nums ${due ? 'text-due' : ''}`}>{value}</p>
    </div>
  );
}

function Line({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? 'text-sm text-muted' : ''}`}>
      <span className={muted ? '' : 'text-muted'}>{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
