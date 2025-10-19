import { useMemo } from "react"
import type { ReactNode } from "react"
import { Banknote, CreditCard, TrendingDown, TrendingUp, Wallet } from "lucide-react"
import { formatCurrency } from "../../lib/format.js"
import type { PeriodRange } from "./PeriodPicker"
import { formatPeriodLabel } from "./PeriodPicker"

interface DashboardSummaryProps {
  income: number
  expense: number
  cashBalance: number
  nonCashBalance: number
  totalBalance: number
  incomeTrend: number[]
  expenseTrend: number[]
  balanceTrend: number[]
  incomeMoM: number | null
  expenseMoM: number | null
  balanceMoM: number | null
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
  return (
    <div className="h-6 w-24 animate-pulse rounded-lg bg-muted/60 sm:h-7 sm:w-28" />
  )
}

function formatValue(value: number) {
  return formatCurrency(Math.trunc(value ?? 0), "IDR")
}

function createSparkline(values: number[]): string {
  if (!values.length) return ""
  const width = 120
  const height = 48
  const min = Math.min(...values)
  const max = Math.max(...values)
  const diff = max - min || 1
  const step = values.length > 1 ? width / (values.length - 1) : width
  return values
    .map((value, index) => {
      const x = index * step
      const normalized = (value - min) / diff
      const y = height - normalized * (height - 10) - 5
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")
}

function DashboardSummary({
  income,
  expense,
  cashBalance,
  nonCashBalance,
  totalBalance,
  incomeTrend,
  expenseTrend,
  balanceTrend,
  incomeMoM,
  expenseMoM,
  balanceMoM,
  period,
  loading = false,
  error,
}: DashboardSummaryProps) {
  const periodLabel = useMemo(() => formatPeriodLabel(period) || "—", [period])

  const incomeSparklinePath = useMemo(() => createSparkline(incomeTrend), [incomeTrend])
  const expenseSparklinePath = useMemo(() => createSparkline(expenseTrend), [expenseTrend])
  const balanceSparklinePath = useMemo(() => createSparkline(balanceTrend), [balanceTrend])

  const renderMoM = (value: number | null) => {
    if (loading) {
      return <div className="h-5 w-14 animate-pulse rounded-full bg-muted/60 sm:h-6 sm:w-16" />
    }

    if (value === null) {
      return (
        <span className="mb-1 text-[11px] font-medium text-muted-foreground sm:text-xs">—</span>
      )
    }

    if (value === 0) {
      return (
        <span className="mb-1 inline-flex items-center rounded-full bg-muted/60 px-2 py-1 text-[11px] font-semibold text-muted-foreground sm:px-2.5 sm:text-xs">
          0.0%
        </span>
      )
    }

    const positive = value > 0
    const tone = positive
      ? "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400"
      : "bg-rose-500/10 text-rose-500 dark:text-rose-400"
    const arrow = positive ? "▲" : "▼"

    return (
      <span
        className={`mb-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold sm:px-2.5 sm:text-xs ${tone}`}
      >
        <span aria-hidden="true">{arrow}</span>
        <span>{Math.abs(value).toFixed(1)}%</span>
      </span>
    )
  }

  const renderSparkline = (path: string, tone: string) => {
    if (loading) {
      return <div className="h-16 w-full animate-pulse rounded-xl bg-muted/60" />
    }

    if (!path) {
      return <div className="h-16 w-full rounded-xl bg-muted/40" />
    }

    return (
      <svg viewBox="0 0 120 48" className={`h-full w-full ${tone}`} aria-hidden="true" focusable="false">
        <polyline
          points={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  return (
    <section className="space-y-3 md:space-y-4 max-[400px]:space-y-2">
      <div className="grid gap-3 sm:gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
        <article className="group min-h-fit rounded-xl border border-white/10 bg-gradient-to-b from-white/80 to-white/40 p-3 shadow-sm transition hover:border-primary/20 hover:shadow-md dark:from-zinc-900/60 dark:to-zinc-900/30 sm:p-4 md:p-5">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2 sm:gap-3">
              <p className="text-sm font-medium text-muted-foreground max-[400px]:text-xs">Pemasukan</p>
              <IconBadge title="Total pemasukan">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
              </IconBadge>
            </div>
            {loading ? (
              <SkeletonBar />
            ) : (
              <div className="flex items-baseline justify-between gap-2">
                <p className="break-words whitespace-normal text-lg font-bold tracking-tight text-emerald-600 tabular-nums dark:text-emerald-400 sm:text-xl md:text-2xl max-[400px]:text-base">
                  {formatValue(income)}
                </p>
                {renderMoM(incomeMoM)}
              </div>
            )}
            <div className="mt-1 h-16">{renderSparkline(incomeSparklinePath, "text-emerald-500/80 dark:text-emerald-400/90")}</div>
            <p className="text-[11px] text-muted-foreground sm:text-xs md:text-sm">
              Periode {periodLabel}
            </p>
          </div>
        </article>

        <article className="group min-h-fit rounded-xl border border-white/10 bg-gradient-to-b from-white/80 to-white/40 p-3 shadow-sm transition hover:border-primary/20 hover:shadow-md dark:from-zinc-900/60 dark:to-zinc-900/30 sm:p-4 md:p-5">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2 sm:gap-3">
              <p className="text-sm font-medium text-muted-foreground max-[400px]:text-xs">Pengeluaran</p>
              <IconBadge title="Total pengeluaran">
                <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5" />
              </IconBadge>
            </div>
            {loading ? (
              <SkeletonBar />
            ) : (
              <div className="flex items-baseline justify-between gap-2">
                <p className="break-words whitespace-normal text-lg font-bold tracking-tight text-rose-600 tabular-nums dark:text-rose-400 sm:text-xl md:text-2xl max-[400px]:text-base">
                  {formatValue(expense)}
                </p>
                {renderMoM(expenseMoM)}
              </div>
            )}
            <div className="mt-1 h-16">{renderSparkline(expenseSparklinePath, "text-rose-500/80 dark:text-rose-400/90")}</div>
            <p className="text-[11px] text-muted-foreground sm:text-xs md:text-sm">
              Periode {periodLabel}
            </p>
          </div>
        </article>

        <article className="group min-h-fit rounded-xl border border-white/10 bg-gradient-to-b from-white/80 to-white/40 p-3 shadow-sm transition hover:border-primary/20 hover:shadow-md dark:from-zinc-900/60 dark:to-zinc-900/30 sm:p-4 md:p-5">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2 sm:gap-3">
              <p className="text-sm font-medium text-muted-foreground max-[400px]:text-xs">Saldo</p>
              <IconBadge title="Ringkasan saldo">
                <Wallet className="h-4 w-4 sm:h-5 sm:w-5" />
              </IconBadge>
            </div>
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
                    <span className="text-[11px] font-medium text-muted-foreground sm:text-xs md:text-sm">
                      Cash
                    </span>
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
                    <span className="text-[11px] font-medium text-muted-foreground sm:text-xs md:text-sm">
                      Non-Cash
                    </span>
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
        </article>

        <article className="group min-h-fit rounded-xl border border-white/10 bg-gradient-to-b from-white/80 to-white/40 p-3 shadow-sm transition hover:border-primary/20 hover:shadow-md dark:from-zinc-900/60 dark:to-zinc-900/30 sm:p-4 md:p-5">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2 sm:gap-3">
              <p className="text-sm font-medium text-muted-foreground max-[400px]:text-xs">Total Saldo</p>
              <IconBadge title="Total saldo">
                <Banknote className="h-4 w-4 sm:h-5 sm:w-5" />
              </IconBadge>
            </div>
            {loading ? (
              <SkeletonBar />
            ) : (
              <div className="flex items-baseline justify-between gap-2">
                <p className="break-words whitespace-normal text-lg font-bold tracking-tight text-foreground tabular-nums sm:text-xl md:text-2xl max-[400px]:text-base">
                  {formatValue(totalBalance)}
                </p>
                {renderMoM(balanceMoM)}
              </div>
            )}
          </div>
          <div className="mt-5 h-20 rounded-xl bg-gradient-to-t from-primary/5 to-transparent sm:mt-6">
            {renderSparkline(balanceSparklinePath, "text-primary/80")}
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
