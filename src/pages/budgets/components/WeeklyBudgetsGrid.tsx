import clsx from 'clsx';
import { Eye, NotebookPen, Pencil, Sparkles, Star, Trash2 } from 'lucide-react';
import type { WeeklyBudgetWithSpent } from '../../../lib/budgetApi';

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

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

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

function getProgressTier(percentage: number) {
  if (percentage > 100) {
    return {
      label: 'Melebihi anggaran',
      description: 'Pengeluaran sudah melampaui batas yang ditetapkan.',
      chipClass: 'bg-rose-500/15 text-rose-500 dark:text-rose-300',
      barClass: 'bg-rose-500',
    } as const;
  }
  if (percentage >= 90) {
    return {
      label: 'Mendekati batas',
      description: 'Pengeluaran hampir menyentuh batas anggaran.',
      chipClass: 'bg-orange-500/15 text-orange-500 dark:text-orange-300',
      barClass: 'bg-orange-500',
    } as const;
  }
  if (percentage >= 75) {
    return {
      label: 'Perlu perhatian',
      description: 'Pantau pengeluaran agar tidak melampaui alokasi.',
      chipClass: 'bg-amber-500/15 text-amber-500 dark:text-amber-300',
      barClass: 'bg-amber-500',
    } as const;
  }
  return {
    label: 'On track',
    description: 'Pengeluaran masih sesuai rencana.',
    chipClass: 'bg-brand/15 text-brand dark:text-brand-foreground/90',
    barClass: 'bg-[color:var(--accent)]',
  } as const;
}

function LoadingCards() {
  return (
    <div className={GRID_CLASS}>
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          className="min-h-[280px] animate-pulse rounded-2xl border border-dashed border-white/10 bg-surface/60 p-5 shadow-sm backdrop-blur"
        >
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-2xl bg-muted/30" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded-full bg-muted/30" />
              <div className="h-3 w-1/2 rounded-full bg-muted/20" />
            </div>
          </div>
          <div className="mt-6 space-y-3">
            <div className="h-3 w-2/3 rounded-full bg-muted/20" />
            <div className="h-3 w-full rounded-full bg-muted/10" />
            <div className="grid grid-cols-3 gap-3">
              <div className="h-16 rounded-xl border border-dashed border-muted/20" />
              <div className="h-16 rounded-xl border border-dashed border-muted/20" />
              <div className="h-16 rounded-xl border border-dashed border-muted/20" />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <div className="h-10 w-10 rounded-xl border border-dashed border-muted/20" />
            <div className="h-10 w-10 rounded-xl border border-dashed border-muted/20" />
            <div className="h-10 w-10 rounded-xl border border-dashed border-muted/20" />
            <div className="h-10 w-10 rounded-xl border border-dashed border-muted/20" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/10 bg-surface/60 p-10 text-center shadow-inner backdrop-blur">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-xl text-brand">✨</span>
      <div className="space-y-1">
        <p className="text-base font-semibold text-foreground">Belum ada anggaran mingguan</p>
        <p className="text-sm text-muted-foreground">
          Tambah anggaran untuk periode ini agar progres tetap terpantau.
        </p>
      </div>
      {onCreate ? (
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-sm transition hover:bg-brand/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/50"
        >
          <Sparkles className="h-4 w-4" />
          Tambah Anggaran
        </button>
      ) : null}
    </div>
  );
}

function StatItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'default' | 'negative' | 'positive';
}) {
  const valueClass = clsx(
    'text-lg font-bold tabular-nums text-foreground md:text-xl',
    tone === 'negative' && 'text-rose-500 dark:text-rose-300',
    tone === 'positive' && 'text-emerald-500 dark:text-emerald-300',
  );

  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-surface/70 p-3 shadow-inner">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className={`${valueClass} mt-1 truncate whitespace-nowrap`}>{value}</p>
    </div>
  );
}

function BudgetCard({
  row,
  isHighlighted,
  disableHighlight,
  onEdit,
  onDelete,
  onViewTransactions,
  onToggleCarryover,
  onToggleHighlight,
}: {
  row: WeeklyBudgetWithSpent;
  isHighlighted: boolean;
  disableHighlight: boolean;
  onEdit: (row: WeeklyBudgetWithSpent) => void;
  onDelete: (row: WeeklyBudgetWithSpent) => void;
  onViewTransactions: (row: WeeklyBudgetWithSpent) => void;
  onToggleCarryover: (row: WeeklyBudgetWithSpent, carryover: boolean) => void;
  onToggleHighlight: (row: WeeklyBudgetWithSpent) => void;
}) {
  const planned = Number(row.amount_planned ?? 0);
  const spent = Number(row.spent ?? 0);
  const remaining = planned - spent;
  const rawPercentage = planned > 0 ? (spent / planned) * 100 : spent > 0 ? 200 : 0;
  const displayPercentage = Math.max(0, Math.min(999, Math.round(rawPercentage)));
  const progressTier = getProgressTier(rawPercentage);
  const carryoverEnabled = Boolean(row.carryover_enabled);
  const isIncome = row.category?.type === 'income';
  const categoryName = row.category?.name?.trim() || 'Tanpa kategori';
  const categoryInitial = categoryName.charAt(0).toUpperCase() || '?';
  const notes = row.notes?.trim();

  const typeChipClass = isIncome
    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
    : 'bg-rose-500/15 text-rose-600 dark:text-rose-300';

  const cardClassName = clsx(
    'relative flex h-full overflow-hidden rounded-2xl border border-white/10 bg-surface/60 shadow-sm backdrop-blur transition-transform duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg',
    isHighlighted && 'ring-2 ring-[color:var(--accent)]/45',
  );

  return (
    <article className={cardClassName} data-highlighted={isHighlighted || undefined}>
      <div className="grid min-h-[280px] grid-rows-[auto,auto,1fr,auto] gap-3 p-4 md:min-h-[300px] md:p-5 xl:p-6">
        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-base font-semibold uppercase tracking-tight text-brand">
              {categoryInitial}
            </div>
            <div className="min-w-0 space-y-2">
              <h3 className="text-base font-semibold leading-tight tracking-tight text-foreground line-clamp-1 break-words md:text-lg md:line-clamp-2">
                {categoryName}
              </h3>
              <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm">
                <span className={clsx('inline-flex items-center rounded-full px-3 py-1 font-medium', typeChipClass)}>
                  {isIncome ? 'Pemasukan' : 'Pengeluaran'}
                </span>
                <span className={clsx('inline-flex items-center rounded-full px-3 py-1 font-medium', progressTier.chipClass)}>
                  {progressTier.label}
                </span>
                <span className="inline-flex items-center rounded-full bg-muted/20 px-3 py-1 text-xs font-medium text-muted-foreground">
                  {formatRange(row.week_start, row.week_end)}
                </span>
                {isHighlighted ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
                    <Sparkles className="h-3.5 w-3.5" /> Highlight
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onViewTransactions(row)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-surface/70 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/50"
            aria-label={`Lihat transaksi untuk ${categoryName}`}
          >
            <Eye className="h-4 w-4" />
          </button>
        </header>

        <div className="flex flex-wrap items-start justify-between gap-3 text-xs text-muted-foreground md:text-sm">
          <div className="min-w-0 space-y-1">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
              Status periode
            </p>
            <p className="line-clamp-2 break-words leading-snug text-foreground/80">
              {progressTier.description}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="block text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                Carryover
              </span>
              <span className="text-xs font-semibold text-foreground md:text-sm">
                {carryoverEnabled ? 'Aktif' : 'Nonaktif'}
              </span>
            </div>
            <label className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center focus-within:outline-none focus-within:ring-2 focus-within:ring-[color:var(--accent)]/50">
              <input
                type="checkbox"
                checked={carryoverEnabled}
                onChange={(event) => onToggleCarryover(row, event.target.checked)}
                className="peer sr-only"
                aria-label={`Atur carryover untuk ${categoryName}`}
              />
              <span className="absolute inset-0 rounded-full bg-muted/40 transition peer-checked:bg-brand/60" />
              <span className="pointer-events-none relative left-[3px] h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5 dark:bg-zinc-900" />
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
            <StatItem label="Dialokasikan" value={currencyFormatter.format(planned)} />
            <StatItem label="Dipakai" value={currencyFormatter.format(spent)} />
            <StatItem
              label="Sisa"
              value={currencyFormatter.format(remaining)}
              tone={remaining < 0 ? 'negative' : remaining > 0 ? 'positive' : 'default'}
            />
          </div>
          <div className="min-w-[180px] space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <span>Progres</span>
              <span className="tabular-nums text-muted-foreground/80">{displayPercentage}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted/20">
              <div
                className={clsx('h-full rounded-full transition-all duration-300 ease-out', progressTier.barClass)}
                style={{ width: `${Math.min(displayPercentage, 100)}%` }}
                aria-hidden
              />
            </div>
            {notes ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-surface/70 p-3 text-xs text-muted-foreground shadow-inner md:text-sm">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/20 text-muted-foreground">
                    <NotebookPen className="h-4 w-4" />
                  </span>
                  <p className="min-w-0 break-words leading-snug">{notes}</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onToggleHighlight(row)}
            disabled={disableHighlight}
            aria-pressed={isHighlighted}
            aria-label={`${isHighlighted ? 'Hapus' : 'Tambah'} highlight untuk ${categoryName}`}
            className={clsx(
              'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/50',
              isHighlighted
                ? 'border-brand/50 bg-brand/15 text-brand'
                : 'border-white/10 bg-surface/70 hover:text-foreground',
              disableHighlight && 'cursor-not-allowed opacity-60 hover:text-muted-foreground',
            )}
          >
            <Star className="h-4 w-4" fill={isHighlighted ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            onClick={() => onEdit(row)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-surface/70 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/50"
            aria-label={`Edit ${categoryName}`}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(row)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-400/60 bg-rose-500/10 text-rose-500 transition-colors hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40"
            aria-label={`Hapus ${categoryName}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
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
        const isHighlighted = highlightSet.has(String(row.id));
        const disableHighlight = !isHighlighted && limitReached;

        return (
          <BudgetCard
            key={row.id}
            row={row}
            isHighlighted={isHighlighted}
            disableHighlight={disableHighlight}
            onEdit={onEdit}
            onDelete={onDelete}
            onViewTransactions={onViewTransactions}
            onToggleCarryover={onToggleCarryover}
            onToggleHighlight={onToggleHighlight}
          />
        );
      })}
    </div>
  );
}
