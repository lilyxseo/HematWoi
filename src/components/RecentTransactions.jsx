import { useMemo, useState } from "react";
import clsx from "clsx";
import Segmented from "./ui/Segmented";
import DataList from "./dashboard/DataList";

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

  const periodLabel =
    period === "day" ? "24 jam" : period === "week" ? "7 hari" : "30 hari";

  return (
    <DataList
      title="Transaksi Terbaru"
      subtext={`Ringkasan transaksi ${periodLabel} terakhir`}
      actions={
        <Segmented
          value={period}
          onChange={setPeriod}
          options={[
            { label: "Hari", value: "day" },
            { label: "Minggu", value: "week" },
            { label: "Bulan", value: "month" },
          ]}
        />
      }
      rows={filtered}
      emptyMessage="Belum ada transaksi periode ini."
      columns={[
        {
          key: "note",
          label: "Transaksi",
          render: (row) => (
            <div className="flex flex-col gap-1">
              <span className="truncate font-medium text-text dark:text-slate-100">
                {row.note || row.category}
              </span>
              <span className="text-xs text-muted/80">{row.date}</span>
            </div>
          ),
        },
        {
          key: "amount",
          label: "Jumlah",
          align: "right",
          render: (row) => (
            <span
              className={clsx(
                "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                row.type === "income"
                  ? "bg-success/10 text-success"
                  : "bg-danger/10 text-danger"
              )}
            >
              {formatCurrency(row.amount)}
            </span>
          ),
        },
      ]}
    />
  );
}
