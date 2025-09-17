import { useMemo, useState } from "react";
import clsx from "clsx";
import DataList from "./dashboard/DataList";

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
    return [...data].sort((a, b) =>
      sort === "asc" ? a.amount - b.amount : b.amount - a.amount
    );
  }, [data, sort]);

  const toggleSort = () => setSort((s) => (s === "asc" ? "desc" : "asc"));

  return (
    <DataList
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
      rows={sorted}
      onRowClick={onSelect}
      columns={[
        {
          key: "note",
          label: "Catatan",
          render: (row) => (
            <div className="flex flex-col gap-1">
              <span className="truncate font-medium text-text dark:text-slate-100">
                {row.note || row.category || "-"}
              </span>
              <span className="text-xs text-muted/80">{row.category}</span>
            </div>
          ),
        },
        {
          key: "date",
          label: "Tanggal",
          render: (row) => (
            <span className="whitespace-nowrap text-sm text-muted/80">
              {row.date}
            </span>
          ),
        },
        {
          key: "amount",
          label: "Jumlah",
          align: "right",
          className: (row) =>
            clsx(
              "text-right",
              row.amount < 0
                ? "text-danger"
                : "text-success"
            ),
          render: (row) => (
            <span
              className={clsx(
                "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                row.amount < 0
                  ? "bg-danger/10 text-danger"
                  : "bg-success/10 text-success"
              )}
            >
              {toRupiah(row.amount)}
            </span>
          ),
        },
      ]}
    />
  );
}

