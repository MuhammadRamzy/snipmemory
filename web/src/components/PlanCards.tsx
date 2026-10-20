import { money } from '../lib/format';
import type { PricedPlan } from '../lib/types';
import { Icons } from './icons';
import { Badge, cx } from './ui';

export function PlanCards({
  plans,
  interval,
  currentPlanId,
  renderAction,
}: {
  plans: PricedPlan[];
  interval: 'month' | 'year';
  currentPlanId?: string;
  renderAction: (plan: PricedPlan) => React.ReactNode;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {plans.map((plan) => {
        const price = plan.prices[interval];
        const monthly = price ? (interval === 'year' ? Math.round(price.amount / 12) : price.amount) : 0;
        const featured = plan.id === 'studio';
        return (
          <div
            key={plan.id}
            className={cx('relative flex flex-col rounded-2xl border bg-surface p-5', featured ? 'border-accent shadow-lg shadow-accent/10' : 'border-border', plan.id === currentPlanId && 'ring-2 ring-accent')}
          >
            {featured && <Badge tone="accent" className="absolute -top-2.5 left-5">Most popular</Badge>}
            <h3 className="text-lg font-bold">{plan.name}</h3>
            <p className="min-h-10 text-sm text-muted">{plan.tagline}</p>
            <p className="mt-4">
              <span className="text-3xl font-extrabold tracking-tight">{price ? money(monthly, price.currency) : money(0, plans[1]?.prices.month?.currency ?? 'USD')}</span>
              <span className="text-sm text-muted"> /{plan.id === 'chain' ? 'location/' : ''}month</span>
            </p>
            <p className="h-5 text-xs text-muted">{price && interval === 'year' ? `${money(price.amount, price.currency)} billed yearly` : price ? 'billed monthly' : 'free forever'}</p>
            <ul className="my-5 flex-1 space-y-2 text-sm">
              {plan.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <Icons.check size={16} className="mt-0.5 shrink-0 text-success" />
                  {f}
                </li>
              ))}
            </ul>
            {renderAction(plan)}
          </div>
        );
      })}
    </div>
  );
}
