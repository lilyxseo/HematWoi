import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Clock } from "lucide-react";
import clsx from "clsx";
import Segmented from "./ui/Segmented";
import Card, { CardBody, CardHeader } from "./Card";

function formatCurrency(n = 0) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
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
      <CardBody className="flex-1 space-y-6">
        <div className="flex items-center gap-3 rounded-2xl bg-surface-alt/60 px-4 py-3 text-xs text-muted">
          <Clock className="h-4 w-4" aria-hidden="true" />
          <span>
            Menampilkan {filtered.length} transaksi {periodLabel} terakhir
          </span>
        </div>
        {filtered.length > 0 ? (
          <ul className="space-y-3">
            {filtered.map((row) => {
              const isIncome = row.type === "income";
              const amount = Math.abs(Number(row.amount) || 0);

              return (
                <li key={row.id || `${row.note}-${row.date}-${row.amount}`}>
                  <div className="group flex items-start justify-between gap-4 rounded-2xl border border-transparent bg-surface-alt/40 p-4 transition hover:border-border hover:bg-surface-alt/70">
                    <div className="flex items-start gap-3">
                      <div
                        className={clsx(
                          "mt-1 flex h-9 w-9 items-center justify-center rounded-xl",
                          isIncome ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                        )}
                        aria-hidden="true"
                      >
                        {isIncome ? (
                          <ArrowDownLeft className="h-4 w-4" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-text dark:text-slate-100">
                          {row.note || row.category || "Transaksi"}
                        </p>
                        <p className="text-xs text-muted">{row.category || "Lainnya"}</p>
                        <p className="text-xs text-muted/80">{formatDate(row.date)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={clsx(
                          "text-sm font-semibold",
                          isIncome ? "text-success" : "text-danger"
                        )}
                      >
                        {formatCurrency(amount)}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border-subtle/60 p-6 text-center">
            <p className="text-sm font-medium text-text/80">Belum ada transaksi pada periode ini.</p>
            <p className="text-xs text-muted">Coba pilih rentang waktu yang berbeda untuk melihat transaksi lainnya.</p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
