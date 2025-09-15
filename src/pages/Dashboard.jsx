import { useEffect, useMemo } from "react";
import Summary from "../components/Summary";
import DashboardCharts from "../components/DashboardCharts";
import Reports from "../components/Reports";
import QuickActions from "../components/QuickActions";
import RecentTransactions from "../components/RecentTransactions";
import SmartFinancialInsights from "../components/SmartFinancialInsights";
import DailyStreak from "../components/DailyStreak";
import SavingsProgress from "../components/SavingsProgress";
import AchievementBadges from "../components/AchievementBadges";
import QuoteBubble from "../components/QuoteBubble";
import PageHeader from "../layout/PageHeader";
import useFinanceSummary from "../hooks/useFinanceSummary";
import LateMonthMode from "../components/LateMonthMode";
import useLateMonthMode from "../hooks/useLateMonthMode";
import KpiCards from "../components/KpiCards";
import SectionHeader from "../components/SectionHeader";
import MonthlyTrendChart from "../components/MonthlyTrendChart";
import CategoryDonut from "../components/CategoryDonut";
import TopSpendsTable from "../components/TopSpendsTable";
import useInsights from "../hooks/useInsights";


import EventBus from "../lib/eventBus";
import { useMoneyTalk } from "../context/MoneyTalkContext.jsx";


export default function Dashboard({
  stats,
  monthForReport,
  txs,
  budgets,
  months = [],
  prefs = {},
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
          today.getDate() - count
        ).toDateString()
      )
    ) {
      count++;
    }
    return count;
  }, [txs]);

  const savingsTarget = stats?.savingsTarget || 1_000_000;

  const finance = useFinanceSummary(txs, budgets);
  const lateMode = useLateMonthMode({ balance: finance.balance, avgMonthlyExpense: finance.avgMonthlyExpense }, prefs);
  const { speak } = useMoneyTalk();
  const insights = useInsights(txs);


  useEffect(() => {
    if (finance.isAnyOverBudget) {
      speak({
        category: finance.topSpenderCategory || "Belanja",
        amount: 0,
        context: { isOverBudget: true },
      });
    }
  }, [finance.isAnyOverBudget, finance.topSpenderCategory, speak]);

  return (
    <main className="max-w-5xl mx-auto p-4 space-y-6">
      <PageHeader title="Dashboard" description="Ringkasan keuanganmu" />
      <LateMonthMode active={lateMode.active} onDismiss={lateMode.dismiss} onCreateChallenge={() => EventBus.emit("challenge:create", { days: 3 })} />
      <Summary stats={stats} />
      <DailyStreak streak={streak} />
      <QuoteBubble />
      <SmartFinancialInsights txs={txs} />
      <SavingsProgress current={stats?.balance || 0} target={savingsTarget} />
      <AchievementBadges stats={stats} streak={streak} target={savingsTarget} />
      <QuickActions />
      <SectionHeader title="Analisis Bulanan" />
      <div className="grid gap-4 md:grid-cols-2">
        <MonthlyTrendChart data={insights.trend} />
        <CategoryDonut data={insights.categories} />
      </div>
      <TopSpendsTable
        data={insights.topSpends}
        onSelect={(t) => EventBus.emit("tx:open", t)}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <DashboardCharts month={monthForReport} txs={txs} />
        <RecentTransactions txs={txs} />
      </div>
      <Reports
        month={monthForReport}
        months={months}
        txs={txs}
        budgets={budgets}
        comparePrevEnabled={false}
      />
    </main>
  );
}
