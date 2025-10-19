import clsx from "clsx";
import {
  ArrowDownCircle,
  ArrowRightLeft,
  ArrowUpCircle,
  CalendarDays,
  Loader2,
  Pencil,
  RotateCcw,
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
  account_id?: string | null;
  to_account_id?: string | null;
  category_id?: string | null;
  merchant_id?: string | null;
}

interface TransactionsCardListProps {
  items: TransactionRowData[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string, event?: ChangeEvent<HTMLInputElement>) => void;
  onEdit: (item: TransactionRowData) => void;
  onDelete: (id: string) => void;
  onRepeat: (item: TransactionRowData) => void;
  formatAmount: (value: number) => string;
  formatDate: (value?: string | null) => string;
  toDateValue: (value?: string | null) => string;
  typeLabels: Record<string, string>;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  deleteDisabled?: boolean;
  repeatLoadingIds?: Set<string>;
  emptyState: ReactNode;
}

const TYPE_META: Record<
  string,
  {
    icon: typeof ArrowUpCircle;
    amountClass: string;
    iconWrapper: string;
  }
> = {
  income: {
    icon: ArrowUpCircle,
    amountClass: "text-emerald-300",
    iconWrapper: "bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-transparent text-emerald-200 ring-emerald-400/40",
  },
  expense: {
    icon: ArrowDownCircle,
    amountClass: "text-rose-300",
    iconWrapper: "bg-gradient-to-br from-rose-500/20 via-rose-500/10 to-transparent text-rose-200 ring-rose-400/40",
  },
  transfer: {
    icon: ArrowRightLeft,
    amountClass: "text-slate-200",
    iconWrapper: "bg-gradient-to-br from-slate-500/20 via-slate-500/10 to-transparent text-slate-200 ring-slate-400/40",
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
  onRepeat,
  formatAmount,
  formatDate,
  toDateValue,
  typeLabels,
  page,
  pageSize,
  total,
  onPageChange,
  deleteDisabled = false,
  repeatLoadingIds,
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
              const note = item.title || item.description || item.notes || item.note || "";
              const description = note.trim() || "(Tanpa judul)";
              const formattedDate = formatDate(item.date);
              const meta = TYPE_META[item.type] || TYPE_META.transfer;
              const TypeIcon = meta.icon;
              const repeating = repeatLoadingIds?.has(item.id) ?? false;

              return (
                <article
                  key={item.id}
                  className={clsx(
                    "group relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-lg shadow-black/50 ring-1 ring-white/10 transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--accent)]/40 hover:shadow-black/60",
                    selected && "ring-2 ring-[var(--accent)]/60",
                  )}
                >
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <div className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-[var(--accent)]/10 blur-3xl" />
                  <header className="relative z-10 flex items-start justify-between gap-4">
                    <div className="flex flex-1 items-start gap-3">
                      <span
                        className={clsx(
                          "flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 ring-2 ring-white/10 backdrop-blur",
                          meta.iconWrapper,
                        )}
                      >
                        <TypeIcon className="h-5 w-5" aria-hidden="true" />
                        <span className="sr-only">{typeLabels[item.type] || item.type}</span>
                      </span>
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-100">
                          <CategoryDot color={item.category_color} />
                          <span>{item.category || "(Tanpa kategori)"}</span>
                        </div>
                        <time
                          dateTime={toDateValue(item.date)}
                          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/60 px-3 py-1 text-xs font-medium text-slate-300 shadow-sm shadow-black/40"
                        >
                          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                          {formattedDate}
                        </time>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(event) => onToggleSelect(item.id, event)}
                        className="mt-1 h-5 w-5 rounded-lg border border-white/20 bg-slate-900 text-[var(--accent)] shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                        aria-label="Pilih transaksi"
                      />
                    </div>
                  </header>
                  <div className="relative z-10 mt-5 space-y-4">
                    <p className="text-base font-semibold text-slate-100 line-clamp-2" title={description}>
                      {description}
                    </p>
                    <div className="grid gap-3 text-sm text-slate-300">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/70 px-3 py-1 text-xs font-medium text-slate-200 shadow-sm">
                          <Wallet2 className="h-3.5 w-3.5" aria-hidden="true" />
                          {item.account || "—"}
                        </span>
                        {item.type === "transfer" && (
                          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/70 px-3 py-1 text-xs font-medium text-slate-200 shadow-sm">
                            <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden="true" />
                            {item.to_account || "—"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <footer className="relative z-10 mt-6 space-y-3">
                    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 shadow-inner shadow-black/60">
                      <span className={clsx("text-2xl font-semibold", meta.amountClass)}>
                        {formatAmount(item.amount)}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onRepeat(item)}
                          disabled={repeating}
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-slate-900/70 text-slate-200 transition hover:border-[var(--accent)]/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label="Ulangi transaksi"
                        >
                          {repeating ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <RotateCcw className="h-4 w-4" aria-hidden="true" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onEdit(item)}
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-slate-900/70 text-slate-200 transition hover:border-[var(--accent)]/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                          aria-label="Edit transaksi"
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(item.id)}
                          disabled={deleteDisabled}
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-400/30 bg-rose-500/10 text-rose-200 transition hover:border-rose-300/60 hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label="Hapus transaksi"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
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
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 p-5 ring-1 ring-white/10 animate-pulse">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/10" />
      <div className="relative flex items-start gap-3">
        <span className="h-12 w-12 rounded-2xl bg-slate-900/80" />
        <div className="flex-1 space-y-3">
          <div className="h-4 w-28 rounded-full bg-slate-800/80" />
          <div className="h-3 w-36 rounded-full bg-slate-800/60" />
          <div className="h-3 w-24 rounded-full bg-slate-800/60" />
        </div>
        <span className="h-6 w-6 rounded-lg bg-slate-800/70" />
      </div>
      <div className="relative mt-6 space-y-4">
        <div className="h-4 w-full rounded-full bg-slate-800/70" />
        <div className="flex gap-2">
          <span className="h-6 w-24 rounded-full bg-slate-800/60" />
          <span className="h-6 w-20 rounded-full bg-slate-800/50" />
        </div>
      </div>
      <div className="relative mt-8 flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3">
        <span className="h-6 w-28 rounded-full bg-slate-800/70" />
        <div className="flex gap-2">
          <span className="h-10 w-10 rounded-xl bg-slate-800/70" />
          <span className="h-10 w-10 rounded-xl bg-slate-800/60" />
          <span className="h-10 w-10 rounded-xl bg-slate-800/60" />
        </div>
      </div>
    </div>
  );
}
