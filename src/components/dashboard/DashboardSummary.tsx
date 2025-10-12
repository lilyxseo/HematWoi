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

interface DashboardSummaryProps {
  income: number
  expense: number
  cashBalance: number
  nonCashBalance: number
  totalBalance: number
  period: PeriodRange
  loading?: boolean
  error?: Error | null
}

function IconBadge({ title, children }: { title: string; children: ReactNode }) {
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-primary/10 text-primary sm:h-11 sm:w-11"
      title={title}
      aria-hidden="true"
    >
      <span className="flex h-full w-full items-center justify-center">{children}</span>
    </span>
  )
}

function SkeletonBar() {
  return <div className="h-7 w-28 animate-pulse rounded-lg bg-muted/60" />
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
  period,
  loading = false,
  error,
}: DashboardSummaryProps) {
  const periodLabel = useMemo(() => formatPeriodLabel(period) || "—", [period])
  const net = income - expense
  const netPositive = net >= 0
  const netTone = netPositive
    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    : "bg-rose-500/10 text-rose-600 dark:text-rose-400"

  const sparklineValues = useMemo(() => {
    const base = Math.max(income, expense, Math.abs(net), 1)
    const steps = Array.from({ length: 8 }, (_, index) => index / 7)
    return steps.map((step) => {
      const wave = Math.sin(step * Math.PI)
      const trend = netPositive ? step : 1 - step
      return base * (0.4 + wave * 0.35) + Math.abs(net) * 0.2 * trend
    })
  }, [income, expense, net, netPositive])

  const sparklinePath = useMemo(() => createSparkline(sparklineValues), [sparklineValues])

  return (
    <section className="space-y-4 max-[400px]:space-y-3">
      <div className="grid gap-3 min-[420px]:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <article className="group relative min-h-fit overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-white/80 to-white/40 p-3 shadow-sm transition hover:border-primary/20 hover:shadow-md dark:from-zinc-900/60 dark:to-zinc-900/30 sm:p-4 md:p-5">
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-muted-foreground sm:text-base">Pemasukan</p>
              {loading ? (
                <SkeletonBar />
              ) : (
                <p className="text-lg font-bold tracking-tight text-emerald-600 tabular-nums dark:text-emerald-400 sm:text-xl md:text-2xl max-[400px]:text-base">
                  {formatValue(income)}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground sm:text-xs md:text-sm">Periode {periodLabel}</p>
            </div>
            <IconBadge title="Total pemasukan">
              <TrendingUp className="size-4 sm:size-5" />
            </IconBadge>
          </div>
        </article>

        <article className="group relative min-h-fit overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-white/80 to-white/40 p-3 shadow-sm transition hover:border-primary/20 hover:shadow-md dark:from-zinc-900/60 dark:to-zinc-900/30 sm:p-4 md:p-5">
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-muted-foreground sm:text-base">Pengeluaran</p>
              {loading ? (
                <SkeletonBar />
              ) : (
                <p className="text-lg font-bold tracking-tight text-rose-600 tabular-nums dark:text-rose-400 sm:text-xl md:text-2xl max-[400px]:text-base">
                  {formatValue(expense)}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground sm:text-xs md:text-sm">Periode {periodLabel}</p>
            </div>
            <IconBadge title="Total pengeluaran">
              <TrendingDown className="size-4 sm:size-5" />
            </IconBadge>
          </div>
        </article>

        <article className="group relative min-h-fit overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-white/80 to-white/40 p-3 shadow-sm transition hover:border-primary/20 hover:shadow-md dark:from-zinc-900/60 dark:to-zinc-900/30 sm:p-4 md:p-5">
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <div className="w-full space-y-2">
              <p className="text-sm font-semibold text-muted-foreground sm:text-base">Saldo</p>
              <div className="space-y-3 sm:space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span
                    className="flex size-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 sm:size-10"
                    title="Saldo cash"
                  >
                    <Wallet className="size-4 sm:size-5" />
                  </span>
                  <div className="flex flex-1 flex-col">
                    <span className="text-[11px] font-medium text-muted-foreground sm:text-xs md:text-sm">Cash</span>
                    {loading ? (
                      <SkeletonBar />
                    ) : (
                      <span className="text-lg font-semibold text-amber-600 tabular-nums dark:text-amber-400 sm:text-xl md:text-2xl max-[400px]:text-base whitespace-normal break-words">
                        {formatValue(cashBalance)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <span
                    className="flex size-9 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 sm:size-10"
                    title="Saldo non-cash"
                  >
                    <CreditCard className="size-4 sm:size-5" />
                  </span>
                  <div className="flex flex-1 flex-col">
                    <span className="text-[11px] font-medium text-muted-foreground sm:text-xs md:text-sm">Non-Cash</span>
                    {loading ? (
                      <SkeletonBar />
                    ) : (
                      <span className="text-lg font-semibold text-sky-600 tabular-nums dark:text-sky-400 sm:text-xl md:text-2xl max-[400px]:text-base whitespace-normal break-words">
                        {formatValue(nonCashBalance)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <IconBadge title="Ringkasan saldo">
              <Wallet className="size-4 sm:size-5" />
            </IconBadge>
          </div>
        </article>

        <article className="group relative min-h-fit overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-white/80 to-white/40 p-3 shadow-sm transition hover:border-primary/20 hover:shadow-md dark:from-zinc-900/60 dark:to-zinc-900/30 sm:p-4 md:p-5">
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-muted-foreground sm:text-base">Total Saldo</p>
              {loading ? (
                <SkeletonBar />
              ) : (
                <p className="text-lg font-bold tracking-tight text-foreground tabular-nums sm:text-xl md:text-2xl max-[400px]:text-base whitespace-normal break-words">
                  {formatValue(totalBalance)}
                </p>
              )}
              <span
                className={`inline-flex min-h-8 items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold ${netTone} sm:text-xs md:text-sm`}
              >
                {netPositive ? (
                  <ArrowUpRight className="size-3.5" />
                ) : (
                  <ArrowDownRight className="size-3.5" />
                )}
                <span>
                  Net {netPositive ? "+" : "-"}
                  {formatValue(Math.abs(net))}
                </span>
              </span>
            </div>
            <IconBadge title="Total saldo">
              <Banknote className="size-4 sm:size-5" />
            </IconBadge>
          </div>
          <div className="mt-6 h-20 rounded-xl bg-gradient-to-t from-primary/5 to-transparent sm:mt-7">
            {loading ? (
              <div className="h-full w-full animate-pulse rounded-xl bg-primary/10" />
            ) : (
              <svg viewBox="0 0 120 48" className="h-full w-full text-primary/70">
                <polyline
                  points={sparklinePath}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        </article>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 px-4 py-3 text-sm text-rose-600 dark:text-rose-300">
          {error.message}
        </div>
      ) : null}
    </section>
  )
}

export default DashboardSummary
