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
    amountClass: "text-emerald-400",
    iconWrapper: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/40",
  },
  expense: {
    icon: ArrowDownCircle,
    amountClass: "text-rose-400",
    iconWrapper: "bg-rose-500/10 text-rose-300 ring-rose-500/40",
  },
  transfer: {
    icon: ArrowRightLeft,
    amountClass: "text-slate-200",
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
                    "group relative overflow-hidden rounded-3xl border border-slate-800/60 bg-slate-950/70 p-5 shadow-2xl shadow-slate-950/50 ring-1 ring-slate-900/80 transition duration-300",
                    "before:pointer-events-none before:absolute before:-left-1/2 before:top-0 before:h-full before:w-full before:rounded-full before:bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.16),_rgba(255,255,255,0))] before:opacity-0 before:transition before:duration-500 before:content-[''] group-hover:border-slate-700 group-hover:before:opacity-100",
                    selected && "ring-2 ring-[var(--accent)]/60",
                  )}
                >
                  <div className="relative flex flex-col gap-5">
                    <header className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex flex-1 items-start gap-3">
                        <span
                          className={clsx(
                            "flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/20 ring-1 backdrop-blur-lg",
                            meta.iconWrapper,
                          )}
                        >
                          <TypeIcon className="h-5 w-5" aria-hidden="true" />
                          <span className="sr-only">{typeLabels[item.type] || item.type}</span>
                        </span>
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                            <CategoryDot color={item.category_color} />
                            <span>{item.category || "(Tanpa kategori)"}</span>
                          </div>
                          <p className="text-sm text-slate-400 line-clamp-2" title={description}>
                            {description}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-3">
                        <span className={clsx("rounded-2xl bg-black/30 px-4 py-2 text-xl font-semibold shadow-inner", meta.amountClass)}>
                          {formatAmount(item.amount)}
                        </span>
                        <div className="flex items-center gap-3">
                          <time
                            dateTime={toDateValue(item.date)}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-900/80 px-3 py-1 text-xs font-medium text-slate-300 shadow"
                          >
                            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                            {formattedDate}
                          </time>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={(event) => onToggleSelect(item.id, event)}
                            className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-[var(--accent)] shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                            aria-label="Pilih transaksi"
                          />
                        </div>
                      </div>
                    </header>
                    <div className="rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4 shadow-inner">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-200">
                        <span className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/80 px-3 py-1 shadow-sm">
                          <Wallet2 className="h-3.5 w-3.5" aria-hidden="true" />
                          {item.account || "—"}
                        </span>
                        {item.type === "transfer" && (
                          <span className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/80 px-3 py-1 shadow-sm">
                            <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden="true" />
                            {item.to_account || "—"}
                          </span>
                        )}
                      </div>
                    </div>
                    <footer className="flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-3 shadow-lg shadow-slate-950/40">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onRepeat(item)}
                          disabled={repeating}
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900/70 text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
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
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900/70 text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                          aria-label="Edit transaksi"
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(item.id)}
                          disabled={deleteDisabled}
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-400/30 bg-rose-500/10 text-rose-300 transition hover:border-rose-300/60 hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label="Hapus transaksi"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </footer>
                  </div>
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
    <div className="relative overflow-hidden rounded-3xl border border-slate-800/60 bg-slate-950/70 p-5 ring-1 ring-slate-900/80 animate-pulse">
      <div className="pointer-events-none absolute -left-1/2 top-0 h-full w-full rounded-full bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_rgba(255,255,255,0))]" />
      <div className="relative space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-1 items-start gap-3">
            <span className="h-12 w-12 rounded-2xl bg-slate-800/80" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 rounded-full bg-slate-800/70" />
              <div className="h-3 w-48 rounded-full bg-slate-800/50" />
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <span className="h-8 w-28 rounded-2xl bg-slate-800/70" />
            <div className="flex items-center gap-3">
              <span className="h-6 w-24 rounded-full bg-slate-800/60" />
              <span className="h-4 w-4 rounded bg-slate-800/60" />
            </div>
          </div>
        </div>
        <div className="h-16 rounded-2xl bg-slate-800/40" />
        <div className="flex justify-end gap-2 rounded-2xl bg-slate-900/60 p-3">
          <span className="h-10 w-10 rounded-xl bg-slate-800/70" />
          <span className="h-10 w-10 rounded-xl bg-slate-800/60" />
          <span className="h-10 w-10 rounded-xl bg-slate-800/50" />
        </div>
      </div>
    </div>
  );
}
