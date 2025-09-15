import { useMemo } from "react";
import KPITiles from "./KPITiles";
import ExportReport from "./ExportReport";

export default function Reports({
  month,
  months = [],
  txs = [],
}) {
  const filtered = useMemo(
    () => txs.filter((t) => String(t.date).slice(0, 7) === month),
    [txs, month]
  );

  const income = useMemo(
    () =>
      filtered
        .filter((t) => t.type === "income")
        .reduce((s, t) => s + Number(t.amount || 0), 0),
    [filtered]
  );
  const expense = useMemo(
    () =>
      filtered
        .filter((t) => t.type === "expense")
        .reduce((s, t) => s + Number(t.amount || 0), 0),
    [filtered]
  );
  const balance = income - expense;
  const savings = income > 0 ? balance / income : 0;

  const [y, m] = month.split("-").map(Number);
  const prevDate = new Date(y, m - 2, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(
    prevDate.getMonth() + 1
  ).padStart(2, "0")}`;
  const prevMonthExists = months.includes(prevMonth);
  const prevTxs = useMemo(
    () =>
      prevMonthExists
        ? txs.filter((t) => String(t.date).slice(0, 7) === prevMonth)
        : [],
    [txs, prevMonth, prevMonthExists]
  );
  const prevIncome = prevTxs
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const prevExpense = prevTxs
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount || 0), 0);

  const catAgg = {};
  filtered.forEach((t) => {
    if (t.type === "expense") {
      const cat = t.category || "Lainnya";
      catAgg[cat] = (catAgg[cat] || 0) + Number(t.amount || 0);
    }
  });


  const daysInMonth = new Date(y, m, 0).getDate();
  const dayMap = {};
  filtered.forEach((t) => {
    const d = String(t.date).slice(8, 10);
    if (!dayMap[d]) dayMap[d] = { day: d, income: 0, expense: 0 };
    dayMap[d][t.type] += Number(t.amount || 0);
  });
  const byDay = Array.from({ length: daysInMonth }, (_, i) => {
    const d = String(i + 1).padStart(2, "0");
    return {
      date: `${month}-${d}`,
      day: d,
      income: dayMap[d]?.income || 0,
      expense: dayMap[d]?.expense || 0,
    };
  });

  const incomeSeries = byDay.map((d) => d.income);
  const expenseSeries = byDay.map((d) => d.expense);
  const balanceSeries = byDay.map((d) => d.income - d.expense);
  if (typeof window !== "undefined") {
    window.__hw_kpiSeries = {
      income: incomeSeries,
      expense: expenseSeries,
      balance: balanceSeries,
    };
  }


  const kpi = { income, expense, balance, savings };

  if (income + expense === 0) {
    return (
      <section className="space-y-4">
        <div id="report-capture" className="space-y-4">
          <div className="card">
            <h2 className="font-semibold">Laporan Bulan {month}</h2>
          </div>
          <div className="card text-center">Belum ada data pada bulan ini.</div>
        </div>
        <ExportReport
          month={month}
          kpi={kpi}
          byCategory={[]}
          byDay={[]}
          budgetsForMonth={[]}
        />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div id="report-capture" className="space-y-4">
        <KPITiles
          income={income}
          expense={expense}
          prevIncome={prevIncome}
          prevExpense={prevExpense}
        />
        </div>
    </section>
  );
}

