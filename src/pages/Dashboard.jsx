import { useMemo, useRef, useState } from "react";
import AddForm from "../components/AddForm";
import Filters from "../components/Filters";
import Summary from "../components/Summary";
import DataTools from "../components/DataTools";
import DashboardCharts from "../components/DashboardCharts";
import ReportFilters from "../components/ReportFilters";
import Reports from "../components/Reports";
import BudgetSection from "../components/BudgetSection";
import TxTable from "../components/TxTable";
import Skeleton from "../components/Skeleton";
import { Table as TableIcon } from "lucide-react";

export default function Dashboard({
  months,
  filter,
  setFilter,
  stats,
  data,
  addTx,
  removeTx,
  updateTx,
  currentMonth,
  setShowCat,
  addBudget,
  removeBudget,
  onExport,
  onImportJSON,
  onImportCSV,
}) {
  const addRef = useRef(null);
  const [reportMonth, setReportMonth] = useState(
    filter.month === "all" ? currentMonth : filter.month
  );
  const [comparePrev, setComparePrev] = useState(false);

  const filtered = useMemo(() => {
    return data.txs.filter((t) => {
      if (filter.type !== "all" && t.type !== filter.type) return false;
      if (filter.month !== "all" && String(t.date).slice(0, 7) !== filter.month)
        return false;
      if (filter.q) {
        const q = filter.q.toLowerCase();
        const note = t.note?.toLowerCase() || "";
        const cat = t.category?.toLowerCase() || "";
        if (!note.includes(q) && !cat.includes(q)) return false;
      }
      return true;
    });
  }, [data.txs, filter]);

  const isLoading = data.txs.length === 0 && filter.month !== "all";

  return (
    <main className="max-w-5xl mx-auto p-4 space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div ref={addRef}>
          <AddForm categories={data.cat} onAdd={addTx} />
        </div>
        <Filters months={months} filter={filter} setFilter={setFilter} />
        <Summary stats={stats} />
        <DataTools
          onExport={onExport}
          onImportJSON={onImportJSON}
          onImportCSV={onImportCSV}
          onManageCat={() => setShowCat(true)}
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-28 w-full" />
      ) : (
        <DashboardCharts
          month={filter.month === "all" ? currentMonth : filter.month}
          txs={data.txs}
        />
      )}

      <ReportFilters
        month={reportMonth}
        months={months}
        comparePrev={comparePrev}
        onToggleCompare={setComparePrev}
        onChange={setReportMonth}
      />
      <Reports
        month={reportMonth}
        months={months}
        txs={data.txs}
        budgets={data.budgets}
        comparePrevEnabled={comparePrev}
      />

      <BudgetSection
        filterMonth={filter.month === "all" ? currentMonth : filter.month}
        budgets={data.budgets}
        txs={data.txs}
        categories={data.cat}
        onAdd={addBudget}
        onRemove={removeBudget}
      />

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <TableIcon className="h-4 w-4" />
          <h2 className="text-sm font-semibold">Daftar Transaksi</h2>
        </div>
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : filtered.length === 0 ? (
          <div className="card text-center">
            <div className="mb-2">Belum ada transaksi.</div>
            <button
              className="btn btn-primary"
              onClick={() =>
                addRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }
            >
              Tambah Transaksi
            </button>
          </div>
        ) : (
          <TxTable items={filtered} onRemove={removeTx} onUpdate={updateTx} />
        )}
      </div>
    </main>
  );
}
