import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Avatar, Badge, Button, Card, Chips, Empty, ErrorBox, Input, Loading, Notice, Screen, Sheet, cx, useUi } from '../components/ui';
import { api, message } from '../lib/api';
import { useCatalog } from '../lib/catalog';
import { dayLabel, time } from '../lib/format';
import { t } from '../lib/i18n';
import { useSession } from '../lib/session';
import type { QueueItem } from '../lib/types';
import { useApi } from '../lib/useApi';

/** Walk-in tokens: "Token 7, you are next". Also simple appointments for later. */
export default function Queue({ app }: { app: 'owner' | 'staff' }) {
  const { me, has } = useSession();
  const { catalog } = useCatalog(me.shop.id);
  const { toast } = useUi();
  const navigate = useNavigate();
  const { data, error, reload } = useApi<{ day: string; items: QueueItem[]; doneToday: number }>(has('queue') ? '/api/shop/queue' : null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', staffId: '', when: 'now', time: '' });
  const [busy, setBusy] = useState(false);
  const team = catalog?.staff ?? [];
  const nameOf = (id: string | null) => team.find((s) => s.id === id)?.name;

  if (!has('queue')) {
    return (
      <Screen title={t('Token queue')} back={`/${app}`}>
        <Notice tone="brand" icon="ticket" title={t('Queue is part of Starter and above')} action={app === 'owner' && <Button size="sm" onClick={() => navigate('/owner/plan')}>{t('See plans')}</Button>} />
      </Screen>
    );
  }

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      let scheduledAt: number | null = null;
      if (form.when === 'later' && form.time) scheduledAt = new Date(form.time).getTime();
      await api.post('/api/shop/queue', { name: form.name.trim() || t('Walk-in'), phone: form.phone || null, staffId: form.staffId || null, scheduledAt });
      setAdding(false);
      setForm({ name: '', phone: '', staffId: '', when: 'now', time: '' });
      void reload();
    } catch (err) {
      toast(message(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const update = async (item: QueueItem, status: QueueItem['status']) => {
    try {
      await api.patch(`/api/shop/queue/${item.id}`, { status });
      void reload();
    } catch (err) {
      toast(message(err), 'error');
    }
  };

  const today = data?.items.filter((i) => i.day === data.day) ?? [];
  const later = data?.items.filter((i) => i.day !== data.day) ?? [];

  return (
    <Screen title={t('Token queue')} back={`/${app}`} right={<Button size="sm" icon="plus" onClick={() => setAdding(true)}>{t('Add')}</Button>}>
      <ErrorBox error={error} retry={reload} />
      {!data ? (
        <Loading />
      ) : (
        <>
          <p className="mb-3 px-1 font-semibold text-muted">{t('{n} waiting · {done} done today', { n: today.filter((i) => i.status === 'waiting').length, done: data.doneToday })}</p>
          {today.length === 0 ? (
            <Empty icon="ticket" title={t('No one waiting')} action={<Button icon="plus" onClick={() => setAdding(true)}>{t('Add walk-in')}</Button>}>
              {t('Give each walk-in a token so nobody fights about who is next.')}
            </Empty>
          ) : (
            <div className="space-y-3">
              {today.map((item) => (
                <Card key={item.id} className={cx('p-4', item.status === 'serving' && 'border-2 border-brand')}>
                  <div className="flex items-center gap-4">
                    <span className={cx('grid size-16 shrink-0 place-items-center rounded-2xl text-3xl font-extrabold', item.status === 'serving' ? 'bg-brand text-brand-ink' : 'bg-surface-2')}>{item.token}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg font-bold">{item.name}</p>
                      <p className="text-sm text-muted">
                        {item.scheduledAt ? t('Appointment {time}', { time: time(item.scheduledAt) }) : t('Came at {time}', { time: time(item.createdAt) })}
                        {item.staffId && ` · ${nameOf(item.staffId) ?? ''}`}
                      </p>
                      {item.status === 'serving' && <Badge tone="brand">{t('In chair')}</Badge>}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {item.status === 'waiting' ? (
                      <Button size="sm" variant="secondary" onClick={() => update(item, 'serving')}>
                        {t('Start')}
                      </Button>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => update(item, 'waiting')}>
                        {t('Back to wait')}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => navigate(`/${app}/bill?queue=${item.id}&name=${encodeURIComponent(item.name)}${item.phone ? `&phone=${encodeURIComponent(item.phone)}` : ''}`)}
                    >
                      {t('Make bill')}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-danger" onClick={() => update(item, 'cancelled')}>
                      {t('Left')}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
          {later.length > 0 && (
            <>
              <h2 className="mb-2 mt-6 px-1 font-bold text-muted">{t('Upcoming appointments')}</h2>
              <Card className="divide-y divide-line">
                {later.map((i) => (
                  <div key={i.id} className="flex items-center justify-between p-4">
                    <span className="font-semibold">{i.name}</span>
                    <span className="text-sm text-muted">
                      {dayLabel(i.day)} {i.scheduledAt ? time(i.scheduledAt) : ''}
                    </span>
                  </div>
                ))}
              </Card>
            </>
          )}
        </>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title={t('Add to queue')}>
        <form onSubmit={add} className="space-y-4">
          <Input label={t('Name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('Walk-in')} autoFocus />
          <Input label={t('Mobile (optional)')} prefix="+91" type="tel" inputMode="numeric" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          {team.length > 1 && (
            <div>
              <p className="mb-2 font-semibold">{t('Wants a particular barber?')}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setForm({ ...form, staffId: '' })} className={cx('h-11 rounded-full border-2 px-4 font-bold', !form.staffId ? 'border-brand bg-brand-soft' : 'border-line')}>
                  {t('Anyone')}
                </button>
                {team.map((s) => (
                  <button key={s.id} type="button" onClick={() => setForm({ ...form, staffId: s.id })} className={cx('flex h-11 items-center gap-2 rounded-full border-2 pl-1 pr-4 font-bold', form.staffId === s.id ? 'border-brand bg-brand-soft' : 'border-line')}>
                    <Avatar name={s.name} color={s.color} size={32} />
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Chips value={form.when} onChange={(v) => setForm({ ...form, when: v })} options={[{ value: 'now', label: t('Waiting now') }, { value: 'later', label: t('Appointment') }]} />
          {form.when === 'later' && <Input type="datetime-local" label={t('Date & time')} value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />}
          <Button type="submit" size="lg" block loading={busy}>
            {t('Give token')}
          </Button>
        </form>
      </Sheet>
    </Screen>
  );
}
