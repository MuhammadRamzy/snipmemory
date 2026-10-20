import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { I } from '../components/icons';
import { Button, Card, Notice, Screen, useUi } from '../components/ui';
import { api, message } from '../lib/api';
import { rs } from '../lib/format';
import { t } from '../lib/i18n';
import { compressPhoto } from '../lib/image';
import { receiptText } from '../lib/receipt';
import { useSession } from '../lib/session';
import { shareText, whatsapp } from '../lib/share';
import type { SavedBill } from './BillFlow';

export function BillDone({ app, saved, onNew }: { app: 'owner' | 'staff'; saved: SavedBill; onNew: () => void }) {
  const { me, has } = useSession();
  const { toast } = useUi();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoDone, setPhotoDone] = useState(false);
  const bill = saved.bill;
  const link = bill ? `${window.location.origin}/b/${bill.token}` : null;
  const number = bill ? `${me.shop.billPrefix}${bill.billNo}` : null;
  const text = receiptText(me.shop, { number, lines: saved.lines, total: saved.total, paid: saved.paid, due: saved.due, link }, saved.customerName);

  const uploadPhoto = async (file: File | undefined) => {
    if (!file || !bill?.customerId) return;
    setPhotoBusy(true);
    try {
      const blob = await compressPhoto(file);
      await api.upload(`/api/shop/customers/${bill.customerId}/photos`, blob, { 'x-bill-id': bill.id });
      setPhotoDone(true);
      toast(t('Photo saved'));
    } catch (err) {
      toast(message(err), 'error');
    } finally {
      setPhotoBusy(false);
    }
  };

  return (
    <Screen noNavPad>
      <div className="pt-6 text-center">
        <span className="pop mx-auto grid size-24 place-items-center rounded-full bg-money text-white">
          <I.check size={56} strokeWidth={3} />
        </span>
        <h1 className="mt-4 text-3xl font-extrabold">{bill ? t('Bill saved') : t('Saved on this phone')}</h1>
        <p className="mt-1 text-lg text-muted">{bill ? t('Bill #{n}', { n: number! }) : t('No internet — it will upload automatically.')}</p>
      </div>

      <Card className="mt-6 p-5">
        <div className="flex items-end justify-between">
          <span className="text-lg font-semibold text-muted">{t('Total')}</span>
          <span className="text-4xl font-extrabold tabular-nums">{rs(saved.total)}</span>
        </div>
        <div className="mt-3 space-y-1 text-[17px]">
          {saved.paid.upi > 0 && <Line label={t('UPI')} value={rs(saved.paid.upi)} />}
          {saved.paid.cash > 0 && <Line label={t('Cash')} value={rs(saved.paid.cash)} />}
          {saved.paid.card > 0 && <Line label={t('Card')} value={rs(saved.paid.card)} />}
          {saved.paid.advance > 0 && <Line label={t('From advance')} value={rs(saved.paid.advance)} />}
          {saved.due > 0 && <Line label={t('Udhaar')} value={rs(saved.due)} due />}
        </div>
        {saved.customerName && <p className="mt-3 text-muted">{saved.customerName}</p>}
      </Card>

      <div className="mt-5 space-y-3">
        {saved.customerPhone && (
          <Button size="lg" block variant="money" icon="whatsapp" onClick={() => whatsapp(saved.customerPhone, text)}>
            {t('Send bill on WhatsApp')}
          </Button>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Button size="lg" variant="secondary" icon="share" onClick={() => shareText(text)}>
            {t('Share')}
          </Button>
          <Button size="lg" variant="secondary" icon="printer" disabled={!bill} onClick={() => bill && window.open(`/b/${bill.token}?print=1`, '_blank')}>
            {t('Print')}
          </Button>
        </div>
        {bill?.customerId && has('photos') && (
          <>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => uploadPhoto(e.target.files?.[0])} />
            <Button size="lg" block variant="secondary" icon="camera" loading={photoBusy} disabled={photoDone} onClick={() => fileRef.current?.click()}>
              {photoDone ? t('Cut photo saved') : t('Save photo of this cut')}
            </Button>
          </>
        )}
        {!bill && <Notice tone="warn" icon="offline">{t('You can keep billing. Bills upload when the internet is back.')}</Notice>}
        <Button size="xl" block icon="plus" onClick={onNew}>
          {t('New bill')}
        </Button>
        <Button size="lg" block variant="ghost" onClick={() => navigate(`/${app}`)}>
          {t('Go to home')}
        </Button>
      </div>
    </Screen>
  );
}

function Line({ label, value, due }: { label: string; value: string; due?: boolean }) {
  return (
    <div className={`flex justify-between ${due ? 'font-bold text-due' : ''}`}>
      <span className={due ? '' : 'text-muted'}>{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
