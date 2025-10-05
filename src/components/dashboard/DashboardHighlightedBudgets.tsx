import { useMemo } from 'react';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useHighlightedBudgets } from '../../hooks/useHighlightedBudgets';
import { formatCurrency } from '../../lib/format';
import type { PeriodRange } from './PeriodPicker';

interface DashboardHighlightedBudgetsProps {
  period: PeriodRange;
}

function getPeriodFromRange(range: PeriodRange): string {
  const base = range?.end || range?.start;
  if (!base) {
    const now = new Date();
    const month = `${now.getMonth() + 1}`.padStart(2, '0');
    return `${now.getFullYear()}-${month}`;
  }
  return base.slice(0, 7);
}

function getProgressColor(percentage: number) {
  if (percentage > 1) return 'bg-rose-500';
  if (percentage >= 0.9) return 'bg-orange-500';
  if (percentage >= 0.75) return 'bg-amber-500';
  return 'bg-[color:var(--accent)]';
}

function getTrackColor(percentage: number) {
  if (percentage > 1) return 'bg-rose-500/15';
  if (percentage >= 0.9) return 'bg-orange-500/15';
  if (percentage >= 0.75) return 'bg-amber-500/15';
  return 'bg-[color:var(--accent)]/15';
}

function formatPercentage(value: number) {
  const pct = Math.max(0, value);
  if (pct > 2) return `${(pct * 100).toFixed(0)}%`;
  return `${Math.round(pct * 100)}%`;
}

export default function DashboardHighlightedBudgets({ period }: DashboardHighlightedBudgetsProps) {
  const periodMonth = useMemo(() => getPeriodFromRange(period), [period]);
  const { highlights, loading, error } = useHighlightedBudgets({ period: periodMonth });

  return (
    <section className="rounded-3xl border border-border/60 bg-gradient-to-br from-white via-white to-[color:var(--accent)]/5 p-6 shadow-sm transition dark:border-border/40 dark:from-zinc-900/80 dark:via-zinc-900/60 dark:to-[color:var(--accent)]/10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-[color:var(--accent)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--accent)]">
            <Sparkles className="h-3.5 w-3.5" />
            Highlighted Budgets
          </span>
          <h2 className="mt-3 text-xl font-semibold text-foreground sm:text-2xl">Anggaran Prioritasmu</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pantau anggaran penting yang kamu tandai langsung dari dashboard.
          </p>
        </div>
        <Link
          to="/budgets"
          className="inline-flex items-center rounded-full border border-transparent bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
        >
          Kelola
        </Link>
      </header>

      <div className="mt-6 space-y-4">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-2xl border border-dashed border-border/60 bg-white/60 dark:bg-zinc-900/40" />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 rounded-2xl border border-rose-200/80 bg-rose-50/70 p-4 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        ) : highlights.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-white/60 p-6 text-sm text-muted-foreground shadow-sm dark:border-border/40 dark:bg-zinc-900/40">
            Tandai maksimal dua anggaran di halaman Budgets untuk ditampilkan di sini.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {highlights.map((item) => {
              const progress = Math.max(0, item.percentage);
              const displayProgress = Math.min(progress, 1);
              const plannedLabel = formatCurrency(item.planned, 'IDR');
              const actualLabel = formatCurrency(item.actual, 'IDR');
              const remaining = item.planned - item.actual;
              const remainingLabel = formatCurrency(remaining, 'IDR');
              const remainingClass = remaining < 0 ? 'text-rose-500 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-300';
              return (
                <article
                  key={item.record_id}
                  className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-border/40 dark:bg-zinc-900/70"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{plannedLabel} • {actualLabel} terpakai</p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-muted/20 px-3 py-1 text-xs font-semibold text-muted">
                      {item.badge}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className={remainingClass}>{remaining >= 0 ? `${remainingLabel} sisa` : `${remainingLabel} over`}</span>
                    <span className="font-semibold text-muted">{formatPercentage(progress)}</span>
                  </div>
                  <div className={getTrackColor(progress) + ' h-2 w-full overflow-hidden rounded-full'}>
                    <div
                      className={getProgressColor(progress) + ' h-full rounded-full transition-all'}
                      style={{ width: `${displayProgress * 100}%` }}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
