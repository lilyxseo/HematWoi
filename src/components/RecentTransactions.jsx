import { useMemo, useState } from "react";
import Segmented from "./ui/Segmented";

function formatCurrency(n = 0) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

export default function RecentTransactions({ txs = [] }) {
  const [period, setPeriod] = useState("week");

  const filtered = useMemo(() => {
    const now = new Date();
    return txs
      .filter((t) => {
        const d = new Date(t.date);
        const diff = (now - d) / (1000 * 60 * 60 * 24);
        if (period === "day") return diff < 1;
        if (period === "week") return diff < 7;
        return diff < 30;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);
  }, [txs, period]);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Transaksi Terbaru</h2>
        <Segmented
          value={period}
          onChange={setPeriod}
          options={[
            { label: "Hari", value: "day" },
            { label: "Minggu", value: "week" },
            { label: "Bulan", value: "month" },
          ]}
        />
      </div>
      {!filtered.length && (
        <div className="text-sm text-muted">Belum ada transaksi.</div>
      )}
      <ul className="space-y-2">
        {filtered.map((t) => (
          <li key={t.id} className="flex justify-between text-sm">
            <span>{t.note || t.category}</span>
            <span
              className={
                t.type === "income" ? "text-success" : "text-danger"
              }
            >
              {formatCurrency(t.amount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
