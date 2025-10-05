import clsx from 'clsx';
import { Eye, Pencil, Star, Trash2 } from 'lucide-react';
import { formatCurrency } from '../../../lib/format';
import type {
  WeeklyBudgetCategorySummary,
  WeeklyBudgetWithActual,
} from '../../../lib/budgetApi';

interface WeeklyBudgetsSectionProps {
  rows: WeeklyBudgetWithActual[];
  summaries: WeeklyBudgetCategorySummary[];
  loading?: boolean;
  onEdit: (row: WeeklyBudgetWithActual) => void;
  onDelete: (row: WeeklyBudgetWithActual) => void;
  onHighlight: (row: WeeklyBudgetWithActual) => void;
  isHighlighted: (id: string) => boolean;
  onViewTransactions?: (row: WeeklyBudgetWithActual) => void;
}

const GRID_CLASS = 'grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

const WEEK_RANGE_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
});

const CATEGORY_TYPE_LABEL: Record<string, string> = {
  expense: 'Pengeluaran',
  income: 'Pemasukan',
};

function formatWeekRange(row: WeeklyBudgetWithActual): string {
  try {
    const start = new Date(`${row.week_start}T00:00:00.000Z`);
    const end = new Date(`${row.week_end}T00:00:00.000Z`);
    return `${WEEK_RANGE_FORMATTER.format(start)} – ${WEEK_RANGE_FORMATTER.format(end)}`;
  } catch (error) {
    return `${row.week_start} – ${row.week_end}`;
  }
}

function getProgressColor(percentage: number): string {
  const percent = Math.round(percentage * 100);
  if (percent <= 74) return 'var(--accent)';
  if (percent <= 89) return '#f59e0b';
  if (percent <= 100) return '#fb923c';
  return '#f43f5e';
}

function getProgressLabel(percentage: number): string {
  return `${Math.round(Math.min(percentage, 2) * 100)}%`;
}

function LoadingGrid() {
  return (
    <div className={GRID_CLASS}>
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          className="flex flex-col gap-4 rounded-2xl border border-dashed border-border/50 bg-surface/60 p-5 shadow-sm"
        >
          <div className="h-4 w-28 rounded-full bg-muted/40" />
          <div className="h-6 w-40 rounded-full bg-muted/40" />
          <div className="h-5 w-24 rounded-full bg-muted/30" />
          <div className="h-24 rounded-2xl bg-muted/20" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-surface/70 p-8 text-center text-sm text-muted shadow-inner">
      Belum ada anggaran mingguan. Tambahkan anggaran untuk mulai melacak pengeluaran per minggu.
    </div>
  );
}

function SummarySection({ summaries }: { summaries: WeeklyBudgetCategorySummary[] }) {
  if (summaries.length === 0) {
    return null;
  }

  return (
    <section className="mt-8 space-y-3">
      <header>
        <h3 className="text-sm font-semibold text-text">Total Weekly (Month-to-date)</h3>
        <p className="text-xs text-muted">Akumulasi semua minggu dalam bulan terhadap transaksi aktual bulan ini.</p>
      </header>
      <div className="space-y-4">
        {summaries.map((summary) => {
          const percent = summary.planned > 0 ? summary.actual / summary.planned : 0;
          const percentClamped = Math.max(0, Math.min(percent, 2));
          const color = getProgressColor(percentClamped);
          return (
            <article
              key={summary.category_id}
              className="rounded-2xl border border-border/60 bg-surface/70 p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-text">
                    {summary.category_name ?? 'Tanpa kategori'}
                  </p>
                  <p className="text-xs text-muted">
                    {CATEGORY_TYPE_LABEL[summary.category_type ?? 'expense'] ?? 'Pengeluaran'}
                  </p>
                </div>
                <div className="text-right text-xs text-muted">
                  <p>
                    {formatCurrency(summary.actual, 'IDR')} / {formatCurrency(summary.planned, 'IDR')}
                  </p>
                  <p className="font-semibold text-text">{getProgressLabel(percentClamped)}</p>
                </div>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted/20">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(percentClamped * 100, 100)}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function WeeklyBudgetsSection({
  rows,
  summaries,
  loading,
  onEdit,
  onDelete,
  onHighlight,
  isHighlighted,
  onViewTransactions,
}: WeeklyBudgetsSectionProps) {
  if (loading) {
    return (
      <div className="space-y-8">
        <LoadingGrid />
        <SummarySection summaries={summaries} />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-8">
        <EmptyState />
        <SummarySection summaries={summaries} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className={GRID_CLASS}>
        {rows.map((row) => {
          const planned = Number(row.amount_planned ?? 0);
          const actual = Number(row.actual ?? 0);
          const remaining = planned - actual;
          const percent = planned > 0 ? actual / planned : 0;
          const percentClamped = Math.max(0, Math.min(percent, 2));
          const color = getProgressColor(percentClamped);
          const highlighted = isHighlighted(row.id);
          const categoryType = CATEGORY_TYPE_LABEL[row.category?.type ?? 'expense'] ?? 'Pengeluaran';
          const onView = () => onViewTransactions?.(row);

          return (
            <article
              key={row.id}
              className="flex flex-col gap-5 rounded-2xl border border-border/60 bg-surface/80 p-5 shadow-[0_24px_45px_-28px_rgba(15,23,42,0.5)] transition duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_30px_60px_-32px_rgba(15,23,42,0.55)]"
            >
              <header className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">{formatWeekRange(row)}</p>
                  <h3 className="text-base font-semibold text-text">
                    {row.category?.name ?? 'Tanpa kategori'}
                  </h3>
                  <span className="inline-flex items-center rounded-full bg-muted/20 px-3 py-1 text-[0.7rem] font-medium text-muted">
                    {categoryType}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onView}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-surface/80 text-muted shadow-sm transition hover:-translate-y-0.5 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                    aria-label={`Lihat transaksi ${row.category?.name ?? ''}`}
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(row)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-surface/80 text-muted shadow-sm transition hover:-translate-y-0.5 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                    aria-label={`Edit anggaran ${row.category?.name ?? ''}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onHighlight(row)}
                    className={clsx(
                      'inline-flex h-9 w-9 items-center justify-center rounded-xl border bg-surface/80 text-muted shadow-sm transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
                      highlighted
                        ? 'border-amber-400/60 text-amber-500 hover:text-amber-500'
                        : 'border-border/60 hover:text-text'
                    )}
                    aria-label={highlighted ? `Hapus highlight ${row.category?.name ?? ''}` : `Highlight ${row.category?.name ?? ''}`}
                  >
                    <Star className={clsx('h-4 w-4', highlighted ? 'fill-current' : undefined)} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(row)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200/70 bg-rose-50/70 text-rose-500 shadow-sm transition hover:-translate-y-0.5 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-200"
                    aria-label={`Hapus anggaran ${row.category?.name ?? ''}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </header>

              <section className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted">Planned</p>
                    <p className="text-base font-semibold text-text">{formatCurrency(planned, 'IDR')}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted">Actual</p>
                    <p className="text-base font-semibold text-text">{formatCurrency(actual, 'IDR')}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted">Sisa</p>
                    <p className={clsx('text-base font-semibold', remaining < 0 ? 'text-rose-500 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-300')}>
                      {formatCurrency(remaining, 'IDR')}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-muted">
                    <span>Progres</span>
                    <span>{getProgressLabel(percentClamped)}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted/20">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(percentClamped * 100, 100)}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </div>

                <p className="text-xs text-muted">
                  {remaining < 0
                    ? `Melebihi anggaran sebesar ${formatCurrency(Math.abs(remaining), 'IDR')}`
                    : `Masih tersisa ${formatCurrency(remaining, 'IDR')}`}
                </p>
              </section>
            </article>
          );
        })}
      </div>

      <SummarySection summaries={summaries} />
    </div>
  );
}
