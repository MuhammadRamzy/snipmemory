import type { Env } from '../env';
import { DAY, HOUR, now, run } from './db';
import { FREE_PLAN, PAST_DUE_GRACE_DAYS } from './plans';

/** Housekeeping run by the cron trigger. Idempotent. */
export async function runMaintenance(env: Env): Promise<void> {
  const t = now();
  const db = env.DB;
  const expiring = `subscription_status = 'trialing' AND trial_ends_at < ? AND stripe_subscription_id IS NULL`;
  const lapsed = `subscription_status = 'past_due' AND past_due_since < ?`;
  const graceCutoff = t - PAST_DUE_GRACE_DAYS * DAY;
  await db.batch([
    db
      .prepare(`INSERT INTO audit_log (id, salon_id, action, meta, created_at) SELECT 'aud_' || lower(hex(randomblob(8))), id, 'trial.expired', '{}', ? FROM salons WHERE ${expiring}`)
      .bind(t, t),
    db
      .prepare(
        `INSERT INTO audit_log (id, salon_id, action, meta, created_at) SELECT 'aud_' || lower(hex(randomblob(8))), id, 'billing.churned', json_object('fromPlan', plan_id, 'reason', 'past_due'), ? FROM salons WHERE ${lapsed}`,
      )
      .bind(t, graceCutoff),
    // Trials that ended without a subscription fall back to Free (no lock-out, data kept).
    db
      .prepare(
        `UPDATE salons SET plan_id = ?, subscription_status = 'active', trial_ends_at = NULL, message_credits = 0, updated_at = ?
         WHERE ${expiring}`,
      )
      .bind(FREE_PLAN, t, t),
    // Unpaid subscriptions past the grace period.
    db
      .prepare(
        `UPDATE salons SET plan_id = ?, subscription_status = 'active', past_due_since = NULL, message_credits = 0, updated_at = ?
         WHERE ${lapsed}`,
      )
      .bind(FREE_PLAN, t, graceCutoff),
    // Monthly reminder allowance (annual plans included).
    db
      .prepare(
        `UPDATE salons SET message_credits = (SELECT monthly_message_credits FROM plans WHERE plans.id = salons.plan_id),
           credits_reset_at = ? WHERE credits_reset_at IS NOT NULL AND credits_reset_at <= ? AND subscription_status != 'trialing'`,
      )
      .bind(t + 30 * DAY, t),
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(t),
    db.prepare('DELETE FROM otp_codes WHERE created_at < ?').bind(t - DAY),
    db.prepare('DELETE FROM rate_limits WHERE window_start < ?').bind(t - 2 * DAY),
  ]);
  // Reminder history and webhook ids are kept 13 months for reporting, then pruned.
  await run(db, 'DELETE FROM webhook_events WHERE received_at < ?', t - 400 * DAY);
  await run(db, "DELETE FROM messages WHERE kind = 'otp' AND created_at < ?", t - 30 * DAY - HOUR);
}
