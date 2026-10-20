// Lightweight E.164 normalisation. We intentionally avoid shipping libphonenumber
// (≈150 KB) to the Worker; salons enter local numbers and we prefix their country code.

const CALLING_CODES: Record<string, string> = {
  US: '1', CA: '1', GB: '44', IE: '353', IN: '91', AE: '971', SA: '966', QA: '974', KW: '965', OM: '968', BH: '973',
  PK: '92', BD: '880', LK: '94', NP: '977', AU: '61', NZ: '64', SG: '65', MY: '60', ID: '62', PH: '63', TH: '66',
  ZA: '27', NG: '234', KE: '254', EG: '20', TR: '90', DE: '49', FR: '33', ES: '34', IT: '39', NL: '31', BE: '32',
  PT: '351', SE: '46', NO: '47', DK: '45', PL: '48', BR: '55', MX: '52', AR: '54', CO: '57', CL: '56',
};

export const SUPPORTED_COUNTRIES = Object.keys(CALLING_CODES);

export function callingCode(country: string): string {
  return CALLING_CODES[country.toUpperCase()] ?? '1';
}

/**
 * Normalises user input to E.164 (`+919876543210`). Returns null if it can't be a phone number.
 * - `+44 7700 900123` → `+447700900123`
 * - `07700 900123` with country GB → `+447700900123`
 * - `00971 50 123 4567` → `+971501234567`
 */
export function normalizePhone(input: string, defaultCountry: string): string | null {
  const trimmed = input.trim();
  let digits = trimmed.replace(/[^\d]/g, '');
  if (!digits) return null;

  let e164: string;
  if (trimmed.startsWith('+')) {
    e164 = digits;
  } else if (digits.startsWith('00')) {
    e164 = digits.slice(2);
  } else {
    const cc = callingCode(defaultCountry);
    if (digits.startsWith('0')) digits = digits.replace(/^0+/, '');
    // Already includes the country code (e.g. 919876543210 for IN with 12 digits)
    e164 = digits.startsWith(cc) && digits.length > 10 ? digits : cc + digits;
  }
  if (e164.length < 8 || e164.length > 15) return null;
  return `+${e164}`;
}

/** `+919876543210` → `••••••3210` for display to people who should not see the full number. */
export function maskPhone(phone: string): string {
  return `${'•'.repeat(Math.max(0, phone.length - 4))}${phone.slice(-4)}`;
}
