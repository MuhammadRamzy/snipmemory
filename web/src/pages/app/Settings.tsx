import { useEffect, useState, type FormEvent } from 'react';
import { Button, Card, CardHeader, Input, PageHeader, Select, Textarea, Toggle } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useSalon } from '../../lib/salon';
import type { Salon } from '../../lib/types';

const TIMEZONES = (() => {
  try {
    return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('timeZone');
  } catch {
    return ['UTC', 'Asia/Kolkata', 'Asia/Dubai', 'Europe/London', 'America/New_York', 'America/Los_Angeles'];
  }
})();

const hours = Array.from({ length: 25 }, (_, h) => h);

function useSaver() {
  const [state, setState] = useState<{ saving: boolean; message: string | null; error: string | null }>({ saving: false, message: null, error: null });
  const run = async (fn: () => Promise<unknown>, message = 'Saved') => {
    setState({ saving: true, message: null, error: null });
    try {
      await fn();
      setState({ saving: false, message, error: null });
    } catch (err) {
      setState({ saving: false, message: null, error: errorMessage(err) });
    }
  };
  return { ...state, run };
}

function Status({ message, error }: { message: string | null; error: string | null }) {
  if (error) return <span className="text-sm text-danger">{error}</span>;
  if (message) return <span className="text-sm text-success">{message}</span>;
  return null;
}

export default function Settings() {
  const { salon, base, reload } = useSalon();
  const [form, setForm] = useState<Salon>(salon);
  const [preview, setPreview] = useState('');
  const profile = useSaver();
  const reminders = useSaver();
  const password = useSaver();
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });

  useEffect(() => setForm(salon), [salon]);
  useEffect(() => {
    const t = setTimeout(() => {
      api.post<{ message: string }>(`${base}/reminders/preview`, { template: form.reminderTemplate || null }).then((r) => setPreview(r.message)).catch(() => undefined);
    }, 300);
    return () => clearTimeout(t);
  }, [form.reminderTemplate, base]);

  const set = <K extends keyof Salon>(key: K, value: Salon[K]) => setForm((f) => ({ ...f, [key]: value }));

  const saveProfile = (e: FormEvent) => {
    e.preventDefault();
    void profile.run(async () => {
      await api.patch(base, {
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        city: form.city || null,
        timezone: form.timezone,
        bookingUrl: form.bookingUrl || null,
        brandColor: form.brandColor,
      });
      await reload();
    });
  };

  const saveReminders = (e: FormEvent) => {
    e.preventDefault();
    void reminders.run(async () => {
      await api.patch(base, {
        remindersEnabled: form.remindersEnabled,
        reminderChannel: form.reminderChannel,
        reminderTemplate: form.reminderTemplate || null,
        defaultCadenceDays: Number(form.defaultCadenceDays),
        sendWindowStart: Number(form.sendWindowStart),
        sendWindowEnd: Number(form.sendWindowEnd),
      });
      await reload();
    });
  };

  const referral = salon.referralCode ? `${window.location.origin}/signup?ref=${salon.referralCode}` : null;

  return (
    <div className="animate-in space-y-6">
      <PageHeader title="Settings" />

      <Card>
        <CardHeader title="Salon profile" description="Shown on your public page and in client messages." />
        <form onSubmit={saveProfile} className="grid gap-4 p-5 sm:grid-cols-2">
          <Input label="Salon name" value={form.name} onChange={(e) => set('name', e.target.value)} required />
          <Input label="Phone" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
          <Input label="Email" type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
          <Input label="City" value={form.city ?? ''} onChange={(e) => set('city', e.target.value)} />
          <div className="sm:col-span-2">
            <Input label="Address" value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} />
          </div>
          <Input
            label="Booking link"
            type="url"
            placeholder="https://booksy.com/… or your WhatsApp link"
            value={form.bookingUrl ?? ''}
            onChange={(e) => set('bookingUrl', e.target.value)}
            hint="Where reminders send clients. Leave empty to use your SnipMemory page."
          />
          <Select label="Time zone" value={form.timezone} onChange={(e) => set('timezone', e.target.value)}>
            {TIMEZONES.map((tz) => (
              <option key={tz}>{tz}</option>
            ))}
          </Select>
          <label className="flex items-center gap-3 text-sm font-medium">
            <input type="color" value={form.brandColor} onChange={(e) => set('brandColor', e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-surface" />
            Brand colour
          </label>
          <div className="flex items-center justify-end gap-3 sm:col-span-2">
            <Status message={profile.message} error={profile.error} />
            <Button type="submit" loading={profile.saving}>
              Save profile
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <div id="reminders" />
        <CardHeader title="Rebooking reminders" description="Sent when a client passes their usual return date. SnipMemory learns each client's rhythm after 3 visits." />
        <form onSubmit={saveReminders} className="space-y-5 p-5">
          <Toggle checked={form.remindersEnabled} onChange={(v) => set('remindersEnabled', v)} label="Send automatic reminders" description="Only to clients who agreed. Everyone else stays in your one-tap WhatsApp list." />
          <div className="grid gap-4 sm:grid-cols-3">
            <Select label="Channel" value={form.reminderChannel} onChange={(e) => set('reminderChannel', e.target.value as Salon['reminderChannel'])}>
              <option value="whatsapp">WhatsApp (SMS fallback)</option>
              <option value="sms">SMS</option>
            </Select>
            <Input
              label="Default return cycle (days)"
              type="number"
              min={7}
              max={180}
              value={form.defaultCadenceDays}
              onChange={(e) => set('defaultCadenceDays', Number(e.target.value))}
            />
            <div className="grid grid-cols-2 gap-2">
              <Select label="Send from" value={form.sendWindowStart} onChange={(e) => set('sendWindowStart', Number(e.target.value))}>
                {hours.slice(0, 24).map((h) => (
                  <option key={h} value={h}>{`${h}:00`}</option>
                ))}
              </Select>
              <Select label="until" value={form.sendWindowEnd} onChange={(e) => set('sendWindowEnd', Number(e.target.value))}>
                {hours.slice(1).map((h) => (
                  <option key={h} value={h}>{`${h}:00`}</option>
                ))}
              </Select>
            </div>
          </div>
          <Textarea
            label="Message"
            value={form.reminderTemplate ?? ''}
            onChange={(e) => set('reminderTemplate', e.target.value)}
            placeholder="Hi {first_name}, it's been {days} days since your last {service} at {salon}. Ready for a fresh one? {booking_link}"
            hint="Variables: {first_name} {name} {days} {service} {salon} {booking_link}. An opt-out link is always added."
            rows={3}
          />
          {preview && (
            <div className="max-w-md rounded-2xl rounded-bl-sm bg-success-soft p-3 text-sm">
              <p className="mb-1 text-xs font-semibold text-success">Preview</p>
              {preview}
            </div>
          )}
          <div className="flex items-center justify-end gap-3">
            <Status message={reminders.message} error={reminders.error} />
            <Button type="submit" loading={reminders.saving}>
              Save reminders
            </Button>
          </div>
        </form>
      </Card>

      {referral && (
        <Card>
          <CardHeader title="Refer a salon, get 250 free reminders" description="When a salon you refer starts a paid plan, you both get 250 reminder credits." />
          <div className="flex flex-col gap-2 p-5 sm:flex-row">
            <Input readOnly value={referral} onFocus={(e) => e.currentTarget.select()} />
            <Button variant="secondary" onClick={() => navigator.clipboard?.writeText(referral)}>
              Copy link
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Your password" />
        <form
          className="grid gap-4 p-5 sm:grid-cols-3 sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void password.run(async () => {
              await api.post('/api/auth/password', pw);
              setPw({ currentPassword: '', newPassword: '' });
            }, 'Password changed. Other devices were signed out.');
          }}
        >
          <Input label="Current password" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required />
          <Input label="New password" type="password" autoComplete="new-password" minLength={8} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required />
          <Button type="submit" loading={password.saving}>
            Change password
          </Button>
          <div className="sm:col-span-3">
            <Status message={password.message} error={password.error} />
          </div>
        </form>
      </Card>
    </div>
  );
}
