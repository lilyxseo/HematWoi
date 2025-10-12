import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CalendarClock, Flame, Info, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import Card, { CardBody, CardHeader } from '../Card'
import FinancialInsightItem, { FinancialInsightItemSkeleton } from './FinancialInsightItem'
import ProgressTiny from './ProgressTiny'
import {
  formatAmount,
  getBudgetProgressMTD,
  getDueDebtsIn7Days,
  getTopSpendingMTD,
  getUncategorizedCount,
  getWeeklyTrend,
} from '../../lib/api-insights'
import type { BudgetProgressInsight, DueItemInsight } from '../../lib/api-insights'

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

const percentageFormatter = new Intl.NumberFormat('id-ID', {
  style: 'percent',
  maximumFractionDigits: 0,
})

function toMonthKey(value?: string): string | null {
  if (!value) return null
  if (/^\d{4}-\d{2}$/.test(value)) return value
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.slice(0, 7)
  return null
}

interface FinancialInsightsProps {
  periodEnd?: string
}

export default function FinancialInsights({ periodEnd }: FinancialInsightsProps) {
  const navigate = useNavigate()
  const periodMonth = useMemo(() => toMonthKey(periodEnd) ?? undefined, [periodEnd])

  const topSpendingQuery = useQuery({
    queryKey: ['financial-insights', 'top-spending', periodMonth],
    queryFn: () => getTopSpendingMTD(periodMonth),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  })

  const budgetQuery = useQuery({
    queryKey: ['financial-insights', 'budgets', periodMonth],
    queryFn: () => getBudgetProgressMTD(periodMonth),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  })

  const debtQuery = useQuery({
    queryKey: ['financial-insights', 'debts-due'],
    queryFn: () => getDueDebtsIn7Days(),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  })

  const uncategorizedQuery = useQuery({
    queryKey: ['financial-insights', 'uncategorized', periodMonth],
    queryFn: () => getUncategorizedCount(periodMonth),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  })

  const weeklyTrendQuery = useQuery({
    queryKey: ['financial-insights', 'weekly-trend', periodMonth],
    queryFn: () => getWeeklyTrend(periodMonth),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  })

  const isLoading =
    topSpendingQuery.isLoading ||
    budgetQuery.isLoading ||
    debtQuery.isLoading ||
    uncategorizedQuery.isLoading ||
    weeklyTrendQuery.isLoading

  const isError =
    topSpendingQuery.isError ||
    budgetQuery.isError ||
    debtQuery.isError ||
    uncategorizedQuery.isError ||
    weeklyTrendQuery.isError

  const retry = () => {
    void Promise.all([
      topSpendingQuery.refetch(),
      budgetQuery.refetch(),
      debtQuery.refetch(),
      uncategorizedQuery.refetch(),
      weeklyTrendQuery.refetch(),
    ])
  }

  const topSpending = topSpendingQuery.data ?? null
  const { nearLimit = [], overLimit = [], totalPlanned = 0, totalActual = 0 } = budgetQuery.data ?? {}
  const debts = debtQuery.data ?? []
  const uncategorized = uncategorizedQuery.data ?? 0
  const weeklyTrend = weeklyTrendQuery.data

  const limitedNear = nearLimit.slice(0, 3)
  const limitedOver = overLimit.slice(0, 3)
  const hasWarnings = limitedNear.length > 0 || limitedOver.length > 0 || debts.length > 0 || uncategorized > 0

  const remainingBudget = totalPlanned - totalActual
  const burnRate = totalPlanned > 0 ? totalActual / totalPlanned : 0

  return (
    <Card className="rounded-3xl border border-border/70 bg-card/70 p-5 shadow-sm">
      <CardHeader
        title="Financial Insights"
        subtext="Ringkasan cepat kondisi keuanganmu bulan ini."
        className="mb-5"
      />

      {isError ? (
        <div className="mb-4 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-600 dark:text-rose-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>Gagal memuat insight keuangan. Coba lagi ya.</p>
            <button
              type="button"
              onClick={retry}
              className="inline-flex items-center justify-center rounded-full bg-rose-500/90 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
            >
              Muat Ulang
            </button>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <CardBody className="grid gap-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <FinancialInsightItemSkeleton key={`skeleton-${index}`} />
          ))}
        </CardBody>
      ) : (
        <CardBody className="grid gap-3">
          {topSpending ? (
            <FinancialInsightItem
              icon={<Flame className="h-5 w-5 text-rose-500" aria-hidden="true" />}
              title={`Pengeluaran terbesar: ${topSpending.categoryName}`}
              subtitle={`Total ${currencyFormatter.format(topSpending.amount)}${
                topSpending.share ? ` • ${percentageFormatter.format(topSpending.share)}` : ''
              }`}
              tone="accent"
              onClick={() => navigate('/transactions?filter=top-spending')}
              ariaLabel={`Lihat pengeluaran terbesar kategori ${topSpending.categoryName}`}
            />
          ) : (
            <FinancialInsightItem
              icon={<Wallet className="h-5 w-5 text-[color:var(--accent-dark)]" aria-hidden="true" />}
              title="Belum ada pengeluaran tercatat"
              subtitle="Catat transaksi untuk melihat insight pengeluaran."
              tone="info"
              onClick={() => navigate('/transaction/add')}
              ariaLabel="Tambah transaksi baru"
            />
          )}

          {limitedNear.length > 0
            ? limitedNear.map((item) => (
                <BudgetInsightRow key={`near-${item.id}`} item={item} tone="warning" navigate={navigate} />
              ))
            : null}

          {limitedOver.length > 0
            ? limitedOver.map((item) => (
                <BudgetInsightRow key={`over-${item.id}`} item={item} tone="danger" navigate={navigate} />
              ))
            : null}

          {limitedNear.length === 0 ? (
            <FinancialInsightItem
              icon={<AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />}
              title="Tidak ada budget yang hampir melebihi limit"
              subtitle="Pantau terus pengeluaranmu agar tetap terkendali."
              tone="info"
              onClick={() => navigate('/budgets?tab=monthly&filter=near-limit')}
            />
          ) : null}

          {limitedOver.length === 0 ? (
            <FinancialInsightItem
              icon={<Flame className="h-5 w-5 text-rose-500" aria-hidden="true" />}
              title="Belum ada budget yang terlampaui"
              subtitle="Bagus! Pertahankan ritme pengeluaranmu."
              tone="info"
              onClick={() => navigate('/budgets?tab=monthly&filter=over-limit')}
            />
          ) : null}

          {debts.slice(0, 3).map((item) => (
            <DebtInsightRow key={`${item.kind}-${item.id}`} item={item} navigate={navigate} />
          ))}

          {debts.length === 0 ? (
            <FinancialInsightItem
              icon={<CalendarClock className="h-5 w-5 text-[color:var(--accent-dark)]" aria-hidden="true" />}
              title="Tidak ada hutang/tagihan jatuh tempo 7 hari lagi"
              subtitle="Tetap cek berkala untuk menghindari denda."
              tone="info"
              onClick={() => navigate('/debts?filter=due-7')}
            />
          ) : null}

          {weeklyTrend ? (
            <FinancialInsightItem
              icon={
                weeklyTrend.changePct >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-rose-500" aria-hidden="true" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-emerald-500" aria-hidden="true" />
                )
              }
              title={
                weeklyTrend.changePct >= 0
                  ? 'Pengeluaran naik dibanding minggu lalu'
                  : 'Pengeluaran turun dibanding minggu lalu'
              }
              subtitle={`MTD ${formatAmount(weeklyTrend.current)} • Minggu lalu ${formatAmount(Math.abs(weeklyTrend.previous))}`}
              badge={{
                label: `${weeklyTrend.changePct >= 0 ? '+' : ''}${weeklyTrend.changePct.toFixed(0)}%`,
                tone: weeklyTrend.changePct >= 0 ? 'danger' : 'accent',
              }}
              tone={weeklyTrend.changePct >= 0 ? 'warning' : 'accent'}
              onClick={() => navigate('/transactions?filter=weekly-trend')}
            />
          ) : null}

          {uncategorized > 0 ? (
            <FinancialInsightItem
              icon={<Info className="h-5 w-5 text-sky-500" aria-hidden="true" />}
              title={`${uncategorized} transaksi belum dikategorikan`}
              subtitle="Selesaikan kategorinya agar laporan lebih akurat."
              tone="accent"
              onClick={() => navigate('/transactions?filter=uncategorized')}
            />
          ) : null}

          {(totalPlanned > 0 || totalActual > 0) && (
            <div className="rounded-2xl border border-border-subtle/70 bg-surface/60 p-4 text-xs text-muted-foreground">
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-text">
                <span className="font-medium">Sisa anggaran bulan ini</span>
                <span className="font-semibold text-text">{formatAmount(Math.max(remainingBudget, 0))}</span>
              </div>
              <ProgressTiny value={burnRate} tone={burnRate >= 1 ? 'danger' : burnRate >= 0.8 ? 'warning' : 'accent'} className="mt-3" />
              <p className="mt-2 text-xs text-muted-foreground">
                Burn-rate {percentageFormatter.format(burnRate)} dari total budget. Jaga agar tetap di bawah 100%.
              </p>
            </div>
          )}

          {!hasWarnings ? (
            <div className="mt-2 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-200">
              <p className="font-semibold">Semua aman. Tetap lanjut hemat! 🎉</p>
              <button
                type="button"
                onClick={() => navigate('/budgets')}
                className="mt-3 inline-flex items-center justify-center rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                Lihat detail budget
              </button>
            </div>
          ) : null}
        </CardBody>
      )}
    </Card>
  )
}

function BudgetInsightRow({
  item,
  tone,
  navigate,
}: {
  item: BudgetProgressInsight
  tone: 'warning' | 'danger'
  navigate: (to: string) => void
}) {
  const progressLabel = percentageFormatter.format(Math.min(item.progress, 1))
  const subtitle = `${formatAmount(item.actual)} dari ${formatAmount(item.planned)} terpakai`
  return (
    <FinancialInsightItem
      icon={tone === 'warning' ? <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" /> : <Flame className="h-5 w-5 text-rose-500" aria-hidden="true" />}
      title={`${item.categoryName}`}
      subtitle={subtitle}
      badge={{ label: progressLabel, tone: tone === 'warning' ? 'warning' : 'danger', tooltip: `${progressLabel} dari limit ${formatAmount(item.planned)}` }}
      tone={tone}
      onClick={() =>
        navigate(
          tone === 'warning'
            ? '/budgets?tab=monthly&filter=near-limit'
            : '/budgets?tab=monthly&filter=over-limit'
        )
      }
      progress={item.progress}
    />
  )
}

function DebtInsightRow({ item, navigate }: { item: DueItemInsight; navigate: (to: string) => void }) {
  const dueDate = new Date(item.dueDate)
  const formatter = new Intl.DateTimeFormat('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  const dueLabel = formatter.format(dueDate)
  const subtitle = `${item.subtitle} • ${dueLabel}`
  return (
    <FinancialInsightItem
      icon={<CalendarClock className="h-5 w-5 text-[color:var(--accent-dark)]" aria-hidden="true" />}
      title={`${item.kind === 'subscription' ? 'Tagihan' : 'Hutang'} jatuh tempo ${item.daysLeft === 0 ? 'hari ini' : `H-${item.daysLeft}`}`}
      subtitle={`${subtitle} • ${formatAmount(item.amount)}`}
      badge={{ label: item.daysLeft === 0 ? 'Hari ini' : `H-${item.daysLeft}`, tone: item.daysLeft <= 1 ? 'danger' : 'warning' }}
      tone={item.daysLeft <= 1 ? 'danger' : 'warning'}
      onClick={() => navigate('/debts?filter=due-7')}
    />
  )
}
