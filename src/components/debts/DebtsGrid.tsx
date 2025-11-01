import clsx from 'clsx';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MoreVertical,
  NotebookPen,
  Pencil,
  Trash2,
  Wallet,
} from 'lucide-react';
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
    pillClass: string;
  }
> = {
  ongoing: {
    label: 'Berjalan',
    pillClass: 'bg-amber-900/30 text-amber-300 ring-1 ring-amber-700/40',
  },
  paid: {
    label: 'Lunas',
    pillClass: 'bg-emerald-900/30 text-emerald-200 ring-1 ring-emerald-700/40',
  },
  overdue: {
    label: 'Jatuh Tempo',
    pillClass: 'bg-rose-900/30 text-rose-200 ring-1 ring-rose-700/40',
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

          const partyName = debt.party_name?.trim() || '';
          const title = debt.title?.trim() || '';
          const displayName = partyName || title || 'Tanpa nama';
          const description = title && title !== displayName ? title : notes || TYPE_LABEL[debt.type] || '';
          const isPaid = debt.status === 'paid';
          const payDisabled = isPaid;
          const payLabel = debt.type === 'receivable' ? (isPaid ? 'Catat lagi' : 'Terima') : isPaid ? 'Catat lagi' : 'Bayar';
          const payAriaLabel = debt.type === 'receivable' ? 'Terima pembayaran' : 'Bayar hutang';
          const remainingValueClass = clsx(
            'font-mono text-sm md:text-base font-semibold',
            progressPercent > 90 && progress <= 1 ? 'text-amber-300' : 'text-slate-100',
          );
          const actionButtons = (
            <>
              <button
                type="button"
                onClick={() => {
                  if (!payDisabled) onAddPayment(debt);
                }}
                disabled={payDisabled}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60 md:h-12"
                aria-label={payAriaLabel}
              >
                <Wallet className="h-4 w-4" aria-hidden="true" />
                {payLabel}
              </button>
              <button
                type="button"
                onClick={() => onEdit(debt)}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-slate-200 ring-1 ring-slate-800 transition hover:bg-slate-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                aria-label="Ubah hutang"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit data
              </button>
              <button
                type="button"
                onClick={() => onDelete(debt)}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-rose-300 ring-1 ring-slate-800 transition hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                aria-label="Hapus hutang"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Hapus
              </button>
            </>
          );

          return (
            <article
              key={debt.id}
              className={clsx(
                'relative flex min-w-0 flex-col gap-2.5 rounded-2xl bg-slate-900/60 p-4 text-sm text-slate-300 ring-1 ring-slate-800 md:grid md:grid-cols-[1fr,260px] md:gap-5 md:p-5 md:text-base',
              )}
            >
              <div className="flex min-w-0 flex-col gap-3">
                <header className="flex flex-col gap-2 text-sm md:text-base">
                  <div className="flex min-w-0 items-center gap-2">
                    {statusConfig ? (
                      <span
                        className={clsx(
                          'inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
                          statusConfig.pillClass,
                        )}
                      >
                        {statusConfig.label}
                      </span>
                    ) : null}
                    <h3 className="min-w-0 flex-1 truncate text-base font-semibold text-slate-100 md:text-lg" title={displayName}>
                      {displayName}
                    </h3>
                    <button
                      type="button"
                      onClick={() => onEdit(debt)}
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                      aria-label="Buka opsi hutang"
                    >
                      <MoreVertical className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 md:text-sm">
                    {description ? (
                      <span className="min-w-0 flex-1 truncate" title={description}>
                        {description}
                      </span>
                    ) : null}
                    <span className={clsx('flex items-center gap-1', overdue ? 'text-rose-300' : 'text-slate-400')}>
                      <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                      {formatDate(debt.due_date)}
                    </span>
                    <span className="text-slate-400">Tenor {formatTenor(debt)}</span>
                  </div>
                </header>

                <div className="grid grid-cols-3 gap-2 md:gap-3">
                  <div className="rounded-xl bg-slate-800/50 p-3 text-center">
                    <p className="text-[11px] uppercase text-slate-400">Jumlah</p>
                    <p className="font-mono text-sm text-slate-100 md:text-base">{formatCurrency(debt.amount)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-800/50 p-3 text-center">
                    <p className="text-[11px] uppercase text-slate-400">Terbayar</p>
                    <p className="font-mono text-sm text-slate-200 md:text-base">{formatCurrency(debt.paid_total)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-800/50 p-3 text-center">
                    <p className="text-[11px] uppercase text-slate-400">Sisa</p>
                    <p className={remainingValueClass}>{formatCurrency(remaining)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        width: `${Math.min(progressPercent, 100)}%`,
                        background: progressColor,
                      }}
                    />
                  </div>
                  <span className="text-xs text-slate-400">{progressPercent}%</span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 md:text-sm">
                  {typeof debt.rate_percent === 'number' && Math.abs(debt.rate_percent) > 0 ? (
                    <span className="inline-flex items-center gap-2 rounded-xl bg-slate-800/50 px-2.5 py-1 font-medium text-slate-100">
                      Bunga {formatPercent(debt.rate_percent)}
                    </span>
                  ) : (
                    <span className="text-slate-500">Tanpa bunga</span>
                  )}
                  {navigation && debt.tenor_months > 1 ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => navigation.hasPrev && onNavigateTenor?.(navigation.key, -1)}
                        disabled={!navigation.hasPrev}
                        className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-300 ring-1 ring-slate-800 transition hover:bg-slate-800/60 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Lihat tenor sebelumnya"
                      >
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <span className="rounded-xl bg-slate-800/40 px-2.5 py-1 font-semibold text-slate-100">
                        Tenor {formatTenor(debt)}
                      </span>
                      <button
                        type="button"
                        onClick={() => navigation.hasNext && onNavigateTenor?.(navigation.key, 1)}
                        disabled={!navigation.hasNext}
                        className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-300 ring-1 ring-slate-800 transition hover:bg-slate-800/60 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Lihat tenor selanjutnya"
                      >
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-slate-500">Tenor tunggal</span>
                  )}
                </div>

                {notes ? (
                  <div className="flex items-start gap-2 rounded-xl bg-slate-800/30 px-3 py-2 text-xs text-slate-300">
                    <NotebookPen className="mt-0.5 h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                    <p className="min-w-0 flex-1 text-left leading-relaxed line-clamp-2" title={notes}>
                      {notes}
                    </p>
                  </div>
                ) : null}

                {progress > 1 ? (
                  <p className="text-xs font-medium text-emerald-300">
                    Pembayaran melebihi jumlah hutang sebesar {formatCurrency(debt.paid_total - debt.amount)}
                  </p>
                ) : null}

                <div className="sticky bottom-4 z-20 flex flex-col gap-2.5 rounded-2xl bg-slate-900/90 p-3 shadow-[0_16px_36px_rgba(8,15,32,0.55)] backdrop-blur-sm md:hidden">
                  {actionButtons}
                </div>
              </div>

              <aside className="hidden md:flex md:flex-col md:gap-3">
                <div className="sticky top-4 flex flex-col gap-2.5 rounded-2xl bg-slate-900/70 p-4 ring-1 ring-slate-800/80">
                  {actionButtons}
                </div>
              </aside>
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
