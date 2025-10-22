import clsx from 'clsx';
import { CalendarClock, ChevronLeft, ChevronRight, Loader2, NotebookPen, Pencil, Trash2, Wallet } from 'lucide-react';
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
  debt: 'Hutang',
  receivable: 'Piutang',
};

const STATUS_CONFIG: Record<
  DebtRecord['status'],
  {
    label: string;
    badgeClass: string;
    accent: string;
    glow: string;
  }
> = {
  ongoing: {
    label: 'Berjalan',
    badgeClass: 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30',
    accent: 'from-amber-500/15 via-surface/80 to-surface/80',
    glow: 'rgba(251,191,36,0.35)',
  },
  paid: {
    label: 'Lunas',
    badgeClass: 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30',
    accent: 'from-emerald-500/15 via-surface/80 to-surface/80',
    glow: 'rgba(52,211,153,0.35)',
  },
  overdue: {
    label: 'Jatuh Tempo',
    badgeClass: 'bg-rose-500/15 text-rose-200 ring-1 ring-rose-500/30',
    accent: 'from-rose-500/20 via-surface/80 to-surface/80',
    glow: 'rgba(244,63,94,0.35)',
  },
};

interface DebtsGridProps {
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

const GRID_CLASS =
  'grid grid-cols-1 gap-4 md:grid-cols-2 xl:gap-6 xl:[grid-template-columns:repeat(auto-fit,minmax(340px,1fr))]';

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

function getProgressColor(progress: number) {
  if (progress <= 0.5) return 'linear-gradient(90deg, rgba(59,130,246,0.7), rgba(129,140,248,0.7))';
  if (progress <= 0.75) return 'linear-gradient(90deg, rgba(56,189,248,0.7), rgba(34,211,238,0.7))';
  if (progress <= 1) return 'linear-gradient(90deg, rgba(16,185,129,0.75), rgba(52,211,153,0.75))';
  return 'linear-gradient(90deg, rgba(244,63,94,0.8), rgba(251,113,133,0.8))';
}

function LoadingState() {
  return (
    <div className={GRID_CLASS}>
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={`debt-card-skeleton-${index}`}
          className="relative flex h-full flex-col gap-5 overflow-hidden rounded-3xl border border-dashed border-border/60 bg-surface/60 p-5 shadow-[0_24px_45px_-28px_rgba(15,23,42,0.35)]"
        >
          <div className="space-y-3">
            <div className="h-4 w-1/2 animate-pulse rounded-full bg-border/40" />
            <div className="h-3 w-2/3 animate-pulse rounded-full bg-border/30" />
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-3">
              <div className="h-3 w-24 animate-pulse rounded-full bg-border/30" />
              <div className="h-3 w-20 animate-pulse rounded-full bg-border/30" />
              <div className="h-3 w-28 animate-pulse rounded-full bg-border/30" />
            </div>
            <div className="space-y-3">
              <div className="h-3 w-24 animate-pulse rounded-full bg-border/30" />
              <div className="h-3 w-20 animate-pulse rounded-full bg-border/30" />
              <div className="h-3 w-28 animate-pulse rounded-full bg-border/30" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="h-2 w-full animate-pulse rounded-full bg-border/30" />
            <div className="h-2 w-5/6 animate-pulse rounded-full bg-border/30" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="h-10 flex-1 animate-pulse rounded-2xl bg-border/40" />
            <div className="h-10 flex-1 animate-pulse rounded-2xl bg-border/40" />
            <div className="h-10 w-10 animate-pulse rounded-full bg-border/40" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-border/60 bg-surface/70 p-10 text-center text-sm text-muted shadow-inner">
      <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">✨</span>
      <p className="text-base font-semibold text-text">Tidak ada data hutang sesuai filter.</p>
      <p className="mt-2 text-sm text-muted">
        Tambah hutang atau ubah filter untuk melihat daftar hutang dan piutang Anda.
      </p>
    </div>
  );
}

export default function DebtsGrid({
  debts,
  loading,
  onEdit,
  onDelete,
  onAddPayment,
  tenorNavigation,
  onNavigateTenor,
}: DebtsGridProps) {
  if (loading && debts.length === 0) {
    return <LoadingState />;
  }

  if (!loading && debts.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-4">
      <div className={GRID_CLASS}>
        {debts.map((debt) => {
          const statusConfig = STATUS_CONFIG[debt.status];
          const overdue = isOverdue(debt);
          const progress = debt.amount > 0 ? Math.min(Math.max(debt.paid_total / debt.amount, 0), 2) : 0;
          const cappedProgress = Math.min(progress, 1);
          const progressPercent = Math.round(cappedProgress * 100);
          const remaining = Number.isFinite(debt.remaining) ? debt.remaining : 0;
          const navigation = tenorNavigation?.[debt.id];
          const progressColor = getProgressColor(progress);
          const notes = debt.notes?.trim();

          return (
            <article
              key={debt.id}
              className={clsx(
                'relative flex h-full flex-col gap-6 overflow-hidden rounded-3xl border border-border/60 bg-surface/80 p-6 shadow-[0_30px_60px_-36px_rgba(15,23,42,0.55)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_40px_80px_-48px_rgba(15,23,42,0.65)] backdrop-blur supports-[backdrop-filter]:bg-surface/60',
                statusConfig ? `bg-gradient-to-br ${statusConfig.accent}` : null,
              )}
            >
              {statusConfig ? (
                <div
                  aria-hidden="true"
                  className={clsx(
                    'pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full blur-3xl',
                  )}
                  style={{
                    background: `radial-gradient(circle at center, ${statusConfig.glow} 0%, rgba(59,130,246,0.05) 55%, rgba(255,255,255,0) 75%)`,
                  }}
                />
              ) : null}

              <header className="relative z-10 space-y-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted">
                        {TYPE_LABEL[debt.type] ?? debt.type}
                      </span>
                      {statusConfig ? (
                        <span
                          className={clsx(
                            'inline-flex items-center rounded-full px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-wide shadow-sm backdrop-blur',
                            statusConfig.badgeClass,
                          )}
                        >
                          {statusConfig.label}
                        </span>
                      ) : null}
                      {overdue ? (
                        <span className="inline-flex items-center rounded-full bg-rose-500/20 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-wide text-rose-200 shadow-sm">
                          Jatuh tempo
                        </span>
                      ) : null}
                    </div>
                    <h3 className="text-xl font-semibold text-text dark:text-white">{debt.party_name || 'Tanpa nama'}</h3>
                    <p className="max-w-prose text-sm text-muted line-clamp-2" title={debt.title}>
                      {debt.title || 'Tidak ada judul'}
                    </p>
                  </div>
                  <div className="flex flex-col items-start gap-2 text-sm text-muted lg:items-end lg:text-right">
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <div className="inline-flex items-center gap-2 rounded-2xl border border-border/60 bg-surface/70 px-3 py-1.5 shadow-inner">
                        <CalendarClock className="h-4 w-4 text-muted" aria-hidden="true" />
                        <span className={clsx('text-sm font-semibold', overdue ? 'text-rose-200' : 'text-text')}>
                          {formatDate(debt.due_date)}
                        </span>
                      </div>
                      <span className="text-xs uppercase tracking-wide text-muted/80">Tenor {formatTenor(debt)}</span>
                    </div>
                  </div>
                </div>
              </header>

              <div className="relative z-10 flex flex-col gap-6 text-sm text-muted lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-6 lg:flex-1">
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-wide text-muted/70">Bunga</p>
                    <p className="text-base font-medium text-text">{formatPercent(debt.rate_percent)}</p>
                  </div>
                  {navigation && debt.tenor_months > 1 ? (
                    <div className="space-y-2">
                      <p className="text-[11px] uppercase tracking-wide text-muted/70">Navigasi tenor</p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => navigation.hasPrev && onNavigateTenor?.(navigation.key, -1)}
                          disabled={!navigation.hasPrev}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-surface/70 text-muted transition hover:-translate-y-0.5 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Lihat tenor sebelumnya"
                        >
                          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <div className="inline-flex items-center gap-2 rounded-2xl border border-border/60 bg-surface/70 px-3 py-1.5 text-sm font-semibold text-text shadow-inner">
                          {formatTenor(debt)}
                        </div>
                        <button
                          type="button"
                          onClick={() => navigation.hasNext && onNavigateTenor?.(navigation.key, 1)}
                          disabled={!navigation.hasNext}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-surface/70 text-muted transition hover:-translate-y-0.5 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Lihat tenor selanjutnya"
                        >
                          <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {notes ? (
                    <div className="space-y-2 rounded-2xl border border-border/60 bg-surface/70 p-4 text-sm text-muted">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted/80">
                        <NotebookPen className="h-4 w-4" /> Catatan
                      </div>
                      <p className="text-sm leading-relaxed text-text/80">{notes}</p>
                    </div>
                  ) : null}
                  <div className="space-y-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted/70">Progress pembayaran</p>
                    <div className="flex items-center justify-between text-sm text-muted/80">
                      <span>Progress</span>
                      <span className="font-semibold text-text">{progressPercent}%</span>
                    </div>
                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted/20">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{
                          width: `${Math.min(progressPercent, 100)}%`,
                          background: progressColor,
                        }}
                      />
                    </div>
                    {progress > 1 ? (
                      <p className="text-xs font-medium text-emerald-300">
                        Pembayaran melebihi jumlah hutang sebesar {formatCurrency(debt.paid_total - debt.amount)}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-4 rounded-2xl border border-border/60 bg-surface/70 p-4 text-center text-xs uppercase tracking-wide text-muted/70 lg:max-w-xs">
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-[11px] uppercase tracking-wide text-muted/70">Jumlah</p>
                    <p className="text-base font-semibold text-text tabular-nums">{formatCurrency(debt.amount)}</p>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-[11px] uppercase tracking-wide text-muted/70">Terbayar</p>
                    <p className="text-base font-medium text-muted tabular-nums">{formatCurrency(debt.paid_total)}</p>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-[11px] uppercase tracking-wide text-muted/70">Sisa</p>
                    <p className="text-base font-semibold text-text tabular-nums">{formatCurrency(remaining)}</p>
                  </div>
                </div>
              </div>

              <footer className="relative z-10 flex flex-col gap-3 sm:flex-col sm:gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex w-full flex-col gap-3 md:flex-row md:gap-2 lg:flex-1">
                  <button
                    type="button"
                    onClick={() => onAddPayment(debt)}
                    className="inline-flex w-full flex-1 items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
                    aria-label="Catat pembayaran"
                  >
                    <Wallet className="h-4 w-4" aria-hidden="true" />
                    Catat pembayaran
                  </button>
                </div>
                <div className="flex w-full flex-col gap-3 md:flex-row md:items-stretch md:justify-end md:gap-2 lg:w-auto lg:items-center">
                  <button
                    type="button"
                    onClick={() => onEdit(debt)}
                    className="inline-flex w-full min-w-[150px] flex-1 items-center justify-center gap-2 rounded-2xl border border-border/60 bg-surface/70 px-4 py-2.5 text-sm font-semibold text-text transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                    aria-label="Ubah hutang"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Edit data
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(debt)}
                    className="inline-flex h-11 w-full flex-shrink-0 items-center justify-center rounded-full border border-border/60 bg-surface/70 text-rose-300 transition hover:-translate-y-0.5 hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60 md:h-11 md:w-11"
                    aria-label="Hapus hutang"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </footer>
            </article>
          );
        })}
      </div>

      {loading && debts.length > 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-3xl border border-border/60 bg-surface/70 px-4 py-3 text-xs text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Memuat data hutang…
        </div>
      ) : null}
    </div>
  );
}
