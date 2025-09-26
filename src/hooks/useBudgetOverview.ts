import { useCallback, useEffect, useMemo, useState } from "react"
import type { PostgrestError } from "@supabase/supabase-js"
import { supabase } from "../lib/supabase.js"

export interface BudgetCategoryOverview {
  id: string
  label: string
  planned: number
  actual: number
  remaining: number
  utilization: number
}

export interface BudgetOverviewSummary {
  totalPlanned: number
  totalActual: number
  remaining: number
  utilization: number
}

export interface BudgetOverviewState {
  summary: BudgetOverviewSummary
  categories: BudgetCategoryOverview[]
  loading: boolean
  error: string | null
  empty: boolean
  period: string
  refresh: () => Promise<void>
}

const INITIAL_SUMMARY: BudgetOverviewSummary = {
  totalPlanned: 0,
  totalActual: 0,
  remaining: 0,
  utilization: 0,
}

type BudgetRecord = {
  id: string
  category_id?: string | null
  category_key?: string | null
  name?: string | null
  label?: string | null
  planned?: number | string | null
  amount_planned?: number | string | null
  rollover_in?: number | string | null
  current_spent?: number | string | null
  actual?: number | string | null
  spent?: number | string | null
  category?: { name?: string | null } | null
}

type BudgetActualRecord = {
  category_id?: string | null
  category_key?: string | null
  actual?: number | string | null
  spent?: number | string | null
  total_spent?: number | string | null
  current_spent?: number | string | null
  amount?: number | string | null
  period_month?: string | null
}

interface LoadResult {
  summary: BudgetOverviewSummary
  categories: BudgetCategoryOverview[]
  empty: boolean
}

function toMonthStart(period: string): string {
  const safe = period?.trim()
  if (!safe) return ""
  const [yearStr, monthStr] = safe.split("-")
  const year = Number.parseInt(yearStr ?? "", 10)
  const month = Number.parseInt(monthStr ?? "", 10)
  if (!Number.isFinite(year) || !Number.isFinite(month)) return ""
  const normalizedMonth = Math.min(Math.max(month, 1), 12)
  return `${year.toString().padStart(4, "0")}-${normalizedMonth
    .toString()
    .padStart(2, "0")}-01`
}

function getCurrentPeriod(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}`
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function clamp(value: number, min = 0, max = 1): number {
  if (!Number.isFinite(value)) return min
  if (value < min) return min
  if (value > max) return max
  return value
}

function extractLabel(record: BudgetRecord): string {
  const categoryName = record.category?.name
  if (typeof categoryName === "string" && categoryName.trim()) {
    return categoryName.trim()
  }
  const providedLabel = record.label ?? record.name
  if (typeof providedLabel === "string" && providedLabel.trim()) {
    return providedLabel.trim()
  }
  return "Tanpa kategori"
}

function deriveOverview(
  budgets: BudgetRecord[],
  actuals: BudgetActualRecord[]
): LoadResult {
  const actualByKey = new Map<string, number>()
  const actualByCategory = new Map<string, number>()

  for (const row of actuals) {
    const actualValue = toNumber(
      row.actual ?? row.total_spent ?? row.spent ?? row.current_spent ?? row.amount
    )
    if (!actualValue) continue
    const categoryKey = typeof row.category_key === "string" ? row.category_key : null
    const categoryId = typeof row.category_id === "string" ? row.category_id : null
    if (categoryKey) {
      actualByKey.set(categoryKey, (actualByKey.get(categoryKey) ?? 0) + actualValue)
    }
    if (categoryId) {
      actualByCategory.set(categoryId, (actualByCategory.get(categoryId) ?? 0) + actualValue)
    }
  }

  const categories: BudgetCategoryOverview[] = budgets.map((budget) => {
    const categoryId = typeof budget.category_id === "string" ? budget.category_id : null
    const categoryKey = typeof budget.category_key === "string" ? budget.category_key : null
    const plannedBase =
      toNumber(budget.amount_planned ?? budget.planned) + toNumber(budget.rollover_in)
    const actualFallback = toNumber(
      budget.current_spent ?? budget.actual ?? budget.spent ?? 0
    )
    const actual = categoryKey && actualByKey.has(categoryKey)
      ? actualByKey.get(categoryKey) ?? 0
      : categoryId && actualByCategory.has(categoryId)
        ? actualByCategory.get(categoryId) ?? 0
        : actualFallback
    const remaining = plannedBase - actual
    const utilization = plannedBase > 0 ? actual / plannedBase : 0
    return {
      id: budget.id,
      label: extractLabel(budget),
      planned: plannedBase,
      actual,
      remaining,
      utilization: clamp(utilization, 0, 2),
    }
  })

  const totalPlanned = categories.reduce((acc, item) => acc + item.planned, 0)
  const totalActual = categories.reduce((acc, item) => acc + item.actual, 0)
  const remaining = totalPlanned - totalActual
  const utilization = totalPlanned > 0 ? totalActual / totalPlanned : 0

  return {
    summary: {
      totalPlanned,
      totalActual,
      remaining,
      utilization: clamp(utilization, 0, 2),
    },
    categories,
    empty: budgets.length === 0,
  }
}

function mapError(error: PostgrestError | Error): string {
  if (error instanceof Error) return error.message
  return error?.message ?? "Terjadi kesalahan saat memuat anggaran"
}

function isMissingRelation(error: PostgrestError | null, relation: string): boolean {
  if (!error) return false
  const haystack = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase()
  return haystack.includes("does not exist") && haystack.includes(relation.toLowerCase())
}

export function useBudgetOverview(period?: string): BudgetOverviewState {
  const resolvedPeriod = useMemo(() => period ?? getCurrentPeriod(), [period])
  const [summary, setSummary] = useState<BudgetOverviewSummary>(INITIAL_SUMMARY)
  const [categories, setCategories] = useState<BudgetCategoryOverview[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [empty, setEmpty] = useState<boolean>(false)

  const load = useCallback(async () => {
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError) {
      throw authError
    }
    const userId = authData.user?.id
    if (!userId) {
      return { summary: INITIAL_SUMMARY, categories: [], empty: true }
    }

    const monthStart = toMonthStart(resolvedPeriod)
    if (!monthStart) {
      return { summary: INITIAL_SUMMARY, categories: [], empty: true }
    }

    const budgetsQuery = supabase
      .from("budgets")
      .select(
        "id,category_id,category_key,name,label,planned,amount_planned,rollover_in,current_spent,actual,spent,category:categories(name)"
      )
      .eq("user_id", userId)
      .eq("period_month", monthStart)

    const actualsQuery = supabase
      .from("budget_actuals_v")
      .select("category_id,category_key,actual,spent,total_spent,current_spent,amount,period_month")
      .eq("user_id", userId)
      .eq("period_month", monthStart)

    const [budgetsResponse, actualsResponse] = await Promise.all([budgetsQuery, actualsQuery])

    if (budgetsResponse.error) {
      throw budgetsResponse.error
    }
    const actualsError = actualsResponse.error
    if (actualsError && !isMissingRelation(actualsError, "budget_actuals_v")) {
      throw actualsError
    }

    const budgets = (budgetsResponse.data ?? []) as BudgetRecord[]
    const actuals = (actualsResponse.data ?? []) as BudgetActualRecord[]
    return deriveOverview(budgets, actuals)
  }, [resolvedPeriod])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    load()
      .then((result) => {
        if (!active) return
        setSummary(result.summary)
        setCategories(result.categories)
        setEmpty(result.empty)
      })
      .catch((err: unknown) => {
        if (!active) return
        setSummary(INITIAL_SUMMARY)
        setCategories([])
        setEmpty(true)
        setError(mapError(err as PostgrestError | Error))
      })
      .finally(() => {
        if (!active) return
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [load])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await load()
      setSummary(result.summary)
      setCategories(result.categories)
      setEmpty(result.empty)
    } catch (err) {
      setSummary(INITIAL_SUMMARY)
      setCategories([])
      setEmpty(true)
      setError(mapError(err as PostgrestError | Error))
      throw err
    } finally {
      setLoading(false)
    }
  }, [load])

  return {
    summary,
    categories,
    loading,
    error,
    empty,
    period: resolvedPeriod,
    refresh,
  }
}

export { getCurrentPeriod as getBudgetCurrentPeriod }
