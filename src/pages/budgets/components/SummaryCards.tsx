import clsx from 'clsx';
import { Gauge, PiggyBank, Target, TrendingDown, Wallet } from 'lucide-react';
import { formatCurrency } from '../../../lib/format';
import type { BudgetSummary } from '../../../lib/budgetApi';

interface SummaryCardsProps {
  summary: BudgetSummary;
  loading?: boolean;
}

const CARD_BASE_CLASS =
  'relative overflow-hidden rounded-3xl border border-border/60 bg-surface/80 shadow-lg ring-1 ring-inset ring-border/60 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-xl dark:bg-surface-2/80';

function SummarySkeleton() {
  return (
    <div className={CARD_BASE_CLASS}>
      <div className="flex h-full flex-col gap-4 p-6">
        <div className="h-4 w-32 animate-pulse rounded-full bg-muted/60" />
        <div className="h-8 w-24 animate-pulse rounded-lg bg-muted/60" />
        <div className="h-2 w-full animate-pulse rounded-full bg-muted/60" />
      </div>
    </div>
  );
}

export default function SummaryCards({ summary, loading }: SummaryCardsProps) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <SummarySkeleton key={index} />
        ))}
      </div>
    );
  }

  const progress = Math.min(Math.max(summary.percentage, 0), 1);

  const cards = [
    {
      label: 'Total Anggaran',
      value: formatCurrency(summary.planned, 'IDR'),
      icon: Wallet,
      accent: 'text-sky-600 dark:text-sky-400',
      gradient: 'from-sky-500/20 via-sky-400/10 to-transparent',
      iconBg: 'bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300',
    },
    {
      label: 'Realisasi',
      value: formatCurrency(summary.spent, 'IDR'),
      icon: TrendingDown,
      accent: 'text-emerald-600 dark:text-emerald-400',
      gradient: 'from-emerald-500/20 via-emerald-400/10 to-transparent',
      iconBg: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300',
    },
    {
      label: 'Sisa',
      value: formatCurrency(summary.remaining, 'IDR'),
      icon: PiggyBank,
      accent: 'text-purple-600 dark:text-purple-400',
      gradient: 'from-purple-500/20 via-purple-400/10 to-transparent',
      iconBg: 'bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-300',
    },
    {
      label: 'Persentase',
      value: `${(progress * 100).toFixed(0)}%`,
      icon: Target,
      accent: 'text-orange-600 dark:text-orange-400',
      gradient: 'from-orange-500/20 via-orange-400/10 to-transparent',
      iconBg: 'bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300',
      progress,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ label, value, icon: Icon, accent, gradient, iconBg, progress: cardProgress }) => (
        <div key={label} className={CARD_BASE_CLASS}>
          <div className={clsx('absolute inset-0 bg-gradient-to-br opacity-90', gradient)} aria-hidden />
          <div className="relative flex h-full flex-col gap-5 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
                <p className="mt-2 text-3xl font-bold text-text">{value}</p>
              </div>
              <div className={clsx('flex h-12 w-12 items-center justify-center rounded-2xl shadow-inner shadow-black/5', iconBg)}>
                <Icon className={clsx('h-6 w-6', accent)} />
              </div>
            </div>

            {typeof cardProgress === 'number' ? (
              <div className="mt-auto space-y-3">
                <div className="flex items-center justify-between text-xs font-medium text-muted">
                  <span>Penggunaan</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-background/60 px-2 py-0.5 font-semibold text-text">
                    <Gauge className="h-3 w-3" />
                    {(cardProgress * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="relative h-2 overflow-hidden rounded-full bg-muted/40">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand via-brand/80 to-brand/60 transition-all"
                    style={{ width: `${Math.max(6, cardProgress * 100)}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

