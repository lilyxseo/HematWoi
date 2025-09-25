import { Wallet, TrendingDown, PiggyBank, Target } from 'lucide-react';
import { formatCurrency } from '../../lib/format';
import type { BudgetsSummary } from '../../hooks/useBudgets';

interface BudgetSummaryCardsProps {
  summary: BudgetsSummary;
  loading?: boolean;
}

const cardBaseClass =
  'flex flex-col gap-4 rounded-2xl border border-white/40 bg-gradient-to-b from-white/80 to-white/50 p-5 shadow-sm backdrop-blur dark:border-white/5 dark:from-zinc-900/60 dark:to-zinc-900/30';

const iconWrapperClass =
  'flex h-12 w-12 items-center justify-center rounded-2xl bg-white/70 text-sky-600 shadow-sm dark:bg-white/10 dark:text-sky-300';

export default function BudgetSummaryCards({ summary, loading = false }: BudgetSummaryCardsProps) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            className={`${cardBaseClass} animate-pulse`}
          >
            <div className="h-5 w-24 rounded-full bg-black/10 dark:bg-white/10" />
            <div className="h-10 w-32 rounded-full bg-black/10 dark:bg-white/10" />
            <div className="h-2 w-full rounded-full bg-black/5 dark:bg-white/5" />
          </div>
        ))}
      </div>
    );
  }

  const percentage = Number.isFinite(summary.percentage) ? summary.percentage : 0;
  const boundedProgress = Math.min(Math.abs(percentage), 100);
  const overspend = percentage > 100;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <article className={cardBaseClass}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Anggaran</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
              {formatCurrency(summary.planned ?? 0)}
            </p>
          </div>
          <div className={`${iconWrapperClass} bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-200`}>
            <Wallet className="h-6 w-6" />
          </div>
        </div>
      </article>

      <article className={cardBaseClass}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Realisasi</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
              {formatCurrency(summary.spent ?? 0)}
            </p>
          </div>
          <div className={`${iconWrapperClass} bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200`}>
            <PiggyBank className="h-6 w-6" />
          </div>
        </div>
      </article>

      <article className={cardBaseClass}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Sisa</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
              {formatCurrency(summary.remaining ?? 0)}
            </p>
          </div>
          <div className={`${iconWrapperClass} bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-200`}>
            <TrendingDown className="h-6 w-6" />
          </div>
        </div>
      </article>

      <article className={cardBaseClass}>
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Persentase</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                {percentage.toFixed(0)}%
              </p>
            </div>
            <div className={`${iconWrapperClass} bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-200`}>
              <Target className="h-6 w-6" />
            </div>
          </div>
          <div className="h-2 rounded-full bg-slate-200/70 dark:bg-slate-700/60">
            <div
              className={`h-full rounded-full transition-all ${
                overspend ? 'bg-rose-500 dark:bg-rose-400' : 'bg-gradient-to-r from-emerald-500 to-sky-500'
              }`}
              style={{ width: `${boundedProgress}%` }}
            />
          </div>
          {overspend ? (
            <p className="text-xs font-medium text-rose-600 dark:text-rose-300">Pengeluaran melebihi rencana.</p>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {percentage > 0 ? 'Pengeluaran masih dalam kendali.' : 'Belum ada transaksi pada periode ini.'}
            </p>
          )}
        </div>
      </article>
    </div>
  );
}
