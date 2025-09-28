import { useMemo, useState } from "react";
import clsx from "clsx";
import Segmented from "./ui/Segmented";
import Card, { CardBody, CardHeader } from "./Card";

function EmptyState({ message }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center text-sm text-muted/90">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
        <span className="text-lg">🧾</span>
      </div>
      <p className="max-w-[220px] font-medium text-text/80 dark:text-slate-100/80">
        {message}
      </p>
    </div>
  );
}

function formatCurrency(n = 0) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

function formatDate(date) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
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
    <Card className="flex min-h-[360px] flex-col">
      <CardHeader
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
      />

      <CardBody className="flex flex-1 flex-col gap-6">
        {filtered.length ? (
          <ul className="flex flex-1 flex-col gap-4">
            {filtered.map((row) => (
              <li
                key={`${row.id || row.note}-${row.date}-${row.amount}`}
                className="group flex items-start gap-3 rounded-xl px-2 py-2 transition hover:bg-white/5"
              >
                <div
                  className={clsx(
                    "mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold",
                    row.type === "income"
                      ? "border-success/50 bg-success/10 text-success"
                      : "border-danger/50 bg-danger/10 text-danger"
                  )}
                >
                  {row.category?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-text">
                        {row.note || row.category || "Transaksi"}
                      </p>
                      <p className="text-xs text-muted/80">
                        {formatDate(row.date)} • {row.category || "Tanpa kategori"}
                      </p>
                    </div>
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
                  </div>
                  {row.merchant && (
                    <p className="mt-2 text-xs text-muted/70">
                      {row.merchant}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState message="Belum ada transaksi periode ini." />
        )}
      </CardBody>
    </Card>
  );
}
