import { useMemo } from 'react';
import { AlertTriangle, ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useBudgets } from '../../hooks/useBudgets';
import { useWeeklyBudgets } from '../../hooks/useWeeklyBudgets';
import { type HighlightBudgetSelection } from '../../lib/budgetApi';
import { formatCurrency } from '../../lib/format';
import type { PeriodRange } from './PeriodPicker';
import { useHighlightBudgets } from '../../hooks/useHighlightBudgets';
import useSupabaseUser from '../../hooks/useSupabaseUser';
import { getSalarySimulations } from '../../lib/salarySimulationApi';

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

function formatIsoDateUTC(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekRangeForIsoDate(isoDate: string | null | undefined) {
  let reference = new Date();
  if (isoDate) {
    const parsed = new Date(`${isoDate}T00:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime())) {
      reference = parsed;
    }
  }
  const start = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate()));
  const day = start.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  start.setUTCDate(start.getUTCDate() - diff);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { start: formatIsoDateUTC(start), end: formatIsoDateUTC(end) };
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

function formatMonthLabel(period: string) {
  try {
    const date = new Date(`${period}-01T00:00:00.000Z`);
    return new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' }).format(date);
  } catch (error) {
    return period;
  }
}

function getNextPeriod(referenceDate: Date = new Date()) {
  const nextMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1);
  const year = nextMonth.getFullYear();
  const month = `${nextMonth.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

function isNearMonthEnd(referenceDate: Date = new Date(), thresholdDays = 7) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const daysRemaining = lastDayOfMonth - referenceDate.getDate();
  return daysRemaining <= thresholdDays;
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
  const { user } = useSupabaseUser();
  const highlightQuery = useHighlightBudgets();
  const highlights = highlightQuery.data ?? [];
  const loading = highlightQuery.isLoading;
  const error = highlightQuery.error instanceof Error ? highlightQuery.error.message : null;

  const budgetPeriod = useMemo(() => getBudgetPeriod(period), [period]);
  const nextBudgetPeriod = useMemo(() => getNextPeriod(), []);
  const nearMonthEnd = useMemo(() => isNearMonthEnd(), []);
  const referenceDateIso = period?.end || period?.start || new Date().toISOString().slice(0, 10);
  const activeWeekStart = useMemo(
    () => getWeekRangeForIsoDate(referenceDateIso).start,
    [referenceDateIso]
  );
  const monthly = useBudgets(budgetPeriod);
  const weekly = useWeeklyBudgets(budgetPeriod);
  const nextSimulationQuery = useQuery({
    queryKey: ['salary-simulations', 'next', nextBudgetPeriod, user?.id],
    queryFn: () => getSalarySimulations(user?.id, { periodMonth: nextBudgetPeriod }),
    enabled: Boolean(user?.id && nearMonthEnd),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

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
            subtitle: formatMonthLabel(budgetPeriod),
          } satisfies HighlightCardData;
        }

        let row = weeklyMap.get(String(item.budget_id));
        if (!row) return null;

        if (row.week_start !== activeWeekStart && row.category_id) {
          const currentWeekRow = weekly.rows.find(
            (candidate) =>
              candidate.category_id === row.category_id && candidate.week_start === activeWeekStart
          );
          if (currentWeekRow) {
            row = currentWeekRow;
          }
        }

        if (row.week_start !== activeWeekStart) {
          return null;
        }

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
  }, [
    activeWeekStart,
    highlights,
    loading,
    monthly.loading,
    monthly.rows,
    weekly.loading,
    weekly.rows,
    weekly.weeks,
  ]);

  const isLoading = loading || monthly.loading || weekly.loading;
  const displayError = error || monthly.error || weekly.error;
  const shouldShowSimulationReminder =
    nearMonthEnd &&
    Boolean(user?.id) &&
    !nextSimulationQuery.isLoading &&
    !nextSimulationQuery.error &&
    (nextSimulationQuery.data?.length ?? 0) === 0;

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-border/60 bg-gradient-to-br from-white/90 via-white/70 to-primary/10 p-6 shadow-sm transition dark:border-border/40 dark:from-slate-900/80 dark:via-slate-900/60 dark:to-primary/15 sm:p-8">
      <span className="pointer-events-none absolute right-0 top-0 h-32 w-32 -translate-y-10 translate-x-10 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Anggaran pilihan
          </span>
          <h2 className="text-xl font-semibold text-foreground sm:text-2xl">Anggaran pilihanmu</h2>
          <p className="text-sm text-muted-foreground">Pantau progres anggaran favorit dengan tampilan ringkas dan premium.</p>
        </div>
        <Link
          to="/budgets"
          className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary shadow-sm transition hover:border-primary/50 hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          Kelola Highlight
          <ArrowRight className="h-4 w-4" />
        </Link>
      </header>

      <div className="mt-6 space-y-4">
        {shouldShowSimulationReminder ? (
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/80 p-4 text-sm text-amber-700 shadow-sm dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <div>
                <p className="font-semibold">Bulan baru sudah dekat.</p>
                <p>
                  Simulasi anggaran untuk {formatMonthLabel(nextBudgetPeriod)} belum dibuat. Siapkan dari sekarang agar
                  budget bulan depan lebih siap.
                </p>
              </div>
            </div>
            <Link
              to="/budgets/simulation/salary"
              className="inline-flex items-center gap-2 rounded-full border border-amber-300/70 bg-amber-100/80 px-4 py-2 text-xs font-semibold text-amber-700 transition hover:border-amber-400 hover:bg-amber-100 dark:border-amber-400/60 dark:bg-amber-500/10 dark:text-amber-100"
            >
              Buat simulasi
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : null}
        {isLoading ? (
          <HighlightSkeleton />
        ) : displayError ? (
          <div className="flex items-center gap-3 rounded-2xl border border-rose-200/80 bg-rose-50/70 p-4 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
            <AlertTriangle className="h-4 w-4" />
            {displayError}
          </div>
        ) : cards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-white/70 p-6 text-sm text-muted-foreground shadow-sm dark:border-border/40 dark:bg-white/5">
            Belum ada highlight. Pilih anggaran favoritmu di halaman Budgets untuk ditampilkan di sini.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => {
              const progress = Math.min(1.2, Math.max(0, card.progress));
              const color = getProgressColor(progress);
              const badge = card.kind === 'monthly' ? 'Bulanan' : 'Mingguan';
              const remainingLabel = card.remaining >= 0 ? formatCurrency(card.remaining, 'IDR') : `-${formatCurrency(Math.abs(card.remaining), 'IDR')}`;
              return (
                <article
                  key={card.id}
                  className="group relative flex flex-col gap-4 overflow-hidden rounded-3xl border border-border/60 bg-white/90 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md dark:border-border/40 dark:bg-slate-900/70"
                >
                  <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/60 via-primary/30 to-transparent" aria-hidden="true" />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{card.label}</p>
                      {card.subtitle ? (
                        <p className="text-xs text-muted-foreground">{card.subtitle}</p>
                      ) : null}
                    </div>
                    <span className="inline-flex items-center rounded-full border border-border-subtle/70 bg-surface-alt/80 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">
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
                        className="h-full rounded-full transition-all duration-300"
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
