import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';
import type { Me, Member, Salon } from './types';

export interface StationState {
  paired: boolean;
  salon?: Salon;
  members?: Member[];
  acting?: (Member & { until: number }) | null;
}

interface AuthValue {
  me: Me | null;
  station: StationState | null;
  loading: boolean;
  refresh: () => Promise<Me>;
  refreshStation: () => Promise<StationState>;
  logout: () => Promise<void>;
  activeSalonId: string | null;
  setActiveSalonId: (id: string) => void;
}

const AuthContext = createContext<AuthValue | null>(null);
const STORAGE_KEY = 'sm.activeSalon';

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [station, setStation] = useState<StationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [preferred, setPreferred] = useState<string | null>(readStored);

  const refresh = useCallback(async () => {
    const next = await api.get<Me>('/api/auth/me');
    setMe(next);
    return next;
  }, []);

  const refreshStation = useCallback(async () => {
    const next = await api.get<StationState>('/api/station');
    setStation(next);
    return next;
  }, []);

  useEffect(() => {
    Promise.allSettled([refresh(), refreshStation()]).finally(() => setLoading(false));
  }, [refresh, refreshStation]);

  const logout = useCallback(async () => {
    await api.post('/api/auth/logout');
    setMe({ user: null, memberships: [], impersonating: null });
  }, []);

  const setActiveSalonId = useCallback((id: string) => {
    setPreferred(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // storage unavailable (private mode) — keep it in memory only
    }
  }, []);

  const activeSalonId = useMemo(() => {
    if (me?.impersonating) return me.impersonating.salonId;
    const memberships = me?.memberships ?? [];
    if (memberships.length) return memberships.find((m) => m.salon.id === preferred)?.salon.id ?? memberships[0].salon.id;
    if (station?.paired && station.salon) return station.salon.id;
    return null;
  }, [me, station, preferred]);

  const value = useMemo(
    () => ({ me, station, loading, refresh, refreshStation, logout, activeSalonId, setActiveSalonId }),
    [me, station, loading, refresh, refreshStation, logout, activeSalonId, setActiveSalonId],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
