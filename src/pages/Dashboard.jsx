import { useMemo, useState, useCallback } from "react";
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
import useDashboardBalances from "../hooks/useDashboardBalances";
import PeriodPicker from "../components/dashboard/PeriodPicker";
import DashboardSummary from "../components/dashboard/DashboardSummary";
import EventBus from "../lib/eventBus";
import {
  formatRangeLabel,
  getThisMonthRange,
  getThisWeekRange,
  getTodayRange,
  parseDateInput,
} from "../lib/date-range";

// Each content block uses <Section> to maintain a single vertical rhythm.
const presetToRange = (preset) => {
  switch (preset) {
    case "today":
      return getTodayRange();
    case "week":
      return getThisWeekRange();
    case "month":
    default:
      return getThisMonthRange();
  }
};

export default function Dashboard({ stats, txs, budgetStatus = [] }) {
  const [preset, setPreset] = useState("month");
  const [range, setRange] = useState(presetToRange("month"));

  const startDate = parseDateInput(range.start);
  const endDate = parseDateInput(range.end);

  const balances = useDashboardBalances({ start: startDate, end: endDate });

  const refreshBalances = useCallback(() => {
    void balances.refresh();
  }, [balances]);

  const handlePresetChange = useCallback((nextPreset) => {
    setPreset(nextPreset);
    if (nextPreset !== "custom") {
      const nextRange = presetToRange(nextPreset);
      setRange(nextRange);
    }
  }, []);

  const handleRangeChange = useCallback((value) => {
    setRange(value);
  }, []);

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
  const periodLabel = formatRangeLabel(range);

  return (
    <div className="space-y-6 sm:space-y-8 lg:space-y-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Dashboard
        </h1>
        <p className="text-sm text-muted sm:text-base">
          Ringkasan keuanganmu — {periodLabel}
        </p>
      </header>

      <div className="space-y-6">
        <PeriodPicker
          value={range}
          preset={preset}
          onChange={handleRangeChange}
          onPresetChange={handlePresetChange}
          onRefresh={refreshBalances}
          loading={balances.loading}
        />

        <DashboardSummary
          range={range}
          income={balances.income}
          expense={balances.expense}
          cashBalance={balances.cashBalance}
          nonCashBalance={balances.nonCashBalance}
          totalBalance={balances.totalBalance}
          loading={balances.loading}
          error={balances.error}
          onRetry={refreshBalances}
        />
      </div>

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
    </div>
  );
}
