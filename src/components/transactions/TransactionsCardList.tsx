import clsx from "clsx";
import {
  ArrowDownCircle,
  ArrowRightLeft,
  ArrowUpCircle,
  CalendarDays,
  Pencil,
  Tag,
  Trash2,
  Wallet2,
} from "lucide-react";
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

const TYPE_META: Record<
  string,
  {
    icon: typeof ArrowUpCircle;
    amountClass: string;
    badgeClass: string;
    iconWrapper: string;
  }
> = {
  income: {
    icon: ArrowUpCircle,
    amountClass: "text-emerald-400",
    badgeClass: "bg-emerald-500/10 text-emerald-200 ring-emerald-500/30",
    iconWrapper: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/40",
  },
  expense: {
    icon: ArrowDownCircle,
    amountClass: "text-rose-400",
    badgeClass: "bg-rose-500/10 text-rose-200 ring-rose-500/30",
    iconWrapper: "bg-rose-500/10 text-rose-300 ring-rose-500/40",
  },
  transfer: {
    icon: ArrowRightLeft,
    amountClass: "text-slate-200",
    badgeClass: "bg-slate-500/10 text-slate-200 ring-slate-500/30",
    iconWrapper: "bg-slate-500/10 text-slate-200 ring-slate-500/30",
  },
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
              const meta = TYPE_META[item.type] || TYPE_META.transfer;
              const TypeIcon = meta.icon;

              return (
                <article
                  key={item.id}
                  className={clsx(
                    "relative overflow-hidden rounded-3xl border border-white/5 bg-slate-900/80 p-4 shadow-lg shadow-slate-950/40 ring-1 ring-slate-800 transition hover:border-white/10",
                    selected && "ring-2 ring-[var(--accent)]/60",
                  )}
                >
                  <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-gradient-to-br from-white/10 via-white/0 to-transparent blur-2xl" />
                  <header className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span
                        className={clsx(
                          "flex h-10 w-10 items-center justify-center rounded-2xl ring-1 backdrop-blur",
                          meta.iconWrapper,
                        )}
                        aria-hidden="true"
                      >
                        <TypeIcon className="h-5 w-5" />
                      </span>
                      <div className="space-y-1">
                        <span
                          className={clsx(
                            "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ring-1",
                            meta.badgeClass,
                          )}
                        >
                          {typeLabels[item.type] || item.type}
                        </span>
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                          <CategoryDot color={item.category_color} />
                          <span>{item.category || "(Tanpa kategori)"}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <time
                        dateTime={toDateValue(item.date)}
                        className="inline-flex items-center gap-2 rounded-full bg-slate-800/60 px-3 py-1 text-xs font-medium text-slate-300 ring-1 ring-slate-700"
                      >
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                        {formattedDate}
                      </time>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(event) => onToggleSelect(item.id, event)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-900 text-[var(--accent)] shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                        aria-label="Pilih transaksi"
                      />
                    </div>
                  </header>
                  <div className="mt-4 space-y-3">
                    <p className="text-base font-semibold text-slate-100 line-clamp-2" title={description}>
                      {description}
                    </p>
                    <div className="grid gap-2 text-sm text-slate-300">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-2 rounded-full bg-slate-800/70 px-3 py-1 text-xs font-medium text-slate-200 ring-1 ring-slate-700/70">
                          <Wallet2 className="h-3.5 w-3.5" aria-hidden="true" />
                          {item.account || "—"}
                        </span>
                        {item.type === "transfer" && (
                          <span className="inline-flex items-center gap-2 rounded-full bg-slate-800/70 px-3 py-1 text-xs font-medium text-slate-200 ring-1 ring-slate-700/70">
                            <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden="true" />
                            {item.to_account || "—"}
                          </span>
                        )}
                      </div>
                      {tags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="inline-flex items-center gap-2 rounded-full bg-slate-800/70 px-3 py-1 font-medium text-slate-300 ring-1 ring-slate-700/70">
                            <Tag className="h-3.5 w-3.5" aria-hidden="true" />
                            Tags
                          </span>
                          {tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-slate-800/60 px-2 py-1 font-medium text-slate-200 ring-1 ring-slate-700/60"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <footer className="mt-5 flex items-center justify-between gap-3">
                    <span className={clsx("text-2xl font-semibold", meta.amountClass)}>
                      {formatAmount(item.amount)}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(item)}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/80 text-slate-200 ring-1 ring-slate-700 transition hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                        aria-label="Edit transaksi"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(item)}
                        disabled={deleteDisabled}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/10 text-rose-300 ring-1 ring-rose-400/40 transition hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
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
    <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-slate-900/70 p-4 ring-1 ring-slate-800/60 animate-pulse">
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
      <div className="flex items-start gap-3">
        <span className="h-10 w-10 rounded-2xl bg-slate-800/80" />
        <div className="flex-1 space-y-3">
          <div className="h-4 w-24 rounded-full bg-slate-800" />
          <div className="h-3 w-32 rounded-full bg-slate-800/80" />
        </div>
        <span className="h-4 w-20 rounded-full bg-slate-800/60" />
      </div>
      <div className="mt-5 space-y-3">
        <div className="h-4 w-full rounded-full bg-slate-800" />
        <div className="h-4 w-2/3 rounded-full bg-slate-800/70" />
        <div className="flex gap-2">
          <span className="h-6 w-20 rounded-full bg-slate-800/80" />
          <span className="h-6 w-24 rounded-full bg-slate-800/70" />
        </div>
      </div>
      <div className="mt-6 flex items-center justify-between">
        <span className="h-6 w-28 rounded-full bg-slate-800" />
        <div className="flex gap-2">
          <span className="h-10 w-10 rounded-full bg-slate-800" />
          <span className="h-10 w-10 rounded-full bg-slate-800/80" />
        </div>
      </div>
    </div>
  );
}
