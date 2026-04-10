/**
 * Ingestion Service
 *
 * Orchestrates QFX file parsing → normalization → database insertion.
 * Handles FITID dedup, Zelle detection, merchant normalization.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import {
  parseQfx,
  isZelleTransaction,
  extractZelleCounterparty,
  normalizeMerchant,
  type QfxTransaction,
} from "@/lib/parsers/qfx";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IngestionResult {
  batchId: string;
  accountId: string;
  accountName: string;
  filename: string;
  format: string;
  rowsTotal: number;
  rowsInserted: number;
  rowsSkipped: number;
  /** Date range of transactions in the file */
  dateRange: { start: string; end: string } | null;
  /** Account info extracted from QFX header */
  qfxAccountId?: string;
  ledgerBalance: number | null;
  availableBalance: number | null;
  balanceDate: string | null;
  /** Errors encountered during ingestion */
  errors: string[];
}

interface NormalizedTransaction {
  account_id: string;
  external_id: string;
  date: string;
  posted_date: string | null;
  amount: number;
  raw_description: string;
  merchant_name: string;
  currency: string;
  transaction_type: string;
  is_zelle: boolean;
  zelle_counterparty: string | null;
  metadata: Record<string, unknown>;
  upload_batch_id: string;
}

interface AccountRow {
  id: string;
  name: string;
  display_name: string | null;
}

// ─── Core ingestion ───────────────────────────────────────────────────────────

/**
 * Ingest a QFX file for a given account.
 *
 * @param supabase - Supabase client
 * @param accountId - UUID of the account this file belongs to
 * @param filename - Original filename
 * @param fileContent - Raw QFX file content as string
 */
export async function ingestQfxFile(
  supabase: SupabaseClient,
  filename: string,
  fileContent: string
): Promise<IngestionResult> {
  const errors: string[] = [];

  // 1. Parse the QFX file
  const parsed = parseQfx(fileContent);
  const { transactions, account: qfxAccount } = parsed;

  const rawAccountId = qfxAccount.accountId;
  if (!rawAccountId) {
    throw new Error("Invalid QFX/OFX file: No Account ID found inside the file data.");
  }
  
  // Extract last four digits for display only. It is not strong enough for identity.
  const lastFour = rawAccountId.length >= 4 
    ? rawAccountId.slice(-4) 
    : rawAccountId;
  const fiOrg = qfxAccount.fiOrg || "Unknown Bank";
  const accountType = normalizeAccountType(qfxAccount.accountType);
  const institutionSlug = slugify(fiOrg);
  const qfxFingerprint = createAccountFingerprint({
    accountId: rawAccountId,
    accountType,
    bankId: qfxAccount.bankId,
    fid: qfxAccount.fid,
    fiOrg,
  });

  // Try to find existing account by strong imported identity.
  let { data: accountData } = await supabase
    .from("accounts")
    .select("id, name, display_name")
    .eq("qfx_account_fingerprint", qfxFingerprint)
    .limit(1)
    .maybeSingle<AccountRow>();

  // Legacy fallback for old accounts created before fingerprinting existed.
  if (!accountData) {
    const { data: legacyAccount } = await supabase
      .from("accounts")
      .select("id, name, display_name")
      .eq("last_four", lastFour)
      .eq("institution", institutionSlug)
      .eq("account_type", accountType)
      .limit(1)
      .maybeSingle<AccountRow>();

    accountData = legacyAccount;

    if (accountData) {
      await supabase
        .from("accounts")
        .update({
          qfx_account_fingerprint: qfxFingerprint,
          qfx_institution_id: qfxAccount.fid || null,
          qfx_bank_id: qfxAccount.bankId || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", accountData.id);
    }
  }

  let accountId = accountData?.id;

  // Auto-create account if not found
  if (!accountId) {
    const defaultName = `${fiOrg} ${formatAccountType(accountType)} ***${lastFour}`;

    const { data: newAccount, error: createError } = await supabase
      .from("accounts")
      .insert({
        name: defaultName,
        display_name: defaultName,
        institution: institutionSlug,
        account_type: accountType,
        last_four: lastFour,
        qfx_account_fingerprint: qfxFingerprint,
        qfx_institution_id: qfxAccount.fid || null,
        qfx_bank_id: qfxAccount.bankId || null,
      })
      .select("id, name, display_name")
      .single<AccountRow>();

    if (createError || !newAccount) {
      throw new Error(`Failed to auto-create account mapping for ***${lastFour}: ${createError?.message}`);
    }
    
    accountId = newAccount.id;
    accountData = newAccount;
  }

  // 2. Create an upload batch record
  const { data: batch, error: batchError } = await supabase
    .from("upload_batches")
    .insert({
      account_id: accountId,
      filename,
      format: "qfx",
      rows_total: transactions.length,
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    throw new Error(`Failed to create upload batch: ${batchError?.message}`);
  }

  const batchId = batch.id;

  // Store the balances reported by the statement, if present.
  const balanceDate =
    qfxAccount.ledgerBalanceDate ||
    qfxAccount.availableBalanceDate ||
    qfxAccount.dateEnd ||
    null;

  if (
    qfxAccount.ledgerBalance !== undefined ||
    qfxAccount.availableBalance !== undefined
  ) {
    const { error: balanceError } = await supabase
      .from("account_balance_snapshots")
      .insert({
        account_id: accountId,
        upload_batch_id: batchId,
        ledger_balance: qfxAccount.ledgerBalance ?? null,
        available_balance: qfxAccount.availableBalance ?? null,
        balance_date: balanceDate,
        currency: qfxAccount.currency || "USD",
        source_filename: filename,
      });

    if (balanceError) {
      errors.push(`Balance snapshot error: ${balanceError.message}`);
    }
  }

  // 3. Normalize transactions
  const normalized: NormalizedTransaction[] = transactions.map((tx) =>
    normalizeTransaction(tx, accountId, batchId, qfxAccount.currency || "USD")
  );

  // 4. Bulk insert with dedup (ON CONFLICT DO NOTHING)
  let rowsInserted = 0;
  let rowsSkipped = 0;

  // Insert in chunks to avoid hitting Supabase payload limits
  const CHUNK_SIZE = 100;
  for (let i = 0; i < normalized.length; i += CHUNK_SIZE) {
    const chunk = normalized.slice(i, i + CHUNK_SIZE);

    const { data: inserted, error: insertError } = await supabase
      .from("raw_transactions")
      .upsert(chunk, {
        onConflict: "account_id,external_id",
        ignoreDuplicates: true,
      })
      .select("id");

    if (insertError) {
      errors.push(
        `Insert error at batch offset ${i}: ${insertError.message}`
      );
      continue;
    }

    // Count how many were actually inserted vs skipped
    rowsInserted += inserted?.length ?? 0;
  }

  rowsSkipped = transactions.length - rowsInserted;

  // 5. Update batch stats
  await supabase
    .from("upload_batches")
    .update({
      rows_inserted: rowsInserted,
      rows_skipped: rowsSkipped,
    })
    .eq("id", batchId);

  // 7. Calculate date range
  let dateRange: { start: string; end: string } | null = null;
  if (transactions.length > 0) {
    const dates = transactions
      .map((t) => t.datePosted)
      .filter(Boolean)
      .sort();
    dateRange = {
      start: dates[0],
      end: dates[dates.length - 1],
    };
  }

  return {
    batchId,
    accountId,
    accountName: accountData?.display_name || accountData?.name || "Unknown",
    filename,
    format: "qfx",
    rowsTotal: transactions.length,
    rowsInserted,
    rowsSkipped,
    dateRange,
    qfxAccountId: qfxAccount.accountId,
    ledgerBalance: qfxAccount.ledgerBalance ?? null,
    availableBalance: qfxAccount.availableBalance ?? null,
    balanceDate,
    errors,
  };
}

// ─── Normalization ────────────────────────────────────────────────────────────

function normalizeTransaction(
  tx: QfxTransaction,
  accountId: string,
  batchId: string,
  currency: string
): NormalizedTransaction {
  const isZelle = isZelleTransaction(tx);
  const zelleCounterparty = isZelle
    ? extractZelleCounterparty(tx)
    : null;

  return {
    account_id: accountId,
    external_id: tx.fitId,
    date: tx.datePosted,
    posted_date: tx.datePosted,
    amount: tx.amount,
    raw_description: [tx.name, tx.memo].filter(Boolean).join(" "),
    merchant_name: isZelle
      ? `Zelle ${tx.amount > 0 ? "from" : "to"} ${zelleCounterparty || "Unknown"}`
      : normalizeMerchant(tx.name),
    currency,
    transaction_type: tx.type,
    is_zelle: isZelle,
    zelle_counterparty: zelleCounterparty,
    metadata: {
      qfx_name: tx.name,
      qfx_memo: tx.memo,
      qfx_type: tx.type,
      ...(tx.checkNum ? { check_num: tx.checkNum } : {}),
      ...(tx.refNum ? { ref_num: tx.refNum } : {}),
    },
    upload_batch_id: batchId,
  };
}

function createAccountFingerprint(input: {
  accountId: string;
  accountType: string;
  bankId?: string;
  fid?: string;
  fiOrg?: string;
}): string {
  const rawIdentity = [
    input.fiOrg || "",
    input.fid || "",
    input.bankId || "",
    input.accountType,
    input.accountId,
  ]
    .join("|")
    .toLowerCase();

  return createHash("sha256").update(rawIdentity).digest("hex");
}

function normalizeAccountType(rawType?: string): string {
  const normalized = (rawType || "checking").toLowerCase();
  if (normalized === "creditline") return "credit_card";
  if (normalized === "credit_card") return "credit_card";
  return normalized;
}

function formatAccountType(accountType: string): string {
  return accountType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "unknown";
}
