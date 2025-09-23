import { useMemo } from "react";
import InsightCard from "../components/InsightCard";
import KpiCards from "../components/KpiCards";
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
import useDashboardSummary from "../hooks/useDashboardSummary";
import useInsights from "../hooks/useInsights";
import EventBus from "../lib/eventBus";

const skeletonItems = Array.from({ length: 3 });

// Each content block uses <Section> to maintain a single vertical rhythm.
export default function Dashboard({
  stats,
  txs,
  budgets = [],
  goals = [],
  budgetStatus = [],
}) {
  const streak = useMemo(() => {
    const dates = new Set(txs.map((t) => new Date(t.date).toDateString()));
    let count = 0;
    const today = new Date();
    while (
      dates.has(
        new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() - count,
        ).toDateString(),
      )
    ) {
      count++;
    }
    return count;
  }, [txs]);

  const summary = useDashboardSummary(txs);
  const { insights, loading: insightsLoading, error: insightsError } = useInsights({
    fallback: {
      transactions: txs,
      budgets,
      goals,
    },
  });
  const savingsTarget = stats?.savingsTarget || 1_000_000;

  return (
    <div className="space-y-6 sm:space-y-8 lg:space-y-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Dashboard
        </h1>
        <p className="text-sm text-muted sm:text-base">
          Ringkasan keuanganmu
        </p>
      </header>

      <section aria-labelledby="insights-heading" className="space-y-4">
        <div className="flex flex-col gap-1">
          <h2
            id="insights-heading"
            className="text-lg font-semibold tracking-tight sm:text-xl"
          >
            Uang Bicara 2.0
          </h2>
          <p className="text-sm text-muted sm:text-base">
            Pesan kilat biar dompet tetap waras.
          </p>
        </div>
        {insightsLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {skeletonItems.map((_, index) => (
              <div
                key={`insight-skeleton-${index}`}
                className="h-28 rounded-xl border border-white/10 bg-white/40 p-4 shadow-sm animate-pulse dark:border-white/5 dark:bg-slate-800/40"
              >
                <div className="h-4 w-16 rounded bg-white/70 dark:bg-slate-700/70" />
                <div className="mt-3 h-3 w-3/4 rounded bg-white/70 dark:bg-slate-700/70" />
                <div className="mt-2 h-3 w-1/2 rounded bg-white/60 dark:bg-slate-700/60" />
              </div>
            ))}
          </div>
        ) : insightsError ? (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/40 dark:bg-rose-400/10 dark:text-rose-100">
            Waduh, Uang Bicara lagi ngambek. Coba muat ulang ya!
          </div>
        ) : insights.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {insights.map((item) => (
              <InsightCard key={item.id} insight={item} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/40 px-4 py-3 text-sm text-text shadow-sm dark:border-white/5 dark:bg-slate-800/60">
            Data lagi adem ayem. Nikmati ketenangan finansial ini!
          </div>
        )}
      </section>

      <KpiCards
        income={stats?.income || 0}
        expense={stats?.expense || 0}
        net={stats?.balance || 0}
      />

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
          <MonthlyTrendChart data={summary.trend} />
          <CategoryDonut data={summary.categories} />
        </div>
        <div className="grid gap-6 sm:gap-7 lg:gap-8 lg:grid-cols-2">
          <TopSpendsTable
            data={summary.topSpends}
            onSelect={(t) => EventBus.emit("tx:open", t)}
          />
          <RecentTransactions txs={txs} />
        </div>
      </section>
    </div>
  );
}
