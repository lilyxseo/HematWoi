import clsx from 'clsx';
import {
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MoreVertical,
  NotebookPen,
  Pencil,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
    pillClass: 'bg-rose-900/30 text-rose-300 ring-1 ring-rose-700/40',
  },
};

type TenorNavigationState = {
  key: string;
  hasPrev: boolean;
  hasNext: boolean;
  currentIndex: number;
  total: number;
};

interface DebtsGridProps {
  debts: DebtRecord[];
  loading?: boolean;
  onEdit: (debt: DebtRecord) => void;
  onDelete: (debt: DebtRecord) => void;
  onAddPayment: (debt: DebtRecord) => void;
  tenorNavigation?: Record<string, TenorNavigationState>;
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

interface DebtCardProps {
  debt: DebtRecord;
  statusConfig?: { label: string; pillClass: string };
  overdue: boolean;
  progress: number;
  progressPercent: number;
  progressColor: string;
  remaining: number;
  navigation?: TenorNavigationState;
  onAddPayment: (debt: DebtRecord) => void;
  onEdit: (debt: DebtRecord) => void;
  onDelete: (debt: DebtRecord) => void;
  onNavigateTenor?: (seriesKey: string, direction: 1 | -1) => void;
}

function DebtCard({
  debt,
  statusConfig,
  overdue,
  progress,
  progressPercent,
  progressColor,
  remaining,
  navigation,
  onAddPayment,
  onEdit,
  onDelete,
  onNavigateTenor,
}: DebtCardProps) {
  const description = debt.title?.trim();
  const notes = debt.notes?.trim();
  const tenorLabel = formatTenor(debt);
  const dueDateLabel = formatDate(debt.due_date);
  const interestValue = typeof debt.rate_percent === 'number' ? debt.rate_percent : null;
  const showInterestRow = interestValue !== null;
  const interestLabel = showInterestRow ? formatPercent(interestValue) : '-';
  const isPaid = debt.status === 'paid';
  const actionLabelBase = debt.type === 'receivable' ? 'Terima' : 'Bayar';
  const actionLabel = isPaid ? 'Catat lagi' : actionLabelBase;
  const actionAria = debt.type === 'receivable'
    ? isPaid
      ? 'Catat lagi pembayaran piutang'
      : 'Terima pembayaran'
    : isPaid
      ? 'Catat lagi hutang'
      : 'Bayar hutang';
  const remainingClass = clsx(
    'font-mono text-sm md:text-base font-semibold text-slate-100',
    progressPercent > 90 && remaining > 0 ? 'text-amber-300' : null,
  );

  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function handlePointer(event: MouseEvent) {
      if (!menuRef.current) return;
      if (event.target instanceof Node && menuRef.current.contains(event.target)) return;
      setMenuOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    }
    window.addEventListener('mousedown', handlePointer);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handlePointer);
      window.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  const descriptionContent = description || 'Tidak ada judul';

  return (
    <article
      className="relative flex h-full min-w-0 flex-col gap-3 rounded-2xl bg-slate-900/60 p-4 text-sm text-slate-300 ring-1 ring-slate-800 md:grid md:grid-cols-[1fr,260px] md:gap-5 md:p-5 md:text-base"
    >
      <div className="flex min-w-0 flex-col gap-2.5">
        <header className="flex flex-col gap-1.5">
          <div className="flex items-start gap-2">
            {statusConfig ? (
              <span
                className={clsx(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
                  statusConfig.pillClass,
                )}
              >
                {statusConfig.label}
              </span>
            ) : null}
            <h3 className="min-w-0 flex-1 truncate text-base font-semibold text-slate-100 md:text-lg">
              {debt.party_name || 'Tanpa nama'}
            </h3>
            <div ref={menuRef} className="relative flex-shrink-0">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((value) => !value)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,#6366f1)]"
                aria-label="Buka menu tindakan hutang"
              >
                <MoreVertical className="h-4 w-4" aria-hidden="true" />
              </button>
              {menuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-11 z-20 w-44 overflow-hidden rounded-xl border border-slate-800/70 bg-slate-950/95 text-sm shadow-xl"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit(debt);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-200 transition hover:bg-slate-800/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,#6366f1)]"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Edit data
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete(debt);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-rose-300 transition hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Hapus
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
            <span className="min-w-0 flex items-center gap-1 truncate" title={descriptionContent}>
              <span className="line-clamp-1">{descriptionContent}</span>
            </span>
            <span className={clsx('flex items-center gap-1.5', overdue ? 'text-rose-300' : null)}>
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              {dueDateLabel}
            </span>
            <span className="flex items-center gap-1 font-medium text-slate-300">
              Tenor {tenorLabel}
            </span>
            {overdue ? (
              <span className="inline-flex items-center rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-300">
                Jatuh tempo
              </span>
            ) : null}
          </div>
        </header>

        <div className="grid grid-cols-3 gap-2 md:gap-3">
          <div className="rounded-xl bg-slate-800/50 p-3 text-center">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Jumlah</p>
            <p className="font-mono text-sm text-slate-100 md:text-base">{formatCurrency(debt.amount)}</p>
          </div>
          <div className="rounded-xl bg-slate-800/50 p-3 text-center">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Terbayar</p>
            <p className="font-mono text-sm text-slate-200 md:text-base">{formatCurrency(debt.paid_total)}</p>
          </div>
          <div className="rounded-xl bg-slate-800/50 p-3 text-center">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Sisa</p>
            <p className={remainingClass}>{formatCurrency(remaining)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
            <span
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
          <p className="text-xs text-emerald-300">
            Pembayaran melebihi jumlah hutang sebesar {formatCurrency(debt.paid_total - debt.amount)}
          </p>
        ) : null}

        {notes ? (
          <details className="group overflow-hidden rounded-xl border border-slate-800/60 bg-slate-900/40 text-sm text-slate-300">
            <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400 transition hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,#6366f1)] focus-visible:ring-offset-0 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <NotebookPen className="h-3.5 w-3.5" aria-hidden="true" /> Catatan
              </span>
              <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="px-3 pb-3 text-sm leading-relaxed text-slate-200">
              <p className="whitespace-pre-line">{notes}</p>
            </div>
          </details>
        ) : null}
      </div>

      <aside className="flex flex-col gap-3 md:sticky md:top-3">
        <div className="flex flex-col gap-2.5 text-xs text-slate-400 md:text-sm">
          {showInterestRow ? (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-900/40 px-3 py-2">
              <span className="font-medium text-slate-300">Bunga</span>
              <span className="font-semibold text-slate-100">{interestLabel}</span>
            </div>
          ) : null}
          {navigation && debt.tenor_months > 1 ? (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-900/40 px-3 py-2">
              <span className="font-medium text-slate-300">Navigasi tenor</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => navigation.hasPrev && onNavigateTenor?.(navigation.key, -1)}
                  disabled={!navigation.hasPrev}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl ring-1 ring-slate-800 bg-slate-900/60 text-slate-300 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,#6366f1)] disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Lihat tenor sebelumnya"
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <span className="min-w-[3rem] text-center font-semibold text-slate-100">{tenorLabel}</span>
                <button
                  type="button"
                  onClick={() => navigation.hasNext && onNavigateTenor?.(navigation.key, 1)}
                  disabled={!navigation.hasNext}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl ring-1 ring-slate-800 bg-slate-900/60 text-slate-300 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,#6366f1)] disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Lihat tenor selanjutnya"
                >
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="sticky bottom-3 left-0 right-0 -mx-4 space-y-2.5 rounded-2xl border border-slate-800/70 bg-slate-950/70 p-4 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.8)] backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none md:space-y-3">
          <button
            type="button"
            onClick={() => !isPaid && onAddPayment(debt)}
            disabled={isPaid}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--accent,#6366f1)] px-4 text-sm font-semibold text-white transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,#6366f1)] md:h-12 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={actionAria}
          >
            <Wallet className="h-4 w-4" aria-hidden="true" />
            {actionLabel}
          </button>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-1">
            <button
              type="button"
              onClick={() => onEdit(debt)}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-slate-200 ring-1 ring-slate-800 transition hover:bg-slate-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,#6366f1)]"
              aria-label="Edit data hutang"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit data
            </button>
            <button
              type="button"
              onClick={() => onDelete(debt)}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-rose-300 ring-1 ring-slate-800 transition hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60"
              aria-label="Hapus hutang"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Hapus
            </button>
          </div>
        </div>
      </aside>
    </article>
  );
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

          return (
            <DebtCard
              key={debt.id}
              debt={debt}
              statusConfig={statusConfig}
              overdue={overdue}
              progress={progress}
              progressPercent={progressPercent}
              progressColor={progressColor}
              remaining={remaining}
              navigation={navigation}
              onAddPayment={onAddPayment}
              onEdit={onEdit}
              onDelete={onDelete}
              onNavigateTenor={onNavigateTenor}
            />
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
