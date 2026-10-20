import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Logo } from '../../components/icons';
import { LinkButton } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { guessCountry } from '../auth/countries';

export function currencyForVisitor(): string {
  const cc = guessCountry();
  if (cc === 'IN') return 'INR';
  if (cc === 'GB') return 'GBP';
  if (cc === 'AE') return 'AED';
  if (['DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'PT', 'IE'].includes(cc)) return 'EUR';
  return 'USD';
}

export function MarketingLayout({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/">
            <Logo />
          </Link>
          <nav className="flex items-center gap-1 text-sm font-medium sm:gap-3">
            <Link to="/pricing" className="hidden rounded-lg px-3 py-2 text-muted hover:text-text sm:block">
              Pricing
            </Link>
            <Link to="/passport" className="hidden rounded-lg px-3 py-2 text-muted hover:text-text sm:block">
              For clients
            </Link>
            {me?.user ? (
              <LinkButton to="/app" size="sm">
                Open app
              </LinkButton>
            ) : (
              <>
                <Link to="/login" className="rounded-lg px-3 py-2 text-muted hover:text-text">
                  Sign in
                </Link>
                <LinkButton to="/signup" size="sm" variant="accent">
                  Start free
                </LinkButton>
              </>
            )}
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Logo className="text-text" />
            <p className="mt-2 max-w-xs">The memory of every haircut. Built for barbers and stylists who care about the repeat.</p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link to="/pricing">Pricing</Link>
            <Link to="/passport">Style Passport</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <a href="mailto:hello@snipmemory.app">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
