import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis } from "recharts";
import { formatMoney } from "../lib/format";

function toPercent(n = 0) {
  return (n || 0).toLocaleString("id-ID", {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function Sparkline({ data = [], color }) {
  const id = `spark-${color.replace("#", "")}`;
  const points = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={36}>
      <AreaChart data={points} margin={{ left: 0, right: 0, top: 2, bottom: 2 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="i" hide />
        <YAxis hide domain={[0, "dataMax"]} />
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          fill={`url(#${id})`}
          strokeWidth={1}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default function KPITiles({ income = 0, expense = 0, prevIncome = 0, prevExpense = 0 }) {
  const balance = income - expense;
  const prevBalance = prevIncome - prevExpense;
  const savings = income > 0 ? balance / income : 0;
  const prevSavings = prevIncome > 0 ? prevBalance / prevIncome : 0;

  const incomeDelta = prevIncome ? (income - prevIncome) / prevIncome : null;
  const expenseDelta = prevExpense ? (expense - prevExpense) / prevExpense : null;
  const balanceDelta = prevBalance ? (balance - prevBalance) / prevBalance : null;
  const savingsDelta = prevSavings ? (savings - prevSavings) / prevSavings : null;

  const renderDelta = (delta) => {
    if (delta == null || !isFinite(delta)) return "—";
    const Arrow = delta >= 0 ? ArrowUpRight : ArrowDownRight;
    const color = delta >= 0 ? "text-success" : "text-danger";
    return (
      <span className={`flex items-center justify-center gap-1 ${color}`}>
        <Arrow className="h-3 w-3" />
        {Math.abs(delta).toLocaleString("id-ID", {
          style: "percent",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })}
      </span>
    );
  };

  const series = typeof window !== "undefined" ? window.__hw_kpiSeries || {} : {};
  const incomeSeries = series.income || [];
  const expenseSeries = series.expense || [];
  const balanceSeries = series.balance || [];

  return (
    <div className="card">
      <div className="grid gap-4 text-center sm:grid-cols-4">
        <div className="space-y-1">
          <div className="text-sm">Pemasukan</div>
          <div className="text-lg font-semibold text-success hw-money">{formatMoney(income, "IDR")}</div>
          <div className="text-xs">{renderDelta(incomeDelta)}</div>
          <Sparkline data={incomeSeries} color="#16a34a" />
        </div>
        <div className="space-y-1">
          <div className="text-sm">Pengeluaran</div>
          <div className="text-lg font-semibold text-danger hw-money">{formatMoney(expense, "IDR")}</div>
          <div className="text-xs">{renderDelta(expenseDelta)}</div>
          <Sparkline data={expenseSeries} color="#dc2626" />
        </div>
        <div className="space-y-1">
          <div className="text-sm">Saldo</div>
          <div className="text-lg font-semibold text-brand hw-money">{formatMoney(balance, "IDR")}</div>
          <div className="text-xs">{renderDelta(balanceDelta)}</div>
          <Sparkline data={balanceSeries} color="#3898f8" />
        </div>
        <div className="space-y-1">
          <div className="text-sm">Savings Rate</div>
          <div className="text-lg font-semibold">{toPercent(savings)}</div>
          <div className="text-xs">{renderDelta(savingsDelta)}</div>
        </div>
      </div>
    </div>
  );
}
