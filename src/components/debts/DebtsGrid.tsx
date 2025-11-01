import clsx from 'clsx';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Percent,
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
    pillClass: 'bg-emerald-900/30 text-emerald-300 ring-1 ring-emerald-700/40',
  },
  overdue: {
    label: 'Jatuh Tempo',
    pillClass: 'bg-rose-900/40 text-rose-200 ring-1 ring-rose-700/40',
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
  'grid grid-cols-1 gap-3 md:grid-cols-2 xl:gap-5 xl:[grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]';

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
          className="flex h-full flex-col gap-3 rounded-2xl bg-slate-900/40 p-4 ring-1 ring-slate-800"
        >
          <div className="flex flex-col gap-2">
            <div className="h-3 w-28 animate-pulse rounded-full bg-slate-800/60" />
            <div className="h-4 w-2/3 animate-pulse rounded-full bg-slate-800/60" />
            <div className="h-3 w-1/2 animate-pulse rounded-full bg-slate-800/40" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((col) => (
              <div
                // eslint-disable-next-line react/no-array-index-key
                key={`debt-card-skeleton-value-${index}-${String(col)}`}
                className="h-14 rounded-xl bg-slate-800/40"
              />
            ))}
          </div>
          <div className="space-y-2">
            <div className="h-1.5 w-full animate-pulse rounded-full bg-slate-800/40" />
            <div className="h-3 w-16 animate-pulse rounded-full bg-slate-800/50 self-end" />
          </div>
          <div className="mt-auto space-y-2">
            <div className="h-11 w-full animate-pulse rounded-xl bg-slate-800/50" />
            <div className="h-10 w-full animate-pulse rounded-xl bg-slate-800/40" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-slate-800 bg-slate-900/60 p-10 text-center text-sm text-slate-400">
      <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]">✨</span>
      <p className="text-base font-semibold text-slate-100">Tidak ada data hutang sesuai filter.</p>
      <p className="mt-2 text-sm text-slate-400">
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
          const description = debt.party_name?.trim() || 'Tanpa pihak';
          const title = debt.title?.trim() || TYPE_LABEL[debt.type] || 'Tanpa judul';
          const interestValue = typeof debt.rate_percent === 'number' ? debt.rate_percent : null;
          const showInterest = typeof interestValue === 'number' && Math.abs(interestValue) > 0.0001;
          const tenorLabel = `Tenor ${formatTenor(debt)}`;
          const progressWarning = progressPercent > 90 && progress <= 1;
          const payDisabled = debt.status === 'paid';
          const primaryActionLabel = payDisabled
            ? 'Catat lagi'
            : debt.type === 'receivable'
              ? 'Terima'
              : 'Bayar';

          return (
            <article
              key={debt.id}
              className="relative flex h-full min-w-0 flex-col gap-3 overflow-hidden rounded-2xl bg-slate-900/60 p-4 ring-1 ring-slate-800 transition duration-200 hover:ring-[var(--accent)] md:grid md:grid-cols-[1fr,260px] md:gap-5 md:p-5"
            >
              <div className="flex min-w-0 flex-col gap-3 md:gap-4">
                <header className="flex flex-col gap-2">
                  <div className="flex items-start gap-2">
                    {statusConfig ? (
                      <span
                        className={clsx(
                          'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
                          statusConfig.pillClass,
                        )}
                      >
                        {statusConfig.label}
                      </span>
                    ) : null}
                    <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-100 md:text-base" title={title}>
                      {title}
                    </h3>
                    <button
                      type="button"
                      onClick={() => onEdit(debt)}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-300 transition hover:bg-slate-800/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                      aria-label="Edit hutang"
                    >
                      <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 md:text-sm">
                    <span className="max-w-[180px] truncate md:max-w-[240px]" title={description}>
                      {description}
                    </span>
                    <span className={clsx('inline-flex items-center gap-1', overdue ? 'text-rose-300' : undefined)}>
                      <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                      {formatDate(debt.due_date)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-slate-500">{tenorLabel}</span>
                  </div>
                </header>

                <div className="grid grid-cols-3 gap-2 md:gap-3">
                  <div className="min-w-0 rounded-xl bg-slate-800/50 p-3 text-center">
                    <p className="text-[11px] uppercase text-slate-400">Jumlah</p>
                    <p className="font-mono text-sm text-slate-100 md:text-base">{formatCurrency(debt.amount)}</p>
                  </div>
                  <div className="min-w-0 rounded-xl bg-slate-800/50 p-3 text-center">
                    <p className="text-[11px] uppercase text-slate-400">Terbayar</p>
                    <p className="font-mono text-sm text-slate-200 md:text-base">{formatCurrency(debt.paid_total)}</p>
                  </div>
                  <div className="min-w-0 rounded-xl bg-slate-800/50 p-3 text-center">
                    <p className="text-[11px] uppercase text-slate-400">Sisa</p>
                    <p
                      className={clsx(
                        'font-mono text-sm md:text-base',
                        progressWarning ? 'font-semibold text-amber-300' : 'font-semibold text-slate-100',
                      )}
                    >
                      {formatCurrency(remaining)}
                    </p>
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
                {progress > 1 ? (
                  <p className="text-xs font-medium text-emerald-300">
                    Pembayaran melebihi jumlah hutang sebesar {formatCurrency(debt.paid_total - debt.amount)}
                  </p>
                ) : null}

                <div className="flex items-center justify-between gap-3 text-xs text-slate-400 md:text-sm">
                  <span className="inline-flex items-center gap-1 text-slate-300">
                    <Percent className="h-3.5 w-3.5" aria-hidden="true" />
                    {showInterest ? formatPercent(interestValue) : 'Bunga 0%'}
                  </span>
                  <div className="flex items-center gap-2 text-slate-300">
                    {navigation && debt.tenor_months > 1 ? (
                      <>
                        <button
                          type="button"
                          onClick={() => navigation.hasPrev && onNavigateTenor?.(navigation.key, -1)}
                          disabled={!navigation.hasPrev}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-300 ring-1 ring-slate-800 transition hover:bg-slate-800/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Lihat tenor sebelumnya"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <span className="min-w-[60px] text-center font-semibold text-slate-200">{formatTenor(debt)}</span>
                        <button
                          type="button"
                          onClick={() => navigation.hasNext && onNavigateTenor?.(navigation.key, 1)}
                          disabled={!navigation.hasNext}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-300 ring-1 ring-slate-800 transition hover:bg-slate-800/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Lihat tenor selanjutnya"
                        >
                          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </>
                    ) : (
                      <span className="text-slate-400">{tenorLabel}</span>
                    )}
                  </div>
                </div>

                {notes ? (
                  <details className="group rounded-xl bg-slate-800/40 px-3 py-2 text-xs text-slate-300">
                    <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-slate-200">
                      <NotebookPen className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                      Catatan
                      <span className="ml-auto text-[11px] text-slate-500 group-open:hidden">Tap untuk buka</span>
                    </summary>
                    <p className="mt-2 text-[13px] leading-relaxed text-slate-200">{notes}</p>
                  </details>
                ) : null}

                <div className="md:hidden -mx-1 mt-1 pt-1">
                  <div className="sticky bottom-2 left-0 right-0 space-y-2 rounded-2xl bg-slate-900/90 p-2 shadow-lg ring-1 ring-slate-800/80 backdrop-blur">
                    <button
                      type="button"
                      onClick={() => !payDisabled && onAddPayment(debt)}
                      disabled={payDisabled}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] text-sm font-semibold text-white transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60 md:h-12"
                      aria-label={debt.type === 'receivable' ? 'Terima pembayaran' : 'Bayar hutang'}
                    >
                      <Wallet className="h-4 w-4" aria-hidden="true" />
                      {primaryActionLabel}
                    </button>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(debt)}
                        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium text-slate-200 transition hover:bg-slate-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                        aria-label="Ubah hutang"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                        Edit data
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(debt)}
                        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium text-rose-300 ring-1 ring-slate-800 transition hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60"
                        aria-label="Hapus hutang"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Hapus
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <aside className="hidden md:flex md:flex-col md:justify-between">
                <div className="sticky top-3 space-y-3">
                  <button
                    type="button"
                    onClick={() => !payDisabled && onAddPayment(debt)}
                    disabled={payDisabled}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] text-sm font-semibold text-white transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label={debt.type === 'receivable' ? 'Terima pembayaran' : 'Bayar hutang'}
                  >
                    <Wallet className="h-4 w-4" aria-hidden="true" />
                    {primaryActionLabel}
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(debt)}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium text-slate-200 ring-1 ring-slate-800 transition hover:bg-slate-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    aria-label="Ubah hutang"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Edit data
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(debt)}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium text-rose-300 ring-1 ring-slate-800 transition hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60"
                    aria-label="Hapus hutang"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Hapus
                  </button>
                </div>
              </aside>
            </article>
          );
        })}
      </div>

      {loading && debts.length > 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-3xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-xs text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Memuat data hutang…
        </div>
      ) : null}
    </div>
  );
}
