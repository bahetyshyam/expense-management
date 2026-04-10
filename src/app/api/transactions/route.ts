import { createClient } from "@/utils/supabase/server";
import { requireApiUser } from "@/lib/auth/server";
import { NextRequest } from "next/server";
import {
  createPagination,
  summarizeTransactions,
  TRANSACTION_SELECT,
} from "@/lib/ledger";
import { fetchTransactionSummaryRows } from "@/lib/server/ledger-data";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { response } = await requireApiUser(supabase);
    if (response) return response;

    const searchParams = request.nextUrl.searchParams;
    const accountId = searchParams.get("accountId");
    const pageSize = Math.min(
      Math.max(parseInt(searchParams.get("pageSize") || "50", 10), 1),
      100
    );
    const currentPage = Math.max(
      parseInt(searchParams.get("page") || "1", 10),
      1
    );
    const offset = (currentPage - 1) * pageSize;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const isZelle = searchParams.get("isZelle");

    let query = supabase
      .from("raw_transactions")
      .select(TRANSACTION_SELECT, { count: "exact" })
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (accountId && accountId !== "all") {
      query = query.eq("account_id", accountId);
    }
    if (startDate) {
      query = query.gte("date", startDate);
    }
    if (endDate) {
      query = query.lte("date", endDate);
    }
    if (isZelle === "true") {
      query = query.eq("is_zelle", true);
    }

    const [
      { data: transactions, error, count },
      summaryRows,
    ] = await Promise.all([
      query,
      fetchTransactionSummaryRows(supabase, {
        accountId,
        startDate,
        endDate,
        isZelle,
      }),
    ]);

    if (error) {
      return Response.json(
        { error: `Failed to fetch transactions: ${error.message}` },
        { status: 500 }
      );
    }

    const summary = summarizeTransactions(summaryRows);
    const totalItems = count || 0;
    const pagination = createPagination({
      currentPage,
      pageSize,
      totalItems,
    });

    return Response.json(
      {
        transactions,
        pagination,
        summary,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Transactions GET error:", error);
    return Response.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}
