-- Expense Management Portal — Full Schema Migration
-- Run this against your Supabase PostgreSQL instance

-- ═══════════════════════════════════════════════════════
-- SPLITWISE REFERENCE DATA
-- ═══════════════════════════════════════════════════════

-- Singleton table: stores the current Splitwise user identity
CREATE TABLE IF NOT EXISTS splitwise_user (
  id                BIGINT PRIMARY KEY,
  first_name        TEXT,
  last_name         TEXT,
  email             TEXT,
  default_currency  VARCHAR(3),
  locale            VARCHAR(5),
  synced_at         TIMESTAMPTZ DEFAULT now()
);

-- Splitwise category hierarchy (parent/subcategory)
CREATE TABLE IF NOT EXISTS splitwise_categories (
  id              INTEGER PRIMARY KEY,
  name            TEXT NOT NULL,
  parent_id       INTEGER REFERENCES splitwise_categories(id),
  icon_url        TEXT,
  synced_at       TIMESTAMPTZ DEFAULT now()
);

-- Supported currencies from Splitwise
CREATE TABLE IF NOT EXISTS splitwise_currencies (
  currency_code   VARCHAR(10) PRIMARY KEY,
  unit            VARCHAR(10)
);

-- ═══════════════════════════════════════════════════════
-- ACCOUNT MANAGEMENT
-- ═══════════════════════════════════════════════════════

-- Bank/credit card accounts
CREATE TABLE IF NOT EXISTS accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  institution     TEXT NOT NULL,
  account_type    TEXT NOT NULL,
  last_four       VARCHAR(4),
  preferred_format TEXT DEFAULT 'qfx',
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Authorized cardholders on shared credit card accounts
CREATE TABLE IF NOT EXISTS card_holders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  card_last_four  VARCHAR(4),
  is_primary      BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now(),

  UNIQUE (account_id, card_last_four)
);

-- ═══════════════════════════════════════════════════════
-- RAW TRANSACTION INGESTION
-- ═══════════════════════════════════════════════════════

-- Upload audit trail
CREATE TABLE IF NOT EXISTS upload_batches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  filename        TEXT NOT NULL,
  format          TEXT NOT NULL,
  rows_total      INTEGER DEFAULT 0,
  rows_inserted   INTEGER DEFAULT 0,
  rows_skipped    INTEGER DEFAULT 0,
  uploaded_at     TIMESTAMPTZ DEFAULT now()
);

-- Normalized transactions from all bank/CC uploads
CREATE TABLE IF NOT EXISTS raw_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  card_holder_id  UUID REFERENCES card_holders(id),
  external_id     VARCHAR(255) NOT NULL,
  date            DATE NOT NULL,
  posted_date     DATE,
  amount          DECIMAL(12,2) NOT NULL,
  raw_description TEXT NOT NULL,
  merchant_name   TEXT,
  source_category TEXT,
  category        TEXT,
  categorized_by  TEXT,
  currency        VARCHAR(3) DEFAULT 'USD',
  transaction_type TEXT,
  is_zelle        BOOLEAN DEFAULT false,
  zelle_counterparty TEXT,
  metadata        JSONB,
  upload_batch_id UUID REFERENCES upload_batches(id),
  created_at      TIMESTAMPTZ DEFAULT now(),

  UNIQUE (account_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_raw_tx_date ON raw_transactions(date);
CREATE INDEX IF NOT EXISTS idx_raw_tx_amount ON raw_transactions(amount);
CREATE INDEX IF NOT EXISTS idx_raw_tx_account ON raw_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_raw_tx_card_holder ON raw_transactions(card_holder_id);
CREATE INDEX IF NOT EXISTS idx_raw_tx_zelle ON raw_transactions(is_zelle) WHERE is_zelle = true;

-- ═══════════════════════════════════════════════════════
-- SPLITWISE DATA
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS splitwise_expenses (
  id                      BIGINT PRIMARY KEY,
  group_id                INTEGER,
  friendship_id           INTEGER,
  expense_bundle_id       INTEGER,
  description             TEXT NOT NULL,
  details                 TEXT,
  cost                    DECIMAL(12,2) NOT NULL,
  currency_code           VARCHAR(3) NOT NULL DEFAULT 'USD',
  expense_date            TIMESTAMPTZ NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL,
  updated_at              TIMESTAMPTZ NOT NULL,
  deleted_at              TIMESTAMPTZ,
  created_by_id           BIGINT,
  created_by_name         TEXT,
  updated_by_id           BIGINT,
  payment                 BOOLEAN NOT NULL DEFAULT false,
  transaction_confirmed   BOOLEAN DEFAULT false,
  repeats                 BOOLEAN DEFAULT false,
  repeat_interval         TEXT DEFAULT 'never',
  category_id             INTEGER REFERENCES splitwise_categories(id),
  category_name           TEXT,
  my_paid_share           DECIMAL(12,2) NOT NULL DEFAULT 0,
  my_owed_share           DECIMAL(12,2) NOT NULL DEFAULT 0,
  my_net_balance          DECIMAL(12,2) NOT NULL DEFAULT 0,
  comments_count          INTEGER DEFAULT 0,
  users                   JSONB NOT NULL DEFAULT '[]',
  repayments              JSONB,
  receipt                 JSONB,
  comments                JSONB,
  raw_data                JSONB,
  synced_at               TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sw_date ON splitwise_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_sw_cost ON splitwise_expenses(cost);
CREATE INDEX IF NOT EXISTS idx_sw_updated ON splitwise_expenses(updated_at);
CREATE INDEX IF NOT EXISTS idx_sw_payment ON splitwise_expenses(payment);
CREATE INDEX IF NOT EXISTS idx_sw_deleted ON splitwise_expenses(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sw_group ON splitwise_expenses(group_id);

CREATE TABLE IF NOT EXISTS splitwise_friends (
  id                    BIGINT PRIMARY KEY,
  first_name            TEXT,
  last_name             TEXT,
  email                 TEXT,
  registration_status   TEXT,
  picture               JSONB,
  balance               JSONB NOT NULL DEFAULT '[]',
  groups                JSONB,
  updated_at            TIMESTAMPTZ,
  synced_at             TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS splitwise_groups (
  id                    BIGINT PRIMARY KEY,
  name                  TEXT NOT NULL,
  group_type            TEXT,
  updated_at            TIMESTAMPTZ,
  simplify_by_default   BOOLEAN DEFAULT false,
  members               JSONB,
  original_debts        JSONB,
  simplified_debts      JSONB,
  synced_at             TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════
-- RECONCILIATION
-- ═══════════════════════════════════════════════════════

-- Custom enum types
DO $$ BEGIN
  CREATE TYPE link_type AS ENUM (
    'is_original_expense',
    'is_settlement'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE match_method AS ENUM (
    'amount_date_exact',
    'merchant_match',
    'settlement_friend',
    'settlement_exact',
    'ai',
    'manual'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS transaction_links (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_transaction_id    UUID NOT NULL REFERENCES raw_transactions(id) ON DELETE CASCADE,
  splitwise_expense_id  BIGINT REFERENCES splitwise_expenses(id),
  splitwise_friend_id   BIGINT REFERENCES splitwise_friends(id),
  link_type             link_type NOT NULL,
  confidence            DECIMAL(4,3) NOT NULL,
  matched_by            match_method NOT NULL,
  settlement_amount     DECIMAL(12,2),
  notes                 TEXT,
  reviewed              BOOLEAN DEFAULT false,
  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_links_raw_tx ON transaction_links(raw_transaction_id);
CREATE INDEX IF NOT EXISTS idx_links_sw ON transaction_links(splitwise_expense_id);

-- ═══════════════════════════════════════════════════════
-- RESOLVED EXPENSES (dashboard truth)
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS resolved_expenses (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_transaction_id      UUID NOT NULL REFERENCES raw_transactions(id) ON DELETE CASCADE,
  date                    DATE NOT NULL,
  merchant_name           TEXT,
  category                TEXT,
  categorized_by          TEXT,
  gross_amount            DECIMAL(12,2) NOT NULL,
  true_amount             DECIMAL(12,2) NOT NULL,
  pending_reimbursement   DECIMAL(12,2) DEFAULT 0,
  linked_splitwise_id     BIGINT REFERENCES splitwise_expenses(id),
  is_reimbursement        BOOLEAN DEFAULT false,
  needs_review            BOOLEAN DEFAULT false,
  review_reason           TEXT,
  updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resolved_date ON resolved_expenses(date);
CREATE INDEX IF NOT EXISTS idx_resolved_category ON resolved_expenses(category);

-- ═══════════════════════════════════════════════════════
-- SYNC LOG
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sync_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source          TEXT NOT NULL,
  sync_type       TEXT NOT NULL DEFAULT 'delta',
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  status          TEXT DEFAULT 'running',
  expenses_synced INTEGER DEFAULT 0,
  friends_synced  INTEGER DEFAULT 0,
  groups_synced   INTEGER DEFAULT 0,
  error_message   TEXT
);
