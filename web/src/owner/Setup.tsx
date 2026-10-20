import { useState } from 'react';
import { useNavigate } from 'react-router';
import { I } from '../components/icons';
import { Avatar, Button, Card, Input, Notice, Screen, cx, useUi } from '../components/ui';
import { api, message } from '../lib/api';
import { phoneDisplay } from '../lib/format';
import { t } from '../lib/i18n';
import { useSession } from '../lib/session';
import { whatsapp } from '../lib/share';
import { InstallTip } from '../shared/InstallTip';

/** First run: UPI ID for QR bills → add barbers → install & share the staff app. */
export default function Setup() {
  const { me, refresh } = useSession();
  const { toast } = useUi();
  const navigate = useNavigate();
  const [step, setStep] = useState(me.shop.upiVpa ? 2 : 1);
  const [vpa, setVpa] = useState(me.shop.upiVpa ?? '');
  const [upiName, setUpiName] = useState(me.shop.upiName ?? me.shop.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<{ name: string; phone: string; pin: string }[]>([]);
  const [form, setForm] = useState({ name: '', phone: '', pin: '', commission: '40' });

  const saveUpi = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.patch('/api/shop/settings', { upiVpa: vpa.trim(), upiName: upiName.trim() || me.shop.name });
      await refresh();
      setStep(2);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  const addStaff = async () => {
    setBusy(true);
    setError(null);
    try {
      const digits = form.phone.replace(/\D/g, '').slice(-10);
      await api.post('/api/shop/staff', { name: form.name.trim(), phone: digits, pin: form.pin, commissionPct: Number(form.commission) || 0 });
      setAdded((a) => [...a, { name: form.name.trim(), phone: digits, pin: form.pin }]);
      setForm({ name: '', phone: '', pin: '', commission: form.commission });
      toast(t('Added'));
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    await api.post('/api/shop/onboarded');
    await refresh();
    navigate('/owner', { replace: true });
  };

  const staffLink = `${window.location.origin}/staff`;

  return (
    <Screen title={t('Set up your shop')} noNavPad>
      <div className="mb-5 flex gap-1.5">
        {[1, 2, 3].map((s) => (
          <span key={s} className={cx('h-1.5 flex-1 rounded-full', s <= step ? 'bg-brand' : 'bg-line')} />
        ))}
      </div>
      {error && (
        <div className="mb-4">
          <Notice tone="danger" icon="alert" title={error} />
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-extrabold">{t('Get paid by UPI QR')}</h2>
            <p className="mt-1 text-muted">{t('Every bill shows a QR with the exact amount. Money comes straight to your bank — SnipMemory never touches it.')}</p>
          </div>
          <Card className="p-4">
            <ol className="space-y-2 text-[15px]">
              <li>1. {t('Open PhonePe, Google Pay, Paytm or BHIM')}</li>
              <li>2. {t('Tap your photo / profile at the top')}</li>
              <li>3. {t('Copy the UPI ID — it looks like 98xxxxxx@ybl or name@okaxis')}</li>
            </ol>
          </Card>
          <Input label={t('Your UPI ID')} value={vpa} onChange={(e) => setVpa(e.target.value)} placeholder="name@okaxis" autoCapitalize="none" autoCorrect="off" autoFocus />
          <Input label={t('Name shown to customers')} value={upiName} onChange={(e) => setUpiName(e.target.value)} />
          <Button size="xl" block loading={busy} disabled={!vpa.includes('@')} onClick={saveUpi}>
            {t('Save & continue')}
          </Button>
          <Button variant="ghost" block onClick={() => setStep(2)}>
            {t('Skip — I will add it later')}
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-extrabold">{t('Who works with you?')}</h2>
            <p className="mt-1 text-muted">{t('Each barber gets their own Staff app to make bills. You see everyone’s cuts and earnings.')}</p>
          </div>
          {added.length > 0 && (
            <Card className="divide-y divide-line">
              {added.map((a) => (
                <div key={a.phone} className="flex items-center gap-3 p-3">
                  <Avatar name={a.name} size={40} />
                  <div className="flex-1">
                    <p className="font-bold">{a.name}</p>
                    <p className="text-sm text-muted">{phoneDisplay(`+91${a.phone}`)} · PIN {a.pin}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon="whatsapp"
                    onClick={() => whatsapp(`91${a.phone}`, t('Hi {name}, open {link} to make bills for {shop}. Login with your number and PIN {pin}. Then “Add to Home screen”.', { name: a.name, link: staffLink, shop: me.shop.name, pin: a.pin }))}
                  >
                    {t('Send')}
                  </Button>
                </div>
              ))}
            </Card>
          )}
          <Card className="space-y-4 p-4">
            <Input label={t('Name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label={t('Mobile number')} prefix="+91" type="tel" inputMode="numeric" maxLength={14} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label={t('4-digit PIN')} inputMode="numeric" maxLength={4} value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })} />
              <Input label={t('Commission %')} inputMode="numeric" maxLength={3} value={form.commission} onChange={(e) => setForm({ ...form, commission: e.target.value.replace(/\D/g, '') })} />
            </div>
            <Button block size="lg" variant="secondary" icon="plus" loading={busy} disabled={!form.name.trim() || form.phone.replace(/\D/g, '').length < 10 || form.pin.length !== 4} onClick={addStaff}>
              {t('Add barber')}
            </Button>
          </Card>
          <Button size="xl" block onClick={() => setStep(3)}>
            {added.length ? t('Continue') : t('I work alone — continue')}
          </Button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <div className="text-center">
            <span className="pop mx-auto grid size-20 place-items-center rounded-full bg-money text-white">
              <I.check size={44} strokeWidth={3} />
            </span>
            <h2 className="mt-4 text-2xl font-extrabold">{t('You are ready to bill!')}</h2>
            <p className="mt-1 text-muted">{t('Your 30-day Pro trial has started. No card, no payment needed.')}</p>
          </div>
          <InstallTip appName={t('Owner app')} />
          <Card className="p-4">
            <p className="font-bold">{t('Staff app link')}</p>
            <p className="text-sm text-muted">{t('Your barbers open this on their own phone and log in with their number + PIN.')}</p>
            <p className="mt-2 rounded-xl bg-surface-2 px-3 py-2 font-mono text-sm">{staffLink}</p>
            <Button className="mt-3" block variant="secondary" icon="whatsapp" onClick={() => whatsapp(null, t('Staff app for {shop}: {link}', { shop: me.shop.name, link: staffLink }))}>
              {t('Share on WhatsApp')}
            </Button>
          </Card>
          <Button size="xl" block onClick={finish}>
            {t('Go to my shop')}
          </Button>
        </div>
      )}
    </Screen>
  );
}
