import { useMemo } from "react";
import {
  IconChartBar as BarChart3
} from '@tabler/icons-react';
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
  LabelList,
} from "recharts";

function toRupiah(n = 0) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

export default function DashboardCharts({ month, txs = [] }) {
  const filtered = useMemo(
    () => txs.filter((t) => String(t.date).slice(0, 7) === month),
    [txs, month]
  );

  const incomeTotal = filtered
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const expenseTotal = filtered
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const balance = incomeTotal - expenseTotal;

  if (incomeTotal + expenseTotal === 0) {
    return (
      <div className="card text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <BarChart3 className="h-4 w-4" />
          <span className="text-sm font-semibold">Insight Bulan Ini</span>
        </div>
        <div className="text-sm">Belum ada data bulan ini.</div>
      </div>
    );
  }

  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const dayMap = {};
  const catAgg = {};
  for (const t of filtered) {
    const d = String(t.date).slice(8, 10);
    if (!dayMap[d]) dayMap[d] = { day: d, income: 0, expense: 0 };
    dayMap[d][t.type] += Number(t.amount || 0);
    if (t.type === "expense") {
      const cat = t.category || "Lainnya";
      catAgg[cat] = (catAgg[cat] || 0) + Number(t.amount || 0);
    }
  }
  const daily = Array.from({ length: daysInMonth }, (_, i) => {
    const d = String(i + 1).padStart(2, "0");
    return { day: d, income: dayMap[d]?.income || 0, expense: dayMap[d]?.expense || 0 };
  });
  const topCats = Object.entries(catAgg)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const pieData = [
    { name: "Pemasukan", value: incomeTotal, color: "#16a34a" },
    { name: "Pengeluaran", value: expenseTotal, color: "#dc2626" },
  ];

  const renderPieTooltip = ({ payload }) => {
    if (!payload?.length) return null;
    const p = payload[0];
    return (
      <div className="rounded-lg bg-surface-1 border border-border p-2 text-xs shadow">
        {p.name}: {toRupiah(p.value)}
      </div>
    );
  };

  const renderAreaTooltip = ({ payload, label }) => {
    if (!payload?.length) return null;
    return (
      <div className="rounded-lg bg-surface-1 border border-border p-2 text-xs shadow">
        <div>Hari {label}</div>
        {payload.map((p) => (
          <div
            key={p.dataKey}
            className={p.dataKey === "income" ? "text-success" : "text-danger"}
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
      <div className="rounded-lg bg-surface-1 border border-border p-2 text-xs shadow">
        {p.payload.name}: {toRupiah(p.value)}
      </div>
    );
  };

  return (
    <div className="card">
      <div className="mb-2 flex items-center gap-2">
        <BarChart3 className="h-4 w-4" />
        <h2 className="text-sm font-semibold">Insight Bulan Ini</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-[260px] md:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} dataKey="value" innerRadius="60%" outerRadius="80%">
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={renderPieTooltip} />
              <Legend />
              <text
                x="50%"
                y="50%"
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-xs"
              >
                <tspan x="50%" dy="-0.2em">Saldo</tspan>
                <tspan x="50%" dy="1.2em">{toRupiah(balance)}</tspan>
              </text>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="h-[260px] md:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={daily} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
        <div className="h-[260px] md:h-[300px] md:col-span-2">
          {topCats.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCats} layout="vertical">
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={80} />
                <Tooltip content={renderBarTooltip} />
                <Bar dataKey="value" fill="#3898f8">
                  <LabelList dataKey="value" position="right" formatter={toRupiah} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm">
              Belum ada data bulan ini.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
