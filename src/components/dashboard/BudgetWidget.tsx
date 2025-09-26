import { useMemo } from "react"
import { formatCurrency } from "../../lib/format.js"

interface BudgetWidgetProps {
  budgets?: BudgetLike[]
}

interface BudgetLike {
  id?: string
  name?: string | null
  label?: string | null
  category_key?: string | null
  amount_planned?: number | null
  planned?: number | null
  current_spent?: number | null
  period_month?: string | Date | null
  month?: string | Date | null
}

interface NormalizedBudgetItem {
  id: string
  title: string
  planned: number
  spent: number
  remaining: number
  usagePct: number
}

function getMonthLabel(value: string | Date | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString("id-ID", { month: "long", year: "numeric" })
}

function normalizeBudgets(budgets: BudgetLike[]): NormalizedBudgetItem[] {
  return budgets
    .map((item, index) => {
      const planned = Number(item.amount_planned ?? item.planned ?? 0) || 0
      const spent = Number(item.current_spent ?? 0) || 0
      const remaining = planned - spent
      const usagePct = planned > 0 ? Math.min(999, Math.round((spent / planned) * 100)) : spent > 0 ? 100 : 0
      return {
        id: item.id ?? item.category_key ?? String(index),
        title: item.label ?? item.name ?? item.category_key ?? "Kategori tanpa nama",
        planned,
        spent,
        remaining,
        usagePct,
      }
    })
    .filter((item) => item.planned > 0 || item.spent > 0)
}

export default function BudgetWidget({ budgets = [] }: BudgetWidgetProps) {
  const normalized = useMemo(() => normalizeBudgets(budgets), [budgets])

  const totals = useMemo(() => {
    return normalized.reduce(
      (acc, item) => {
        acc.planned += item.planned
        acc.spent += item.spent
        acc.remaining += item.remaining
        return acc
      },
      { planned: 0, spent: 0, remaining: 0 }
    )
  }, [normalized])

  const usagePct = totals.planned > 0 ? Math.min(999, Math.round((totals.spent / totals.planned) * 100)) : 0

  const topCategories = useMemo(() => {
    return [...normalized]
      .sort((a, b) => b.usagePct - a.usagePct || b.spent - a.spent)
      .slice(0, 4)
  }, [normalized])

  const monthLabel = useMemo(() => {
    const source = budgets[0]?.period_month ?? budgets[0]?.month ?? null
    return getMonthLabel(source)
  }, [budgets])

  return (
    <section className="rounded-3xl border border-border-subtle bg-gradient-to-br from-white via-white to-white/80 p-6 shadow-sm dark:from-slate-900/70 dark:via-slate-900/60 dark:to-slate-900/30">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl">Anggaran</h2>
          <p className="text-sm text-muted-foreground">Pantau progres penggunaan anggaranmu secara ringkas.</p>
        </div>
        {monthLabel ? (
          <span className="inline-flex items-center rounded-full bg-primary/10 px-4 py-1 text-xs font-medium text-primary">
            {monthLabel}
          </span>
        ) : null}
      </div>

      {normalized.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border-subtle bg-surface p-6 text-center text-sm text-muted-foreground">
          Belum ada data anggaran untuk ditampilkan.
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-surface-alt p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dialokasikan</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {formatCurrency(Math.max(totals.planned, 0), "IDR")}
              </p>
            </div>
            <div className="rounded-2xl bg-surface-alt p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Terpakai</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(Math.max(totals.spent, 0), "IDR")}
              </p>
            </div>
            <div className="rounded-2xl bg-surface-alt p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sisa</p>
              <p className="mt-2 text-2xl font-semibold text-amber-600 dark:text-amber-400">
                {formatCurrency(Math.max(totals.remaining, 0), "IDR")}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-border-subtle bg-surface-alt p-4">
            <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
              <span>Total anggaran terpakai</span>
              <span>{usagePct}%</span>
            </div>
            <div className="mt-3 h-2.5 rounded-full bg-muted/40">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${Math.min(usagePct, 100)}%` }}
              />
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {topCategories.map((item) => {
              const remaining = Math.max(item.remaining, 0)
              return (
                <article
                  key={item.id}
                  className="group rounded-2xl border border-transparent bg-white/60 p-4 shadow-sm transition hover:border-primary/20 hover:shadow-md dark:bg-slate-900/60"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(item.spent, "IDR")} dari {formatCurrency(item.planned, "IDR")}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-primary">{Math.min(item.usagePct, 999)}%</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-muted/40">
                    <div
                      className="h-full rounded-full bg-primary/80 transition-[width] duration-500"
                      style={{ width: `${Math.min(item.usagePct, 100)}%` }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Sisa {formatCurrency(remaining, "IDR")}</span>
                    <span>Terpakai {formatCurrency(item.spent, "IDR")}</span>
                  </div>
                </article>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}
