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

export interface TransactionItem {
  id: string;
  type?: string;
  category?: string;
  category_id?: string;
  category_color?: string | null;
  title?: string;
  note?: string;
  notes?: string;
  description?: string;
  amount?: number | string;
  currency?: string;
  date?: string;
  account?: string;
  to_account?: string;
  tags?: string[] | string;
}

interface TransactionsTableProps {
  items: TransactionItem[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  onToggleSelectAll: () => void;
  allSelected: boolean;
  onToggleSelect: (id: string, event?: React.ChangeEvent<HTMLInputElement>) => void;
  selectedIds: Set<string>;
  onDelete: (id: string) => void;
  onEdit: (item: TransactionItem) => void;
  sort: string;
  onSortChange: (sort: string) => void;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  deleteDisabled?: boolean;
  tableStickyTop?: string;
  onResetFilters: () => void;
  onOpenAdd: () => void;
}

const SORT_ARROW: Record<string, string> = {
  asc: "▲",
  desc: "▼",
};

export default function TransactionsTable({
  items,
  loading,
  error,
  onRetry,
  onToggleSelectAll,
  allSelected,
  onToggleSelect,
  selectedIds,
  onDelete,
  onEdit,
  sort,
  onSortChange,
  page,
  pageSize,
  total,
  onPageChange,
  deleteDisabled = false,
  tableStickyTop,
  onResetFilters,
  onOpenAdd,
}: TransactionsTableProps) {
  const isInitialLoading = loading && items.length === 0;
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(rangeStart + items.length - 1, total);
  const hasNext = page * pageSize < total;
  const hasPrev = page > 1;

  if (error && !items.length) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm font-semibold">Gagal memuat transaksi.</p>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-11 items-center rounded-2xl bg-red-500/20 px-4 text-sm font-semibold text-red-100 transition hover:bg-red-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
          >
            Coba lagi
          </button>
        </div>
      </div>
    );
  }

  if (!loading && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-800 bg-slate-900/60 px-6 py-16 text-center text-slate-300">
        <span className="rounded-full bg-[var(--accent)]/10 px-4 py-2 text-sm font-semibold text-[var(--accent)]">
          Belum ada transaksi
        </span>
        <p className="max-w-sm text-sm text-slate-400">
          Coba atur ulang filter atau tambahkan transaksi baru untuk mulai melacak keuanganmu.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex h-11 items-center rounded-2xl border border-slate-800 px-4 text-sm font-semibold text-slate-300 transition hover:bg-slate-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            Reset Filter
          </button>
          <button
            type="button"
            onClick={onOpenAdd}
            className="inline-flex h-11 items-center rounded-2xl bg-[var(--accent)] px-5 text-sm font-semibold text-slate-950 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
          >
            Tambah Transaksi
          </button>
        </div>
      </div>
    );
  }

  const amountSortState = sort.startsWith("amount-") ? sort.split("-")[1] : null;
  const dateSortState = sort.startsWith("date-") ? sort.split("-")[1] : null;

  return (
    <div className="hidden md:block">
      <div className="overflow-hidden rounded-2xl ring-1 ring-slate-800">
        <div className="overflow-x-auto">
          <table className="hidden w-full min-w-[960px] md:table" aria-label="Daftar transaksi">
            <thead
              className="bg-slate-900 text-xs uppercase tracking-wide text-slate-400"
              style={tableStickyTop ? { position: "sticky", top: tableStickyTop, zIndex: 10 } : undefined}
            >
              <tr>
                <th scope="col" className="w-12 px-4 py-3">
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={onToggleSelectAll}
                      className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                      aria-label="Pilih semua transaksi di halaman ini"
                    />
                  </div>
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs uppercase tracking-wide text-slate-400">
                  Kategori &amp; Judul
                </th>
                <SortableHeader
                  label="Tanggal"
                  alignment="left"
                  active={Boolean(dateSortState)}
                  onClick={() => onSortChange(dateSortState === "desc" ? "date-asc" : "date-desc")}
                  indicator={dateSortState ? SORT_ARROW[dateSortState as "asc" | "desc"] : undefined}
                />
                <th scope="col" className="px-4 py-3 text-left text-xs uppercase tracking-wide text-slate-400">
                  Akun
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs uppercase tracking-wide text-slate-400">
                  Tags
                </th>
                <SortableHeader
                  label="Jumlah"
                  alignment="right"
                  active={Boolean(amountSortState)}
                  onClick={() => onSortChange(amountSortState === "desc" ? "amount-asc" : "amount-desc")}
                  indicator={amountSortState ? SORT_ARROW[amountSortState as "asc" | "desc"] : undefined}
                />
                <th scope="col" className="px-4 py-3 text-right text-xs uppercase tracking-wide text-slate-400">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {items.map((item) => (
                <TableRow
                  key={item.id}
                  item={item}
                  onToggleSelect={onToggleSelect}
                  selected={selectedIds.has(item.id)}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  deleteDisabled={deleteDisabled}
                />
              ))}
              {isInitialLoading &&
                Array.from({ length: 6 }).map((_, index) => <SkeletonRow key={`skeleton-${index}`} />)}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-slate-900/80 px-4 py-3 text-sm text-slate-400">
          <p>
            Menampilkan {rangeStart === 0 ? 0 : `${rangeStart}–${rangeEnd}`} dari {total} transaksi
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={!hasPrev || loading}
              className="inline-flex h-9 items-center rounded-full px-4 text-xs font-semibold text-slate-300 transition hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Prev
            </button>
            <span className="text-xs text-slate-500">Halaman {page}</span>
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
    </div>
  );
}

interface SortableHeaderProps {
  label: string;
  onClick: () => void;
  active: boolean;
  indicator?: string;
  alignment?: "left" | "right";
}

function SortableHeader({ label, onClick, active, indicator, alignment = "left" }: SortableHeaderProps) {
  return (
    <th
      scope="col"
      className={clsx(
        "px-4 py-3 text-xs uppercase tracking-wide text-slate-400",
        alignment === "right" ? "text-right" : "text-left",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className={clsx(
          "group inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400",
          active ? "text-[var(--accent)]" : "hover:text-slate-200",
        )}
      >
        {label}
        {active && indicator && <span aria-hidden="true">{indicator}</span>}
      </button>
    </th>
  );
}

interface TableRowProps {
  item: TransactionItem;
  selected: boolean;
  onToggleSelect: (id: string, event?: React.ChangeEvent<HTMLInputElement>) => void;
  onDelete: (id: string) => void;
  onEdit: (item: TransactionItem) => void;
  deleteDisabled: boolean;
}

function TableRow({ item, selected, onToggleSelect, onDelete, onEdit, deleteDisabled }: TableRowProps) {
  const tags = parseTags(item.tags);
  const note = item.note ?? item.notes ?? item.description ?? item.title ?? "";
  const amountTone = getAmountTone(item.type);
  const amount = formatAmount(item.amount, item.currency);
  const dateLabel = formatTransactionDate(item.date);
  const typeLabel = getTypeLabel(item.type);

  return (
    <tr className="transition hover:bg-slate-800/50">
      <td className="px-4 py-3 align-middle">
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) => onToggleSelect(item.id, event)}
            className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            aria-label="Pilih transaksi"
          />
        </div>
      </td>
      <td className="px-4 py-3 align-middle">
        <div className="flex items-center gap-3">
          <CategoryDot color={item.category_color || undefined} type={item.type} aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-200" title={item.category || typeLabel}>
              {item.category || typeLabel}
            </p>
            <p className="truncate text-xs text-slate-400" title={note}>
              {item.title || note || "(Tanpa judul)"}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 align-middle text-sm text-slate-300">
        <time dateTime={item.date || undefined}>{dateLabel}</time>
      </td>
      <td className="px-4 py-3 align-middle text-sm text-slate-300">
        {item.type === "transfer" ? (
          <div className="flex flex-wrap items-center gap-2 text-slate-300">
            <span className="truncate max-w-[140px]">{item.account || "—"}</span>
            <span className="text-slate-500">→</span>
            <span className="truncate max-w-[140px]">{item.to_account || "—"}</span>
          </div>
        ) : (
          <span className="truncate max-w-[160px]">{item.account || "—"}</span>
        )}
      </td>
      <td className="px-4 py-3 align-middle">
        {tags.length ? (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full bg-slate-800/70 px-2.5 py-0.5 text-xs text-slate-300"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-sm text-slate-500">—</span>
        )}
      </td>
      <td className="px-4 py-3 align-middle">
        <span className={clsx("block text-right font-mono text-sm", amountTone)}>{amount}</span>
      </td>
      <td className="px-4 py-3 align-middle">
        <div className="flex items-center justify-end gap-2">
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
      </td>
    </tr>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 7 }).map((_, index) => (
        <td key={index} className="px-4 py-3 align-middle">
          <div className="h-5 rounded-full bg-slate-800/60" />
        </td>
      ))}
    </tr>
  );
}
