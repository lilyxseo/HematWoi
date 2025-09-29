import { PiggyBank, Target, TrendingDown, Wallet } from 'lucide-react';
import { formatCurrency } from '../../../lib/format';
import type { BudgetSummary } from '../../../lib/budgetApi';

interface SummaryCardsProps {
  summary: BudgetSummary;
  loading?: boolean;
}

const CARD_BASE_CLASS =
  'group relative overflow-hidden rounded-3xl border border-zinc-200/70 bg-white/80 shadow-[0_18px_60px_-28px_rgba(15,23,42,0.45)] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_26px_80px_-32px_rgba(15,23,42,0.55)] dark:border-zinc-800/60 dark:bg-zinc-900/70';

const ACCENT_BACKGROUND: Record<string, string> = {
  sky: 'from-sky-100/90 via-sky-50/50 to-transparent dark:from-sky-500/20 dark:via-sky-500/10 dark:to-transparent',
  emerald: 'from-emerald-100/90 via-emerald-50/40 to-transparent dark:from-emerald-500/20 dark:via-emerald-500/10 dark:to-transparent',
  purple: 'from-purple-100/90 via-purple-50/40 to-transparent dark:from-purple-500/20 dark:via-purple-500/10 dark:to-transparent',
  orange: 'from-orange-100/90 via-orange-50/40 to-transparent dark:from-orange-500/20 dark:via-orange-500/10 dark:to-transparent',
};

const ACCENT_ICON_CLASS: Record<string, string> = {
  sky: 'bg-sky-500/10 text-sky-600 shadow-[0_10px_30px_-16px_rgba(14,165,233,0.8)] dark:bg-sky-500/15 dark:text-sky-300',
  emerald:
    'bg-emerald-500/10 text-emerald-600 shadow-[0_10px_30px_-16px_rgba(5,150,105,0.75)] dark:bg-emerald-500/15 dark:text-emerald-300',
  purple:
    'bg-purple-500/10 text-purple-600 shadow-[0_10px_30px_-16px_rgba(147,51,234,0.7)] dark:bg-purple-500/15 dark:text-purple-300',
  orange:
    'bg-orange-500/10 text-orange-600 shadow-[0_10px_30px_-16px_rgba(249,115,22,0.7)] dark:bg-orange-500/15 dark:text-orange-300',
};

function SummarySkeleton() {
  return (
    <div className={CARD_BASE_CLASS}>
      <div className="relative flex h-full flex-col gap-5 p-6">
        <div className="h-4 w-32 animate-pulse rounded-full bg-zinc-200/60 dark:bg-zinc-700/60" />
        <div className="h-9 w-28 animate-pulse rounded-2xl bg-zinc-200/70 dark:bg-zinc-700/70" />
        <div className="mt-auto h-2 w-full animate-pulse rounded-full bg-zinc-200/60 dark:bg-zinc-700/60" />
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
      accent: 'sky',
    },
    {
      label: 'Realisasi',
      value: formatCurrency(summary.spent, 'IDR'),
      icon: TrendingDown,
      accent: 'emerald',
    },
    {
      label: 'Sisa',
      value: formatCurrency(summary.remaining, 'IDR'),
      icon: PiggyBank,
      accent: 'purple',
    },
    {
      label: 'Persentase',
      value: `${(progress * 100).toFixed(0)}%`,
      icon: Target,
      accent: 'orange',
      progress,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ label, value, icon: Icon, accent, progress: cardProgress }) => (
        <div key={label} className={CARD_BASE_CLASS}>
          <div
            className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${ACCENT_BACKGROUND[accent]}`}
          />
          <div className="relative flex h-full flex-col gap-5 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
                  {label}
                </span>
                <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</span>
              </div>
              <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${ACCENT_ICON_CLASS[accent]}`}>
                <Icon className="h-6 w-6" />
              </span>
            </div>
            {typeof cardProgress === 'number' ? (
              <div className="mt-auto space-y-3">
                <div className="flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  <span>0%</span>
                  <span>100%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200/70 dark:bg-zinc-800/70">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-500 via-orange-400 to-orange-300 transition-all dark:from-orange-400 dark:via-orange-500 dark:to-orange-600"
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

