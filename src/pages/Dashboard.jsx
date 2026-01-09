import { useEffect, useMemo, useState } from "react";
import QuickActions from "../components/QuickActions";
import CategoryDonut from "../components/CategoryDonut";
import TopSpendsTable from "../components/TopSpendsTable";
import RecentTransactions from "../components/RecentTransactions";
import useInsights from "../hooks/useInsights";
import EventBus from "../lib/eventBus";
import DashboardSummary from "../components/dashboard/DashboardSummary";
import PeriodPicker, {
  formatPeriodLabel,
  getPresetRange,
} from "../components/dashboard/PeriodPicker";
import useDashboardBalances from "../hooks/useDashboardBalances";
import DailyDigestModal from "../components/DailyDigestModal";
import useShowDigestOnLogin from "../hooks/useShowDigestOnLogin";
import DashboardHighlightedBudgets from "../components/dashboard/DashboardHighlightedBudgets";
import FinancialInsights from "../components/dashboard/FinancialInsights";
import { isTransactionDeleted } from "../lib/transactionUtils";
import { useMode } from "../hooks/useMode";

const DEFAULT_PRESET = "month";

// Each content block uses <Section> to maintain a single vertical rhythm.
export default function Dashboard({ stats, txs }) {
  const [periodPreset, setPeriodPreset] = useState(DEFAULT_PRESET);
  const [periodRange, setPeriodRange] = useState(() => getPresetRange(DEFAULT_PRESET));
  const { mode } = useMode();
  const balances = useDashboardBalances(periodRange, periodPreset);
  const {
    income: periodIncome,
    expense: periodExpense,
    cashBalance,
    nonCashBalance,
    totalBalance,
    incomeTrend,
    expenseTrend,
    balanceTrend,
    incomeMoM,
    expenseMoM,
    balanceMoM,
    loading,
    error,
    refresh,
  } = balances;
  const { start: periodStart, end: periodEnd } = periodRange;

  const visibleTxs = useMemo(
    () => (Array.isArray(txs) ? txs.filter((tx) => !isTransactionDeleted(tx)) : []),
    [txs],
  );

  const digest = useShowDigestOnLogin({
    transactions: txs,
    balanceHint: stats?.balance ?? null,
  });

  useEffect(() => {
    refresh({ start: periodStart, end: periodEnd }, periodPreset);
  }, [periodStart, periodEnd, periodPreset, refresh]);

  const handlePeriodChange = (range, preset) => {
    setPeriodRange(range);
    setPeriodPreset(preset);
  };

  const insights = useInsights(visibleTxs);
  const periodLabel = useMemo(
    () => formatPeriodLabel(periodRange) || "—",
    [periodRange],
  );

  return (
    <>
      <DailyDigestModal
        open={digest.open}
        data={digest.data}
        loading={digest.loading}
        onClose={digest.close}
      />
      <div className="mx-auto max-w-full space-y-6 overflow-hidden px-3 sm:space-y-8 sm:px-4 md:space-y-10 md:px-6 max-[400px]:space-y-5 max-[400px]:px-2">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Dashboard
            </h1>
            <p className="text-sm text-muted sm:text-base">
              Ringkasan keuanganmu
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold sm:text-sm">
              <span className="inline-flex items-center gap-1 rounded-full border border-border-subtle/80 bg-surface-alt/80 px-3 py-1 text-text">
                Periode <span className="text-muted">{periodLabel}</span>
              </span>
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold sm:text-sm ${
                  mode === "online"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300"
                }`}
              >
                {mode === "online" ? "✅ Online Mode" : "📴 Local Mode"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={digest.openManual}
            aria-haspopup="dialog"
            className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-brand/30 bg-brand/10 px-3 py-2 text-sm font-semibold text-brand shadow-sm transition hover:border-brand/50 hover:bg-brand/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] sm:rounded-2xl sm:px-4 max-[400px]:text-xs"
          >
            Lihat Ringkasan Hari Ini
          </button>
        </header>

        <section className="space-y-4 max-[400px]:space-y-3">
          <PeriodPicker
            value={periodRange}
            preset={periodPreset}
            onChange={handlePeriodChange}
          />
          <DashboardSummary
            income={periodIncome}
            expense={periodExpense}
            cashBalance={cashBalance}
            nonCashBalance={nonCashBalance}
            totalBalance={totalBalance}
            incomeTrend={incomeTrend}
            expenseTrend={expenseTrend}
            balanceTrend={balanceTrend}
            incomeMoM={incomeMoM}
            expenseMoM={expenseMoM}
            balanceMoM={balanceMoM}
            loading={loading}
            error={error}
            period={periodRange}
          />
        </section>

        <section className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:gap-8">
          <FinancialInsights periodEnd={periodRange.end} />

          <QuickActions />
        </section>

        <DashboardHighlightedBudgets period={periodRange} />

        <section className="rounded-3xl border border-border/60 bg-gradient-to-br from-white/90 via-white/70 to-primary/5 p-6 shadow-sm dark:border-border/40 dark:from-zinc-900/70 dark:via-zinc-900/50 dark:to-primary/10 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
                Analisis Bulanan
              </h2>
              <p className="text-sm text-muted-foreground">
                Ringkasan pola transaksi dan kategori pengeluaranmu selama periode ini.
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:gap-6 lg:gap-8">
            <CategoryDonut data={insights.categories} />
          </div>
          <div className="mt-6 grid gap-4 sm:gap-6 lg:gap-8 lg:grid-cols-2">
            <TopSpendsTable
              data={insights.topSpends}
              onSelect={(t) => EventBus.emit("tx:open", t)}
            />
            <RecentTransactions txs={visibleTxs} />
          </div>
        </section>
      </div>
    </>
  );
}
