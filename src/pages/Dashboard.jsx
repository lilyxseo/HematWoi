import AddForm from "../components/AddForm";
import Summary from "../components/Summary";
import DashboardCharts from "../components/DashboardCharts";
import Reports from "../components/Reports";

export default function Dashboard({
  categories,
  onAdd,
  stats,
  monthForReport,
  txs,
  budgets,
  months = [],
}) {
  return (
    <main className="max-w-5xl mx-auto p-4 space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <AddForm categories={categories} onAdd={onAdd} />
        <Summary stats={stats} />
      </div>
      <DashboardCharts month={monthForReport} txs={txs} />
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
