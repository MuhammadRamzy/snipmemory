import { useState } from 'react';
import { I } from '../components/icons';
import { useApi } from '../lib/useApi';

/** Platform messages from SnipMemory (maintenance, new features). Dismissible per message. */
export function Announcements() {
  const { data } = useApi<{ announcements: { id: string; message: string; level: string }[] }>('/api/public/announcements');
  const [hidden, setHidden] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('sm.ann.hidden') ?? '[]') as string[];
    } catch {
      return [];
    }
  });
  const list = data?.announcements.filter((a) => !hidden.includes(a.id)) ?? [];
  if (!list.length) return null;
  return (
    <>
      {list.map((a) => (
        <div key={a.id} className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold ${a.level === 'critical' ? 'bg-danger text-white' : a.level === 'warning' ? 'bg-warn-soft text-warn' : 'bg-brand-soft text-brand-text'}`}>
          <span className="flex-1">{a.message}</span>
          <button
            aria-label="Hide"
            onClick={() => {
              const next = [...hidden, a.id];
              setHidden(next);
              try {
                localStorage.setItem('sm.ann.hidden', JSON.stringify(next));
              } catch {
                // ignore
              }
            }}
          >
            <I.x size={18} />
          </button>
        </div>
      ))}
    </>
  );
}
