import { Link } from 'react-router';
import { I } from '../components/icons';
import { Avatar, Button, Card, ErrorBox, Loading, Notice, useUi } from '../components/ui';
import { api, message } from '../lib/api';
import { rs, time } from '../lib/format';
import { t } from '../lib/i18n';
import { useSession } from '../lib/session';
import { useApi } from '../lib/useApi';
import { InstallTip } from '../shared/InstallTip';

interface StaffHomeData {
  today: { bills: number; sales: number; commission: number | null; services: number };
  month: { bills: number; sales: number; commission: number | null };
  attendance: { inAt: number; outAt: number | null } | null;
  attendanceEnabled: boolean;
  queueWaiting: number;
}

export default function StaffHome() {
  const { me } = useSession();
  const { toast } = useUi();
  const { data, error, reload } = useApi<StaffHomeData>('/api/shop/me/home');

  const mark = async (action: 'in' | 'out') => {
    try {
      await api.post('/api/shop/me/attendance', { action });
      toast(action === 'in' ? t('Work started. Have a good day!') : t('See you tomorrow!'));
      void reload();
    } catch (err) {
      toast(message(err), 'error');
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 pb-32">
      <header className="pt-safe flex items-center gap-3 py-5">
        <Avatar name={me.me.name} color={me.me.color} size={52} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-muted">{me.shop.name}</p>
          <p className="truncate text-2xl font-extrabold">{t('Hi {name}', { name: me.me.name.split(' ')[0] })}</p>
        </div>
      </header>
      <ErrorBox error={error} retry={reload} />
      {!data && !error && <Loading />}
      {data && (
        <div className="rise space-y-4">
          {data.attendanceEnabled && (
            <Card className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-bold">{data.attendance ? (data.attendance.outAt ? t('Day finished') : t('At work')) : t('Not started')}</p>
                <p className="text-sm text-muted">
                  {data.attendance ? `${t('In')} ${time(data.attendance.inAt)}${data.attendance.outAt ? ` · ${t('Out')} ${time(data.attendance.outAt)}` : ''}` : t('Tap when you reach the shop')}
                </p>
              </div>
              {!data.attendance || data.attendance.outAt ? (
                <Button variant="money" onClick={() => mark('in')}>{t('Start work')}</Button>
              ) : (
                <Button variant="secondary" onClick={() => mark('out')}>{t('End work')}</Button>
              )}
            </Card>
          )}

          <Card className="overflow-hidden">
            <div className="bg-brand p-5 text-brand-ink">
              <p className="font-semibold opacity-85">{t('My work today')}</p>
              <p className="text-5xl font-extrabold tabular-nums">{rs(data.today.sales)}</p>
              <p className="opacity-85">{t('{n} bills · {c} services', { n: data.today.bills, c: data.today.services })}</p>
            </div>
            {data.today.commission !== null && (
              <div className="flex items-center justify-between p-4">
                <span className="font-semibold text-muted">{t('My earning today')}</span>
                <span className="text-2xl font-extrabold text-money tabular-nums">{rs(data.today.commission)}</span>
              </div>
            )}
          </Card>

          <Link to="/staff/bill" className="flex h-24 items-center justify-center gap-3 rounded-3xl bg-brand text-2xl font-extrabold text-brand-ink shadow-lg active:scale-[0.98]">
            <I.plus size={34} strokeWidth={2.6} /> {t('New bill')}
          </Link>

          {data.queueWaiting > 0 && (
            <Link to="/staff/queue">
              <Notice tone="warn" icon="ticket" title={t('{n} customers waiting', { n: data.queueWaiting })}>{t('Tap to see the queue')}</Notice>
            </Link>
          )}

          <Card className="p-4">
            <p className="font-semibold text-muted">{t('This month')}</p>
            <div className="mt-1 flex items-end justify-between">
              <span className="text-2xl font-extrabold tabular-nums">{rs(data.month.sales)}</span>
              <span className="text-muted">{t('{n} bills', { n: data.month.bills })}</span>
            </div>
            {data.month.commission !== null && (
              <Link to="/staff/me" className="mt-2 flex items-center justify-between rounded-2xl bg-money-soft p-3 font-bold text-money">
                {t('My earning {amount}', { amount: rs(data.month.commission) })}
                <I.right />
              </Link>
            )}
          </Card>
          <InstallTip appName={t('Staff app')} />
        </div>
      )}
    </div>
  );
}
