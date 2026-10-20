import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { I } from '../components/icons';
import { Button, Chips, Empty, ErrorBox, Input, Loading, MoneyInput, Screen, Sheet, cx, useUi } from '../components/ui';
import { api, message } from '../lib/api';
import { useCatalog } from '../lib/catalog';
import { dayKey, dayLabel, monthLabel, rs } from '../lib/format';
import { t } from '../lib/i18n';
import { useSession } from '../lib/session';
import type { Mode } from '../lib/types';
import { useApi } from '../lib/useApi';
import { shiftMonth } from './StaffDetail';

interface Expense {
  id: string;
  category: string;
  amount: number;
  mode: Mode;
  note: string | null;
  day: string;
}

export default function Expenses() {
  const { me } = useSession();
  const { catalog } = useCatalog(me.shop.id);
  const { ask, toast } = useUi();
  const [params, setParams] = useSearchParams();
  const [month, setMonth] = useState(dayKey().slice(0, 7));
  const from = `${month}-01`;
  const to = shiftMonth(month, 1) + '-01' > dayKey() ? dayKey() : `${month}-31`;
  const { data, error, reload } = useApi<{ total: number; expenses: Expense[] }>(`/api/shop/expenses?from=${from}&to=${to}`);
  const adding = params.get('add') === '1';

  const byCat = new Map<string, number>();
  for (const e of data?.expenses ?? []) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);

  return (
    <Screen title={t('Expenses')} back="/owner/more" right={<Button size="sm" icon="plus" onClick={() => setParams({ add: '1' })}>{t('Add')}</Button>}>
      <div className="flex items-center gap-2">
        <button onClick={() => setMonth(shiftMonth(month, -1))} className="grid size-12 place-items-center rounded-2xl border-2 border-line bg-surface" aria-label={t('Previous month')}>
          <I.back />
        </button>
        <p className="flex-1 text-center text-lg font-bold">{monthLabel(month)}</p>
        <button onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= dayKey().slice(0, 7)} className="grid size-12 place-items-center rounded-2xl border-2 border-line bg-surface disabled:opacity-30" aria-label={t('Next month')}>
          <I.right />
        </button>
      </div>
      <ErrorBox error={error} retry={reload} />
      {!data ? (
        <Loading />
      ) : (
        <>
          <div className="mt-4 rounded-3xl bg-due-soft p-5 text-due">
            <p className="font-semibold">{t('Total spent')}</p>
            <p className="text-4xl font-extrabold tabular-nums">{rs(data.total)}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
              {[...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([c, v]) => (
                <span key={c}>
                  {c}: {rs(v)}
                </span>
              ))}
            </div>
          </div>
          {data.expenses.length === 0 ? (
            <Empty icon="wallet2" title={t('No expenses this month')}>{t('Add rent, electricity, tea, products… to see your real profit.')}</Empty>
          ) : (
            <div className="mt-4 divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
              {data.expenses.map((e) => (
                <div key={e.id} className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{e.category}</p>
                    <p className="truncate text-sm text-muted">
                      {dayLabel(e.day)} · {e.mode.toUpperCase()}
                      {e.note ? ` · ${e.note}` : ''}
                    </p>
                  </div>
                  <span className="font-extrabold tabular-nums">{rs(e.amount)}</span>
                  <button
                    className="grid size-10 place-items-center rounded-full text-muted active:bg-surface-2"
                    aria-label={t('Delete')}
                    onClick={async () => {
                      if (!(await ask({ title: t('Delete this expense?'), confirm: t('Delete'), danger: true }))) return;
                      try {
                        await api.del(`/api/shop/expenses/${e.id}`);
                        void reload();
                      } catch (err) {
                        toast(message(err), 'error');
                      }
                    }}
                  >
                    <I.trash size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <AddExpense
        open={adding}
        categories={catalog?.expenseCategories ?? ['Rent', 'Electricity', 'Tea & snacks', 'Other']}
        onClose={() => setParams({})}
        onDone={() => {
          setParams({});
          void reload();
        }}
      />
    </Screen>
  );
}

function AddExpense({ open, categories, onClose, onDone }: { open: boolean; categories: string[]; onClose: () => void; onDone: () => void }) {
  const { toast } = useUi();
  const [category, setCategory] = useState(categories[0]);
  const [amount, setAmount] = useState(0);
  const [mode, setMode] = useState<Mode>('cash');
  const [note, setNote] = useState('');
  const [day, setDay] = useState(dayKey());
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setAmount(0);
      setNote('');
      setDay(dayKey());
    }
  }, [open]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/api/shop/expenses', { category, amount, mode, note: note || null, day });
      toast(t('Expense saved'));
      onDone();
    } catch (err) {
      toast(message(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title={t('Add expense')}>
      <form onSubmit={submit} className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button key={c} type="button" onClick={() => setCategory(c)} className={cx('h-11 rounded-full border-2 px-4 font-bold', category === c ? 'border-brand bg-brand-soft text-brand-text' : 'border-line bg-surface')}>
              {t(c)}
            </button>
          ))}
        </div>
        <MoneyInput label={t('Amount')} value={amount} onChange={setAmount} autoFocus />
        <Chips value={mode} onChange={setMode} options={[{ value: 'cash', label: t('Cash (from galla)') }, { value: 'upi', label: 'UPI' }, { value: 'card', label: t('Card') }]} />
        <Input label={t('Note (optional)')} value={note} onChange={(e) => setNote(e.target.value)} />
        <Input label={t('Date')} type="date" value={day} max={dayKey()} onChange={(e) => setDay(e.target.value)} />
        <Button type="submit" size="lg" block loading={busy} disabled={amount < 100}>
          {t('Save expense')}
        </Button>
      </form>
    </Sheet>
  );
}
