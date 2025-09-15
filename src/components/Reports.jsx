import { useMemo } from "react";
import KPITiles from "./KPITiles";
import ExportReport from "./ExportReport";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  BarChart,
  Bar,
} from "recharts";

function toRupiah(n = 0) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

export default function Reports({
  month,
  months = [],
  txs = [],
  budgets = [],
  comparePrevEnabled,
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
  const byCategory = Object.entries(catAgg)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
  const pieData = byCategory.map((c) => ({ name: c.category, value: c.total }));
  const COLORS = [
    "#dc2626",
    "#fb923c",
    "#f59e0b",
    "#eab308",
    "#84cc16",
    "#22c55e",
    "#0ea5e9",
    "#6366f1",
    "#a855f7",
    "#ec4899",
  ];

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

  const budgetsForMonth = budgets
    .filter((b) => b.month === month)
    .map((b) => {
      const cap = Number(b.amount || 0);
      const used = filtered
        .filter((t) => t.type === "expense" && t.category === b.category)
        .reduce((s, t) => s + Number(t.amount || 0), 0);
      return {
        category: b.category,
        cap,
        used,
        remaining: cap - used,
        progress: cap > 0 ? used / cap : 0,
      };
    });

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

  const compareData = [
    { name: "Pemasukan", thisMonth: income, prevMonth: prevIncome },
    { name: "Pengeluaran", thisMonth: expense, prevMonth: prevExpense },
  ];

  const renderPieTooltip = ({ payload }) => {
    if (!payload?.length) return null;
    const p = payload[0];
    return (
      <div className="rounded bg-white p-2 text-xs shadow">
        {p.name}: {toRupiah(p.value)}
      </div>
    );
  };

  const renderAreaTooltip = ({ payload, label }) => {
    if (!payload?.length) return null;
    return (
      <div className="rounded bg-white p-2 text-xs shadow">
        <div>Hari {label}</div>
        {payload.map((p) => (
          <div
            key={p.dataKey}
            className={p.dataKey === "income" ? "text-green-600" : "text-red-600"}
          >
            {p.name}: {toRupiah(p.value)}
          </div>
        ))}
      </div>
    );
  };

  const renderBarTooltip = ({ payload }) => {
    if (!payload?.length) return null;
    const p = payload[0];
    return (
      <div className="rounded bg-white p-2 text-xs shadow">
        {p.payload.name}: {toRupiah(p.value)}
      </div>
    );
  };

  return (
    <section className="space-y-4">
      <div id="report-capture" className="space-y-4">
        <div className="card">
          <h2 className="font-semibold">Laporan Bulan {month}</h2>
        </div>
        <KPITiles
          income={income}
          expense={expense}
          prevIncome={prevIncome}
          prevExpense={prevExpense}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-[260px] md:h-[300px]">
            {pieData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" innerRadius="50%" outerRadius="80%">
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={renderPieTooltip} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm">
                Belum ada data kategori.
              </div>
            )}
          </div>
          <div className="h-[260px] md:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={byDay}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip content={renderAreaTooltip} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="income"
                  name="Pemasukan"
                  stroke="#16a34a"
                  fill="#16a34a"
                  fillOpacity={0.3}
                />
                <Area
                  type="monotone"
                  dataKey="expense"
                  name="Pengeluaran"
                  stroke="#dc2626"
                  fill="#dc2626"
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {comparePrevEnabled && (
            <div className="h-[260px] md:h-[300px] md:col-span-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={compareData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip content={renderBarTooltip} />
                  <Legend />
                  <Bar dataKey="thisMonth" name={month} fill="#3898f8" />
                  <Bar dataKey="prevMonth" name={prevMonth} fill="#94a3b8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="card">
          <h3 className="mb-2 font-semibold">Kepatuhan Budget</h3>
          {budgetsForMonth.length ? (
            <div className="table-wrap">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="p-1">Kategori</th>
                    <th className="p-1">Limit</th>
                    <th className="p-1">Terpakai</th>
                    <th className="p-1">Sisa</th>
                    <th className="p-1">Progres</th>
                  </tr>
                </thead>
                <tbody>
                  {budgetsForMonth.map((b) => (
                    <tr key={b.category} className="align-top">
                      <td className="p-1">{b.category}</td>
                      <td className="p-1">{toRupiah(b.cap)}</td>
                      <td className="p-1">{toRupiah(b.used)}</td>
                      <td className="p-1">{toRupiah(b.remaining)}</td>
                      <td className="p-1 w-32">
                        <div className="h-2 rounded-full bg-slate-200">
                          <div
                            className="h-2 rounded-full bg-brand-var"
                            style={{ width: `${Math.min(100, b.progress * 100)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-sm">Belum ada budget bulan ini.</div>
          )}
        </div>
      </div>
      <ExportReport
        month={month}
        kpi={kpi}
        byCategory={byCategory}
        byDay={byDay}
        budgetsForMonth={budgetsForMonth}
      />
    </section>
  );
}
