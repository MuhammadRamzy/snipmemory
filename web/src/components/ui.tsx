import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router';
import { initials, rs } from '../lib/format';
import { I, type IconName } from './icons';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------
type Variant = 'brand' | 'secondary' | 'ghost' | 'danger' | 'money' | 'dark';
const VARIANTS: Record<Variant, string> = {
  brand: 'bg-brand text-brand-ink active:brightness-95',
  secondary: 'bg-surface text-ink border-2 border-line active:bg-surface-2',
  ghost: 'text-ink active:bg-surface-2',
  danger: 'bg-danger text-white active:brightness-95',
  money: 'bg-money text-white active:brightness-95',
  dark: 'bg-ink text-bg active:opacity-90',
};

export function Button({
  variant = 'brand',
  size = 'md',
  block,
  loading,
  icon,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' | 'xl'; block?: boolean; loading?: boolean; icon?: IconName }) {
  const Icon = icon ? I[icon] : null;
  return (
    <button
      className={cx(
        'inline-flex select-none items-center justify-center gap-2 rounded-2xl font-bold transition disabled:opacity-45',
        size === 'sm' && 'h-10 px-3.5 text-sm',
        size === 'md' && 'h-12 px-5 text-base',
        size === 'lg' && 'h-14 px-6 text-lg',
        size === 'xl' && 'h-16 px-6 text-xl',
        block && 'w-full',
        VARIANTS[variant],
        className,
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <Spinner /> : Icon && <Icon size={size === 'sm' ? 18 : 22} />}
      {children}
    </button>
  );
}

export function Spinner({ className = 'size-5' }: { className?: string }) {
  return (
    <svg className={cx('animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-label="Loading">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Loading() {
  return (
    <div className="grid min-h-[40vh] place-items-center text-muted">
      <Spinner className="size-8" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Screen layout: top bar with back + title, scrolling content
// ---------------------------------------------------------------------------
export function Screen({
  title,
  back,
  right,
  children,
  wide,
  noNavPad,
}: {
  title?: ReactNode;
  back?: string | true;
  right?: ReactNode;
  children: ReactNode;
  wide?: boolean;
  noNavPad?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <div className="min-h-dvh">
      {(title || back || right) && (
        <header className="pt-safe sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur no-print">
          <div className={cx('mx-auto flex h-15 items-center gap-1 px-2', wide ? 'max-w-3xl' : 'max-w-xl')}>
            {back && (
              <button
                onClick={() => (back === true ? navigate(-1) : navigate(back))}
                className="grid size-12 place-items-center rounded-full active:bg-surface-2"
                aria-label="Back"
              >
                <I.back size={26} />
              </button>
            )}
            <h1 className={cx('min-w-0 flex-1 truncate text-lg font-bold', !back && 'pl-3')}>{title}</h1>
            {right}
          </div>
        </header>
      )}
      <main className={cx('rise mx-auto px-4 pt-4', wide ? 'max-w-3xl' : 'max-w-xl', noNavPad ? 'pb-10' : 'pb-32')}>{children}</main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bottom navigation (with a centre "New bill" button)
// ---------------------------------------------------------------------------
export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
  center?: boolean;
}

export function BottomNav({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface no-print">
      <div className="mx-auto grid max-w-xl grid-cols-5 items-end px-1 pt-1.5">
        {items.map((item) => {
          const Icon = I[item.icon];
          const active = item.end ? pathname === item.to : pathname.startsWith(item.to);
          if (item.center) {
            return (
              <Link key={item.to} to={item.to} className="-mt-6 flex flex-col items-center gap-1" aria-label={item.label}>
                <span className="grid size-16 place-items-center rounded-full bg-brand text-brand-ink shadow-lg ring-4 ring-bg">
                  <Icon size={30} strokeWidth={2.6} />
                </span>
                <span className="text-xs font-bold text-brand-text">{item.label}</span>
              </Link>
            );
          }
          return (
            <Link key={item.to} to={item.to} className={cx('flex flex-col items-center gap-0.5 py-1.5 text-xs font-semibold', active ? 'text-brand-text' : 'text-muted')}>
              <span className={cx('grid h-8 w-14 place-items-center rounded-full', active && 'bg-brand-soft')}>
                <Icon size={23} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------
export function Field({ label, hint, error, children }: { label?: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-[15px] font-semibold">{label}</span>}
      {children}
      {error ? <span className="mt-1 block text-sm font-medium text-danger">{error}</span> : hint ? <span className="mt-1 block text-sm text-muted">{hint}</span> : null}
    </label>
  );
}

export function Input({
  label,
  hint,
  error,
  prefix,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode; hint?: ReactNode; error?: string | null; prefix?: ReactNode }) {
  return (
    <Field label={label} hint={hint} error={error}>
      <span className="flex h-14 items-center rounded-2xl border-2 border-line bg-surface px-4 focus-within:border-brand">
        {prefix && <span className="mr-2 font-semibold text-muted">{prefix}</span>}
        <input className={cx('h-full w-full min-w-0 bg-transparent text-[17px] font-medium outline-none placeholder:text-muted/60', className)} {...props} />
      </span>
    </Field>
  );
}

export function TextArea({ label, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: ReactNode }) {
  return (
    <Field label={label}>
      <textarea className="min-h-24 w-full rounded-2xl border-2 border-line bg-surface p-4 text-[17px] outline-none focus:border-brand" {...props} />
    </Field>
  );
}

export function Select({ label, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: ReactNode }) {
  return (
    <Field label={label}>
      <select className="h-14 w-full rounded-2xl border-2 border-line bg-surface px-4 text-[17px] font-medium outline-none focus:border-brand" {...props}>
        {children}
      </select>
    </Field>
  );
}

/** Rupee amount input that edits a paise value. */
export function MoneyInput({ value, onChange, label, hint, autoFocus }: { value: number; onChange: (p: number) => void; label?: ReactNode; hint?: ReactNode; autoFocus?: boolean }) {
  const [text, setText] = useState(value ? String(value / 100) : '');
  useEffect(() => {
    const current = Math.round(Number(text || '0') * 100);
    if (current !== value) setText(value ? String(value / 100) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <Input
      label={label}
      hint={hint}
      prefix="₹"
      inputMode="decimal"
      value={text}
      autoFocus={autoFocus}
      placeholder="0"
      className="text-xl font-bold"
      onChange={(e) => {
        const clean = e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
        setText(clean);
        onChange(Math.round(Number(clean || '0') * 100));
      }}
    />
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center gap-3 py-2 text-left" role="switch" aria-checked={checked}>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{label}</span>
        {hint && <span className="block text-sm text-muted">{hint}</span>}
      </span>
      <span className={cx('relative h-8 w-14 shrink-0 rounded-full transition', checked ? 'bg-brand' : 'bg-line')}>
        <span className={cx('absolute top-1 size-6 rounded-full bg-white shadow transition-all', checked ? 'left-7' : 'left-1')} />
      </span>
    </button>
  );
}

export function Chips<T extends string>({ value, onChange, options, scroll }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; scroll?: boolean }) {
  return (
    <div className={cx('flex gap-2', scroll ? '-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none]' : 'flex-wrap')}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'h-10 shrink-0 whitespace-nowrap rounded-full border-2 px-4 text-sm font-bold transition',
            value === o.value ? 'border-brand bg-brand text-brand-ink' : 'border-line bg-surface text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content blocks
// ---------------------------------------------------------------------------
export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return onClick ? (
    <button onClick={onClick} className={cx('block w-full rounded-3xl border border-line bg-surface text-left active:bg-surface-2', className)}>
      {children}
    </button>
  ) : (
    <div className={cx('rounded-3xl border border-line bg-surface', className)}>{children}</div>
  );
}

export function Section({ title, action, children }: { title?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-6">
      {(title || action) && (
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-[15px] font-bold uppercase tracking-wide text-muted">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Row({
  title,
  sub,
  right,
  left,
  to,
  onClick,
  chevron = true,
  danger,
}: {
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  left?: ReactNode;
  to?: string;
  onClick?: () => void;
  chevron?: boolean;
  danger?: boolean;
}) {
  const inner = (
    <>
      {left}
      <span className="min-w-0 flex-1">
        <span className={cx('block truncate text-[17px] font-semibold', danger && 'text-danger')}>{title}</span>
        {sub && <span className="block truncate text-sm text-muted">{sub}</span>}
      </span>
      {right}
      {(to || onClick) && chevron && <I.right size={20} className="shrink-0 text-muted" />}
    </>
  );
  const cls = 'flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left';
  if (to) return <Link to={to} className={cx(cls, 'active:bg-surface-2')}>{inner}</Link>;
  if (onClick) return <button onClick={onClick} className={cx(cls, 'active:bg-surface-2')}>{inner}</button>;
  return <div className={cls}>{inner}</div>;
}

export function List({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">{children}</div>;
}

export function IconTile({ icon, tone = 'brand' }: { icon: IconName; tone?: 'brand' | 'money' | 'due' | 'muted' | 'danger' | 'warn' }) {
  const Icon = I[icon];
  const tones = {
    brand: 'bg-brand-soft text-brand-text',
    money: 'bg-money-soft text-money',
    due: 'bg-due-soft text-due',
    muted: 'bg-surface-2 text-muted',
    danger: 'bg-danger-soft text-danger',
    warn: 'bg-warn-soft text-warn',
  };
  return (
    <span className={cx('grid size-11 shrink-0 place-items-center rounded-2xl', tones[tone])}>
      <Icon />
    </span>
  );
}

export function Avatar({ name, color, size = 44 }: { name: string; color?: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.38, background: color ?? 'var(--brand)' }}
    >
      {initials(name) || '?'}
    </span>
  );
}

type Tone = 'neutral' | 'brand' | 'money' | 'due' | 'danger' | 'warn';
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  const tones: Record<Tone, string> = {
    neutral: 'bg-surface-2 text-muted',
    brand: 'bg-brand-soft text-brand-text',
    money: 'bg-money-soft text-money',
    due: 'bg-due-soft text-due',
    danger: 'bg-danger-soft text-danger',
    warn: 'bg-warn-soft text-warn',
  };
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold', tones[tone])}>{children}</span>;
}

export function Money({ value, tone, className }: { value: number; tone?: 'auto' | 'money' | 'due'; className?: string }) {
  const color = tone === 'money' ? 'text-money' : tone === 'due' ? 'text-due' : tone === 'auto' ? (value < 0 ? 'text-due' : 'text-money') : '';
  return <span className={cx('font-bold tabular-nums', color, className)}>{rs(value)}</span>;
}

export function Notice({ tone = 'brand', icon, title, children, action }: { tone?: Tone; icon?: IconName; title?: ReactNode; children?: ReactNode; action?: ReactNode }) {
  const tones: Record<Tone, string> = {
    neutral: 'bg-surface-2 text-ink',
    brand: 'bg-brand-soft text-brand-text',
    money: 'bg-money-soft text-money',
    due: 'bg-due-soft text-due',
    danger: 'bg-danger-soft text-danger',
    warn: 'bg-warn-soft text-warn',
  };
  const Icon = icon ? I[icon] : null;
  return (
    <div className={cx('flex items-start gap-3 rounded-2xl p-4', tones[tone])}>
      {Icon && <Icon className="mt-0.5 shrink-0" />}
      <div className="min-w-0 flex-1">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className="text-[15px] leading-snug opacity-90">{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

export function Empty({ icon = 'receipt', title, children, action }: { icon?: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  const Icon = I[icon];
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-3 grid size-16 place-items-center rounded-3xl bg-surface-2 text-muted">
        <Icon size={30} />
      </span>
      <p className="text-lg font-bold">{title}</p>
      {children && <p className="mt-1 max-w-xs text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorBox({ error, retry }: { error: unknown; retry?: () => void }) {
  if (!error) return null;
  return (
    <Notice tone="danger" icon="alert" title={error instanceof Error ? error.message : String(error)} action={retry && <Button size="sm" variant="secondary" onClick={retry} icon="refresh">Try again</Button>} />
  );
}

// ---------------------------------------------------------------------------
// Bottom sheet (instead of browser pop-ups)
// ---------------------------------------------------------------------------
export function Sheet({ open, onClose, title, children, full }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; full?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button className="absolute inset-0 bg-black/45" aria-label="Close" onClick={onClose} />
      <div
        className={cx(
          'sheet-in pb-safe relative flex w-full max-w-xl flex-col rounded-t-[28px] bg-bg sm:rounded-[28px]',
          full ? 'h-[94dvh]' : 'max-h-[92dvh]',
        )}
      >
        <div className="flex items-center gap-2 px-5 pb-2 pt-3">
          <span className="absolute left-1/2 top-2 h-1.5 w-12 -translate-x-1/2 rounded-full bg-line" />
          <h2 className="mt-3 min-w-0 flex-1 truncate text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="mt-3 grid size-11 place-items-center rounded-full bg-surface-2" aria-label="Close">
            <I.x />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-2">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Confirm / ask dialogs and toasts (app-wide)
// ---------------------------------------------------------------------------
interface AskOptions {
  title: string;
  body?: ReactNode;
  confirm?: string;
  cancel?: string;
  danger?: boolean;
  input?: { label: string; placeholder?: string; required?: boolean };
}

interface UiValue {
  ask: (o: AskOptions) => Promise<string | boolean | null>;
  toast: (text: string, tone?: 'ok' | 'error') => void;
}

const UiCtx = createContext<UiValue | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<(AskOptions & { resolve: (v: string | boolean | null) => void }) | null>(null);
  const [text, setText] = useState('');
  const [toasts, setToasts] = useState<{ id: number; text: string; tone: 'ok' | 'error' }[]>([]);
  const seq = useRef(0);

  const ask = useCallback(
    (o: AskOptions) =>
      new Promise<string | boolean | null>((resolve) => {
        setText('');
        setDialog({ ...o, resolve });
      }),
    [],
  );
  const toast = useCallback((t: string, tone: 'ok' | 'error' = 'ok') => {
    const id = ++seq.current;
    setToasts((list) => [...list, { id, text: t, tone }]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), 3200);
  }, []);

  const close = (v: string | boolean | null) => {
    dialog?.resolve(v);
    setDialog(null);
  };

  return (
    <UiCtx.Provider value={{ ask, toast }}>
      {children}
      <Sheet open={Boolean(dialog)} onClose={() => close(dialog?.input ? null : false)} title={dialog?.title}>
        {dialog && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              close(dialog.input ? text.trim() : true);
            }}
            className="space-y-5"
          >
            {dialog.body && <div className="text-[17px] text-muted">{dialog.body}</div>}
            {dialog.input && <Input label={dialog.input.label} placeholder={dialog.input.placeholder} value={text} onChange={(e) => setText(e.target.value)} autoFocus />}
            <div className="grid grid-cols-2 gap-3">
              <Button type="button" variant="secondary" size="lg" onClick={() => close(dialog.input ? null : false)}>
                {dialog.cancel ?? 'No'}
              </Button>
              <Button type="submit" variant={dialog.danger ? 'danger' : 'brand'} size="lg" disabled={dialog.input?.required && !text.trim()}>
                {dialog.confirm ?? 'Yes'}
              </Button>
            </div>
          </form>
        )}
      </Sheet>
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4">
          {toasts.map((t) => (
            <div key={t.id} className={cx('rise flex items-center gap-2 rounded-2xl px-4 py-3 font-semibold shadow-lg', t.tone === 'ok' ? 'bg-ink text-bg' : 'bg-danger text-white')}>
              {t.tone === 'ok' ? <I.check size={20} /> : <I.alert size={20} />}
              {t.text}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </UiCtx.Provider>
  );
}

export function useUi(): UiValue {
  const ctx = useContext(UiCtx);
  if (!ctx) throw new Error('useUi outside UiProvider');
  return ctx;
}

// ---------------------------------------------------------------------------
// PIN pad — looks like the UPI PIN screen everyone already knows
// ---------------------------------------------------------------------------
export function PinPad({ length, value, onChange, onDone }: { length: number; value: string; onChange: (v: string) => void; onDone?: (v: string) => void }) {
  const press = (d: string) => {
    if (value.length >= length) return;
    const next = value + d;
    onChange(next);
    if (next.length === length) onDone?.(next);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') onChange(value.slice(0, -1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <div>
      <div className="mb-6 flex justify-center gap-3" aria-label={`${value.length} of ${length} digits`}>
        {Array.from({ length }, (_, i) => (
          <span key={i} className={cx('grid size-12 place-items-center rounded-2xl border-2 text-2xl font-bold', i < value.length ? 'border-brand bg-brand-soft' : 'border-line bg-surface')}>
            {i < value.length ? '●' : ''}
          </span>
        ))}
      </div>
      <div className="mx-auto grid max-w-xs grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" onClick={() => press(d)} className="h-16 rounded-2xl bg-surface text-2xl font-bold shadow-sm active:bg-surface-2">
            {d}
          </button>
        ))}
        <span />
        <button type="button" onClick={() => press('0')} className="h-16 rounded-2xl bg-surface text-2xl font-bold shadow-sm active:bg-surface-2">
          0
        </button>
        <button type="button" onClick={() => onChange(value.slice(0, -1))} className="grid h-16 place-items-center rounded-2xl text-muted active:bg-surface-2" aria-label="Delete">
          <I.delete size={28} />
        </button>
      </div>
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'money' | 'due' | 'brand' }) {
  return (
    <div className="rounded-3xl border border-line bg-surface p-4">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className={cx('mt-0.5 text-2xl font-extrabold tabular-nums', tone === 'money' && 'text-money', tone === 'due' && 'text-due', tone === 'brand' && 'text-brand-text')}>{value}</p>
      {sub && <p className="text-sm text-muted">{sub}</p>}
    </div>
  );
}
