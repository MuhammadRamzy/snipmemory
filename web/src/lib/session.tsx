import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, isOffline } from './api';
import type { Capability, Me } from './types';

interface SessionValue {
  me: Me | null;
  loading: boolean;
  offline: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  has: (cap: Capability) => boolean;
  isManager: boolean;
  isOwner: boolean;
}

const Ctx = createContext<SessionValue | null>(null);
const cacheKey = (app: string) => `sm.me.${app}`;

/** Logged-in state for one app. Cached so the app opens offline with the last known shop. */
export function SessionProvider({ app, children }: { app: 'owner' | 'staff'; children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(() => {
    try {
      const raw = localStorage.getItem(cacheKey(app));
      return raw ? (JSON.parse(raw) as Me) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const next = await api.get<Me | { user: null }>('/api/auth/me');
      const value = next.user ? (next as Me) : null;
      setMe(value);
      setOffline(false);
      try {
        if (value) localStorage.setItem(cacheKey(app), JSON.stringify(value));
        else localStorage.removeItem(cacheKey(app));
      } catch {
        // ignore
      }
    } catch (err) {
      if (isOffline(err)) setOffline(true);
    } finally {
      setLoading(false);
    }
  }, [app]);

  useEffect(() => {
    void refresh();
    const on = () => void refresh();
    window.addEventListener('online', on);
    return () => window.removeEventListener('online', on);
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } finally {
      setMe(null);
      try {
        localStorage.removeItem(cacheKey(app));
      } catch {
        // ignore
      }
    }
  }, [app]);

  const value: SessionValue = {
    me,
    loading,
    offline,
    refresh,
    logout,
    has: (cap) => Boolean(me?.plan.capabilities.includes(cap)),
    isManager: app === 'owner' && (me?.me.role === 'owner' || me?.me.role === 'manager'),
    isOwner: app === 'owner' && me?.me.role === 'owner',
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionValue & { me: Me } {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSession outside SessionProvider');
  return ctx as SessionValue & { me: Me };
}

export function useSessionMaybe(): SessionValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSession outside SessionProvider');
  return ctx;
}
