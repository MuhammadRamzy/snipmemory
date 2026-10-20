import type { Env } from '../env';

/**
 * Transactional email via Resend's HTTP API (works from Workers without SMTP).
 * Without RESEND_API_KEY the email is only logged, which is what local dev uses.
 */
export async function sendEmail(env: Env, msg: { to: string; subject: string; text: string }): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    console.log(`[email] → ${msg.to}: ${msg.subject}\n${msg.text}`);
    return false;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM ?? 'SnipMemory <hello@snipmemory.app>', to: [msg.to], subject: msg.subject, text: msg.text }),
  });
  if (!res.ok) console.error('email failed', res.status, await res.text().catch(() => ''));
  return res.ok;
}
