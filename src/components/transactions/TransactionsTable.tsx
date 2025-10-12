import clsx from "clsx";
import { Pencil, Trash2 } from "lucide-react";
import { ChangeEvent, ReactNode } from "react";
import CategoryDot from "./CategoryDot";

interface TransactionRowData {
  id: string;
  type: string;
  category?: string | null;
  category_color?: string | null;
  amount: number;
  date?: string;
  account?: string | null;
  to_account?: string | null;
  notes?: string | null;
  note?: string | null;
  title?: string | null;
  description?: string | null;
  tags?: string[] | string | null;
}

interface TransactionsTableProps {
  items: TransactionRowData[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string, event?: ChangeEvent<HTMLInputElement>) => void;
  onToggleSelectAll: () => void;
  allSelected: boolean;
  onEdit: (item: TransactionRowData) => void;
  onDelete: (id: string) => void;
  formatAmount: (value: number) => string;
  formatDate: (value?: string | null) => string;
  toDateValue: (value?: string | null) => string;
  typeLabels: Record<string, string>;
  sort: string;
  onSortChange: (next: string) => void;
  tableStickyTop?: string;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  deleteDisabled?: boolean;
  emptyState: ReactNode;
}

const AMOUNT_CLASS: Record<string, string> = {
  income: "text-emerald-400",
  expense: "text-rose-400",
  transfer: "text-slate-300",
};

export default function TransactionsTable({
  items,
  loading,
  error,
  onRetry,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  allSelected,
  onEdit,
  onDelete,
  formatAmount,
  formatDate,
  toDateValue,
  typeLabels,
  sort,
  onSortChange,
  tableStickyTop,
  page,
  pageSize,
  total,
  onPageChange,
  deleteDisabled = false,
  emptyState,
}: TransactionsTableProps) {
  const isInitialLoading = loading && items.length === 0;

  const displayStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const displayEnd = total === 0 ? 0 : Math.min((page - 1) * pageSize + items.length, total);
  const hasNext = page * pageSize < total;
  const hasPrev = page > 1;

  const handleDateSort = () => {
    const next = sort === "date-desc" ? "date-asc" : "date-desc";
    onSortChange(next);
  };

  const handleAmountSort = () => {
    const next = sort === "amount-desc" ? "amount-asc" : "amount-desc";
    onSortChange(next);
  };

  if (error && !items.length) {
    return (
      <div className="rounded-3xl bg-red-500/10 p-4 text-red-200 ring-1 ring-red-500/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium">Gagal memuat transaksi. Coba lagi?</p>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-10 items-center justify-center rounded-2xl bg-red-500/20 px-4 text-sm font-semibold text-red-100 transition hover:bg-red-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
          >
            Muat ulang
          </button>
        </div>
      </div>
    );
  }

  if (!loading && items.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <div className="hidden md:block">
      {error && (
        <div className="mb-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-200 ring-1 ring-red-500/30">
          Terjadi kesalahan memuat data. <button type="button" onClick={onRetry} className="font-semibold underline-offset-4 hover:underline">Coba lagi</button>
        </div>
      )}
      <div className="overflow-hidden rounded-3xl bg-slate-950/50 ring-1 ring-slate-800">
        <div className="max-h-[min(70vh,640px)] overflow-y-auto">
          <table className="min-w-full divide-y divide-slate-800">
            <thead
              className="sticky top-0 z-10 bg-slate-900"
              style={tableStickyTop ? { top: tableStickyTop } : undefined}
            >
              <tr>
                <th scope="col" className="w-12 px-4 py-3 text-left text-xs uppercase tracking-wide text-slate-400">
                  <div className="flex justify-center">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={onToggleSelectAll}
                      aria-label="Pilih semua transaksi"
                      className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    />
                  </div>
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs uppercase tracking-wide text-slate-400">
                  Kategori &amp; Judul
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs uppercase tracking-wide text-slate-400">
                  <button
                    type="button"
                    onClick={handleDateSort}
                    className="inline-flex items-center gap-2 font-semibold text-slate-300 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  >
                    Tanggal
                    <SortIndicator active={sort.startsWith("date")} direction={sort === "date-asc" ? "asc" : "desc"} />
                  </button>
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs uppercase tracking-wide text-slate-400">
                  Akun
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs uppercase tracking-wide text-slate-400">
                  <button
                    type="button"
                    onClick={handleAmountSort}
                    className="inline-flex items-center gap-2 font-semibold text-slate-300 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  >
                    Jumlah
                    <SortIndicator active={sort.startsWith("amount")} direction={sort === "amount-asc" ? "asc" : "desc"} />
                  </button>
                </th>
                <th scope="col" className="w-24 px-4 py-3 text-right text-xs uppercase tracking-wide text-slate-400">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {isInitialLoading
                ? Array.from({ length: 6 }).map((_, index) => <SkeletonRow key={index} />)
                : items.map((item) => {
                    const selected = selectedIds.has(item.id);
                    const note = item.title || item.description || item.notes || item.note || "";
                    const description = note.trim() || "(Tanpa judul)";
                    const formattedDate = formatDate(item.date);
                    const amountTone = AMOUNT_CLASS[item.type] || AMOUNT_CLASS.transfer;

                    return (
                      <tr
                        key={item.id}
                        className={clsx(
                          "transition-colors hover:bg-slate-900/40",
                          selected && "bg-[var(--accent)]/5",
                        )}
                      >
                        <td className="px-4 py-4 align-middle">
                          <div className="flex justify-center">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={(event) => onToggleSelect(item.id, event)}
                              className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                              aria-label="Pilih transaksi"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-4 align-middle">
                          <div className="flex items-start gap-3">
                            <CategoryDot color={item.category_color} className="mt-1" />
                            <div className="min-w-0 space-y-1">
                              <p className="truncate text-sm font-semibold text-slate-200" title={item.category || "(Tanpa kategori)"}>
                                {item.category || "(Tanpa kategori)"}
                              </p>
                              <p className="truncate text-xs uppercase tracking-wide text-slate-400">
                                {typeLabels[item.type] || item.type}
                              </p>
                              <p className="truncate text-sm text-slate-400" title={description}>
                                {description}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-middle text-sm text-slate-300">
                          <time dateTime={toDateValue(item.date)}>{formattedDate}</time>
                        </td>
                        <td className="px-4 py-4 align-middle text-sm text-slate-200">
                          {item.type === "transfer" ? (
                            <span className="flex items-center gap-1">
                              <span className="truncate">{item.account || "—"}</span>
                              <span aria-hidden="true" className="text-slate-500">
                                →
                              </span>
                              <span className="truncate">{item.to_account || "—"}</span>
                            </span>
                          ) : (
                            <span className="truncate">{item.account || "—"}</span>
                          )}
                        </td>
                        <td className="px-4 py-4 align-middle">
                          <span className={clsx("font-mono text-sm font-semibold", amountTone, "block text-right")}>{formatAmount(item.amount)}</span>
                        </td>
                        <td className="px-4 py-4 align-middle">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => onEdit(item)}
                              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-slate-300 ring-1 ring-slate-700 transition hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                              aria-label="Edit transaksi"
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete(item.id)}
                              disabled={deleteDisabled}
                              className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500/10 text-rose-300 ring-1 ring-rose-400/40 transition hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
                              aria-label="Hapus transaksi"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 px-4 py-3 text-sm text-slate-400">
          <span>
            Menampilkan {displayStart}&ndash;{displayEnd} dari {total} transaksi
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={!hasPrev || loading}
              className="inline-flex h-9 items-center justify-center rounded-2xl bg-slate-900/60 px-4 text-sm font-medium text-slate-200 ring-1 ring-slate-800 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Sebelumnya
            </button>
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={!hasNext || loading}
              className="inline-flex h-9 items-center justify-center rounded-2xl bg-slate-900/60 px-4 text-sm font-medium text-slate-200 ring-1 ring-slate-800 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-4">
        <div className="mx-auto h-4 w-4 rounded bg-slate-800" />
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 rounded-full bg-slate-800" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 rounded-full bg-slate-800" />
            <div className="h-3 w-48 rounded-full bg-slate-800/70" />
          </div>
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="h-3 w-24 rounded-full bg-slate-800" />
      </td>
      <td className="px-4 py-4">
        <div className="h-3 w-24 rounded-full bg-slate-800" />
      </td>
      <td className="px-4 py-4">
        <div className="ml-auto h-3 w-20 rounded-full bg-slate-800" />
      </td>
      <td className="px-4 py-4">
        <div className="ml-auto flex w-20 justify-end gap-2">
          <span className="h-9 w-9 rounded-full bg-slate-800" />
          <span className="h-9 w-9 rounded-full bg-slate-800/80" />
        </div>
      </td>
    </tr>
  );
}

function SortIndicator({ active, direction }: { active: boolean; direction: "asc" | "desc" }) {
  if (!active) {
    return <span aria-hidden="true" className="text-slate-600">⇅</span>;
  }
  return (
    <span aria-hidden="true" className="text-[var(--accent)]">
      {direction === "asc" ? "▲" : "▼"}
    </span>
  );
}
