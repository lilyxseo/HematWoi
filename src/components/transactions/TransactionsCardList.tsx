import clsx from "clsx";
import { Pencil, Trash2 } from "lucide-react";
import type { ChangeEvent } from "react";
import CategoryDot from "./CategoryDot";
import type { TransactionRecord } from "./TransactionsTable";
import { formatCurrency } from "../../lib/format";

const TYPE_LABELS: Record<string, string> = {
  income: "Pemasukan",
  expense: "Pengeluaran",
  transfer: "Transfer",
};

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
    if (!Number.isFinite(date.getTime())) return String(value);
    return DATE_FORMATTER ? DATE_FORMATTER.format(date) : String(value);
  } catch (err) {
    return String(value);
  }
}

function parseTags(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag).trim()).filter(Boolean);
  }
  return String(value)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function getAmountClass(type?: string | null) {
  if (type === "income") return "text-emerald-400";
  if (type === "expense") return "text-rose-400";
  return "text-slate-300";
}

interface SortOption {
  value: string;
  label: string;
}

interface TransactionsCardListProps {
  items: TransactionRecord[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string, event?: ChangeEvent<HTMLInputElement>) => void;
  onEdit: (item: TransactionRecord) => void;
  onDelete: (id: string) => void;
  deleteDisabled?: boolean;
  sort: string;
  onSortChange: (sort: string) => void;
  sortOptions: SortOption[];
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onOpenAdd: () => void;
  onResetFilters: () => void;
}

export default function TransactionsCardList({
  items,
  loading,
  error,
  onRetry,
  selectedIds,
  onToggleSelect,
  onEdit,
  onDelete,
  deleteDisabled = false,
  sort,
  onSortChange,
  sortOptions,
  page,
  pageSize,
  total,
  onPageChange,
  onOpenAdd,
  onResetFilters,
}: TransactionsCardListProps) {
  const isInitialLoading = loading && items.length === 0;
  const hasErrorBanner = Boolean(error) && items.length > 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  if (error && !items.length && !loading) {
    return (
      <div className="md:hidden">
        <div className="rounded-3xl ring-1 ring-red-500/40 bg-red-500/10 p-6 text-center text-sm text-red-200">
          <p className="mb-3 font-semibold">Gagal memuat transaksi.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={onRetry}
              className="h-11 rounded-2xl bg-red-500/20 px-4 font-semibold text-red-100 ring-1 ring-red-500/40 transition hover:bg-red-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
            >
              Coba lagi
            </button>
            <button
              type="button"
              onClick={onOpenAdd}
              className="h-11 rounded-2xl bg-[var(--accent)]/20 px-4 font-semibold text-[var(--accent)] ring-1 ring-[var(--accent)]/50 transition hover:bg-[var(--accent)]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
            >
              Tambah Transaksi
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!loading && !items.length) {
    return (
      <div className="md:hidden">
        <div className="flex flex-col items-center justify-center gap-4 rounded-3xl bg-slate-900/60 p-12 text-center ring-1 ring-slate-800">
          <div className="rounded-full bg-slate-800/60 p-3 text-[var(--accent)]">📄</div>
          <div className="space-y-1 text-slate-300">
            <p className="text-lg font-semibold">Belum ada transaksi</p>
            <p className="text-sm text-slate-400">Mulai catat arus kas untuk melihat ringkasan di sini.</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onOpenAdd}
              className="h-11 rounded-2xl bg-[var(--accent)] px-4 text-sm font-semibold text-slate-950 shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/70"
            >
              Tambah Transaksi
            </button>
            <button
              type="button"
              onClick={onResetFilters}
              className="h-11 rounded-2xl px-4 text-sm font-medium text-slate-300 ring-1 ring-slate-700 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
            >
              Reset Filter
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 md:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="transactions-sort-mobile">
          Urutkan
        </label>
        <select
          id="transactions-sort-mobile"
          value={sort}
          onChange={(event) => onSortChange(event.target.value)}
          className="h-11 flex-1 min-w-[160px] rounded-2xl bg-slate-900/60 px-3 text-sm text-slate-200 ring-2 ring-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          aria-label="Urutkan daftar transaksi"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {hasErrorBanner && (
        <div className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-200 ring-1 ring-red-500/30">
          Gagal memperbarui daftar transaksi. <button type="button" onClick={onRetry} className="underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60">Coba lagi</button>
        </div>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <TransactionCard
            key={item.id}
            item={item}
            isSelected={selectedIds.has(item.id)}
            onToggleSelect={onToggleSelect}
            onEdit={onEdit}
            onDelete={onDelete}
            deleteDisabled={deleteDisabled}
          />
        ))}
        {isInitialLoading &&
          Array.from({ length: 6 }).map((_, index) => <SkeletonCard key={`card-skeleton-${index}`} />)}
      </div>

      <Pagination
        page={page}
        pageCount={pageCount}
        start={start}
        end={end}
        total={total}
        onPageChange={onPageChange}
        disabled={loading}
      />
    </div>
  );
}

interface TransactionCardProps {
  item: TransactionRecord;
  isSelected: boolean;
  onToggleSelect: (id: string, event?: ChangeEvent<HTMLInputElement>) => void;
  onEdit: (item: TransactionRecord) => void;
  onDelete: (id: string) => void;
  deleteDisabled: boolean;
}

function TransactionCard({ item, isSelected, onToggleSelect, onEdit, onDelete, deleteDisabled }: TransactionCardProps) {
  const note = (item.title || item.note || item.notes || item.description || "").toString().trim();
  const displayNote = note.length > 0 ? note : "(Tanpa catatan)";
  const tags = parseTags(item.tags);
  const amount = formatCurrency(Number(item.amount ?? 0), "IDR");
  const amountClass = clsx("text-right text-lg font-semibold", getAmountClass(item.type));

  return (
    <article className="rounded-2xl bg-slate-900 ring-1 ring-slate-800 p-3">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(event) => onToggleSelect(item.id, event)}
          className="mt-1 h-5 w-5 flex-shrink-0 rounded border-slate-700 bg-slate-900 text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
          aria-label="Pilih transaksi"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <CategoryDot color={item.category_color} />
                <span className="truncate">{item.category || "(Tanpa kategori)"}</span>
                <span className="text-[0.7rem] uppercase tracking-wide text-slate-500">
                  {TYPE_LABELS[item.type || ""] || "—"}
                </span>
              </div>
              <time className="text-xs text-slate-400" dateTime={item.date ? String(item.date) : undefined}>
                {formatDate(item.date)}
              </time>
            </div>
            <span className={amountClass}>{amount}</span>
          </div>
          <p className="line-clamp-2 text-sm text-slate-300">{displayNote}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            {item.type === "transfer" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-200">
                <span>{item.account || "—"}</span>
                <span aria-hidden="true">→</span>
                <span>{item.to_account || "—"}</span>
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-200">
                {item.account || "—"}
              </span>
            )}
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => onEdit(item)}
          className="h-9 w-9 rounded-full ring-1 ring-slate-700 text-slate-200 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
          aria-label="Edit transaksi"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          disabled={deleteDisabled}
          className="h-9 w-9 rounded-full ring-1 ring-slate-700 text-slate-200 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Hapus transaksi"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

function SkeletonCard() {
  return (
    <article className="animate-pulse rounded-2xl bg-slate-900 ring-1 ring-slate-800 p-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="h-4 w-32 rounded-full bg-slate-800/60" />
        <div className="h-6 w-20 rounded-full bg-slate-800/60" />
      </div>
      <div className="mb-3 h-4 w-full rounded-full bg-slate-800/60" />
      <div className="mb-2 h-4 w-3/4 rounded-full bg-slate-800/60" />
      <div className="flex gap-2">
        <div className="h-5 w-16 rounded-full bg-slate-800/60" />
        <div className="h-5 w-16 rounded-full bg-slate-800/60" />
      </div>
    </article>
  );
}

interface PaginationProps {
  page: number;
  pageCount: number;
  start: number;
  end: number;
  total: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

function Pagination({ page, pageCount, start, end, total, onPageChange, disabled = false }: PaginationProps) {
  const handlePrev = () => {
    if (page > 1) onPageChange(page - 1);
  };
  const handleNext = () => {
    if (page < pageCount) onPageChange(page + 1);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-900/50 px-4 py-3 text-sm text-slate-300 ring-1 ring-slate-800">
      <p>
        Menampilkan <span className="font-semibold text-slate-100">{start}</span>–
        <span className="font-semibold text-slate-100">{end}</span> dari {total}. Halaman {page} / {pageCount}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handlePrev}
          disabled={page <= 1 || disabled}
          className="h-9 rounded-full px-3 text-sm font-semibold text-slate-200 ring-1 ring-slate-700 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Halaman sebelumnya"
        >
          Prev
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={page >= pageCount || disabled}
          className="h-9 rounded-full px-3 text-sm font-semibold text-slate-200 ring-1 ring-slate-700 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Halaman selanjutnya"
        >
          Next
        </button>
      </div>
    </div>
  );
}
