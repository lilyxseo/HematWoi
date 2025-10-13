import clsx from 'clsx';
import { Eye, NotebookPen, Pencil, RefreshCcw, Sparkles, Star, Trash2 } from 'lucide-react';
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
  'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-6 lg:[grid-template-columns:repeat(auto-fit,minmax(300px,1fr))] xl:[grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]';

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

        const notes = row.notes?.trim();

        const cardClassName = clsx(
          'relative flex h-full min-h-[280px] flex-col gap-5 overflow-hidden rounded-2xl border border-border/60 bg-surface/80 p-5 shadow-[0_24px_45px_-28px_rgba(15,23,42,0.5)] transition duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_30px_60px_-32px_rgba(15,23,42,0.55)] backdrop-blur supports-[backdrop-filter]:bg-surface/60 md:min-h-[300px]',
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
            <header className="relative z-10 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-text dark:text-white">{categoryName}</h3>
                    <span
                      className={clsx(
                        'inline-flex items-center rounded-full px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-wide',
                        categoryTypeClass
                      )}
                    >
                      {categoryType}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-muted/30 px-3 py-1 text-xs font-medium text-muted dark:bg-muted/20">
                      {formatRange(row.week_start, row.week_end)}
                    </span>
                    {isHighlighted ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-wide text-brand shadow-sm ring-1 ring-brand/40">
                        <Sparkles className="h-3.5 w-3.5" /> Highlight
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted">Target minggu ini</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <div className="flex items-center gap-2 rounded-full border border-border/60 bg-surface/70 px-3 py-1.5 text-[0.7rem] font-medium text-muted shadow-inner">
                    <RefreshCcw className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Carryover</span>
                    <span className="sm:hidden">CO</span>
                    <span className="text-[0.7rem] uppercase tracking-widest text-muted/80">
                      {carryoverEnabled ? 'Aktif' : 'Nonaktif'}
                    </span>
                    <label className="relative inline-flex h-5 w-10 cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={carryoverEnabled}
                        onChange={(event) => onToggleCarryover(row, event.target.checked)}
                        className="peer sr-only"
                        aria-label={`Atur carryover untuk ${categoryName}`}
                      />
                      <span className="absolute inset-0 rounded-full bg-muted/30 transition peer-checked:bg-emerald-500/70 dark:bg-muted/40 dark:peer-checked:bg-emerald-500/60" />
                      <span className="relative ml-[3px] h-3.5 w-3.5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5 dark:bg-zinc-900" />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => onViewTransactions(row)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-surface/80 text-muted shadow-sm transition hover:-translate-y-0.5 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
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
                      'inline-flex h-9 w-9 items-center justify-center rounded-xl border text-muted shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
                      isHighlighted
                        ? 'border-brand/40 bg-brand/10 text-brand'
                        : 'border-border/60 bg-surface/80 hover:-translate-y-0.5 hover:text-text',
                      disableHighlight ? 'cursor-not-allowed opacity-60 hover:translate-y-0' : null
                    )}
                  >
                    <Star className="h-4 w-4" fill={isHighlighted ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(row)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-surface/80 text-muted shadow-sm transition hover:-translate-y-0.5 hover:text-text"
                    aria-label={`Edit ${categoryName}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(row)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200/70 bg-rose-50/70 text-rose-500 shadow-sm transition hover:-translate-y-0.5 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-200"
                    aria-label={`Hapus ${categoryName}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </header>

            <section className="relative z-10 space-y-4">
              <div className="rounded-xl border border-border/50 bg-surface/70 p-4 shadow-inner">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1">
                    <span className="text-[0.68rem] uppercase tracking-[0.18em] text-muted">Anggaran</span>
                    <p className="text-base font-semibold text-text">{formatCurrency(planned, 'IDR')}</p>
                    <p className="text-xs text-muted">Dialokasikan minggu ini</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[0.68rem] uppercase tracking-[0.18em] text-muted">Realisasi</span>
                    <p className="text-base font-semibold text-text/90 dark:text-zinc-200">{formatCurrency(spent, 'IDR')}</p>
                    <p className="text-xs text-muted">{planned > 0 ? `${displayPercentage}% dari target` : 'Tidak ada batas'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[0.68rem] uppercase tracking-[0.18em] text-muted">Sisa</span>
                    <p
                      className={clsx(
                        'text-base font-semibold',
                        remaining < 0 ? 'text-rose-500 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-300'
                      )}
                    >
                      {formatCurrency(remaining, 'IDR')}
                    </p>
                    <p className="text-xs text-muted">{remaining < 0 ? 'Melebihi target' : 'Masih tersedia'}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-muted">
                    <span>Progres minggu ini</span>
                    <span>{displayPercentage}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted/20 dark:bg-muted/30">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${displayPercentage}%`, backgroundColor: progressColor }}
                    />
                  </div>
                </div>
              </div>

              {notes ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-surface/70 p-4 text-sm shadow-inner">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/20 text-muted">
                      <NotebookPen className="h-4 w-4" />
                    </span>
                    <div className="space-y-1">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted">Catatan</p>
                      <p className="leading-relaxed text-text dark:text-zinc-100">{row.notes}</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          </article>
        );
      })}
    </div>
  );
}

