export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;

  APP_ENV: 'development' | 'test' | 'production';
  APP_URL: string;
  /** SnipMemory's own UPI ID — shops pay their subscription here and submit the UTR. */
  PLATFORM_UPI_VPA: string;
  PLATFORM_UPI_NAME: string;
  /** WhatsApp number (digits, with country code) shown for help & PIN resets. */
  SUPPORT_WHATSAPP: string;
}
