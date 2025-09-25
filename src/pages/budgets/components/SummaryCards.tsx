import { PiggyBank, Target, TrendingDown, Wallet } from 'lucide-react';
import { formatCurrency } from '../../../lib/format';
import type { BudgetSummary } from '../../../lib/budgetApi';

interface SummaryCardsProps {
  summary: BudgetSummary;
  loading?: boolean;
}

const CARD_BASE_CLASS = 'card h-full';

function SummarySkeleton() {
  return (
    <div className={CARD_BASE_CLASS}>
      <div className="flex h-full flex-col gap-4 p-5">
        <div className="h-4 w-32 animate-pulse rounded-full bg-surface-alt" />
        <div className="h-8 w-24 animate-pulse rounded-lg bg-surface-alt" />
        <div className="h-2 w-full animate-pulse rounded-full bg-surface-alt" />
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
      accent: 'text-primary',
    },
    {
      label: 'Realisasi',
      value: formatCurrency(summary.spent, 'IDR'),
      icon: TrendingDown,
      accent: 'text-info',
    },
    {
      label: 'Sisa',
      value: formatCurrency(summary.remaining, 'IDR'),
      icon: PiggyBank,
      accent: 'text-success',
    },
    {
      label: 'Persentase',
      value: `${(progress * 100).toFixed(0)}%`,
      icon: Target,
      accent: 'text-warning',
      progress,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ label, value, icon: Icon, accent, progress: cardProgress }) => (
        <div key={label} className={CARD_BASE_CLASS}>
          <div className="flex h-full flex-col gap-4 p-5">
            <div className="flex items-center justify-between text-sm text-muted">
              <span>{label}</span>
              <Icon className={`h-5 w-5 ${accent}`} />
            </div>
            <span className="text-2xl font-semibold text-text">{value}</span>
            {typeof cardProgress === 'number' ? (
              <div className="mt-auto space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-muted">
                  <span>0%</span>
                  <span>100%</span>
                </div>
                <div className="h-2 rounded-full bg-surface-alt">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
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

