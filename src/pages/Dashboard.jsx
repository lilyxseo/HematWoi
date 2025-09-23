import { useCallback, useEffect, useState } from "react";
import KpiCards from "../components/KpiCards";
import QuoteBoard from "../components/QuoteBoard";
import SavingsProgress from "../components/SavingsProgress";
import QuickActions from "../components/QuickActions";
import BudgetStatusHighlights from "../components/BudgetStatusHighlights";
import SectionHeader from "../components/SectionHeader";
import MonthlyTrendChart from "../components/MonthlyTrendChart";
import CategoryDonut from "../components/CategoryDonut";
import TopSpendsTable from "../components/TopSpendsTable";
import RecentTransactions from "../components/RecentTransactions";
import useInsights from "../hooks/useInsights";
import EventBus from "../lib/eventBus";
import BadgesPanel from "../components/BadgesPanel";
import { evaluateBadges, fetchUserAchievements } from "../lib/achievements";
import { getCurrentUserId } from "../lib/session";

// Each content block uses <Section> to maintain a single vertical rhythm.
export default function Dashboard({ stats, txs, budgetStatus = [] }) {
  const [achievements, setAchievements] = useState([]);

  const loadAchievements = useCallback(async (signal) => {
    try {
      const userId = await getCurrentUserId().catch(() => null);
      if (!userId) {
        if (!signal?.cancelled) {
          setAchievements([]);
        }
        return;
      }
      const list = await fetchUserAchievements(userId);
      if (!signal?.cancelled) {
        setAchievements(list);
      }
    } catch {
      if (!signal?.cancelled) {
        setAchievements([]);
      }
    }
  }, []);

  useEffect(() => {
    const state = { cancelled: false };
    loadAchievements(state);
    return () => {
      state.cancelled = true;
    };
  }, [loadAchievements]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const state = { cancelled: false };
    (async () => {
      try {
        const userId = await getCurrentUserId().catch(() => null);
        if (!userId) return;
        const todayKey = new Date().toISOString().slice(0, 10);
        const storageKey = `hw:lastBadgeEval:${userId}`;
        const lastRun = window.localStorage.getItem(storageKey);
        if (lastRun === todayKey) {
          return;
        }
        await evaluateBadges(userId);
        window.localStorage.setItem(storageKey, todayKey);
        await loadAchievements(state);
      } catch {
        // ignore failure so dashboard stays responsive
      }
    })();
    return () => {
      state.cancelled = true;
    };
  }, [loadAchievements]);

  const insights = useInsights(txs);
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

      <KpiCards
        income={stats?.income || 0}
        expense={stats?.expense || 0}
        net={stats?.balance || 0}
      />

      <QuoteBoard />

      <div className="grid gap-6 sm:gap-7 lg:gap-8 lg:grid-cols-2">
        <SavingsProgress current={stats?.balance || 0} target={savingsTarget} />
        <BadgesPanel achievements={achievements} />
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
