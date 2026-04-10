-- Defensive fix for balance snapshot writes.
-- A normal unique index allows ON CONFLICT(upload_batch_id) inference, while
-- still allowing multiple NULL values in Postgres.

CREATE UNIQUE INDEX IF NOT EXISTS idx_account_balance_upload_batch_unique
  ON account_balance_snapshots(upload_batch_id);
