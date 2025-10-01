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
      className="h-9 w-9 shrink-0 rounded-xl bg-primary/10 text-primary"
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
    <section className="space-y-4">
      <div className="grid gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
        <article className="group rounded-2xl border border-transparent bg-gradient-to-b from-white/80 to-white/40 p-5 shadow-sm transition hover:border-primary/20 hover:shadow-md dark:from-zinc-900/60 dark:to-zinc-900/30">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Pemasukan</p>
              {loading ? (
                <SkeletonBar />
              ) : (
                <p className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 md:text-3xl">
                  {formatValue(income)}
                </p>
              )}
              <p className="text-xs text-muted-foreground">Periode {periodLabel}</p>
            </div>
            <IconBadge title="Total pemasukan">
              <TrendingUp className="h-5 w-5" />
            </IconBadge>
          </div>
        </article>

        <article className="group rounded-2xl border border-transparent bg-gradient-to-b from-white/80 to-white/40 p-5 shadow-sm transition hover:border-primary/20 hover:shadow-md dark:from-zinc-900/60 dark:to-zinc-900/30">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Pengeluaran</p>
              {loading ? (
                <SkeletonBar />
              ) : (
                <p className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400 md:text-3xl">
                  {formatValue(expense)}
                </p>
              )}
              <p className="text-xs text-muted-foreground">Periode {periodLabel}</p>
            </div>
            <IconBadge title="Total pengeluaran">
              <TrendingDown className="h-5 w-5" />
            </IconBadge>
          </div>
        </article>

        <article className="group rounded-2xl border border-transparent bg-gradient-to-b from-white/80 to-white/40 p-5 shadow-sm transition hover:border-primary/20 hover:shadow-md dark:from-zinc-900/60 dark:to-zinc-900/30">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Saldo</p>
              <div className="mt-3 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400" title="Saldo cash">
                    <Wallet className="h-4 w-4" />
                  </span>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-muted-foreground">Cash</span>
                    {loading ? (
                      <SkeletonBar />
                    ) : (
                      <span className="text-lg font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                        {formatValue(cashBalance)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 border-t border-border/60 pt-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400" title="Saldo non-cash">
                    <CreditCard className="h-4 w-4" />
                  </span>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-muted-foreground">Non-Cash</span>
                    {loading ? (
                      <SkeletonBar />
                    ) : (
                      <span className="text-lg font-semibold text-sky-600 dark:text-sky-400 whitespace-nowrap">
                        {formatValue(nonCashBalance)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <IconBadge title="Ringkasan saldo">
              <Wallet className="h-5 w-5" />
            </IconBadge>
          </div>
        </article>

        <article className="group rounded-2xl border border-transparent bg-gradient-to-b from-white/80 to-white/40 p-5 shadow-sm transition hover:border-primary/20 hover:shadow-md dark:from-zinc-900/60 dark:to-zinc-900/30">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Total Saldo</p>
              {loading ? (
                <SkeletonBar />
              ) : (
                <p className="text-2xl font-bold tracking-tight text-foreground md:text-3xl whitespace-nowrap">
                  {formatValue(totalBalance)}
                </p>
              )}
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${netTone}`}>
                {netPositive ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                )}
                <span>
                  Net {netPositive ? "+" : "-"}
                  {formatValue(Math.abs(net))}
                </span>
              </span>
            </div>
            <IconBadge title="Total saldo">
              <Banknote className="h-5 w-5" />
            </IconBadge>
          </div>
          <div className="mt-6 h-20 rounded-xl bg-gradient-to-t from-primary/5 to-transparent">
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
