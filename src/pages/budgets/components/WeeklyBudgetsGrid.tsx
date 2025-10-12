import clsx from 'clsx';
import { Eye, Pencil, RefreshCcw, Sparkles, Star, Trash2 } from 'lucide-react';
import type { WeeklyBudgetWithSpent } from '../../../lib/budgetApi';
import { formatCurrency } from '../../../lib/format';

interface WeeklyBudgetsGridProps {
  rows: WeeklyBudgetWithSpent[];
  loading?: boolean;
  highlightedIds?: Set<string>;
  highlightLimitReached?: boolean;
  onEdit: (row: WeeklyBudgetWithSpent) => void;
  onDelete: (row: WeeklyBudgetWithSpent) => void;
  onViewTransactions: (row: WeeklyBudgetWithSpent) => void;
  onToggleCarryover: (row: WeeklyBudgetWithSpent, carryover: boolean) => void;
  onToggleHighlight: (row: WeeklyBudgetWithSpent) => void;
  onCreate?: () => void;
}

const GRID_CLASS =
  'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:[grid-template-columns:repeat(auto-fit,minmax(300px,1fr))] lg:gap-6 xl:[grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]';

const DATE_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
});

function formatRange(start: string, end: string) {
  try {
    const startDate = new Date(`${start}T00:00:00.000Z`);
    const endDate = new Date(`${end}T00:00:00.000Z`);
    return `${DATE_FORMATTER.format(startDate)} – ${DATE_FORMATTER.format(endDate)}`;
  } catch (error) {
    return `${start} – ${end}`;
  }
}

function getProgressColorClass(percentage: number) {
  if (percentage <= 74) return 'bg-[color:var(--accent)]';
  if (percentage <= 89) return 'bg-amber-500';
  if (percentage <= 100) return 'bg-orange-500';
  return 'bg-rose-500';
}

function getStatusBadge(planned: number, spent: number, percentage: number) {
  if (planned <= 0) {
    return {
      label: spent > 0 ? 'Tanpa target' : 'Belum diatur',
      className: 'bg-muted/20 text-muted-foreground',
    };
  }

  if (percentage > 100) {
    return {
      label: 'Overspend',
      className: 'bg-rose-500/10 text-rose-500 dark:text-rose-300',
    };
  }

  if (percentage >= 90) {
    return {
      label: 'Mendekati batas',
      className: 'bg-amber-500/10 text-amber-500 dark:text-amber-300',
    };
  }

  return {
    label: 'On track',
    className: 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-300',
  };
}

function getStatusDescription(
  planned: number,
  spent: number,
  remaining: number,
  rangeLabel: string,
) {
  if (planned <= 0) {
    if (spent <= 0) {
      return `Periode ${rangeLabel} • Belum ada transaksi`;
    }
    return `Periode ${rangeLabel} • Pengeluaran ${formatCurrency(spent, 'IDR')}`;
  }

  if (remaining < 0) {
    return `Periode ${rangeLabel} • Overspend ${formatCurrency(Math.abs(remaining), 'IDR')}`;
  }

  if (spent <= 0) {
    return `Periode ${rangeLabel} • Belum digunakan`;
  }

  return `Periode ${rangeLabel} • Sisa ${formatCurrency(remaining, 'IDR')}`;
}

function LoadingCards() {
  return (
    <div className={GRID_CLASS}>
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          className="min-h-[280px] animate-pulse rounded-2xl border border-white/10 bg-surface/60 p-4 shadow-sm md:p-5 xl:p-6"
        >
          <div className="grid h-full grid-rows-[auto,auto,1fr,auto] gap-3">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-xl bg-muted/30" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded-full bg-muted/30" />
                <div className="flex gap-2">
                  <div className="h-4 w-20 rounded-full bg-muted/20" />
                  <div className="h-4 w-24 rounded-full bg-muted/20" />
                </div>
              </div>
            </div>
            <div className="h-4 w-full rounded-full bg-muted/20" />
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="h-12 rounded-xl bg-muted/10" />
                <div className="h-12 rounded-xl bg-muted/10" />
                <div className="h-12 rounded-xl bg-muted/10" />
              </div>
              <div className="h-2 rounded-full bg-muted/10" />
            </div>
            <div className="flex justify-end gap-2">
              <div className="h-10 w-10 rounded-xl bg-muted/10" />
              <div className="h-10 w-10 rounded-xl bg-muted/10" />
              <div className="h-10 w-10 rounded-xl bg-muted/10" />
              <div className="h-10 w-10 rounded-xl bg-muted/10" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/15 bg-surface/70 p-8 text-center shadow-inner">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[color:var(--accent)]/15 text-[color:var(--accent)]">
        <Sparkles className="h-5 w-5" />
      </span>
      <div className="space-y-1">
        <p className="text-base font-semibold text-text">Belum ada anggaran mingguan</p>
        <p className="text-sm text-muted-foreground">
          Tambah anggaran untuk memantau pengeluaran setiap minggu secara lebih rapi.
        </p>
      </div>
      <button
        type="button"
        onClick={onCreate}
        disabled={!onCreate}
        className="inline-flex h-11 items-center justify-center rounded-2xl bg-[color:var(--accent)] px-5 text-sm font-semibold text-[color:var(--accent-foreground)] shadow transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Tambah Anggaran
      </button>
    </div>
  );
}

export default function WeeklyBudgetsGrid({
  rows,
  loading,
  highlightedIds,
  highlightLimitReached,
  onEdit,
  onDelete,
  onViewTransactions,
  onToggleCarryover,
  onToggleHighlight,
  onCreate,
}: WeeklyBudgetsGridProps) {
  if (loading) {
    return <LoadingCards />;
  }

  if (rows.length === 0) {
    return <EmptyState onCreate={onCreate} />;
  }

  const highlightSet = highlightedIds ?? new Set<string>();
  const limitReached = Boolean(highlightLimitReached);

  return (
    <div className={GRID_CLASS}>
      {rows.map((row) => {
        const planned = Number(row.amount_planned ?? 0);
        const spent = Number(row.spent ?? 0);
        const remaining = planned - spent;
        const rawPercentage = planned > 0 ? (spent / planned) * 100 : spent > 0 ? 200 : 0;
        const displayPercentage = Math.max(0, Math.min(100, Math.round(rawPercentage)));
        const progressColorClass = getProgressColorClass(rawPercentage);
        const carryoverEnabled = Boolean(row.carryover_enabled);
        const isHighlighted = highlightSet.has(String(row.id));
        const disableHighlight = !isHighlighted && limitReached;

        const categoryType = row.category?.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
        const categoryTypeClass = row.category?.type === 'income'
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
          : 'bg-rose-500/10 text-rose-600 dark:text-rose-300';

        const categoryName = row.category?.name ?? 'Tanpa kategori';
        const initials = categoryName
          .split(' ')
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0] ?? '')
          .join('')
          .toUpperCase() || 'BU';

        const rangeLabel = formatRange(row.week_start, row.week_end);
        const statusBadge = getStatusBadge(planned, spent, rawPercentage);
        const statusDescription = getStatusDescription(planned, spent, remaining, rangeLabel);

        return (
          <article
            key={row.id}
            className={clsx(
              'rounded-2xl border border-white/10 bg-surface/60 shadow-sm backdrop-blur transition-colors',
              'min-h-[280px] md:min-h-[300px] overflow-hidden',
              isHighlighted && 'border-[color:var(--accent)]/60 ring-2 ring-[color:var(--accent)]/40',
            )}
            data-highlighted={isHighlighted || undefined}
          >
            <div className="grid h-full grid-rows-[auto,auto,1fr,auto] gap-3 p-4 md:p-5 xl:p-6">
              <header className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[color:var(--accent)]/15 text-base font-semibold uppercase tracking-tight text-[color:var(--accent)]">
                  {initials}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <h3 className="min-w-0 text-base font-semibold leading-tight tracking-tight text-text line-clamp-1 break-words md:text-lg md:line-clamp-2">
                    {categoryName}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={clsx(
                        'inline-flex shrink-0 items-center rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
                        categoryTypeClass,
                      )}
                    >
                      {categoryType}
                    </span>
                    <span
                      className={clsx(
                        'inline-flex shrink-0 items-center rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
                        statusBadge.className,
                      )}
                    >
                      {statusBadge.label}
                    </span>
                    {isHighlighted ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[color:var(--accent)]/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--accent)]">
                        <Sparkles className="h-3.5 w-3.5" /> Highlight
                      </span>
                    ) : null}
                  </div>
                </div>
              </header>

              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="max-w-xl text-xs text-muted-foreground leading-snug line-clamp-2 break-words md:text-sm">
                  {statusDescription}
                </p>
                <div className="flex shrink-0 items-center gap-2 rounded-full bg-surface/70 px-3 py-1.5 text-[0.7rem] font-medium text-muted-foreground shadow-inner">
                  <RefreshCcw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="hidden whitespace-nowrap sm:inline">Carryover</span>
                  <span className="sm:hidden">CO</span>
                  <span className="whitespace-nowrap text-[0.7rem] uppercase tracking-wide">
                    {carryoverEnabled ? 'Aktif' : 'Nonaktif'}
                  </span>
                  <label className="relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={carryoverEnabled}
                      onChange={(event) => onToggleCarryover(row, event.target.checked)}
                      className="peer sr-only"
                      aria-label={`Atur carryover untuk ${categoryName}`}
                    />
                    <span className="absolute inset-0 rounded-full bg-muted/30 transition peer-checked:bg-[color:var(--accent)]/30" />
                    <span className="relative ml-[3px] h-3.5 w-3.5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5 dark:bg-zinc-900" />
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="grid flex-1 gap-3 sm:grid-cols-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs text-muted-foreground leading-snug md:text-sm">Dialokasikan</p>
                    <p className="truncate text-lg font-bold tabular-nums text-text md:text-xl">
                      {formatCurrency(planned, 'IDR')}
                    </p>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs text-muted-foreground leading-snug md:text-sm">Terpakai</p>
                    <p className="truncate text-lg font-bold tabular-nums text-text md:text-xl">
                      {formatCurrency(spent, 'IDR')}
                    </p>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs text-muted-foreground leading-snug md:text-sm">Sisa</p>
                    <p
                      className={clsx(
                        'truncate text-lg font-bold tabular-nums md:text-xl',
                        remaining < 0 ? 'text-rose-500 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-300',
                      )}
                    >
                      {formatCurrency(remaining, 'IDR')}
                    </p>
                  </div>
                </div>
                <div className="space-y-2 lg:min-w-[220px]">
                  <div className="flex items-center justify-between text-xs text-muted-foreground md:text-sm">
                    <span>Progres minggu ini</span>
                    <span className="font-semibold text-text tabular-nums whitespace-nowrap">{displayPercentage}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted/20">
                    <div
                      className={clsx('h-full rounded-full transition-all duration-300 ease-out', progressColorClass)}
                      style={{ width: `${displayPercentage}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onViewTransactions(row)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-surface/80 text-muted-foreground shadow-sm transition hover:-translate-y-0.5 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/50"
                  aria-label={`Lihat transaksi untuk ${categoryName}`}
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onToggleHighlight(row)}
                  disabled={disableHighlight}
                  aria-pressed={isHighlighted}
                  aria-label={`${isHighlighted ? 'Hapus' : 'Tambah'} highlight untuk ${categoryName}`}
                  className={clsx(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/50',
                    isHighlighted
                      ? 'border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 text-[color:var(--accent)]'
                      : 'border-white/10 bg-surface/80 text-muted-foreground hover:-translate-y-0.5 hover:text-text',
                    disableHighlight && 'cursor-not-allowed opacity-60 hover:translate-y-0',
                  )}
                >
                  <Star className="h-4 w-4" fill={isHighlighted ? 'currentColor' : 'none'} />
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(row)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-surface/80 text-muted-foreground shadow-sm transition hover:-translate-y-0.5 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/50"
                  aria-label={`Edit ${categoryName}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(row)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-400/40 bg-rose-500/10 text-rose-500 shadow-sm transition hover:-translate-y-0.5 hover:bg-rose-500/20 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 dark:border-rose-500/30 dark:bg-rose-500/20 dark:text-rose-200"
                  aria-label={`Hapus ${categoryName}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
