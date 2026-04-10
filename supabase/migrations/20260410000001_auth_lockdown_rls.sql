-- Authentication + ownership lockdown for public deployment.
-- Adds per-user ownership and row-level security for ledger-first tables.

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE accounts
  ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE card_holders
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE card_holders
  ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE upload_batches
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE upload_batches
  ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE raw_transactions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE raw_transactions
  ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE account_balance_snapshots
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE account_balance_snapshots
  ALTER COLUMN user_id SET DEFAULT auth.uid();

UPDATE card_holders ch
SET user_id = a.user_id
FROM accounts a
WHERE ch.account_id = a.id
  AND ch.user_id IS NULL;

UPDATE upload_batches ub
SET user_id = a.user_id
FROM accounts a
WHERE ub.account_id = a.id
  AND ub.user_id IS NULL;

UPDATE raw_transactions rt
SET user_id = a.user_id
FROM accounts a
WHERE rt.account_id = a.id
  AND rt.user_id IS NULL;

UPDATE account_balance_snapshots abs
SET user_id = a.user_id
FROM accounts a
WHERE abs.account_id = a.id
  AND abs.user_id IS NULL;

DROP INDEX IF EXISTS idx_accounts_qfx_fingerprint;

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_user_qfx_fingerprint
  ON accounts(user_id, qfx_account_fingerprint)
  WHERE qfx_account_fingerprint IS NOT NULL
    AND user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_card_holders_user_id ON card_holders(user_id);
CREATE INDEX IF NOT EXISTS idx_upload_batches_user_id ON upload_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_raw_transactions_user_id ON raw_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_balance_snapshots_user_id ON account_balance_snapshots(user_id);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_holders ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_balance_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accounts_owner_policy ON accounts;
CREATE POLICY accounts_owner_policy
  ON accounts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS card_holders_owner_policy ON card_holders;
CREATE POLICY card_holders_owner_policy
  ON card_holders
  FOR ALL
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM accounts a
      WHERE a.id = card_holders.account_id
        AND a.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM accounts a
      WHERE a.id = card_holders.account_id
        AND a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS upload_batches_owner_policy ON upload_batches;
CREATE POLICY upload_batches_owner_policy
  ON upload_batches
  FOR ALL
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM accounts a
      WHERE a.id = upload_batches.account_id
        AND a.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM accounts a
      WHERE a.id = upload_batches.account_id
        AND a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS raw_transactions_owner_policy ON raw_transactions;
CREATE POLICY raw_transactions_owner_policy
  ON raw_transactions
  FOR ALL
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM accounts a
      WHERE a.id = raw_transactions.account_id
        AND a.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM accounts a
      WHERE a.id = raw_transactions.account_id
        AND a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS account_balance_snapshots_owner_policy ON account_balance_snapshots;
CREATE POLICY account_balance_snapshots_owner_policy
  ON account_balance_snapshots
  FOR ALL
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM accounts a
      WHERE a.id = account_balance_snapshots.account_id
        AND a.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM accounts a
      WHERE a.id = account_balance_snapshots.account_id
        AND a.user_id = auth.uid()
    )
  );
