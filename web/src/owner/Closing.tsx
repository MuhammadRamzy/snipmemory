import { useState } from 'react';
import { useNavigate } from 'react-router';
import { I } from '../components/icons';
import { Button, Card, ErrorBox, Input, Loading, MoneyInput, Notice, Screen, Section, useUi } from '../components/ui';
import { api, message } from '../lib/api';
import { dayKey, dayLabel, rs, shiftDay, time } from '../lib/format';
import { t } from '../lib/i18n';
import { useSession } from '../lib/session';
import { useApi } from '../lib/useApi';

interface ClosingData {
  day: string;
  opening: number;
  cashSales: number;
  cashCollected: number;
  cashExpenses: number;
  cashToStaff: number;
  expected: number;
  closed: { counted: number; expected: number; note: string | null; at: number } | null;
  history: { day: string; expected: number; counted: number; difference: number }[];
}

/** End of day: how much cash should be in the galla vs what is actually there. */
export default function Closing() {
  const { has } = useSession();
  const { toast } = useUi();
  const navigate = useNavigate();
  const [day, setDay] = useState(dayKey());
  const { data, error, reload } = useApi<ClosingData>(has('closing') ? `/api/shop/closing?day=${day}` : null);
  const [counted, setCounted] = useState(0);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  if (!has('closing')) {
    return (
      <Screen title={t('Cash closing')} back="/owner/more">
        <Notice tone="brand" icon="cash" title={t('Cash closing is in Starter and above')} action={<Button size="sm" onClick={() => navigate('/owner/plan')}>{t('See plans')}</Button>}>
          {t('Know every evening if the cash in your galla matches your bills.')}
        </Notice>
      </Screen>
    );
  }

  const diff = counted - (data?.expected ?? 0);
  return (
    <Screen title={t('Cash closing')} back="/owner/more">
      <div className="flex items-center gap-2">
        <button onClick={() => setDay(shiftDay(day, -1))} className="grid size-12 place-items-center rounded-2xl border-2 border-line bg-surface" aria-label={t('Previous day')}>
          <I.back />
        </button>
        <p className="flex-1 text-center text-lg font-bold">{dayLabel(day)}</p>
        <button onClick={() => setDay(shiftDay(day, 1))} disabled={day >= dayKey()} className="grid size-12 place-items-center rounded-2xl border-2 border-line bg-surface disabled:opacity-30" aria-label={t('Next day')}>
          <I.right />
        </button>
      </div>
      <ErrorBox error={error} retry={reload} />
      {!data ? (
        <Loading />
      ) : (
        <>
          <Card className="mt-4 p-5">
            <div className="space-y-2 text-[17px]">
              <Line label={t('Opening cash')} value={rs(data.opening)} />
              <Line label={t('+ Cash bills')} value={rs(data.cashSales)} />
              <Line label={t('+ Udhaar / advance received in cash')} value={rs(data.cashCollected)} />
              <Line label={t('− Expenses paid in cash')} value={rs(data.cashExpenses)} />
              <Line label={t('− Cash given to staff')} value={rs(data.cashToStaff)} />
            </div>
            <div className="mt-3 flex items-end justify-between border-t border-line pt-3">
              <span className="text-lg font-bold">{t('Cash that should be in galla')}</span>
              <span className="text-3xl font-extrabold tabular-nums">{rs(data.expected)}</span>
            </div>
          </Card>

          {data.closed ? (
            <div className="mt-4">
              <Notice tone={data.closed.counted === data.closed.expected ? 'money' : 'due'} icon="check" title={t('Closed at {time}', { time: time(data.closed.at) })}>
                {t('Counted {counted}. Difference {diff}.', { counted: rs(data.closed.counted), diff: rs(data.closed.counted - data.closed.expected) })}
              </Notice>
            </div>
          ) : null}

          <Section title={data.closed ? t('Count again') : t('Count the cash now')}>
            <div className="space-y-4">
              <MoneyInput label={t('Cash counted in galla')} value={counted} onChange={setCounted} />
              {counted > 0 && (
                <div className={`rounded-3xl p-4 text-center ${diff === 0 ? 'bg-money-soft text-money' : diff > 0 ? 'bg-brand-soft text-brand-text' : 'bg-due-soft text-due'}`}>
                  <p className="font-bold">{diff === 0 ? t('Perfect match ✓') : diff > 0 ? t('{amount} extra', { amount: rs(diff) }) : t('{amount} short', { amount: rs(-diff) })}</p>
                </div>
              )}
              <Input label={t('Note (optional)')} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('e.g. gave ₹500 change to neighbour')} />
              <Button
                size="lg"
                block
                loading={busy}
                disabled={!counted && counted !== 0}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api.post('/api/shop/closing', { day, countedCash: counted, note: note || null });
                    toast(t('Day closed'));
                    void reload();
                  } catch (err) {
                    toast(message(err), 'error');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t('Close the day')}
              </Button>
            </div>
          </Section>

          {data.history.length > 0 && (
            <Section title={t('Last days')}>
              <div className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
                {data.history.map((h) => (
                  <div key={h.day} className="flex items-center justify-between p-4">
                    <span className="font-semibold">{dayLabel(h.day)}</span>
                    <span className={`font-bold tabular-nums ${h.difference === 0 ? 'text-money' : 'text-due'}`}>
                      {h.difference === 0 ? t('Matched') : `${h.difference > 0 ? '+' : ''}${rs(h.difference)}`}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </Screen>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
