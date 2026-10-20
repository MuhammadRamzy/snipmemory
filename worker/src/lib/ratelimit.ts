import { ApiError } from './http';
import { first, now } from './db';

/**
 * Fixed-window counter stored in D1. Good enough for login / OTP abuse protection;
 * switch to the Workers Rate Limiting binding if traffic grows.
 */
export async function rateLimit(db: D1Database, key: string, limit: number, windowMs: number): Promise<void> {
  const t = now();
  const windowStart = t - (t % windowMs);
  const row = await first<{ count: number }>(
    db,
    `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN rate_limits.window_start = excluded.window_start THEN rate_limits.count + 1 ELSE 1 END,
       window_start = excluded.window_start
     RETURNING count`,
    key,
    windowStart,
  );
  if ((row?.count ?? 0) > limit) {
    throw new ApiError(429, 'rate_limited', 'Too many attempts. Please wait a few minutes and try again.');
  }
}
