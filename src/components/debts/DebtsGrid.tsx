import clsx from 'clsx';
import {
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MoreHorizontal,
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
    badgeClass: 'bg-amber-900/30 text-amber-300 ring-1 ring-amber-700/40',
    accent: 'from-amber-500/15 via-surface/80 to-surface/80',
    glow: 'rgba(251,191,36,0.35)',
  },
  paid: {
    label: 'Lunas',
    badgeClass: 'bg-emerald-900/30 text-emerald-300 ring-1 ring-emerald-700/40',
    accent: 'from-emerald-500/15 via-surface/80 to-surface/80',
    glow: 'rgba(52,211,153,0.35)',
  },
  overdue: {
    label: 'Jatuh Tempo',
    badgeClass: 'bg-rose-900/30 text-rose-300 ring-1 ring-rose-700/40',
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
          const notes = debt.notes?.trim();

          const tenorLabel = formatTenor(debt);
          const description = debt.party_name?.trim() || notes || '';
          const showInterest = typeof debt.rate_percent === 'number' && Math.abs(debt.rate_percent) > 0.0001;
          const remainingTone = progressPercent >= 90 ? 'text-amber-300' : 'text-slate-100';

          return (
            <article
              key={debt.id}
              className="flex h-full flex-col gap-2.5 rounded-2xl bg-slate-900/60 p-4 ring-1 ring-slate-800 md:grid md:grid-cols-[1fr,260px] md:gap-5 md:p-5"
            >
              <div className="min-w-0 space-y-2.5 text-sm text-slate-400 md:text-base">
                <header className="flex flex-col gap-1.5 text-sm md:text-base">
                  <div className="flex items-center gap-2 text-xs text-slate-300 md:text-sm">
                    {statusConfig ? (
                      <span
                        className={clsx(
                          'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
                          statusConfig.badgeClass,
                        )}
                      >
                        {statusConfig.label}
                      </span>
                    ) : null}
                    <h3 className="min-w-0 flex-1 truncate text-base font-semibold text-slate-100 md:text-lg" title={debt.title || debt.party_name || undefined}>
                      {debt.title || debt.party_name || 'Tanpa judul'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => onEdit(debt)}
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                      aria-label="Lihat opsi hutang"
                    >
                      <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 md:text-sm">
                    {description ? (
                      <span className="min-w-0 flex-1 truncate" title={description}>
                        {description}
                      </span>
                    ) : null}
                    <span className="flex items-center gap-1 text-slate-400">
                      <CalendarClock className="h-3.5 w-3.5 md:h-4 md:w-4" aria-hidden="true" />
                      <span className={clsx('truncate', overdue ? 'text-rose-300' : 'text-slate-300')} title={formatDate(debt.due_date)}>
                        {formatDate(debt.due_date)}
                      </span>
                    </span>
                    <span className="font-medium text-slate-300">Tenor {tenorLabel}</span>
                  </div>
                </header>

                <div className="grid grid-cols-3 gap-2 md:gap-3">
                  <div className="flex flex-col items-center gap-1 rounded-xl bg-slate-800/50 p-3 text-center">
                    <span className="text-[11px] uppercase tracking-wide text-slate-400">Jumlah</span>
                    <span className="font-mono text-sm text-slate-100 md:text-base">{formatCurrency(debt.amount)}</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 rounded-xl bg-slate-800/50 p-3 text-center">
                    <span className="text-[11px] uppercase tracking-wide text-slate-400">Terbayar</span>
                    <span className="font-mono text-sm text-slate-200 md:text-base">{formatCurrency(debt.paid_total)}</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 rounded-xl bg-slate-800/50 p-3 text-center">
                    <span className="text-[11px] uppercase tracking-wide text-slate-400">Sisa</span>
                    <span className={clsx('font-mono text-sm font-semibold md:text-base', remainingTone)}>
                      {formatCurrency(remaining)}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-400 md:text-sm">
                    {showInterest ? (
                      <span className="font-medium text-slate-300">Bunga {formatPercent(debt.rate_percent)}</span>
                    ) : (
                      <span className="text-slate-500">Bunga 0%</span>
                    )}
                    {navigation && debt.tenor_months > 1 ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => navigation.hasPrev && onNavigateTenor?.(navigation.key, -1)}
                          disabled={!navigation.hasPrev}
                          className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 ring-1 ring-slate-800 transition hover:bg-slate-800/60 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Lihat tenor sebelumnya"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <span className="text-xs font-medium text-slate-300 md:text-sm">Tenor {tenorLabel}</span>
                        <button
                          type="button"
                          onClick={() => navigation.hasNext && onNavigateTenor?.(navigation.key, 1)}
                          disabled={!navigation.hasNext}
                          className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 ring-1 ring-slate-800 transition hover:bg-slate-800/60 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Lihat tenor selanjutnya"
                        >
                          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs font-medium text-slate-500 md:text-sm">Tenor {tenorLabel}</span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                    <span>Progress</span>
                    <span className="font-medium text-slate-200">{progressPercent}%</span>
                  </div>
                  <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-[color:var(--accent)]"
                      style={{ width: `${Math.min(progressPercent, 100)}%` }}
                    />
                  </div>
                  {progress > 1 ? (
                    <p className="text-xs text-emerald-300">Pembayaran melebihi jumlah hutang sebesar {formatCurrency(debt.paid_total - debt.amount)}</p>
                  ) : null}
                </div>

                {notes ? (
                  <details className="group rounded-xl bg-slate-900/40 text-xs text-slate-400 ring-1 ring-slate-800 transition focus-within:ring-2 focus-within:ring-[var(--accent)]">
                    <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left font-medium text-slate-200 marker:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
                      <span className="flex items-center gap-2 text-xs md:text-sm">
                        <NotebookPen className="h-3.5 w-3.5 md:h-4 md:w-4" aria-hidden="true" />
                        Catatan
                      </span>
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500 transition group-open:rotate-180" aria-hidden="true" />
                    </summary>
                    <div className="border-t border-slate-800/60 px-3 py-2 text-sm text-slate-300">
                      {notes}
                    </div>
                  </details>
                ) : null}
              </div>

              <div className="order-last mt-1 md:order-none md:mt-0">
                <div className="sticky bottom-3 left-0 right-0 z-10 -mx-4 flex flex-col gap-2 rounded-2xl bg-slate-900/80 p-3 ring-1 ring-slate-800 backdrop-blur md:static md:mx-0 md:bg-transparent md:p-0 md:ring-0 md:backdrop-blur-none">
                  <button
                    type="button"
                    onClick={() => onAddPayment(debt)}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--accent)] text-sm font-semibold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] md:h-12"
                    aria-label={debt.type === 'receivable' ? 'Terima pembayaran' : 'Bayar hutang'}
                  >
                    <Wallet className="h-4 w-4" aria-hidden="true" />
                    {debt.type === 'receivable' ? 'Terima' : 'Bayar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(debt)}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-slate-200 ring-1 ring-slate-800 transition hover:bg-slate-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    aria-label="Ubah hutang"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Edit data
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(debt)}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-rose-300 ring-1 ring-slate-800 transition hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60"
                    aria-label="Hapus hutang"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Hapus
                  </button>
                </div>
              </div>
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
