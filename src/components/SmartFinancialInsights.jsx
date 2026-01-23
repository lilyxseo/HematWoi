import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { formatMoney } from "../lib/format";

function toRupiah(n = 0) {
  return formatMoney(n, "IDR");
}

function InsightCard({ title, value, badge }) {
  return (
    <div className="card">
      <div className="text-sm mb-1">{title}</div>
      <div className="text-lg font-semibold flex items-center gap-2">
        <span className="hw-money">{value}</span>
        {badge}
      </div>
    </div>
  );
}

export default function SmartFinancialInsights({ txs = [] }) {
  const expenses = useMemo(
    () => txs.filter((t) => t.type === "expense"),
    [txs]
  );

  const monthlyTotals = useMemo(() => {
    const map = {};
    expenses.forEach((t) => {
      const m = String(t.date).slice(0, 7);
      map[m] = (map[m] || 0) + Number(t.amount || 0);
    });
    return Object.entries(map)
      .map(([month, total]) => ({ month, total }))
      .sort((a, b) => (a.month > b.month ? 1 : -1));
  }, [expenses]);

  const predictedNextMonth = useMemo(() => {
    const last3 = monthlyTotals.slice(-3);
    if (!last3.length) return 0;
    const avg =
      last3.reduce((sum, m) => sum + Number(m.total || 0), 0) / last3.length;
    return Math.round(avg);
  }, [monthlyTotals]);


  const weekly = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const mondayThisWeek = new Date(now);
    const diff = (day + 6) % 7; // days since Monday
    mondayThisWeek.setDate(now.getDate() - diff);
    const mondayNextWeek = new Date(mondayThisWeek);
    mondayNextWeek.setDate(mondayThisWeek.getDate() + 7);
    const mondayPrevWeek = new Date(mondayThisWeek);
    mondayPrevWeek.setDate(mondayThisWeek.getDate() - 7);

    let thisWeek = 0;
    let lastWeek = 0;
    expenses.forEach((t) => {
      const d = new Date(t.date);
      if (d >= mondayThisWeek && d < mondayNextWeek) {
        thisWeek += Number(t.amount || 0);
      } else if (d >= mondayPrevWeek && d < mondayThisWeek) {
        lastWeek += Number(t.amount || 0);
      }
    });
    let diffPct = null;
    let trend = null;
    if (lastWeek > 0) {
      diffPct = ((thisWeek - lastWeek) / lastWeek) * 100;
      trend = diffPct <= 0 ? "hemat" : "boros";
    } else if (thisWeek > 0) {
      diffPct = 100;
      trend = "boros";
    }
    return { thisWeek, lastWeek, diffPct, trend };
  }, [expenses]);

  const topCategory = useMemo(() => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}`;
    const agg = {};
    expenses.forEach((t) => {
      const m = String(t.date).slice(0, 7);
      if (m === monthKey) {
        const cat = t.category || "Lainnya";
        agg[cat] = (agg[cat] || 0) + Number(t.amount || 0);
      }
    });
    const entries = Object.entries(agg).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return null;
    return { category: entries[0][0], amount: entries[0][1] };
  }, [expenses]);

  const weeklyBadge = weekly.trend ? (
    <span
      className={`text-xs px-2 py-0.5 rounded-full ${
        weekly.trend === "hemat"
          ? "bg-success/20 text-success"
          : "bg-danger/20 text-danger"
      }`}
    >
      {weekly.trend === "hemat" ? "Hemat" : "Boros"}
    </span>
  ) : null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <InsightCard
          title="Prediksi pengeluaran bulan depan"
          value={toRupiah(predictedNextMonth)}
        />
        <InsightCard
          title="Minggu ini vs minggu lalu"
          value={
            weekly.diffPct !== null
              ? `${weekly.diffPct > 0 ? "+" : ""}${weekly.diffPct.toFixed(1)}%`
              : "Belum ada data"
          }
          badge={weeklyBadge}
        />
        <InsightCard
          title="Kategori terboros bulan ini"
          value={
            topCategory
              ? `${topCategory.category}: ${toRupiah(topCategory.amount)}`
              : "Belum ada data"
          }
        />
      </div>
    </div>
  );
}
