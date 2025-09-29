import clsx from 'clsx';
import { PiggyBank, Target, TrendingDown, Wallet } from 'lucide-react';
import { formatCurrency } from '../../../lib/format';
import type { BudgetSummary } from '../../../lib/budgetApi';

interface SummaryCardsProps {
  summary: BudgetSummary;
  loading?: boolean;
}

const CARD_BASE_CLASS =
  'group relative overflow-hidden rounded-3xl border border-white/20 bg-white/80 p-6 shadow-lg ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-2xl dark:border-white/5 dark:bg-zinc-900/70 dark:ring-white/5';

function SummarySkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {['one', 'two', 'three', 'four'].map((key) => (
        <div key={key} className={clsx(CARD_BASE_CLASS, 'animate-pulse')}>
          <div className="flex h-full flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-zinc-200/70 dark:bg-zinc-700/60" />
              <div className="space-y-2">
                <div className="h-3 w-24 rounded-full bg-zinc-200/70 dark:bg-zinc-700/60" />
                <div className="h-5 w-36 rounded-full bg-zinc-200/70 dark:bg-zinc-700/60" />
              </div>
            </div>
            <div className="h-3 w-full rounded-full bg-zinc-200/60 dark:bg-zinc-700/60" />
            <div className="h-2 w-full rounded-full bg-zinc-200/50 dark:bg-zinc-800/50" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SummaryCards({ summary, loading }: SummaryCardsProps) {
  if (loading) {
    return <SummarySkeleton />;
  }

  const rawPercentage = Math.max(summary.percentage, 0);
  const progress = Math.min(rawPercentage, 1);
  const displayPercent = Math.round(rawPercentage * 100);
  const overspent = summary.remaining < 0;

  const statusBadge = overspent
    ? {
        label: 'Butuh perhatian',
        className: 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-200',
      }
    : displayPercent >= 80
      ? {
          label: 'Waspada',
          className: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-200',
        }
      : {
          label: 'Stabil',
          className: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200',
        };

  const remainingBadge = overspent
    ? {
        label: 'Defisit',
        className: 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-200',
      }
    : {
        label: 'Surplus',
        className: 'bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-200',
      };

  const remainingHelper = overspent
    ? `Terlewat batas sebesar ${formatCurrency(Math.abs(summary.remaining), 'IDR')}.`
    : 'Masih tersisa ruang belanja untuk kebutuhan prioritas.';

  const progressHelper = overspent
    ? 'Anggaran sudah melampaui batas — periksa kategori pengeluaran terbesar.'
    : displayPercent >= 80
      ? 'Perlambat pengeluaran agar tetap on track.'
      : 'Belanja masih aman dalam batas anggaran.';

  const cards = [
    {
      label: 'Total Anggaran',
      value: formatCurrency(summary.planned, 'IDR'),
      icon: Wallet,
      iconClass: 'bg-sky-500/15 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300',
      glow: 'from-sky-400/25 via-sky-400/10 to-transparent',
      helper: 'Dialokasikan untuk periode ini.',
    },
    {
      label: 'Realisasi',
      value: formatCurrency(summary.spent, 'IDR'),
      icon: TrendingDown,
      iconClass: 'bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200',
      glow: 'from-emerald-400/25 via-emerald-400/10 to-transparent',
      helper: `${displayPercent}% dari anggaran telah digunakan.`,
      badge: statusBadge.label,
      badgeClass: statusBadge.className,
    },
    {
      label: 'Sisa',
      value: formatCurrency(summary.remaining, 'IDR'),
      icon: PiggyBank,
      iconClass: overspent
        ? 'bg-rose-500/15 text-rose-600 dark:bg-rose-500/20 dark:text-rose-200'
        : 'bg-purple-500/15 text-purple-600 dark:bg-purple-500/20 dark:text-purple-200',
      glow: overspent
        ? 'from-rose-400/25 via-rose-400/10 to-transparent'
        : 'from-purple-400/25 via-purple-400/10 to-transparent',
      helper: remainingHelper,
      badge: remainingBadge.label,
      badgeClass: remainingBadge.className,
    },
    {
      label: 'Persentase',
      value: `${displayPercent}%`,
      icon: Target,
      iconClass: overspent
        ? 'bg-rose-500/15 text-rose-600 dark:bg-rose-500/20 dark:text-rose-200'
        : 'bg-amber-400/15 text-amber-500 dark:bg-amber-400/20 dark:text-amber-200',
      glow: overspent
        ? 'from-rose-400/30 via-rose-400/10 to-transparent'
        : 'from-amber-400/30 via-amber-400/10 to-transparent',
      helper: progressHelper,
      badge: statusBadge.label,
      badgeClass: statusBadge.className,
      progress,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ label, value, icon: Icon, iconClass, glow, helper, badge, badgeClass, progress: cardProgress }) => (
        <div key={label} className={CARD_BASE_CLASS}>
          <div
            aria-hidden
            className={clsx('pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90 blur-xl', glow)}
          />
          <div className="relative flex h-full flex-col gap-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className={clsx('flex h-12 w-12 items-center justify-center rounded-2xl', iconClass)}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</span>
                  <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</span>
                </div>
              </div>
              {badge ? (
                <span className={clsx('rounded-full px-3 py-1 text-xs font-semibold shadow-sm', badgeClass)}>{badge}</span>
              ) : null}
            </div>
            <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{helper}</p>
            {typeof cardProgress === 'number' ? (
              <div className="mt-auto space-y-3">
                <div className="flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  <span>0%</span>
                  <span>100%</span>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-zinc-200/70 dark:bg-zinc-800/70">
                  <div
                    className={clsx(
                      'absolute inset-y-0 left-0 rounded-full transition-all duration-500',
                      overspent
                        ? 'bg-gradient-to-r from-rose-500 via-rose-400 to-rose-500'
                        : 'bg-gradient-to-r from-brand via-sky-400 to-emerald-400',
                    )}
                    style={{ width: `${Math.min(cardProgress * 100, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-zinc-500 dark:text-zinc-400">Progress anggaran</span>
                  <span
                    className={clsx(
                      'rounded-full px-2 py-0.5 text-[0.7rem] font-semibold',
                      overspent
                        ? 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-200'
                        : 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200',
                    )}
                  >
                    {displayPercent}%
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

