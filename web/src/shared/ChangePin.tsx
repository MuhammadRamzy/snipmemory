import { useState } from 'react';
import { Button, Notice, PinPad, Screen } from '../components/ui';
import { api, message } from '../lib/api';
import { t } from '../lib/i18n';

/** Change PIN: current → new → confirm. Used after a support reset and from settings. */
export function ChangePin({ length, forced, onDone, back }: { length: number; forced?: boolean; onDone: () => void; back?: string }) {
  const [step, setStep] = useState<'current' | 'new' | 'confirm'>('current');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (value: string) => {
    if (value !== next) {
      setError(t('PINs do not match. Try again.'));
      setNext('');
      setConfirm('');
      setStep('new');
      return;
    }
    setBusy(true);
    try {
      await api.post('/api/auth/pin', { currentPin: current, newPin: next });
      onDone();
    } catch (err) {
      setError(message(err));
      setCurrent('');
      setNext('');
      setConfirm('');
      setStep('current');
    } finally {
      setBusy(false);
    }
  };

  const titles = { current: forced ? t('Enter the temporary PIN') : t('Enter current PIN'), new: t('Choose a new {n}-digit PIN', { n: length }), confirm: t('Enter new PIN again') };
  return (
    <Screen title={t('Change PIN')} back={forced ? undefined : back} noNavPad>
      {forced && <Notice tone="warn" icon="lock" title={t('Please set your own PIN')}>{t('Your PIN was reset by support. Choose a new one that only you know.')}</Notice>}
      <h2 className="mb-6 mt-6 text-center text-2xl font-bold">{titles[step]}</h2>
      {error && (
        <div className="mb-4">
          <Notice tone="danger" icon="alert" title={error} />
        </div>
      )}
      {step === 'current' && <PinPad key="c" length={forced ? 6 : length} value={current} onChange={setCurrent} onDone={() => { setError(null); setStep('new'); }} />}
      {step === 'new' && <PinPad key="n" length={length} value={next} onChange={setNext} onDone={() => setStep('confirm')} />}
      {step === 'confirm' && <PinPad key="f" length={length} value={confirm} onChange={setConfirm} onDone={save} />}
      {busy && <p className="mt-4 text-center text-muted">{t('Saving…')}</p>}
      {step !== 'current' && (
        <Button variant="ghost" block className="mt-6" onClick={() => { setStep('current'); setCurrent(''); setNext(''); setConfirm(''); }}>
          {t('Start again')}
        </Button>
      )}
    </Screen>
  );
}
