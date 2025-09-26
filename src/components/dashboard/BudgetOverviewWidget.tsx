import { useMemo } from "react"
import { Link } from "react-router-dom"
import { formatCurrency } from "../../lib/format"
import type { PeriodRange } from "./PeriodPicker"
import { formatPeriodLabel } from "./PeriodPicker"

type BudgetLike = {
  id?: string
  category?: string | null
  label?: string | null
  name?: string | null
  amount_planned?: number | null
  planned?: number | null
  period_month?: string | null
  month?: string | null
}

type TransactionLike = {
  amount?: number | string | null
  type?: string | null
  date?: string | null
  category?: string | null
}

interface BudgetOverviewWidgetProps {
  budgets: BudgetLike[]
  transactions: TransactionLike[]
  period: PeriodRange
}

type BudgetRow = {
  id: string
  title: string
  planned: number
  spent: number
  remaining: number
  progress: number
}

function getBudgetMonth(budget: BudgetLike): string | null {
  const raw = budget.period_month ?? budget.month
  if (!raw) return null
  return String(raw).slice(0, 7)
}

function resolveBudgetTitle(budget: BudgetLike): string {
  return (
    budget.label || budget.name || budget.category || "Tanpa kategori"
  )
}

function resolvePlannedAmount(budget: BudgetLike): number {
  const value =
    budget.planned ?? budget.amount_planned ?? 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeDate(value?: string | null): string | null {
  if (!value) return null
  return String(value).slice(0, 10)
}

function buildExpenseMap(
  transactions: TransactionLike[],
  period: PeriodRange,
): Map<string, number> {
  const start = normalizeDate(period.start)
  const end = normalizeDate(period.end)
  const map = new Map<string, number>()

  transactions.forEach((tx) => {
    if ((tx.type ?? "").toLowerCase() !== "expense") return
    const category = tx.category ?? ""
    if (!category) return
    const rawAmount = Number(tx.amount ?? 0)
    const amountValue = Number.isFinite(rawAmount) ? Math.abs(rawAmount) : 0
    if (amountValue <= 0) return
    const dateValue = normalizeDate(tx.date)
    if (start && dateValue && dateValue < start) return
    if (end && dateValue && dateValue > end) return

    map.set(category, (map.get(category) ?? 0) + amountValue)
  })

  return map
}

function resolveActiveMonths(range: PeriodRange): Set<string> {
  const months = new Set<string>()
  const start = normalizeDate(range.start)
  const end = normalizeDate(range.end)
  if (start) months.add(start.slice(0, 7))
  if (end) months.add(end.slice(0, 7))
  return months
}

function describeProgress(progress: number): string {
  if (!Number.isFinite(progress) || progress < 0) return "0%"
  return `${Math.round(progress * 100)}%`
}

function progressTone(progress: number): string {
  if (progress >= 1) {
    return "bg-rose-500/20 text-rose-600 dark:text-rose-300"
  }
  if (progress >= 0.8) {
    return "bg-amber-400/20 text-amber-600 dark:text-amber-300"
  }
  return "bg-emerald-400/20 text-emerald-600 dark:text-emerald-300"
}

function barTone(progress: number): string {
  if (progress >= 1) return "bg-rose-500"
  if (progress >= 0.8) return "bg-amber-400"
  return "bg-emerald-500"
}

function BudgetOverviewWidget({ budgets, transactions, period }: BudgetOverviewWidgetProps) {
  const months = useMemo(() => resolveActiveMonths(period), [period])

  const expenseMap = useMemo(
    () => buildExpenseMap(transactions ?? [], period),
    [transactions, period],
  )

  const rows = useMemo<BudgetRow[]>(() => {
    return (budgets ?? [])
      .map((budget) => {
        const month = getBudgetMonth(budget)
        if (months.size && month && !months.has(month)) return null
        const planned = resolvePlannedAmount(budget)
        const title = resolveBudgetTitle(budget)
        const spent = expenseMap.get(title) ?? 0
        const remaining = planned - spent
        const progress = planned > 0 ? spent / planned : 0
        return {
          id: budget.id ?? `${title}-${month ?? ""}`,
          title,
          planned,
          spent,
          remaining,
          progress,
        }
      })
      .filter((row): row is BudgetRow => Boolean(row))
      .sort((a, b) => b.progress - a.progress)
  }, [budgets, expenseMap, months])

  const topRows = useMemo(() => rows.slice(0, 4), [rows])

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.planned += row.planned
        acc.spent += row.spent
        return acc
      },
      { planned: 0, spent: 0 },
    )
  }, [rows])

  const remainingTotal = totals.planned - totals.spent
  const coverage = totals.planned > 0 ? Math.min(totals.spent / totals.planned, 1) : 0
  const periodLabel = useMemo(() => formatPeriodLabel(period) || "—", [period])

  return (
    <section className="rounded-2xl border border-border/60 bg-card/60 p-5 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground md:text-xl">
              Anggaran Periode Ini
            </h2>
            <p className="text-sm text-muted-foreground">
              Ringkasan anggaran untuk {periodLabel}
            </p>
          </div>
          <Link
            to="/budgets"
            className="inline-flex h-10 items-center justify-center rounded-2xl border border-border/80 px-4 text-sm font-semibold text-foreground transition hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          >
            Kelola Anggaran
          </Link>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-muted/40 p-4">
            <p className="text-xs font-medium text-muted-foreground">Direncanakan</p>
            <p className="mt-1 text-lg font-semibold text-foreground md:text-xl">
              {formatCurrency(Math.max(totals.planned, 0), "IDR")}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/40 p-4">
            <p className="text-xs font-medium text-muted-foreground">Terpakai</p>
            <p className="mt-1 text-lg font-semibold text-foreground md:text-xl">
              {formatCurrency(Math.max(totals.spent, 0), "IDR")}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/40 p-4">
            <p className="text-xs font-medium text-muted-foreground">Sisa</p>
            <p className="mt-1 text-lg font-semibold text-foreground md:text-xl">
              {formatCurrency(Math.max(remainingTotal, 0), "IDR")}
            </p>
          </div>
        </div>

        {topRows.length ? (
          <div className="space-y-4">
            {topRows.map((row) => {
              const clampedProgress = Math.max(0, Math.min(row.progress, 1))
              return (
                <article
                  key={row.id}
                  className="rounded-2xl border border-border/50 bg-background/60 p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        {row.title}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(row.spent, "IDR")} dari {formatCurrency(row.planned, "IDR")}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${progressTone(row.progress)}`}
                    >
                      {row.progress >= 1 ? "Melebihi" : row.progress >= 0.8 ? "Hampir penuh" : "Sehat"}
                      <span>{describeProgress(row.progress)}</span>
                    </span>
                  </div>
                  <div className="mt-4">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted/50">
                      <div
                        className={`h-full ${barTone(row.progress)}`}
                        style={{ width: `${clampedProgress * 100}%` }}
                        role="presentation"
                        aria-hidden="true"
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Sisa {formatCurrency(Math.max(row.remaining, 0), "IDR")}</span>
                      <span>{describeProgress(row.progress)}</span>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/60 bg-background/40 p-6 text-sm text-muted-foreground">
            Belum ada anggaran untuk periode ini. Tambahkan anggaran untuk mulai memantau.
          </div>
        )}

        <footer className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-foreground">Cakupan anggaran</p>
            <p>Terpakai {formatCurrency(Math.max(totals.spent, 0), "IDR")} dari {formatCurrency(Math.max(totals.planned, 0), "IDR")}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-2 w-32 overflow-hidden rounded-full bg-border/60">
              <div
                className={`h-full ${barTone(coverage)}`}
                style={{ width: `${coverage * 100}%` }}
              />
            </div>
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${progressTone(coverage)}`}>
              {describeProgress(coverage)}
            </span>
          </div>
        </footer>
      </div>
    </section>
  )
}

export default BudgetOverviewWidget
