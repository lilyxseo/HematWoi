import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import useDailyDigest, { markDailyDigestSeen } from "../hooks/useDailyDigest";
import { useShowDigestOnLogin } from "../hooks/useShowDigestOnLogin";

const DEFAULT_PRESET = "month";

// Each content block uses <Section> to maintain a single vertical rhythm.
export default function Dashboard({ stats, txs, budgetStatus = [] }) {
  const navigate = useNavigate();
  const [periodPreset, setPeriodPreset] = useState(DEFAULT_PRESET);
  const [periodRange, setPeriodRange] = useState(() => getPresetRange(DEFAULT_PRESET));
  const balances = useDashboardBalances(periodRange);
  const digest = useDailyDigest();
  const {
    data: digestData,
    isLoading: digestLoading,
    isFetching: digestFetching,
    error: digestError,
    refetch: refetchDigest,
    userId: digestUserId,
    todayKey: digestTodayKey,
  } = digest;
  const [digestOpen, setDigestOpen] = useState(false);
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

  useEffect(() => {
    refresh({ start: periodStart, end: periodEnd });
  }, [periodStart, periodEnd, refresh]);

  const handlePeriodChange = (range, preset) => {
    setPeriodRange(range);
    setPeriodPreset(preset);
  };

  const handleDigestOpen = useCallback(() => {
    setDigestOpen(true);
    if (digestUserId && digestTodayKey) {
      markDailyDigestSeen(digestTodayKey, digestUserId);
    }
    void refetchDigest();
  }, [digestTodayKey, digestUserId, refetchDigest]);

  const handleDigestClose = useCallback(() => {
    setDigestOpen(false);
  }, []);

  const handleManualDigest = useCallback(() => {
    handleDigestOpen();
  }, [handleDigestOpen]);

  const handleAddTransaction = useCallback(() => {
    navigate("/transaction/add");
  }, [navigate]);

  const handleViewMonthly = useCallback(() => {
    navigate("/budgets");
  }, [navigate]);

  const handleSelectCategory = useCallback(
    (categoryId, name) => {
      const params = new URLSearchParams();
      params.set("range", "month");
      if (categoryId) {
        params.set("categories", categoryId);
      } else if (name) {
        params.set("search", name);
      }
      navigate({ pathname: "/transactions", search: params.toString() });
    },
    [navigate],
  );

  useShowDigestOnLogin({
    userId: digestUserId,
    todayKey: digestTodayKey,
    onRequestOpen: handleDigestOpen,
  });

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
    <div className="space-y-6 sm:space-y-8 lg:space-y-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Dashboard
          </h1>
          <p className="text-sm text-muted sm:text-base">
            Ringkasan keuanganmu
          </p>
        </div>
        <button
          type="button"
          onClick={handleManualDigest}
          className="inline-flex items-center gap-2 rounded-full border border-transparent bg-[var(--accent)]/15 px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
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

      <DailyDigestModal
        open={digestOpen}
        data={digestData}
        loading={digestLoading || digestFetching}
        error={digestError ? digestError.message : null}
        onRetry={() => {
          void refetchDigest();
        }}
        onClose={handleDigestClose}
        onAddTransaction={handleAddTransaction}
        onViewMonthly={handleViewMonthly}
        onSelectCategory={handleSelectCategory}
      />
    </div>
  );
}
