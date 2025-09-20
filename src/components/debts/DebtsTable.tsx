import { Pencil, Wallet, Trash2 } from 'lucide-react';
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
  return (
    <div className="-mx-3 overflow-x-auto px-3 md:mx-0 md:px-0">
      <table className="w-full min-w-[960px] table-auto border-separate border-spacing-0 text-left text-sm md:table-fixed">
        <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur">
          <tr className="text-xs font-semibold uppercase tracking-wide text-muted">
            <th scope="col" className="p-3 text-center">Tipe</th>
            <th scope="col" className="p-3">Pihak</th>
            <th scope="col" className="p-3">Judul</th>
            <th scope="col" className="p-3">Tanggal</th>
            <th scope="col" className="p-3">Jatuh Tempo</th>
            <th scope="col" className="p-3">Bunga %</th>
            <th scope="col" className="p-3 text-right">Jumlah</th>
            <th scope="col" className="p-3 text-right">Terbayar</th>
            <th scope="col" className="p-3 text-right">Sisa</th>
            <th scope="col" className="p-3 text-center">Status</th>
            <th scope="col" className="p-3 text-center">Aksi</th>
          </tr>
        </thead>
        <tbody className="bg-surface-1/80">
          {loading ? (
            <tr>
              <td colSpan={11} className="p-6 text-center text-sm text-muted">
                Memuat data hutang…
              </td>
            </tr>
          ) : null}
          {!loading && items.length === 0 ? (
            <tr>
              <td colSpan={11} className="p-6 text-center text-sm text-muted">
                Tidak ada data hutang sesuai filter.
              </td>
            </tr>
          ) : null}
          {!loading &&
            items.map((debt) => {
              const statusClass = STATUS_STYLE[debt.status] ?? '';
              const showDueBadge = isDueSoon(debt);
              return (
                <tr
                  key={debt.id}
                  className="odd:bg-muted/30 even:bg-surface-1/80 transition-colors hover:bg-muted/50"
                >
                  <td className="p-3 text-center align-middle">
                    <span
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft/40 text-xs font-bold text-text"
                      title={TYPE_TITLE[debt.type]}
                    >
                      {TYPE_LABEL[debt.type]}
                    </span>
                  </td>
                  <td className="max-w-[180px] p-3 align-middle">
                    <p className="truncate font-medium text-text" title={debt.party_name}>
                      {debt.party_name}
                    </p>
                    {debt.notes ? (
                      <p className="truncate text-xs text-muted" title={debt.notes}>
                        {debt.notes}
                      </p>
                    ) : null}
                  </td>
                  <td className="max-w-[220px] p-3 align-middle">
                    <span className="line-clamp-2 font-medium text-text" title={debt.title}>
                      {debt.title}
                    </span>
                  </td>
                  <td className="p-3 align-middle text-sm text-text/80 whitespace-nowrap">
                    {formatDate(debt.date)}
                  </td>
                  <td className="p-3 align-middle text-sm text-text/80">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate">{formatDate(debt.due_date)}</span>
                      {showDueBadge ? (
                        <span className="inline-flex items-center rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-300">
                          Jatuh tempo
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="p-3 align-middle text-sm text-text/80">
                    {typeof debt.rate_percent === 'number' && Number.isFinite(debt.rate_percent)
                      ? `${debt.rate_percent.toFixed(2)}%`
                      : '-'}
                  </td>
                  <td className="p-3 text-right align-middle font-semibold tabular-nums text-text">
                    {formatCurrency(debt.amount)}
                  </td>
                  <td className="p-3 text-right align-middle tabular-nums text-text/80">
                    {formatCurrency(debt.paid_total)}
                  </td>
                  <td className="p-3 text-right align-middle font-semibold tabular-nums text-text">
                    {formatCurrency(debt.remaining)}
                  </td>
                  <td className="p-3 text-center align-middle">
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
                  <td className="p-3 text-center align-middle">
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
        </tbody>
      </table>
    </div>
  );
}
