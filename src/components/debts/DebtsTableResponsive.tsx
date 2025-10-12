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

const TYPE_NAME: Record<DebtRecord['type'], string> = {
  debt: 'Hutang',
  receivable: 'Piutang',
};

const TYPE_STYLE: Record<DebtRecord['type'], string> = {
  debt: 'bg-rose-500/10 text-rose-200 ring-1 ring-rose-500/30',
  receivable: 'bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/30',
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

function formatDate(value: string | null | undefined) {
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
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${style}`}>
        {STATUS_LABEL[status] ?? status}
      </span>
    );
  };

  return (
    <div className="min-w-0 space-y-4">
      {showSkeleton ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`debt-card-skeleton-${index}`}
              className="rounded-3xl border border-border/60 bg-surface-1/60 p-5 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="h-11 w-11 animate-pulse rounded-2xl bg-border/40" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-36 animate-pulse rounded bg-border/40" />
                  <div className="h-3 w-48 animate-pulse rounded bg-border/30" />
                  <div className="h-3 w-28 animate-pulse rounded bg-border/20" />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="h-3 w-20 animate-pulse rounded bg-border/30" />
                    <div className="h-3 w-28 animate-pulse rounded bg-border/30" />
                  </div>
                  <div className="space-y-1">
                    <div className="h-3 w-16 animate-pulse rounded bg-border/30" />
                    <div className="h-3 w-20 animate-pulse rounded bg-border/30" />
                  </div>
                  <div className="space-y-1">
                    <div className="h-3 w-14 animate-pulse rounded bg-border/30" />
                    <div className="h-3 w-16 animate-pulse rounded bg-border/30" />
                  </div>
                </div>
                <div className="space-y-3 text-right">
                  <div className="space-y-1">
                    <div className="ml-auto h-3 w-24 animate-pulse rounded bg-border/30" />
                    <div className="ml-auto h-3 w-20 animate-pulse rounded bg-border/30" />
                  </div>
                  <div className="space-y-1">
                    <div className="ml-auto h-3 w-24 animate-pulse rounded bg-border/30" />
                    <div className="ml-auto h-3 w-20 animate-pulse rounded bg-border/30" />
                  </div>
                  <div className="space-y-1">
                    <div className="ml-auto h-3 w-24 animate-pulse rounded bg-border/30" />
                    <div className="ml-auto h-3 w-20 animate-pulse rounded bg-border/30" />
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <div className="h-10 flex-1 animate-pulse rounded-2xl bg-border/40" />
                <div className="h-10 flex-1 animate-pulse rounded-2xl bg-border/40" />
                <div className="h-10 w-10 animate-pulse rounded-full bg-border/40" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {showEmpty ? (
        <div className="rounded-3xl border border-dashed border-border/60 bg-surface-1/70 px-6 py-12 text-center text-sm text-muted-foreground">
          Tidak ada data hutang sesuai filter.
        </div>
      ) : null}

      {!showEmpty ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {debts.map((debt) => {
            const overdue = isOverdue(debt);
            const navigation = tenorNavigation?.[debt.id];
            const typeStyle = TYPE_STYLE[debt.type] ?? 'bg-primary/10 text-primary-200 ring-1 ring-primary/20';

            return (
              <article
                key={debt.id}
                className="group relative flex flex-col gap-5 rounded-3xl border border-border/60 bg-surface-1/90 p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg"
              >
                <header className="flex flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl text-sm font-semibold uppercase ${typeStyle}`}
                    >
                      {TYPE_NAME[debt.type].slice(0, 1)}
                      <span className="sr-only">{TYPE_NAME[debt.type]}</span>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p
                        className="line-clamp-2 text-base font-semibold text-foreground"
                        role="heading"
                        aria-level={3}
                        title={debt.title}
                      >
                        {debt.title}
                      </p>
                      <p className="truncate text-sm text-muted-foreground" title={debt.party_name}>
                        {debt.party_name}
                      </p>
                      {debt.notes ? (
                        <p className="line-clamp-2 text-xs text-muted-foreground/80" title={debt.notes}>
                          {debt.notes}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-2 text-right">
                      {renderStatusChip(debt.status)}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="uppercase tracking-wide">Tenor</span>
                        {debt.tenor_months > 1 && navigation ? (
                          <div className="flex items-center gap-1 text-sm font-semibold text-foreground">
                            <button
                              type="button"
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label="Lihat tenor sebelumnya"
                              onClick={() => navigation.hasPrev && onNavigateTenor?.(navigation.key, -1)}
                              disabled={!navigation.hasPrev}
                            >
                              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <span>{formatTenor(debt)}</span>
                            <button
                              type="button"
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label="Lihat tenor selanjutnya"
                              onClick={() => navigation.hasNext && onNavigateTenor?.(navigation.key, 1)}
                              disabled={!navigation.hasNext}
                            >
                              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        ) : (
                          <span className={`text-sm font-semibold ${debt.tenor_months > 1 ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {formatTenor(debt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </header>

                <div className="grid grid-cols-1 gap-4 text-sm text-muted-foreground md:grid-cols-2">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Jatuh tempo</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={`text-sm font-medium ${overdue ? 'text-rose-300' : 'text-foreground'}`}>
                          {formatDate(debt.due_date)}
                        </p>
                        {overdue ? (
                          <span className="inline-flex items-center rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-300 ring-1 ring-rose-500/30">
                            Jatuh tempo
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Bunga</p>
                      <p className="text-sm font-medium text-foreground tabular-nums">{formatPercent(debt.rate_percent)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Tanggal dibuat</p>
                      <p className="text-sm text-muted-foreground">{formatDate(debt.date)}</p>
                    </div>
                  </div>
                  <div className="space-y-3 text-right">
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Jumlah disepakati</p>
                      <p className="text-xl font-semibold text-foreground tabular-nums">
                        {formatCurrency(debt.amount)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Telah dibayar</p>
                      <p className="text-sm text-muted-foreground tabular-nums">
                        {formatCurrency(debt.paid_total)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Sisa nominal</p>
                      <p className="text-lg font-semibold text-foreground tabular-nums">
                        {formatCurrency(debt.remaining)}
                      </p>
                    </div>
                  </div>
                </div>

                <footer className="mt-auto flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onAddPayment(debt)}
                    className="inline-flex w-full min-w-[180px] flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-brand-foreground transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
                    aria-label="Catat pembayaran"
                  >
                    <Wallet className="h-4 w-4" aria-hidden="true" />
                    Catat pembayaran
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(debt)}
                    className="inline-flex w-full min-w-[150px] flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
                    aria-label="Ubah hutang"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(debt)}
                    className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-border bg-card text-danger transition hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
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
        <div className="flex items-center justify-center gap-2 rounded-3xl border border-border/60 bg-surface-1/70 px-4 py-3 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Memuat data hutang…
        </div>
      ) : null}
    </div>
  );
}
