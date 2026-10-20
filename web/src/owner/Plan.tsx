import { useState } from 'react';
import { I } from '../components/icons';
import { Badge, Button, Card, Chips, ErrorBox, Input, Loading, Notice, Screen, Section, Sheet, cx, useUi } from '../components/ui';
import { api, message } from '../lib/api';
import { date, dateTime, rs } from '../lib/format';
import { t } from '../lib/i18n';
import { useSession } from '../lib/session';
import type { Plan as PlanT } from '../lib/types';
import { qrSvg, upiLink } from '../lib/upi';
import { useApi } from '../lib/useApi';

interface SubData {
  plans: PlanT[];
  current: { planId: string; expiresAt: number | null; trial: boolean };
  staffCount: number;
  pay: { vpa: string; name: string; reference: string };
  payments: { id: string; planId: string; period: 'month' | 'year'; amount: number; utr: string; status: 'pending' | 'approved' | 'rejected'; note: string | null; createdAt: number }[];
}

/** Choose a plan, pay SnipMemory by UPI, enter the UTR — we confirm within a few hours. */
export default function Plan() {
  const { isOwner, refresh } = useSession();
  const { toast } = useUi();
  const { data, error, reload } = useApi<SubData>(isOwner ? '/api/shop/subscription' : null);
  const [period, setPeriod] = useState<'month' | 'year'>('year');
  const [paying, setPaying] = useState<PlanT | null>(null);
  const [utr, setUtr] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isOwner) return <Screen title={t('Plan')} back="/owner/more"><Notice tone="warn" icon="lock" title={t('Only the owner can manage the plan.')} /></Screen>;
  if (error) return <Screen title={t('Plan')} back="/owner/more"><ErrorBox error={error} retry={reload} /></Screen>;
  if (!data) return <Loading />;
  const current = data.plans.find((p) => p.id === data.current.planId);
  const amount = paying ? (period === 'year' ? paying.priceYear : paying.priceMonth) : 0;
  const link = paying ? upiLink({ vpa: data.pay.vpa, name: data.pay.name, amount, note: `SnipMemory ${paying.name} ${data.pay.reference}`, ref: data.pay.reference }) : '';
  const pending = data.payments.filter((p) => p.status === 'pending');

  return (
    <Screen title={t('Plan & payment')} back="/owner/more">
      <Card className="p-5">
        <p className="font-semibold text-muted">{t('Your plan')}</p>
        <p className="text-2xl font-extrabold">
          {current?.name} {data.current.trial && <Badge tone="brand">{t('Trial')}</Badge>}
        </p>
        <p className="text-muted">
          {data.current.expiresAt ? t('Valid till {date}', { date: date(data.current.expiresAt) }) : t('Free forever')} · {t('{n} people in shop', { n: data.staffCount })}
        </p>
      </Card>

      {pending.length > 0 && (
        <div className="mt-4">
          <Notice tone="warn" icon="clock" title={t('Payment being checked')}>
            {t('We are confirming your UTR {utr}. Usually within a few hours.', { utr: pending[0].utr })}
          </Notice>
        </div>
      )}

      <Section title={t('Choose a plan')}>
        <Chips value={period} onChange={setPeriod} options={[{ value: 'year', label: t('Yearly — 2 months free') }, { value: 'month', label: t('Monthly') }]} />
        <div className="mt-4 space-y-3">
          {data.plans.map((p) => {
            const price = period === 'year' ? p.priceYear : p.priceMonth;
            const isCurrent = p.id === data.current.planId && !data.current.trial;
            const tooSmall = p.maxStaff >= 0 && data.staffCount > p.maxStaff;
            return (
              <Card key={p.id} className={cx('p-5', p.id === 'pro' && 'border-2 border-brand')}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xl font-extrabold">
                      {p.name} {p.id === 'pro' && <Badge tone="brand">{t('Most shops')}</Badge>}
                    </p>
                    <p className="text-muted">{p.tagline}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-extrabold">{price ? rs(price) : t('Free')}</p>
                    {price > 0 && <p className="text-sm text-muted">{period === 'year' ? t('per year · {m}/month', { m: rs(Math.round(price / 12)) }) : t('per month')}</p>}
                  </div>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2 text-[15px]">
                      <I.check size={18} className="mt-0.5 shrink-0 text-money" /> {f}
                    </li>
                  ))}
                </ul>
                {p.id !== 'free' && (
                  <Button className="mt-4" block variant={p.id === 'pro' ? 'brand' : 'secondary'} disabled={tooSmall} onClick={() => { setPaying(p); setUtr(''); }}>
                    {tooSmall ? t('You have more staff than this plan allows') : isCurrent ? t('Renew {plan}', { plan: p.name }) : t('Choose {plan}', { plan: p.name })}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      </Section>

      {data.payments.length > 0 && (
        <Section title={t('Payments')}>
          <div className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
            {data.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold">
                    {data.plans.find((x) => x.id === p.planId)?.name} · {p.period === 'year' ? t('1 year') : t('1 month')}
                  </p>
                  <p className="text-sm text-muted">
                    {dateTime(p.createdAt)} · UTR {p.utr}
                  </p>
                  {p.note && <p className="text-sm text-muted">{p.note}</p>}
                </div>
                <div className="text-right">
                  <p className="font-bold">{rs(p.amount)}</p>
                  <Badge tone={p.status === 'approved' ? 'money' : p.status === 'pending' ? 'warn' : 'danger'}>
                    {p.status === 'approved' ? t('Active') : p.status === 'pending' ? t('Checking') : t('Not received')}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Sheet open={Boolean(paying)} onClose={() => setPaying(null)} title={t('Pay for {plan}', { plan: paying?.name ?? '' })}>
        {paying && (
          <div className="space-y-4 pb-2">
            <div className="text-center">
              <p className="text-5xl font-extrabold">{rs(amount)}</p>
              <p className="text-muted">{period === 'year' ? t('for 1 year') : t('for 1 month')}</p>
              <div className="mx-auto mt-4 w-full max-w-[260px] rounded-3xl bg-white p-3 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg(link) }} />
              <p className="mt-2 font-semibold">{data.pay.name}</p>
              <p className="text-muted">{data.pay.vpa}</p>
              <a href={link} className="mt-3 inline-flex h-12 items-center gap-2 rounded-2xl bg-brand px-5 font-bold text-brand-ink sm:hidden">
                <I.upi /> {t('Open UPI app on this phone')}
              </a>
            </div>
            <Notice tone="brand" icon="help">{t('After paying, open the payment in your UPI app and copy the UTR / UPI Ref No (12 digits).')}</Notice>
            <Input label={t('UTR / UPI reference number')} inputMode="numeric" value={utr} onChange={(e) => setUtr(e.target.value.replace(/\s/g, ''))} placeholder="412345678901" />
            <Button
              block
              size="lg"
              loading={busy}
              disabled={utr.length < 10}
              onClick={async () => {
                setBusy(true);
                try {
                  await api.post('/api/shop/subscription', { planId: paying.id, period, utr });
                  toast(t('Thank you! We will confirm soon.'));
                  setPaying(null);
                  await Promise.all([reload(), refresh()]);
                } catch (err) {
                  toast(message(err), 'error');
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t('I have paid — submit')}
            </Button>
          </div>
        )}
      </Sheet>
    </Screen>
  );
}
