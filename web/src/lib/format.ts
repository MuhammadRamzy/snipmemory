/** ₹ formatting in Indian digit grouping: ₹1,25,000. Paise only shown when present. */
export function rs(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return '—';
  const neg = paise < 0;
  const abs = Math.abs(paise);
  const whole = abs % 100 === 0;
  const s = new Intl.NumberFormat('en-IN', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 }).format(abs / 100);
  return `${neg ? '−' : ''}₹${s}`;
}

/** "450" or "450.50" → paise. Returns 0 for empty input. */
export function toPaise(input: string): number {
  const n = Number(input.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function rupeesInput(paise: number): string {
  return paise ? String(paise / 100) : '';
}

const TZ = 'Asia/Kolkata';

export function dayKey(at = Date.now()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

export function shiftDay(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function dayLabel(day: string): string {
  const today = dayKey();
  if (day === today) return 'Today';
  if (day === shiftDay(today, -1)) return 'Yesterday';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`));
}

export function time(ts: number): string {
  return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: TZ }).format(ts);
}

export function dateTime(ts: number): string {
  return `${dayLabel(dayKey(ts))}, ${time(ts)}`;
}

export function date(ts: number | null | undefined): string {
  if (!ts) return '—';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ }).format(ts);
}

export function monthLabel(month: string): string {
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`));
}

export function daysAgo(ts: number | null | undefined): string {
  if (!ts) return 'never';
  const d = Math.floor((Date.now() - ts) / 86_400_000);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 60) return `${d} days ago`;
  return `${Math.round(d / 30)} months ago`;
}

/** +919876543210 → 98765 43210 */
export function phoneDisplay(phone: string | null | undefined): string {
  if (!phone) return '';
  if (phone.includes('•')) return phone;
  const local = phone.startsWith('+91') ? phone.slice(3) : phone.replace(/^\+/, '');
  return local.length === 10 ? `${local.slice(0, 5)} ${local.slice(5)}` : phone;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}
