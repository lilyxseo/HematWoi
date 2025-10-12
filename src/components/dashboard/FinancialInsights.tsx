import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarClock,
  Flame,
  Info,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import InsightItem from './financial-insights/InsightItem';
import type { PeriodRange } from './PeriodPicker';
import { formatCurrency } from '../../lib/format';
import {
  getBudgetProgressMTD,
  getDueDebtsIn7Days,
  getTopSpendingMTD,
  getUncategorizedCount,
  type MonthPeriodRange,
} from '../../lib/api-insights';

interface FinancialInsightsProps {
  period?: PeriodRange;
}

function parseJakartaDate(value?: string): Date {
  if (!value) return new Date();
  const parsed = new Date(`${value}T00:00:00+07:00`);
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
}

function getMonthPeriod(range?: PeriodRange): MonthPeriodRange {
  const base = parseJakartaDate(range?.end ?? range?.start);
  const start = new Date(base);
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(base);
  end.setUTCHours(23, 59, 59, 999);
  const month = String(base.getUTCMonth() + 1).padStart(2, '0');
  return {
    periodMonth: `${base.getUTCFullYear()}-${month}`,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  };
}

function formatShare(share: number): string {
  if (!Number.isFinite(share) || share <= 0) return '';
  if (share < 1) return `${share.toFixed(1)}%`; // show decimal for small shares
  return `${Math.round(share)}%`;
}

function formatDueLabel(daysLeft: number): string {
  if (daysLeft <= 0) return 'Jatuh tempo hari ini';
  if (daysLeft === 1) return 'Jatuh tempo besok';
  return `Jatuh tempo dalam ${daysLeft} hari`;
}

function FinancialInsightsSkeleton() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          className="flex items-center gap-3 rounded-2xl border border-dashed border-border/60 bg-card/40 p-3 shadow-sm dark:border-border/40 dark:bg-white/5"
        >
          <div className="h-11 w-11 rounded-2xl bg-muted/40" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-36 rounded-full bg-muted/40" />
            <div className="h-3 w-48 rounded-full bg-muted/30" />
          </div>
          <div className="h-6 w-16 rounded-full bg-muted/40" />
        </div>
      ))}
    </div>
  );
}

export default function FinancialInsights({ period }: FinancialInsightsProps) {
  const navigate = useNavigate();
  const monthPeriod = useMemo(() => getMonthPeriod(period), [period]);

  const topSpendingQuery = useQuery({
    queryKey: ['financial-insights', 'top-spending', monthPeriod.periodMonth, monthPeriod.endDate],
    queryFn: () => getTopSpendingMTD(monthPeriod),
    staleTime: 60_000,
  });

  const budgetQuery = useQuery({
    queryKey: ['financial-insights', 'budgets', monthPeriod.periodMonth],
    queryFn: () => getBudgetProgressMTD(monthPeriod),
    staleTime: 60_000,
  });

  const debtsQuery = useQuery({
    queryKey: ['financial-insights', 'debts-due'],
    queryFn: () => getDueDebtsIn7Days(),
    staleTime: 60_000,
  });

  const uncategorizedQuery = useQuery({
    queryKey: ['financial-insights', 'uncategorized', monthPeriod.periodMonth],
    queryFn: () => getUncategorizedCount(monthPeriod),
    staleTime: 60_000,
  });

  const isLoading =
    topSpendingQuery.isLoading ||
    budgetQuery.isLoading ||
    debtsQuery.isLoading ||
    uncategorizedQuery.isLoading;

  const firstError =
    (topSpendingQuery.error as Error | undefined) ||
    (budgetQuery.error as Error | undefined) ||
    (debtsQuery.error as Error | undefined) ||
    (uncategorizedQuery.error as Error | undefined) ||
    null;

  const handleRetry = () => {
    topSpendingQuery.refetch();
    budgetQuery.refetch();
    debtsQuery.refetch();
    uncategorizedQuery.refetch();
  };

  const items: { key: string; node: ReactNode }[] = [];

  if (topSpendingQuery.data?.categories?.[0]) {
    const top = topSpendingQuery.data.categories[0];
    const shareLabel = formatShare(top.share);
    const merchant = topSpendingQuery.data.topMerchant;
    const subtitleParts = [
      `Kategori ${top.categoryName}`,
      shareLabel ? `${shareLabel} dari total MTD` : null,
      merchant ? `Merchant teratas: ${merchant.merchantName}` : null,
    ].filter(Boolean);

    items.push({
      key: 'insight-top-spending',
      node: (
        <InsightItem
          icon={<Wallet className="h-5 w-5" />}
          title="Pengeluaran terbesar"
          subtitle={subtitleParts.join(' • ')}
          value={formatCurrency(top.total)}
          badge={shareLabel ? { label: shareLabel, tone: 'accent' } : undefined}
          onClick={() => navigate('/transactions?filter=top-spending')}
          ariaLabel="Lihat transaksi kategori pengeluaran terbesar"
        />
      ),
    });
  }

  const nearBudgets = budgetQuery.data?.nearLimit ?? [];
  const overBudgets = budgetQuery.data?.overLimit ?? [];

  nearBudgets.forEach((budget) => {
    const badgeLabel = `${Math.round(budget.progress * 100)}%`;
    const tooltip = `Terpakai ${formatCurrency(budget.actual)} dari batas ${formatCurrency(budget.planned)}`;
    items.push({
      key: `budget-near-${budget.id}`,
      node: (
        <InsightItem
          icon={<AlertTriangle className="h-5 w-5" />}
          title={`Budget hampir melebihi • ${budget.name}`}
          subtitle={`Sisa ${formatCurrency(Math.max(budget.planned - budget.actual, 0))}`}
          value={formatCurrency(budget.actual)}
          badge={{ label: badgeLabel, tone: 'amber', tooltip }}
          progress={budget.progress}
          onClick={() => navigate('/budgets?tab=monthly&filter=near-limit')}
          ariaLabel={`Buka detail budget ${budget.name}`}
        />
      ),
    });
  });

  overBudgets.forEach((budget) => {
    const progressPercent = Math.round(budget.progress * 100);
    const tooltip = `Pengeluaran ${formatCurrency(budget.actual)} dari limit ${formatCurrency(budget.planned)}`;
    items.push({
      key: `budget-over-${budget.id}`,
      node: (
        <InsightItem
          icon={<Flame className="h-5 w-5" />}
          title={`Budget terlampaui • ${budget.name}`}
          subtitle={`Melebihi batas ${formatCurrency(budget.actual - budget.planned)}`}
          value={formatCurrency(budget.actual)}
          badge={{ label: `${progressPercent}%`, tone: 'rose', tooltip }}
          progress={budget.progress}
          onClick={() => navigate('/budgets?tab=monthly&filter=over-limit')}
          ariaLabel={`Budget ${budget.name} telah melampaui batas`}
        />
      ),
    });
  });

  const dueDebts = debtsQuery.data ?? [];
  const maxDebtsToShow = 3;
  const displayedDebts = dueDebts.slice(0, maxDebtsToShow);
  const remainingDebts = dueDebts.length - displayedDebts.length;
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }), []);

  displayedDebts.forEach((item) => {
    const dateText = dateFormatter.format(new Date(item.dueDate));
    const subtitleParts = [dateText, item.subtitle, formatDueLabel(item.daysLeft)].filter(Boolean).join(' • ');
    const tone = item.daysLeft <= 0 ? 'rose' : item.daysLeft <= 2 ? 'amber' : 'accent';
    const icon = item.type === 'subscription' ? <TrendingUp className="h-5 w-5" /> : <CalendarClock className="h-5 w-5" />;
    items.push({
      key: `due-${item.type}-${item.id}`,
      node: (
        <InsightItem
          icon={icon}
          title={item.title}
          subtitle={subtitleParts}
          value={formatCurrency(item.amount)}
          badge={{ label: item.daysLeft <= 0 ? 'Jatuh tempo' : `H-${item.daysLeft}`, tone: tone === 'accent' ? 'accent' : tone }}
          onClick={() => navigate('/debts?filter=due-7')}
          ariaLabel={`Lihat detail ${item.title}`}
        />
      ),
    });
  });

  if (remainingDebts > 0) {
    items.push({
      key: 'due-more',
      node: (
        <InsightItem
          icon={<Info className="h-5 w-5" />}
          title={`${remainingDebts} tagihan lain menunggu`}
          subtitle="Lihat daftar lengkap untuk mengatur prioritas pembayaran"
          badge={{ label: `+${remainingDebts}`, tone: 'neutral' }}
          onClick={() => navigate('/debts?filter=due-7')}
        />
      ),
    });
  }

  const uncategorized = uncategorizedQuery.data ?? 0;
  if (uncategorized > 0) {
    items.push({
      key: 'uncategorized',
      node: (
        <InsightItem
          icon={<Info className="h-5 w-5" />}
          title="Transaksi belum dikategorikan"
          subtitle="Berikan kategori agar laporanmu makin akurat"
          badge={{ label: `${uncategorized}`, tone: 'amber' }}
          onClick={() => navigate('/transactions?filter=uncategorized')}
        />
      ),
    });
  }

  const isEmpty = !isLoading && !firstError && items.length === 0;

  return (
    <section className="rounded-3xl border border-border/60 bg-gradient-to-br from-white via-white to-primary/5 p-6 shadow-sm transition dark:border-border/40 dark:from-zinc-900/60 dark:via-zinc-900/40 dark:to-primary/10">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold text-foreground sm:text-2xl">Financial Insights</h2>
        <p className="text-sm text-muted-foreground">Ringkasan cepat kondisi keuanganmu bulan ini.</p>
      </header>

      <div className="mt-6 space-y-4">
        {isLoading ? (
          <FinancialInsightsSkeleton />
        ) : firstError ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-rose-200/80 bg-rose-50/80 p-4 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100">
            <p>{firstError.message}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="self-start rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-500/20 dark:text-rose-100"
            >
              Coba lagi
            </button>
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border/70 bg-white/70 p-6 text-sm text-muted-foreground shadow-sm dark:border-border/40 dark:bg-white/5">
            <p className="text-base font-medium text-foreground">Semua aman. Tetap lanjut hemat! 🎉</p>
            <button
              type="button"
              onClick={() => navigate('/budgets')}
              className="inline-flex items-center rounded-full bg-[color:var(--accent,theme(colors.sky.500))]/10 px-4 py-2 text-xs font-semibold text-[color:var(--accent,theme(colors.sky.700))] transition hover:bg-[color:var(--accent,theme(colors.sky.500))]/20 dark:text-[color:var(--accent,theme(colors.sky.200))]"
            >
              Lihat anggaran bulanan
            </button>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {items.map((item) => (
              <div key={item.key} className="min-w-0">
                {item.node}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
