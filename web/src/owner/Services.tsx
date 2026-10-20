import { useState, type FormEvent } from 'react';
import { Badge, Button, ErrorBox, Input, Loading, MoneyInput, Screen, Sheet, Toggle, useUi } from '../components/ui';
import { api, message } from '../lib/api';
import { useCatalog } from '../lib/catalog';
import { rs } from '../lib/format';
import { t } from '../lib/i18n';
import { useSession } from '../lib/session';
import type { Service } from '../lib/types';

export default function Services() {
  const { me } = useSession();
  const { catalog, error, reload } = useCatalog(me.shop.id);
  const [editing, setEditing] = useState<Service | 'new' | null>(null);
  if (!catalog) return error ? <Screen title={t('Services & prices')} back="/owner/more"><ErrorBox error={error} retry={reload} /></Screen> : <Loading />;
  const groups = new Map<string, Service[]>();
  for (const s of catalog.services) groups.set(s.category, [...(groups.get(s.category) ?? []), s]);

  return (
    <Screen title={t('Services & prices')} back="/owner/more" right={<Button size="sm" icon="plus" onClick={() => setEditing('new')}>{t('Add')}</Button>}>
      <p className="mb-4 px-1 text-muted">{t('Tap a service to change its price. Price changes apply to new bills.')}</p>
      {[...groups.entries()].map(([cat, list]) => (
        <section key={cat} className="mb-5">
          <h2 className="mb-2 px-1 text-[15px] font-bold uppercase tracking-wide text-muted">{cat}</h2>
          <div className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
            {list.map((s) => (
              <button key={s.id} onClick={() => setEditing(s)} className={`flex min-h-16 w-full items-center gap-3 px-4 text-left active:bg-surface-2 ${s.active ? '' : 'opacity-50'}`}>
                <span className="flex-1 text-[17px] font-semibold">
                  {s.name} {!s.active && <Badge>{t('Hidden')}</Badge>}
                </span>
                <span className="text-lg font-extrabold tabular-nums">{rs(s.price)}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
      <ServiceSheet
        item={editing}
        categories={[...groups.keys()]}
        onClose={() => setEditing(null)}
        onDone={() => {
          setEditing(null);
          void reload();
        }}
      />
    </Screen>
  );
}

function ServiceSheet({ item, categories, onClose, onDone }: { item: Service | 'new' | null; categories: string[]; onClose: () => void; onDone: () => void }) {
  const { toast } = useUi();
  const existing = item && item !== 'new' ? item : null;
  const [form, setForm] = useState({ name: '', category: categories[0] ?? 'Hair', price: 0, minutes: '20', active: true });
  const [busy, setBusy] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = existing?.id ?? (item === 'new' ? 'new' : null);
  if (key !== lastKey) {
    setLastKey(key);
    setForm(existing ? { name: existing.name, category: existing.category, price: existing.price, minutes: String(existing.minutes), active: existing.active } : { name: '', category: categories[0] ?? 'Hair', price: 0, minutes: '20', active: true });
  }
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { name: form.name.trim(), category: form.category.trim() || 'Hair', price: form.price, minutes: Number(form.minutes) || 20, active: form.active };
      if (existing) await api.patch(`/api/shop/services/${existing.id}`, body);
      else await api.post('/api/shop/services', body);
      toast(t('Saved'));
      onDone();
    } catch (err) {
      toast(message(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={Boolean(item)} onClose={onClose} title={existing ? t('Edit service') : t('New service')}>
      <form onSubmit={submit} className="space-y-4">
        <Input label={t('Service name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus={!existing} />
        <MoneyInput label={t('Price')} value={form.price} onChange={(v) => setForm({ ...form, price: v })} autoFocus={Boolean(existing)} />
        <Input label={t('Group')} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} list="svc-cats" />
        <datalist id="svc-cats">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <Input label={t('Time (minutes)')} inputMode="numeric" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value.replace(/\D/g, '') })} />
        {existing && <Toggle checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label={t('Show on billing screen')} />}
        <Button type="submit" size="lg" block loading={busy} disabled={!form.name.trim()}>
          {t('Save')}
        </Button>
      </form>
    </Sheet>
  );
}
