import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { I, Logo } from '../components/icons';
import { Button, Input, Notice, PinPad } from '../components/ui';
import { api, message } from '../lib/api';
import { phoneDisplay } from '../lib/format';
import { t } from '../lib/i18n';
import { useApi } from '../lib/useApi';

/** Mobile number → PIN. Same screen for the Owner and Staff apps. */
export function Login({ app, onDone }: { app: 'owner' | 'staff'; onDone: () => Promise<void> }) {
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<'phone' | 'pin'>('phone');
  const [pin, setPin] = useState('');
  const [pinLength, setPinLength] = useState(app === 'owner' ? 6 : 4);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const digits = phone.replace(/\D/g, '').slice(-10);

  const submitPhone = (e: FormEvent) => {
    e.preventDefault();
    if (digits.length !== 10) return setError(t('Enter your 10-digit mobile number'));
    setError(null);
    setStep('pin');
  };

  const login = async (value: string) => {
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/auth/login', { phone: digits, pin: value, app });
      await onDone();
    } catch (err) {
      setError(message(err));
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-8 pt-10">
      <Logo className="text-xl" />
      <div className="mt-2 inline-flex w-fit rounded-full bg-brand-soft px-3 py-1 text-sm font-bold text-brand-text">
        {app === 'owner' ? t('Owner app') : t('Staff app')}
      </div>

      {step === 'phone' ? (
        <form onSubmit={submitPhone} className="mt-10 flex flex-1 flex-col">
          <h1 className="text-3xl font-extrabold">{t('Login')}</h1>
          <p className="mt-1 text-lg text-muted">{t('Enter your mobile number')}</p>
          <div className="mt-6">
            <Input prefix="+91" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={14} value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus placeholder="98765 43210" className="text-2xl font-bold tracking-wide" error={error} />
          </div>
          <Button type="submit" size="xl" block className="mt-6" disabled={digits.length !== 10}>
            {t('Continue')}
          </Button>
          <div className="mt-auto space-y-3 pt-10 text-center">
            {app === 'owner' ? (
              <>
                <p className="text-muted">{t('New shop?')}</p>
                <Link to="/owner/signup" className="block rounded-2xl border-2 border-brand py-4 text-lg font-bold text-brand-text">
                  {t('Create my shop — free')}
                </Link>
                <Link to="/staff" className="block pt-2 text-sm font-semibold text-muted">
                  {t('I work in a salon → Staff app')}
                </Link>
              </>
            ) : (
              <>
                <p className="text-muted">{t('Your shop owner adds your number and gives you a 4-digit PIN.')}</p>
                <Link to="/owner" className="block pt-2 text-sm font-semibold text-muted">
                  {t('I am the shop owner → Owner app')}
                </Link>
              </>
            )}
          </div>
        </form>
      ) : (
        <div className="mt-8 flex flex-1 flex-col">
          <button onClick={() => { setStep('phone'); setPin(''); setError(null); }} className="mb-4 inline-flex w-fit items-center gap-1 text-muted">
            <I.back size={20} /> +91 {phoneDisplay(`+91${digits}`)}
          </button>
          <h1 className="text-3xl font-extrabold">{t('Enter PIN')}</h1>
          <p className="mb-6 mt-1 text-lg text-muted">{t('{n}-digit PIN', { n: pinLength })}</p>
          {error && (
            <div className="mb-4">
              <Notice tone="danger" icon="alert" title={error} />
            </div>
          )}
          <PinPad length={pinLength} value={pin} onChange={setPin} onDone={login} />
          {busy && <p className="mt-4 text-center font-semibold text-muted">{t('Checking…')}</p>}
          <div className="mt-auto space-y-2 pt-8 text-center text-sm">
            <button className="font-semibold text-brand-text" onClick={() => { setPinLength(pinLength === 4 ? 6 : 4); setPin(''); }}>
              {pinLength === 4 ? t('My PIN has 6 digits') : t('My PIN has 4 digits')}
            </button>
            <p className="text-muted">
              {app === 'staff' ? t('Forgot PIN? Ask your shop owner to reset it.') : <ForgotOwner />}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ForgotOwner() {
  const { data } = useApi<{ whatsapp: string }>('/api/public/support');
  return (
    <a href={`https://wa.me/${data?.whatsapp ?? ''}?text=${encodeURIComponent('Hi SnipMemory, I forgot my owner PIN')}`} target="_blank" rel="noreferrer" className="font-semibold text-brand-text">
      {t('Forgot PIN? WhatsApp SnipMemory support')}
    </a>
  );
}
