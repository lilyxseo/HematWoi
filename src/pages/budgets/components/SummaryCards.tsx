import {
  ArrowDownRight,
  ArrowUpRight,
  FlagTriangleRight,
  PiggyBank,
  Sparkles,
  Target,
  Wallet,
} from 'lucide-react';
import { formatCurrency } from '../../../lib/format';
import type { BudgetSummary } from '../../../lib/budgetApi';

interface SummaryCardsProps {
  summary: BudgetSummary;
  loading?: boolean;
}

const CARD_BASE_CLASS =
  'relative overflow-hidden rounded-3xl border border-zinc-200/60 bg-gradient-to-br from-white via-white/90 to-zinc-50 shadow-lg ring-1 ring-black/5 transition-all hover:-translate-y-0.5 hover:shadow-xl dark:border-zinc-800/70 dark:from-zinc-950 dark:via-zinc-900/60 dark:to-zinc-900/30 dark:ring-white/5';

function SummarySkeleton() {
  return (
    <div className={CARD_BASE_CLASS}>
      <div className="absolute inset-0 bg-gradient-to-br from-brand/5 via-transparent to-transparent opacity-70" />
      <div className="relative flex h-full flex-col gap-4 p-6">
        <div className="h-4 w-32 animate-pulse rounded-full bg-zinc-200/60 dark:bg-zinc-700/60" />
        <div className="h-10 w-28 animate-pulse rounded-xl bg-zinc-200/70 dark:bg-zinc-700/70" />
        <div className="mt-auto h-2 w-full animate-pulse rounded-full bg-zinc-200/60 dark:bg-zinc-700/60" />
      </div>
    </div>
  );
}

export default function SummaryCards({ summary, loading }: SummaryCardsProps) {
  if (loading) {
    return (
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <SummarySkeleton key={index} />
        ))}
      </div>
    );
  }

  const progress = Math.min(Math.max(summary.percentage, 0), 1);
  const spentRatio = summary.planned > 0 ? summary.spent / summary.planned : 0;
  const remainingPositive = summary.remaining >= 0;

  const cards = [
    {
      label: 'Total Anggaran',
      value: formatCurrency(summary.planned, 'IDR'),
      icon: Wallet,
      accent: 'from-sky-500/15 via-sky-500/5 to-transparent',
      iconAccent: 'bg-sky-500/15 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300',
      helper: 'Dana yang sudah kamu siapkan untuk periode ini.',
      footerIcon: Sparkles,
      footerLabel: 'Siap digunakan secara strategis',
    },
    {
      label: 'Realisasi',
      value: formatCurrency(summary.spent, 'IDR'),
      icon: ArrowUpRight,
      accent: 'from-emerald-500/15 via-emerald-500/5 to-transparent',
      iconAccent: 'bg-emerald-500/15 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300',
      helper: `${Math.min(100, Math.max(0, spentRatio * 100)).toFixed(0)}% dari anggaran sudah dipakai.`,
      footerIcon: ArrowUpRight,
      footerLabel: spentRatio > 1 ? 'Perhatikan laju pengeluaranmu' : 'Masih dalam batas wajar',
    },
    {
      label: 'Sisa Dana',
      value: formatCurrency(summary.remaining, 'IDR'),
      icon: PiggyBank,
      accent: 'from-purple-500/15 via-purple-500/5 to-transparent',
      iconAccent: 'bg-purple-500/15 text-purple-600 dark:bg-purple-400/10 dark:text-purple-300',
      helper: remainingPositive
        ? 'Masih ada ruang untuk kebutuhan penting.'
        : 'Pengeluaran melampaui alokasi yang tersedia.',
      footerIcon: remainingPositive ? ArrowDownRight : ArrowUpRight,
      footerLabel: remainingPositive ? 'Tetap jaga pengeluaran tetap efisien' : 'Pertimbangkan penyesuaian anggaran',
    },
    {
      label: 'Persentase Terpakai',
      value: `${(progress * 100).toFixed(0)}%`,
      icon: Target,
      accent: 'from-amber-500/15 via-amber-500/5 to-transparent',
      iconAccent: 'bg-amber-500/15 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300',
      helper: progress >= 1 ? 'Anggaran telah habis digunakan.' : 'Pantau batas agar tetap terkendali.',
      footerIcon: FlagTriangleRight,
      footerLabel: progress >= 1 ? 'Saatnya evaluasi prioritas' : 'Masih ada ruang untuk dioptimalkan',
      progress,
    },
  ] as const;

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      {cards.map(({
        label,
        value,
        icon: Icon,
        accent,
        iconAccent,
        helper,
        footerIcon: FooterIcon,
        footerLabel,
        progress: cardProgress,
      }) => (
        <div key={label} className={CARD_BASE_CLASS}>
          <div className={`absolute inset-0 ${accent}`} />
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/40 blur-2xl dark:bg-white/5" />
          <div className="relative flex h-full flex-col gap-5 p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {label}
                </span>
                <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</span>
              </div>
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl backdrop-blur ${iconAccent}`}>
                <Icon className="h-5 w-5" />
              </span>
            </div>

            {typeof cardProgress === 'number' ? (
              <div className="space-y-2 rounded-2xl border border-white/60 bg-white/70 p-4 text-xs font-medium text-zinc-500 shadow-sm dark:border-white/10 dark:bg-zinc-900/40 dark:text-zinc-400">
                <div className="flex items-center justify-between">
                  <span>0%</span>
                  <span>{`${(cardProgress * 100).toFixed(0)}%`}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200/70 dark:bg-zinc-800/70">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 transition-all dark:from-amber-400 dark:via-orange-400 dark:to-rose-400"
                    style={{ width: `${Math.min(cardProgress * 100, 100)}%` }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-300">{helper}</p>
            )}

            <div className="mt-auto flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              <FooterIcon className="h-3.5 w-3.5" />
              {footerLabel}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
