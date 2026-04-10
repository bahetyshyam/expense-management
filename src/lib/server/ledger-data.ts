import type { SupabaseClient } from "@supabase/supabase-js";
import type { SummaryRow } from "@/lib/ledger";

const SUMMARY_PAGE_SIZE = 1000;

interface TransactionFilters {
  accountId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isZelle?: string | null;
}

export async function fetchTransactionSummaryRows(
  supabase: SupabaseClient,
  filters: TransactionFilters = {}
): Promise<SummaryRow[]> {
  const rows: SummaryRow[] = [];
  let offset = 0;

  while (true) {
    let query = supabase
      .from("raw_transactions")
      .select("account_id, amount")
      .range(offset, offset + SUMMARY_PAGE_SIZE - 1);

    if (filters.accountId && filters.accountId !== "all") {
      query = query.eq("account_id", filters.accountId);
    }
    if (filters.startDate) {
      query = query.gte("date", filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte("date", filters.endDate);
    }
    if (filters.isZelle === "true") {
      query = query.eq("is_zelle", true);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to summarize transactions: ${error.message}`);
    }

    rows.push(...((data || []) as SummaryRow[]));

    if (!data || data.length < SUMMARY_PAGE_SIZE) break;
    offset += SUMMARY_PAGE_SIZE;
  }

  return rows;
}
