import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Badge, Button, Card, Chips, Input, Notice, Screen, Section, Toggle, useUi } from '../components/ui';
import { api, message } from '../lib/api';
import { t } from '../lib/i18n';
import { useSession } from '../lib/session';
import type { Shop } from '../lib/types';

export default function Settings() {
  const { me, refresh, has, isOwner } = useSession();
  const { toast } = useUi();
  const navigate = useNavigate();
  const [form, setForm] = useState<Shop>(me.shop);
  const [saving, setSaving] = useState<string | null>(null);
  const set = <K extends keyof Shop>(k: K, v: Shop[K]) => setForm((f) => ({ ...f, [k]: v }));

  if (!isOwner) {
    return (
      <Screen title={t('Shop settings')} back="/owner/more">
        <Notice tone="warn" icon="lock" title={t('Only the owner can change shop settings.')} />
      </Screen>
    );
  }

  const save = async (section: string, body: Partial<Record<string, unknown>>) => {
    setSaving(section);
    try {
      await api.patch('/api/shop/settings', body);
      await refresh();
      toast(t('Saved'));
    } catch (err) {
      toast(message(err), 'error');
    } finally {
      setSaving(null);
    }
  };

  return (
    <Screen title={t('Shop settings')} back="/owner/more">
      <Section title={t('UPI payments')}>
        <Card className="space-y-4 p-4">
          <Input label={t('UPI ID for QR')} value={form.upiVpa ?? ''} onChange={(e) => set('upiVpa', e.target.value.trim())} placeholder="98xxxxxx@ybl" autoCapitalize="none" autoCorrect="off" hint={t('PhonePe / GPay / Paytm → profile → UPI ID. Money goes directly to you.')} />
          <Input label={t('Name shown when paying')} value={form.upiName ?? ''} onChange={(e) => set('upiName', e.target.value)} />
          <Button block loading={saving === 'upi'} onClick={() => save('upi', { upiVpa: form.upiVpa || null, upiName: form.upiName || null })}>
            {t('Save UPI')}
          </Button>
        </Card>
      </Section>

      <Section title={t('Shop details')}>
        <form
          className="space-y-4"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void save('shop', { name: form.name, phone: form.phone || null, address: form.address || null, city: form.city || null, state: form.state || null, billFooter: form.billFooter || null, billPrefix: form.billPrefix });
          }}
        >
          <Card className="space-y-4 p-4">
            <Input label={t('Shop name')} value={form.name} onChange={(e) => set('name', e.target.value)} required />
            <Input label={t('Shop phone')} type="tel" value={form.phone?.replace(/^\+91/, '') ?? ''} onChange={(e) => set('phone', e.target.value)} prefix="+91" />
            <Input label={t('Address')} value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <Input label={t('City')} value={form.city ?? ''} onChange={(e) => set('city', e.target.value)} />
              <Input label={t('State')} value={form.state ?? ''} onChange={(e) => set('state', e.target.value)} />
            </div>
            <Input label={t('Message at bottom of bill')} value={form.billFooter ?? ''} onChange={(e) => set('billFooter', e.target.value)} placeholder={t('Thank you! Visit again 🙏')} />
            <Input label={t('Bill number prefix (optional)')} value={form.billPrefix} onChange={(e) => set('billPrefix', e.target.value.toUpperCase())} maxLength={8} placeholder="SP-" />
            <Button type="submit" block loading={saving === 'shop'}>
              {t('Save details')}
            </Button>
          </Card>
        </form>
      </Section>

      <Section title={t('Staff rules')}>
        <Card className="space-y-2 p-4">
          <Toggle checked={form.staffCanDiscount} onChange={(v) => set('staffCanDiscount', v)} label={t('Staff can give discount')} />
          {form.staffCanDiscount && (
            <div className="pb-2">
              <p className="mb-2 font-semibold">{t('Maximum discount by staff')}</p>
              <Chips value={String(form.staffMaxDiscount)} onChange={(v) => set('staffMaxDiscount', Number(v))} options={['5', '10', '20', '30', '50'].map((v) => ({ value: v, label: `${v}%` }))} />
            </div>
          )}
          <Toggle checked={form.staffSeePhone} onChange={(v) => set('staffSeePhone', v)} label={t('Staff can see customer mobile numbers')} hint={t('Turn off if you worry staff may take your customers.')} />
          <Button block className="mt-2" loading={saving === 'rules'} onClick={() => save('rules', { staffCanDiscount: form.staffCanDiscount, staffMaxDiscount: form.staffMaxDiscount, staffSeePhone: form.staffSeePhone })}>
            {t('Save rules')}
          </Button>
        </Card>
      </Section>

      <Section title={<span className="flex items-center gap-2">{t('GST bills')} {!has('gst') && <Badge tone="brand">Pro</Badge>}</span>}>
        <Card className="space-y-3 p-4">
          {!has('gst') ? (
            <>
              <p className="text-muted">{t('Only needed if your shop is GST registered (turnover above ₹20 lakh).')}</p>
              <Button variant="secondary" block onClick={() => navigate('/owner/plan')}>
                {t('See plans')}
              </Button>
            </>
          ) : (
            <>
              <Toggle checked={form.gstEnabled} onChange={(v) => set('gstEnabled', v)} label={t('Show GST on bills')} hint={t('Only if your shop is GST registered.')} />
              {form.gstEnabled && (
                <>
                  <Input label="GSTIN" value={form.gstin ?? ''} onChange={(e) => set('gstin', e.target.value.toUpperCase())} maxLength={15} />
                  <Chips value={String(form.gstRate)} onChange={(v) => set('gstRate', Number(v))} options={['5', '12', '18'].map((v) => ({ value: v, label: `${v}%` }))} />
                  <Toggle checked={form.gstInclusive} onChange={(v) => set('gstInclusive', v)} label={t('My prices already include GST')} />
                </>
              )}
              <Button block loading={saving === 'gst'} onClick={() => save('gst', { gstEnabled: form.gstEnabled, gstin: form.gstin || null, gstRate: form.gstRate, gstInclusive: form.gstInclusive })}>
                {t('Save GST')}
              </Button>
            </>
          )}
        </Card>
      </Section>

      <Section title={t('Customers')}>
        <Card className="p-4">
          <p className="mb-2 font-semibold">{t('Show “not coming” after')}</p>
          <Chips value={String(form.winbackDays)} onChange={(v) => set('winbackDays', Number(v))} options={['21', '30', '45', '60', '90'].map((v) => ({ value: v, label: t('{n} days', { n: v }) }))} />
          <Button block className="mt-3" loading={saving === 'winback'} onClick={() => save('winback', { winbackDays: form.winbackDays })}>
            {t('Save')}
          </Button>
        </Card>
      </Section>

      <div id="branch" />
      <AddBranch />
    </Screen>
  );
}

function AddBranch() {
  const { refresh } = useSession();
  const { toast } = useUi();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Section title={t('Branches')}>
      <Card className="space-y-3 p-4">
        <p className="text-muted">{t('Have another shop? Each branch has its own staff, bills and plan. Switch between them from Home.')}</p>
        {!open ? (
          <Button variant="secondary" block icon="plus" onClick={() => setOpen(true)}>
            {t('Add another branch')}
          </Button>
        ) : (
          <>
            <Input label={t('Branch name')} value={name} onChange={(e) => setName(e.target.value)} />
            <Input label={t('City')} value={city} onChange={(e) => setCity(e.target.value)} />
            <Button
              block
              loading={busy}
              disabled={name.trim().length < 2}
              onClick={async () => {
                setBusy(true);
                try {
                  await api.post('/api/auth/shops', { shopName: name.trim(), city: city.trim() || undefined });
                  await refresh();
                  navigate('/owner/setup');
                } catch (err) {
                  toast(message(err), 'error');
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t('Create branch')}
            </Button>
          </>
        )}
      </Card>
    </Section>
  );
}
