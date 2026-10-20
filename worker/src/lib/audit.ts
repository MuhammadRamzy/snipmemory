import type { Context } from 'hono';
import type { AppEnv } from '../types';
import { newId } from './crypto';
import { now, run } from './db';

export async function audit(
  c: Context<AppEnv>,
  entry: { action: string; shopId?: string | null; targetId?: string | null; meta?: Record<string, unknown> },
): Promise<void> {
  const ctx = c.get('ctx') as AppEnv['Variables']['ctx'] | undefined;
  const admin = c.get('adminUser') as AppEnv['Variables']['adminUser'] | undefined;
  await run(
    c.env.DB,
    'INSERT INTO audit_log (id, shop_id, user_id, impersonator_id, action, target_id, meta, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    newId('aud'),
    entry.shopId ?? ctx?.shop.id ?? null,
    admin?.id ?? ctx?.user.id ?? null,
    ctx?.impersonatorId ?? null,
    entry.action,
    entry.targetId ?? null,
    JSON.stringify(entry.meta ?? {}),
    now(),
  );
}
