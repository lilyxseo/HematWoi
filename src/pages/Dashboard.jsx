import { useEffect, useState } from "react";
import KpiCards from "../components/KpiCards";
import QuoteBoard from "../components/QuoteBoard";
import SavingsProgress from "../components/SavingsProgress";
import BadgesPanel from "../components/BadgesPanel";
import QuickActions from "../components/QuickActions";
import BudgetStatusHighlights from "../components/BudgetStatusHighlights";
import SectionHeader from "../components/SectionHeader";
import MonthlyTrendChart from "../components/MonthlyTrendChart";
import CategoryDonut from "../components/CategoryDonut";
import TopSpendsTable from "../components/TopSpendsTable";
import RecentTransactions from "../components/RecentTransactions";
import useInsights from "../hooks/useInsights";
import EventBus from "../lib/eventBus";
import { ensureDailyEvaluation, onAchievementsUpdated } from "../lib/achievements";

// Each content block uses <Section> to maintain a single vertical rhythm.
const BADGES_SECTION_ID = 'dashboard-achievements';

export default function Dashboard({ stats, txs, budgetStatus = [] }) {
  const [badges, setBadges] = useState([]);

  const insights = useInsights(txs);
  const savingsTarget = stats?.savingsTarget || 1_000_000;

  useEffect(() => {
    let active = true;
    ensureDailyEvaluation()
      .then((records) => {
        if (active) {
          setBadges(records);
        }
      })
      .catch(() => {
        if (active) {
          setBadges([]);
        }
      });
    const unsubscribe = onAchievementsUpdated(({ achievements }) => {
      setBadges(achievements);
    });
    return () => {
      active = false;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  return (
    <div className="space-y-6 sm:space-y-8 lg:space-y-10">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Dashboard
          </h1>
          <p className="text-sm text-muted sm:text-base">
            Ringkasan keuanganmu
          </p>
        </div>
        <a
          href={`#${BADGES_SECTION_ID}`}
          className="text-sm font-semibold text-brand hover:underline"
        >
          Lihat Pencapaian
        </a>
      </header>

      <KpiCards
        income={stats?.income || 0}
        expense={stats?.expense || 0}
        net={stats?.balance || 0}
      />

      <QuoteBoard />

      <div className="grid gap-6 sm:gap-7 lg:gap-8 lg:grid-cols-2">
        <SavingsProgress current={stats?.balance || 0} target={savingsTarget} />
        <BadgesPanel badges={badges} id={BADGES_SECTION_ID} />
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
