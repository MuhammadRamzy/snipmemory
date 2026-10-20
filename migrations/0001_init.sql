-- SnipMemory core schema (Cloudflare D1 / SQLite)
-- Conventions: ids are prefixed random strings, timestamps are unix epoch milliseconds,
-- money is stored in minor units (cents / paise) next to an ISO-4217 currency code.

-- ---------------------------------------------------------------------------
-- Plans & pricing
-- ---------------------------------------------------------------------------
CREATE TABLE plans (
  id                      TEXT PRIMARY KEY,
  name                    TEXT NOT NULL,
  tagline                 TEXT NOT NULL DEFAULT '',
  max_staff               INTEGER NOT NULL,          -- -1 = unlimited
  max_clients             INTEGER NOT NULL,          -- -1 = unlimited
  monthly_message_credits INTEGER NOT NULL DEFAULT 0,
  features                TEXT NOT NULL DEFAULT '[]', -- JSON array of marketing bullets
  capabilities            TEXT NOT NULL DEFAULT '[]', -- JSON array of feature flags (see worker/src/lib/plans.ts)
  is_public               INTEGER NOT NULL DEFAULT 1,
  sort_order              INTEGER NOT NULL DEFAULT 0,
  created_at              INTEGER NOT NULL,
  updated_at              INTEGER NOT NULL
);

CREATE TABLE plan_prices (
  plan_id         TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  currency        TEXT NOT NULL,                     -- USD, INR, GBP, AED, EUR ...
  interval        TEXT NOT NULL CHECK (interval IN ('month', 'year')),
  amount          INTEGER NOT NULL,                  -- minor units
  stripe_price_id TEXT,                              -- optional; inline price_data is used when NULL
  PRIMARY KEY (plan_id, currency, interval)
);

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id                TEXT PRIMARY KEY,
  email             TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name              TEXT NOT NULL,
  phone             TEXT,
  password_hash     TEXT NOT NULL,
  is_platform_admin INTEGER NOT NULL DEFAULT 0,
  disabled_at       INTEGER,
  created_at        INTEGER NOT NULL,
  last_login_at     INTEGER
);

CREATE TABLE salons (
  id                     TEXT PRIMARY KEY,
  slug                   TEXT NOT NULL UNIQUE,
  name                   TEXT NOT NULL,
  phone                  TEXT,
  email                  TEXT,
  address                TEXT,
  city                   TEXT,
  country                TEXT NOT NULL DEFAULT 'US',   -- ISO-3166 alpha-2, drives phone parsing
  timezone               TEXT NOT NULL DEFAULT 'UTC',
  currency               TEXT NOT NULL DEFAULT 'USD',
  brand_color            TEXT NOT NULL DEFAULT '#4f46e5',
  booking_url            TEXT,
  default_cadence_days   INTEGER NOT NULL DEFAULT 28,
  reminders_enabled      INTEGER NOT NULL DEFAULT 1,
  reminder_channel       TEXT NOT NULL DEFAULT 'whatsapp' CHECK (reminder_channel IN ('whatsapp', 'sms')),
  reminder_template      TEXT,
  send_window_start      INTEGER NOT NULL DEFAULT 10,  -- local hour, inclusive
  send_window_end        INTEGER NOT NULL DEFAULT 19,  -- local hour, exclusive
  plan_id                TEXT NOT NULL REFERENCES plans(id),
  billing_interval       TEXT NOT NULL DEFAULT 'month' CHECK (billing_interval IN ('month', 'year')),
  subscription_status    TEXT NOT NULL DEFAULT 'trialing'
                           CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled')),
  trial_ends_at          INTEGER,
  current_period_end     INTEGER,
  past_due_since         INTEGER,
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  message_credits        INTEGER NOT NULL DEFAULT 0,   -- monthly allowance, reset each billing period
  bonus_credits          INTEGER NOT NULL DEFAULT 0,   -- purchased packs, never expire
  credits_reset_at       INTEGER,
  referral_code          TEXT UNIQUE,
  referred_by_salon_id   TEXT,
  onboarded_at           INTEGER,
  suspended_at           INTEGER,
  suspended_reason       TEXT,
  created_at             INTEGER NOT NULL,
  updated_at             INTEGER NOT NULL,
  deleted_at             INTEGER
);
CREATE INDEX idx_salons_status ON salons(subscription_status);
CREATE INDEX idx_salons_stripe_customer ON salons(stripe_customer_id);

-- A member is a person who works at a salon. Stylists do not need an email login:
-- they unlock a shared "station" device with their PIN.
CREATE TABLE members (
  id           TEXT PRIMARY KEY,
  salon_id     TEXT NOT NULL REFERENCES salons(id),
  user_id      TEXT REFERENCES users(id),
  display_name TEXT NOT NULL,
  role         TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'stylist')),
  pin_hash     TEXT,
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   INTEGER NOT NULL,
  UNIQUE (salon_id, user_id)
);
CREATE INDEX idx_members_salon ON members(salon_id);
CREATE INDEX idx_members_user ON members(user_id);

CREATE TABLE invites (
  id          TEXT PRIMARY KEY,
  salon_id    TEXT NOT NULL REFERENCES salons(id),
  member_id   TEXT REFERENCES members(id),
  email       TEXT NOT NULL COLLATE NOCASE,
  role        TEXT NOT NULL CHECK (role IN ('manager', 'stylist')),
  token_hash  TEXT NOT NULL UNIQUE,
  created_by  TEXT NOT NULL REFERENCES users(id),
  expires_at  INTEGER NOT NULL,
  accepted_at INTEGER,
  created_at  INTEGER NOT NULL
);

-- Sessions are opaque random tokens; only their SHA-256 hash is stored.
--   kind = user     → owner / manager / stylist / platform admin signed in with email+password
--   kind = station  → a shared salon device; stylists unlock it with a PIN (acting_member_id)
--   kind = client   → an end customer signed in to their Style Passport via phone OTP
CREATE TABLE sessions (
  id               TEXT PRIMARY KEY,
  kind             TEXT NOT NULL CHECK (kind IN ('user', 'station', 'client')),
  user_id          TEXT REFERENCES users(id),
  salon_id         TEXT REFERENCES salons(id),
  passport_id      TEXT,
  impersonator_id  TEXT REFERENCES users(id),
  acting_member_id TEXT REFERENCES members(id),
  acting_until     INTEGER,
  expires_at       INTEGER NOT NULL,
  created_at       INTEGER NOT NULL,
  last_seen_at     INTEGER NOT NULL,
  ip               TEXT,
  user_agent       TEXT
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- ---------------------------------------------------------------------------
-- Clients, style passport and visits
-- ---------------------------------------------------------------------------

-- A passport is the platform-wide identity of an end customer, keyed by verified phone.
CREATE TABLE passports (
  id            TEXT PRIMARY KEY,
  phone         TEXT NOT NULL UNIQUE,  -- E.164
  name          TEXT,
  verified_at   INTEGER,
  last_login_at INTEGER,
  created_at    INTEGER NOT NULL
);

CREATE TABLE clients (
  id                   TEXT PRIMARY KEY,
  salon_id             TEXT NOT NULL REFERENCES salons(id),
  passport_id          TEXT REFERENCES passports(id),
  name                 TEXT NOT NULL,
  phone                TEXT NOT NULL,  -- E.164
  email                TEXT,
  notes                TEXT,
  hair_profile         TEXT NOT NULL DEFAULT '{}', -- JSON: texture, density, growth, scalp, allergies
  cadence_days         INTEGER,                    -- per-client override
  photo_consent_at     INTEGER,
  marketing_consent_at INTEGER,
  opted_out_at         INTEGER,
  unsubscribe_token    TEXT NOT NULL UNIQUE,
  visit_count          INTEGER NOT NULL DEFAULT 0,
  total_spend          INTEGER NOT NULL DEFAULT 0,
  last_visit_at        INTEGER,
  next_reminder_at     INTEGER,
  last_reminded_at     INTEGER,
  created_at           INTEGER NOT NULL,
  updated_at           INTEGER NOT NULL,
  deleted_at           INTEGER
);
CREATE UNIQUE INDEX idx_clients_salon_phone ON clients(salon_id, phone) WHERE deleted_at IS NULL;
CREATE INDEX idx_clients_salon_name ON clients(salon_id, name);
CREATE INDEX idx_clients_passport ON clients(passport_id);
CREATE INDEX idx_clients_reminder_due ON clients(next_reminder_at) WHERE next_reminder_at IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE visits (
  id                      TEXT PRIMARY KEY,
  salon_id                TEXT NOT NULL REFERENCES salons(id),
  client_id               TEXT NOT NULL REFERENCES clients(id),
  member_id               TEXT REFERENCES members(id),
  service                 TEXT NOT NULL DEFAULT 'Haircut',
  style_tags              TEXT NOT NULL DEFAULT '[]', -- JSON array
  technique               TEXT NOT NULL DEFAULT '{}', -- JSON: top, sides, back, neckline, beard, guards...
  notes                   TEXT,
  products                TEXT,
  duration_minutes        INTEGER,
  price                   INTEGER,                    -- minor units, salon currency
  repeat_of_visit_id      TEXT REFERENCES visits(id),
  recovered_by_message_id TEXT,                       -- reminder that brought the client back
  created_at              INTEGER NOT NULL,
  deleted_at              INTEGER
);
CREATE INDEX idx_visits_client ON visits(client_id, created_at);
CREATE INDEX idx_visits_salon_date ON visits(salon_id, created_at);

CREATE TABLE photos (
  id           TEXT PRIMARY KEY,
  salon_id     TEXT NOT NULL REFERENCES salons(id),
  visit_id     TEXT NOT NULL REFERENCES visits(id),
  angle        TEXT NOT NULL CHECK (angle IN ('front', 'left', 'right', 'back', 'detail')),
  r2_key       TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  bytes        INTEGER NOT NULL,
  blurred      INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL
);
CREATE INDEX idx_photos_visit ON photos(visit_id);
CREATE INDEX idx_photos_salon ON photos(salon_id);

-- A client lets a salon read their history from other salons (granted by OTP).
CREATE TABLE passport_shares (
  passport_id TEXT NOT NULL REFERENCES passports(id),
  salon_id    TEXT NOT NULL REFERENCES salons(id),
  granted_at  INTEGER NOT NULL,
  revoked_at  INTEGER,
  PRIMARY KEY (passport_id, salon_id)
);

CREATE TABLE otp_codes (
  id          TEXT PRIMARY KEY,
  phone       TEXT NOT NULL,
  purpose     TEXT NOT NULL CHECK (purpose IN ('passport_login', 'passport_share')),
  salon_id    TEXT,
  code_hash   TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  expires_at  INTEGER NOT NULL,
  consumed_at INTEGER,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_otp_phone ON otp_codes(phone, purpose, created_at);

-- ---------------------------------------------------------------------------
-- Messaging, billing, operations
-- ---------------------------------------------------------------------------
CREATE TABLE messages (
  id                  TEXT PRIMARY KEY,
  salon_id            TEXT,
  client_id           TEXT,
  channel             TEXT NOT NULL CHECK (channel IN ('whatsapp', 'sms')),
  kind                TEXT NOT NULL CHECK (kind IN ('reminder', 'otp', 'system')),
  to_phone            TEXT NOT NULL,
  body                TEXT NOT NULL,
  status              TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  provider            TEXT NOT NULL,
  provider_message_id TEXT,
  error               TEXT,
  credits             INTEGER NOT NULL DEFAULT 0,
  created_at          INTEGER NOT NULL
);
CREATE INDEX idx_messages_salon ON messages(salon_id, created_at);
CREATE INDEX idx_messages_client ON messages(client_id, created_at);

CREATE TABLE payments (
  id           TEXT PRIMARY KEY,
  salon_id     TEXT NOT NULL REFERENCES salons(id),
  amount       INTEGER NOT NULL,
  currency     TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('paid', 'failed', 'refunded')),
  description  TEXT NOT NULL,
  provider     TEXT NOT NULL,          -- stripe | manual | dev
  provider_ref TEXT UNIQUE,
  invoice_url  TEXT,
  created_at   INTEGER NOT NULL
);
CREATE INDEX idx_payments_salon ON payments(salon_id, created_at);

CREATE TABLE webhook_events (
  id          TEXT PRIMARY KEY,         -- provider event id, for idempotency
  provider    TEXT NOT NULL,
  type        TEXT NOT NULL,
  received_at INTEGER NOT NULL
);

CREATE TABLE audit_log (
  id              TEXT PRIMARY KEY,
  salon_id        TEXT,
  actor_user_id   TEXT,
  impersonator_id TEXT,
  action          TEXT NOT NULL,
  target_type     TEXT,
  target_id       TEXT,
  meta            TEXT NOT NULL DEFAULT '{}',
  ip              TEXT,
  created_at      INTEGER NOT NULL
);
CREATE INDEX idx_audit_salon ON audit_log(salon_id, created_at);
CREATE INDEX idx_audit_created ON audit_log(created_at);

CREATE TABLE announcements (
  id         TEXT PRIMARY KEY,
  message    TEXT NOT NULL,
  level      TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warning', 'critical')),
  active     INTEGER NOT NULL DEFAULT 1,
  expires_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE rate_limits (
  key          TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL
);

-- ---------------------------------------------------------------------------
-- Default plans (see docs/BUSINESS_PLAN.md for the reasoning behind tiers & prices)
-- ---------------------------------------------------------------------------
INSERT INTO plans (id, name, tagline, max_staff, max_clients, monthly_message_credits, features, capabilities, sort_order, created_at, updated_at) VALUES
 ('free', 'Free', 'For a single chair getting started', 1, 75, 0,
  '["1 stylist","Up to 75 clients","4-angle cut photos & notes","Manual WhatsApp reminders (click-to-send)","Client Style Passport"]',
  '[]', 0, 0, 0),
 ('solo', 'Solo', 'For the independent barber or stylist', 1, -1, 100,
  '["1 stylist","Unlimited clients & photos","100 automated reminders / month","Smart return-cycle reminders","Repeat-last-cut in one tap","Revenue recovered report"]',
  '["automated_reminders","analytics"]', 1, 0, 0),
 ('studio', 'Studio', 'For shops with a team on the floor', 6, -1, 400,
  '["Up to 6 stylists","Shared station mode with stylist PINs","400 automated reminders / month","Passport import from other salons","Team & stylist performance analytics","CSV export"]',
  '["automated_reminders","analytics","station_mode","passport_import","export"]', 2, 0, 0),
 ('chain', 'Multi-location', 'For growing brands and franchises (price per location)', -1, -1, 1000,
  '["Unlimited stylists","1,000 automated reminders / month","Everything in Studio","Custom brand colour on client messages","Priority WhatsApp support","Onboarding & data migration"]',
  '["automated_reminders","analytics","station_mode","passport_import","export","branding","priority_support"]', 3, 0, 0);

INSERT INTO plan_prices (plan_id, currency, interval, amount) VALUES
 ('solo',   'USD', 'month',   1200), ('solo',   'USD', 'year',  12000),
 ('studio', 'USD', 'month',   3900), ('studio', 'USD', 'year',  39000),
 ('chain',  'USD', 'month',   7900), ('chain',  'USD', 'year',  79000),
 ('solo',   'INR', 'month',  29900), ('solo',   'INR', 'year', 299000),
 ('studio', 'INR', 'month',  89900), ('studio', 'INR', 'year', 899000),
 ('chain',  'INR', 'month', 199900), ('chain',  'INR', 'year',1999000),
 ('solo',   'GBP', 'month',   1000), ('solo',   'GBP', 'year',  10000),
 ('studio', 'GBP', 'month',   3200), ('studio', 'GBP', 'year',  32000),
 ('chain',  'GBP', 'month',   6500), ('chain',  'GBP', 'year',  65000),
 ('solo',   'AED', 'month',   4500), ('solo',   'AED', 'year',  45000),
 ('studio', 'AED', 'month',  14500), ('studio', 'AED', 'year', 145000),
 ('chain',  'AED', 'month',  29000), ('chain',  'AED', 'year', 290000),
 ('solo',   'EUR', 'month',   1100), ('solo',   'EUR', 'year',  11000),
 ('studio', 'EUR', 'month',   3500), ('studio', 'EUR', 'year',  35000),
 ('chain',  'EUR', 'month',   7200), ('chain',  'EUR', 'year',  72000);
