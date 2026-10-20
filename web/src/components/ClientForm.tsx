import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { useSalon } from '../lib/salon';
import type { Client } from '../lib/types';
import { Button, ErrorText, Input, Textarea, Toggle } from './ui';

/** Create or edit a client. On a duplicate phone the existing client is returned via `onDuplicate`. */
export function ClientForm({
  client,
  initialQuery,
  onSaved,
  onDuplicate,
}: {
  client?: Client;
  initialQuery?: string;
  onSaved: (client: Client) => void;
  onDuplicate?: (client: Client) => void;
}) {
  const { base } = useSalon();
  const looksLikePhone = initialQuery && /\d{3,}/.test(initialQuery);
  const [name, setName] = useState(client?.name ?? (looksLikePhone ? '' : (initialQuery ?? '')));
  const [phone, setPhone] = useState(client?.phone ?? (looksLikePhone ? initialQuery : ''));
  const [email, setEmail] = useState(client?.email ?? '');
  const [notes, setNotes] = useState(client?.notes ?? '');
  const [photoConsent, setPhotoConsent] = useState(client?.photoConsent ?? true);
  const [marketingConsent, setMarketingConsent] = useState(client?.marketingConsent ?? true);
  const [cadence, setCadence] = useState(client?.cadenceDays ? String(client.cadenceDays) : '');
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      name,
      phone,
      email: email || null,
      notes: notes || null,
      photoConsent,
      marketingConsent,
      cadenceDays: cadence ? Number(cadence) : null,
    };
    try {
      const res = client
        ? await api.patch<{ client: Client }>(`${base}/clients/${client.id}`, payload)
        : await api.post<{ client: Client }>(`${base}/clients`, payload);
      onSaved(res.client);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'client_exists' && onDuplicate) {
        onDuplicate((err.data as { client: Client }).client);
        return;
      }
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus={!looksLikePhone} autoComplete="off" />
      <Input
        label="Mobile number"
        type="tel"
        inputMode="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        required
        autoFocus={Boolean(looksLikePhone)}
        hint="Used to find them next time and for WhatsApp reminders."
      />
      {client && <Input label="Email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
      <Textarea label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Sensitive scalp, crown cowlick, prefers quiet appointments…" rows={2} />
      {client && (
        <Input
          label="Return cycle (days)"
          type="number"
          min={7}
          max={180}
          value={cadence}
          onChange={(e) => setCadence(e.target.value)}
          placeholder="Automatic"
          hint="Leave empty to learn it from their visits."
        />
      )}
      <div className="space-y-3 rounded-xl bg-surface-2 p-3">
        <Toggle checked={photoConsent} onChange={setPhotoConsent} label="Client agrees to haircut photos" description="Photos are private to your salon and the client." />
        <Toggle checked={marketingConsent} onChange={setMarketingConsent} label="Client agrees to rebooking reminders" description="They can stop them any time with one tap." />
      </div>
      <ErrorText error={error} />
      <Button type="submit" className="w-full" size="lg" loading={saving}>
        {client ? 'Save changes' : 'Add client'}
      </Button>
    </form>
  );
}
