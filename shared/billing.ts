// Pure bill arithmetic — no I/O, unit tested. All money in paise.

export interface LineInput {
  kind: 'service' | 'product' | 'custom';
  refId: string | null;
  name: string;
  qty: number;
  unitPrice: number;
  staffId: string;
}

export interface Line extends LineInput {
  amount: number;
  net: number;
  commission: number;
  cost: number;
}

export interface Totals {
  lines: Line[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

export interface CommissionRates {
  service: number; // percent
  product: number;
}

/**
 * - Bill discount is spread across lines in proportion to their amount (remainder on the last line).
 * - GST inclusive: prices already contain GST; `tax` is the GST part of the total.
 *   GST exclusive: GST is added on top of the discounted amount.
 * - Commission is paid on each line's pre-GST net amount at the stylist's rate.
 */
export function computeBill(
  inputs: LineInput[],
  discount: number,
  gst: { enabled: boolean; rate: number; inclusive: boolean },
  rates: (staffId: string) => CommissionRates,
  costOf: (line: LineInput) => number = () => 0,
): Totals {
  const amounts = inputs.map((l) => l.qty * l.unitPrice);
  const subtotal = amounts.reduce((a, b) => a + b, 0);
  const disc = Math.max(0, Math.min(discount, subtotal));
  let allocated = 0;
  const nets = amounts.map((amount, i) => {
    if (i === amounts.length - 1) return amount - (disc - allocated);
    const share = subtotal ? Math.floor((disc * amount) / subtotal) : 0;
    allocated += share;
    return amount - share;
  });
  const afterDiscount = subtotal - disc;
  const r = gst.enabled ? gst.rate / 100 : 0;
  const total = gst.enabled && !gst.inclusive ? Math.round(afterDiscount * (1 + r)) : afterDiscount;
  const tax = gst.enabled ? (gst.inclusive ? total - Math.round(total / (1 + r)) : total - afterDiscount) : 0;
  const preTax = (net: number) => (gst.enabled && gst.inclusive ? net / (1 + r) : net);

  const lines = inputs.map((l, i) => {
    const rate = rates(l.staffId);
    const pct = l.kind === 'product' ? rate.product : rate.service;
    return {
      ...l,
      amount: amounts[i],
      net: nets[i],
      commission: Math.round((preTax(nets[i]) * pct) / 100),
      cost: costOf(l) * l.qty,
    };
  });
  return { lines, subtotal, discount: disc, tax, total };
}

/** Splits an inclusive GST amount into CGST + SGST halves for the invoice. */
export function splitGst(tax: number): { cgst: number; sgst: number } {
  const cgst = Math.floor(tax / 2);
  return { cgst, sgst: tax - cgst };
}
