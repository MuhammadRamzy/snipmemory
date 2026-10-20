const DAY = 86_400_000;

export function money(minor: number | null | undefined, currency: string): string {
  if (minor === null || minor === undefined) return '—';
  const zeroDecimal = minor % 100 === 0;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: zeroDecimal ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

export function date(ts: number | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  if (!ts) return '—';
  return new Intl.DateTimeFormat(undefined, opts).format(ts);
}

export function dateTime(ts: number | null | undefined): string {
  return date(ts, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function relative(ts: number | null | undefined): string {
  if (!ts) return 'never';
  const diff = ts - Date.now();
  const days = Math.round(diff / DAY);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (Math.abs(days) < 1) {
    const hours = Math.round(diff / 3_600_000);
    return Math.abs(hours) < 1 ? 'just now' : rtf.format(hours, 'hour');
  }
  if (Math.abs(days) < 45) return rtf.format(days, 'day');
  if (Math.abs(days) < 365) return rtf.format(Math.round(days / 30), 'month');
  return rtf.format(Math.round(days / 365), 'year');
}

export function daysSince(ts: number | null | undefined): number | null {
  return ts ? Math.floor((Date.now() - ts) / DAY) : null;
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export function plural(n: number, word: string, pluralWord = `${word}s`) {
  return `${n.toLocaleString()} ${n === 1 ? word : pluralWord}`;
}

/** Converts a "450.00" style input into minor units. */
export function toMinor(input: string): number | null {
  const n = Number(input.replace(/[^\d.]/g, ''));
  return input.trim() && Number.isFinite(n) ? Math.round(n * 100) : null;
}
