import { useMemo, useState } from "react";
import Card, { CardBody, CardHeader } from "./Card";
import { formatMoney } from "../lib/format";

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

export default function TopSpendsTable({ data = [], onSelect }) {
  const [sort, setSort] = useState("desc");

  const expenses = useMemo(
    () =>
      data
        .filter((item) => item && item.type === "expense")
        .map((item) => ({
          ...item,
          amount: Math.abs(Number(item.amount) || 0),
        })),
    [data]
  );

  const sorted = useMemo(() => {
    return [...expenses].sort((a, b) =>
      sort === "asc" ? a.amount - b.amount : b.amount - a.amount
    );
  }, [expenses, sort]);

  const items = sorted.slice(0, 5);
  const highlighted = sorted[0];
  const totalCount = sorted.length;
  const totalExpense = useMemo(
    () => expenses.reduce((sum, tx) => sum + tx.amount, 0),
    [expenses]
  );

  const toggleSort = () => setSort((s) => (s === "asc" ? "desc" : "asc"));

  return (
    <Card className="flex min-h-[360px] flex-col">
      <CardHeader
        title="Top Pengeluaran"
        subtext="Pengeluaran terbesar dalam periode ini"
        actions={
          <button
            type="button"
            onClick={toggleSort}
            className="inline-flex items-center gap-1 rounded-full border border-border-subtle px-3 py-1 text-xs font-medium text-text transition hover:border-border hover:bg-surface-alt/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
            aria-label="Urutkan pengeluaran"
          >
            Sortir {sort === "asc" ? "↑" : "↓"}
          </button>
        }
      />
      <CardBody className="flex-1 space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="inline-flex w-fit items-center rounded-xl bg-danger/10 px-3 py-1 text-xs font-semibold text-danger">
            {sort === "asc" ? "Terkecil" : "Terbesar"}
          </span>
          {highlighted ? (
            <div className="rounded-xl bg-surface-alt/70 px-3 py-2 text-xs text-muted">
              <span className="font-semibold text-text">
                {sort === "asc" ? "Nominal terkecil" : "Nominal terbesar"}
              </span>{" "}
              <span className="text-muted/90">
                <span className="hw-money">{formatMoney(highlighted.amount, "IDR")}</span> • {highlighted.note || highlighted.category || "Tanpa catatan"}
              </span>
            </div>
          ) : null}
        </div>
        {items.length > 0 ? (
          <ul className="space-y-4">
            {items.map((row, index) => {
              const contribution = totalExpense
                ? Math.min(100, Math.round((row.amount / totalExpense) * 100))
                : 0;

              return (
                <li key={row.id || `${row.note}-${row.date}-${index}`}>
                  <button
                    type="button"
                    onClick={() => onSelect?.(row)}
                    className="group w-full rounded-2xl border border-transparent bg-surface-alt/40 p-4 text-left transition hover:border-border hover:bg-surface-alt/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-[color:var(--brand-ring)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger/10 text-sm font-semibold text-danger">
                          #{index + 1}
                        </div>
                        <div className="space-y-1">
                          <p className="max-w-[16ch] truncate text-sm font-semibold text-text dark:text-slate-100">
                            {row.note || row.category || "Tanpa catatan"}
                          </p>
                          <p className="text-xs text-muted">
                            {row.category || "Lainnya"} • {formatDate(row.date)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-danger hw-money">
                          {formatMoney(row.amount, "IDR")}
                        </p>
                        <p className="text-xs text-muted/80">{contribution}% dari total</p>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border-subtle/60 p-6 text-center">
            <p className="text-sm font-medium text-text/80">Belum ada pengeluaran pada periode ini.</p>
            <p className="text-xs text-muted">Catat transaksi untuk melihat daftar pengeluaran teratas.</p>
          </div>
        )}
        {totalCount > items.length ? (
          <p className="text-xs text-muted">
            Menampilkan {items.length} dari {totalCount} pengeluaran. Ubah urutan untuk melihat nominal lainnya.
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}
