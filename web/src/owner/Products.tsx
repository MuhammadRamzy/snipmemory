import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Badge, Button, Chips, Empty, ErrorBox, Input, Loading, MoneyInput, Notice, Screen, Sheet, Toggle, useUi } from '../components/ui';
import { api, message } from '../lib/api';
import { useCatalog } from '../lib/catalog';
import { rs } from '../lib/format';
import { t } from '../lib/i18n';
import { useSession } from '../lib/session';
import type { Mode, Product } from '../lib/types';

export default function Products() {
  const { me, has } = useSession();
  const { catalog, error, reload } = useCatalog(me.shop.id);
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [stockFor, setStockFor] = useState<Product | null>(null);
  const navigate = useNavigate();
  if (!catalog) return error ? <Screen title={t('Products')} back="/owner/more"><ErrorBox error={error} retry={reload} /></Screen> : <Loading />;
  const inventory = has('inventory');

  return (
    <Screen title={t('Products & stock')} back="/owner/more" right={<Button size="sm" icon="plus" onClick={() => setEditing('new')}>{t('Add')}</Button>}>
      {!inventory && (
        <div className="mb-4">
          <Notice tone="brand" icon="box" title={t('Stock tracking is in Pro')} action={<Button size="sm" onClick={() => navigate('/owner/plan')}>{t('See plans')}</Button>}>
            {t('You can still sell products on bills. Pro counts stock and warns when it runs low.')}
          </Notice>
        </div>
      )}
      {catalog.products.length === 0 ? (
        <Empty icon="box" title={t('No products yet')} action={<Button icon="plus" onClick={() => setEditing('new')}>{t('Add product')}</Button>}>
          {t('Sell gel, wax, shampoo, oil… and see the profit.')}
        </Empty>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
          {catalog.products.map((p) => (
            <div key={p.id} className={`flex items-center gap-3 p-4 ${p.active ? '' : 'opacity-50'}`}>
              <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(p)}>
                <p className="truncate text-[17px] font-bold">{p.name}</p>
                <p className="text-sm text-muted">
                  {rs(p.price)}
                  {p.cost ? ` · ${t('cost {amount}', { amount: rs(p.cost) })}` : ''}
                </p>
              </button>
              {inventory && (
                <button onClick={() => setStockFor(p)} className="text-right">
                  <span className="block text-sm text-muted">{t('Stock')}</span>
                  {p.stock <= p.lowStock ? <Badge tone="due">{p.stock}</Badge> : <span className="text-lg font-extrabold">{p.stock}</span>}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <ProductSheet item={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); void reload(); }} />
      <StockSheet product={stockFor} onClose={() => setStockFor(null)} onDone={() => { setStockFor(null); void reload(); }} />
    </Screen>
  );
}

function ProductSheet({ item, onClose, onDone }: { item: Product | 'new' | null; onClose: () => void; onDone: () => void }) {
  const { toast } = useUi();
  const existing = item && item !== 'new' ? item : null;
  const blank = { name: '', price: 0, cost: 0, stock: '0', lowStock: '2', active: true };
  const [form, setForm] = useState(blank);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = existing?.id ?? (item === 'new' ? 'new' : null);
  if (key !== lastKey) {
    setLastKey(key);
    setForm(existing ? { name: existing.name, price: existing.price, cost: existing.cost ?? 0, stock: String(existing.stock), lowStock: String(existing.lowStock), active: existing.active } : blank);
  }
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (existing) await api.patch(`/api/shop/products/${existing.id}`, { name: form.name, price: form.price, cost: form.cost, lowStock: Number(form.lowStock) || 0, active: form.active });
      else await api.post('/api/shop/products', { name: form.name, price: form.price, cost: form.cost, stock: Number(form.stock) || 0, lowStock: Number(form.lowStock) || 0 });
      onDone();
    } catch (err) {
      toast(message(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={Boolean(item)} onClose={onClose} title={existing ? t('Edit product') : t('New product')}>
      <form onSubmit={submit} className="space-y-4">
        <Input label={t('Product name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <div className="grid grid-cols-2 gap-3">
          <MoneyInput label={t('Selling price')} value={form.price} onChange={(v) => setForm({ ...form, price: v })} />
          <MoneyInput label={t('Buying cost')} value={form.cost} onChange={(v) => setForm({ ...form, cost: v })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {!existing && <Input label={t('Stock now')} inputMode="numeric" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value.replace(/[^\d-]/g, '') })} />}
          <Input label={t('Warn when below')} inputMode="numeric" value={form.lowStock} onChange={(e) => setForm({ ...form, lowStock: e.target.value.replace(/\D/g, '') })} />
        </div>
        {existing && <Toggle checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label={t('Show on billing screen')} />}
        <Button type="submit" size="lg" block loading={busy} disabled={!form.name.trim()}>
          {t('Save')}
        </Button>
      </form>
    </Sheet>
  );
}

function StockSheet({ product, onClose, onDone }: { product: Product | null; onClose: () => void; onDone: () => void }) {
  const { toast } = useUi();
  const [type, setType] = useState<'in' | 'fix'>('in');
  const [qty, setQty] = useState('');
  const [paid, setPaid] = useState(0);
  const [mode, setMode] = useState<Mode>('cash');
  const [busy, setBusy] = useState(false);
  if (!product) return null;
  const n = Number(qty) || 0;
  return (
    <Sheet open onClose={onClose} title={product.name}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api.post(`/api/shop/products/${product.id}/stock`, type === 'in' ? { change: n, paid: paid || undefined, mode } : { change: n - product.stock });
            toast(t('Stock updated'));
            setQty('');
            setPaid(0);
            onDone();
          } catch (err) {
            toast(message(err), 'error');
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="text-lg">{t('Now in stock: {n}', { n: product.stock })}</p>
        <Chips value={type} onChange={setType} options={[{ value: 'in', label: t('New stock came') }, { value: 'fix', label: t('Correct the count') }]} />
        <Input label={type === 'in' ? t('How many came?') : t('Actual count now')} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} autoFocus />
        {type === 'in' && (
          <>
            <MoneyInput label={t('Paid for it (adds to expenses)')} value={paid} onChange={setPaid} />
            {paid > 0 && <Chips value={mode} onChange={setMode} options={[{ value: 'cash', label: t('Cash') }, { value: 'upi', label: 'UPI' }]} />}
          </>
        )}
        <Button type="submit" size="lg" block loading={busy} disabled={!qty}>
          {t('Save')}
        </Button>
      </form>
    </Sheet>
  );
}
