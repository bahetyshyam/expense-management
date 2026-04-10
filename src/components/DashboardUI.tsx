"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Activity,
  CreditCard,
  Landmark,
  Repeat2,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import {
  FeatureTile,
  IconTile,
  ProductBadge,
  StatCard,
  Surface,
} from "@/components/ledger/primitives";
import { Pagination } from "@/components/ui/pagination";
import type { LedgerSummary, PaginationState } from "@/lib/ledger";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Account {
  id: string;
  name: string;
  display_name: string | null;
  institution: string;
  account_type: string;
  last_four: string | null;
  is_hidden?: boolean;
  notes?: string | null;
}

interface LedgerTransaction {
  id: string;
  account_id: string;
  date: string;
  amount: number | string;
  raw_description: string;
  merchant_name: string | null;
  transaction_type: string | null;
  is_zelle: boolean | null;
  zelle_counterparty: string | null;
  currency: string | null;
}

interface BalanceSnapshot {
  id: string;
  account_id: string;
  upload_batch_id: string | null;
  ledger_balance: number | string | null;
  available_balance: number | string | null;
  balance_date: string | null;
  currency: string | null;
  source_filename: string;
  created_at: string;
}

interface DashboardProps {
  accounts: Account[];
  initialTransactions: LedgerTransaction[];
  balanceSnapshots: BalanceSnapshot[];
  initialLedger: Omit<LedgerState, "transactions">;
}

type AccountKind = "cash" | "credit" | "other";

interface LedgerState {
  transactions: LedgerTransaction[];
  pagination: PaginationState;
  summary: LedgerSummary;
}

export default function DashboardUI({
  accounts,
  initialTransactions,
  balanceSnapshots,
  initialLedger,
}: DashboardProps) {
  const [selectedAccountId, setSelectedAccountId] = useState("all");
  const [ledger, setLedger] = useState<LedgerState>({
    ...initialLedger,
    transactions: initialTransactions,
  });
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);

  const snapshotsByAccount = useMemo(() => {
    const map = new Map<string, BalanceSnapshot>();

    for (const snapshot of balanceSnapshots) {
      const existing = map.get(snapshot.account_id);
      if (!existing || compareSnapshots(snapshot, existing) > 0) {
        map.set(snapshot.account_id, snapshot);
      }
    }

    return map;
  }, [balanceSnapshots]);

  const accountsById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts]
  );

  const metrics = useMemo(() => {
    const cashBalance = accounts
      .filter((account) => getAccountKind(account.account_type) === "cash")
      .reduce(
        (sum, account) =>
          sum + getSnapshotBalance(snapshotsByAccount.get(account.id)),
        0
      );

    const creditBalance = accounts
      .filter((account) => getAccountKind(account.account_type) === "credit")
      .reduce(
        (sum, account) =>
          sum + getSnapshotBalance(snapshotsByAccount.get(account.id)),
        0
      );

    return {
      debits: ledger.summary.debits,
      credits: ledger.summary.credits,
      netMovement: ledger.summary.netMovement,
      cashBalance,
      creditBalance,
      transactionCount: ledger.summary.transactionCount,
    };
  }, [accounts, ledger.summary, snapshotsByAccount]);

  const fetchLedger = async (accountId: string, page: number) => {
    setIsLoadingLedger(true);
    try {
      const params = new URLSearchParams({
        pageSize: String(ledger.pagination.pageSize),
        page: String(page),
      });

      if (accountId !== "all") params.set("accountId", accountId);

      const response = await fetch(`/api/transactions?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load transactions");
      }

      setLedger({
        transactions: data.transactions || [],
        pagination: data.pagination || {
          ...ledger.pagination,
          currentPage: page,
        },
        summary: data.summary || emptySummary(),
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingLedger(false);
    }
  };

  const selectAccount = (accountId: string) => {
    setSelectedAccountId(accountId);
    void fetchLedger(accountId, 1);
  };

  const goToPage = (nextPage: number) => {
    void fetchLedger(selectedAccountId, nextPage);
  };

  if (accounts.length === 0) {
    return (
      <Surface className="animate-rise">
        <div className="grid min-h-[440px] grid-cols-1 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="relative flex flex-col justify-center p-8 sm:p-10">
            <div className="absolute left-8 top-8 h-24 w-24 rounded-full bg-teal-300/30 blur-3xl" />
            <div className="relative">
              <div className="mb-5">
                <ProductBadge icon={Sparkles}>
                  Fresh ledger workspace
                </ProductBadge>
              </div>
              <h2 className="max-w-2xl text-4xl font-semibold tracking-[-0.05em] text-neutral-950 sm:text-5xl">
                Start with balances you can actually trust.
              </h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-neutral-600">
                Upload your first QFX or OFX statement. We will discover the
                account, dedupe by FITID, import every transaction, and store
                the statement balance so the ledger can be checked against real
                life before categories or Splitwise enter the picture.
              </p>
              <div className="mt-8 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
                <FeatureTile
                  icon={Activity}
                  title="Auto accounts"
                  text="No setup before import."
                />
                <FeatureTile
                  icon={Activity}
                  title="FITID dedupe"
                  text="Re-uploads skip duplicates."
                />
                <FeatureTile
                  icon={Activity}
                  title="Balance proof"
                  text="Ledger balances stored."
                />
              </div>
            </div>
          </div>
          <div className="relative border-t border-neutral-950/10 bg-neutral-950 p-8 text-white lg:border-l lg:border-t-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(45,212,191,0.28),transparent_24rem),radial-gradient(circle_at_100%_80%,rgba(251,146,60,0.24),transparent_22rem)]" />
            <div className="relative flex h-full min-h-80 flex-col justify-between rounded-[1.5rem] border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur">
              <div>
                <div className="mb-6 flex items-center justify-between">
                  <IconTile
                    icon={UploadCloud}
                    tone="light"
                    className="h-12 w-12 shadow-none"
                  />
                  <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-200">
                    Ready for import
                  </span>
                </div>
                <div className="space-y-4">
                  <SkeletonRow label="Checking statement" value="waiting" />
                  <SkeletonRow label="Credit card statement" value="waiting" />
                  <SkeletonRow label="Ledger balance" value="from QFX" />
                </div>
              </div>
              <div className="mt-10 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-neutral-400">
                  Phase 1 target
                </div>
                <div className="mt-2 text-2xl font-semibold tracking-tight">
                  Raw account truth before smart categorization.
                </div>
              </div>
            </div>
          </div>
        </div>
      </Surface>
    );
  }

  return (
    <div className="animate-rise space-y-6">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard
          label="Imported cash"
          value={formatMoney(metrics.cashBalance)}
          tone="positive"
          helper="Latest checking/savings statement balances"
        />
        <StatCard
          label="Credit cards"
          value={formatMoney(metrics.creditBalance)}
          tone="negative"
          helper="Latest imported card balances"
        />
        <StatCard
          label="Debits"
          value={formatMoney(metrics.debits)}
          tone="negative"
          helper="Money out in the selected ledger"
        />
        <StatCard
          label="Credits"
          value={formatMoney(metrics.credits)}
          tone="positive"
          helper="Money in in the selected ledger"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {accounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            snapshot={snapshotsByAccount.get(account.id)}
            transactionCount={ledger.summary.accountCounts[account.id] || 0}
            selected={selectedAccountId === account.id}
            onSelect={() =>
              selectAccount(selectedAccountId === account.id ? "all" : account.id)
            }
          />
        ))}
      </section>

      <Surface className="bg-white/80">
        <div className="flex flex-col gap-3 border-b border-neutral-950/10 p-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.03em]">
              Transaction ledger
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              {metrics.transactionCount.toLocaleString()} imported transactions.
              Balances are latest statement balances, not live bank balances.
            </p>
          </div>
          <label className="flex flex-col gap-1 text-xs font-semibold text-neutral-500">
            Account
            <select
              className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-neutral-900"
              value={selectedAccountId}
              onChange={(event) => selectAccount(event.target.value)}
            >
              <option value="all">All accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {getAccountName(account)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="p-4">
          <div className="h-[560px] overflow-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <Table className="min-w-[820px]">
              <TableHeader className="sticky top-0 z-10 bg-neutral-950 text-white">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-semibold text-neutral-300">
                    Date
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-neutral-300">
                    Account
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-neutral-300">
                    Description
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-neutral-300">
                    Marker
                  </TableHead>
                  <TableHead className="text-right text-xs font-semibold text-neutral-300">
                    Amount
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.transactions.map((tx) => {
                  const account = accountsById.get(tx.account_id);
                  const amount = toNumber(tx.amount);
                  const marker = getTransactionMarker(tx);

                  return (
                    <TableRow
                      key={tx.id}
                      className="transition-colors hover:bg-stone-50"
                    >
                      <TableCell className="whitespace-nowrap text-xs text-neutral-500">
                        {formatDate(tx.date)}
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate text-xs text-neutral-600">
                        {account ? getAccountName(account) : "Unknown account"}
                      </TableCell>
                      <TableCell className="max-w-[360px] truncate text-sm font-medium text-neutral-900">
                        {tx.merchant_name || tx.raw_description}
                      </TableCell>
                      <TableCell>
                        {marker ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-600">
                            <Repeat2 className="h-3 w-3" />
                            {marker}
                          </span>
                        ) : (
                          <span className="text-xs text-neutral-400">-</span>
                        )}
                      </TableCell>
                      <TableCell
                        className={`whitespace-nowrap text-right text-sm font-semibold ${
                          amount >= 0 ? "text-emerald-700" : "text-rose-600"
                        }`}
                      >
                        {amount >= 0 ? "+" : "-"}
                        {formatMoney(Math.abs(amount))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <Pagination
            className="mt-4"
            pagination={ledger.pagination}
            isLoading={isLoadingLedger}
            onPageChange={goToPage}
          />
        </div>
      </Surface>
    </div>
  );
}

function AccountCard({
  account,
  snapshot,
  transactionCount,
  selected,
  onSelect,
}: {
  account: Account;
  snapshot?: BalanceSnapshot;
  transactionCount: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const kind = getAccountKind(account.account_type);
  const Icon = kind === "credit" ? CreditCard : Landmark;
  const balance = getSnapshotBalance(snapshot);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group rounded-[1.5rem] text-left transition duration-200 hover:-translate-y-0.5 ${
        selected
          ? "shadow-[0_24px_70px_rgba(15,23,42,0.18)] ring-2 ring-neutral-950"
          : "shadow-[0_18px_50px_rgba(15,23,42,0.08)] ring-1 ring-white/70"
      }`}
    >
      <Surface className="h-full rounded-[1.5rem] border-0 bg-white/80 shadow-none">
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold tracking-[-0.03em]">
                {getAccountName(account)}
              </div>
              <div className="mt-1 text-xs text-neutral-500">
                {formatInstitution(account.institution)}
                {account.last_four ? ` ***${account.last_four}` : ""}
              </div>
            </div>
            <IconTile icon={Icon} className="h-10 w-10 transition group-hover:scale-105" />
          </div>
        </div>
        <div className="space-y-2 px-4 pb-4">
          <div className="text-3xl font-semibold tracking-[-0.04em] text-neutral-950">
            {snapshot ? formatMoney(balance) : "Balance unavailable"}
          </div>
          <div className="text-xs text-neutral-500">
            {snapshot?.balance_date
              ? `Balance date ${formatDate(snapshot.balance_date)}`
              : transactionCount > 0
              ? "Transactions imported. Re-upload this statement to save its balance."
              : "Upload a statement with balance data"}
          </div>
          {snapshot?.source_filename ? (
            <div className="truncate text-xs text-neutral-400">
              {snapshot.source_filename}
            </div>
          ) : null}
        </div>
      </Surface>
    </button>
  );
}

function SkeletonRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/10 p-4">
      <div>
        <div className="text-sm font-semibold">{label}</div>
        <div className="mt-1 text-xs text-neutral-400">QFX / OFX pipeline</div>
      </div>
      <div className="rounded-full bg-white/10 px-3 py-1 text-xs text-neutral-300">
        {value}
      </div>
    </div>
  );
}

function compareSnapshots(a: BalanceSnapshot, b: BalanceSnapshot): number {
  const aDate = new Date(a.balance_date || a.created_at).getTime();
  const bDate = new Date(b.balance_date || b.created_at).getTime();
  return aDate - bDate;
}

function getSnapshotBalance(snapshot?: BalanceSnapshot): number {
  if (!snapshot) return 0;
  if (snapshot.ledger_balance !== null) return toNumber(snapshot.ledger_balance);
  if (snapshot.available_balance !== null) {
    return toNumber(snapshot.available_balance);
  }
  return 0;
}

function getAccountName(account: Account): string {
  return account.display_name || account.name;
}

function getAccountKind(accountType: string): AccountKind {
  const normalized = accountType.toLowerCase();
  if (normalized.includes("credit")) return "credit";
  if (
    normalized.includes("checking") ||
    normalized.includes("savings") ||
    normalized.includes("bank")
  ) {
    return "cash";
  }
  return "other";
}

function getTransactionMarker(tx: LedgerTransaction): string | null {
  const text = `${tx.merchant_name || ""} ${tx.raw_description || ""}`.toLowerCase();
  if (tx.is_zelle) return "Zelle";
  if (text.includes("payment to") || text.includes("mobile pmt")) {
    return "Card payment";
  }
  if (text.includes("transfer to") || text.includes("transfer from")) {
    return "Possible transfer";
  }
  if (text.includes("online realtime transfer")) {
    return "Possible transfer";
  }
  return null;
}

function toNumber(value: number | string | null): number {
  if (value === null) return 0;
  if (typeof value === "number") return value;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function emptySummary(): LedgerSummary {
  return {
    debits: 0,
    credits: 0,
    netMovement: 0,
    transactionCount: 0,
    accountCounts: {},
  };
}

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string): string {
  return format(new Date(value), "MMM d, yyyy");
}

function formatInstitution(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
