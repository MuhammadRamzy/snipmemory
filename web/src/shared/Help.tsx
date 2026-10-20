import { Card, List, Row, Screen } from '../components/ui';
import { IconTile } from '../components/ui';
import { t } from '../lib/i18n';
import { useSession } from '../lib/session';
import { whatsapp } from '../lib/share';

const FAQ: [string, string][] = [
  ['How does the customer pay by UPI?', 'Tap UPI / QR on the bill. The customer scans the QR with any UPI app — the amount is already filled. When your phone or soundbox shows the money, tap “Money received”.'],
  ['Does SnipMemory take a cut of my UPI money?', 'No. The money goes straight from the customer to your own UPI ID. We never touch it.'],
  ['What if the internet is down?', 'Keep billing. Bills are saved on the phone and upload automatically when the internet is back.'],
  ['How do I give udhaar?', 'Add the customer’s mobile number, then choose “Part pay / Udhaar”. Collect it later from Customers → Udhaar.'],
  ['A barber forgot their PIN', 'Owner app → More → Staff → tap the barber → Reset PIN.'],
  ['Do I need a printer?', 'No. Send the bill on WhatsApp. If you have a printer, the Print button makes a small receipt.'],
];

export default function Help({ app }: { app: 'owner' | 'staff' }) {
  const { me } = useSession();
  return (
    <Screen title={t('Help')} back={app === 'owner' ? '/owner/more' : '/staff/me'}>
      <Card className="p-5 text-center">
        <p className="text-lg font-bold">{t('Need help? Chat with us')}</p>
        <p className="text-muted">{t('Hindi, English, Malayalam, Tamil')}</p>
        <button
          onClick={() => whatsapp(me.support.whatsapp, t('Hi SnipMemory, I need help. Shop: {shop}, Phone: {phone}', { shop: me.shop.name, phone: me.user?.phone ?? '' }))}
          className="mx-auto mt-4 flex h-14 items-center justify-center gap-2 rounded-2xl bg-money px-6 text-lg font-bold text-white"
        >
          {t('WhatsApp support')}
        </button>
      </Card>
      <h2 className="mb-2 mt-6 px-1 font-bold text-muted">{t('Common questions')}</h2>
      <div className="space-y-3">
        {FAQ.map(([q, a]) => (
          <details key={q} className="rounded-3xl border border-line bg-surface p-4">
            <summary className="cursor-pointer list-none text-[17px] font-bold">{t(q)}</summary>
            <p className="mt-2 text-muted">{t(a)}</p>
          </details>
        ))}
      </div>
      {app === 'owner' && (
        <div className="mt-6">
          <List>
            <Row left={<IconTile icon="scissors" />} title={t('Staff app link')} sub={`${window.location.origin}/staff`} onClick={() => whatsapp(null, `${window.location.origin}/staff`)} />
          </List>
        </div>
      )}
    </Screen>
  );
}
