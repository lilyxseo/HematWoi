import { useMemo } from "react";
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
import InsightCard from "../components/InsightCard";
import useDashboardAnalytics from "../hooks/useDashboardAnalytics";
import useInsights from "../hooks/useInsights";
import EventBus from "../lib/eventBus";

// Each content block uses <Section> to maintain a single vertical rhythm.
export default function Dashboard({ stats, txs, budgetStatus = [] }) {
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

  const analytics = useDashboardAnalytics(txs);
  const {
    insights: insightCards,
    loading: insightsLoading,
    error: insightsError,
  } = useInsights();
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

      <section className="space-y-3 rounded-2xl bg-surface p-4 shadow-sm sm:p-5">
        <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
              Uang Bicara 2.0
            </h2>
            <p className="text-xs text-muted sm:text-sm">
              Insight kocak tapi serius biar dompetmu tetap waras.
            </p>
          </div>
        </header>
        {insightsLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`insight-skeleton-${index}`}
                className="h-28 animate-pulse rounded-xl border border-border/60 bg-surface-alt/60"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {insightsError && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-medium text-amber-900 dark:border-amber-500/70 dark:bg-amber-950/40 dark:text-amber-100">
                Waduh, Uang Bicara lagi serak. Coba segarkan halaman ya.
              </div>
            )}
            {insightCards.length ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {insightCards.map((item) => (
                  <InsightCard key={item.id} insight={item} />
                ))}
              </div>
            ) : !insightsError ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900 dark:border-emerald-500/70 dark:bg-emerald-950/40 dark:text-emerald-100">
                Dompetmu adem ayem. Nikmati momen langka ini! 😌
              </div>
            ) : null}
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
          <MonthlyTrendChart data={analytics.trend} />
          <CategoryDonut data={analytics.categories} />
        </div>
        <div className="grid gap-6 sm:gap-7 lg:gap-8 lg:grid-cols-2">
          <TopSpendsTable
            data={analytics.topSpends}
            onSelect={(t) => EventBus.emit("tx:open", t)}
          />
          <RecentTransactions txs={txs} />
        </div>
      </section>
    </div>
  );
}
