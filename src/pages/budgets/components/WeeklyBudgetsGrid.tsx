import clsx from 'clsx';
import {
  IconEye as Eye,
  IconNotebook as NotebookPen,
  IconPencil as Pencil,
  IconRefresh as RefreshCcw,
  IconSparkles as Sparkles,
  IconStar as Star,
  IconTrash as Trash2
} from '@tabler/icons-react';
import { formatCurrency } from '../../../lib/format';
import type { WeeklyBudgetWithSpent } from '../../../lib/budgetApi';

interface WeeklyBudgetsGridProps {
  rows: WeeklyBudgetWithSpent[];
  loading?: boolean;
  highlightedIds?: Set<string>;
  highlightedCategoryIds?: Set<string>;
  highlightLimitReached?: boolean;
  onEdit: (row: WeeklyBudgetWithSpent) => void;
  onDelete: (row: WeeklyBudgetWithSpent) => void;
  onViewTransactions: (row: WeeklyBudgetWithSpent) => void;
  onToggleCarryover: (row: WeeklyBudgetWithSpent, carryover: boolean) => void;
  onToggleHighlight: (row: WeeklyBudgetWithSpent) => void;
}

const GRID_CLASS =
  'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6 xl:grid-cols-3 xl:gap-6';

function StatItem({
  label,
  value,
  description,
  valueClassName,
}: {
  label: string;
  value: string;
  description?: string;
  valueClassName?: string;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs leading-snug text-muted-foreground whitespace-nowrap md:text-sm">{label}</p>
      <p className={clsx('truncate text-lg font-bold tabular-nums md:text-xl', valueClassName)}>{value}</p>
      {description ? (
        <p className="line-clamp-1 text-xs leading-snug text-muted-foreground/90 md:text-sm">{description}</p>
      ) : null}
    </div>
  );
}

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

function getProgressColor(percentage: number): string {
  if (percentage <= 74) return 'var(--accent)';
  if (percentage <= 89) return '#f59e0b';
  if (percentage <= 100) return '#fb923c';
  return '#f43f5e';
}

function LoadingCards() {
  return (
    <div className={GRID_CLASS}>
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          className="flex flex-col gap-4 rounded-2xl border border-dashed border-border/60 bg-surface/80 p-5 shadow-sm animate-pulse"
        >
          <div className="h-4 w-1/2 rounded-full bg-muted/40" />
          <div className="h-6 w-3/4 rounded-full bg-muted/40" />
          <div className="h-2 rounded-full bg-muted/30" />
          <div className="h-24 rounded-2xl border border-dashed border-border/60" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/60 bg-surface/70 p-8 text-center text-sm text-muted shadow-inner">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">✨</span>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-text">Belum ada anggaran mingguan</p>
        <p className="text-sm text-muted">Tambah anggaran per minggu untuk mulai memantau pengeluaran.</p>
      </div>
    </div>
  );
}

export default function WeeklyBudgetsGrid({
  rows,
  loading,
  highlightedIds,
  highlightedCategoryIds,
  highlightLimitReached,
  onEdit,
  onDelete,
  onViewTransactions,
  onToggleCarryover,
  onToggleHighlight,
}: WeeklyBudgetsGridProps) {
  if (loading) {
    return <LoadingCards />;
  }

  if (rows.length === 0) {
    return <EmptyState />;
  }

  const highlightSet = highlightedIds ?? new Set<string>();
  const highlightCategorySet = highlightedCategoryIds ?? new Set<string>();
  const limitReached = Boolean(highlightLimitReached);

  return (
    <div className={GRID_CLASS}>
      {rows.map((row) => {
        const planned = Number(row.amount_planned ?? 0);
        const spent = Number(row.spent ?? 0);
        const remaining = planned - spent;
        const rawPercentage = planned > 0 ? (spent / planned) * 100 : spent > 0 ? 200 : 0;
        const displayPercentage = Math.max(0, Math.min(100, Math.round(rawPercentage)));
        const progressColor = getProgressColor(rawPercentage);
        const carryoverEnabled = Boolean(row.carryover_enabled);
        const categoryKey = row.category_id ? String(row.category_id) : null;
        const isHighlighted =
          highlightSet.has(String(row.id)) || (categoryKey ? highlightCategorySet.has(categoryKey) : false);
        const disableHighlight = !isHighlighted && limitReached;

        const categoryType = row.category?.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
        const categoryTypeClass = row.category?.type === 'income'
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
          : 'bg-rose-500/10 text-rose-600 dark:text-rose-300';

        const categoryName = row.category?.name ?? 'Tanpa kategori';
        const categoryInitial = categoryName.trim().charAt(0).toUpperCase() || 'B';
        const periodLabel = formatRange(row.week_start, row.week_end);

        const notes = row.notes?.trim();

        const percentageLabel = planned > 0 ? `${displayPercentage}% dari target` : 'Tidak ada batas';
        const remainingLabel = remaining < 0 ? 'Melebihi target' : 'Masih tersedia';
        const message =
          remaining < 0
            ? `Pengeluaran melebihi target minggu ini sebesar ${formatCurrency(Math.abs(remaining))}.`
            : `Masih tersedia ${formatCurrency(remaining)} untuk minggu ini.`;

        const cardClassName = clsx(
          'relative grid min-h-[280px] grid-rows-[auto,auto,1fr,auto] gap-3 overflow-hidden rounded-2xl border border-border/60 bg-surface/80 p-4 shadow-[0_24px_45px_-28px_rgba(15,23,42,0.5)] transition duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_30px_60px_-32px_rgba(15,23,42,0.55)] backdrop-blur supports-[backdrop-filter]:bg-surface/60 md:min-h-[300px] md:p-5 xl:p-6',
          isHighlighted
            ? 'border-brand/60 bg-gradient-to-br from-brand/15 via-surface/80 to-surface/80 ring-2 ring-brand/40 shadow-[0_32px_64px_-36px_rgba(59,130,246,0.55)] dark:from-brand/25'
            : null
        );

        return (
          <article key={row.id} className={cardClassName} data-highlighted={isHighlighted || undefined}>
            {isHighlighted ? (
              <div
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl"
                style={{ background: 'radial-gradient(circle at center, rgba(59,130,246,0.45) 0%, rgba(59,130,246,0.2) 45%, rgba(255,255,255,0) 75%)' }}
              />
            ) : null}
            <header className="relative z-10 flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand/15 text-lg font-semibold uppercase text-brand shadow-inner">
                {categoryInitial}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="line-clamp-1 break-words text-base font-semibold leading-tight tracking-tight text-text md:line-clamp-2 md:text-lg">
                    {categoryName}
                  </h3>
                  <span
                    className={clsx(
                      'inline-flex shrink-0 items-center rounded-full px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-wide',
                      categoryTypeClass
                    )}
                  >
                    {categoryType}
                  </span>
                  <span className="inline-flex shrink-0 items-center rounded-full bg-muted/30 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-wide text-muted dark:bg-muted/20">
                    {periodLabel}
                  </span>
                  {isHighlighted ? (
                    <span className="inline-flex items-center gap-1 shrink-0 rounded-full bg-brand/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-wide text-brand shadow-sm ring-1 ring-brand/40">
                      <Sparkles className="h-3.5 w-3.5" /> Highlight
                    </span>
                  ) : null}
                </div>
                <p className="text-xs leading-snug text-muted-foreground">Target minggu ini</p>
              </div>
            </header>

            <div className="relative z-10 flex flex-wrap items-start justify-between gap-3 text-xs leading-snug text-muted-foreground md:text-sm">
              <div className="min-w-0 flex-1 space-y-2">
                <p className="line-clamp-2 break-words text-muted-foreground">{message}</p>
                <p className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                  Periode {periodLabel}
                </p>
                {notes ? (
                  <p className="flex items-start gap-2 text-xs leading-snug text-muted-foreground/90 md:text-sm">
                    <NotebookPen className="mt-[2px] h-4 w-4 shrink-0 text-muted-foreground/70" />
                    <span>{notes}</span>
                  </p>
                ) : null}
              </div>
              <div className="flex h-10 shrink-0 items-center gap-3 rounded-full border border-white/10 bg-surface/70 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground shadow-inner">
                <RefreshCcw className="h-4 w-4 shrink-0" />
                <span className="hidden whitespace-nowrap sm:inline">Carryover</span>
                <span className="sm:hidden">CO</span>
                <label className="relative inline-flex h-6 w-11 cursor-pointer items-center" aria-label={`Atur carryover untuk ${categoryName}`}>
                  <input
                    type="checkbox"
                    checked={carryoverEnabled}
                    onChange={(event) => onToggleCarryover(row, event.target.checked)}
                    className="peer sr-only"
                  />
                  <span className="absolute inset-0 rounded-full bg-muted/30 transition peer-checked:bg-emerald-500/60" />
                  <span className="relative ml-[3px] h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5 dark:bg-zinc-900" />
                </label>
              </div>
            </div>

            <div className="relative z-10 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
              <div className="grid flex-1 gap-3 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
                <StatItem label="Dialokasikan" value={formatCurrency(planned)} description="Anggaran minggu ini" />
                <StatItem label="Terpakai" value={formatCurrency(spent)} description={percentageLabel} />
                <StatItem
                  label="Sisa"
                  value={formatCurrency(remaining)}
                  description={remainingLabel}
                  valueClassName={remaining < 0 ? 'text-rose-500 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-300'}
                />
              </div>
              <div className="flex w-full flex-col gap-2 rounded-xl border border-white/10 bg-surface/50 p-3 shadow-inner lg:min-w-[200px] lg:max-w-[260px]">
                <div className="flex items-center justify-between text-xs leading-snug text-muted-foreground md:text-sm">
                  <span>Progres penggunaan</span>
                  <span className="tabular-nums whitespace-nowrap">{displayPercentage}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted/20">
                  <div
                    role="progressbar"
                    aria-label={`Anggaran terpakai ${displayPercentage}%`}
                    aria-valuenow={displayPercentage}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="h-full rounded-full transition-[width]"
                    style={{ width: `${displayPercentage}%`, backgroundColor: progressColor }}
                  />
                </div>
              </div>
            </div>

            <footer className="relative z-10 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => onViewTransactions(row)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-surface/80 text-muted-foreground transition hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
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
                  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]',
                  isHighlighted
                    ? 'border-brand/40 bg-brand/15 text-brand shadow-sm'
                    : 'border-white/10 bg-surface/80 text-muted-foreground hover:text-text shadow-sm',
                  disableHighlight ? 'cursor-not-allowed opacity-60 hover:text-muted-foreground' : null
                )}
              >
                <Star className="h-4 w-4" fill={isHighlighted ? 'currentColor' : 'none'} />
              </button>
              <button
                type="button"
                onClick={() => onEdit(row)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-surface/80 text-muted-foreground transition hover:text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
                aria-label={`Edit ${categoryName}`}
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(row)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-500 transition hover:text-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 dark:border-rose-500/30 dark:text-rose-200"
                aria-label={`Hapus ${categoryName}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </footer>
          </article>
        );
      })}
    </div>
  );
}

