import type { Env } from '../env';
import type { ClientRow, SalonRow } from '../types';
import { DAY, all, first, now, run } from './db';
import { consumeCredit, refundCredit, reminderTemplate, sendMessage } from './messaging';

export const DEFAULT_REMINDER_TEMPLATE =
  "Hi {first_name}, it's been {days} days since your last {service} at {salon}. Ready for a fresh one? {booking_link}";

const MIN_CADENCE = 7;
const MAX_CADENCE = 120;

/**
 * Smart return cycle: once a client has a few visits we learn their real rhythm
 * (median gap of the last 5 intervals); until then the per-client override or the
 * salon default applies.
 */
export function cadenceDays(visitTimes: number[], override: number | null, salonDefault: number): number {
  if (override) return override;
  const sorted = [...visitTimes].sort((a, b) => a - b).slice(-6);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const days = (sorted[i] - sorted[i - 1]) / DAY;
    if (days >= 3) gaps.push(days); // ignore same-week touch-ups
  }
  if (gaps.length < 2) return salonDefault;
  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  const median = gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;
  return Math.round(Math.min(MAX_CADENCE, Math.max(MIN_CADENCE, median)));
}

/** Recomputes visit stats and the next reminder date for a client. Call after any visit change. */
export async function refreshClientSchedule(db: D1Database, clientId: string): Promise<void> {
  const client = await first<ClientRow>(db, 'SELECT * FROM clients WHERE id = ?', clientId);
  if (!client) return;
  const salon = await first<SalonRow>(db, 'SELECT * FROM salons WHERE id = ?', client.salon_id);
  if (!salon) return;
  const visits = await all<{ created_at: number; price: number | null }>(
    db,
    'SELECT created_at, price FROM visits WHERE client_id = ? AND deleted_at IS NULL ORDER BY created_at',
    clientId,
  );
  const last = visits.at(-1)?.created_at ?? null;
  const cadence = cadenceDays(visits.map((v) => v.created_at), client.cadence_days, salon.default_cadence_days);
  await run(
    db,
    `UPDATE clients SET visit_count = ?, total_spend = ?, last_visit_at = ?, next_reminder_at = ?, updated_at = ? WHERE id = ?`,
    visits.length,
    visits.reduce((sum, v) => sum + (v.price ?? 0), 0),
    last,
    last ? last + cadence * DAY : null,
    now(),
    clientId,
  );
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export interface ReminderVars {
  clientName: string;
  salonName: string;
  days: number;
  service: string;
  bookingLink: string;
}

export function renderReminder(template: string | null, vars: ReminderVars): string {
  const values: Record<string, string> = {
    first_name: firstName(vars.clientName),
    name: vars.clientName,
    salon: vars.salonName,
    days: String(vars.days),
    service: vars.service.toLowerCase(),
    booking_link: vars.bookingLink,
  };
  return (template || DEFAULT_REMINDER_TEMPLATE).replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

/** Local hour (0-23) in a given IANA time zone. */
export function localHour(timeZone: string, at = now()): number {
  try {
    const hour = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(at);
    return Number(hour) % 24;
  } catch {
    return new Date(at).getUTCHours();
  }
}

export function bookingLink(env: Env, salon: SalonRow): string {
  return salon.booking_url || `${env.APP_URL}/s/${salon.slug}`;
}

export interface DueClient extends ClientRow {
  last_service: string | null;
}

export async function buildReminder(env: Env, salon: SalonRow, client: DueClient) {
  const days = client.last_visit_at ? Math.max(1, Math.round((now() - client.last_visit_at) / DAY)) : salon.default_cadence_days;
  const vars: ReminderVars = {
    clientName: client.name,
    salonName: salon.name,
    days,
    service: client.last_service ?? 'haircut',
    bookingLink: bookingLink(env, salon),
  };
  const optOut = `${env.APP_URL}/u/${client.unsubscribe_token}`;
  const body = `${renderReminder(salon.reminder_template, vars)}\n\nStop reminders: ${optOut}`;
  const wa = reminderTemplate(env);
  return {
    body,
    template: wa
      ? { ...wa, params: [firstName(client.name), salon.name, String(days), vars.bookingLink] }
      : undefined,
  };
}

/** Sends one automated reminder, spending a credit. Returns false when out of credits. */
export async function sendAutomatedReminder(env: Env, salon: SalonRow, client: DueClient): Promise<'sent' | 'failed' | 'no_credits'> {
  if (!(await consumeCredit(env.DB, salon.id))) return 'no_credits';
  const { body, template } = await buildReminder(env, salon, client);
  const result = await sendMessage(env, {
    to: client.phone,
    channel: salon.reminder_channel,
    kind: 'reminder',
    body,
    template,
    salonId: salon.id,
    clientId: client.id,
    credits: 1,
  });
  if (result.status !== 'sent') {
    await refundCredit(env.DB, salon.id);
    return 'failed';
  }
  await run(env.DB, 'UPDATE clients SET last_reminded_at = ?, next_reminder_at = NULL WHERE id = ?', now(), client.id);
  return 'sent';
}

export const DUE_CLIENTS_SQL = `
  SELECT c.*, (SELECT v.service FROM visits v WHERE v.client_id = c.id AND v.deleted_at IS NULL ORDER BY v.created_at DESC LIMIT 1) AS last_service
  FROM clients c
  WHERE c.salon_id = ? AND c.deleted_at IS NULL AND c.opted_out_at IS NULL
    AND c.next_reminder_at IS NOT NULL AND c.next_reminder_at <= ?`;

/** Cron: send due reminders for every salon on a plan with automated reminders. */
export async function dispatchReminders(env: Env, maxPerRun = 500): Promise<{ sent: number; failed: number; skipped: number }> {
  const t = now();
  const salons = await all<SalonRow>(
    env.DB,
    `SELECT s.* FROM salons s JOIN plans p ON p.id = s.plan_id
     WHERE s.deleted_at IS NULL AND s.suspended_at IS NULL AND s.reminders_enabled = 1
       AND p.capabilities LIKE '%automated_reminders%'
       AND (s.message_credits > 0 OR s.bonus_credits > 0)
       AND EXISTS (SELECT 1 FROM clients c WHERE c.salon_id = s.id AND c.deleted_at IS NULL AND c.next_reminder_at <= ?)`,
    t,
  );
  const stats = { sent: 0, failed: 0, skipped: 0 };
  for (const salon of salons) {
    const hour = localHour(salon.timezone, t);
    if (hour < salon.send_window_start || hour >= salon.send_window_end) continue;
    const due = await all<DueClient>(
      env.DB,
      `${DUE_CLIENTS_SQL} AND c.marketing_consent_at IS NOT NULL ORDER BY c.next_reminder_at LIMIT 100`,
      salon.id,
      t,
    );
    for (const client of due) {
      if (stats.sent + stats.failed >= maxPerRun) return stats;
      const outcome = await sendAutomatedReminder(env, salon, client);
      if (outcome === 'no_credits') {
        stats.skipped++;
        break;
      }
      stats[outcome]++;
    }
  }
  return stats;
}
