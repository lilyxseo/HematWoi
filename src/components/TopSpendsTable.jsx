import { useMemo, useState } from "react";
import { ArrowDownRight } from "lucide-react";
import Card, { CardBody, CardHeader } from "./Card";
import { formatCurrency } from "../lib/format";

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatDate(value) {
  if (!value) return "-";
  try {
    return dateFormatter.format(new Date(value));
  } catch {
    return value;
  }
}

export default function TopSpendsTable({ data = [], onSelect }) {
  const [sort, setSort] = useState("desc");

  const expenses = useMemo(
    () =>
      (data ?? [])
        .filter((item) => item?.type !== "income")
        .map((item) => ({
          original: item,
          amountValue: Math.abs(Number(item?.amount ?? 0)),
        })),
    [data]
  );

  const sorted = useMemo(() => {
    return [...expenses]
      .sort((a, b) =>
        sort === "asc" ? a.amountValue - b.amountValue : b.amountValue - a.amountValue
      )
      .slice(0, 6);
  }, [expenses, sort]);

  const totalExpense = useMemo(
    () => expenses.reduce((sum, item) => sum + item.amountValue, 0),
    [expenses]
  );

  const maxAmount = useMemo(
    () => sorted.reduce((max, item) => Math.max(max, item.amountValue), 0),
    [sorted]
  );

  const toggleSort = () => setSort((prev) => (prev === "asc" ? "desc" : "asc"));

  return (
    <Card className="flex min-h-[360px] flex-col">
      <CardHeader
        title="Top Pengeluaran"
        subtext="Pengeluaran terbesar dalam periode ini"
        actions={
          <button
            type="button"
            onClick={toggleSort}
            className="inline-flex items-center gap-1 rounded-full border border-border-subtle px-3 py-1 text-xs font-medium text-text transition hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
            aria-label="Urutkan pengeluaran"
          >
            Sortir {sort === "asc" ? "↑" : "↓"}
          </button>
        }
      />

      <CardBody className="flex flex-1 flex-col gap-4">
        <div className="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-danger">
          <p className="text-xs font-semibold uppercase tracking-wide text-danger/80">
            Total pengeluaran teratas
          </p>
          <p className="text-xl font-semibold text-danger">{formatCurrency(totalExpense)}</p>
          <p className="text-xs text-danger/80">
            Rata-rata transaksi: {formatCurrency(sorted.length ? totalExpense / sorted.length : 0)}
          </p>
        </div>

        <div className="flex-1 space-y-3">
          {sorted.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-border-subtle/70 bg-surface-alt/60 px-4 py-10 text-center text-sm text-muted">
              <ArrowDownRight className="mb-3 h-5 w-5 text-muted" />
              Belum ada pengeluaran pada periode ini.
            </div>
          ) : (
            <ul className="space-y-3">
              {sorted.map(({ original, amountValue }, index) => {
                const share = totalExpense ? (amountValue / totalExpense) * 100 : 0;
                const progress = maxAmount
                  ? Math.max((amountValue / maxAmount) * 100, 8)
                  : 0;

                return (
                  <li key={original?.id ?? `${original?.note}-${index}`}>
                    <button
                      type="button"
                      onClick={() => onSelect?.(original)}
                      className="group flex w-full items-start gap-4 rounded-2xl border border-transparent bg-surface-alt/40 p-3 text-left transition hover:border-border-subtle hover:bg-surface-alt"
                    >
                      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-2xl bg-danger/10 text-sm font-semibold text-danger">
                        #{index + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-text">
                              {original?.note || original?.category || "Tanpa catatan"}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-muted">
                              <span className="truncate font-medium text-muted">
                                {original?.category || "Lainnya"}
                              </span>
                              <span className="h-1 w-1 rounded-full bg-border-subtle" aria-hidden="true" />
                              <span>{formatDate(original?.date)}</span>
                            </div>
                          </div>

                          <div className="text-right">
                            <p className="text-sm font-semibold text-danger">
                              {formatCurrency(amountValue)}
                            </p>
                            <p className="text-[11px] font-medium text-danger/80">
                              {share.toFixed(0)}% dari total
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-border-subtle/70">
                          <div
                            className="h-full rounded-full bg-danger"
                            style={{ width: `${progress}%` }}
                            aria-hidden="true"
                          />
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardBody>
    </Card>
  );
}


