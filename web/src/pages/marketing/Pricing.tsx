import { useState } from 'react';
import { PlanCards } from '../../components/PlanCards';
import { LinkButton, PageLoader, Select, Tabs } from '../../components/ui';
import type { PricedPlan } from '../../lib/types';
import { useApi } from '../../lib/useApi';
import { currencyForVisitor, MarketingLayout } from './MarketingLayout';

const CURRENCIES = ['USD', 'INR', 'GBP', 'EUR', 'AED'];

export default function Pricing() {
  const [currency, setCurrency] = useState(currencyForVisitor());
  const [interval, setInterval] = useState<'month' | 'year'>('year');
  const { data } = useApi<{ plans: PricedPlan[] }>(`/api/public/plans?currency=${currency}`);

  return (
    <MarketingLayout>
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Priced per chair, not per client</h1>
          <p className="mx-auto mt-3 max-w-xl text-muted">Grow your client list as much as you like. Start with a 14-day Studio trial — no card — and keep the Free plan forever if it's enough.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Tabs value={interval} onChange={setInterval} options={[{ value: 'month', label: 'Monthly' }, { value: 'year', label: 'Yearly · 2 months free' }]} />
            <Select aria-label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className="h-10 w-28">
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </div>
        </div>
        <div className="mt-12">
          {!data ? (
            <PageLoader />
          ) : (
            <PlanCards
              plans={data.plans}
              interval={interval}
              renderAction={(plan) => (
                <LinkButton to="/signup" variant={plan.id === 'studio' ? 'accent' : 'secondary'} className="w-full">
                  {plan.id === 'free' ? 'Start free' : 'Start 14-day trial'}
                </LinkButton>
              )}
            />
          )}
        </div>
        <div className="mx-auto mt-12 grid max-w-4xl gap-6 text-sm text-muted sm:grid-cols-3">
          <p>
            <strong className="block text-text">Reminder credits</strong>1 credit = 1 automated WhatsApp or SMS. Need more? Top-up packs never expire.
          </p>
          <p>
            <strong className="block text-text">Click-to-send is always free</strong>On every plan you can send reminders from your own WhatsApp in one tap.
          </p>
          <p>
            <strong className="block text-text">Chains & franchises</strong>Multi-location is billed per location. Talk to us about 10+ locations and data migration.
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
}
