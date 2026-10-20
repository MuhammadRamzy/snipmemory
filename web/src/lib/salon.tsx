import { createContext, useContext, type ReactNode } from 'react';
import type { Capability, SalonContextData } from './types';

interface SalonValue extends SalonContextData {
  reload: () => Promise<void>;
  /** `/api/salons/:id` prefix for API calls. */
  base: string;
  canManage: boolean;
  isOwner: boolean;
  isStation: boolean;
  has: (capability: Capability) => boolean;
}

const SalonContext = createContext<SalonValue | null>(null);

export function SalonProvider({ data, reload, children }: { data: SalonContextData; reload: () => Promise<void>; children: ReactNode }) {
  const { viewer, plan, salon } = data;
  const value: SalonValue = {
    ...data,
    reload,
    base: `/api/salons/${salon.id}`,
    isStation: viewer.kind === 'station',
    canManage: viewer.kind === 'user' && (viewer.role === 'owner' || viewer.role === 'manager'),
    isOwner: viewer.kind === 'user' && viewer.role === 'owner',
    has: (capability) => plan.capabilities.includes(capability),
  };
  return <SalonContext.Provider value={value}>{children}</SalonContext.Provider>;
}

export function useSalon(): SalonValue {
  const ctx = useContext(SalonContext);
  if (!ctx) throw new Error('useSalon must be used inside SalonProvider');
  return ctx;
}
