import { useMemo } from "react"
import type { ReactNode } from "react"
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CreditCard,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react"
import { formatCurrency } from "../../lib/format.js"
import type { PeriodRange } from "./PeriodPicker"
import { formatPeriodLabel } from "./PeriodPicker"

type SparklineShape = {
  path: string
  area: string
  width: number
  height: number
}

interface DashboardSummaryProps {
  income: number
  previousIncome: number
  dailyIncome: number[]
  expense: number
  previousExpense: number
  dailyExpense: number[]
  cashBalance: number
  nonCashBalance: number
  totalBalance: number
  previousTotalBalance: number
  dailyTotalBalance: number[]
  period: PeriodRange
  loading?: boolean
  error?: Error | null
}

function IconBadge({ title, children }: { title: string; children: ReactNode }) {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:h-10 sm:w-10"
      title={title}
      aria-hidden="true"
    >
      {children}
    </span>
  )
}

function SkeletonBar() {
  return <div className="h-6 w-24 animate-pulse rounded-lg bg-muted/60 sm:h-7 sm:w-28" />
}

function formatValue(value: number) {
  return formatCurrency(Math.trunc(value ?? 0), "IDR")
}

function createSparkline(values: number[]): SparklineShape | null {
  const width = 120
  const height = 48
  const baseY = height - 5
  if (!values.length) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const diff = max - min || 1
  const step = values.length > 1 ? width / (values.length - 1) : width
  const points = values
    .map((value, index) => {
      const x = index * step
      const normalized = (value - min) / diff
      const y = height - normalized * (height - 10) - 5
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")
  const area = `${points} ${width.toFixed(1)},${baseY.toFixed(1)} 0,${baseY.toFixed(1)}`
  return { path: points, area, width, height }
}

function calculateMoM(current: number, previous: number): number | null {
  const safeCurrent = Number.isFinite(current) ? current : 0
  const safePrevious = Number.isFinite(previous) ? previous : 0
  const EPSILON = 1e-6
  if (Math.abs(safePrevious) <= EPSILON) {
    if (Math.abs(safeCurrent) <= EPSILON) return 0
    return null
  }
  return ((safeCurrent - safePrevious) / Math.abs(safePrevious)) * 100
}

function MoMIndicator({ value, loading }: { value: number | null; loading: boolean }) {
  if (loading) {
    return <div className="h-4 w-14 animate-pulse rounded-full bg-muted/50 sm:h-5 sm:w-16" aria-hidden="true" />
  }
  if (value === null) {
    return (
      <span className="text-[11px] font-medium text-muted-foreground sm:text-xs" title="Perbandingan bulan lalu tidak tersedia">
        —
      </span>
    )
  }
  const positive = value > 0
  const negative = value < 0
  const tone = positive
    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
    : negative
      ? "bg-rose-500/15 text-rose-500 dark:text-rose-300"
      : "bg-muted/60 text-muted-foreground"
  const symbol = positive ? "▲" : negative ? "▼" : "■"
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold sm:px-2.5 sm:text-xs ${tone}`}
      title="Perubahan dibanding bulan lalu"
    >
      <span className="text-sm leading-none">{symbol}</span>
      <span>{Math.abs(value).toFixed(1)}%</span>
    </span>
  )
}

function Sparkline({ id, values, tone, loading }: { id: string; values: number[]; tone: string; loading: boolean }) {
  const shape = useMemo(() => createSparkline(values), [values])

  return (
    <div className="relative h-12 w-full overflow-hidden rounded-lg border border-white/20 bg-white/60 dark:border-zinc-800/70 dark:bg-zinc-900/50 sm:h-14">
      {loading ? (
        <div className="h-full w-full animate-pulse bg-muted/40" aria-hidden="true" />
      ) : shape ? (
        <svg
          viewBox={`0 0 ${shape.width} ${shape.height}`}
          className={`h-full w-full ${tone}`}
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient id={`${id}-gradient`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={shape.area} fill={`url(#${id}-gradient)`} opacity="0.6" />
          <polyline
            points={shape.path}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <div
          className="h-full w-full bg-gradient-to-br from-transparent via-white/30 to-transparent dark:via-zinc-800/30"
          aria-hidden="true"
        />
      )}
    </div>
  )
}

function DashboardSummary({
  income,
  previousIncome,
  dailyIncome,
  expense,
  previousExpense,
  dailyExpense,
  cashBalance,
  nonCashBalance,
  totalBalance,
  previousTotalBalance,
  dailyTotalBalance,
  period,
  loading = false,
  error,
}: DashboardSummaryProps) {
  const periodLabel = useMemo(() => formatPeriodLabel(period) || "—", [period])
  const net = income - expense
  const netPositive = net >= 0

  const incomeMoM = useMemo(() => calculateMoM(income, previousIncome), [income, previousIncome])
  const expenseMoM = useMemo(() => calculateMoM(expense, previousExpense), [expense, previousExpense])
  const totalMoM = useMemo(() => calculateMoM(totalBalance, previousTotalBalance), [totalBalance, previousTotalBalance])

  return (
    <section className="space-y-3 md:space-y-4 max-[400px]:space-y-2">
      <div className="grid gap-3 sm:gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
        <article className="group min-h-fit rounded-xl border border-white/10 bg-gradient-to-b from-white/80 to-white/40 p-3 shadow-sm transition hover:border-primary/20 hover:shadow-md dark:from-zinc-900/60 dark:to-zinc-900/30 sm:p-4 md:p-5">
          <div className="flex items-start justify-between gap-2.5 sm:gap-3">
            <div className="w-full space-y-1.5 sm:space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-muted-foreground max-[400px]:text-xs">Pemasukan</p>
                <MoMIndicator value={incomeMoM} loading={loading} />
              </div>
              {loading ? (
                <SkeletonBar />
              ) : (
                <p className="break-words whitespace-normal text-lg font-bold tracking-tight text-emerald-600 tabular-nums dark:text-emerald-400 sm:text-xl md:text-2xl max-[400px]:text-base">
                  {formatValue(income)}
                </p>
              )}
              <Sparkline id="income-trend" values={dailyIncome} tone="text-emerald-500 dark:text-emerald-300" loading={loading} />
              <p className="text-[11px] text-muted-foreground sm:text-xs md:text-sm">Periode {periodLabel}</p>
            </div>
            <IconBadge title="Total pemasukan">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
            </IconBadge>
          </div>
        </article>

        <article className="group min-h-fit rounded-xl border border-white/10 bg-gradient-to-b from-white/80 to-white/40 p-3 shadow-sm transition hover:border-primary/20 hover:shadow-md dark:from-zinc-900/60 dark:to-zinc-900/30 sm:p-4 md:p-5">
          <div className="flex items-start justify-between gap-2.5 sm:gap-3">
            <div className="w-full space-y-1.5 sm:space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-muted-foreground max-[400px]:text-xs">Pengeluaran</p>
                <MoMIndicator value={expenseMoM} loading={loading} />
              </div>
              {loading ? (
                <SkeletonBar />
              ) : (
                <p className="break-words whitespace-normal text-lg font-bold tracking-tight text-rose-600 tabular-nums dark:text-rose-400 sm:text-xl md:text-2xl max-[400px]:text-base">
                  {formatValue(expense)}
                </p>
              )}
              <Sparkline id="expense-trend" values={dailyExpense} tone="text-rose-500 dark:text-rose-300" loading={loading} />
              <p className="text-[11px] text-muted-foreground sm:text-xs md:text-sm">Periode {periodLabel}</p>
            </div>
            <IconBadge title="Total pengeluaran">
              <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5" />
            </IconBadge>
          </div>
        </article>

        <article className="group min-h-fit rounded-xl border border-white/10 bg-gradient-to-b from-white/80 to-white/40 p-3 shadow-sm transition hover:border-primary/20 hover:shadow-md dark:from-zinc-900/60 dark:to-zinc-900/30 sm:p-4 md:p-5">
          <div className="flex items-start justify-between gap-2.5 sm:gap-3">
            <div className="w-full">
              <p className="text-sm font-medium text-muted-foreground max-[400px]:text-xs">Saldo</p>
              <div className="mt-3 flex flex-col gap-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      title="Saldo cash"
                    >
                      <Wallet className="h-4 w-4 sm:h-5 sm:w-5" />
                    </span>
                    <div className="flex min-w-0 flex-col">
                      <span className="text-[11px] font-medium text-muted-foreground sm:text-xs md:text-sm">Cash</span>
                      {loading ? (
                        <SkeletonBar />
                      ) : (
                        <span className="break-words whitespace-normal text-lg font-semibold text-amber-600 tabular-nums dark:text-amber-400 sm:text-xl md:text-2xl max-[400px]:text-base">
                          {formatValue(cashBalance)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400"
                      title="Saldo non-cash"
                    >
                      <CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />
                    </span>
                    <div className="flex min-w-0 flex-col">
                      <span className="text-[11px] font-medium text-muted-foreground sm:text-xs md:text-sm">Non-Cash</span>
                      {loading ? (
                        <SkeletonBar />
                      ) : (
                        <span className="break-words whitespace-normal text-lg font-semibold text-sky-600 tabular-nums dark:text-sky-400 sm:text-xl md:text-2xl max-[400px]:text-base">
                          {formatValue(nonCashBalance)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <IconBadge title="Ringkasan saldo">
              <Wallet className="h-4 w-4 sm:h-5 sm:w-5" />
            </IconBadge>
          </div>
        </article>

        <article className="group min-h-fit rounded-xl border border-white/10 bg-gradient-to-b from-white/80 to-white/40 p-3 shadow-sm transition hover:border-primary/20 hover:shadow-md dark:from-zinc-900/60 dark:to-zinc-900/30 sm:p-4 md:p-5">
          <div className="flex items-start justify-between gap-2.5 sm:gap-3">
            <div className="w-full space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-muted-foreground max-[400px]:text-xs">Total Saldo</p>
                <MoMIndicator value={totalMoM} loading={loading} />
              </div>
              {loading ? (
                <SkeletonBar />
              ) : (
                <p className="break-words whitespace-normal text-lg font-bold tracking-tight text-sky-600 tabular-nums dark:text-sky-300 sm:text-xl md:text-2xl max-[400px]:text-base">
                  {formatValue(totalBalance)}
                </p>
              )}
              <Sparkline id="total-trend" values={dailyTotalBalance} tone="text-sky-500 dark:text-sky-300" loading={loading} />
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2.5 py-1 text-[11px] font-semibold text-sky-600 dark:text-sky-300 sm:px-3 sm:text-xs">
                {netPositive ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                )}
                <span>
                  TOTAL SALDO {netPositive ? "+" : "-"}
                  {formatValue(Math.abs(net))}
                </span>
              </span>
              <p className="text-[11px] text-muted-foreground sm:text-xs md:text-sm">Periode {periodLabel}</p>
            </div>
            <IconBadge title="Total saldo">
              <Banknote className="h-4 w-4 sm:h-5 sm:w-5" />
            </IconBadge>
          </div>
        </article>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-sm text-rose-600 dark:text-rose-300 sm:px-4 sm:py-3">
          {error.message}
        </div>
      ) : null}
    </section>
  )
}

export default DashboardSummary
