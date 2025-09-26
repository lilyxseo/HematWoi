import clsx from "clsx";
import { Pencil, Trash2 } from "lucide-react";
import CategoryDot from "./CategoryDot";
import {
  formatAmount,
  formatTransactionDate,
  getAmountTone,
  getTypeLabel,
  parseTags,
} from "./utils";
import type { TransactionItem } from "./TransactionsTable";

interface TransactionsCardListProps {
  items: TransactionItem[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string, event?: React.ChangeEvent<HTMLInputElement>) => void;
  onDelete: (id: string) => void;
  onEdit: (item: TransactionItem) => void;
  sort: string;
  onSortChange: (value: string) => void;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  deleteDisabled?: boolean;
  onResetFilters: () => void;
  onOpenAdd: () => void;
}

const SORT_OPTIONS = [
  { value: "date-desc", label: "Terbaru" },
  { value: "date-asc", label: "Terlama" },
  { value: "amount-desc", label: "Nominal Tertinggi" },
  { value: "amount-asc", label: "Nominal Terendah" },
];

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
  deleteDisabled = false,
  onResetFilters,
  onOpenAdd,
}: TransactionsCardListProps) {
  const isInitialLoading = loading && items.length === 0;
  const hasNext = page * pageSize < total;
  const hasPrev = page > 1;
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(rangeStart + items.length - 1, total);

  if (error && !items.length) {
    return (
      <div className="rounded-2xl ring-1 ring-red-500/30 bg-red-500/10 p-4 text-red-200">
        <p className="text-sm font-semibold">Gagal memuat transaksi.</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex h-10 items-center rounded-2xl bg-red-500/20 px-4 text-sm font-semibold text-red-100 transition hover:bg-red-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  if (!loading && items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/60 p-6 text-center text-slate-300">
        <p className="text-sm font-semibold">Belum ada transaksi</p>
        <p className="mt-2 text-sm text-slate-400">Mulai dengan menambahkan transaksi atau reset filter.</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex h-10 items-center rounded-2xl border border-slate-800 px-4 text-sm font-semibold text-slate-300 transition hover:bg-slate-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            Reset Filter
          </button>
          <button
            type="button"
            onClick={onOpenAdd}
            className="inline-flex h-10 items-center rounded-2xl bg-[var(--accent)] px-4 text-sm font-semibold text-slate-950 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
          >
            Tambah Transaksi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="md:hidden">
      <div className="mb-3 flex items-center justify-end">
        <label className="flex h-11 items-center gap-2 rounded-2xl bg-slate-900/70 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400 ring-2 ring-slate-800 focus-within:ring-[var(--accent)]">
          <span>Urutkan</span>
          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value)}
            className="h-full rounded-2xl bg-transparent text-sm text-slate-200 focus:outline-none"
            aria-label="Urutkan transaksi"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} className="bg-slate-900 text-slate-200">
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <Card
            key={item.id}
            item={item}
            selected={selectedIds.has(item.id)}
            onToggleSelect={onToggleSelect}
            onDelete={onDelete}
            onEdit={onEdit}
            deleteDisabled={deleteDisabled}
          />
        ))}
        {isInitialLoading &&
          Array.from({ length: 6 }).map((_, index) => <SkeletonCard key={`skeleton-${index}`} />)}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <span>Menampilkan {rangeStart === 0 ? 0 : `${rangeStart}–${rangeEnd}`} dari {total}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={!hasPrev || loading}
            className="inline-flex h-9 items-center rounded-full px-4 text-xs font-semibold text-slate-300 transition hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Prev
          </button>
          <span className="text-slate-500">Halaman {page}</span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={!hasNext || loading}
            className="inline-flex h-9 items-center rounded-full px-4 text-xs font-semibold text-slate-300 transition hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

interface CardProps {
  item: TransactionItem;
  selected: boolean;
  onToggleSelect: (id: string, event?: React.ChangeEvent<HTMLInputElement>) => void;
  onDelete: (id: string) => void;
  onEdit: (item: TransactionItem) => void;
  deleteDisabled: boolean;
}

function Card({ item, selected, onToggleSelect, onDelete, onEdit, deleteDisabled }: CardProps) {
  const tags = parseTags(item.tags);
  const note = item.note ?? item.notes ?? item.description ?? "";
  const amountTone = getAmountTone(item.type);
  const amount = formatAmount(item.amount, item.currency);
  const dateLabel = formatTransactionDate(item.date);
  const typeLabel = getTypeLabel(item.type);

  return (
    <article className={clsx("rounded-2xl bg-slate-900 ring-1 ring-slate-800 p-3", selected && "ring-[var(--accent)]")}> 
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={(event) => onToggleSelect(item.id, event)}
          className="mt-1 h-5 w-5 flex-shrink-0 rounded border-slate-700 bg-slate-900 text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          aria-label="Pilih transaksi"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <CategoryDot color={item.category_color || undefined} type={item.type} aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-slate-200">{item.category || typeLabel}</p>
                <p className="text-xs text-slate-400">{dateLabel}</p>
              </div>
            </div>
            <span className={clsx("text-right font-mono text-base", amountTone)}>{amount}</span>
          </div>
          <p className="line-clamp-2 text-sm text-slate-300" title={note || item.title || undefined}>
            {item.title || note || "(Tanpa catatan)"}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            {item.type === "transfer" ? (
              <span>
                {item.account || "—"} → {item.to_account || "—"}
              </span>
            ) : (
              <span>{item.account || "—"}</span>
            )}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full bg-slate-800/70 px-2 py-0.5 text-[11px] text-slate-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => onEdit(item)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-slate-700 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              aria-label="Edit transaksi"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              disabled={deleteDisabled}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-rose-400 ring-1 ring-rose-400/50 transition hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Hapus transaksi"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function SkeletonCard() {
  return (
    <article className="rounded-2xl bg-slate-900/60 p-3 ring-1 ring-slate-800 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="mt-1 h-5 w-5 rounded bg-slate-800" />
        <div className="flex-1 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="h-4 w-24 rounded-full bg-slate-800/80" />
              <div className="h-3 w-20 rounded-full bg-slate-800/60" />
            </div>
            <div className="h-6 w-24 rounded-full bg-slate-800/80" />
          </div>
          <div className="h-4 w-full rounded-full bg-slate-800/70" />
          <div className="flex gap-2">
            <div className="h-4 w-24 rounded-full bg-slate-800/70" />
            <div className="h-4 w-16 rounded-full bg-slate-800/60" />
          </div>
          <div className="flex justify-end gap-2">
            <div className="h-9 w-9 rounded-full bg-slate-800/70" />
            <div className="h-9 w-9 rounded-full bg-slate-800/60" />
          </div>
        </div>
      </div>
    </article>
  );
}
