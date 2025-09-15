import { useMemo } from "react";
import Summary from "../components/Summary";
import DashboardCharts from "../components/DashboardCharts";
import Reports from "../components/Reports";
import QuickActions from "../components/QuickActions";
import RecentTransactions from "../components/RecentTransactions";
import SmartFinancialInsights from "../components/SmartFinancialInsights";
import DailyStreak from "../components/DailyStreak";
import SavingsProgress from "../components/SavingsProgress";
import AchievementBadges from "../components/AchievementBadges";

export default function Dashboard({
  stats,
  monthForReport,
  txs,
  budgets,
  months = [],
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

  return (
    <main className="max-w-5xl mx-auto p-4 space-y-6">
      <Summary stats={stats} />
      <DailyStreak streak={streak} />
      <SavingsProgress current={stats?.balance || 0} target={savingsTarget} />
      <AchievementBadges stats={stats} streak={streak} target={savingsTarget} />
      <SmartFinancialInsights txs={txs} />
      <QuickActions />
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
