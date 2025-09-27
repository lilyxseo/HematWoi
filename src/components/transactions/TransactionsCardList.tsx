import clsx from "clsx";
import {
  ArrowRightLeft,
  CalendarDays,
  Pencil,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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

type TypeMeta = {
  icon: LucideIcon;
  amountClass: string;
  chipClass: string;
  haloClass: string;
  iconClass: string;
};

const TYPE_META: Record<string, TypeMeta> = {
  income: {
    icon: TrendingUp,
    amountClass: "text-emerald-300",
    chipClass: "bg-emerald-500/10 text-emerald-200",
    haloClass: "from-emerald-500/10 via-emerald-500/0 to-transparent",
    iconClass: "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/40",
  },
  expense: {
    icon: TrendingDown,
    amountClass: "text-rose-300",
    chipClass: "bg-rose-500/10 text-rose-200",
    haloClass: "from-rose-500/10 via-rose-500/0 to-transparent",
    iconClass: "bg-rose-500/10 text-rose-200 ring-1 ring-rose-500/40",
  },
  transfer: {
    icon: ArrowRightLeft,
    amountClass: "text-sky-300",
    chipClass: "bg-sky-500/10 text-sky-200",
    haloClass: "from-sky-500/10 via-sky-500/0 to-transparent",
    iconClass: "bg-sky-500/10 text-sky-200 ring-1 ring-sky-500/40",
  },
};

const DEFAULT_META: TypeMeta = {
  icon: Wallet,
  amountClass: "text-slate-200",
  chipClass: "bg-slate-500/10 text-slate-200",
  haloClass: "from-slate-500/10 via-slate-500/0 to-transparent",
  iconClass: "bg-slate-500/10 text-slate-200 ring-1 ring-slate-500/40",
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
      <div className="space-y-3">
        {isInitialLoading
          ? Array.from({ length: 6 }).map((_, index) => <SkeletonCard key={index} />)
          : items.map((item) => {
              const selected = selectedIds.has(item.id);
              const tags = parseTags(item.tags);
              const note = item.title || item.description || item.notes || item.note || "";
              const description = note.trim() || "(Tanpa judul)";
              const formattedDate = formatDate(item.date);
              const meta = TYPE_META[item.type] || DEFAULT_META;
              const TypeIcon = meta.icon;
              const typeLabel = typeLabels[item.type] || item.type;

              return (
                <article
                  key={item.id}
                  className={clsx(
                    "relative overflow-hidden rounded-3xl border border-slate-800/60 bg-slate-950/70 p-4 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.9)] transition-all duration-200",
                    selected
                      ? "border-[var(--accent)]/70 ring-1 ring-[var(--accent)]/40"
                      : "hover:border-slate-700/70 hover:shadow-[0_18px_36px_-28px_rgba(148,163,184,0.35)]",
                  )}
                >
                  <div
                    aria-hidden="true"
                    className={clsx(
                      "pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br opacity-80",
                      meta.haloClass,
                    )}
                  />
                  <header className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-3 pt-1">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(event) => onToggleSelect(item.id, event)}
                        className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                        aria-label="Pilih transaksi"
                      />
                      <div
                        className={clsx(
                          "flex h-9 w-9 items-center justify-center rounded-full backdrop-blur", meta.iconClass,
                        )}
                      >
                        <TypeIcon className="h-4 w-4" aria-hidden="true" />
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col gap-3">
                      <div className="flex flex-wrap items-start gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <CategoryDot color={item.category_color} />
                            <p className="truncate text-sm font-semibold text-slate-100">
                              {item.category || "(Tanpa kategori)"}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                            <span className={clsx("rounded-full px-2 py-0.5 font-semibold", meta.chipClass)}>
                              {typeLabel}
                            </span>
                            {formattedDate && (
                              <time
                                dateTime={toDateValue(item.date)}
                                className="flex items-center gap-1 rounded-full bg-slate-900/50 px-2 py-0.5 text-xs text-slate-300"
                              >
                                <CalendarDays className="h-3 w-3" aria-hidden="true" />
                                {formattedDate}
                              </time>
                            )}
                          </div>
                        </div>
                        <div className="ml-auto text-right">
                          <p className={clsx("text-xl font-semibold tracking-tight", meta.amountClass)}>
                            {formatAmount(item.amount)}
                          </p>
                          {item.merchant && (
                            <p className="text-xs text-slate-400">{item.merchant}</p>
                          )}
                        </div>
                      </div>
                      <p className="text-sm font-medium text-slate-100 line-clamp-2" title={description}>
                        {description}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/60 px-2 py-1">
                          <Wallet className="h-3 w-3" aria-hidden="true" />
                          {item.account || "(Akun tidak diketahui)"}
                        </span>
                        {item.type === "transfer" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/60 px-2 py-1">
                            <ArrowRightLeft className="h-3 w-3" aria-hidden="true" />
                            {item.to_account || "(Akun tujuan tidak diketahui)"}
                          </span>
                        )}
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 rounded-full bg-slate-900/60 px-2 py-1 text-slate-200"
                          >
                            <Tag className="h-3 w-3" aria-hidden="true" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </header>
                  <footer className="mt-4 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      className="flex h-10 min-w-[2.5rem] items-center justify-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/70 px-3 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                      aria-label="Edit transaksi"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      <span className="hidden sm:inline">Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(item)}
                      disabled={deleteDisabled}
                      className="flex h-10 min-w-[2.5rem] items-center justify-center gap-2 rounded-full border border-rose-400/40 bg-rose-500/10 px-3 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label="Hapus transaksi"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      <span className="hidden sm:inline">Hapus</span>
                    </button>
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
    <div className="relative overflow-hidden rounded-3xl border border-slate-800/60 bg-slate-950/60 p-4 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.9)] animate-pulse">
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-3 pt-1">
          <div className="h-4 w-4 rounded bg-slate-800" />
          <div className="h-9 w-9 rounded-full bg-slate-800/80" />
        </div>
        <div className="flex-1 space-y-4">
          <div className="flex flex-wrap items-start gap-3">
            <div className="space-y-2">
              <div className="h-3 w-32 rounded-full bg-slate-800" />
              <div className="h-3 w-24 rounded-full bg-slate-800/70" />
            </div>
            <div className="ml-auto h-5 w-24 rounded-full bg-slate-800" />
          </div>
          <div className="h-3 w-full rounded-full bg-slate-800" />
          <div className="flex gap-2">
            <span className="h-5 w-24 rounded-full bg-slate-800" />
            <span className="h-5 w-20 rounded-full bg-slate-800/80" />
            <span className="h-5 w-20 rounded-full bg-slate-800/80" />
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <span className="h-10 w-16 rounded-full bg-slate-800/80" />
        <span className="h-10 w-16 rounded-full bg-slate-800/60" />
      </div>
    </div>
  );
}
