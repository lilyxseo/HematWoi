import { useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarClock,
  Flame,
  Info,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import InsightItem from './InsightItem';
import ProgressTiny from './ProgressTiny';
import {
  getBudgetProgressMTD,
  getDueDebtsIn7Days,
  getTopSpendingMTD,
  getWeeklyTrend,
  getUncategorizedCount,
  type BudgetProgressInsight,
} from '../../lib/api-insights';
import { formatCurrency } from '../../lib/format';

const PERIOD_STALE_TIME = 60_000;
const MAX_BUDGET_ITEMS = 3;
const MAX_DEBT_ITEMS = 3;

function useCurrentPeriodMonth(): string {
  return useMemo(() => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${now.getFullYear()}-${month}`;
  }, []);
}

function formatPercent(value: number, fractionDigits = 0): string {
  const formatter = new Intl.NumberFormat('id-ID', {
    style: 'percent',
    maximumFractionDigits: fractionDigits,
  });
  return formatter.format(value);
}

function formatShortDate(isoDate: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    return formatter.format(new Date(`${isoDate}T00:00:00Z`));
  } catch (error) {
    if (import.meta.env?.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[HW][FinancialInsights] Failed format date', error);
    }
    return isoDate;
  }
}

function buildBudgetDescription(entry: BudgetProgressInsight): string {
  const planned = formatCurrency(entry.planned);
  const actual = formatCurrency(entry.actual);
  return `${actual} dari ${planned}`;
}

function buildBudgetTooltip(entry: BudgetProgressInsight): string {
  const percent = Math.round(entry.progress * 100);
  const planned = formatCurrency(entry.planned);
  return `${percent}% dari limit ${planned}`;
}

function FinancialInsightsSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          className="flex min-h-[3.25rem] items-center gap-3 rounded-2xl border border-dashed border-border/60 bg-surface-1/40 p-3"
        >
          <span className="h-9 w-9 flex-shrink-0 rounded-full bg-muted/30" />
          <span className="flex flex-1 flex-col gap-2">
            <span className="h-3 w-32 rounded-full bg-muted/30" />
            <span className="h-2.5 w-24 rounded-full bg-muted/20" />
          </span>
        </div>
      ))}
    </div>
  );
}

export default function FinancialInsights() {
  const navigate = useNavigate();
  const periodMonth = useCurrentPeriodMonth();

  const topSpendingQuery = useQuery({
    queryKey: ['financial-insights', 'top-spending', periodMonth],
    queryFn: () => getTopSpendingMTD(periodMonth),
    staleTime: PERIOD_STALE_TIME,
  });

  const budgetProgressQuery = useQuery({
    queryKey: ['financial-insights', 'budget-progress', periodMonth],
    queryFn: () => getBudgetProgressMTD(periodMonth),
    staleTime: PERIOD_STALE_TIME,
  });

  const dueDebtsQuery = useQuery({
    queryKey: ['financial-insights', 'due-debts'],
    queryFn: () => getDueDebtsIn7Days(),
    staleTime: PERIOD_STALE_TIME,
  });

  const weeklyTrendQuery = useQuery({
    queryKey: ['financial-insights', 'weekly-trend'],
    queryFn: () => getWeeklyTrend(),
    staleTime: PERIOD_STALE_TIME,
  });

  const uncategorizedQuery = useQuery({
    queryKey: ['financial-insights', 'uncategorized', periodMonth],
    queryFn: () => getUncategorizedCount(periodMonth),
    staleTime: PERIOD_STALE_TIME,
  });

  const queries = [
    topSpendingQuery,
    budgetProgressQuery,
    dueDebtsQuery,
    weeklyTrendQuery,
    uncategorizedQuery,
  ];

  const isLoading = queries.some((query) => query.status === 'pending');
  const isError = queries.some((query) => query.status === 'error');
  const firstError = queries.find((query) => query.error)?.error as Error | undefined;

  const budgetEntries = budgetProgressQuery.data?.entries ?? [];
  const budgetSummary = budgetProgressQuery.data?.summary;

  const nearLimit = budgetEntries
    .filter((entry) => entry.progress >= 0.8 && entry.progress < 1)
    .sort((a, b) => b.progress - a.progress);
  const overLimit = budgetEntries
    .filter((entry) => entry.progress >= 1)
    .sort((a, b) => b.progress - a.progress);

  const visibleNearLimit = nearLimit.slice(0, MAX_BUDGET_ITEMS);
  const visibleOverLimit = overLimit.slice(0, MAX_BUDGET_ITEMS);
  const nearLimitExtra = nearLimit.length - visibleNearLimit.length;
  const overLimitExtra = overLimit.length - visibleOverLimit.length;

  const dueReminders = dueDebtsQuery.data ?? [];
  const visibleDebts = dueReminders.slice(0, MAX_DEBT_ITEMS);
  const debtExtra = dueReminders.length - visibleDebts.length;

  const weeklyTrend = weeklyTrendQuery.data;
  const uncategorizedCount = uncategorizedQuery.data ?? 0;
  const topSpending = topSpendingQuery.data;

  const items = [] as JSX.Element[];

  if (topSpending) {
    const shareLabel = formatPercent(topSpending.share, 0);
    items.push(
      <InsightItem
        key="top-spending"
        icon={<Flame className="h-4 w-4" />}
        title="Pengeluaran Terbesar"
        description={`${topSpending.categoryName} — ${formatCurrency(topSpending.amount)}`}
        badge={{ label: shareLabel, tone: topSpending.share >= 0.4 ? 'rose' : 'accent', tooltip: `Kontribusi ${shareLabel} dari total pengeluaran bulan ini` }}
        onClick={() => navigate(`/transactions?filter=top-spending&period=${periodMonth}`)}
        ariaLabel={`Lihat pengeluaran terbesar kategori ${topSpending.categoryName}`}
      />
    );
  }

  visibleNearLimit.forEach((entry) => {
    items.push(
      <InsightItem
        key={`near-limit-${entry.budgetId}`}
        icon={<AlertTriangle className="h-4 w-4" />}
        title={`Budget hampir limit — ${entry.categoryName}`}
        description={buildBudgetDescription(entry)}
        badge={{
          label: formatPercent(Math.min(entry.progress, 1), 0),
          tone: 'amber',
          tooltip: buildBudgetTooltip(entry),
        }}
        onClick={() => navigate(`/budgets?tab=monthly&filter=near-limit&period=${periodMonth}`)}
        ariaLabel={`Budget ${entry.categoryName} hampir habis`}
      >
        <ProgressTiny value={entry.progress} tone="amber" />
      </InsightItem>
    );
  });

  if (nearLimitExtra > 0) {
    items.push(
      <InsightItem
        key="near-limit-more"
        icon={<AlertTriangle className="h-4 w-4" />}
        title={`Ada ${nearLimitExtra} anggaran lain mendekati limit`}
        description="Segera cek dan sesuaikan pengeluaranmu."
        badge={{ label: 'Lihat', tone: 'amber' }}
        onClick={() => navigate(`/budgets?tab=monthly&filter=near-limit&period=${periodMonth}`)}
      />
    );
  }

  visibleOverLimit.forEach((entry) => {
    items.push(
      <InsightItem
        key={`over-limit-${entry.budgetId}`}
        icon={<Flame className="h-4 w-4" />}
        title={`Budget terlampaui — ${entry.categoryName}`}
        description={buildBudgetDescription(entry)}
        badge={{
          label: formatPercent(entry.progress, 0),
          tone: 'rose',
          tooltip: buildBudgetTooltip(entry),
        }}
        onClick={() => navigate(`/budgets?tab=monthly&filter=over-limit&period=${periodMonth}`)}
        ariaLabel={`Budget ${entry.categoryName} sudah terlampaui`}
      >
        <ProgressTiny value={entry.progress} tone="rose" />
      </InsightItem>
    );
  });

  if (overLimitExtra > 0) {
    items.push(
      <InsightItem
        key="over-limit-more"
        icon={<Flame className="h-4 w-4" />}
        title={`Ada ${overLimitExtra} anggaran lain terlampaui`}
        description="Periksa prioritas dan realokasi dana."
        badge={{ label: 'Atur', tone: 'rose' }}
        onClick={() => navigate(`/budgets?tab=monthly&filter=over-limit&period=${periodMonth}`)}
      />
    );
  }

  visibleDebts.forEach((reminder) => {
    const dueLabel = reminder.daysLeft <= 0 ? 'Hari ini' : `H-${reminder.daysLeft}`;
    const tone = reminder.daysLeft <= 1 ? 'rose' : 'amber';
    const subtitle = `${formatShortDate(reminder.dueDate)} • ${formatCurrency(reminder.amount)}`;
    const noteSuffix = reminder.note ? ` • ${reminder.note}` : '';
    items.push(
      <InsightItem
        key={`due-${reminder.source}-${reminder.id}`}
        icon={<CalendarClock className="h-4 w-4" />}
        title={`Jatuh tempo ${reminder.source === 'debt' ? 'hutang' : 'langganan'}`}
        description={`${subtitle}${noteSuffix}`}
        badge={{ label: dueLabel, tone }}
        onClick={() => navigate('/debts?filter=due-7')}
        ariaLabel={`Hutang jatuh tempo ${dueLabel}`}
      />
    );
  });

  if (debtExtra > 0) {
    items.push(
      <InsightItem
        key="due-more"
        icon={<CalendarClock className="h-4 w-4" />}
        title={`+${debtExtra} tagihan lain jatuh tempo`}
        description="Selesaikan sebelum telat supaya tidak kena denda."
        badge={{ label: 'Lihat', tone: 'amber' }}
        onClick={() => navigate('/debts?filter=due-7')}
      />
    );
  }

  if (weeklyTrend && (weeklyTrend.current > 0 || weeklyTrend.previous > 0)) {
    const changePct = weeklyTrend.changePct ?? 0;
    const isIncrease = changePct > 0.001;
    const badgeTone = isIncrease ? 'rose' : 'accent';
    const badgeLabel = `${changePct >= 0 ? '+' : ''}${Math.round(changePct * 100)}%`;
    items.push(
      <InsightItem
        key="weekly-trend"
        icon={<TrendingUp className="h-4 w-4" />}
        title="Tren pengeluaran 7 hari"
        description={`${formatCurrency(weeklyTrend.current)} vs ${formatCurrency(weeklyTrend.previous)} minggu lalu`}
        badge={{ label: badgeLabel, tone: badgeTone }}
        onClick={() => navigate('/transactions?filter=weekly-trend')}
        ariaLabel="Lihat detail tren pengeluaran mingguan"
      />
    );
  }

  if (uncategorizedCount > 0) {
    items.push(
      <InsightItem
        key="uncategorized"
        icon={<Info className="h-4 w-4" />}
        title="Transaksi belum dikategorikan"
        description={`${uncategorizedCount} transaksi menunggu ditandai kategori.`}
        badge={{ label: `${uncategorizedCount}`, tone: 'amber' }}
        onClick={() => navigate(`/transactions?filter=uncategorized&period=${periodMonth}`)}
        ariaLabel="Lihat transaksi belum dikategorikan"
      />
    );
  }

  if (
    budgetSummary &&
    budgetSummary.plannedTotal > 0 &&
    budgetSummary.remainingTotal > 0 &&
    budgetSummary.daysInPeriod > budgetSummary.daysElapsed
  ) {
    const daysLeft = budgetSummary.daysInPeriod - budgetSummary.daysElapsed;
    const averageDaily = budgetSummary.daysElapsed > 0 ? budgetSummary.actualTotal / budgetSummary.daysElapsed : 0;
    const projected = budgetSummary.actualTotal + averageDaily * daysLeft;
    items.push(
      <InsightItem
        key="budget-summary"
        icon={<Wallet className="h-4 w-4" />}
        title="Sisa anggaran bulan ini"
        description={`${formatCurrency(budgetSummary.remainingTotal)} tersisa • Proyeksi ${formatCurrency(projected)}`}
        badge={{ label: `${daysLeft} hari`, tone: 'accent', tooltip: `Rata-rata harian ${formatCurrency(averageDaily)}` }}
        onClick={() => navigate(`/budgets?tab=monthly&period=${periodMonth}`)}
        ariaLabel="Lihat ringkasan anggaran bulan ini"
      />
    );
  }

  const hasInsights = items.length > 0;

  return (
    <section
      className="card animate-slide h-full space-y-5 rounded-3xl border border-border/60 bg-surface-1/90 p-6 shadow-sm dark:border-border/40 dark:bg-surface-1/60"
      aria-labelledby="financial-insights-title"
    >
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 id="financial-insights-title" className="text-lg font-semibold text-foreground">
            Financial Insights
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">Ringkasan cepat kondisi keuanganmu bulan ini.</p>
      </header>

      {isLoading ? (
        <FinancialInsightsSkeleton />
      ) : isError ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-rose-500/60 bg-rose-500/10 p-4 text-sm text-rose-100">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            {firstError?.message ?? 'Gagal memuat insight.'}
          </div>
          <button
            type="button"
            className="inline-flex w-max items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-100 transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
            onClick={() => queries.forEach((query) => query.refetch())}
          >
            Coba lagi
          </button>
        </div>
      ) : hasInsights ? (
        <div className="grid gap-3 md:grid-cols-2">{items}</div>
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border/60 bg-surface-1/60 p-5 text-sm text-muted-foreground">
          <span className="text-base font-semibold text-foreground">Semua aman. Tetap lanjut hemat! 🎉</span>
          <p className="text-sm text-muted-foreground/90">
            Cek ulang anggaran bulananmu untuk memastikan setiap kategori tetap on track.
          </p>
          <Link
            to="/budgets?tab=monthly"
            className="inline-flex items-center rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand transition hover:bg-brand/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] focus-visible:ring-offset-2"
          >
            Kelola Budget
          </Link>
        </div>
      )}
    </section>
  );
}
