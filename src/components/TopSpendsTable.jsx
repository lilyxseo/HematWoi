import { useMemo, useState } from "react";
import Card, { CardBody, CardHeader } from "./Card";

function formatDate(date) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function EmptyState({ message }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center text-sm text-muted/90">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
        <span className="text-lg">📉</span>
      </div>
      <p className="max-w-[220px] font-medium text-text/80 dark:text-slate-100/80">
        {message}
      </p>
    </div>
  );
}

function toRupiah(n = 0) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

export default function TopSpendsTable({ data = [], onSelect }) {
  const [sort, setSort] = useState("desc");

  const sorted = useMemo(() => {
    return [...data]
      .sort((a, b) =>
        sort === "asc"
          ? Number(a.amount || 0) - Number(b.amount || 0)
          : Number(b.amount || 0) - Number(a.amount || 0)
      )
      .slice(0, 6);
  }, [data, sort]);

  const stats = useMemo(() => {
    if (!sorted.length) return null;
    const total = sorted.reduce(
      (sum, row) => sum + Number(row.amount || 0),
      0
    );
    const top = sorted[0];
    return {
      total,
      top,
      shares: sorted.map((row) => ({
        row,
        pct: total ? Number(row.amount || 0) / total : 0,
      })),
    };
  }, [sorted]);

  const toggleSort = () => setSort((s) => (s === "asc" ? "desc" : "asc"));

  return (
    <Card className="flex min-h-[360px] flex-col">
      <CardHeader
        title="Top Pengeluaran"
        subtext="Pengeluaran terbesar dalam periode ini"
        actions={
          <button
            onClick={toggleSort}
            className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1 text-xs font-medium text-text transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            aria-label="Urutkan pengeluaran"
          >
            Sortir {sort === "asc" ? "↑" : "↓"}
          </button>
        }
      />

      <CardBody className="flex flex-1 flex-col gap-6">
        {stats ? (
          <>
            <button
              type="button"
              onClick={() => onSelect?.(stats.top)}
              className="group flex w-full items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-left transition hover:border-brand/40 hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            >
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted/80">
                  Pengeluaran terbesar
                </p>
                <p className="text-base font-semibold text-text">
                  {stats.top.note || stats.top.category || "Tanpa catatan"}
                </p>
                <p className="text-xs text-muted/70">
                  {stats.top.category} • {formatDate(stats.top.date)}
                </p>
              </div>
              <div className="flex flex-col items-end">
                <span className="rounded-full bg-danger/10 px-3 py-1 text-sm font-semibold text-danger">
                  {toRupiah(stats.top.amount)}
                </span>
                <span className="mt-2 text-xs font-medium text-muted/80">
                  {stats.total
                    ? Math.round(
                        (Number(stats.top.amount || 0) / stats.total) * 100
                      )
                    : 0}
                  % dari total
                </span>
              </div>
            </button>

            <div className="space-y-4">
              {stats.shares.map(({ row, pct }) => (
                <button
                  type="button"
                  onClick={() => onSelect?.(row)}
                  key={`${row.id || row.note}-${row.date}`}
                  className="group flex w-full items-center gap-4 rounded-xl px-2 py-2 text-left transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-text">
                          {row.note || row.category || "Tanpa catatan"}
                        </p>
                        <p className="mt-1 text-xs text-muted/70">{row.category}</p>
                      </div>
                      <span className="whitespace-nowrap rounded-full bg-danger/10 px-3 py-1 text-xs font-semibold text-danger">
                        {toRupiah(row.amount)}
                      </span>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-white/5">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-danger/80 to-danger"
                        style={{ width: `${Math.max(pct * 100, 4)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-muted/60">{formatDate(row.date)}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <EmptyState message="Belum ada pengeluaran pada periode yang dipilih." />
        )}
      </CardBody>
    </Card>
  );
}

