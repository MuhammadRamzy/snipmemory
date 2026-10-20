-- SnipMemory v3 — POS + ERP for Indian salons and barbershops (Cloudflare D1 / SQLite)
-- Conventions: ids are prefixed random strings; timestamps are unix epoch ms;
-- money is integer paise; `day` columns are the shop's local business date (YYYY-MM-DD).

-- ---------------------------------------------------------------------------
-- Platform plans (what shops pay SnipMemory). Prices in paise, INR.
-- ---------------------------------------------------------------------------
CREATE TABLE plans (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  tagline            TEXT NOT NULL DEFAULT '',
  max_staff          INTEGER NOT NULL,          -- people who can bill, including the owner; -1 = unlimited
  monthly_bill_limit INTEGER NOT NULL,          -- -1 = unlimited
  price_month        INTEGER NOT NULL,
  price_year         INTEGER NOT NULL,
  features           TEXT NOT NULL DEFAULT '[]', -- marketing bullets
  capabilities       TEXT NOT NULL DEFAULT '[]', -- feature flags, see worker/src/lib/plans.ts
  is_public          INTEGER NOT NULL DEFAULT 1,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  updated_at         INTEGER NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- People & shops
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id                TEXT PRIMARY KEY,
  phone             TEXT NOT NULL UNIQUE,        -- E.164, the login id
  name              TEXT NOT NULL,
  pin_hash          TEXT NOT NULL,
  pin_must_change   INTEGER NOT NULL DEFAULT 0,  -- set when owner/support resets a PIN
  password_hash     TEXT,                        -- only platform admins
  is_platform_admin INTEGER NOT NULL DEFAULT 0,
  language          TEXT NOT NULL DEFAULT 'en',
  disabled_at       INTEGER,
  created_at        INTEGER NOT NULL,
  last_login_at     INTEGER
);

CREATE TABLE shops (
  id                    TEXT PRIMARY KEY,
  owner_user_id         TEXT NOT NULL REFERENCES users(id),
  name                  TEXT NOT NULL,
  shop_type             TEXT NOT NULL DEFAULT 'gents' CHECK (shop_type IN ('gents', 'unisex', 'ladies', 'spa')),
  phone                 TEXT,
  address               TEXT,
  city                  TEXT,
  state                 TEXT,
  timezone              TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  upi_vpa               TEXT,                    -- e.g. ramesh@okaxis, shown as QR on every bill
  upi_name              TEXT,
  gst_enabled           INTEGER NOT NULL DEFAULT 0,
  gstin                 TEXT,
  gst_rate              INTEGER NOT NULL DEFAULT 18,
  gst_inclusive         INTEGER NOT NULL DEFAULT 1,
  bill_prefix           TEXT NOT NULL DEFAULT '',
  next_bill_no          INTEGER NOT NULL DEFAULT 1,
  bill_footer           TEXT,
  staff_can_discount    INTEGER NOT NULL DEFAULT 1,
  staff_max_discount    INTEGER NOT NULL DEFAULT 20, -- percent
  staff_see_phone       INTEGER NOT NULL DEFAULT 1,
  winback_days          INTEGER NOT NULL DEFAULT 30,
  plan_id               TEXT NOT NULL REFERENCES plans(id),
  plan_expires_at       INTEGER,                 -- NULL for free
  trial                 INTEGER NOT NULL DEFAULT 0,
  onboarded_at          INTEGER,
  suspended_at          INTEGER,
  suspended_reason      TEXT,
  created_at            INTEGER NOT NULL,
  updated_at            INTEGER NOT NULL,
  deleted_at            INTEGER
);
CREATE INDEX idx_shops_owner ON shops(owner_user_id);

-- Everyone who works in a shop, including the owner. Staff log in with their own phone + PIN.
CREATE TABLE staff (
  id                     TEXT PRIMARY KEY,
  shop_id                TEXT NOT NULL REFERENCES shops(id),
  user_id                TEXT NOT NULL REFERENCES users(id),
  name                   TEXT NOT NULL,
  role                   TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'staff')),
  commission_pct         INTEGER NOT NULL DEFAULT 0,   -- on services
  product_commission_pct INTEGER NOT NULL DEFAULT 0,   -- on products sold
  monthly_salary         INTEGER NOT NULL DEFAULT 0,   -- paise
  color                  TEXT NOT NULL DEFAULT '#0f766e',
  active                 INTEGER NOT NULL DEFAULT 1,
  created_at             INTEGER NOT NULL,
  UNIQUE (shop_id, user_id)
);
CREATE INDEX idx_staff_user ON staff(user_id);

CREATE TABLE sessions (
  id           TEXT PRIMARY KEY,   -- sha256 of the cookie token
  app          TEXT NOT NULL CHECK (app IN ('owner', 'staff', 'admin')),
  user_id      TEXT NOT NULL REFERENCES users(id),
  shop_id      TEXT,
  impersonator_id TEXT,
  expires_at   INTEGER NOT NULL,
  created_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  user_agent   TEXT
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------
CREATE TABLE services (
  id         TEXT PRIMARY KEY,
  shop_id    TEXT NOT NULL REFERENCES shops(id),
  name       TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT 'Hair',
  price      INTEGER NOT NULL,
  minutes    INTEGER NOT NULL DEFAULT 20,
  active     INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_services_shop ON services(shop_id, sort_order);

CREATE TABLE products (
  id          TEXT PRIMARY KEY,
  shop_id     TEXT NOT NULL REFERENCES shops(id),
  name        TEXT NOT NULL,
  price       INTEGER NOT NULL,          -- selling price
  cost        INTEGER NOT NULL DEFAULT 0,
  stock       INTEGER NOT NULL DEFAULT 0,
  low_stock   INTEGER NOT NULL DEFAULT 2,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_products_shop ON products(shop_id);

-- ---------------------------------------------------------------------------
-- Customers & khata (udhaar / advance)
-- ---------------------------------------------------------------------------
CREATE TABLE customers (
  id            TEXT PRIMARY KEY,
  shop_id       TEXT NOT NULL REFERENCES shops(id),
  name          TEXT NOT NULL,
  phone         TEXT,                    -- E.164, optional (walk-ins)
  gender        TEXT,
  birthday      TEXT,                    -- MM-DD
  notes         TEXT,
  balance       INTEGER NOT NULL DEFAULT 0, -- >0 advance with shop, <0 udhaar owed to shop
  visit_count   INTEGER NOT NULL DEFAULT 0,
  total_spend   INTEGER NOT NULL DEFAULT 0,
  last_visit_at INTEGER,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  deleted_at    INTEGER
);
CREATE UNIQUE INDEX idx_customers_shop_phone ON customers(shop_id, phone) WHERE phone IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_customers_shop_name ON customers(shop_id, name);

-- Every change to a customer's balance. balance = SUM(amount).
CREATE TABLE ledger (
  id          TEXT PRIMARY KEY,
  shop_id     TEXT NOT NULL REFERENCES shops(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  kind        TEXT NOT NULL CHECK (kind IN ('bill_due', 'bill_advance_used', 'due_paid', 'advance_added', 'adjust', 'void_reversal')),
  amount      INTEGER NOT NULL,           -- signed
  mode        TEXT CHECK (mode IN ('cash', 'upi', 'card')),
  bill_id     TEXT,
  staff_id    TEXT,
  note        TEXT,
  day         TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_ledger_customer ON ledger(customer_id, created_at);
CREATE INDEX idx_ledger_shop_day ON ledger(shop_id, day);

-- ---------------------------------------------------------------------------
-- Bills (POS)
-- ---------------------------------------------------------------------------
CREATE TABLE bills (
  id            TEXT PRIMARY KEY,
  shop_id       TEXT NOT NULL REFERENCES shops(id),
  bill_no       INTEGER NOT NULL,
  client_ref    TEXT NOT NULL,            -- idempotency key from the device (offline sync)
  public_token  TEXT NOT NULL UNIQUE,
  customer_id   TEXT REFERENCES customers(id),
  customer_name TEXT,
  customer_phone TEXT,
  staff_id      TEXT NOT NULL REFERENCES staff(id),  -- main stylist
  created_by    TEXT NOT NULL REFERENCES staff(id),
  subtotal      INTEGER NOT NULL,
  discount      INTEGER NOT NULL DEFAULT 0,
  tax           INTEGER NOT NULL DEFAULT 0,          -- GST portion (included in total)
  total         INTEGER NOT NULL,
  paid_cash     INTEGER NOT NULL DEFAULT 0,
  paid_upi      INTEGER NOT NULL DEFAULT 0,
  paid_card     INTEGER NOT NULL DEFAULT 0,
  paid_advance  INTEGER NOT NULL DEFAULT 0,
  due           INTEGER NOT NULL DEFAULT 0,
  note          TEXT,
  day           TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  voided_at     INTEGER,
  void_reason   TEXT,
  voided_by     TEXT,
  UNIQUE (shop_id, client_ref),
  UNIQUE (shop_id, bill_no)
);
CREATE INDEX idx_bills_shop_day ON bills(shop_id, day);
CREATE INDEX idx_bills_staff_day ON bills(staff_id, day);
CREATE INDEX idx_bills_customer ON bills(customer_id);

CREATE TABLE bill_items (
  id         TEXT PRIMARY KEY,
  bill_id    TEXT NOT NULL REFERENCES bills(id),
  shop_id    TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('service', 'product', 'custom')),
  ref_id     TEXT,
  name       TEXT NOT NULL,
  qty        INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL,
  amount     INTEGER NOT NULL,            -- qty * unit_price
  net        INTEGER NOT NULL,            -- after share of bill discount (incl. GST)
  staff_id   TEXT NOT NULL REFERENCES staff(id),
  commission INTEGER NOT NULL DEFAULT 0,
  cost       INTEGER NOT NULL DEFAULT 0   -- product cost, for profit
);
CREATE INDEX idx_items_bill ON bill_items(bill_id);
CREATE INDEX idx_items_staff ON bill_items(staff_id);

-- ---------------------------------------------------------------------------
-- Money out, staff, operations
-- ---------------------------------------------------------------------------
CREATE TABLE expenses (
  id         TEXT PRIMARY KEY,
  shop_id    TEXT NOT NULL REFERENCES shops(id),
  category   TEXT NOT NULL,
  amount     INTEGER NOT NULL,
  mode       TEXT NOT NULL CHECK (mode IN ('cash', 'upi', 'card')),
  note       TEXT,
  day        TEXT NOT NULL,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX idx_expenses_shop_day ON expenses(shop_id, day);

-- Salary advances, payouts, bonuses, deductions for staff.
CREATE TABLE staff_txns (
  id         TEXT PRIMARY KEY,
  shop_id    TEXT NOT NULL REFERENCES shops(id),
  staff_id   TEXT NOT NULL REFERENCES staff(id),
  kind       TEXT NOT NULL CHECK (kind IN ('advance', 'payout', 'bonus', 'deduction')),
  amount     INTEGER NOT NULL,
  mode       TEXT NOT NULL DEFAULT 'cash' CHECK (mode IN ('cash', 'upi', 'card')),
  note       TEXT,
  day        TEXT NOT NULL,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX idx_staff_txns ON staff_txns(staff_id, day);

CREATE TABLE attendance (
  shop_id  TEXT NOT NULL,
  staff_id TEXT NOT NULL REFERENCES staff(id),
  day      TEXT NOT NULL,
  in_at    INTEGER NOT NULL,
  out_at   INTEGER,
  PRIMARY KEY (staff_id, day)
);
CREATE INDEX idx_attendance_shop ON attendance(shop_id, day);

-- Walk-in tokens and simple appointments.
CREATE TABLE queue (
  id            TEXT PRIMARY KEY,
  shop_id       TEXT NOT NULL REFERENCES shops(id),
  token         INTEGER NOT NULL,
  day           TEXT NOT NULL,
  customer_id   TEXT,
  name          TEXT NOT NULL,
  phone         TEXT,
  staff_id      TEXT,                     -- preferred / assigned stylist
  note          TEXT,
  scheduled_at  INTEGER,                  -- set for appointments
  status        TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'serving', 'done', 'cancelled')),
  bill_id       TEXT,
  created_at    INTEGER NOT NULL,
  started_at    INTEGER,
  done_at       INTEGER
);
CREATE INDEX idx_queue_shop_day ON queue(shop_id, day, status);

-- End-of-day cash count (galla).
CREATE TABLE closings (
  shop_id       TEXT NOT NULL,
  day           TEXT NOT NULL,
  opening_cash  INTEGER NOT NULL,
  expected_cash INTEGER NOT NULL,
  counted_cash  INTEGER NOT NULL,
  note          TEXT,
  closed_by     TEXT,
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (shop_id, day)
);

-- Style photos of a customer's cut (stored privately in R2).
CREATE TABLE photos (
  id          TEXT PRIMARY KEY,
  shop_id     TEXT NOT NULL REFERENCES shops(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  bill_id     TEXT,
  r2_key      TEXT NOT NULL UNIQUE,
  bytes       INTEGER NOT NULL,
  note        TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_photos_customer ON photos(customer_id);

-- ---------------------------------------------------------------------------
-- SnipMemory subscriptions: shops pay by UPI and submit the UTR; an admin verifies.
-- ---------------------------------------------------------------------------
CREATE TABLE subscription_payments (
  id          TEXT PRIMARY KEY,
  shop_id     TEXT NOT NULL REFERENCES shops(id),
  plan_id     TEXT NOT NULL REFERENCES plans(id),
  period      TEXT NOT NULL CHECK (period IN ('month', 'year')),
  amount      INTEGER NOT NULL,
  utr         TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  note        TEXT,
  created_by  TEXT,
  reviewed_by TEXT,
  reviewed_at INTEGER,
  created_at  INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_subpay_utr ON subscription_payments(utr) WHERE status != 'rejected';
CREATE INDEX idx_subpay_status ON subscription_payments(status, created_at);

CREATE TABLE audit_log (
  id         TEXT PRIMARY KEY,
  shop_id    TEXT,
  user_id    TEXT,
  impersonator_id TEXT,
  action     TEXT NOT NULL,
  target_id  TEXT,
  meta       TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_audit_shop ON audit_log(shop_id, created_at);
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
-- Plans (see docs/BUSINESS_PLAN.md §6)
-- ---------------------------------------------------------------------------
INSERT INTO plans (id, name, tagline, max_staff, monthly_bill_limit, price_month, price_year, features, capabilities, sort_order) VALUES
 ('free', 'Free', 'For a one-chair shop', 2, 300, 0, 0,
  '["Owner + 1 barber","300 bills a month","UPI QR billing & WhatsApp bills","Customers & udhaar (khata)","Expenses & today''s report"]',
  '[]', 0),
 ('starter', 'Starter', 'For a small shop', 4, -1, 14900, 149000,
  '["Up to 4 people","Unlimited bills","Barber-wise commission & salary","Reports for any date","Daily cash closing (galla)","Walk-in token queue"]',
  '["reports","commission","closing","queue"]', 1),
 ('pro', 'Pro', 'For a busy salon', 10, -1, 34900, 349000,
  '["Up to 10 people","Everything in Starter","Product stock & low-stock alerts","GST bills","Attendance","Customer cut photos","Excel/CSV export"]',
  '["reports","commission","closing","queue","inventory","gst","attendance","photos","export"]', 2),
 ('business', 'Business', 'For big salons & branches (per shop)', -1, -1, 69900, 699000,
  '["Unlimited staff","Everything in Pro","All branches in one dashboard","Priority WhatsApp support","Help moving your old data"]',
  '["reports","commission","closing","queue","inventory","gst","attendance","photos","export","multi_shop","priority_support"]', 3);
