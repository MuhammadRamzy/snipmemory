import qrcode from 'qrcode-generator';

/**
 * UPI deep link (NPCI spec). Every UPI app — GPay, PhonePe, Paytm, BHIM — can scan it,
 * and the amount is filled in for the customer.
 */
export function upiLink(opts: { vpa: string; name: string; amount: number; note?: string; ref?: string }): string {
  const params = new URLSearchParams({ pa: opts.vpa, pn: opts.name.slice(0, 40), am: (opts.amount / 100).toFixed(2), cu: 'INR' });
  if (opts.note) params.set('tn', opts.note.slice(0, 50));
  if (opts.ref) params.set('tr', opts.ref.slice(0, 35));
  return `upi://pay?${params.toString().replace(/\+/g, '%20')}`;
}

/** SVG markup for a QR code (rendered locally — works offline). */
export function qrSvg(text: string): string {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
}

/** PNG blob of the QR (for sharing on WhatsApp). */
export async function qrPng(text: string, caption: string): Promise<Blob> {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const cell = 10;
  const pad = 40;
  const size = n * cell + pad * 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size + 70;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect(pad + c * cell, pad + r * cell, cell, cell);
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(caption, size / 2, size + 40);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
}
