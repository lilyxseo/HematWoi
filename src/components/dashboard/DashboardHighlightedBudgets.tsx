import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useBudgets } from '../../hooks/useBudgets';
import { useWeeklyBudgets } from '../../hooks/useWeeklyBudgets';
import {
  listHighlightBudgets,
  type HighlightBudgetSelection,
} from '../../lib/budgetApi';
import { formatCurrency } from '../../lib/format';
import type { PeriodRange } from './PeriodPicker';

interface DashboardHighlightedBudgetsProps {
  period: PeriodRange;
}

type HighlightKind = 'monthly' | 'weekly';

interface HighlightCardData {
  id: string;
  kind: HighlightKind;
  label: string;
  categoryType: 'income' | 'expense' | null;
  planned: number;
  spent: number;
  remaining: number;
  progress: number;
  subtitle?: string;
}

function getBudgetPeriod(range: PeriodRange): string {
  const base = range?.end || range?.start;
  if (!base) {
    const now = new Date();
    const month = `${now.getMonth() + 1}`.padStart(2, '0');
    return `${now.getFullYear()}-${month}`;
  }
  return base.slice(0, 7);
}

function getProgressColor(progress: number): string {
  const value = progress * 100;
  if (value <= 74) return 'var(--accent)';
  if (value <= 89) return '#f59e0b';
  if (value <= 100) return '#fb923c';
  return '#f43f5e';
}

function formatWeekRange(start: string, end: string) {
  try {
    const formatter = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' });
    return `${formatter.format(new Date(`${start}T00:00:00.000Z`))} – ${formatter.format(new Date(`${end}T00:00:00.000Z`))}`;
  } catch (error) {
    return `${start} – ${end}`;
  }
}

function HighlightSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 2 }).map((_, index) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          className="flex flex-col gap-3 rounded-2xl border border-dashed border-border/60 bg-white/40 p-4 shadow-sm dark:border-border/40 dark:bg-white/5"
        >
          <div className="h-4 w-36 rounded-full bg-muted/40" />
          <div className="space-y-2">
            <div className="h-3 w-24 rounded-full bg-muted/30" />
            <div className="h-3 w-32 rounded-full bg-muted/30" />
          </div>
          <div className="h-2 rounded-full bg-muted/20" />
        </div>
      ))}
    </div>
  );
}

export default function DashboardHighlightedBudgets({ period }: DashboardHighlightedBudgetsProps) {
  const [highlights, setHighlights] = useState<HighlightBudgetSelection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const budgetPeriod = useMemo(() => getBudgetPeriod(period), [period]);
  const monthly = useBudgets(budgetPeriod);
  const weekly = useWeeklyBudgets(budgetPeriod);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    listHighlightBudgets()
      .then((data) => {
        if (!active) return;
        setHighlights(data);
      })
      .catch((err) => {
        if (!active) return;
        const message = err instanceof Error ? err.message : 'Gagal memuat highlight';
        setError(message);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const cards = useMemo<HighlightCardData[]>(() => {
    if (loading || monthly.loading || weekly.loading) return [];
    if (!highlights.length) return [];

    const monthlyMap = new Map(monthly.rows.map((row) => [String(row.id), row]));
    const weeklyMap = new Map(weekly.rows.map((row) => [String(row.id), row]));

    return highlights
      .map((item) => {
        if (item.budget_type === 'monthly') {
          const row = monthlyMap.get(String(item.budget_id));
          if (!row) return null;
          const planned = Number(row.amount_planned ?? 0);
          const spent = Number(row.spent ?? 0);
          const remaining = planned - spent;
          const progress = planned > 0 ? Math.min(spent / planned, 2) : 0;
          return {
            id: `${item.id}-monthly`,
            kind: 'monthly' as HighlightKind,
            label: row.category?.name ?? 'Tanpa kategori',
            categoryType: row.category?.type ?? null,
            planned,
            spent,
            remaining,
            progress,
          } satisfies HighlightCardData;
        }

        const row = weeklyMap.get(String(item.budget_id));
        if (!row) return null;
        const planned = Number(row.amount_planned ?? 0);
        const spent = Number(row.spent ?? 0);
        const remaining = planned - spent;
        const progress = planned > 0 ? Math.min(spent / planned, 2) : 0;
        const weekMeta = weekly.weeks.find((week) => week.start === row.week_start);
        const subtitleParts: string[] = [];
        if (weekMeta) {
          subtitleParts.push(weekMeta.label);
        }
        subtitleParts.push(formatWeekRange(row.week_start, row.week_end));
        return {
          id: `${item.id}-weekly`,
          kind: 'weekly' as HighlightKind,
          label: row.category?.name ?? 'Tanpa kategori',
          categoryType: row.category?.type ?? null,
          planned,
          spent,
          remaining,
          progress,
          subtitle: subtitleParts.join(' • '),
        } satisfies HighlightCardData;
      })
      .filter((card): card is HighlightCardData => Boolean(card));
  }, [highlights, loading, monthly.loading, monthly.rows, weekly.loading, weekly.rows, weekly.weeks]);

  const isLoading = loading || monthly.loading || weekly.loading;
  const displayError = error || monthly.error || weekly.error;

  return (
    <section className="rounded-3xl border border-border/60 bg-gradient-to-br from-white via-white to-primary/5 p-6 shadow-sm transition dark:border-border/40 dark:from-zinc-900/60 dark:via-zinc-900/40 dark:to-primary/10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Highlighted Budgets
          </span>
          <h2 className="text-xl font-semibold text-foreground sm:text-2xl">Anggaran pilihanmu</h2>
          <p className="text-sm text-muted-foreground">Pantau cepat progres anggaran favoritmu tanpa harus membuka halaman anggaran.</p>
        </div>
        <Link
          to="/budgets"
          className="inline-flex items-center gap-2 rounded-full border border-transparent bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          Kelola Highlight
          <ArrowRight className="h-4 w-4" />
        </Link>
      </header>

      <div className="mt-6">
        {isLoading ? (
          <HighlightSkeleton />
        ) : displayError ? (
          <div className="flex items-center gap-3 rounded-2xl border border-rose-200/80 bg-rose-50/70 p-4 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
            <AlertTriangle className="h-4 w-4" />
            {displayError}
          </div>
        ) : cards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-white/60 p-6 text-sm text-muted-foreground shadow-sm dark:border-border/40 dark:bg-white/5">
            Belum ada highlight. Pilih hingga dua anggaran favoritmu di halaman Budgets untuk ditampilkan di sini.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {cards.map((card) => {
              const progress = Math.min(1.2, Math.max(0, card.progress));
              const color = getProgressColor(progress);
              const badge = card.kind === 'monthly' ? 'Bulanan' : 'Mingguan';
              const remainingLabel = card.remaining >= 0 ? formatCurrency(card.remaining, 'IDR') : `-${formatCurrency(Math.abs(card.remaining), 'IDR')}`;
              return (
                <article
                  key={card.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-border/40 dark:bg-zinc-900/70"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{card.label}</p>
                      {card.subtitle ? (
                        <p className="text-xs text-muted-foreground">{card.subtitle}</p>
                      ) : null}
                    </div>
                    <span className="inline-flex items-center rounded-full bg-muted/30 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">
                      {badge}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div>
                      <span className="block text-[0.68rem] uppercase tracking-[0.18em] text-muted">Planned</span>
                      <span className="text-sm font-semibold text-foreground">{formatCurrency(card.planned, 'IDR')}</span>
                    </div>
                    <div>
                      <span className="block text-[0.68rem] uppercase tracking-[0.18em] text-muted">Actual</span>
                      <span className="text-sm font-semibold text-foreground">{formatCurrency(card.spent, 'IDR')}</span>
                    </div>
                    <div>
                      <span className="block text-[0.68rem] uppercase tracking-[0.18em] text-muted">Sisa</span>
                      <span className={card.remaining < 0 ? 'text-sm font-semibold text-rose-500' : 'text-sm font-semibold text-emerald-600'}>
                        {remainingLabel}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>{Math.round(card.progress * 100)}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted/20 dark:bg-muted/30">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, Math.max(0, card.progress * 100))}%`,
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

