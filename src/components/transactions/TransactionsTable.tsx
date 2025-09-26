import clsx from "clsx";
import { Pencil, Trash2 } from "lucide-react";
import type { ChangeEvent, CSSProperties } from "react";
import { formatCurrency } from "../../lib/format";
import CategoryDot from "./CategoryDot";

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

function formatAmount(value: unknown): string {
  return formatCurrency(Number(value ?? 0), "IDR");
}

function getAmountClass(type?: string | null) {
  if (type === "income") return "text-emerald-400";
  if (type === "expense") return "text-rose-400";
  return "text-slate-300";
}

export interface TransactionRecord {
  id: string;
  type?: string;
  category?: string;
  category_color?: string | null;
  title?: string | null;
  note?: string | null;
  notes?: string | null;
  description?: string | null;
  date?: string | null;
  account?: string | null;
  to_account?: string | null;
  tags?: string[] | string | null;
  amount?: number | string | null;
  receipt_url?: string | null;
  receipts?: unknown;
}

interface TransactionsTableProps {
  items: TransactionRecord[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  selectedIds: Set<string>;
  allSelected: boolean;
  onToggleSelect: (id: string, event?: ChangeEvent<HTMLInputElement>) => void;
  onToggleSelectAll: () => void;
  onEdit: (item: TransactionRecord) => void;
  onDelete: (id: string) => void;
  sort: string;
  onSortChange: (sort: string) => void;
  tableStickyTop?: string;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  deleteDisabled?: boolean;
  onOpenAdd: () => void;
  onResetFilters: () => void;
}

export default function TransactionsTable({
  items,
  loading,
  error,
  onRetry,
  selectedIds,
  allSelected,
  onToggleSelect,
  onToggleSelectAll,
  onEdit,
  onDelete,
  sort,
  onSortChange,
  tableStickyTop,
  page,
  pageSize,
  total,
  onPageChange,
  deleteDisabled = false,
  onOpenAdd,
  onResetFilters,
}: TransactionsTableProps) {
  const isInitialLoading = loading && items.length === 0;
  const hasErrorBanner = Boolean(error) && items.length > 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  const headerStyle: CSSProperties | undefined = tableStickyTop
    ? { position: "sticky", top: tableStickyTop, zIndex: 10 }
    : undefined;

  const handleDateSort = () => {
    if (sort === "date-desc") {
      onSortChange("date-asc");
    } else {
      onSortChange("date-desc");
    }
  };

  const handleAmountSort = () => {
    if (sort === "amount-desc") {
      onSortChange("amount-asc");
    } else {
      onSortChange("amount-desc");
    }
  };

  if (error && !items.length && !loading) {
    return (
      <div className="rounded-3xl ring-1 ring-red-500/40 bg-red-500/10 p-6 text-center text-sm text-red-200">
        <p className="mb-3 font-semibold">Gagal memuat transaksi.</p>
        <div className="flex justify-center gap-3">
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
    );
  }

  if (!loading && !items.length) {
    return (
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
    );
  }

  return (
    <div className="space-y-3">
      {hasErrorBanner && (
        <div className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-200 ring-1 ring-red-500/30">
          Gagal memperbarui daftar transaksi. <button type="button" onClick={onRetry} className="underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60">Coba lagi</button>
        </div>
      )}
      <div className="overflow-hidden rounded-3xl bg-slate-900/60 ring-1 ring-slate-800">
        <div className="overflow-x-auto">
          <table className="hidden min-w-full table-fixed md:table" aria-label="Daftar transaksi">
            <thead className="bg-slate-900 text-slate-400" style={headerStyle}>
              <tr className="text-left text-xs uppercase tracking-wide">
                <th scope="col" className="px-4 py-3">
                  <div className="flex justify-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
                      checked={allSelected}
                      onChange={onToggleSelectAll}
                      aria-label="Pilih semua transaksi"
                    />
                  </div>
                </th>
                <th scope="col" className="px-4 py-3 text-slate-300">Tipe &amp; Kategori</th>
                <th scope="col" className="px-4 py-3">
                  <button
                    type="button"
                    onClick={handleDateSort}
                    className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
                    aria-label="Urutkan berdasarkan tanggal"
                  >
                    Tanggal
                    <SortIndicator active={sort.startsWith("date")} direction={sort === "date-asc" ? "asc" : "desc"} />
                  </button>
                </th>
                <th scope="col" className="px-4 py-3 text-slate-300">Akun</th>
                <th scope="col" className="px-4 py-3 text-slate-300">Tags</th>
                <th scope="col" className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={handleAmountSort}
                    className="ml-auto flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
                    aria-label="Urutkan berdasarkan jumlah"
                  >
                    Jumlah
                    <SortIndicator active={sort.startsWith("amount")} direction={sort === "amount-asc" ? "asc" : "desc"} />
                  </button>
                </th>
                <th scope="col" className="px-4 py-3 text-right text-slate-300">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-sm text-slate-200">
              {items.map((item) => (
                <TransactionRow
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
                Array.from({ length: 6 }).map((_, index) => <SkeletonRow key={`skeleton-${index}`} />)}
            </tbody>
          </table>
        </div>
        {loading && items.length > 0 && (
          <div className="hidden items-center justify-center gap-2 border-t border-slate-800 px-4 py-3 text-sm text-slate-400 md:flex">
            Memuat...
          </div>
        )}
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

interface SortIndicatorProps {
  active: boolean;
  direction: "asc" | "desc";
}

function SortIndicator({ active, direction }: SortIndicatorProps) {
  if (!active) {
    return <span aria-hidden="true" className="text-slate-600">◂▸</span>;
  }
  return <span aria-hidden="true">{direction === "asc" ? "▲" : "▼"}</span>;
}

interface TransactionRowProps {
  item: TransactionRecord;
  isSelected: boolean;
  onToggleSelect: (id: string, event?: ChangeEvent<HTMLInputElement>) => void;
  onEdit: (item: TransactionRecord) => void;
  onDelete: (id: string) => void;
  deleteDisabled: boolean;
}

function TransactionRow({ item, isSelected, onToggleSelect, onEdit, onDelete, deleteDisabled }: TransactionRowProps) {
  const note = (item.title || item.note || item.notes || item.description || "").toString().trim();
  const displayNote = note.length > 0 ? note : "—";
  const dateValue = item.date ? String(item.date) : undefined;
  const tags = parseTags(item.tags);

  const amountClass = clsx("font-mono text-right", getAmountClass(item.type));

  return (
    <tr className="transition-colors hover:bg-slate-800/50">
      <td className="px-4 py-3">
        <div className="flex justify-center">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(event) => onToggleSelect(item.id, event)}
            className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
            aria-label="Pilih transaksi"
          />
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <CategoryDot color={item.category_color} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-200" title={item.category || "(Tanpa kategori)"}>
              {item.category || "(Tanpa kategori)"}
            </p>
            <p className="text-xs uppercase tracking-wide text-slate-400">{TYPE_LABELS[item.type || ""] || "—"}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-slate-300">
        <time dateTime={dateValue}>{formatDate(item.date)}</time>
      </td>
      <td className="px-4 py-3 text-sm text-slate-200">
        {item.type === "transfer" ? (
          <div className="flex flex-wrap items-center gap-1 text-slate-300">
            <span className="truncate">{item.account || "—"}</span>
            <span aria-hidden="true">→</span>
            <span className="truncate">{item.to_account || "—"}</span>
          </div>
        ) : (
          <span className="truncate">{item.account || "—"}</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-slate-200">
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-slate-500">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className={amountClass}>{formatAmount(item.amount)}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-2">
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
      </td>
    </tr>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-4">
        <div className="mx-auto h-4 w-4 rounded bg-slate-800/60" />
      </td>
      <td className="px-4 py-4">
        <div className="h-4 w-40 rounded-full bg-slate-800/60" />
      </td>
      <td className="px-4 py-4">
        <div className="h-4 w-32 rounded-full bg-slate-800/60" />
      </td>
      <td className="px-4 py-4">
        <div className="h-4 w-36 rounded-full bg-slate-800/60" />
      </td>
      <td className="px-4 py-4">
        <div className="h-4 w-48 rounded-full bg-slate-800/60" />
      </td>
      <td className="px-4 py-4">
        <div className="ml-auto h-4 w-24 rounded-full bg-slate-800/60" />
      </td>
      <td className="px-4 py-4">
        <div className="ml-auto flex gap-2">
          <span className="inline-flex h-9 w-9 rounded-full bg-slate-800/60" />
          <span className="inline-flex h-9 w-9 rounded-full bg-slate-800/60" />
        </div>
      </td>
    </tr>
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
