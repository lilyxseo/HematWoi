import { ChevronLeft, ChevronRight, Loader2, Pencil, Trash2, Wallet } from 'lucide-react';
import type { DebtRecord } from '../../lib/api-debts';

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
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

const TYPE_NAME: Record<DebtRecord['type'], string> = {
  debt: 'Hutang',
  receivable: 'Piutang',
};

const STATUS_LABEL: Record<DebtRecord['status'], string> = {
  ongoing: 'Berjalan',
  paid: 'Lunas',
  overdue: 'Jatuh Tempo',
};

const STATUS_STYLE: Record<DebtRecord['status'], string> = {
  ongoing: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30',
  paid: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30',
  overdue: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30',
};

interface DebtsTableResponsiveProps {
  debts: DebtRecord[];
  loading?: boolean;
  onEdit: (debt: DebtRecord) => void;
  onDelete: (debt: DebtRecord) => void;
  onAddPayment: (debt: DebtRecord) => void;
  tenorNavigation?: Record<
    string,
    { key: string; hasPrev: boolean; hasNext: boolean; currentIndex: number; total: number }
  >;
  onNavigateTenor?: (seriesKey: string, direction: 1 | -1) => void;
}

function formatCurrency(value: number) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return `${percentFormatter.format(value)}%`;
}

function formatDate(value: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return dateFormatter.format(date);
}

function isOverdue(debt: DebtRecord) {
  if (!debt.due_date) return false;
  if (debt.status === 'paid') return false;
  const due = new Date(debt.due_date);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}

function formatTenor(debt: DebtRecord) {
  const total = Math.max(1, Math.floor(debt.tenor_months || 1));
  const current = Math.max(1, Math.min(Math.floor(debt.tenor_sequence || 1), total));
  return `${current}/${total}`;
}

export default function DebtsTableResponsive({
  debts,
  loading,
  onEdit,
  onDelete,
  onAddPayment,
  tenorNavigation,
  onNavigateTenor,
}: DebtsTableResponsiveProps) {
  const showSkeleton = Boolean(loading && debts.length === 0);
  const showEmpty = Boolean(!loading && debts.length === 0);

  const renderStatusChip = (status: DebtRecord['status']) => {
    const style = STATUS_STYLE[status] ?? '';
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${style}`}
      >
        {STATUS_LABEL[status] ?? status}
      </span>
    );
  };

  const renderTypeChip = (type: DebtRecord['type']) => (
    <span
      className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase text-primary-200 ring-1 ring-primary/20"
      title={TYPE_TITLE[type]}
    >
      {TYPE_LABEL[type]}
    </span>
  );

  return (
    <div className="space-y-4">
      {showSkeleton ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              // eslint-disable-next-line react/no-array-index-key
              key={`debt-card-skeleton-${index}`}
              className="rounded-3xl border border-border/70 bg-surface-1/60 p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="h-6 w-6 animate-pulse rounded-full bg-border/40" />
                <div className="h-5 w-20 animate-pulse rounded-full bg-border/40" />
              </div>
              <div className="mt-4 h-4 w-3/4 animate-pulse rounded bg-border/40" />
              <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-border/30" />
              <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="h-3 w-20 animate-pulse rounded bg-border/30" />
                    <div className="h-3 w-28 animate-pulse rounded bg-border/30" />
                  </div>
                  <div className="space-y-1">
                    <div className="h-3 w-16 animate-pulse rounded bg-border/30" />
                    <div className="h-3 w-24 animate-pulse rounded bg-border/30" />
                  </div>
                </div>
                <div className="space-y-3 text-right">
                  <div className="h-3 w-24 animate-pulse rounded bg-border/30 ml-auto" />
                  <div className="h-3 w-24 animate-pulse rounded bg-border/30 ml-auto" />
                  <div className="h-3 w-24 animate-pulse rounded bg-border/30 ml-auto" />
                </div>
              </div>
              <div className="mt-5 h-2 w-full animate-pulse rounded-full bg-border/30" />
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <div className="h-10 flex-1 min-w-[140px] animate-pulse rounded-xl bg-border/30" />
                <div className="h-10 flex-1 min-w-[120px] animate-pulse rounded-xl bg-border/30" />
                <div className="h-10 w-10 animate-pulse rounded-full bg-border/30" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {showEmpty ? (
        <div className="rounded-3xl border border-dashed border-border/70 bg-surface-1/70 px-6 py-10 text-center text-sm text-muted-foreground">
          Tidak ada data hutang sesuai filter.
        </div>
      ) : null}

      {!showEmpty ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {debts.map((debt) => {
            const overdue = isOverdue(debt);
            const navigation = tenorNavigation?.[debt.id];
            const statusStyle = STATUS_STYLE[debt.status] ?? '';
            const progressPercent = debt.amount > 0 ? Math.max(0, Math.min(100, (debt.paid_total / debt.amount) * 100)) : 0;
            const progressDisplay = Number.isFinite(progressPercent)
              ? Number.parseFloat(progressPercent.toFixed(1))
              : 0;

            return (
              <article
                key={debt.id}
                className="group flex h-full flex-col justify-between rounded-3xl border border-border bg-card/80 p-5 shadow-sm transition hover:border-brand/40 hover:shadow-lg"
              >
                <div className="space-y-5">
                  <header className="flex items-start justify-between gap-3">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {renderTypeChip(debt.type)}
                        {renderStatusChip(debt.status)}
                        {overdue ? (
                          <span className="inline-flex items-center rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-300 ring-1 ring-rose-500/30">
                            Jatuh tempo
                          </span>
                        ) : null}
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-lg font-semibold text-foreground" title={debt.title}>
                          {debt.title}
                        </h3>
                        <p className="text-sm text-muted-foreground" title={debt.party_name}>
                          {debt.party_name}
                        </p>
                      </div>
                      {debt.notes ? (
                        <p className="text-xs leading-relaxed text-muted-foreground/80" title={debt.notes}>
                          {debt.notes}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-col items-end gap-1 text-right text-xs text-muted-foreground">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">Tenor</span>
                      <div className="flex items-center gap-1">
                        {debt.tenor_months > 1 && navigation ? (
                          <>
                            <button
                              type="button"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label="Lihat tenor sebelumnya"
                              onClick={() => navigation.hasPrev && onNavigateTenor?.(navigation.key, -1)}
                              disabled={!navigation.hasPrev}
                            >
                              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <span className="text-sm font-semibold text-foreground">{formatTenor(debt)}</span>
                            <button
                              type="button"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label="Lihat tenor selanjutnya"
                              onClick={() => navigation.hasNext && onNavigateTenor?.(navigation.key, 1)}
                              disabled={!navigation.hasNext}
                            >
                              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </>
                        ) : (
                          <span className="text-sm font-semibold text-foreground">{formatTenor(debt)}</span>
                        )}
                      </div>
                    </div>
                  </header>

                  <dl className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                          Jatuh Tempo
                        </dt>
                        <dd className={`text-sm font-medium ${overdue ? 'text-rose-300' : 'text-foreground'}`}>
                          {formatDate(debt.due_date)}
                        </dd>
                      </div>
                      <div className="space-y-1">
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                          Bunga
                        </dt>
                        <dd className="text-sm font-medium text-foreground tabular-nums">
                          {formatPercent(debt.rate_percent)}
                        </dd>
                      </div>
                    </div>
                    <div className="space-y-3 text-right">
                      <div className="space-y-1">
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                          Jumlah
                        </dt>
                        <dd className="text-sm font-semibold text-foreground tabular-nums">
                          {formatCurrency(debt.amount)}
                        </dd>
                      </div>
                      <div className="space-y-1">
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                          Terbayar
                        </dt>
                        <dd className="text-sm text-muted-foreground tabular-nums">
                          {formatCurrency(debt.paid_total)}
                        </dd>
                      </div>
                      <div className="space-y-1">
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                          Sisa
                        </dt>
                        <dd className="text-sm font-semibold text-foreground tabular-nums">
                          {formatCurrency(debt.remaining)}
                        </dd>
                      </div>
                    </div>
                  </dl>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Progres pembayaran</span>
                      <span className="font-semibold text-foreground">{formatPercent(progressDisplay)}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-border/50">
                      <div
                        className="h-full rounded-full bg-brand transition-all"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                <footer className="mt-6 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onAddPayment(debt)}
                    className="inline-flex min-w-[160px] flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground shadow-sm transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
                    aria-label="Catat pembayaran"
                  >
                    <Wallet className="h-4 w-4" aria-hidden="true" />
                    Catat pembayaran
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(debt)}
                    className="inline-flex min-w-[140px] flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
                    aria-label="Ubah hutang"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(debt)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-danger transition hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
                    aria-label="Hapus hutang"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      ) : null}

      {debts.length > 0 && loading ? (
        <div className="flex items-center justify-center gap-2 rounded-3xl border border-border bg-card/70 px-4 py-3 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Memuat data hutang…
        </div>
      ) : null}
    </div>
  );
}
