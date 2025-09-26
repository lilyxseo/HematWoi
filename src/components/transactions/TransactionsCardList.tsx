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

interface TransactionsCardListProps {
  items: TransactionRowData[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string, event?: ChangeEvent<HTMLInputElement>) => void;
  onEdit: (item: TransactionRowData) => void;
  onDelete: (item: TransactionRowData) => void;
  formatAmount: (value: number) => string;
  formatDate: (value?: string | null) => string;
  toDateValue: (value?: string | null) => string;
  parseTags: (value: TransactionRowData["tags"]) => string[];
  typeLabels: Record<string, string>;
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

export default function TransactionsCardList({
  items,
  loading,
  error,
  onRetry,
  selectedIds,
  onToggleSelect,
  onEdit,
  onDelete,
  formatAmount,
  formatDate,
  toDateValue,
  parseTags,
  typeLabels,
  page,
  pageSize,
  total,
  onPageChange,
  deleteDisabled = false,
  emptyState,
}: TransactionsCardListProps) {
  const isInitialLoading = loading && items.length === 0;
  const displayStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const displayEnd = total === 0 ? 0 : Math.min((page - 1) * pageSize + items.length, total);
  const hasNext = page * pageSize < total;
  const hasPrev = page > 1;

  if (error && !items.length) {
    return (
      <div className="rounded-3xl bg-red-500/10 p-4 text-red-200 ring-1 ring-red-500/30">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">Gagal memuat transaksi. Coba lagi?</p>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-red-500/20 px-4 text-sm font-semibold text-red-100 transition hover:bg-red-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
          >
            Muat ulang
          </button>
        </div>
      </div>
    );
  }

  if (!loading && items.length === 0) {
    return <div className="md:hidden">{emptyState}</div>;
  }

  return (
    <div className="space-y-4 md:hidden">
      {error && (
        <div className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-200 ring-1 ring-red-500/30">
          Gagal memuat transaksi. <button type="button" onClick={onRetry} className="font-semibold underline-offset-4 hover:underline">Coba lagi</button>
        </div>
      )}
      <div className="space-y-2">
        {isInitialLoading
          ? Array.from({ length: 6 }).map((_, index) => <SkeletonCard key={index} />)
          : items.map((item) => {
              const selected = selectedIds.has(item.id);
              const tags = parseTags(item.tags);
              const note = item.title || item.description || item.notes || item.note || "";
              const description = note.trim() || "(Tanpa judul)";
              const formattedDate = formatDate(item.date);
              const amountTone = AMOUNT_CLASS[item.type] || AMOUNT_CLASS.transfer;

              return (
                <article
                  key={item.id}
                  className={clsx(
                    "rounded-2xl bg-slate-900 ring-1 ring-slate-800 p-3",
                    selected && "ring-[var(--accent)]/60",
                  )}
                >
                  <header className="flex items-start gap-3">
                    <div className="pt-1">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(event) => onToggleSelect(item.id, event)}
                        className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                        aria-label="Pilih transaksi"
                      />
                    </div>
                    <div className="flex flex-1 items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CategoryDot color={item.category_color} />
                          <p className="text-sm font-semibold text-slate-200">{item.category || "(Tanpa kategori)"}</p>
                        </div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">{typeLabels[item.type] || item.type}</p>
                      </div>
                      <time dateTime={toDateValue(item.date)} className="text-xs text-slate-400">
                        {formattedDate}
                      </time>
                    </div>
                  </header>
                  <div className="mt-3 space-y-2">
                    <p className="text-sm font-medium text-slate-200 line-clamp-2" title={description}>
                      {description}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="rounded-full bg-slate-800/80 px-2 py-1">{item.account || "—"}</span>
                      {item.type === "transfer" && (
                        <span className="rounded-full bg-slate-800/80 px-2 py-1">→ {item.to_account || "—"}</span>
                      )}
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-slate-800/80 px-2 py-1 text-slate-300"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <footer className="mt-4 flex items-center justify-between gap-3">
                    <span className={clsx("text-lg font-semibold", amountTone)}>{formatAmount(item.amount)}</span>
                    <div className="flex items-center gap-2">
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
                        onClick={() => onDelete(item)}
                        disabled={deleteDisabled}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500/10 text-rose-300 ring-1 ring-rose-400/40 transition hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label="Hapus transaksi"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </footer>
                </article>
              );
            })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-900/60 px-4 py-3 text-sm text-slate-400 ring-1 ring-slate-800">
        <span>
          Menampilkan {displayStart}&ndash;{displayEnd} dari {total} transaksi
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={!hasPrev || loading}
            className="inline-flex h-9 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-medium text-slate-200 ring-1 ring-slate-800 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Sebelumnya
          </button>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={!hasNext || loading}
            className="inline-flex h-9 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-medium text-slate-200 ring-1 ring-slate-800 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Selanjutnya
          </button>
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="space-y-3 rounded-2xl bg-slate-900/80 p-3 ring-1 ring-slate-800 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-4 w-4 rounded bg-slate-800" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-32 rounded-full bg-slate-800" />
          <div className="h-3 w-24 rounded-full bg-slate-800/70" />
        </div>
      </div>
      <div className="h-3 w-full rounded-full bg-slate-800" />
      <div className="flex gap-2">
        <span className="h-5 w-16 rounded-full bg-slate-800" />
        <span className="h-5 w-16 rounded-full bg-slate-800/80" />
      </div>
      <div className="flex items-center justify-between">
        <span className="h-4 w-24 rounded-full bg-slate-800" />
        <div className="flex gap-2">
          <span className="h-9 w-9 rounded-full bg-slate-800" />
          <span className="h-9 w-9 rounded-full bg-slate-800/80" />
        </div>
      </div>
    </div>
  );
}
