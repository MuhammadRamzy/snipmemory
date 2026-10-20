export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;

  APP_ENV: 'development' | 'test' | 'production';
  APP_URL: string;
  /** `log` (development: messages are only recorded) or `live` (WhatsApp Cloud API with Twilio SMS fallback) */
  MESSAGING_PROVIDER: string;
  OTP_CHANNEL: 'sms' | 'whatsapp';
  /**
   * Comma separated. Outside production, users signing up with these emails become platform admins.
   * In production grant admin with SQL instead (see README) — there is no email verification at signup.
   */
  PLATFORM_ADMIN_EMAILS?: string;

  RESEND_API_KEY?: string;
  /** e.g. "SnipMemory <hello@snipmemory.app>" — must be a domain verified in Resend. */
  EMAIL_FROM?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_FROM?: string;
  WHATSAPP_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  /** "template_name:language", body params: {{1}} name, {{2}} salon, {{3}} days, {{4}} link */
  WHATSAPP_REMINDER_TEMPLATE?: string;
  /** "template_name:language", an Authentication template with a copy-code button */
  WHATSAPP_OTP_TEMPLATE?: string;
}
