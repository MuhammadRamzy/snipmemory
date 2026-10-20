import { useState } from 'react';
import { date, money } from '../lib/format';
import type { Angle, Photo, Visit } from '../lib/types';
import { Icons } from './icons';
import { Badge, Button, Modal } from './ui';

export const ANGLES: { id: Angle; label: string }[] = [
  { id: 'front', label: 'Front' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
  { id: 'back', label: 'Back' },
];

export const TECHNIQUE_FIELDS: { id: string; label: string; placeholder: string }[] = [
  { id: 'sides', label: 'Sides', placeholder: '#1 skin fade to #3, mid taper' },
  { id: 'back', label: 'Back / neckline', placeholder: 'Tapered neckline, rounded' },
  { id: 'top', label: 'Top', placeholder: 'Scissor 4cm, point-cut texture' },
  { id: 'fringe', label: 'Fringe / front', placeholder: 'Leave 6cm, side swept left' },
  { id: 'beard', label: 'Beard', placeholder: '#2 cheeks, #4 chin, sharp line' },
  { id: 'colour', label: 'Colour / chemical', placeholder: 'Wella 6/0 + 20vol, 30 min' },
];

export function PhotoGrid({ photos, size = 'md' }: { photos: Photo[]; size?: 'sm' | 'md' }) {
  const [open, setOpen] = useState<Photo | null>(null);
  const ordered = [...ANGLES.map((a) => photos.find((p) => p.angle === a.id)), ...photos.filter((p) => p.angle === 'detail')].filter(
    (p): p is Photo => Boolean(p),
  );
  if (!ordered.length) return null;
  return (
    <>
      <div className={`grid gap-2 ${size === 'sm' ? 'grid-cols-4' : 'grid-cols-2 sm:grid-cols-4'}`}>
        {ordered.map((p) => (
          <button key={p.id} onClick={() => setOpen(p)} className="group relative aspect-[3/4] overflow-hidden rounded-xl bg-surface-2">
            <img src={p.url} alt={`${p.angle} view`} loading="lazy" className="size-full object-cover transition group-hover:scale-105" />
            <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold capitalize text-white">{p.angle}</span>
          </button>
        ))}
      </div>
      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title={<span className="capitalize">{open?.angle} view</span>} wide>
        {open && (
          <div>
            <img src={open.url} alt={`${open.angle} view`} className="mx-auto max-h-[65dvh] rounded-xl object-contain" />
            <div className="mt-3 flex justify-center gap-2">
              {ordered.map((p) => (
                <button key={p.id} onClick={() => setOpen(p)} className={`size-14 overflow-hidden rounded-lg border-2 ${p.id === open.id ? 'border-accent' : 'border-transparent'}`}>
                  <img src={p.url} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

export function TechniqueList({ technique }: { technique: Record<string, string> }) {
  const entries = Object.entries(technique).filter(([, v]) => v?.trim());
  if (!entries.length) return null;
  const label = (k: string) => TECHNIQUE_FIELDS.find((f) => f.id === k)?.label ?? k;
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {entries.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label(k)}</dt>
          <dd className="font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function VisitCard({ visit, currency, onRepeat, showSalon, highlight }: { visit: Visit; currency?: string; onRepeat?: () => void; showSalon?: boolean; highlight?: boolean }) {
  return (
    <article className={`rounded-2xl border bg-surface p-4 sm:p-5 ${highlight ? 'border-accent/50 ring-4 ring-accent/10' : 'border-border'}`}>
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{visit.service}</h3>
          <p className="text-sm text-muted">
            {date(visit.createdAt)}
            {showSalon && visit.salonName ? ` · ${visit.salonName}` : ''}
            {visit.stylistName ? ` · by ${visit.stylistName}` : ''}
            {visit.price !== null && currency ? ` · ${money(visit.price, currency)}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {visit.recovered && <Badge tone="success">Brought back by reminder</Badge>}
          {visit.repeatOfVisitId && (
            <Badge tone="accent">
              <Icons.repeat size={12} /> Repeat
            </Badge>
          )}
          {onRepeat && (
            <Button size="sm" variant="secondary" onClick={onRepeat}>
              <Icons.repeat size={14} /> Repeat this cut
            </Button>
          )}
        </div>
      </header>
      {visit.styleTags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {visit.styleTags.map((t) => (
            <Badge key={t}>{t}</Badge>
          ))}
        </div>
      )}
      <div className="space-y-4">
        <PhotoGrid photos={visit.photos} size={highlight ? 'md' : 'sm'} />
        <TechniqueList technique={visit.technique} />
        {(visit.notes || visit.products) && (
          <div className="space-y-1 rounded-xl bg-surface-2 p-3 text-sm">
            {visit.notes && <p className="whitespace-pre-line">{visit.notes}</p>}
            {visit.products && <p className="text-muted">Products: {visit.products}</p>}
          </div>
        )}
      </div>
    </article>
  );
}
