import type { Context } from 'hono';
import type { AppEnv } from '../types';
import { newId } from './crypto';
import { now, run } from './db';
import { clientIp } from './http';

export async function audit(
  c: Context<AppEnv>,
  entry: { salonId?: string | null; action: string; targetType?: string; targetId?: string; meta?: Record<string, unknown> },
): Promise<void> {
  const session = c.get('userSession');
  await run(
    c.env.DB,
    `INSERT INTO audit_log (id, salon_id, actor_user_id, impersonator_id, action, target_type, target_id, meta, ip, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    newId('aud'),
    entry.salonId ?? null,
    session?.user_id ?? null,
    session?.impersonator_id ?? null,
    entry.action,
    entry.targetType ?? null,
    entry.targetId ?? null,
    JSON.stringify(entry.meta ?? {}),
    clientIp(c),
    now(),
  );
}
