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
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-surface/70 p-5 shadow-sm">
      <div className="absolute inset-0 bg-gradient-to-br from-white/70 via-white/40 to-white/10 opacity-80 dark:from-zinc-900/80 dark:via-zinc-900/50 dark:to-zinc-900/20" />
      <div className="relative flex h-full flex-col gap-4">
        <div className="h-3 w-24 animate-pulse rounded-full bg-zinc-200/70 dark:bg-zinc-700/60" />
        <div className="h-7 w-24 animate-pulse rounded-full bg-zinc-200/80 dark:bg-zinc-700/70" />
        <div className="mt-auto h-2 w-full animate-pulse rounded-full bg-zinc-200/70 dark:bg-zinc-800/60" />
      </div>
    </div>
  );
}

export default function SummaryCards({ summary, loading }: SummaryCardsProps) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 md:gap-5 xl:grid-cols-4 xl:gap-6 [@media(min-width:1600px)]:gap-7">
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
    <div className="grid gap-4 md:grid-cols-2 md:gap-5 xl:grid-cols-4 xl:gap-6 [@media(min-width:1600px)]:gap-7">
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
            'relative overflow-hidden rounded-2xl border border-border/60 bg-surface/80 p-5 shadow-[0_20px_35px_-20px_rgba(15,23,42,0.45)] transition duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_28px_55px_-28px_rgba(15,23,42,0.55)]',
            'backdrop-blur supports-[backdrop-filter]:bg-surface/60',
          )}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-12 h-48 w-48 rounded-full blur-3xl"
            style={{ background: `radial-gradient(circle at center, ${glow} 0%, rgba(255,255,255,0) 70%)` }}
          />

          <div className="relative flex h-full flex-col gap-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
                <p className="text-xs text-muted/80 dark:text-muted/60">{description}</p>
              </div>
              <span
                className={clsx(
                  'flex h-10 w-10 items-center justify-center rounded-xl shadow-inner ring-1 ring-inset ring-border/40 dark:ring-white/10',
                  iconBg,
                )}
              >
                <Icon className={clsx('h-5 w-5', accent)} />
              </span>
            </div>

            <span className="text-2xl font-semibold text-text dark:text-white">{value}</span>

            {typeof cardProgress === 'number' ? (
              <div className="mt-auto flex items-end justify-between gap-4">
                <div className="flex flex-col gap-1 text-xs text-muted">
                  <span className="font-semibold text-text">Tingkat penggunaan</span>
                  <span>{(cardProgress * 100).toFixed(0)}% dari total anggaran</span>
                </div>
                <div className="relative flex h-16 w-16 items-center justify-center">
                  <div
                    className="absolute inset-0 rounded-full opacity-80"
                    style={{ background: `radial-gradient(circle at center, ${glow} 0%, rgba(255,255,255,0) 72%)` }}
                  />
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `conic-gradient(${accentColor ?? glow} ${cardProgress * 360}deg, rgba(148,163,184,0.25) 0deg)`,
                    }}
                  />
                  <div className="absolute inset-[6px] rounded-full border border-white/50 bg-gradient-to-br from-white/90 to-white/70 shadow-inner dark:border-white/10 dark:from-zinc-900/90 dark:to-zinc-900/60" />
                  <span className="relative text-sm font-semibold text-text dark:text-white">{(cardProgress * 100).toFixed(0)}%</span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
