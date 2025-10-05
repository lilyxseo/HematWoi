import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { formatCurrency } from '../../lib/format';
import {
  listHighlightedBudgetDetails,
  type HighlightedBudgetDetail,
} from '../../lib/budgetApi';
import type { PeriodRange } from './PeriodPicker';

interface DashboardHighlightedBudgetsProps {
  period: PeriodRange;
}

const PROGRESS_COLORS = {
  accent: 'var(--accent)',
  amber: '#f59e0b',
  orange: '#fb923c',
  rose: '#f43f5e',
} as const;

function getMonthFromRange(range: PeriodRange): string {
  const base = range?.end || range?.start;
  if (!base) {
    const now = new Date();
    return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}`;
  }
  return base.slice(0, 7);
}

function getProgressColor(percentage: number): string {
  const percent = Math.round(percentage * 100);
  if (percent <= 74) return PROGRESS_COLORS.accent;
  if (percent <= 89) return PROGRESS_COLORS.amber;
  if (percent <= 100) return PROGRESS_COLORS.orange;
  return PROGRESS_COLORS.rose;
}

function formatPercentage(value: number): string {
  return `${Math.round(Math.min(value, 2) * 100)}%`;
}

function useHighlightedBudgets(period: string) {
  const [rows, setRows] = useState<HighlightedBudgetDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    listHighlightedBudgetDetails(period)
      .then((data) => {
        if (!active) return;
        setRows(data);
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message = err instanceof Error ? err.message : 'Gagal memuat highlight';
        setError(message);
        setRows([]);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [period]);

  return { rows, loading, error };
}

function SkeletonCard() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-border/60 bg-surface/70 p-4 shadow-inner">
      <div className="h-4 w-32 animate-pulse rounded-full bg-muted/50" />
      <div className="h-3 w-20 animate-pulse rounded-full bg-muted/40" />
      <div className="h-2 w-full animate-pulse rounded-full bg-muted/40" />
    </div>
  );
}

export default function DashboardHighlightedBudgets({ period }: DashboardHighlightedBudgetsProps) {
  const periodMonth = useMemo(() => getMonthFromRange(period), [period]);
  const { rows, loading, error } = useHighlightedBudgets(periodMonth);

  return (
    <section className="rounded-3xl border border-border/60 bg-surface/80 p-6 shadow-sm transition dark:border-border/40 dark:bg-zinc-900/60">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
            <Sparkles className="h-3.5 w-3.5" />
            Highlighted Budgets
          </div>
          <h2 className="text-xl font-semibold text-text">Fokus Anggaranmu</h2>
          <p className="text-sm text-muted">Pantau cepat 1-2 anggaran pilihanmu untuk bulan ini.</p>
        </div>
      </header>

      <div className="mt-6 space-y-4">
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 rounded-2xl border border-rose-200/70 bg-rose-50/70 p-4 text-sm text-rose-600 shadow-sm dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-surface/70 p-6 text-sm text-muted shadow-inner">
            Belum ada anggaran yang di-highlight. Tandai maksimal dua anggaran di halaman Budgets.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {rows.map((item) => {
              const planned = Number(item.planned ?? 0);
              const actual = Number(item.actual ?? 0);
              const remaining = planned - actual;
              const ratio = planned > 0 ? actual / planned : 0;
              const percentLabel = formatPercentage(ratio);
              const color = getProgressColor(ratio);
              return (
                <article
                  key={item.highlight_id}
                  className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-surface/90 p-4 shadow-sm dark:border-border/40 dark:bg-zinc-900/70"
                >
                  <header className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-text">{item.category_name ?? 'Tanpa kategori'}</p>
                      <p className="text-xs text-muted">{item.category_type === 'income' ? 'Pemasukan' : 'Pengeluaran'}</p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-muted/20 px-3 py-1 text-[0.7rem] font-medium text-muted">
                      {item.label}
                    </span>
                  </header>

                  <div className="grid gap-3 text-sm text-muted sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted">Planned</p>
                      <p className="text-sm font-semibold text-text">{formatCurrency(planned, 'IDR')}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted">Actual</p>
                      <p className="text-sm font-semibold text-text">{formatCurrency(actual, 'IDR')}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted">Sisa</p>
                      <p className={`text-sm font-semibold ${remaining < 0 ? 'text-rose-500 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-300'}`}>
                        {formatCurrency(remaining, 'IDR')}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-muted">
                      <span>Progres</span>
                      <span>{percentLabel}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted/20">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(ratio * 100, 100)}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
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
