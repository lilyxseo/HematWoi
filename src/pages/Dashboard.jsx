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
import DailyQuote from "../components/DailyQuote";
import FinanceMascot from "../components/FinanceMascot";
import AvatarLevel from "../components/AvatarLevel.jsx";
import EventBus from "../lib/eventBus";


export default function Dashboard({
  stats,
  monthForReport,
  txs,
  budgets,
  months = [],
  challenges = [],
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

  const summary = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    const todayTx = txs.filter((t) => t.date === todayStr);
    const todayExpense = todayTx
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    const todayIncome = todayTx
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const categoryTotals = todayTx
      .filter((t) => t.type === "expense")
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {});
    const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const weekTx = txs.filter((t) => {
      const d = new Date(t.date);
      return d >= startOfWeek && d <= today;
    });
    const weekExpense = weekTx
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    const weekIncome = weekTx
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);

    const monthTx = txs.filter((t) => {
      const d = new Date(t.date);
      return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    });
    const monthExpense = monthTx
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    const monthIncome = monthTx
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const dayOfMonth = today.getDate();
    const dailyAverageExpense = dayOfMonth ? monthExpense / dayOfMonth : 0;

    const topCategoriesByDay = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const dStr = d.toISOString().split("T")[0];
      const dayTx = txs.filter((t) => t.date === dStr && t.type === "expense");
      const totals = dayTx.reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {});
      const top = Object.entries(totals).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (top) topCategoriesByDay.push(top);
    }

    return {
      today: { income: todayIncome, expense: todayExpense, topCategory },
      thisWeek: { income: weekIncome, expense: weekExpense },
      thisMonth: {
        income: monthIncome,
        expense: monthExpense,
        dailyAverageExpense,
        topCategoriesByDay,
      },
    };
  }, [txs]);

  return (
    <main className="max-w-5xl mx-auto p-4 space-y-6">
      <Summary stats={stats} />
      <FinanceMascot summary={summary} budgets={budgets} onRefresh={() => {}} />
      <DailyStreak streak={streak} />
        <AvatarLevel transactions={txs} challenges={challenges} />
      <button
        type="button"
        onClick={() => EventBus.emit("xp:add", { code: "demo", amount: 10 })}
        className="px-2 py-1 text-xs bg-emerald-500 text-white rounded"
      >
        +10 XP Demo
      </button>
      <DailyQuote />
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
