import clsx from "clsx";
import type { ChangeEvent } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { formatCurrency } from "../../lib/format";
import CategoryDot from "./CategoryDot";

const TYPE_LABELS: Record<string, string> = {
  income: "Pemasukan",
  expense: "Pengeluaran",
  transfer: "Transfer",
};

export interface TransactionRecord {
  id: string;
  type?: string;
  date?: string;
  amount?: number | string;
  category?: string | null;
  category_color?: string | null;
  account?: string | null;
  to_account?: string | null;
  tags?: string[] | string | null;
  note?: string | null;
  notes?: string | null;
  title?: string | null;
  description?: string | null;
}

interface TransactionsTableProps {
  items: TransactionRecord[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  onToggleSelect: (id: string, event: ChangeEvent<HTMLInputElement>) => void;
  onToggleSelectAll: () => void;
  allSelected: boolean;
  selectedIds: Set<string>;
  onDelete: (id: string) => void;
  onEdit: (item: TransactionRecord) => void;
  sort: string;
  onSortChange: (sort: string) => void;
  stickyOffset?: string;
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
  if (!value) return "—";
  try {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "—";
    return DATE_FORMATTER ? DATE_FORMATTER.format(date) : date.toISOString().slice(0, 10);
  } catch {
    return "—";
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

function computeSort(column: "date" | "amount", currentSort: string) {
  if (column === "date") {
    return currentSort === "date-desc" ? "date-asc" : "date-desc";
  }
  if (column === "amount") {
    return currentSort === "amount-desc" ? "amount-asc" : "amount-desc";
  }
  return currentSort;
}

function SortButton({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex w-full items-center gap-1 text-left text-xs uppercase tracking-wide transition",
        active ? "text-slate-200" : "text-slate-400 hover:text-slate-200",
      )}
    >
      <span>{label}</span>
      <span aria-hidden="true" className="text-[10px] leading-none">
        {active ? (direction === "asc" ? "▲" : "▼") : ""}
      </span>
    </button>
  );
}

export default function TransactionsTable({
  items,
  loading,
  error,
  onRetry,
  onToggleSelect,
  onToggleSelectAll,
  allSelected,
  selectedIds,
  onDelete,
  onEdit,
  sort,
  onSortChange,
  stickyOffset,
  page,
  pageSize,
  total,
  onPageChange,
  onOpenAdd,
  onResetFilters,
  deleteDisabled = false,
}: TransactionsTableProps) {
  const isInitialLoading = loading && items.length === 0;
  const skeletonCount = 6;
  const totalPages = total === 0 ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const displayStart = total === 0 ? 0 : (clampedPage - 1) * pageSize + (items.length > 0 ? 1 : 0);
  const displayEnd = total === 0 ? 0 : (clampedPage - 1) * pageSize + items.length;

  const showEmpty = !loading && items.length === 0 && !error;

  return (
    <section className="hidden flex-col gap-4 md:flex">
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

      <div className="overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-slate-800">
        {showEmpty ? (
          <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center text-slate-300">
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
          <div className="overflow-x-auto">
            <table className="hidden min-w-full table-fixed text-sm md:table" aria-label="Daftar transaksi">
              <thead
                className="sticky top-0 z-10 bg-slate-900 text-xs uppercase tracking-wide text-slate-400 backdrop-blur"
                style={stickyOffset ? { top: stickyOffset } : undefined}
              >
                <tr>
                  <th scope="col" className="w-14 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={onToggleSelectAll}
                      className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-[var(--accent)] focus:ring-[var(--accent)]"
                      aria-label="Pilih semua transaksi"
                    />
                  </th>
                  <th scope="col" className="min-w-[240px] px-4 py-3 text-left">
                    <span className="text-xs uppercase tracking-wide text-slate-400">Kategori &amp; Catatan</span>
                  </th>
                  <th
                    scope="col"
                    className="min-w-[160px] px-4 py-3"
                    aria-sort={sort === "date-asc" ? "ascending" : sort === "date-desc" ? "descending" : undefined}
                  >
                    <SortButton
                      label="Tanggal"
                      active={sort === "date-desc" || sort === "date-asc"}
                      direction={sort === "date-asc" ? "asc" : "desc"}
                      onClick={() => onSortChange(computeSort("date", sort))}
                    />
                  </th>
                  <th scope="col" className="min-w-[180px] px-4 py-3 text-left">
                    <span className="text-xs uppercase tracking-wide text-slate-400">Akun</span>
                  </th>
                  <th scope="col" className="min-w-[200px] px-4 py-3 text-left">
                    <span className="text-xs uppercase tracking-wide text-slate-400">Tags</span>
                  </th>
                  <th
                    scope="col"
                    className="min-w-[140px] px-4 py-3 text-right"
                    aria-sort={sort === "amount-asc" ? "ascending" : sort === "amount-desc" ? "descending" : undefined}
                  >
                    <SortButton
                      label="Jumlah"
                      active={sort === "amount-desc" || sort === "amount-asc"}
                      direction={sort === "amount-asc" ? "asc" : "desc"}
                      onClick={() => onSortChange(computeSort("amount", sort))}
                    />
                  </th>
                  <th scope="col" className="w-[96px] px-4 py-3 text-right">
                    <span className="text-xs uppercase tracking-wide text-slate-400">Aksi</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {items.map((item) => {
                  const tags = parseTags(item.tags);
                  const note = getNote(item).trim();
                  const categoryName = item.category || "(Tanpa kategori)";
                  const formattedDate = formatDate(item.date);
                  const dateValue = item.date ? new Date(item.date).toISOString() : undefined;
                  return (
                    <tr
                      key={item.id}
                      className={clsx(
                        "transition-colors",
                        selectedIds.has(item.id)
                          ? "bg-slate-800/80"
                          : "hover:bg-slate-800/50",
                      )}
                    >
                      <td className="px-4 py-3 align-middle">
                        <div className="flex justify-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item.id)}
                            onChange={(event) => onToggleSelect(item.id, event)}
                            className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-[var(--accent)] focus:ring-[var(--accent)]"
                            aria-label="Pilih transaksi"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex gap-3">
                          <CategoryDot color={item.category_color} className="mt-1" />
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-slate-200" title={categoryName}>
                                {categoryName}
                              </p>
                              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                {TYPE_LABELS[item.type ?? ""] ?? item.type ?? ""}
                              </span>
                            </div>
                            <p className="line-clamp-2 text-sm text-slate-400" title={note}>
                              {note || "Tidak ada catatan"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle text-sm text-slate-300">
                        {formattedDate !== "—" ? (
                          <time dateTime={dateValue}>{formattedDate}</time>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle text-sm text-slate-300">
                        {item.type === "transfer" ? (
                          <span className="inline-flex flex-wrap items-center gap-1 text-slate-200">
                            <span className="truncate">{item.account || "—"}</span>
                            <span aria-hidden="true" className="text-slate-500">
                              ➜
                            </span>
                            <span className="truncate">{item.to_account || "—"}</span>
                          </span>
                        ) : (
                          <span className="truncate text-slate-200">{item.account || "—"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        {tags.length > 0 ? (
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
                        ) : (
                          <span className="text-sm text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle text-right">
                        <span className={clsx("font-mono text-sm font-semibold", getAmountClass(item.type))}>
                          {formatCurrency(Number(item.amount ?? 0), "IDR")}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex justify-end gap-2">
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
                      </td>
                    </tr>
                  );
                })}
                {isInitialLoading &&
                  Array.from({ length: skeletonCount }).map((_, index) => (
                    <tr key={`skeleton-${index}`} className="animate-pulse">
                      <td className="px-4 py-3">
                        <div className="h-4 w-4 rounded bg-slate-800" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-3">
                          <div className="h-2.5 w-2.5 rounded-full bg-slate-800" />
                          <div className="flex-1 space-y-2">
                            <div className="h-4 w-40 rounded-full bg-slate-800" />
                            <div className="h-4 w-56 rounded-full bg-slate-800" />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-4 w-24 rounded-full bg-slate-800" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-4 w-28 rounded-full bg-slate-800" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <div className="h-5 w-16 rounded-full bg-slate-800" />
                          <div className="h-5 w-12 rounded-full bg-slate-800" />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="ml-auto h-4 w-20 rounded-full bg-slate-800" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="ml-auto flex gap-2">
                          <div className="h-9 w-9 rounded-full bg-slate-800" />
                          <div className="h-9 w-9 rounded-full bg-slate-800" />
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-900/70 px-4 py-3 text-sm text-slate-300 ring-1 ring-slate-800">
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
