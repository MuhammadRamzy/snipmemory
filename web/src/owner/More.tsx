import { useNavigate } from 'react-router';
import { I } from '../components/icons';
import { Badge, IconTile, List, Row, Screen, Section } from '../components/ui';
import { date } from '../lib/format';
import { t } from '../lib/i18n';
import { useSession } from '../lib/session';

export default function More() {
  const { me, has, isOwner, logout } = useSession();
  const navigate = useNavigate();
  const lock = (cap: Parameters<typeof has>[0]) => (has(cap) ? undefined : <Badge tone="brand">{t('Upgrade')}</Badge>);
  const plan = me.shop.trial ? t('{plan} trial till {date}', { plan: me.plan.name, date: date(me.shop.planExpiresAt) }) : me.plan.id === 'free' ? t('Free plan') : t('{plan} till {date}', { plan: me.plan.name, date: date(me.shop.planExpiresAt) });

  return (
    <Screen title={t('More')}>
      <List>
        <Row left={<IconTile icon="star" />} title={t('Plan & payment')} sub={plan} to="/owner/plan" />
      </List>
      <Section title={t('Daily work')}>
        <List>
          <Row left={<IconTile icon="users" />} title={t('Staff, salary & commission')} to="/owner/staff" />
          <Row left={<IconTile icon="ticket" />} title={t('Token queue & appointments')} right={lock('queue')} to="/owner/queue" />
          <Row left={<IconTile icon="wallet2" tone="due" />} title={t('Expenses (kharcha)')} to="/owner/expenses" />
          <Row left={<IconTile icon="cash" tone="money" />} title={t('Cash closing (galla)')} right={lock('closing')} to="/owner/closing" />
        </List>
      </Section>
      <Section title={t('Shop')}>
        <List>
          <Row left={<IconTile icon="scissors" />} title={t('Services & prices')} to="/owner/services" />
          <Row left={<IconTile icon="box" />} title={t('Products & stock')} to="/owner/products" />
          <Row left={<IconTile icon="chart" />} title={t('Reports & profit')} to="/owner/reports" />
          <Row left={<IconTile icon="settings" tone="muted" />} title={t('Shop settings, UPI & GST')} to="/owner/settings" />
        </List>
      </Section>
      <Section title={t('Account')}>
        <List>
          <Row left={<IconTile icon="help" tone="muted" />} title={t('Help & support')} to="/owner/help" />
          <Row left={<IconTile icon="language" tone="muted" />} title={t('Language')} sub={t('English · Hindi & regional languages coming soon')} chevron={false} />
          {isOwner && <Row left={<IconTile icon="lock" tone="muted" />} title={t('Change PIN')} to="/owner/pin" />}
          <Row
            left={<IconTile icon="logout" tone="danger" />}
            title={t('Logout')}
            danger
            chevron={false}
            onClick={async () => {
              await logout();
              navigate('/owner');
            }}
          />
        </List>
      </Section>
      <p className="mt-8 flex items-center justify-center gap-1 text-sm text-muted">
        <I.scissors size={16} /> SnipMemory · {me.user?.phone}
      </p>
    </Screen>
  );
}
