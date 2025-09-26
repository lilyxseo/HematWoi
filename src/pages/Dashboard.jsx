import { useEffect, useMemo, useState } from "react";
import QuoteBoard from "../components/QuoteBoard";
import SavingsProgress from "../components/SavingsProgress";
import AchievementBadges from "../components/AchievementBadges";
import QuickActions from "../components/QuickActions";
import BudgetStatusHighlights from "../components/BudgetStatusHighlights";
import SectionHeader from "../components/SectionHeader";
import MonthlyTrendChart from "../components/MonthlyTrendChart";
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
import BudgetOverview from "../components/dashboard/BudgetOverview";

const DEFAULT_PRESET = "month";

// Each content block uses <Section> to maintain a single vertical rhythm.
export default function Dashboard({ stats, txs, budgets = [], budgetStatus = [] }) {
  const [periodPreset, setPeriodPreset] = useState(DEFAULT_PRESET);
  const [periodRange, setPeriodRange] = useState(() => getPresetRange(DEFAULT_PRESET));
  const balances = useDashboardBalances(periodRange);
  const {
    income: periodIncome,
    expense: periodExpense,
    cashBalance,
    nonCashBalance,
    totalBalance,
    loading,
    error,
    refresh,
  } = balances;
  const { start: periodStart, end: periodEnd } = periodRange;

  const digest = useShowDigestOnLogin({
    transactions: txs,
    budgets,
    balanceHint: stats?.balance ?? null,
  });

  useEffect(() => {
    refresh({ start: periodStart, end: periodEnd });
  }, [periodStart, periodEnd, refresh]);

  const handlePeriodChange = (range, preset) => {
    setPeriodRange(range);
    setPeriodPreset(preset);
  };

  const streak = useMemo(() => {
    const dates = new Set(txs.map((t) => new Date(t.date).toDateString()));
    let count = 0;
    const today = new Date();
    while (
      dates.has(
        new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() - count
        ).toDateString()
      )
    ) {
      count++;
    }
    return count;
  }, [txs]);

  const insights = useInsights(txs);
  const savingsTarget = stats?.savingsTarget || 1_000_000;

  return (
    <>
      <DailyDigestModal
        open={digest.open}
        data={digest.data}
        onClose={digest.close}
      />
      <div className="space-y-6 sm:space-y-8 lg:space-y-10">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
            className="inline-flex h-10 items-center justify-center rounded-2xl border border-border-subtle bg-surface-alt px-4 text-sm font-semibold text-text shadow-sm transition hover:bg-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
          >
            Lihat Ringkasan Hari Ini
          </button>
        </header>

        <section className="space-y-4">
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
            loading={loading}
            error={error}
            period={periodRange}
          />
        </section>

        <QuoteBoard />

        <div className="grid gap-6 sm:gap-7 lg:gap-8 lg:grid-cols-2">
          <SavingsProgress current={stats?.balance || 0} target={savingsTarget} />
          <AchievementBadges
            stats={stats}
            streak={streak}
            target={savingsTarget}
          />
        </div>

        <QuickActions />

        <BudgetOverview budgets={budgets} transactions={txs} period={periodRange} />

        <BudgetStatusHighlights items={budgetStatus} />

        <section className="space-y-6 sm:space-y-8 lg:space-y-10">
          <SectionHeader title="Analisis Bulanan" />
          <div className="grid gap-6 sm:gap-7 lg:gap-8 lg:grid-cols-2">
            <MonthlyTrendChart data={insights.trend} />
            <CategoryDonut data={insights.categories} />
          </div>
          <div className="grid gap-6 sm:gap-7 lg:gap-8 lg:grid-cols-2">
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
