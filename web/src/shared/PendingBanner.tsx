import { useState } from 'react';
import { I } from '../components/icons';
import { Button, Sheet, useUi } from '../components/ui';
import { dateTime, rs } from '../lib/format';
import { t } from '../lib/i18n';
import { discardPending, flushOutbox, usePending } from '../lib/outbox';

/** Shows bills saved while offline, and lets the user retry or remove a failed one. */
export function PendingBanner({ shopId }: { shopId: string }) {
  const pending = usePending(shopId);
  const [open, setOpen] = useState(false);
  const { ask, toast } = useUi();
  if (!pending.length) return null;
  const failed = pending.filter((p) => p.error).length;
  return (
    <>
      <button onClick={() => setOpen(true)} className={`flex w-full items-center justify-center gap-2 px-4 py-2 text-sm font-bold ${failed ? 'bg-danger text-white' : 'bg-warn-soft text-warn'}`}>
        <I.offline size={18} />
        {failed ? t('{n} bills could not upload — tap to fix', { n: failed }) : t('{n} bills waiting for internet', { n: pending.length })}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('Bills on this phone')}>
        <div className="space-y-3">
          {pending.map((p) => (
            <div key={p.clientRef} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex justify-between font-bold">
                <span>{p.customerName ?? t('Walk-in')}</span>
                <span>{rs(p.total)}</span>
              </div>
              <p className="text-sm text-muted">{dateTime(p.createdAt)}</p>
              {p.error && (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-danger">{p.error}</p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      if (await ask({ title: t('Remove this bill?'), body: t('It was not saved on the server. Make it again if needed.'), confirm: t('Remove'), danger: true })) discardPending(p.clientRef);
                    }}
                  >
                    {t('Remove')}
                  </Button>
                </div>
              )}
            </div>
          ))}
          <Button
            block
            size="lg"
            icon="refresh"
            onClick={async () => {
              const n = await flushOutbox(shopId);
              toast(n ? t('{n} bills uploaded', { n }) : t('Still no internet'), n ? 'ok' : 'error');
            }}
          >
            {t('Upload now')}
          </Button>
        </div>
      </Sheet>
    </>
  );
}
