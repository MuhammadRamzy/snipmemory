import { useParams } from 'react-router';
import { Button, Card, ErrorBox, Loading, Notice, Screen, useUi } from '../components/ui';
import { api, message } from '../lib/api';
import { dateTime, phoneDisplay, rs } from '../lib/format';
import { t } from '../lib/i18n';
import { receiptText } from '../lib/receipt';
import { useSession } from '../lib/session';
import { shareText, whatsapp } from '../lib/share';
import type { Bill } from '../lib/types';
import { useApi } from '../lib/useApi';

export default function BillDetail({ app }: { app: 'owner' | 'staff' }) {
  const { id } = useParams();
  const { me, isManager } = useSession();
  const { ask, toast } = useUi();
  const { data, error, reload } = useApi<{ bill: Bill }>(`/api/shop/bills/${id}`);
  if (error) return <Screen title={t('Bill')} back={`/${app}/bills`}><ErrorBox error={error} retry={reload} /></Screen>;
  if (!data) return <Loading />;
  const b = data.bill;
  const number = `${me.shop.billPrefix}${b.billNo}`;
  const link = `${window.location.origin}/b/${b.token}`;
  const text = receiptText(
    me.shop,
    { number, lines: b.items, total: b.total, paid: { cash: b.paidCash, upi: b.paidUpi, card: b.paidCard, advance: b.paidAdvance }, due: b.due, link },
    b.customerName,
  );
  const canCancel = !b.voided && (isManager || (b.staffId === me.me.id && Date.now() - b.createdAt < 15 * 60_000));

  const cancel = async () => {
    const reason = await ask({ title: t('Cancel bill #{n}?', { n: number }), body: t('Udhaar, advance and stock will be reversed.'), input: { label: t('Reason'), placeholder: t('e.g. wrong entry'), required: true }, confirm: t('Cancel bill'), cancel: t('Keep'), danger: true });
    if (typeof reason !== 'string' || !reason) return;
    try {
      await api.post(`/api/shop/bills/${b.id}/void`, { reason });
      toast(t('Bill cancelled'));
      void reload();
    } catch (err) {
      toast(message(err), 'error');
    }
  };

  return (
    <Screen title={t('Bill #{n}', { n: number })} back={`/${app}/bills?day=${b.day}`}>
      {b.voided && (
        <div className="mb-4">
          <Notice tone="danger" icon="x" title={t('Cancelled')}>{b.voidReason}</Notice>
        </div>
      )}
      <Card className="p-5">
        <p className="text-sm text-muted">{dateTime(b.createdAt)} · {b.staffName}</p>
        {(b.customerName || b.customerPhone) && (
          <p className="mt-1 font-bold">
            {b.customerName || t('Customer')} {b.customerPhone && <span className="font-normal text-muted">· {phoneDisplay(b.customerPhone)}</span>}
          </p>
        )}
        <div className="mt-4 space-y-2">
          {b.items.map((i) => (
            <div key={i.id} className="flex justify-between gap-3 text-[17px]">
              <span>
                {i.name}
                {i.qty > 1 && <span className="text-muted"> × {i.qty}</span>}
              </span>
              <span className="font-semibold tabular-nums">{rs(i.amount)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-1 border-t border-line pt-3">
          {b.discount > 0 && <Row label={t('Discount')} value={`− ${rs(b.discount)}`} />}
          {b.tax > 0 && <Row label={t('GST')} value={rs(b.tax)} />}
          <div className="flex items-end justify-between pt-1">
            <span className="text-lg font-bold">{t('Total')}</span>
            <span className="text-3xl font-extrabold tabular-nums">{rs(b.total)}</span>
          </div>
          {b.paidUpi > 0 && <Row label="UPI" value={rs(b.paidUpi)} />}
          {b.paidCash > 0 && <Row label={t('Cash')} value={rs(b.paidCash)} />}
          {b.paidCard > 0 && <Row label={t('Card')} value={rs(b.paidCard)} />}
          {b.paidAdvance > 0 && <Row label={t('From advance')} value={rs(b.paidAdvance)} />}
          {b.due > 0 && <Row label={t('Udhaar')} value={rs(b.due)} due />}
        </div>
        {app === 'owner' && b.items.some((i) => i.commission > 0) && (
          <p className="mt-3 text-sm text-muted">{t('Staff commission on this bill: {amount}', { amount: rs(b.items.reduce((s, i) => s + i.commission, 0)) })}</p>
        )}
      </Card>
      <div className="mt-5 space-y-3">
        {b.customerPhone && !b.customerPhone.includes('•') && (
          <Button size="lg" block variant="money" icon="whatsapp" onClick={() => whatsapp(b.customerPhone, text)}>
            {t('Send on WhatsApp')}
          </Button>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Button size="lg" variant="secondary" icon="share" onClick={() => shareText(text)}>
            {t('Share')}
          </Button>
          <Button size="lg" variant="secondary" icon="printer" onClick={() => window.open(`/b/${b.token}?print=1`, '_blank')}>
            {t('Print')}
          </Button>
        </div>
        {canCancel && (
          <Button size="lg" block variant="ghost" className="text-danger" icon="x" onClick={cancel}>
            {t('Cancel this bill')}
          </Button>
        )}
      </div>
    </Screen>
  );
}

function Row({ label, value, due }: { label: string; value: string; due?: boolean }) {
  return (
    <div className={`flex justify-between ${due ? 'font-bold text-due' : ''}`}>
      <span className={due ? '' : 'text-muted'}>{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
