import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

function toRupiah(n = 0) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

const COLORS = ["#dc2626", "#f97316", "#eab308", "#16a34a", "#0ea5e9", "#6366f1", "#d946ef", "#475569"];

export default function CategoryDonut({ data = [] }) {
  const renderTooltip = ({ payload }) => {
    if (!payload?.length) return null;
    const p = payload[0];
    return (
      <div className="card" style={{ padding: "8px", fontSize: "var(--fs-300)" }}>
        {p.name}: {toRupiah(p.value)}
      </div>
    );
  };

  return (
    <div className="chart-wrap">
      {data.length ? (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius="60%" outerRadius="80%">
              {data.map((entry, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={renderTooltip} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "var(--fs-400)", color: "#64748b" }}>
          Tidak ada data
        </div>
      )}
    </div>
  );
}

