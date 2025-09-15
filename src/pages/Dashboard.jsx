import Summary from "../components/Summary";
import DashboardCharts from "../components/DashboardCharts";
import Reports from "../components/Reports";
import QuickActions from "../components/QuickActions";
import RecentTransactions from "../components/RecentTransactions";
import SmartFinancialInsights from "../components/SmartFinancialInsights";

export default function Dashboard({
  stats,
  monthForReport,
  txs,
  budgets,
  months = [],
}) {
  return (
    <main className="max-w-5xl mx-auto p-4 space-y-6">
      <Summary stats={stats} />
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
