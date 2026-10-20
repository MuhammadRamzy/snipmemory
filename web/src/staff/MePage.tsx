import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Avatar, ErrorBox, IconTile, List, Loading, Row, Screen, Section } from '../components/ui';
import { dayKey, phoneDisplay } from '../lib/format';
import { t } from '../lib/i18n';
import { useSession } from '../lib/session';
import { useApi } from '../lib/useApi';
import { PayrollCard, type Summary } from '../owner/StaffDetail';

export default function MePage() {
  const { me, has, logout } = useSession();
  const navigate = useNavigate();
  const [month, setMonth] = useState(dayKey().slice(0, 7));
  const { data, error, reload } = useApi<{ summary: Summary }>(`/api/shop/me/summary?month=${month}`);
  return (
    <Screen title={t('Me')}>
      <div className="mb-5 flex items-center gap-4">
        <Avatar name={me.me.name} color={me.me.color} size={60} />
        <div>
          <p className="text-xl font-extrabold">{me.me.name}</p>
          <p className="text-muted">
            {me.shop.name} · {phoneDisplay(me.user?.phone)}
          </p>
        </div>
      </div>
      <ErrorBox error={error} retry={reload} />
      {!data ? <Loading /> : <PayrollCard s={data.summary} month={month} setMonth={setMonth} showCommission={has('commission')} />}
      {data && data.summary.txns.length > 0 && (
        <Section title={t('Money received from owner')}>
          <List>
            {data.summary.txns.map((x) => (
              <Row key={x.id} title={x.kind === 'advance' ? t('Advance') : x.kind === 'payout' ? t('Salary paid') : x.kind === 'bonus' ? t('Bonus') : t('Deduction')} sub={x.day} right={<span className="font-bold">₹{(x.amount / 100).toLocaleString('en-IN')}</span>} chevron={false} />
            ))}
          </List>
        </Section>
      )}
      <Section title={t('Account')}>
        <List>
          <Row left={<IconTile icon="lock" tone="muted" />} title={t('Change PIN')} to="/staff/pin" />
          <Row left={<IconTile icon="help" tone="muted" />} title={t('Help')} to="/staff/help" />
          <Row
            left={<IconTile icon="logout" tone="danger" />}
            title={t('Logout')}
            danger
            chevron={false}
            onClick={async () => {
              await logout();
              navigate('/staff');
            }}
          />
        </List>
      </Section>
    </Screen>
  );
}
