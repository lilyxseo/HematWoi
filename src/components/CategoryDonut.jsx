import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import ChartCard from "./dashboard/ChartCard";

function toRupiah(n = 0) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

const FALLBACK_COLORS = [
  "#dc2626",
  "#f97316",
  "#eab308",
  "#16a34a",
  "#0ea5e9",
  "#6366f1",
  "#d946ef",
  "#475569",
];

function resolveColor(item, index) {
  if (typeof item?.color === "string" && item.color) return item.color;
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

export default function CategoryDonut({ data = [] }) {
  const total = data.reduce((sum, item) => {
    const value = Number(item?.value);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
  const totalLabel = toRupiah(total);

  const renderTooltip = ({ payload }) => {
    if (!payload?.length) return null;
    const p = payload[0];
    return (
      <div className="rounded-lg border border-white/10 bg-white/95 px-3 py-2 text-xs text-text shadow-lg dark:bg-slate-900/90">
        <div className="font-medium text-text">{p.name}</div>
        <div className="text-brand">{toRupiah(p.value)}</div>
      </div>
    );
  };

  return (
    <ChartCard
      title="Distribusi Kategori"
      subtext="Persentase pengeluaran per kategori"
      isEmpty={!data.length}
      footer={
        data.length ? (
          <ul className="flex flex-wrap items-center gap-3 text-xs text-muted/90">
            {data.map((item, index) => (
              <li key={item.name} className="flex min-w-0 items-center gap-2">
                <span
                  className="h-3 w-3 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: resolveColor(item, index) }}
                />
                <span className="truncate">
                  {item.name} · {toRupiah(item.value)}
                </span>
              </li>
            ))}
          </ul>
        ) : null
      }
    >
      {({ height }) => (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="70%"
              outerRadius="80%"
              paddingAngle={4}
            >
              {data.map((entry, i) => (
                <Cell key={entry.name || i} fill={resolveColor(entry, i)} />
              ))}
            </Pie>
            <Tooltip content={renderTooltip} />
            <text
              x="50%"
              y="47%"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="currentColor"
              className="text-base font-semibold sm:text-lg"
            >
              {totalLabel}
            </text>
            <text
              x="50%"
              y="60%"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="currentColor"
              className="text-[10px] text-muted sm:text-xs"
            >
              Total Bulan Ini
            </text>
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

