import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import type { Catalog } from './types';

const key = (shopId: string) => `sm.catalog.${shopId}`;

/** Price list + team, kept on the phone so billing works without internet. */
export function useCatalog(shopId: string) {
  const [catalog, setCatalog] = useState<Catalog | null>(() => {
    try {
      const raw = localStorage.getItem(key(shopId));
      return raw ? (JSON.parse(raw) as Catalog) : null;
    } catch {
      return null;
    }
  });
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(async () => {
    try {
      const next = await api.get<Catalog>('/api/shop/catalog');
      setCatalog(next);
      setError(null);
      try {
        localStorage.setItem(key(shopId), JSON.stringify(next));
      } catch {
        // storage full — still works online
      }
    } catch (err) {
      setError(err as Error);
    }
  }, [shopId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { catalog, error, reload };
}
