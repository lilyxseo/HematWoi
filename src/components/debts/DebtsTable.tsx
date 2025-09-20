import { Loader2, Pencil, Wallet, Trash2 } from 'lucide-react';
import type { DebtRecord } from '../../lib/api-debts';

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
});

const TYPE_LABEL: Record<DebtRecord['type'], string> = {
  debt: 'H',
  receivable: 'P',
};

const TYPE_TITLE: Record<DebtRecord['type'], string> = {
  debt: 'Hutang',
  receivable: 'Piutang',
};

const STATUS_STYLE: Record<DebtRecord['status'], string> = {
  ongoing: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30',
  paid: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30',
  overdue: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30',
};

interface DebtsTableProps {
  items: DebtRecord[];
  loading?: boolean;
  onEdit: (debt: DebtRecord) => void;
  onDelete: (debt: DebtRecord) => void;
  onAddPayment: (debt: DebtRecord) => void;
}

function formatCurrency(value: number) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatDate(value: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return dateFormatter.format(date);
}

function isDueSoon(debt: DebtRecord) {
  if (!debt.due_date) return false;
  if (debt.status === 'paid') return false;
  const due = new Date(debt.due_date);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  return due.getTime() <= today.getTime();
}

export default function DebtsTable({ items, loading, onEdit, onDelete, onAddPayment }: DebtsTableProps) {
  const showSkeleton = loading && items.length === 0;
  const showEmpty = !loading && items.length === 0;

  return (
    <div className="min-w-0 overflow-hidden rounded-3xl border border-border/60 bg-surface-1/80 shadow-sm">
      <div className="min-w-0 overflow-x-auto">
        <table className="w-full min-w-[960px] table-auto text-left text-sm text-text/80 md:table-fixed">
          <thead className="sticky top-0 z-10 bg-background/95 text-muted backdrop-blur">
            <tr className="text-xs font-semibold uppercase tracking-wide">
              <th scope="col" className="px-4 py-3 text-center">Tipe</th>
              <th scope="col" className="min-w-[180px] px-4 py-3">Pihak</th>
              <th scope="col" className="min-w-[220px] px-4 py-3">Judul</th>
              <th scope="col" className="min-w-[140px] px-4 py-3">Tanggal</th>
              <th scope="col" className="min-w-[160px] px-4 py-3">Jatuh Tempo</th>
              <th scope="col" className="min-w-[120px] px-4 py-3">Bunga %</th>
              <th scope="col" className="min-w-[140px] px-4 py-3 text-right">Jumlah</th>
              <th scope="col" className="min-w-[140px] px-4 py-3 text-right">Terbayar</th>
              <th scope="col" className="min-w-[140px] px-4 py-3 text-right">Sisa</th>
              <th scope="col" className="min-w-[140px] px-4 py-3 text-center">Status</th>
              <th scope="col" className="w-[140px] px-4 py-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {showSkeleton
              ? Array.from({ length: 6 }).map((_, index) => (
                  <tr key={`debt-skeleton-${index}`} className="bg-transparent">
                    <td className="px-4 py-4 text-center align-middle">
                      <div className="mx-auto h-7 w-7 animate-pulse rounded-full bg-border/50" />
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <div className="h-3.5 w-32 animate-pulse rounded bg-border/40" />
                      <div className="mt-2 h-3 w-24 animate-pulse rounded bg-border/30" />
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <div className="h-3.5 w-48 animate-pulse rounded bg-border/40" />
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <div className="h-3.5 w-24 animate-pulse rounded bg-border/40" />
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <div className="h-3.5 w-36 animate-pulse rounded bg-border/40" />
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <div className="h-3.5 w-16 animate-pulse rounded bg-border/40" />
                    </td>
                    <td className="px-4 py-4 text-right align-middle">
                      <div className="ml-auto h-3.5 w-20 animate-pulse rounded bg-border/40" />
                    </td>
                    <td className="px-4 py-4 text-right align-middle">
                      <div className="ml-auto h-3.5 w-20 animate-pulse rounded bg-border/40" />
                    </td>
                    <td className="px-4 py-4 text-right align-middle">
                      <div className="ml-auto h-3.5 w-20 animate-pulse rounded bg-border/40" />
                    </td>
                    <td className="px-4 py-4 text-center align-middle">
                      <div className="mx-auto h-6 w-20 animate-pulse rounded-full bg-border/30" />
                    </td>
                    <td className="px-4 py-4 text-center align-middle">
                      <div className="mx-auto flex max-w-[112px] justify-center gap-2">
                        <div className="h-9 w-9 animate-pulse rounded-full bg-border/40" />
                        <div className="h-9 w-9 animate-pulse rounded-full bg-border/40" />
                        <div className="h-9 w-9 animate-pulse rounded-full bg-border/40" />
                      </div>
                    </td>
                  </tr>
                ))
              : null}

            {showEmpty ? (
              <tr>
                <td colSpan={11} className="px-6 py-12 text-center text-sm text-muted">
                  Tidak ada data hutang sesuai filter.
                </td>
              </tr>
            ) : null}

            {!showEmpty &&
              items.map((debt) => {
                const statusClass = STATUS_STYLE[debt.status] ?? '';
                const showDueBadge = isDueSoon(debt);
                return (
                  <tr
                    key={debt.id}
                    className="bg-transparent transition-colors hover:bg-muted/40"
                  >
                    <td className="px-4 py-4 text-center align-middle">
                      <span
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft/40 text-xs font-bold text-text"
                        title={TYPE_TITLE[debt.type]}
                      >
                        {TYPE_LABEL[debt.type]}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <p className="truncate font-medium text-text" title={debt.party_name}>
                        {debt.party_name}
                      </p>
                      {debt.notes ? (
                        <p className="truncate text-xs text-muted" title={debt.notes}>
                          {debt.notes}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <span className="line-clamp-2 font-medium text-text" title={debt.title}>
                        {debt.title}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-middle text-sm text-text/80 whitespace-nowrap">
                      {formatDate(debt.date)}
                    </td>
                    <td className="px-4 py-4 align-middle text-sm text-text/80">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate">{formatDate(debt.due_date)}</span>
                        {showDueBadge ? (
                          <span className="inline-flex items-center rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-300">
                            Jatuh tempo
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-middle text-sm text-text/80">
                      {typeof debt.rate_percent === 'number' && Number.isFinite(debt.rate_percent)
                        ? `${debt.rate_percent.toFixed(2)}%`
                        : '-'}
                    </td>
                    <td className="px-4 py-4 text-right align-middle font-semibold tabular-nums text-text">
                      {formatCurrency(debt.amount)}
                    </td>
                    <td className="px-4 py-4 text-right align-middle tabular-nums text-text/80">
                      {formatCurrency(debt.paid_total)}
                    </td>
                    <td className="px-4 py-4 text-right align-middle font-semibold tabular-nums text-text">
                      {formatCurrency(debt.remaining)}
                    </td>
                    <td className="px-4 py-4 text-center align-middle">
                      <span
                        className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusClass}`}
                      >
                        {debt.status === 'ongoing'
                          ? 'Berjalan'
                          : debt.status === 'paid'
                          ? 'Lunas'
                          : 'Jatuh Tempo'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center align-middle">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => onAddPayment(debt)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-1 text-text transition hover:bg-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
                          aria-label="Catat pembayaran"
                        >
                          <Wallet className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEdit(debt)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-1 text-text transition hover:bg-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
                          aria-label="Ubah hutang"
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(debt)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-1 text-danger transition hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
                          aria-label="Hapus hutang"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

            {items.length > 0 && loading ? (
              <tr>
                <td colSpan={11} className="px-4 py-4">
                  <div className="flex items-center justify-center gap-2 text-xs text-muted">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Memuat data hutang…
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
