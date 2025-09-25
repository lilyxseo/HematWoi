import { PiggyBank, Target, TrendingDown, Wallet } from 'lucide-react';
import { formatCurrency } from '../../../lib/format';
import type { BudgetSummary } from '../../../lib/budgetApi';

interface SummaryCardsProps {
  summary: BudgetSummary;
  loading?: boolean;
}

const CARD_BASE_CLASS =
  'rounded-2xl border border-white/20 dark:border-white/5 bg-gradient-to-b from-white/80 to-white/50 dark:from-zinc-900/60 dark:to-zinc-900/30 backdrop-blur shadow-sm';

function SummarySkeleton() {
  return (
    <div className={CARD_BASE_CLASS}>
      <div className="flex h-full flex-col gap-4 p-5">
        <div className="h-4 w-32 animate-pulse rounded-full bg-zinc-200/60 dark:bg-zinc-700/60" />
        <div className="h-8 w-24 animate-pulse rounded-lg bg-zinc-200/70 dark:bg-zinc-700/70" />
        <div className="h-2 w-full animate-pulse rounded-full bg-zinc-200/60 dark:bg-zinc-700/60" />
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
      accent: 'text-brand',
    },
    {
      label: 'Realisasi',
      value: formatCurrency(summary.spent, 'IDR'),
      icon: TrendingDown,
      accent: 'text-brand',
    },
    {
      label: 'Sisa',
      value: formatCurrency(summary.remaining, 'IDR'),
      icon: PiggyBank,
      accent: 'text-brand',
    },
    {
      label: 'Persentase',
      value: `${(progress * 100).toFixed(0)}%`,
      icon: Target,
      accent: 'text-brand',
      progress,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ label, value, icon: Icon, accent, progress: cardProgress }) => (
        <div key={label} className={CARD_BASE_CLASS}>
          <div className="flex h-full flex-col gap-4 p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
              <Icon className={`h-5 w-5 ${accent}`} />
            </div>
            <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</span>
            {typeof cardProgress === 'number' ? (
              <div className="mt-auto">
                <div className="flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  <span>0%</span>
                  <span>100%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-zinc-200/70 dark:bg-zinc-800/70">
                  <div
                    className="h-full rounded-full bg-brand transition-all"
                    style={{ width: `${cardProgress * 100}%` }}
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

