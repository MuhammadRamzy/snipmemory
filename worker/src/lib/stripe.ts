import type { Env } from '../env';
import { hmacSha256, timingSafeEqual } from './crypto';
import { ApiError } from './http';

// Minimal Stripe REST client — the official SDK is heavy for a Worker and we use a handful of endpoints.

type Params = { [key: string]: string | number | boolean | null | undefined | Params | Params[] | string[] };

function flatten(params: Params, prefix = '', out = new URLSearchParams()): URLSearchParams {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (typeof item === 'object') flatten(item as Params, `${name}[${i}]`, out);
        else out.append(`${name}[${i}]`, String(item));
      });
    } else if (typeof value === 'object') {
      flatten(value, name, out);
    } else {
      out.append(name, String(value));
    }
  }
  return out;
}

export function stripeEnabled(env: Env): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}

export async function stripe<T = Record<string, unknown>>(env: Env, method: 'GET' | 'POST', path: string, params: Params = {}): Promise<T> {
  if (!env.STRIPE_SECRET_KEY) throw new ApiError(500, 'billing_not_configured', 'Billing is not configured.');
  const qs = flatten(params).toString();
  const res = await fetch(`https://api.stripe.com/v1/${path}${method === 'GET' && qs ? `?${qs}` : ''}`, {
    method,
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: method === 'POST' ? qs : undefined,
  });
  const data = (await res.json()) as T & { error?: { message: string } };
  if (!res.ok) throw new ApiError(502, 'stripe_error', data.error?.message ?? 'Payment provider error.');
  return data;
}

/**
 * Verifies the `Stripe-Signature` header (v1 HMAC-SHA256 scheme).
 * https://docs.stripe.com/webhooks#verify-manually
 */
export async function verifyStripeSignature(payload: string, header: string | undefined, secret: string, toleranceSec = 300): Promise<boolean> {
  if (!header) return false;
  const parts = header.split(',').map((p) => p.split('=') as [string, string]);
  const timestamp = parts.find(([k]) => k === 't')?.[1];
  const signatures = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!timestamp || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > toleranceSec) return false;
  const expected = await hmacSha256(secret, `${timestamp}.${payload}`);
  return signatures.some((sig) => timingSafeEqual(sig, expected));
}

export type { Params as StripeParams };
