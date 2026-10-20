import { useEffect, useState } from 'react';
import { I } from '../components/icons';
import { Button } from '../components/ui';
import { t } from '../lib/i18n';

interface BeforeInstallPrompt extends Event {
  prompt: () => Promise<void>;
}

/** "Add to home screen" helper: one tap on Android/Chrome, instructions elsewhere. */
export function InstallTip({ appName }: { appName: string }) {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPrompt | null>(null);
  const standalone = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches;
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPrompt);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  if (standalone) return null;
  return (
    <div className="flex items-center gap-3 rounded-3xl border border-line bg-surface p-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand-text">
        <I.download />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold">{t('Install {app} on this phone', { app: appName })}</p>
        <p className="text-sm text-muted">{promptEvent ? t('Opens like a normal app, works without internet.') : t('Chrome menu ⋮ → “Add to Home screen”. On iPhone: Share → “Add to Home Screen”.')}</p>
      </div>
      {promptEvent && (
        <Button size="sm" onClick={() => promptEvent.prompt().then(() => setPromptEvent(null))}>
          {t('Install')}
        </Button>
      )}
    </div>
  );
}
