export const TRANSACTION_SELECT =
  "id, account_id, date, amount, raw_description, merchant_name, transaction_type, is_zelle, zelle_counterparty, currency, created_at";

export interface LedgerSummary {
  debits: number;
  credits: number;
  netMovement: number;
  transactionCount: number;
  accountCounts: Record<string, number>;
}

export interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface SummaryRow {
  account_id: string;
  amount: number | string;
}

export function createPagination({
  currentPage,
  pageSize,
  totalItems,
}: {
  currentPage: number;
  pageSize: number;
  totalItems: number;
}): PaginationState {
  const totalPages = Math.max(Math.ceil(totalItems / pageSize), 1);
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);

  return {
    currentPage: safeCurrentPage,
    pageSize,
    totalItems,
    totalPages,
    hasPreviousPage: safeCurrentPage > 1,
    hasNextPage: safeCurrentPage < totalPages,
  };
}

export function summarizeTransactions(rows: SummaryRow[]): LedgerSummary {
  let debits = 0;
  let credits = 0;
  const accountCounts: Record<string, number> = {};

  for (const row of rows) {
    const amount =
      typeof row.amount === "number" ? row.amount : Number.parseFloat(row.amount);

    if (Number.isFinite(amount)) {
      if (amount < 0) debits += Math.abs(amount);
      if (amount > 0) credits += amount;
    }

    accountCounts[row.account_id] = (accountCounts[row.account_id] || 0) + 1;
  }

  return {
    debits,
    credits,
    netMovement: credits - debits,
    transactionCount: rows.length,
    accountCounts,
  };
}
