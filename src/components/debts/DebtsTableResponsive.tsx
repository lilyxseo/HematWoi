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

function getProgressPercent(debt: DebtRecord) {
  if (!Number.isFinite(debt.amount) || debt.amount <= 0) return 0;
  const ratio = debt.paid_total / debt.amount;
  if (!Number.isFinite(ratio)) return 0;
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

function getProgressTone(percent: number, status: DebtRecord['status']) {
  if (status === 'paid') return 'bg-emerald-500';
  if (percent >= 85) return 'bg-amber-500';
  if (percent >= 60) return 'bg-[color:var(--brand)]/80';
  return 'bg-[color:var(--brand)]';
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

  return (
    <div className="min-w-0 space-y-4">
      {showSkeleton ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`debt-card-skeleton-${index}`}
              className="rounded-3xl border border-border/60 bg-card/60 p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="h-4 w-32 animate-pulse rounded bg-border/40" />
                <div className="h-5 w-16 animate-pulse rounded-full bg-border/40" />
              </div>
              <div className="mt-3 h-3.5 w-full animate-pulse rounded bg-border/30" />
              <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="h-3 w-20 animate-pulse rounded bg-border/30" />
                    <div className="h-3 w-28 animate-pulse rounded bg-border/30" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-16 animate-pulse rounded bg-border/30" />
                    <div className="h-3 w-24 animate-pulse rounded bg-border/30" />
                  </div>
                  <div className="h-3 w-20 animate-pulse rounded bg-border/30" />
                </div>
                <div className="space-y-3 text-right">
                  <div className="ml-auto h-3 w-24 animate-pulse rounded bg-border/30" />
                  <div className="ml-auto h-3 w-24 animate-pulse rounded bg-border/30" />
                  <div className="ml-auto h-3 w-24 animate-pulse rounded bg-border/30" />
                </div>
              </div>
              <div className="mt-4 h-2 w-full animate-pulse rounded-full bg-border/30" />
              <div className="mt-4 flex flex-wrap gap-2">
                <div className="h-10 min-w-[120px] flex-1 animate-pulse rounded-xl bg-border/30" />
                <div className="h-10 min-w-[120px] flex-1 animate-pulse rounded-xl bg-border/30" />
                <div className="h-10 w-10 animate-pulse rounded-full bg-border/30" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {showEmpty ? (
        <div className="rounded-3xl border border-dashed border-border/70 bg-card/60 p-8 text-center text-sm text-muted-foreground">
          Tidak ada data hutang sesuai filter.
        </div>
      ) : null}

      {!showEmpty ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {debts.map((debt) => {
            const overdue = isOverdue(debt);
            const navigation = tenorNavigation?.[debt.id];
            const statusStyle = STATUS_STYLE[debt.status] ?? '';
            const progressPercent = getProgressPercent(debt);
            const progressTone = getProgressTone(progressPercent, debt.status);

            return (
              <article
                key={debt.id}
                className="flex h-full flex-col justify-between gap-4 rounded-3xl border border-border/70 bg-surface-1/90 p-5 shadow-sm transition hover:border-brand/40 hover:shadow-md"
              >
                <div className="space-y-4">
                  <header className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70">Pihak</p>
                      <h3
                        className="line-clamp-1 text-lg font-semibold leading-tight text-foreground"
                        title={debt.party_name}
                      >
                        {debt.party_name}
                      </h3>
                    </div>
                    <div className="flex flex-col items-end gap-2 text-right">
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-wide text-primary-200 ring-1 ring-primary/20">
                        {TYPE_NAME[debt.type]}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-wide ring-1 ${statusStyle}`}
                      >
                        {STATUS_LABEL[debt.status] ?? debt.status}
                      </span>
                    </div>
                  </header>

                  <div className="space-y-2 text-sm leading-snug text-muted-foreground">
                    <p className="line-clamp-2" title={debt.title}>
                      {debt.title}
                    </p>
                    {debt.notes ? (
                      <p className="line-clamp-2 text-xs leading-snug text-muted-foreground/80" title={debt.notes}>
                        {debt.notes}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-4 text-xs text-muted-foreground sm:grid-cols-2">
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Jatuh tempo</p>
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className={`font-semibold ${overdue ? 'text-rose-300' : 'text-foreground'}`}>
                            {formatDate(debt.due_date)}
                          </span>
                          {overdue ? (
                            <span className="inline-flex items-center rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-300 ring-1 ring-rose-500/30">
                              Jatuh tempo
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Tenor</p>
                        {debt.tenor_months > 1 && navigation ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label="Lihat tenor sebelumnya"
                              onClick={() => navigation.hasPrev && onNavigateTenor?.(navigation.key, -1)}
                              disabled={!navigation.hasPrev}
                            >
                              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <span className="text-sm font-semibold text-foreground">{formatTenor(debt)}</span>
                            <button
                              type="button"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label="Lihat tenor selanjutnya"
                              onClick={() => navigation.hasNext && onNavigateTenor?.(navigation.key, 1)}
                              disabled={!navigation.hasNext}
                            >
                              <ChevronRight className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        ) : (
                          <span className={`text-sm font-semibold ${debt.tenor_months > 1 ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {formatTenor(debt)}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Bunga</p>
                        <span className="text-sm font-medium text-foreground tabular-nums">{formatPercent(debt.rate_percent)}</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1 text-right">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Jumlah</p>
                        <p className="text-base font-semibold text-foreground tabular-nums">{formatCurrency(debt.amount)}</p>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Terbayar</p>
                        <p className="text-sm text-muted-foreground tabular-nums">{formatCurrency(debt.paid_total)}</p>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Sisa</p>
                        <p className="text-base font-semibold text-foreground tabular-nums">{formatCurrency(debt.remaining)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                      <span>Progres pembayaran</span>
                      <span className="tabular-nums text-foreground">{progressPercent}%</span>
                    </div>
                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-border/50">
                      <div
                        className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out ${progressTone}`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                <footer className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onAddPayment(debt)}
                    className="inline-flex w-full min-w-[160px] flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
                    aria-label="Catat pembayaran"
                  >
                    <Wallet className="h-4 w-4" aria-hidden="true" />
                    Catat pembayaran
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(debt)}
                    className="inline-flex w-full min-w-[140px] flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
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
        <div className="flex items-center justify-center gap-2 rounded-3xl border border-border/70 bg-card/70 px-4 py-3 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Memuat data hutang…
        </div>
      ) : null}
    </div>
  );
}
