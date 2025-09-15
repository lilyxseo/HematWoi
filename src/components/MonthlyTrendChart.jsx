import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

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
      <div className="rounded bg-surface-1 border border-border p-2 text-xs shadow">
        <div>{label}</div>
        <div>{toRupiah(p.value)}</div>
      </div>
    );
  };

  return (
    <div className="card h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip content={renderTooltip} />
          <Line type="monotone" dataKey="net" stroke="#3898f8" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

