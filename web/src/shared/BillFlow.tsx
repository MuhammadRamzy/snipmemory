import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { computeBill } from '../../../shared/billing';
import { I } from '../components/icons';
import { Avatar, Button, Card, Chips, Input, MoneyInput, Notice, Screen, Sheet, Toggle, cx, useUi } from '../components/ui';
import { ApiError, api, isOffline, message } from '../lib/api';
import { useCatalog } from '../lib/catalog';
import { rs } from '../lib/format';
import { t } from '../lib/i18n';
import { newClientRef, queueBill } from '../lib/outbox';
import { useSession } from '../lib/session';
import type { Bill, Customer, Mode } from '../lib/types';
import { qrPng, qrSvg, upiLink } from '../lib/upi';
import { BillDone } from './BillDone';

interface Line {
  key: string;
  kind: 'service' | 'product' | 'custom';
  refId: string | null;
  name: string;
  qty: number;
  unitPrice: number;
  staffId: string | null;
}

type Step = 'items' | 'checkout' | 'upi' | 'cash' | 'split' | 'card';

export interface SavedBill {
  bill: Bill | null; // null when saved offline
  clientRef: string;
  total: number;
  paid: { cash: number; upi: number; card: number; advance: number };
  due: number;
  lines: Line[];
  customerName: string | null;
  customerPhone: string | null;
  customerId: string | null;
}

/** The whole POS: pick services → customer & discount → take payment (UPI QR / cash / card / udhaar) → done. */
export function BillFlow({ app }: { app: 'owner' | 'staff' }) {
  const { me, has } = useSession();
  const { catalog, reload: reloadCatalog } = useCatalog(me.shop.id);
  const { toast } = useUi();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const home = `/${app}`;

  const [step, setStep] = useState<Step>('items');
  const [lines, setLines] = useState<Line[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [cartOpen, setCartOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);

  const [phone, setPhone] = useState(params.get('phone')?.replace(/^\+91/, '') ?? '');
  const [name, setName] = useState(params.get('name') ?? '');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [staffId, setStaffId] = useState(me.me.id);
  const [discountMode, setDiscountMode] = useState<'none' | '5' | '10' | '20' | 'amount'>('none');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [collectDue, setCollectDue] = useState(false);
  const [useAdvance, setUseAdvance] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedBill | null>(null);
  const clientRef = useRef(newClientRef());
  const queueId = params.get('queue');

  // Customer lookup as soon as 10 digits are typed.
  const digits = phone.replace(/\D/g, '').slice(-10);
  useEffect(() => {
    setCustomer(null);
    setCollectDue(false);
    setUseAdvance(false);
    if (digits.length !== 10) return;
    let cancelled = false;
    setLookingUp(true);
    api
      .get<{ customer: Customer | null }>(`/api/shop/customers/lookup?phone=${digits}`)
      .then((r) => {
        if (cancelled) return;
        setCustomer(r.customer);
        if (r.customer && !name) setName(r.customer.name === 'Customer' ? '' : r.customer.name);
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setLookingUp(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits]);

  const services = catalog?.services.filter((s) => s.active) ?? [];
  const products = catalog?.products.filter((p) => p.active) ?? [];
  const team = catalog?.staff ?? [];
  const categories = ['All', ...new Set(services.map((s) => s.category))];
  const q = search.trim().toLowerCase();
  const shown = services.filter((s) => (category === 'All' || s.category === category) && (!q || s.name.toLowerCase().includes(q)));
  const shownProducts = products.filter((p) => !q || p.name.toLowerCase().includes(q));

  const add = (item: Omit<Line, 'key' | 'qty' | 'staffId'>) => {
    setLines((cur) => {
      const found = item.refId ? cur.find((l) => l.refId === item.refId) : undefined;
      if (found) return cur.map((l) => (l === found ? { ...l, qty: Math.min(99, l.qty + 1) } : l));
      return [...cur, { ...item, key: newClientRef(), qty: 1, staffId: null }];
    });
    if (navigator.vibrate) navigator.vibrate(15);
  };
  const qtyOf = (refId: string) => lines.find((l) => l.refId === refId)?.qty ?? 0;

  const shop = me.shop;
  const subtotal = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const pct = discountMode === 'none' || discountMode === 'amount' ? 0 : Number(discountMode);
  const discount = Math.min(subtotal, discountMode === 'amount' ? discountAmount : Math.round((subtotal * pct) / 100));
  const totals = useMemo(
    () =>
      computeBill(
        lines.map((l) => ({ ...l, staffId: l.staffId ?? staffId })),
        discount,
        { enabled: shop.gstEnabled, rate: shop.gstRate, inclusive: shop.gstInclusive },
        () => ({ service: 0, product: 0 }),
      ),
    [lines, discount, shop.gstEnabled, shop.gstRate, shop.gstInclusive, staffId],
  );
  const total = totals.total;
  const balance = customer?.balance ?? 0;
  const oldDue = collectDue && balance < 0 ? -balance : 0;
  const advanceUsed = useAdvance && balance > 0 ? Math.min(balance, total) : 0;
  const toCollect = total - advanceUsed + oldDue;
  const maxStaffDiscount = app === 'staff' ? (shop.staffCanDiscount ? shop.staffMaxDiscount : 0) : 100;
  const discountTooHigh = subtotal > 0 && discount * 100 > subtotal * maxStaffDiscount;
  const hasCustomer = digits.length === 10;

  const save = async (pay: { cash?: number; upi?: number; card?: number }) => {
    setError(null);
    const p = { cash: pay.cash ?? 0, upi: pay.upi ?? 0, card: pay.card ?? 0 };
    // Money received first clears old udhaar, the rest goes to today's bill.
    const received = p.cash + p.upi + p.card;
    const dueCleared = Math.min(oldDue, received);
    const forBill = { ...p };
    let take = dueCleared;
    for (const k of ['cash', 'upi', 'card'] as const) {
      const cut = Math.min(forBill[k], take);
      forBill[k] -= cut;
      take -= cut;
    }
    const dueMode: Mode = p.upi >= p.cash && p.upi >= p.card ? 'upi' : p.cash >= p.card ? 'cash' : 'card';
    const due = total - advanceUsed - (forBill.cash + forBill.upi + forBill.card);
    if (due > 0 && !hasCustomer) {
      setError(t('Add the customer’s mobile number to keep udhaar.'));
      setStep('checkout');
      return;
    }
    const payload = {
      clientRef: clientRef.current,
      customerId: customer?.id ?? null,
      customerPhone: hasCustomer ? digits : null,
      customerName: name.trim() || null,
      staffId: app === 'owner' ? staffId : null,
      items: lines.map((l) => ({ kind: l.kind, refId: l.refId, name: l.name, qty: l.qty, unitPrice: l.unitPrice, staffId: app === 'owner' ? (l.staffId ?? staffId) : null })),
      discount,
      payments: { ...forBill, advance: advanceUsed },
      collectDue: dueCleared > 0 ? { amount: dueCleared, mode: dueMode } : null,
      queueId,
      createdAt: Date.now(),
    };
    const summary = {
      clientRef: clientRef.current,
      total,
      paid: { ...forBill, advance: advanceUsed },
      due,
      lines,
      customerName: name.trim() || customer?.name || null,
      customerPhone: hasCustomer ? `+91${digits}` : null,
      customerId: customer?.id ?? null,
    };
    setSaving(true);
    try {
      const res = await api.post<{ bill: Bill }>('/api/shop/bills', payload);
      setSaved({ ...summary, bill: res.bill, customerId: res.bill.customerId });
    } catch (err) {
      if (isOffline(err)) {
        queueBill({ clientRef: clientRef.current, shopId: shop.id, app, payload, total, customerName: summary.customerName, createdAt: Date.now() });
        setSaved({ ...summary, bill: null });
      } else {
        setError(message(err));
        if (err instanceof ApiError && err.status === 400 && /price list|removed/.test(err.message)) void reloadCatalog();
      }
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    clientRef.current = newClientRef();
    setLines([]);
    setPhone('');
    setName('');
    setCustomer(null);
    setDiscountMode('none');
    setDiscountAmount(0);
    setCollectDue(false);
    setUseAdvance(false);
    setSaved(null);
    setError(null);
    setStep('items');
    setStaffId(me.me.id);
    if (queueId) navigate(`${home}/bill`, { replace: true });
  };

  if (saved) return <BillDone app={app} saved={saved} onNew={reset} />;

  // -------------------------------------------------------------------------
  // Step 1: choose services
  // -------------------------------------------------------------------------
  if (step === 'items') {
    return (
      <Screen title={t('New bill')} back={home}>
        {!catalog ? (
          <Notice tone="warn" icon="offline" title={t('Price list not loaded')}>{t('Connect to the internet once to load your services.')}</Notice>
        ) : (
          <>
            <div className="sticky top-[60px] z-10 -mx-4 bg-bg px-4 pb-3">
              <span className="flex h-12 items-center gap-2 rounded-2xl border-2 border-line bg-surface px-3">
                <I.search className="text-muted" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Search service')} className="h-full min-w-0 flex-1 bg-transparent outline-none" />
                {search && (
                  <button onClick={() => setSearch('')} aria-label="Clear">
                    <I.x className="text-muted" />
                  </button>
                )}
              </span>
              {categories.length > 2 && !q && (
                <div className="mt-3">
                  <Chips scroll value={category} onChange={setCategory} options={categories.map((c) => ({ value: c, label: c === 'All' ? t('All') : c }))} />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {shown.map((s) => {
                const n = qtyOf(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => add({ kind: 'service', refId: s.id, name: s.name, unitPrice: s.price })}
                    className={cx(
                      'relative flex min-h-24 flex-col justify-between rounded-3xl border-2 p-3.5 text-left transition active:scale-[0.97]',
                      n ? 'border-brand bg-brand-soft' : 'border-line bg-surface',
                    )}
                  >
                    <span className="pr-6 text-[17px] font-bold leading-tight">{s.name}</span>
                    <span className="mt-2 text-lg font-extrabold text-brand-text">{rs(s.price)}</span>
                    {n > 0 && <span className="pop absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-brand text-base font-extrabold text-brand-ink">{n}</span>}
                  </button>
                );
              })}
              <button onClick={() => setCustomOpen(true)} className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-3xl border-2 border-dashed border-line p-3 font-bold text-muted active:scale-[0.97]">
                <I.plus size={26} />
                {t('Other / custom')}
              </button>
            </div>

            {shownProducts.length > 0 && (
              <>
                <h2 className="mb-2 mt-6 px-1 text-[15px] font-bold uppercase tracking-wide text-muted">{t('Products')}</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {shownProducts.map((p) => {
                    const n = qtyOf(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => add({ kind: 'product', refId: p.id, name: p.name, unitPrice: p.price })}
                        className={cx('relative flex min-h-20 flex-col justify-between rounded-3xl border-2 p-3.5 text-left active:scale-[0.97]', n ? 'border-brand bg-brand-soft' : 'border-line bg-surface')}
                      >
                        <span className="pr-6 font-bold leading-tight">{p.name}</span>
                        <span className="mt-1 flex items-center justify-between">
                          <span className="font-extrabold text-brand-text">{rs(p.price)}</span>
                          {has('inventory') && <span className={cx('text-xs font-semibold', p.stock <= p.lowStock ? 'text-due' : 'text-muted')}>{t('{n} left', { n: p.stock })}</span>}
                        </span>
                        {n > 0 && <span className="pop absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-brand font-extrabold text-brand-ink">{n}</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* sticky cart bar */}
        <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface px-4 pt-3">
          <div className="mx-auto flex max-w-xl items-center gap-3">
            <button onClick={() => lines.length && setCartOpen(true)} className="min-w-0 flex-1 text-left" disabled={!lines.length}>
              <span className="block text-sm font-semibold text-muted">
                {lines.length ? t('{n} items · tap to change', { n: lines.reduce((s, l) => s + l.qty, 0) }) : t('Tap services to add')}
              </span>
              <span className="block text-2xl font-extrabold tabular-nums">{rs(subtotal)}</span>
            </button>
            <Button size="lg" disabled={!lines.length} onClick={() => setStep('checkout')}>
              {t('Next')} <I.right />
            </Button>
          </div>
        </div>

        <Sheet open={cartOpen} onClose={() => setCartOpen(false)} title={t('Bill items')}>
          <CartEditor lines={lines} setLines={setLines} team={app === 'owner' ? team : []} mainStaff={staffId} />
          <Button block size="lg" className="mt-4" onClick={() => setCartOpen(false)}>
            {t('Done')}
          </Button>
        </Sheet>
        <CustomItemSheet
          open={customOpen}
          onClose={() => setCustomOpen(false)}
          onAdd={(n, price) => {
            add({ kind: 'custom', refId: null, name: n, unitPrice: price });
            setCustomOpen(false);
          }}
        />
      </Screen>
    );
  }

  // -------------------------------------------------------------------------
  // Step 2: customer, stylist, discount → choose how they pay
  // -------------------------------------------------------------------------
  if (step === 'checkout') {
    return (
      <Screen title={t('Customer & payment')} back={undefined} right={<Button variant="ghost" size="sm" onClick={() => setStep('items')} icon="edit">{t('Items')}</Button>}>
        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <Input
              label={t('Customer mobile (optional)')}
              prefix="+91"
              type="tel"
              inputMode="numeric"
              maxLength={14}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="98765 43210"
              hint={lookingUp ? t('Searching…') : digits.length === 10 && !customer ? t('New customer — will be saved') : t('Needed for udhaar and WhatsApp bill')}
            />
            {customer && (
              <p className="flex items-center gap-2 font-semibold text-money">
                <I.check size={20} /> {customer.name} · {t('{n} visits', { n: customer.visitCount })}
              </p>
            )}
            <Input label={t('Name (optional)')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('Customer name')} autoComplete="off" />
            {balance < 0 && (
              <div className="rounded-2xl bg-due-soft p-3">
                <Toggle checked={collectDue} onChange={setCollectDue} label={<span className="text-due">{t('Old udhaar {amount} — collect now', { amount: rs(-balance) })}</span>} />
              </div>
            )}
            {balance > 0 && (
              <div className="rounded-2xl bg-money-soft p-3">
                <Toggle checked={useAdvance} onChange={setUseAdvance} label={<span className="text-money">{t('Use advance {amount}', { amount: rs(balance) })}</span>} />
              </div>
            )}
          </Card>

          {app === 'owner' && team.length > 1 && (
            <Card className="p-4">
              <p className="mb-2 font-semibold">{t('Who did the service?')}</p>
              <div className="flex flex-wrap gap-2">
                {team.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStaffId(s.id)}
                    className={cx('flex h-12 items-center gap-2 rounded-full border-2 pl-1.5 pr-4 font-bold', staffId === s.id ? 'border-brand bg-brand-soft' : 'border-line bg-surface')}
                  >
                    <Avatar name={s.name} color={s.color} size={34} />
                    {s.name}
                  </button>
                ))}
              </div>
            </Card>
          )}

          {maxStaffDiscount > 0 && (
            <Card className="space-y-3 p-4">
              <p className="font-semibold">{t('Discount')}</p>
              <Chips
                value={discountMode}
                onChange={setDiscountMode}
                options={[
                  { value: 'none', label: t('None') },
                  ...(['5', '10', '20'] as const).filter((p) => Number(p) <= maxStaffDiscount).map((p) => ({ value: p, label: `${p}%` })),
                  { value: 'amount', label: t('₹ Amount') },
                ]}
              />
              {discountMode === 'amount' && <MoneyInput value={discountAmount} onChange={setDiscountAmount} autoFocus />}
              {discountTooHigh && <p className="text-sm font-semibold text-danger">{t('You can give up to {n}% discount.', { n: maxStaffDiscount })}</p>}
            </Card>
          )}

          <Card className="p-4">
            <div className="space-y-1.5 text-[17px]">
              <SumRow label={t('Services & items')} value={rs(totals.subtotal)} />
              {totals.discount > 0 && <SumRow label={t('Discount')} value={`− ${rs(totals.discount)}`} />}
              {totals.tax > 0 && <SumRow label={shop.gstInclusive ? t('GST included ({n}%)', { n: shop.gstRate }) : t('GST {n}%', { n: shop.gstRate })} value={rs(totals.tax)} />}
              {advanceUsed > 0 && <SumRow label={t('From advance')} value={`− ${rs(advanceUsed)}`} />}
              {oldDue > 0 && <SumRow label={t('Old udhaar')} value={`+ ${rs(oldDue)}`} />}
            </div>
            <div className="mt-3 flex items-end justify-between border-t border-line pt-3">
              <span className="text-lg font-bold">{t('To collect')}</span>
              <span className="text-4xl font-extrabold tabular-nums">{rs(toCollect)}</span>
            </div>
          </Card>

          {error && <Notice tone="danger" icon="alert" title={error} />}

          {toCollect === 0 ? (
            <Button size="xl" block variant="money" loading={saving} onClick={() => save({})} disabled={discountTooHigh}>
              <I.check /> {t('Save bill')}
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <PayButton icon="qr" label={t('UPI / QR')} tone="brand" onClick={() => setStep('upi')} disabled={discountTooHigh} />
              <PayButton icon="cash" label={t('Cash')} tone="money" onClick={() => setStep('cash')} disabled={discountTooHigh} />
              <PayButton icon="card" label={t('Card')} tone="plain" onClick={() => setStep('card')} disabled={discountTooHigh} />
              <PayButton icon="book" label={t('Part pay / Udhaar')} tone="due" onClick={() => setStep('split')} disabled={discountTooHigh} />
            </div>
          )}
        </div>
      </Screen>
    );
  }

  const backToCheckout = (
    <Button variant="ghost" size="sm" onClick={() => setStep('checkout')} icon="back">
      {t('Back')}
    </Button>
  );

  // -------------------------------------------------------------------------
  // UPI QR
  // -------------------------------------------------------------------------
  if (step === 'upi') {
    return <UpiStep amount={toCollect} saving={saving} error={error} onBack={() => setStep('checkout')} onPaid={() => save({ upi: toCollect })} onCash={() => setStep('cash')} toast={toast} />;
  }

  // -------------------------------------------------------------------------
  // Cash with change
  // -------------------------------------------------------------------------
  if (step === 'cash') {
    return <CashStep amount={toCollect} saving={saving} error={error} hasCustomer={hasCustomer} right={backToCheckout} onSave={(cash) => save({ cash })} />;
  }

  if (step === 'card') {
    return (
      <Screen title={t('Card payment')} right={backToCheckout} noNavPad>
        <Card className="p-6 text-center">
          <p className="text-muted">{t('Charge on your card machine')}</p>
          <p className="mt-1 text-5xl font-extrabold tabular-nums">{rs(toCollect)}</p>
        </Card>
        {error && <div className="mt-4"><Notice tone="danger" icon="alert" title={error} /></div>}
        <Button size="xl" block variant="money" className="mt-6" loading={saving} onClick={() => save({ card: toCollect })}>
          <I.check /> {t('Card payment done')}
        </Button>
      </Screen>
    );
  }

  // split / udhaar
  return <SplitStep amount={toCollect} saving={saving} error={error} hasCustomer={hasCustomer} right={backToCheckout} onSave={save} onAddPhone={() => setStep('checkout')} />;
}

function SumRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function PayButton({ icon, label, tone, onClick, disabled }: { icon: 'qr' | 'cash' | 'card' | 'book'; label: string; tone: 'brand' | 'money' | 'plain' | 'due'; onClick: () => void; disabled?: boolean }) {
  const Icon = I[icon];
  const tones = {
    brand: 'bg-brand text-brand-ink',
    money: 'bg-money text-white',
    plain: 'bg-surface border-2 border-line text-ink',
    due: 'bg-due-soft text-due border-2 border-due/30',
  };
  return (
    <button onClick={onClick} disabled={disabled} className={cx('flex h-28 flex-col items-center justify-center gap-2 rounded-3xl text-lg font-extrabold active:scale-[0.97] disabled:opacity-40', tones[tone])}>
      <Icon size={34} />
      {label}
    </button>
  );
}

function CartEditor({ lines, setLines, team, mainStaff }: { lines: Line[]; setLines: (fn: (l: Line[]) => Line[]) => void; team: { id: string; name: string }[]; mainStaff: string }) {
  const [editing, setEditing] = useState<string | null>(null);
  const update = (key: string, patch: Partial<Line>) => setLines((cur) => cur.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  if (!lines.length) return <p className="py-6 text-center text-muted">{t('No items yet')}</p>;
  return (
    <div className="divide-y divide-line">
      {lines.map((l) => (
        <div key={l.key} className="py-3">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[17px] font-bold">{l.name}</p>
              <button onClick={() => setEditing(editing === l.key ? null : l.key)} className="text-sm font-semibold text-brand-text">
                {rs(l.unitPrice)} {t('each')} · {t('change price')}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => (l.qty <= 1 ? setLines((cur) => cur.filter((x) => x.key !== l.key)) : update(l.key, { qty: l.qty - 1 }))}
                className="grid size-11 place-items-center rounded-full bg-surface-2"
                aria-label={t('Less')}
              >
                {l.qty <= 1 ? <I.trash size={20} className="text-danger" /> : <I.minus />}
              </button>
              <span className="w-7 text-center text-xl font-extrabold">{l.qty}</span>
              <button onClick={() => update(l.key, { qty: Math.min(99, l.qty + 1) })} className="grid size-11 place-items-center rounded-full bg-surface-2" aria-label={t('More')}>
                <I.plus />
              </button>
            </div>
          </div>
          {editing === l.key && (
            <div className="mt-3">
              <MoneyInput label={t('Price for {name}', { name: l.name })} value={l.unitPrice} onChange={(v) => update(l.key, { unitPrice: v })} autoFocus />
            </div>
          )}
          {team.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {team.map((s) => (
                <button
                  key={s.id}
                  onClick={() => update(l.key, { staffId: s.id })}
                  className={cx('rounded-full border px-3 py-1 text-sm font-semibold', (l.staffId ?? mainStaff) === s.id ? 'border-brand bg-brand-soft text-brand-text' : 'border-line text-muted')}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CustomItemSheet({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (name: string, price: number) => void }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState(0);
  return (
    <Sheet open={open} onClose={onClose} title={t('Other item')}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!price) return;
          onAdd(name.trim() || t('Other service'), price);
          setName('');
          setPrice(0);
        }}
      >
        <Input label={t('What is it? (optional)')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('e.g. Special style')} />
        <MoneyInput label={t('Amount')} value={price} onChange={setPrice} />
        <Button type="submit" size="lg" block disabled={!price}>
          {t('Add to bill')}
        </Button>
      </form>
    </Sheet>
  );
}

function UpiStep({
  amount,
  saving,
  error,
  onBack,
  onPaid,
  onCash,
  toast,
}: {
  amount: number;
  saving: boolean;
  error: string | null;
  onBack: () => void;
  onPaid: () => void;
  onCash: () => void;
  toast: (s: string, tone?: 'ok' | 'error') => void;
}) {
  const { me, isOwner, refresh } = useSession();
  const shop = me.shop;
  const [vpa, setVpa] = useState('');
  const [savingVpa, setSavingVpa] = useState(false);
  const link = shop.upiVpa ? upiLink({ vpa: shop.upiVpa, name: shop.upiName || shop.name, amount, note: shop.name }) : '';
  const svg = useMemo(() => (link ? qrSvg(link) : ''), [link]);

  const shareQr = async () => {
    const png = await qrPng(link, `${shop.name} · ${rs(amount)}`);
    const file = new File([png], 'pay-upi.png', { type: 'image/png' });
    const text = t('Pay {amount} to {shop} — scan this QR in any UPI app.', { amount: rs(amount), shop: shop.name });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text }).catch(() => undefined);
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\nUPI ID: ${shop.upiVpa}`)}`, '_blank', 'noopener');
    }
  };

  return (
    <Screen title={t('Scan & pay')} right={<Button variant="ghost" size="sm" onClick={onBack} icon="back">{t('Back')}</Button>} noNavPad>
      {!shop.upiVpa ? (
        isOwner ? (
          <Card className="space-y-4 p-5">
            <Notice tone="warn" icon="qr" title={t('Add your UPI ID once')}>
              {t('Open PhonePe, Google Pay or Paytm → tap your photo → copy the UPI ID (looks like 98xxxxxx@ybl).')}
            </Notice>
            <Input label={t('Your UPI ID')} value={vpa} onChange={(e) => setVpa(e.target.value.trim())} placeholder="name@okaxis" autoCapitalize="none" autoCorrect="off" />
            <Button
              block
              size="lg"
              loading={savingVpa}
              disabled={!vpa.includes('@')}
              onClick={async () => {
                setSavingVpa(true);
                try {
                  await api.patch('/api/shop/settings', { upiVpa: vpa });
                  await refresh();
                  toast(t('UPI ID saved'));
                } catch (err) {
                  toast(message(err), 'error');
                } finally {
                  setSavingVpa(false);
                }
              }}
            >
              {t('Save UPI ID')}
            </Button>
          </Card>
        ) : (
          <Notice tone="warn" icon="qr" title={t('UPI QR not set up')}>{t('Ask the owner to add the shop’s UPI ID in the Owner app. Take cash for now.')}</Notice>
        )
      ) : (
        <div className="text-center">
          <p className="text-lg font-semibold text-muted">{t('Customer scans with any UPI app')}</p>
          <p className="mt-1 text-6xl font-extrabold tabular-nums">{rs(amount)}</p>
          <div className="mx-auto mt-5 w-full max-w-[300px] rounded-3xl bg-white p-3 shadow-sm [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="mt-3 font-bold">{shop.upiName || shop.name}</p>
          <p className="text-muted">{shop.upiVpa}</p>
          <p className="mx-auto mt-4 max-w-xs text-sm text-muted">{t('Check the payment message on your phone or soundbox, then tap below.')}</p>
        </div>
      )}
      {error && <div className="mt-4"><Notice tone="danger" icon="alert" title={error} /></div>}
      <div className="mt-6 space-y-3">
        {shop.upiVpa && (
          <Button size="xl" block variant="money" loading={saving} onClick={onPaid}>
            <I.check /> {t('Money received')}
          </Button>
        )}
        <div className="grid grid-cols-2 gap-3">
          {shop.upiVpa && (
            <Button variant="secondary" size="lg" icon="share" onClick={shareQr}>
              {t('Share QR')}
            </Button>
          )}
          <Button variant="secondary" size="lg" icon="cash" onClick={onCash} className={shop.upiVpa ? '' : 'col-span-2'}>
            {t('Paid cash')}
          </Button>
        </div>
      </div>
    </Screen>
  );
}

function CashStep({ amount, saving, error, hasCustomer, right, onSave }: { amount: number; saving: boolean; error: string | null; hasCustomer: boolean; right: React.ReactNode; onSave: (cash: number) => void }) {
  const [given, setGiven] = useState(0);
  const change = given - amount;
  const quick = [...new Set([amount, Math.ceil(amount / 5000) * 5000, Math.ceil(amount / 10000) * 10000, 20000, 50000, 200000].filter((v) => v >= amount))].slice(0, 4);
  return (
    <Screen title={t('Cash')} right={right} noNavPad>
      <Card className="p-5 text-center">
        <p className="text-muted">{t('Bill amount')}</p>
        <p className="text-5xl font-extrabold tabular-nums">{rs(amount)}</p>
      </Card>
      <div className="mt-5">
        <MoneyInput label={t('Cash received from customer')} value={given} onChange={setGiven} />
        <div className="mt-3 flex flex-wrap gap-2">
          {quick.map((v) => (
            <button key={v} onClick={() => setGiven(v)} className={cx('h-12 rounded-2xl border-2 px-4 text-lg font-bold', given === v ? 'border-money bg-money-soft text-money' : 'border-line bg-surface')}>
              {rs(v)}
            </button>
          ))}
        </div>
      </div>
      {given > 0 && change >= 0 && (
        <div className="pop mt-5 rounded-3xl bg-money-soft p-5 text-center text-money">
          <p className="font-semibold">{change > 0 ? t('Give back to customer') : t('Exact amount')}</p>
          {change > 0 && <p className="text-5xl font-extrabold tabular-nums">{rs(change)}</p>}
        </div>
      )}
      {given > 0 && change < 0 && (
        <div className="mt-5 rounded-3xl bg-due-soft p-4 text-due">
          <p className="font-bold">{t('{amount} short', { amount: rs(-change) })}</p>
          <p className="text-sm">{hasCustomer ? t('The rest will be added to udhaar.') : t('Add the customer’s mobile number to keep udhaar.')}</p>
        </div>
      )}
      {error && <div className="mt-4"><Notice tone="danger" icon="alert" title={error} /></div>}
      <Button size="xl" block variant="money" className="mt-6" loading={saving} disabled={given > 0 && change < 0 && !hasCustomer} onClick={() => onSave(Math.min(given || amount, amount))}>
        <I.check /> {given > 0 && change < 0 ? t('Save — rest as udhaar') : t('Save bill')}
      </Button>
    </Screen>
  );
}

function SplitStep({
  amount,
  saving,
  error,
  hasCustomer,
  right,
  onSave,
  onAddPhone,
}: {
  amount: number;
  saving: boolean;
  error: string | null;
  hasCustomer: boolean;
  right: React.ReactNode;
  onSave: (p: { cash: number; upi: number; card: number }) => void;
  onAddPhone: () => void;
}) {
  const { me } = useSession();
  const [cash, setCash] = useState(0);
  const [upi, setUpi] = useState(0);
  const [card, setCard] = useState(0);
  const [showQr, setShowQr] = useState(false);
  const paid = cash + upi + card;
  const remaining = amount - paid;
  const shop = me.shop;
  return (
    <Screen title={t('Part pay / Udhaar')} right={right} noNavPad>
      <Card className="p-5 text-center">
        <p className="text-muted">{t('Bill amount')}</p>
        <p className="text-5xl font-extrabold tabular-nums">{rs(amount)}</p>
      </Card>
      <div className="mt-5 space-y-4">
        <MoneyInput label={t('Cash now')} value={cash} onChange={setCash} />
        <div>
          <MoneyInput label={t('UPI now')} value={upi} onChange={setUpi} />
          {upi > 0 && shop.upiVpa && (
            <button className="mt-2 inline-flex items-center gap-1 font-bold text-brand-text" onClick={() => setShowQr(true)}>
              <I.qr size={20} /> {t('Show QR for {amount}', { amount: rs(upi) })}
            </button>
          )}
        </div>
        <MoneyInput label={t('Card now')} value={card} onChange={setCard} />
      </div>
      <div className={cx('mt-5 rounded-3xl p-4', remaining > 0 ? 'bg-due-soft text-due' : remaining < 0 ? 'bg-danger-soft text-danger' : 'bg-money-soft text-money')}>
        {remaining > 0 && <p className="text-lg font-bold">{t('Udhaar (pay later): {amount}', { amount: rs(remaining) })}</p>}
        {remaining < 0 && <p className="font-bold">{t('This is {amount} more than the bill', { amount: rs(-remaining) })}</p>}
        {remaining === 0 && <p className="font-bold">{t('Fully paid')}</p>}
      </div>
      {remaining > 0 && !hasCustomer && (
        <div className="mt-3">
          <Notice tone="warn" icon="user" title={t('Customer number needed for udhaar')} action={<Button size="sm" variant="secondary" onClick={onAddPhone}>{t('Add number')}</Button>} />
        </div>
      )}
      {error && <div className="mt-4"><Notice tone="danger" icon="alert" title={error} /></div>}
      <Button size="xl" block variant="money" className="mt-6" loading={saving} disabled={remaining < 0 || (remaining > 0 && !hasCustomer)} onClick={() => onSave({ cash, upi, card })}>
        <I.check /> {t('Save bill')}
      </Button>
      <Sheet open={showQr} onClose={() => setShowQr(false)} title={t('Scan & pay')}>
        {shop.upiVpa && (
          <div className="pb-4 text-center">
            <p className="text-5xl font-extrabold">{rs(upi)}</p>
            <div
              className="mx-auto mt-4 w-full max-w-[280px] rounded-3xl bg-white p-3 [&_svg]:h-auto [&_svg]:w-full"
              dangerouslySetInnerHTML={{ __html: qrSvg(upiLink({ vpa: shop.upiVpa, name: shop.upiName || shop.name, amount: upi, note: shop.name })) }}
            />
            <p className="mt-2 text-muted">{shop.upiVpa}</p>
            <Button block size="lg" className="mt-4" onClick={() => setShowQr(false)}>
              {t('Done')}
            </Button>
          </div>
        )}
      </Sheet>
    </Screen>
  );
}

