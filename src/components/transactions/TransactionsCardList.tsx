import clsx from "clsx";
import type { ChangeEvent } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { formatCurrency } from "../../lib/format";
import CategoryDot from "./CategoryDot";
import type { TransactionRecord } from "./TransactionsTable";

const TYPE_LABELS: Record<string, string> = {
  income: "Pemasukan",
  expense: "Pengeluaran",
  transfer: "Transfer",
};

const SORT_OPTIONS = [
  { value: "date-desc", label: "Terbaru" },
  { value: "date-asc", label: "Terlama" },
  { value: "amount-desc", label: "Nominal Tertinggi" },
  { value: "amount-asc", label: "Nominal Terendah" },
];

interface TransactionsCardListProps {
  items: TransactionRecord[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string, event: ChangeEvent<HTMLInputElement>) => void;
  onDelete: (id: string) => void;
  onEdit: (item: TransactionRecord) => void;
  sort: string;
  onSortChange: (sort: string) => void;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onOpenAdd: () => void;
  onResetFilters: () => void;
  deleteDisabled?: boolean;
}

const DATE_FORMATTER =
  typeof Intl !== "undefined"
    ? new Intl.DateTimeFormat("id-ID", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;

function formatDate(value?: string | null) {
  if (!value) return "";
  try {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    return DATE_FORMATTER ? DATE_FORMATTER.format(date) : value;
  } catch {
    return "";
  }
}

function parseTags(tags?: string[] | string | null) {
  if (!tags) return [] as string[];
  if (Array.isArray(tags)) return tags;
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function getNote(item: TransactionRecord) {
  return (
    item.notes ??
    item.note ??
    item.title ??
    item.description ??
    ""
  );
}

function getAmountClass(type?: string) {
  if (type === "income") return "text-emerald-400";
  if (type === "expense") return "text-rose-400";
  return "text-slate-300";
}

export default function TransactionsCardList({
  items,
  loading,
  error,
  onRetry,
  selectedIds,
  onToggleSelect,
  onDelete,
  onEdit,
  sort,
  onSortChange,
  page,
  pageSize,
  total,
  onPageChange,
  onOpenAdd,
  onResetFilters,
  deleteDisabled = false,
}: TransactionsCardListProps) {
  const isInitialLoading = loading && items.length === 0;
  const skeletonCount = 6;
  const totalPages = total === 0 ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const displayStart = total === 0 ? 0 : (clampedPage - 1) * pageSize + (items.length > 0 ? 1 : 0);
  const displayEnd = total === 0 ? 0 : (clampedPage - 1) * pageSize + items.length;
  const showEmpty = !loading && items.length === 0 && !error;

  return (
    <section className="flex flex-col gap-4 md:hidden">
      {error && (
        <div className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-200 ring-1 ring-red-500/30">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>Gagal memuat transaksi.</span>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-100 transition hover:bg-red-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              Coba lagi
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <label className="flex-1">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Urutkan
          </span>
          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value)}
            className="h-11 w-full rounded-2xl bg-slate-900 px-3 text-sm font-medium text-slate-200 ring-2 ring-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            aria-label="Urutkan transaksi"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {showEmpty ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl bg-slate-900/80 px-6 py-16 text-center text-slate-300 ring-1 ring-slate-800">
          <p className="text-lg font-semibold text-slate-200">Belum ada transaksi</p>
          <p className="max-w-md text-sm text-slate-400">
            Coba tambahkan transaksi baru atau reset filter untuk melihat semua histori.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onOpenAdd}
              className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
            >
              Tambah Transaksi
            </button>
            <button
              type="button"
              onClick={onResetFilters}
              className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
            >
              Reset Filter
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const tags = parseTags(item.tags);
            const note = getNote(item).trim();
            const categoryName = item.category || "(Tanpa kategori)";
            const formattedDate = formatDate(item.date);
            const amountClass = getAmountClass(item.type);
            return (
              <article
                key={item.id}
                className={clsx(
                  "rounded-2xl bg-slate-900 p-3 ring-1 ring-slate-800 transition", 
                  selectedIds.has(item.id) && "ring-2 ring-[var(--accent)]"
                )}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={(event) => onToggleSelect(item.id, event)}
                    className="mt-1 h-5 w-5 rounded border-slate-700 bg-slate-900 text-[var(--accent)] focus:ring-[var(--accent)]"
                    aria-label="Pilih transaksi"
                  />
                  <div className="min-w-0 flex-1 space-y-3">
                    <header className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CategoryDot color={item.category_color} />
                        <p className="text-sm font-semibold text-slate-200" title={categoryName}>
                          {categoryName}
                        </p>
                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          {TYPE_LABELS[item.type ?? ""] ?? item.type ?? ""}
                        </span>
                      </div>
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        {formattedDate || ""}
                      </span>
                    </header>
                    <p className="line-clamp-2 text-sm text-slate-400" title={note}>
                      {note || "Tidak ada catatan"}
                    </p>
                    <div className="text-sm text-slate-300">
                      {item.type === "transfer" ? (
                        <span className="inline-flex flex-wrap items-center gap-1">
                          <span className="truncate">{item.account || "—"}</span>
                          <span aria-hidden="true" className="text-slate-500">
                            ➜
                          </span>
                          <span className="truncate">{item.to_account || "—"}</span>
                        </span>
                      ) : (
                        <span className="truncate">{item.account || "—"}</span>
                      )}
                    </div>
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center rounded-full bg-slate-800/80 px-3 py-1 text-xs font-medium text-slate-200"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <footer className="flex items-center justify-between gap-3 pt-1">
                      <span className={clsx("font-mono text-lg font-semibold", amountClass)}>
                        {formatCurrency(Number(item.amount ?? 0), "IDR")}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onEdit(item)}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-slate-300 ring-1 ring-slate-700 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                          aria-label="Edit transaksi"
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(item.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-rose-300 ring-1 ring-rose-500/40 transition hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label="Hapus transaksi"
                          disabled={deleteDisabled}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </footer>
                  </div>
                </div>
              </article>
            );
          })}

          {isInitialLoading &&
            Array.from({ length: skeletonCount }).map((_, index) => (
              <article
                key={`skeleton-${index}`}
                className="rounded-2xl bg-slate-900 p-3 ring-1 ring-slate-800"
              >
                <div className="flex items-start gap-3">
                  <div className="h-5 w-5 rounded bg-slate-800" />
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-slate-800" />
                        <div className="h-4 w-28 rounded-full bg-slate-800" />
                      </div>
                      <div className="h-3 w-20 rounded-full bg-slate-800" />
                    </div>
                    <div className="h-4 w-full rounded-full bg-slate-800" />
                    <div className="h-4 w-32 rounded-full bg-slate-800" />
                    <div className="flex gap-2">
                      <div className="h-5 w-16 rounded-full bg-slate-800" />
                      <div className="h-5 w-12 rounded-full bg-slate-800" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="h-6 w-24 rounded-full bg-slate-800" />
                      <div className="flex gap-2">
                        <div className="h-9 w-9 rounded-full bg-slate-800" />
                        <div className="h-9 w-9 rounded-full bg-slate-800" />
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-900/80 px-4 py-3 text-sm text-slate-300 ring-1 ring-slate-800">
        <div>
          {total > 0 ? (
            <span>
              Menampilkan {displayStart.toLocaleString("id-ID")}-{displayEnd.toLocaleString("id-ID")} dari {total.toLocaleString("id-ID")} ({pageSize} per halaman)
            </span>
          ) : (
            <span>Tidak ada transaksi</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, clampedPage - 1))}
            disabled={clampedPage <= 1}
            className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-300 ring-1 ring-slate-700 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Halaman sebelumnya"
          >
            Prev
          </button>
          <span className="text-xs font-semibold text-slate-400">
            Halaman {clampedPage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, clampedPage + 1))}
            disabled={clampedPage >= totalPages}
            className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-300 ring-1 ring-slate-700 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Halaman berikutnya"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
