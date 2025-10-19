import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Label } from "recharts";
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
  const total = data.reduce(
    (sum, item) => sum + (Number(item?.value) || 0),
    0,
  );

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
              innerRadius="75%"
              outerRadius="85%"
              paddingAngle={1}
              stroke="none"
            >
              {data.map((entry, i) => (
                <Cell key={entry.name || i} fill={resolveColor(entry, i)} />
              ))}
              <Label
                content={({ viewBox }) => {
                  if (!viewBox?.cx || !viewBox?.cy) return null;
                  const { cx, cy } = viewBox;
                  return (
                    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                      <tspan
                        x={cx}
                        y={cy - 4}
                        style={{ fontSize: "1.5rem", fontWeight: 600 }}
                        className="fill-slate-900 dark:fill-slate-100"
                      >
                        {toRupiah(total)}
                      </tspan>
                      <tspan
                        x={cx}
                        y={cy + 16}
                        style={{ fontSize: "0.75rem", fontWeight: 500 }}
                        className="fill-slate-500 dark:fill-slate-400"
                      >
                        Total bulan ini
                      </tspan>
                    </text>
                  );
                }}
              />
            </Pie>
            <Tooltip content={renderTooltip} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

