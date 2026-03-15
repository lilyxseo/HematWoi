import clsx from 'clsx';
import { PiggyBank, Target, TrendingDown, Wallet } from 'lucide-react';
import { formatCurrency } from '../../../lib/format';
import type { BudgetSummary } from '../../../lib/budgetApi';

interface SummaryCardsProps {
  summary: BudgetSummary;
  loading?: boolean;
}

function SummarySkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-surface/70 p-3.5 shadow-sm">
      <div className="absolute inset-0 bg-gradient-to-br from-white/70 via-white/40 to-white/10 opacity-80 dark:from-zinc-900/80 dark:via-zinc-900/50 dark:to-zinc-900/20" />
      <div className="relative flex h-full flex-col gap-3">
        <div className="h-2.5 w-20 animate-pulse rounded-full bg-zinc-200/70 dark:bg-zinc-700/60" />
        <div className="h-6 w-20 animate-pulse rounded-full bg-zinc-200/80 dark:bg-zinc-700/70" />
        <div className="h-2 w-24 animate-pulse rounded-full bg-zinc-200/70 dark:bg-zinc-800/60" />
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
      description: 'Jumlah dialokasikan untuk periode ini',
      value: formatCurrency(summary.planned, 'IDR'),
      icon: Wallet,
      accent: 'text-sky-600 dark:text-sky-300',
      iconBg: 'bg-sky-500/10 text-sky-500 dark:text-sky-300',
      glow: 'rgba(14, 165, 233, 0.35)',
    },
    {
      label: 'Realisasi',
      description: 'Pengeluaran yang sudah terjadi',
      value: formatCurrency(summary.spent, 'IDR'),
      icon: TrendingDown,
      accent: 'text-emerald-600 dark:text-emerald-300',
      iconBg: 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-300',
      glow: 'rgba(16, 185, 129, 0.32)',
    },
    {
      label: 'Sisa Anggaran',
      description: 'Dana yang masih bisa digunakan',
      value: formatCurrency(summary.remaining, 'IDR'),
      icon: PiggyBank,
      accent: 'text-purple-600 dark:text-purple-300',
      iconBg: 'bg-purple-500/10 text-purple-500 dark:text-purple-300',
      glow: 'rgba(168, 85, 247, 0.28)',
    },
    {
      label: 'Persentase Terpakai',
      description: 'Proporsi penggunaan terhadap anggaran',
      value: `${(progress * 100).toFixed(0)}%`,
      icon: Target,
      accent: 'text-orange-500 dark:text-orange-300',
      iconBg: 'bg-orange-500/10 text-orange-500 dark:text-orange-300',
      glow: 'rgba(249, 115, 22, 0.28)',
      accentColor: 'rgb(249, 115, 22)',
      progress,
    },
  ] as const;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map(({
        label,
        description,
        value,
        icon: Icon,
        accent,
        iconBg,
        glow,
        accentColor,
        progress: cardProgress,
      }) => (
        <div
          key={label}
          className={clsx(
            'relative overflow-hidden rounded-2xl border border-border/60 bg-surface/80 p-3.5 shadow-[0_20px_35px_-20px_rgba(15,23,42,0.45)] transition duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_28px_55px_-28px_rgba(15,23,42,0.55)]',
            'backdrop-blur supports-[backdrop-filter]:bg-surface/60',
          )}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-12 h-48 w-48 rounded-full blur-3xl"
            style={{ background: `radial-gradient(circle at center, ${glow} 0%, rgba(255,255,255,0) 70%)` }}
          />

          <div className="relative flex h-full flex-col gap-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-[0.64rem] font-semibold uppercase tracking-[0.15em] text-muted">{label}</p>
                <p className="text-[0.68rem] text-muted/75 dark:text-muted/60 line-clamp-1">{description}</p>
              </div>
              <span
                className={clsx(
                  'flex h-8 w-8 items-center justify-center rounded-lg shadow-inner ring-1 ring-inset ring-border/40 dark:ring-white/10',
                  iconBg,
                )}
              >
                <Icon className={clsx('h-4 w-4', accent)} />
              </span>
            </div>

            <div className="flex items-end justify-between gap-3">
              <span className="text-xl font-semibold leading-tight text-text dark:text-white">{value}</span>

              {typeof cardProgress === 'number' ? (
                <span className="rounded-md bg-white/55 px-2 py-1 text-xs font-semibold text-text shadow-sm dark:bg-zinc-900/60 dark:text-white">
                  {(cardProgress * 100).toFixed(0)}%
                </span>
              ) : null}
            </div>

            {typeof cardProgress === 'number' ? (
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-700/60">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${cardProgress * 100}%`,
                    background: `linear-gradient(90deg, ${accentColor ?? glow} 0%, ${accentColor ?? glow}CC 100%)`,
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
