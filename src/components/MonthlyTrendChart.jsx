import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import ChartCard from "./dashboard/ChartCard";

function toRupiah(n = 0) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

export default function MonthlyTrendChart({ data = [] }) {
  const renderTooltip = ({ payload, label }) => {
    if (!payload?.length) return null;
    const p = payload[0];
    return (
      <div className="rounded-lg border border-white/10 bg-white/95 px-3 py-2 text-xs text-text shadow-lg dark:bg-slate-900/90">
        <div className="font-medium text-text">{label}</div>
        <div className="text-brand">{toRupiah(p.value)}</div>
      </div>
    );
  };

  return (
    <ChartCard
      title="Tren Saldo Bulanan"
      subtext="Perubahan saldo bersih per bulan"
      isEmpty={!data.length}
    >
      {({ height }) => (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart
            data={data}
            margin={{ top: 16, right: 16, left: 0, bottom: 8 }}
          >
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: "var(--text-muted)" }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
            />
            <YAxis
              tick={{ fill: "var(--text-muted)" }}
              tickFormatter={(value) => `${Math.round(value / 1000)}k`}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
            />
            <Tooltip content={renderTooltip} cursor={{ stroke: "var(--brand-ring)" }} />
            <Line
              type="monotone"
              dataKey="net"
              stroke="hsl(var(--brand-h) var(--brand-s) var(--brand-l))"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

