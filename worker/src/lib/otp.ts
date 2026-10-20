import type { Env } from '../env';
import { newId, randomDigits, sha256, timingSafeEqual } from './crypto';
import { DAY, MINUTE, first, now, run } from './db';
import { ApiError } from './http';
import { otpTemplate, sendMessage } from './messaging';
import { rateLimit } from './ratelimit';

type Purpose = 'passport_login' | 'passport_share';

const TTL = 10 * MINUTE;
const MAX_ATTEMPTS = 5;

/** Sends a 6-digit code. In non-production environments the code is returned so flows can be tested. */
export async function issueOtp(
  env: Env,
  opts: { phone: string; purpose: Purpose; salonId?: string; salonName?: string },
): Promise<{ devCode?: string }> {
  await rateLimit(env.DB, `otp:${opts.phone}`, 3, 10 * MINUTE);
  await rateLimit(env.DB, `otp-day:${opts.phone}`, 10, DAY);
  const code = randomDigits(6);
  const id = newId('otp');
  await run(
    env.DB,
    'INSERT INTO otp_codes (id, phone, purpose, salon_id, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    id,
    opts.phone,
    opts.purpose,
    opts.salonId ?? null,
    await sha256(`${id}:${code}`),
    now() + TTL,
    now(),
  );
  const body =
    opts.purpose === 'passport_share'
      ? `${code} is your SnipMemory code. Share it with ${opts.salonName ?? 'the salon'} only if you want them to see your haircut history. Expires in 10 minutes.`
      : `${code} is your SnipMemory sign-in code. It expires in 10 minutes. Never share it with anyone.`;
  const wa = otpTemplate(env);
  const result = await sendMessage(env, {
    to: opts.phone,
    channel: env.OTP_CHANNEL === 'whatsapp' && wa ? 'whatsapp' : 'sms',
    kind: 'otp',
    // Store a redacted body; the real code only goes to the provider.
    body: body.replace(code, '••••••'),
    template: wa ? { ...wa, params: [code], buttonParam: code } : undefined,
    salonId: opts.salonId,
  });
  if (result.status !== 'sent' && env.MESSAGING_PROVIDER === 'live') {
    throw new ApiError(502, 'otp_failed', 'We could not send the code. Check the number and try again.');
  }
  return env.APP_ENV === 'production' ? {} : { devCode: code };
}

export async function verifyOtp(
  env: Env,
  opts: { phone: string; purpose: Purpose; code: string; salonId?: string },
): Promise<boolean> {
  const row = await first<{ id: string; code_hash: string; attempts: number }>(
    env.DB,
    `SELECT id, code_hash, attempts FROM otp_codes
     WHERE phone = ? AND purpose = ? AND consumed_at IS NULL AND expires_at > ? AND (salon_id IS ? OR ? IS NULL)
     ORDER BY created_at DESC LIMIT 1`,
    opts.phone,
    opts.purpose,
    now(),
    opts.salonId ?? null,
    opts.salonId ?? null,
  );
  if (!row) throw new ApiError(400, 'otp_expired', 'That code has expired. Request a new one.');
  if (row.attempts >= MAX_ATTEMPTS) throw new ApiError(429, 'otp_locked', 'Too many wrong attempts. Request a new code.');
  await run(env.DB, 'UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?', row.id);
  const ok = timingSafeEqual(await sha256(`${row.id}:${opts.code.trim()}`), row.code_hash);
  if (ok) await run(env.DB, 'UPDATE otp_codes SET consumed_at = ? WHERE id = ?', now(), row.id);
  return ok;
}
