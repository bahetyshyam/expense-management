-- Ledger-first reset additions.
-- Keeps the existing schema intact while adding stronger account identity,
-- editable account metadata, and statement balance snapshots.

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS qfx_account_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS qfx_institution_id TEXT,
  ADD COLUMN IF NOT EXISTS qfx_bank_id TEXT,
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_qfx_fingerprint
  ON accounts(qfx_account_fingerprint)
  WHERE qfx_account_fingerprint IS NOT NULL;

CREATE TABLE IF NOT EXISTS account_balance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  upload_batch_id UUID REFERENCES upload_batches(id) ON DELETE SET NULL,
  ledger_balance DECIMAL(12,2),
  available_balance DECIMAL(12,2),
  balance_date DATE,
  currency VARCHAR(3) DEFAULT 'USD',
  source_filename TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_account_balance_upload_batch
  ON account_balance_snapshots(upload_batch_id)
  WHERE upload_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_account_balance_account_date
  ON account_balance_snapshots(account_id, balance_date DESC, created_at DESC);
