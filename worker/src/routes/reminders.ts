import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv, ClientRow } from '../types';
import { DAY, all, first, now, run } from '../lib/db';
import { ApiError, badRequest, body, notFound } from '../lib/http';
import { newId } from '../lib/crypto';
import { capabilities, getPlan, requireCapability } from '../lib/plans';
import { DUE_CLIENTS_SQL, buildReminder, renderReminder, sendAutomatedReminder, type DueClient } from '../lib/reminders';
import { serializeClient } from '../lib/serialize';
import { salonAccess } from '../lib/session';

const reminders = new Hono<AppEnv>();

/** wa.me click-to-chat link — free for every plan, sent from the salon's own WhatsApp. */
function whatsappLink(phone: string, text: string) {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}

reminders.get('/', salonAccess('floor'), async (c) => {
  const { salon } = c.get('access');
  const db = c.env.DB;
  const t = now();
  const plan = await getPlan(db, salon.plan_id);
  const due = await all<DueClient>(db, `${DUE_CLIENTS_SQL} ORDER BY c.next_reminder_at LIMIT 200`, salon.id, t);
  const upcoming = await all<DueClient>(
    db,
    `SELECT c.*, NULL AS last_service FROM clients c WHERE c.salon_id = ? AND c.deleted_at IS NULL AND c.opted_out_at IS NULL
       AND c.next_reminder_at > ? AND c.next_reminder_at <= ? ORDER BY c.next_reminder_at LIMIT 50`,
    salon.id,
    t,
    t + 7 * DAY,
  );
  const history = await all<{ id: string; client_id: string; client_name: string; channel: string; status: string; provider: string; error: string | null; created_at: number; recovered: number }>(
    db,
    `SELECT m.id, m.client_id, c.name AS client_name, m.channel, m.status, m.provider, m.error, m.created_at,
       EXISTS (SELECT 1 FROM visits v WHERE v.recovered_by_message_id = m.id) AS recovered
     FROM messages m JOIN clients c ON c.id = m.client_id
     WHERE m.salon_id = ? AND m.kind = 'reminder' ORDER BY m.created_at DESC LIMIT 50`,
    salon.id,
  );
  const items = await Promise.all(
    due.map(async (client) => {
      const { body: text } = await buildReminder(c.env, salon, client);
      return {
        client: serializeClient(client),
        lastService: client.last_service,
        message: text,
        whatsappUrl: whatsappLink(client.phone, text),
        autoEligible: Boolean(client.marketing_consent_at),
      };
    }),
  );
  return c.json({
    automated: capabilities(plan).includes('automated_reminders'),
    enabled: Boolean(salon.reminders_enabled),
    credits: { monthly: salon.message_credits, bonus: salon.bonus_credits },
    template: salon.reminder_template,
    due: items,
    upcoming: upcoming.map((u) => serializeClient(u)),
    history: history.map((h) => ({
      id: h.id,
      clientId: h.client_id,
      clientName: h.client_name,
      channel: h.channel,
      status: h.status,
      manual: h.provider === 'manual',
      error: h.error,
      recovered: Boolean(h.recovered),
      createdAt: h.created_at,
    })),
  });
});

reminders.post('/preview', salonAccess('floor'), async (c) => {
  const input = await body(c, z.object({ template: z.string().max(600).nullable() }));
  const { salon } = c.get('access');
  return c.json({
    message: renderReminder(input.template, {
      clientName: 'Alex Morgan',
      salonName: salon.name,
      days: salon.default_cadence_days,
      service: 'Skin fade',
      bookingLink: salon.booking_url || `${c.env.APP_URL}/s/${salon.slug}`,
    }),
  });
});

async function loadDueClient(db: D1Database, salonId: string, clientId: string): Promise<DueClient> {
  const client = await first<DueClient>(
    db,
    `SELECT c.*, (SELECT v.service FROM visits v WHERE v.client_id = c.id AND v.deleted_at IS NULL ORDER BY v.created_at DESC LIMIT 1) AS last_service
     FROM clients c WHERE c.id = ? AND c.salon_id = ? AND c.deleted_at IS NULL`,
    clientId,
    salonId,
  );
  if (!client) throw notFound('Client');
  if (client.opted_out_at) throw badRequest('This client has opted out of reminders.');
  return client;
}

/** Send an automated reminder right now (uses one message credit). */
reminders.post('/:clientId/send', salonAccess('floor'), async (c) => {
  const { salon } = c.get('access');
  await requireCapability(c.env.DB, salon, 'automated_reminders');
  const client = await loadDueClient(c.env.DB, salon.id, c.req.param('clientId'));
  if (!client.marketing_consent_at) {
    throw new ApiError(403, 'consent_required', 'This client has not agreed to receive reminders. Use WhatsApp click-to-send instead.');
  }
  const outcome = await sendAutomatedReminder(c.env, salon, client);
  if (outcome === 'no_credits') throw new ApiError(402, 'no_credits', 'You are out of message credits. Top up in Billing.');
  if (outcome === 'failed') throw new ApiError(502, 'send_failed', 'The message could not be delivered. Check the number.');
  return c.json({ ok: true });
});

/** Record a reminder the stylist sent themselves via WhatsApp (free, keeps attribution working). */
reminders.post('/:clientId/manual', salonAccess('floor'), async (c) => {
  const { salon } = c.get('access');
  const client = await loadDueClient(c.env.DB, salon.id, c.req.param('clientId'));
  const { body: text } = await buildReminder(c.env, salon, client);
  const t = now();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO messages (id, salon_id, client_id, channel, kind, to_phone, body, status, provider, credits, created_at)
       VALUES (?, ?, ?, 'whatsapp', 'reminder', ?, ?, 'sent', 'manual', 0, ?)`,
    ).bind(newId('msg'), salon.id, client.id, client.phone, text, t),
    c.env.DB.prepare('UPDATE clients SET last_reminded_at = ?, next_reminder_at = NULL WHERE id = ?').bind(t, client.id),
  ]);
  return c.json({ ok: true, whatsappUrl: whatsappLink(client.phone, text) });
});

reminders.post('/:clientId/snooze', salonAccess('floor'), async (c) => {
  const input = await body(c, z.object({ days: z.number().int().min(1).max(90) }));
  const { salon } = c.get('access');
  const client = await first<ClientRow>(c.env.DB, 'SELECT * FROM clients WHERE id = ? AND salon_id = ? AND deleted_at IS NULL', c.req.param('clientId'), salon.id);
  if (!client) throw notFound('Client');
  await run(c.env.DB, 'UPDATE clients SET next_reminder_at = ? WHERE id = ?', now() + input.days * DAY, client.id);
  return c.json({ ok: true });
});

export default reminders;
