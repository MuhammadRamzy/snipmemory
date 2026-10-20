import { rs } from './format';
import type { Shop } from './types';

export interface ReceiptData {
  number: string | null;
  lines: { name: string; qty: number; unitPrice: number }[];
  total: number;
  paid: { cash: number; upi: number; card: number; advance: number };
  due: number;
  link: string | null;
}

/** Plain-text bill for WhatsApp (works on every phone, no app needed). */
export function receiptText(shop: Shop, r: ReceiptData, customerName?: string | null): string {
  const lines = [
    `*${shop.name}*`,
    r.number ? `Bill #${r.number}` : 'Bill',
    customerName ? `Customer: ${customerName}` : null,
    '',
    ...r.lines.map((l) => `${l.name}${l.qty > 1 ? ` × ${l.qty}` : ''} — ${rs(l.unitPrice * l.qty)}`),
    '',
    `*Total: ${rs(r.total)}*`,
    r.paid.upi ? `Paid by UPI: ${rs(r.paid.upi)}` : null,
    r.paid.cash ? `Paid in cash: ${rs(r.paid.cash)}` : null,
    r.paid.card ? `Paid by card: ${rs(r.paid.card)}` : null,
    r.paid.advance ? `From advance: ${rs(r.paid.advance)}` : null,
    r.due ? `*Balance to pay: ${rs(r.due)}*` : null,
    r.link ? `\nView bill: ${r.link}` : null,
    '',
    shop.billFooter || 'Thank you! Visit again 🙏',
  ];
  return lines.filter((l) => l !== null).join('\n');
}
