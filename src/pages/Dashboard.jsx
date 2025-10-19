import { useEffect, useState } from "react";
import QuickActions from "../components/QuickActions";
import SectionHeader from "../components/SectionHeader";
import CategoryDonut from "../components/CategoryDonut";
import TopSpendsTable from "../components/TopSpendsTable";
import RecentTransactions from "../components/RecentTransactions";
import useInsights from "../hooks/useInsights";
import EventBus from "../lib/eventBus";
import DashboardSummary from "../components/dashboard/DashboardSummary";
import PeriodPicker, {
  getPresetRange,
} from "../components/dashboard/PeriodPicker";
import useDashboardBalances from "../hooks/useDashboardBalances";
import DailyDigestModal from "../components/DailyDigestModal";
import useShowDigestOnLogin from "../hooks/useShowDigestOnLogin";
import DashboardHighlightedBudgets from "../components/dashboard/DashboardHighlightedBudgets";
import FinancialInsights from "../components/dashboard/FinancialInsights";

const DEFAULT_PRESET = "month";

// Each content block uses <Section> to maintain a single vertical rhythm.
export default function Dashboard({ stats, txs }) {
  const [periodPreset, setPeriodPreset] = useState(DEFAULT_PRESET);
  const [periodRange, setPeriodRange] = useState(() => getPresetRange(DEFAULT_PRESET));
  const balances = useDashboardBalances(periodRange);
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

  const digest = useShowDigestOnLogin({
    transactions: txs,
    balanceHint: stats?.balance ?? null,
  });

  useEffect(() => {
    refresh({ start: periodStart, end: periodEnd });
  }, [periodStart, periodEnd, refresh]);

  const handlePeriodChange = (range, preset) => {
    setPeriodRange(range);
    setPeriodPreset(preset);
  };

  const insights = useInsights(txs);

  return (
    <>
      <DailyDigestModal
        open={digest.open}
        data={digest.data}
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
          </div>
          <button
            type="button"
            onClick={digest.openManual}
            aria-haspopup="dialog"
            className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-border-subtle bg-surface-alt px-3 py-2 text-sm font-semibold text-text shadow-sm transition hover:bg-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] sm:rounded-2xl sm:px-4 max-[400px]:text-xs"
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

        <section className="space-y-5 sm:space-y-7 lg:space-y-10 max-[400px]:space-y-4">
          <SectionHeader title="Analisis Bulanan" />
          <div className="grid gap-4 sm:gap-6 lg:gap-8">
            <CategoryDonut data={insights.categories} />
          </div>
          <div className="grid gap-4 sm:gap-6 lg:gap-8 lg:grid-cols-2">
            <TopSpendsTable
              data={insights.topSpends}
              onSelect={(t) => EventBus.emit("tx:open", t)}
            />
            <RecentTransactions txs={txs} />
          </div>
        </section>
      </div>
    </>
  );
}
