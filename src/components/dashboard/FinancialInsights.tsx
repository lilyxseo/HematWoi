import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  CalendarClock,
  Flame,
  Info,
  ListChecks,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import InsightItem from './InsightItem'
import type { PeriodRange } from './PeriodPicker'
import {
  getBudgetProgressMTD,
  getDueDebtsIn7Days,
  getTopSpendingMTD,
  getUncategorizedCount,
  getWeeklyTrend,
  type BudgetProgressItem,
} from '../../lib/api-insights'
import { formatCurrency } from '../../lib/format'

interface FinancialInsightsProps {
  period?: PeriodRange
}

interface InsightDisplay {
  id: string
  element: JSX.Element
}

function toPeriodMonth(range?: PeriodRange): string {
  if (!range?.end) {
    const now = new Date()
    const month = `${now.getMonth() + 1}`.padStart(2, '0')
    return `${now.getFullYear()}-${month}`
  }
  return range.end.slice(0, 7)
}

function percentLabel(value: number): string {
  return `${Math.round(value * 100)}%`
}

function formatDateLabel(value: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
    }).format(new Date(value))
  } catch (error) {
    return value
  }
}

function describeDaysLeft(daysLeft: number): string {
  if (daysLeft <= 0) return 'Jatuh tempo hari ini'
  if (daysLeft === 1) return 'Jatuh tempo besok'
  return `Jatuh tempo dalam ${daysLeft} hari`
}

function getBudgetTone(progress: number): 'accent' | 'amber' | 'rose' {
  if (progress >= 1) return 'rose'
  if (progress >= 0.8) return 'amber'
  return 'accent'
}

function BudgetBadgeTooltip(item: BudgetProgressItem): string {
  const pct = percentLabel(item.progress)
  const planned = formatCurrency(item.planned)
  return `${pct} dari limit ${planned}`
}

function SkeletonItem({ index }: { index: number }) {
  return (
    <div
      // eslint-disable-next-line react/no-array-index-key
      key={index}
      className="flex items-start gap-4 rounded-2xl border border-dashed border-border/50 bg-muted/20 p-4"
    >
      <div className="h-10 w-10 rounded-xl bg-muted/40" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-1/2 rounded-full bg-muted/50" />
        <div className="h-3 w-2/3 rounded-full bg-muted/40" />
        <div className="h-2 w-full rounded-full bg-muted/30" />
      </div>
    </div>
  )
}

export default function FinancialInsights({ period }: FinancialInsightsProps) {
  const navigate = useNavigate()
  const periodMonth = useMemo(() => toPeriodMonth(period), [period])

  const goTo = (pathname: string, params: Record<string, string | null | undefined>) => {
    const search = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value != null && value !== '') {
        search.set(key, value)
      }
    })
    const query = search.toString()
    navigate(query ? `${pathname}?${query}` : pathname)
  }

  const topSpendingQuery = useQuery({
    queryKey: ['financial-insights', 'top-spending', periodMonth],
    queryFn: () => getTopSpendingMTD(periodMonth, { limit: 3 }),
    staleTime: 60_000,
  })

  const budgetProgressQuery = useQuery({
    queryKey: ['financial-insights', 'budget-progress', periodMonth],
    queryFn: () => getBudgetProgressMTD(periodMonth),
    staleTime: 60_000,
  })

  const dueDebtsQuery = useQuery({
    queryKey: ['financial-insights', 'due-debts'],
    queryFn: () => getDueDebtsIn7Days({ limit: 4 }),
    staleTime: 60_000,
  })

  const weeklyTrendQuery = useQuery({
    queryKey: ['financial-insights', 'weekly-trend', periodMonth],
    queryFn: () => getWeeklyTrend(periodMonth),
    staleTime: 60_000,
  })

  const uncategorizedQuery = useQuery({
    queryKey: ['financial-insights', 'uncategorized', periodMonth],
    queryFn: () => getUncategorizedCount(periodMonth),
    staleTime: 60_000,
  })

  const isLoading =
    topSpendingQuery.isLoading ||
    budgetProgressQuery.isLoading ||
    dueDebtsQuery.isLoading

  const error =
    topSpendingQuery.error ||
    budgetProgressQuery.error ||
    dueDebtsQuery.error ||
    weeklyTrendQuery.error ||
    uncategorizedQuery.error

  const handleRetry = () => {
    topSpendingQuery.refetch()
    budgetProgressQuery.refetch()
    dueDebtsQuery.refetch()
    weeklyTrendQuery.refetch()
    uncategorizedQuery.refetch()
  }

  const items: InsightDisplay[] = []

  const topSpending = topSpendingQuery.data ?? []
  if (topSpending.length > 0) {
    const top = topSpending[0]
    const merchantSubtitle = top.topMerchant
      ? `${top.topMerchant.name} • ${formatCurrency(top.topMerchant.amount)}`
      : undefined
    items.push({
      id: 'top-spending',
      element: (
        <InsightItem
          icon={<Wallet className="h-5 w-5" />}
          title={`Pengeluaran terbesar • ${top.categoryName}`}
          subtitle={`${formatCurrency(top.amount)} bulan ini`}
          meta={merchantSubtitle}
          badge={
            top.share
              ? {
                  label: percentLabel(top.share),
                  tone: 'accent',
                  tooltip: `${percentLabel(top.share)} dari total pengeluaran bulan ini`,
                }
              : undefined
          }
          onClick={() =>
            goTo('/transactions', {
              filter: 'top-spending',
              period: periodMonth,
              category: top.categoryId ?? undefined,
            })
          }
        />
      ),
    })
  }

  const budgetData = budgetProgressQuery.data
  const nearLimit = budgetData?.nearLimit ?? []
  const overLimit = budgetData?.overLimit ?? []

  nearLimit.slice(0, 3).forEach((item) => {
    const tone = getBudgetTone(item.progress)
    items.push({
      id: `near-limit-${item.id}`,
      element: (
        <InsightItem
          icon={<AlertTriangle className="h-5 w-5" />}
          title={`Budget hampir limit • ${item.categoryName}`}
          subtitle={`${formatCurrency(item.actual)} dari ${formatCurrency(item.planned)}`}
          meta={`Sisa ${formatCurrency(Math.max(item.planned - item.actual, 0))}`}
          badge={{ label: percentLabel(item.progress), tone: tone, tooltip: BudgetBadgeTooltip(item) }}
          progressValue={item.progress}
          progressTone={tone}
          onClick={() =>
            goTo('/budgets', {
              tab: 'monthly',
              filter: 'near-limit',
              period: periodMonth,
              category: item.categoryId ?? undefined,
            })
          }
        />
      ),
    })
  })

  overLimit.slice(0, 3).forEach((item) => {
    items.push({
      id: `over-limit-${item.id}`,
      element: (
        <InsightItem
          icon={<Flame className="h-5 w-5" />}
          title={`Budget terlampaui • ${item.categoryName}`}
          subtitle={`${formatCurrency(item.actual)} dari ${formatCurrency(item.planned)}`}
          meta={`Melebihi ${formatCurrency(Math.max(item.actual - item.planned, 0))}`}
          badge={{ label: percentLabel(item.progress), tone: 'rose', tooltip: BudgetBadgeTooltip(item) }}
          progressValue={item.progress}
          progressTone="rose"
          onClick={() =>
            goTo('/budgets', {
              tab: 'monthly',
              filter: 'over-limit',
              period: periodMonth,
              category: item.categoryId ?? undefined,
            })
          }
        />
      ),
    })
  })

  const dues = dueDebtsQuery.data ?? []
  dues.slice(0, 4).forEach((due) => {
    items.push({
      id: `due-${due.id}`,
      element: (
        <InsightItem
          icon={<CalendarClock className="h-5 w-5" />}
          title={`Pengingat hutang • ${due.title}`}
          subtitle={`${formatCurrency(due.remaining || due.amount)} • ${describeDaysLeft(due.daysLeft)} (${formatDateLabel(
            due.dueDate,
          )})`}
          meta={due.counterparty ? `Dengan ${due.counterparty}` : undefined}
          badge={{ label: `H-${Math.max(due.daysLeft, 0)}`, tone: 'amber', tooltip: `Jatuh tempo ${formatDateLabel(due.dueDate)}` }}
          onClick={() =>
            goTo('/debts', {
              filter: 'due-7',
            })
          }
        />
      ),
    })
  })

  const extraDue = Math.max(0, dues.length - 4)
  if (extraDue > 0) {
    items.push({
      id: 'due-more',
      element: (
        <InsightItem
          icon={<ListChecks className="h-5 w-5" />}
          title={`Ada ${extraDue} tagihan lain mendekati jatuh tempo`}
          subtitle="Periksa semua di halaman Hutang"
          badge={{ label: `+${extraDue}`, tone: 'muted' }}
          onClick={() =>
            goTo('/debts', {
              filter: 'due-7',
            })
          }
        />
      ),
    })
  }

  const trend = weeklyTrendQuery.data
  if (trend && (trend.current > 0 || trend.previous > 0)) {
    const change = Math.round(trend.changePct)
    const increase = change > 0
    const tone = increase ? 'rose' : 'accent'
    const label = `${increase ? '+' : ''}${change}%`
    items.push({
      id: 'weekly-trend',
      element: (
        <InsightItem
          icon={<TrendingUp className="h-5 w-5" />}
          title="Tren mingguan pengeluaran"
          subtitle={`${formatCurrency(trend.current)} minggu ini vs ${formatCurrency(trend.previous)} minggu lalu`}
          badge={{ label, tone, tooltip: 'Perbandingan pengeluaran minggu ini dan minggu lalu' }}
          onClick={() =>
            goTo('/transactions', {
              filter: 'weekly-trend',
              period: periodMonth,
            })
          }
        />
      ),
    })
  }

  const uncategorized = uncategorizedQuery.data ?? 0
  if (uncategorized > 0) {
    items.push({
      id: 'uncategorized',
      element: (
        <InsightItem
          icon={<Info className="h-5 w-5" />}
          title={`${uncategorized} transaksi belum dikategorikan`}
          subtitle="Segera klasifikasikan agar laporan akurat"
          badge={{ label: 'Aksi', tone: 'accent', tooltip: 'Buka daftar transaksi tanpa kategori' }}
          onClick={() =>
            goTo('/transactions', {
              filter: 'uncategorized',
              period: periodMonth,
            })
          }
        />
      ),
    })
  }

  return (
    <section className="rounded-3xl border border-border/70 bg-card/70 p-6 shadow-sm backdrop-blur">
      <header className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-foreground sm:text-2xl">Financial Insights</h2>
        <p className="text-sm text-muted-foreground">Ringkasan cepat kondisi keuanganmu bulan ini.</p>
      </header>

      {isLoading ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonItem key={index} index={index} />
          ))}
        </div>
      ) : error ? (
        <div className="mt-6 flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-2xl border border-rose-300/70 bg-rose-100/60 p-4 text-sm text-rose-800 dark:border-rose-500/50 dark:bg-rose-500/15 dark:text-rose-100">
            <AlertTriangle className="h-5 w-5" />
            Terjadi kesalahan saat memuat insight.
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex w-fit items-center justify-center rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
          >
            Coba lagi
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border/60 bg-muted/20 p-6 text-center text-sm text-muted-foreground dark:border-border/40">
          <p className="font-medium">Semua aman. Tetap lanjut hemat! 🎉</p>
          <button
            type="button"
            onClick={() => navigate('/budgets')}
            className="mt-3 inline-flex items-center justify-center rounded-full border border-transparent bg-[color:var(--accent)]/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--accent)] transition hover:bg-[color:var(--accent)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
          >
            Lihat Budget
          </button>
        </div>
      ) : (
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {items.map((item) => (
            <div key={item.id}>{item.element}</div>
          ))}
        </div>
      )}
    </section>
  )
}
