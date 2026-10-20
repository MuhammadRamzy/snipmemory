import type { Env } from '../env';
import { newId } from './crypto';
import { now, run } from './db';

export type Channel = 'whatsapp' | 'sms';

export interface Outbound {
  to: string; // E.164
  channel: Channel;
  kind: 'reminder' | 'otp' | 'system';
  body: string;
  /** WhatsApp business-initiated messages must use a pre-approved template. */
  template?: { name: string; language: string; params: string[]; buttonParam?: string };
}

interface DeliveryResult {
  status: 'sent' | 'failed';
  provider: string;
  providerMessageId?: string;
  error?: string;
}

function parseTemplate(spec: string | undefined): { name: string; language: string } | null {
  if (!spec) return null;
  const [name, language = 'en'] = spec.split(':');
  return name ? { name, language } : null;
}

export function reminderTemplate(env: Env) {
  return parseTemplate(env.WHATSAPP_REMINDER_TEMPLATE);
}

export function otpTemplate(env: Env) {
  return parseTemplate(env.WHATSAPP_OTP_TEMPLATE);
}

async function sendTwilio(env: Env, msg: Outbound): Promise<DeliveryResult> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM) {
    return { status: 'failed', provider: 'twilio', error: 'Twilio is not configured' };
  }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`)}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: msg.to, From: env.TWILIO_FROM, Body: msg.body }),
  });
  const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
  return res.ok
    ? { status: 'sent', provider: 'twilio', providerMessageId: data.sid }
    : { status: 'failed', provider: 'twilio', error: data.message ?? `HTTP ${res.status}` };
}

async function sendWhatsApp(env: Env, msg: Outbound): Promise<DeliveryResult> {
  if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID || !msg.template) {
    return { status: 'failed', provider: 'whatsapp', error: 'WhatsApp is not configured' };
  }
  const components: unknown[] = [
    { type: 'body', parameters: msg.template.params.map((text) => ({ type: 'text', text })) },
  ];
  if (msg.template.buttonParam) {
    components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: msg.template.buttonParam }] });
  }
  const res = await fetch(`https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.WHATSAPP_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: msg.to.replace('+', ''),
      type: 'template',
      template: { name: msg.template.name, language: { code: msg.template.language }, components },
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message: string } };
  return res.ok
    ? { status: 'sent', provider: 'whatsapp', providerMessageId: data.messages?.[0]?.id }
    : { status: 'failed', provider: 'whatsapp', error: data.error?.message ?? `HTTP ${res.status}` };
}

async function deliver(env: Env, msg: Outbound): Promise<DeliveryResult> {
  if (env.MESSAGING_PROVIDER !== 'live') {
    // Development / test: nothing leaves the Worker; the message is only logged.
    console.log(`[messaging:${msg.channel}] → ${msg.to}: ${msg.body}`);
    return { status: 'sent', provider: 'log' };
  }
  if (msg.channel === 'whatsapp' && msg.template && env.WHATSAPP_TOKEN) {
    const result = await sendWhatsApp(env, msg);
    // Fall back to SMS so the client still hears from the salon.
    if (result.status === 'sent' || !env.TWILIO_ACCOUNT_SID) return result;
  }
  return sendTwilio(env, msg);
}

/** Delivers a message and records it in the `messages` table. */
export async function sendMessage(
  env: Env,
  msg: Outbound & { salonId?: string | null; clientId?: string | null; credits?: number },
): Promise<{ id: string } & DeliveryResult> {
  let result: DeliveryResult;
  try {
    result = await deliver(env, msg);
  } catch (err) {
    result = { status: 'failed', provider: env.MESSAGING_PROVIDER, error: err instanceof Error ? err.message : String(err) };
  }
  const id = newId('msg');
  await run(
    env.DB,
    `INSERT INTO messages (id, salon_id, client_id, channel, kind, to_phone, body, status, provider, provider_message_id, error, credits, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    msg.salonId ?? null,
    msg.clientId ?? null,
    msg.channel,
    msg.kind,
    msg.to,
    msg.body,
    result.status,
    result.provider,
    result.providerMessageId ?? null,
    result.error ?? null,
    result.status === 'sent' ? (msg.credits ?? 0) : 0,
    now(),
  );
  return { id, ...result };
}

/** Atomically spends one message credit (monthly allowance first, then purchased). */
export async function consumeCredit(db: D1Database, salonId: string): Promise<boolean> {
  const row = await db
    .prepare(
      `UPDATE salons SET
         bonus_credits = CASE WHEN message_credits > 0 THEN bonus_credits ELSE bonus_credits - 1 END,
         message_credits = CASE WHEN message_credits > 0 THEN message_credits - 1 ELSE message_credits END
       WHERE id = ? AND (message_credits > 0 OR bonus_credits > 0)
       RETURNING id`,
    )
    .bind(salonId)
    .first();
  return row !== null;
}

export async function refundCredit(db: D1Database, salonId: string): Promise<void> {
  await run(db, 'UPDATE salons SET bonus_credits = bonus_credits + 1 WHERE id = ?', salonId);
}
