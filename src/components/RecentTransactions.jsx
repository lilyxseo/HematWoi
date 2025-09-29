import { useEffect, useMemo, useState } from "react";
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
  const [pageSize, setPageSize] = useState(5);
  const [page, setPage] = useState(1);

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
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [txs, period]);

  useEffect(() => {
    setPage(1);
  }, [period, pageSize]);

  useEffect(() => {
    setPage((prev) => {
      const maxPage = Math.max(1, Math.ceil(filtered.length / pageSize));
      return Math.min(prev, maxPage);
    });
  }, [filtered.length, pageSize]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const periodLabel =
    period === "day" ? "24 jam" : period === "week" ? "7 hari" : "30 hari";
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const handlePageSizeChange = (event) => {
    setPageSize(Number(event.target.value));
  };

  const handlePrev = () => {
    if (hasPrev) setPage((prev) => Math.max(1, prev - 1));
  };

  const handleNext = () => {
    if (hasNext) setPage((prev) => Math.min(totalPages, prev + 1));
  };

  return (
    <Card className="flex min-h-[360px] flex-col">
      <CardHeader
        title="Transaksi Terbaru"
        subtext={`Ringkasan transaksi ${periodLabel} terakhir`}
        actions={
          <div className="flex items-center gap-3">
            <Segmented
              value={period}
              onChange={setPeriod}
              options={[
                { label: "Hari", value: "day" },
                { label: "Minggu", value: "week" },
                { label: "Bulan", value: "month" },
              ]}
            />
            <select
              aria-label="Jumlah transaksi per halaman"
              value={pageSize}
              onChange={handlePageSizeChange}
              className="rounded-xl border border-border-subtle bg-surface-alt px-3 py-1 text-xs font-medium text-text transition hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
            >
              {[5, 10, 20].map((size) => (
                <option key={size} value={size}>
                  {size}/halaman
                </option>
              ))}
            </select>
          </div>
        }
      />
      <CardBody className="flex-1 space-y-6">
        <div className="flex items-center gap-3 rounded-2xl bg-surface-alt/60 px-4 py-3 text-xs text-muted">
          <Clock className="h-4 w-4" aria-hidden="true" />
          <span>
            Menampilkan {paginated.length} dari {filtered.length} transaksi {periodLabel} terakhir
          </span>
        </div>
        {filtered.length > 0 ? (
          <>
            <ul className="space-y-3">
              {paginated.map((row) => {
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
            <div className="flex flex-col gap-3 rounded-2xl border border-border-subtle/60 bg-surface-alt/40 px-4 py-3 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
              <span>
                Halaman {page} dari {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={!hasPrev}
                  className="inline-flex items-center rounded-xl border border-border-subtle px-3 py-1 font-medium transition disabled:cursor-not-allowed disabled:opacity-60 hover:border-border hover:bg-surface-alt/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
                >
                  Sebelumnya
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!hasNext}
                  className="inline-flex items-center rounded-xl border border-border-subtle px-3 py-1 font-medium transition disabled:cursor-not-allowed disabled:opacity-60 hover:border-border hover:bg-surface-alt/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          </>
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
