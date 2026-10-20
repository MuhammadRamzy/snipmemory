import { useEffect, useState } from 'react';
import { ApiError, api } from './api';

// Bills made while the internet is down are saved on the phone and uploaded later.
// Each bill carries a clientRef, so retrying never creates a duplicate.

export interface PendingBill {
  clientRef: string;
  shopId: string;
  app: 'owner' | 'staff';
  payload: Record<string, unknown>;
  total: number;
  customerName: string | null;
  createdAt: number;
  error?: string;
}

const KEY = 'sm.outbox';
const listeners = new Set<() => void>();

function read(): PendingBill[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as PendingBill[];
  } catch {
    return [];
  }
}

function write(list: PendingBill[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

export function queueBill(bill: PendingBill) {
  write([...read().filter((b) => b.clientRef !== bill.clientRef), bill]);
}

let flushing = false;

/** Uploads waiting bills for this shop. Bills the server rejects stay with an error message. */
export async function flushOutbox(shopId: string): Promise<number> {
  if (flushing || !navigator.onLine) return 0;
  flushing = true;
  let sent = 0;
  try {
    for (const bill of read().filter((b) => b.shopId === shopId)) {
      try {
        await api.post('/api/shop/bills', bill.payload);
        write(read().filter((b) => b.clientRef !== bill.clientRef));
        sent++;
      } catch (err) {
        if (err instanceof ApiError && err.status === 0) break; // still offline
        write(read().map((b) => (b.clientRef === bill.clientRef ? { ...b, error: err instanceof Error ? err.message : 'Failed' } : b)));
      }
    }
  } finally {
    flushing = false;
  }
  return sent;
}

export function discardPending(clientRef: string) {
  write(read().filter((b) => b.clientRef !== clientRef));
}

export function usePending(shopId: string): PendingBill[] {
  const [list, setList] = useState(() => read().filter((b) => b.shopId === shopId));
  useEffect(() => {
    const update = () => setList(read().filter((b) => b.shopId === shopId));
    listeners.add(update);
    update();
    const sync = () => void flushOutbox(shopId);
    window.addEventListener('online', sync);
    const timer = setInterval(sync, 30_000);
    sync();
    return () => {
      listeners.delete(update);
      window.removeEventListener('online', sync);
      clearInterval(timer);
    };
  }, [shopId]);
  return list;
}

export function newClientRef(): string {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
