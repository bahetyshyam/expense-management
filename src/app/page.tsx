import { Landmark, ShieldCheck } from "lucide-react";
import DashboardUI from "@/components/DashboardUI";
import { ImportStatementDialog } from "@/components/ImportStatementDialog";
import { createClient } from "@/utils/supabase/server";
import { IconTile, ProductBadge, Surface } from "@/components/ledger/primitives";
import {
  createPagination,
  summarizeTransactions,
  TRANSACTION_SELECT,
} from "@/lib/ledger";
import { fetchTransactionSummaryRows } from "@/lib/server/ledger-data";

export const dynamic = "force-dynamic";

const INITIAL_LEDGER_LIMIT = 50;
export default async function Home() {
  const supabase = await createClient();

  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .eq("is_hidden", false)
    .order("institution")
    .order("display_name");

  const { data: transactions, count: totalTransactions } = await supabase
    .from("raw_transactions")
    .select(TRANSACTION_SELECT, { count: "exact" })
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(0, INITIAL_LEDGER_LIMIT - 1);

  const summaryRows = await fetchTransactionSummaryRows(supabase);

  const { data: balanceSnapshots } = await supabase
    .from("account_balance_snapshots")
    .select("*");

  return (
    <div className="ledger-grid min-h-screen">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-44 bg-gradient-to-b from-white/70 to-transparent" />
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <Surface className="animate-rise relative mb-8 p-5 lg:p-6">
          <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-teal-300/30 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-24 w-44 rounded-full bg-orange-300/25 blur-3xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <IconTile icon={Landmark} className="h-12 w-12" />
              <div>
                <div className="mb-2">
                  <ProductBadge icon={ShieldCheck}>
                    Ledger-first reset
                  </ProductBadge>
                </div>
                <h1 className="text-3xl font-semibold tracking-[-0.04em] text-neutral-950 sm:text-4xl">
                  Expense Portal
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
                  Import statements, verify balances, and understand cash flow
                  across checking accounts and credit cards before adding
                  categorization or Splitwise complexity.
                </p>
              </div>
            </div>
            <div className="flex w-full justify-start lg:w-auto lg:justify-end">
              <ImportStatementDialog />
            </div>
          </div>
        </Surface>

        <main className="relative flex-1 space-y-6 pb-10">
          <DashboardUI
            accounts={accounts || []}
            initialTransactions={transactions || []}
            balanceSnapshots={balanceSnapshots || []}
            initialLedger={{
              pagination: createPagination({
                currentPage: 1,
                pageSize: INITIAL_LEDGER_LIMIT,
                totalItems: totalTransactions || 0,
              }),
              summary: summarizeTransactions(summaryRows || []),
            }}
          />
        </main>
      </div>
    </div>
  );
}
