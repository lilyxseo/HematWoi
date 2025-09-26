import { useMemo } from "react"
import { formatCurrency } from "../../lib/format.js"
import type { PeriodRange } from "./PeriodPicker"

type Nullable<T> = T | null | undefined

type BudgetLike = {
  id?: string
  category_id?: string
  category?: Nullable<string>
  category_key?: Nullable<string>
  name?: Nullable<string>
  label?: Nullable<string>
  month?: Nullable<string>
  period?: Nullable<string>
  period_month?: Nullable<string>
  planned?: Nullable<number | string>
  amount_planned?: Nullable<number | string>
  amount?: Nullable<number | string>
  current_spent?: Nullable<number | string>
  spent?: Nullable<number | string>
  actual?: Nullable<number | string>
  rollover_in?: Nullable<number | string>
  carryover_enabled?: Nullable<boolean | string>
}

type TransactionLike = {
  id?: string
  date?: Nullable<string>
  type?: Nullable<string>
  amount?: Nullable<number | string>
  category?: Nullable<string>
  category_id?: Nullable<string>
  category_name?: Nullable<string>
  categoryLabel?: Nullable<string>
}

interface BudgetOverviewProps {
  budgets?: BudgetLike[]
  transactions?: TransactionLike[]
  period: PeriodRange
}

interface NormalizedBudgetRow {
  id: string
  name: string
  planned: number
  spent: number
  remaining: number
  progress: number
  carryover: boolean
}

function toNumber(value: Nullable<number | string>): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function resolveMonth(budget: BudgetLike): string | null {
  const raw =
    budget.period_month ?? budget.month ?? budget.period ?? null
  if (!raw) return null
  const stringified = String(raw)
  return stringified.length >= 7 ? stringified.slice(0, 7) : null
}

function normalizeKey(value: Nullable<string>): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed.toLowerCase() : null
}

function resolveSpent(
  budget: BudgetLike,
  expenseById: Map<string, number>,
  expenseByName: Map<string, number>
): number {
  const direct = toNumber(
    budget.current_spent ??
      budget.spent ??
      budget.actual ??
      null
  )
  if (direct > 0) return direct

  if (budget.category_id) {
    const fromId = expenseById.get(budget.category_id)
    if (typeof fromId === "number") {
      return fromId
    }
  }

  const candidates = [
    normalizeKey(budget.category_key),
    normalizeKey(budget.category),
    normalizeKey(budget.name),
    normalizeKey(budget.label),
  ].filter((key): key is string => Boolean(key))

  for (const key of candidates) {
    const fromName = expenseByName.get(key)
    if (typeof fromName === "number") {
      return fromName
    }
  }

  return 0
}

function useNormalizedBudgets(
  budgets: BudgetLike[] | undefined,
  transactions: TransactionLike[] | undefined,
  activeMonth: string | null
): NormalizedBudgetRow[] {
  return useMemo(() => {
    if (!budgets?.length || !activeMonth) return []

    const expenseById = new Map<string, number>()
    const expenseByName = new Map<string, number>()

    for (const tx of transactions ?? []) {
      if (!tx || tx.type !== "expense") continue
      const month = tx.date ? String(tx.date).slice(0, 7) : null
      if (month !== activeMonth) continue
      const amount = toNumber(tx.amount)
      if (amount <= 0) continue
      const categoryId = tx.category_id ? String(tx.category_id) : null
      if (categoryId) {
        expenseById.set(categoryId, (expenseById.get(categoryId) ?? 0) + amount)
      }
      const categoryName =
        normalizeKey(tx.category) ??
        normalizeKey(tx.category_name) ??
        normalizeKey(tx.categoryLabel)
      if (categoryName) {
        expenseByName.set(
          categoryName,
          (expenseByName.get(categoryName) ?? 0) + amount
        )
      }
    }

    const rows: NormalizedBudgetRow[] = []

    budgets.forEach((budget, index) => {
      if (!budget) return
      const month = resolveMonth(budget)
      if (month && month !== activeMonth) return

      const planned = toNumber(
        budget.planned ?? budget.amount_planned ?? budget.amount ?? null
      )
      const spent = resolveSpent(budget, expenseById, expenseByName)
      const remaining = planned - spent
      const progress = planned > 0 ? spent / planned : spent > 0 ? 1 : 0
      const carryoverFlag = (() => {
        const value = budget.carryover_enabled
        if (typeof value === "string") {
          const normalized = value.trim().toLowerCase()
          return ["true", "1", "t", "yes", "y"].includes(normalized)
        }
        return Boolean(value)
      })()

      const name =
        (typeof budget.label === "string" && budget.label.trim()) ? budget.label.trim() :
        (typeof budget.name === "string" && budget.name.trim()) ? budget.name.trim() :
        (typeof budget.category === "string" && budget.category.trim())
          ? budget.category.trim()
          : "Tanpa kategori"

      if (planned <= 0 && spent <= 0) return

      rows.push({
        id:
          (typeof budget.id === "string" && budget.id) ||
          (typeof budget.category_id === "string" && budget.category_id) ||
          `budget-${index}`,
        name,
        planned,
        spent,
        remaining,
        progress,
        carryover: carryoverFlag,
      })
    })

    rows.sort((a, b) => {
      if (b.progress !== a.progress) return b.progress - a.progress
      return a.name.localeCompare(b.name)
    })

    return rows
  }, [budgets, transactions, activeMonth])
}

function SummaryCard({
  label,
  value,
  tone = "default",
  description,
}: {
  label: string
  value: string
  tone?: "default" | "positive" | "negative"
  description?: string
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "text-rose-600 dark:text-rose-400"
        : "text-foreground"

  return (
    <div className="rounded-xl border border-border/60 bg-background/50 p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`mt-2 text-xl font-semibold tabular-nums ${toneClass}`}>
        {value}
      </p>
      {description ? (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
  )
}

function BudgetRow({ row }: { row: NormalizedBudgetRow }) {
  const clamped = Math.min(100, Math.max(0, row.progress * 100))
  const barTone = row.progress >= 1 ? "bg-rose-500" : "bg-primary"
  const statusLabel = row.remaining < 0 ? "Kelebihan" : "Sisa"
  const statusValue = formatCurrency(Math.abs(row.remaining), "IDR")

  return (
    <li className="rounded-xl border border-border/60 bg-background/40 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{row.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Rencana {formatCurrency(row.planned, "IDR")} · Realisasi {formatCurrency(row.spent, "IDR")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {row.carryover ? (
            <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:border-emerald-400/30 dark:text-emerald-300">
              Rollover
            </span>
          ) : null}
          <span
            className={`text-xs font-semibold ${row.progress >= 1 ? "text-rose-500 dark:text-rose-300" : "text-muted-foreground"}`}
          >
            {Math.round(row.progress * 100)}%
          </span>
        </div>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-border/50">
        <div
          className={`h-full rounded-full ${barTone}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {statusLabel} {statusValue}
        </span>
        {row.remaining < 0 ? (
          <span className="font-semibold text-rose-600 dark:text-rose-400">
            {formatCurrency(row.remaining, "IDR")}
          </span>
        ) : null}
      </div>
    </li>
  )
}

export default function BudgetOverview({
  budgets,
  transactions,
  period,
}: BudgetOverviewProps) {
  const activeMonth = useMemo(() => {
    if (!period?.start) return null
    return period.start.slice(0, 7)
  }, [period])

  const rows = useNormalizedBudgets(budgets, transactions, activeMonth)

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.planned += row.planned
        acc.spent += row.spent
        return acc
      },
      { planned: 0, spent: 0 }
    )
  }, [rows])

  const remaining = totals.planned - totals.spent
  const utilization = totals.planned > 0 ? totals.spent / totals.planned : 0
  const highlight = rows.slice(0, 4)

  return (
    <section className="rounded-2xl border border-border/60 bg-card/60 p-5 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Anggaran Bulan Ini</h2>
          <p className="text-sm text-muted-foreground">
            Ringkasan rencana dan realisasi pengeluaran berdasarkan kategori.
          </p>
        </div>
        <span className="inline-flex items-center rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs font-semibold text-muted-foreground">
          {rows.length} kategori
        </span>
      </div>

      {!rows.length ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Belum ada data anggaran untuk periode ini. Tambahkan anggaran agar progres mudah dipantau.
        </p>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <SummaryCard
              label="Total Anggaran"
              value={formatCurrency(totals.planned, "IDR")}
              description="Jumlah dana yang dialokasikan bulan ini"
            />
            <SummaryCard
              label="Realisasi Pengeluaran"
              value={formatCurrency(totals.spent, "IDR")}
              tone="negative"
              description="Total pengeluaran pada periode yang sama"
            />
            <SummaryCard
              label={remaining >= 0 ? "Sisa Anggaran" : "Anggaran Terlampaui"}
              value={formatCurrency(Math.abs(remaining), "IDR")}
              tone={remaining >= 0 ? "positive" : "negative"}
              description={
                remaining >= 0
                  ? "Dana yang masih tersedia"
                  : "Jumlah yang melebihi rencana"
              }
            />
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Utilisasi anggaran</span>
              <span className={utilization >= 1 ? "font-semibold text-rose-600 dark:text-rose-400" : "font-semibold"}>
                {Math.round(utilization * 100)}%
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-border/50">
              <div
                className={`h-full rounded-full ${utilization >= 1 ? "bg-rose-500" : "bg-primary"}`}
                style={{ width: `${Math.min(100, Math.max(0, utilization * 100))}%` }}
              />
            </div>
          </div>

          <ul className="mt-6 space-y-3">
            {highlight.map((row) => (
              <BudgetRow key={row.id} row={row} />
            ))}
          </ul>

          {rows.length > highlight.length ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Menampilkan {highlight.length} anggaran teratas berdasarkan progres.
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}
