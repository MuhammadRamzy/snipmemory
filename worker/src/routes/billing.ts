import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import type { AppEnv, PlanRow, SalonRow } from '../types';
import { audit } from '../lib/audit';
import { newId } from '../lib/crypto';
import { DAY, all, first, now, run } from '../lib/db';
import { ApiError, badRequest, body, forbidden, notFound } from '../lib/http';
import { CREDIT_PACKS, FREE_PLAN, getPlan, packPrice, priceFor } from '../lib/plans';
import { serializePlan } from '../lib/serialize';
import { salonAccess } from '../lib/session';
import { stripe, stripeEnabled, verifyStripeSignature } from '../lib/stripe';

const billing = new Hono<AppEnv>();

billing.get('/', salonAccess('owner'), async (c) => {
  const { salon } = c.get('access');
  const db = c.env.DB;
  const plans = await all<PlanRow>(db, 'SELECT * FROM plans WHERE is_public = 1 OR id = ? ORDER BY sort_order', salon.plan_id);
  const options = await Promise.all(
    plans.map(async (plan) => ({
      ...serializePlan(plan),
      prices: {
        month: await priceFor(db, plan.id, salon.currency, 'month'),
        year: await priceFor(db, plan.id, salon.currency, 'year'),
      },
    })),
  );
  const payments = await all<{ id: string; amount: number; currency: string; status: string; description: string; invoice_url: string | null; created_at: number }>(
    db,
    'SELECT id, amount, currency, status, description, invoice_url, created_at FROM payments WHERE salon_id = ? ORDER BY created_at DESC LIMIT 50',
    salon.id,
  );
  return c.json({
    provider: stripeEnabled(c.env) ? 'stripe' : c.env.APP_ENV === 'production' ? 'none' : 'dev',
    plans: options.map((p) => ({
      ...p,
      prices: {
        month: p.prices.month && { amount: p.prices.month.amount, currency: p.prices.month.currency },
        year: p.prices.year && { amount: p.prices.year.amount, currency: p.prices.year.currency },
      },
    })),
    packs: CREDIT_PACKS.map((pack) => ({ id: pack.id, credits: pack.credits, ...packPrice(pack, salon.currency) })),
    payments: payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      description: p.description,
      invoiceUrl: p.invoice_url,
      createdAt: p.created_at,
    })),
  });
});

/** Applies a paid plan to the salon (used by the Stripe webhook and by dev-mode checkout). */
export async function activatePlan(
  db: D1Database,
  salon: SalonRow,
  plan: PlanRow,
  interval: 'month' | 'year',
  periodEnd: number,
  extra: { stripeCustomerId?: string; stripeSubscriptionId?: string } = {},
) {
  await run(
    db,
    `UPDATE salons SET plan_id = ?, billing_interval = ?, subscription_status = 'active', trial_ends_at = NULL, past_due_since = NULL,
       current_period_end = ?, message_credits = MAX(message_credits, ?), credits_reset_at = ?,
       stripe_customer_id = COALESCE(?, stripe_customer_id), stripe_subscription_id = COALESCE(?, stripe_subscription_id), updated_at = ?
     WHERE id = ?`,
    plan.id,
    interval,
    periodEnd,
    plan.monthly_message_credits,
    now() + 30 * DAY,
    extra.stripeCustomerId ?? null,
    extra.stripeSubscriptionId ?? null,
    now(),
    salon.id,
  );
}

async function downgradeToFree(db: D1Database, salonId: string) {
  await run(
    db,
    "INSERT INTO audit_log (id, salon_id, action, meta, created_at) SELECT ?, id, 'billing.churned', json_object('fromPlan', plan_id), ? FROM salons WHERE id = ? AND plan_id != ?",
    newId('aud'),
    now(),
    salonId,
    FREE_PLAN,
  );
  await run(
    db,
    `UPDATE salons SET plan_id = ?, subscription_status = 'active', stripe_subscription_id = NULL, current_period_end = NULL,
       past_due_since = NULL, trial_ends_at = NULL, message_credits = 0, updated_at = ? WHERE id = ?`,
    FREE_PLAN,
    now(),
    salonId,
  );
}

async function ensureStripeCustomer(env: Env, salon: SalonRow): Promise<string> {
  if (salon.stripe_customer_id) return salon.stripe_customer_id;
  const customer = await stripe<{ id: string }>(env, 'POST', 'customers', {
    name: salon.name,
    email: salon.email ?? undefined,
    phone: salon.phone ?? undefined,
    metadata: { salon_id: salon.id },
  });
  await run(env.DB, 'UPDATE salons SET stripe_customer_id = ? WHERE id = ?', customer.id, salon.id);
  return customer.id;
}

billing.post('/checkout', salonAccess('owner'), async (c) => {
  const input = await body(c, z.object({ planId: z.string(), interval: z.enum(['month', 'year']) }));
  const { salon } = c.get('access');
  if (c.get('access').impersonatorId) throw forbidden('Support staff cannot start a checkout for a salon.');
  const plan = await getPlan(c.env.DB, input.planId);
  if (plan.id === FREE_PLAN) throw badRequest('Use “Switch to Free” to downgrade.');
  const price = await priceFor(c.env.DB, plan.id, salon.currency, input.interval);
  if (!price) throw badRequest('This plan is not available in your currency.');

  if (!stripeEnabled(c.env)) {
    if (c.env.APP_ENV === 'production') throw new ApiError(500, 'billing_not_configured', 'Billing is not configured.');
    // Development: activate immediately so the whole product can be exercised locally.
    await activatePlan(c.env.DB, salon, plan, input.interval, now() + (input.interval === 'year' ? 365 : 30) * DAY);
    await run(
      c.env.DB,
      "INSERT INTO payments (id, salon_id, amount, currency, status, description, provider, created_at) VALUES (?, ?, ?, ?, 'paid', ?, 'dev', ?)",
      newId('pay'),
      salon.id,
      price.amount,
      price.currency,
      `${plan.name} plan (${input.interval}ly) — test mode`,
      now(),
    );
    await audit(c, { salonId: salon.id, action: 'billing.plan_changed', meta: { planId: plan.id, interval: input.interval, mode: 'dev' } });
    return c.json({ activated: true });
  }

  if (salon.stripe_subscription_id) {
    // Existing subscribers change plans in the Stripe customer portal (handles proration).
    const portal = await stripe<{ url: string }>(c.env, 'POST', 'billing_portal/sessions', {
      customer: salon.stripe_customer_id!,
      return_url: `${c.env.APP_URL}/app/billing`,
    });
    return c.json({ url: portal.url });
  }

  const customer = await ensureStripeCustomer(c.env, salon);
  const lineItem = price.stripe_price_id
    ? { price: price.stripe_price_id, quantity: 1 }
    : {
        quantity: 1,
        price_data: {
          currency: price.currency.toLowerCase(),
          unit_amount: price.amount,
          recurring: { interval: input.interval },
          product_data: { name: `SnipMemory ${plan.name}` },
        },
      };
  const session = await stripe<{ url: string }>(c.env, 'POST', 'checkout/sessions', {
    mode: 'subscription',
    customer,
    client_reference_id: salon.id,
    line_items: [lineItem],
    allow_promotion_codes: true,
    subscription_data: { metadata: { salon_id: salon.id, plan_id: plan.id, interval: input.interval } },
    metadata: { salon_id: salon.id, plan_id: plan.id, interval: input.interval, kind: 'subscription' },
    success_url: `${c.env.APP_URL}/app/billing?checkout=success`,
    cancel_url: `${c.env.APP_URL}/app/billing?checkout=cancelled`,
  });
  return c.json({ url: session.url });
});

billing.post('/credits', salonAccess('owner'), async (c) => {
  const input = await body(c, z.object({ packId: z.string() }));
  const { salon } = c.get('access');
  const pack = CREDIT_PACKS.find((p) => p.id === input.packId);
  if (!pack) throw notFound('Credit pack');
  const price = packPrice(pack, salon.currency);
  if (!stripeEnabled(c.env)) {
    if (c.env.APP_ENV === 'production') throw new ApiError(500, 'billing_not_configured', 'Billing is not configured.');
    await run(c.env.DB, 'UPDATE salons SET bonus_credits = bonus_credits + ? WHERE id = ?', pack.credits, salon.id);
    await run(
      c.env.DB,
      "INSERT INTO payments (id, salon_id, amount, currency, status, description, provider, created_at) VALUES (?, ?, ?, ?, 'paid', ?, 'dev', ?)",
      newId('pay'),
      salon.id,
      price.amount,
      price.currency,
      `${pack.credits} message credits — test mode`,
      now(),
    );
    return c.json({ activated: true });
  }
  const session = await stripe<{ url: string }>(c.env, 'POST', 'checkout/sessions', {
    mode: 'payment',
    customer: await ensureStripeCustomer(c.env, salon),
    client_reference_id: salon.id,
    line_items: [
      {
        quantity: 1,
        price_data: { currency: price.currency.toLowerCase(), unit_amount: price.amount, product_data: { name: `${pack.credits} reminder credits` } },
      },
    ],
    metadata: { salon_id: salon.id, kind: 'credits', pack_id: pack.id },
    success_url: `${c.env.APP_URL}/app/billing?checkout=success`,
    cancel_url: `${c.env.APP_URL}/app/billing?checkout=cancelled`,
  });
  return c.json({ url: session.url });
});

billing.post('/portal', salonAccess('owner'), async (c) => {
  const { salon } = c.get('access');
  if (!stripeEnabled(c.env) || !salon.stripe_customer_id) throw badRequest('No billing account yet.');
  const portal = await stripe<{ url: string }>(c.env, 'POST', 'billing_portal/sessions', {
    customer: salon.stripe_customer_id,
    return_url: `${c.env.APP_URL}/app/billing`,
  });
  return c.json({ url: portal.url });
});

billing.post('/downgrade', salonAccess('owner'), async (c) => {
  const { salon } = c.get('access');
  if (salon.stripe_subscription_id && stripeEnabled(c.env)) {
    await stripe(c.env, 'POST', `subscriptions/${salon.stripe_subscription_id}`, { cancel_at_period_end: true });
    await audit(c, { salonId: salon.id, action: 'billing.cancel_scheduled' });
    return c.json({ scheduled: true, effectiveAt: salon.current_period_end });
  }
  await downgradeToFree(c.env.DB, salon.id);
  await audit(c, { salonId: salon.id, action: 'billing.downgraded' });
  return c.json({ scheduled: false });
});

// ---------------------------------------------------------------------------
// Stripe webhook
// ---------------------------------------------------------------------------
export const stripeWebhook = new Hono<AppEnv>();

interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, any> };
}

function mapStatus(status: string): SalonRow['subscription_status'] | 'ended' {
  if (status === 'active' || status === 'trialing') return 'active';
  if (status === 'past_due' || status === 'unpaid' || status === 'incomplete') return 'past_due';
  return 'ended';
}

async function salonForEvent(db: D1Database, obj: Record<string, any>): Promise<SalonRow | null> {
  const salonId = obj.metadata?.salon_id ?? obj.client_reference_id ?? obj.subscription_details?.metadata?.salon_id;
  if (salonId) return first<SalonRow>(db, 'SELECT * FROM salons WHERE id = ?', salonId);
  if (obj.customer) return first<SalonRow>(db, 'SELECT * FROM salons WHERE stripe_customer_id = ?', obj.customer);
  return null;
}

stripeWebhook.post('/', async (c) => {
  if (!c.env.STRIPE_WEBHOOK_SECRET) throw new ApiError(500, 'billing_not_configured', 'Webhook secret missing.');
  const payload = await c.req.text();
  if (!(await verifyStripeSignature(payload, c.req.header('stripe-signature'), c.env.STRIPE_WEBHOOK_SECRET))) {
    throw new ApiError(400, 'bad_signature', 'Invalid signature.');
  }
  const event = JSON.parse(payload) as StripeEvent;
  const db = c.env.DB;
  const fresh = await db
    .prepare("INSERT INTO webhook_events (id, provider, type, received_at) VALUES (?, 'stripe', ?, ?) ON CONFLICT(id) DO NOTHING RETURNING id")
    .bind(event.id, event.type, now())
    .first();
  if (!fresh) return c.json({ received: true, duplicate: true });

  const obj = event.data.object;
  const salon = await salonForEvent(db, obj);
  if (!salon) return c.json({ received: true, ignored: 'unknown salon' });

  switch (event.type) {
    case 'checkout.session.completed': {
      if (obj.metadata?.kind === 'credits') {
        const pack = CREDIT_PACKS.find((p) => p.id === obj.metadata.pack_id);
        if (pack && obj.payment_status === 'paid') {
          await run(db, 'UPDATE salons SET bonus_credits = bonus_credits + ? WHERE id = ?', pack.credits, salon.id);
          await run(
            db,
            "INSERT INTO payments (id, salon_id, amount, currency, status, description, provider, provider_ref, created_at) VALUES (?, ?, ?, ?, 'paid', ?, 'stripe', ?, ?) ON CONFLICT(provider_ref) DO NOTHING",
            newId('pay'),
            salon.id,
            obj.amount_total ?? 0,
            String(obj.currency ?? 'usd').toUpperCase(),
            `${pack.credits} message credits`,
            obj.payment_intent ?? obj.id,
            now(),
          );
        }
      } else if (obj.subscription) {
        const plan = await getPlan(db, obj.metadata?.plan_id ?? salon.plan_id);
        const sub = await stripe<{ current_period_end?: number; items?: { data: { current_period_end?: number }[] } }>(c.env, 'GET', `subscriptions/${obj.subscription}`);
        const periodEnd = (sub.current_period_end ?? sub.items?.data[0]?.current_period_end ?? 0) * 1000 || now() + 30 * DAY;
        await activatePlan(db, salon, plan, obj.metadata?.interval === 'year' ? 'year' : 'month', periodEnd, {
          stripeCustomerId: obj.customer,
          stripeSubscriptionId: obj.subscription,
        });
        if (salon.referred_by_salon_id) {
          // Referral reward: both salons get a pack of reminder credits on first paid conversion.
          await run(db, 'UPDATE salons SET bonus_credits = bonus_credits + 250 WHERE id IN (?, ?)', salon.id, salon.referred_by_salon_id);
          await run(db, 'UPDATE salons SET referred_by_salon_id = NULL WHERE id = ?', salon.id);
        }
      }
      break;
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const status = event.type === 'customer.subscription.deleted' ? 'ended' : mapStatus(obj.status);
      if (status === 'ended') {
        await downgradeToFree(db, salon.id);
      } else {
        const planId = obj.metadata?.plan_id ?? salon.plan_id;
        const periodEnd = (obj.current_period_end ?? obj.items?.data?.[0]?.current_period_end ?? 0) * 1000 || salon.current_period_end;
        await run(
          db,
          `UPDATE salons SET subscription_status = ?, plan_id = ?, current_period_end = ?,
             past_due_since = CASE WHEN ? = 'past_due' THEN COALESCE(past_due_since, ?) ELSE NULL END, updated_at = ? WHERE id = ?`,
          status,
          planId,
          periodEnd,
          status,
          now(),
          now(),
          salon.id,
        );
      }
      break;
    }
    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const paid = event.type === 'invoice.paid';
      await run(
        db,
        `INSERT INTO payments (id, salon_id, amount, currency, status, description, provider, provider_ref, invoice_url, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'stripe', ?, ?, ?) ON CONFLICT(provider_ref) DO UPDATE SET status = excluded.status`,
        newId('pay'),
        salon.id,
        paid ? obj.amount_paid : obj.amount_due,
        String(obj.currency ?? 'usd').toUpperCase(),
        paid ? 'paid' : 'failed',
        obj.lines?.data?.[0]?.description ?? 'SnipMemory subscription',
        obj.id,
        obj.hosted_invoice_url ?? null,
        now(),
      );
      if (paid && obj.billing_reason === 'subscription_cycle') {
        const plan = await getPlan(db, salon.plan_id);
        await run(
          db,
          "UPDATE salons SET message_credits = ?, credits_reset_at = ?, subscription_status = 'active', past_due_since = NULL WHERE id = ?",
          plan.monthly_message_credits,
          now() + 30 * DAY,
          salon.id,
        );
      }
      if (!paid) {
        await run(db, "UPDATE salons SET subscription_status = 'past_due', past_due_since = COALESCE(past_due_since, ?) WHERE id = ?", now(), salon.id);
      }
      break;
    }
  }
  return c.json({ received: true });
});

export { downgradeToFree };
export default billing;
