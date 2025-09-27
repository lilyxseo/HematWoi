import { useMemo } from "react"
import { AlertTriangle, ArrowRight, Sparkles } from "lucide-react"
import { Link } from "react-router-dom"
import { useBudgets } from "../../hooks/useBudgets"
import { formatCurrency } from "../../lib/format.js"
import type { BudgetWithSpent } from "../../lib/budgetApi"
import type { PeriodRange } from "./PeriodPicker"

interface BudgetHighlightsProps {
  period: PeriodRange
}

function getBudgetPeriod(range: PeriodRange): string {
  const base = range?.end || range?.start
  if (!base) {
    const now = new Date()
    const month = `${now.getMonth() + 1}`.padStart(2, "0")
    return `${now.getFullYear()}-${month}`
  }
  return base.slice(0, 7)
}

type HighlightBudget = {
  id: string
  label: string
  planned: number
  spent: number
  progress: number
  distance: number
}

function formatPercent(progress: number) {
  return `${Math.round(progress * 100)}%`
}

function createHighlights(rows: BudgetWithSpent[]): HighlightBudget[] {
  return rows
    .map((row) => {
      const planned = Number(row.amount_planned ?? 0)
      if (planned <= 0) return null
      const spent = Number(row.spent ?? 0)
      const progress = planned > 0 ? spent / planned : 0
      const distance = Math.abs(1 - progress)
      return {
        id: row.id,
        label: row.category?.name ?? "Tanpa kategori",
        planned,
        spent,
        progress,
        distance,
      }
    })
    .filter((item): item is HighlightBudget => item !== null)
    .sort((a, b) => {
      if (a.distance === b.distance) {
        return b.progress - a.progress
      }
      return a.distance - b.distance
    })
    .slice(0, 3)
}

function BudgetSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-border/70 bg-white/40 p-4 shadow-sm dark:border-border/40 dark:bg-white/5">
      <div className="flex items-center justify-between">
        <div className="h-4 w-36 animate-pulse rounded-full bg-muted/60" />
        <div className="h-5 w-12 animate-pulse rounded-full bg-muted/60" />
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="h-3 w-24 animate-pulse rounded-full bg-muted/40" />
        <div className="h-3 w-20 animate-pulse rounded-full bg-muted/40" />
      </div>
      <div className="h-2.5 w-full animate-pulse rounded-full bg-muted/50" />
    </div>
  )
}

export default function BudgetHighlights({ period }: BudgetHighlightsProps) {
  const budgetPeriod = useMemo(() => getBudgetPeriod(period), [period])
  const { rows, loading, error } = useBudgets(budgetPeriod)

  const highlights = useMemo(() => createHighlights(rows), [rows])

  return (
    <section className="rounded-3xl border border-border/60 bg-gradient-to-br from-white via-white to-primary/5 p-6 shadow-sm transition dark:border-border/40 dark:from-zinc-900/60 dark:via-zinc-900/40 dark:to-primary/10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Fokus Anggaran
          </span>
          <h2 className="mt-3 text-xl font-semibold text-foreground sm:text-2xl">Budget Hampir Mencapai Batas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pantau kategori yang paling mendekati 100% agar kamu bisa segera melakukan penyesuaian.
          </p>
        </div>
        <Link
          to="/budget"
          className="inline-flex items-center gap-2 rounded-full border border-transparent bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          Info Lengkap
          <ArrowRight className="h-4 w-4" />
        </Link>
      </header>

      <div className="mt-6 space-y-4">
        {loading ? (
          <>
            <BudgetSkeleton />
            <BudgetSkeleton />
            <BudgetSkeleton />
          </>
        ) : error ? (
          <div className="flex items-center gap-3 rounded-2xl border border-rose-200/80 bg-rose-50/70 p-4 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        ) : highlights.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-white/60 p-6 text-sm text-muted-foreground shadow-sm dark:border-border/40 dark:bg-white/5">
            Belum ada anggaran yang mendekati batas. Tetap lanjutkan kebiasaan baikmu!
          </div>
        ) : (
          highlights.map((item, index) => {
            const clamped = Math.min(item.progress, 1)
            const width = `${Math.max(clamped * 100, 0)}%`
            const over = item.progress > 1
            const percentLabel = formatPercent(item.progress)
            return (
              <article
                key={item.id}
                className="relative overflow-hidden rounded-2xl border border-border/60 bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-border/40 dark:bg-zinc-900/70"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{index + 1}. {item.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatCurrency(item.spent, "IDR")} dari {formatCurrency(item.planned, "IDR")} terpakai
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                      over
                        ? "bg-rose-500/15 text-rose-600 dark:text-rose-300"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {percentLabel}
                  </span>
                </div>
                <div className="relative mt-4 h-3 w-full overflow-hidden rounded-full bg-muted/50">
                  <div
                    className="relative h-full rounded-full bg-gradient-to-r from-sky-400 via-primary to-indigo-500"
                    style={{ width }}
                  >
                    {item.progress > 0 ? (
                      <>
                        <span className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 translate-x-1/2 rounded-full bg-white shadow-[0_0_12px_rgba(59,130,246,0.45)] dark:bg-zinc-950" />
                        <span className="pointer-events-none absolute right-0 top-1/2 h-10 w-10 -translate-y-1/2 translate-x-1/2 rounded-full bg-primary/25 blur" />
                      </>
                    ) : null}
                  </div>
                  {over ? (
                    <span className="absolute inset-y-0 right-0 flex items-center rounded-full bg-rose-500/15 px-3 text-[10px] font-semibold uppercase tracking-wide text-rose-600 dark:bg-rose-500/20 dark:text-rose-200">
                      +{Math.round((item.progress - 1) * 100)}%
                    </span>
                  ) : null}
                </div>
              </article>
            )
          })
        )}
      </div>
    </section>
  )
}
