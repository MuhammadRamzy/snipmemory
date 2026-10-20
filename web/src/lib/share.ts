/** Opens WhatsApp with a ready message. Works with the WhatsApp app or WhatsApp Business. */
export function whatsapp(phone: string | null | undefined, text: string) {
  const digits = phone?.replace(/\D/g, '') ?? '';
  const url = `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener');
}

/** System share sheet when available (WhatsApp, SMS, Telegram…), otherwise WhatsApp. */
export async function shareText(text: string, url?: string) {
  if (navigator.share) {
    try {
      await navigator.share({ text, url });
      return;
    } catch {
      // cancelled — fall through only if share is unsupported
      return;
    }
  }
  whatsapp(null, url ? `${text}\n${url}` : text);
}

export async function shareFile(file: File, text: string): Promise<boolean> {
  const data = { files: [file], text };
  if (navigator.canShare?.(data)) {
    try {
      await navigator.share(data);
      return true;
    } catch {
      return true;
    }
  }
  return false;
}

export function callPhone(phone: string) {
  window.location.href = `tel:${phone}`;
}
