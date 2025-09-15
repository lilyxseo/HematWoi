import { ResponsiveContainer } from "recharts";

function toRupiah(n = 0) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

function HeatmapSVG({ cells, weeks, width, height }) {
  const cellW = width / weeks;
  const cellH = height / 7;
  return (
    <svg width={width} height={height}>
      {cells.map((c) => (
        <rect
          key={c.date}
          x={c.week * cellW}
          y={c.dow * cellH}
          width={cellW - 2}
          height={cellH - 2}
          rx={2}
          ry={2}
          fill={c.color}
          className="cursor-pointer"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent("hw:filter-day", { detail: c.date })
            )
          }
        >
          <title>{toRupiah(c.total)}</title>
        </rect>
      ))}
    </svg>
  );
}

export default function HeatmapCalendar({ month, txs = [] }) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const start = (first.getDay() + 6) % 7; // Monday=0
  const daysInMonth = new Date(y, m, 0).getDate();
  const weeks = Math.ceil((start + daysInMonth) / 7);

  const totals = {};
  txs.forEach((t) => {
    if (t.type === "expense" && String(t.date).slice(0, 7) === month) {
      const d = String(t.date).slice(8, 10);
      totals[d] = (totals[d] || 0) + Number(t.amount || 0);
    }
  });

  const cells = [];
  for (let i = 1; i <= daysInMonth; i++) {
    const dStr = String(i).padStart(2, "0");
    const dow = (start + i - 1) % 7;
    const week = Math.floor((start + i - 1) / 7);
    const total = totals[dStr] || 0;
    cells.push({ date: `${month}-${dStr}`, dow, week, total });
  }

  const max = Math.max(...cells.map((c) => c.total), 0);
  const low = [226, 232, 240]; // #e2e8f0
  const high = [251, 113, 133]; // #fb7185
  const colored = cells.map((c) => {
    const ratio = max ? c.total / max : 0;
    const rgb = low.map((l, i) => Math.round(l + (high[i] - l) * ratio));
    return { ...c, color: `rgb(${rgb.join(",")})` };
  });

  return (
    <div className="card">
      <h3 className="mb-2 font-semibold">Kalender Pengeluaran</h3>
      <ResponsiveContainer width="100%" height={weeks * 24}>
        <HeatmapSVG cells={colored} weeks={weeks} />
      </ResponsiveContainer>
    </div>
  );
}

