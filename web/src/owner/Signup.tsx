import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { I, Logo } from '../components/icons';
import { Button, Input, Notice, PinPad, cx } from '../components/ui';
import { api, message } from '../lib/api';
import { t } from '../lib/i18n';

const TYPES = [
  { id: 'gents', label: 'Gents salon / Barber shop', icon: 'scissors' },
  { id: 'unisex', label: 'Unisex salon', icon: 'users' },
  { id: 'ladies', label: 'Ladies beauty parlour', icon: 'star' },
  { id: 'spa', label: 'Spa / Massage', icon: 'gift' },
] as const;

/** Three short steps: you → your shop → your PIN. */
export default function Signup({ onDone }: { onDone: () => Promise<void> }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [shopName, setShopName] = useState('');
  const [city, setCity] = useState('');
  const [shopType, setShopType] = useState<(typeof TYPES)[number]['id']>('gents');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const digits = phone.replace(/\D/g, '').slice(-10);

  const next = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (step === 1) {
      if (name.trim().length < 2) return setError(t('Enter your name'));
      if (digits.length !== 10) return setError(t('Enter your 10-digit mobile number'));
    }
    if (step === 2 && shopName.trim().length < 2) return setError(t('Enter your shop name'));
    setStep(step + 1);
  };

  const create = async (confirm: string) => {
    if (confirm !== pin) {
      setError(t('PINs do not match. Try again.'));
      setPin('');
      setPin2('');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/auth/signup', { name: name.trim(), phone: digits, pin, shopName: shopName.trim(), city: city.trim() || undefined, shopType });
      await onDone();
      navigate('/owner/setup', { replace: true });
    } catch (err) {
      setError(message(err));
      setPin('');
      setPin2('');
      if (/number|registered/i.test(message(err))) setStep(1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-8 pt-8">
      <div className="flex items-center justify-between">
        {step > 1 ? (
          <button onClick={() => { setStep(step - 1); setError(null); setPin(''); setPin2(''); }} className="grid size-11 place-items-center rounded-full bg-surface-2" aria-label={t('Back')}>
            <I.back />
          </button>
        ) : (
          <Logo />
        )}
        <span className="text-sm font-bold text-muted">{t('Step {n} of 3', { n: step })}</span>
      </div>
      <div className="mt-3 flex gap-1.5">
        {[1, 2, 3].map((s) => (
          <span key={s} className={cx('h-1.5 flex-1 rounded-full', s <= step ? 'bg-brand' : 'bg-line')} />
        ))}
      </div>

      {error && (
        <div className="mt-5">
          <Notice tone="danger" icon="alert" title={error} />
        </div>
      )}

      {step === 1 && (
        <form onSubmit={next} className="mt-8 flex flex-1 flex-col gap-5">
          <h1 className="text-3xl font-extrabold">{t('Start free')}</h1>
          <Input label={t('Your name')} value={name} onChange={(e) => setName(e.target.value)} autoFocus autoComplete="name" />
          <Input label={t('Your mobile number')} prefix="+91" type="tel" inputMode="numeric" maxLength={14} value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel-national" hint={t('You will log in with this number')} />
          <Button type="submit" size="xl" block className="mt-auto">
            {t('Next')}
          </Button>
          <p className="text-center text-sm text-muted">
            {t('Already registered?')} <Link to="/owner" className="font-bold text-brand-text">{t('Login')}</Link>
          </p>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={next} className="mt-8 flex flex-1 flex-col gap-5">
          <h1 className="text-3xl font-extrabold">{t('Your shop')}</h1>
          <Input label={t('Shop name')} value={shopName} onChange={(e) => setShopName(e.target.value)} autoFocus placeholder={t('e.g. Style Point Hair Salon')} />
          <Input label={t('Town / City')} value={city} onChange={(e) => setCity(e.target.value)} />
          <div>
            <p className="mb-2 font-semibold">{t('Type of shop')}</p>
            <div className="grid grid-cols-2 gap-3">
              {TYPES.map((ty) => {
                const Icon = I[ty.icon];
                return (
                  <button
                    type="button"
                    key={ty.id}
                    onClick={() => setShopType(ty.id)}
                    className={cx('flex min-h-24 flex-col items-start justify-between rounded-3xl border-2 p-3 text-left font-bold', shopType === ty.id ? 'border-brand bg-brand-soft' : 'border-line bg-surface')}
                  >
                    <Icon />
                    {t(ty.label)}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-sm text-muted">{t('We add a ready price list. You can change it any time.')}</p>
          </div>
          <Button type="submit" size="xl" block className="mt-auto">
            {t('Next')}
          </Button>
        </form>
      )}

      {step === 3 && (
        <div className="mt-8 flex flex-1 flex-col">
          <h1 className="text-3xl font-extrabold">{pin.length < 6 ? t('Create a 6-digit PIN') : t('Enter the PIN again')}</h1>
          <p className="mb-6 mt-1 text-muted">{t('Like your UPI PIN — keep it secret. Do not use 123456.')}</p>
          {pin.length < 6 ? <PinPad key="a" length={6} value={pin} onChange={setPin} /> : <PinPad key="b" length={6} value={pin2} onChange={setPin2} onDone={create} />}
          {busy && <p className="mt-4 text-center font-semibold text-muted">{t('Creating your shop…')}</p>}
        </div>
      )}
    </div>
  );
}
