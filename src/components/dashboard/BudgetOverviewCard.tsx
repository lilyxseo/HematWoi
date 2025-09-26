import { Link } from 'react-router-dom'
import { PieChart, Wallet, TrendingDown } from 'lucide-react'
import clsx from 'clsx'
import { formatCurrency } from '../../lib/format.js'
import useBudgetOverview from '../../hooks/useBudgetOverview'

function formatPeriodLabel(isoDate: string): string {
  if (!isoDate) return '—'
  const date = new Date(`${isoDate}T00:00:00`)
  return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}

function getProgressTone(percent: number): {
  bar: string
  badge: string
  text: string
} {
  if (percent >= 90) {
    return {
      bar: 'bg-rose-500',
      badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
      text: 'text-rose-600 dark:text-rose-400',
    }
  }
  if (percent >= 70) {
    return {
      bar: 'bg-amber-500',
      badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      text: 'text-amber-600 dark:text-amber-400',
    }
  }
  return {
    bar: 'bg-emerald-500',
    badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    text: 'text-emerald-600 dark:text-emerald-400',
  }
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '0%'
  return `${Math.min(999, Math.max(0, Math.round(value)))}%`
}

function BudgetOverviewCard(): JSX.Element {
  const { summary, categories, loading, error, hasBudgets, refresh } = useBudgetOverview()
  const tone = getProgressTone(summary.usagePercent)
  const progressWidth = summary.totalAvailable > 0 ? Math.min(100, Math.max(0, (summary.totalActual / summary.totalAvailable) * 100)) : 0
  const topCategories = categories.slice(0, 3)
  const usageDisplay = formatPercent(summary.usagePercent)
  const periodLabel = formatPeriodLabel(summary.period)
  const remainingPositive = summary.remaining >= 0

  return (
    <section className="relative flex h-full flex-col rounded-3xl border border-white/20 bg-gradient-to-br from-white/95 via-white/80 to-sky-50/80 p-6 shadow-[0_12px_40px_-24px_rgba(56,152,248,0.6)] backdrop-blur dark:border-slate-700/60 dark:from-slate-900/80 dark:via-slate-900/70 dark:to-slate-900/40">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-600/80 dark:text-sky-400/90">Performa Bulan Ini</p>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Anggaran</h2>
          <p className="text-xs text-muted-foreground">Periode {periodLabel}</p>
        </div>
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300" aria-hidden="true">
          <PieChart className="h-6 w-6" />
        </span>
      </div>

      <div className="mt-6 flex flex-col gap-6">
        {loading ? (
          <div className="space-y-4">
            <div className="h-8 w-32 animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-700/60" />
            <div className="h-3 w-full animate-pulse rounded-full bg-slate-200/60 dark:bg-slate-700/50" />
            <div className="space-y-2">
              <div className="h-4 w-40 animate-pulse rounded-lg bg-slate-200/50 dark:bg-slate-700/50" />
              <div className="h-4 w-28 animate-pulse rounded-lg bg-slate-200/50 dark:bg-slate-700/50" />
            </div>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200/70 bg-rose-50/70 p-4 text-sm text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300">
            <p className="font-medium">Gagal memuat data anggaran.</p>
            <p className="mt-1 text-xs opacity-80">{error}</p>
            <button
              type="button"
              onClick={refresh}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500"
            >
              Coba lagi
            </button>
          </div>
        ) : !hasBudgets ? (
          <div className="flex flex-col items-start gap-4 rounded-2xl border border-dashed border-sky-300/70 bg-sky-50/60 p-5 text-slate-600 dark:border-sky-500/50 dark:bg-slate-800/40 dark:text-slate-200">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300">
                <Wallet className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">Belum ada anggaran</p>
                <p className="text-xs text-slate-500 dark:text-slate-300/80">Buat anggaran pertama agar pengeluaranmu lebih terarah.</p>
              </div>
            </div>
            <Link
              to="/budgets"
              className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-sky-500"
            >
              Buat Anggaran
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Anggaran</p>
                <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {formatCurrency(summary.totalAvailable, 'IDR')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sisa</p>
                <p className={clsx('mt-1 text-lg font-semibold', remainingPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                  {formatCurrency(summary.remaining, 'IDR')}
                </p>
                <p className="mt-1 inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <TrendingDown className="h-4 w-4 text-slate-400" />
                  {formatCurrency(summary.totalActual, 'IDR')} terpakai
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>Persentase penggunaan</span>
                <span className={clsx('rounded-full px-2 py-0.5 font-semibold', tone.badge)}>{usageDisplay}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-200/80 dark:bg-slate-700/70">
                <div
                  className={clsx('h-full rounded-full transition-all duration-500 ease-out', tone.bar)}
                  style={{ width: `${progressWidth}%` }}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/40 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/40">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Top kategori</p>
                <span className="hidden text-xs text-muted-foreground lg:inline">3 terbesar berdasarkan realisasi</span>
              </div>
              <ul className="mt-4 space-y-3">
                {topCategories.map((category) => {
                  const categoryTone = getProgressTone(category.usagePercent)
                  const width = category.planned > 0 ? Math.min(100, Math.max(0, (category.actual / category.planned) * 100)) : 0
                  return (
                    <li key={category.id} className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{category.name}</p>
                        <span className={clsx('rounded-full px-2 py-0.5 text-xs font-semibold', categoryTone.badge)}>
                          {formatPercent(category.usagePercent)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span>{formatCurrency(category.actual, 'IDR')} terpakai</span>
                        <span className="hidden sm:inline">dari {formatCurrency(category.planned, 'IDR')}</span>
                        <span className={clsx('font-semibold', category.remaining >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                          {formatCurrency(category.remaining, 'IDR')} sisa
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200/80 dark:bg-slate-700/70">
                        <div
                          className={clsx('h-full rounded-full transition-all duration-500 ease-out', categoryTone.bar)}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </li>
                  )
                })}
                {topCategories.length === 0 && (
                  <li className="text-xs text-muted-foreground">Belum ada realisasi pengeluaran.</li>
                )}
              </ul>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

export default BudgetOverviewCard
