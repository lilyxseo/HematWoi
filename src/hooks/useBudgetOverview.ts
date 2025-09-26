import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { getCurrentUserId } from '../lib/session.js'

interface BudgetOverviewSummary {
  totalPlanned: number
  totalRollover: number
  totalAvailable: number
  totalActual: number
  remaining: number
  usagePercent: number
  period: string
}

export interface BudgetCategoryUsage {
  id: string
  name: string
  planned: number
  actual: number
  remaining: number
  usagePercent: number
}

interface UseBudgetOverviewResult {
  summary: BudgetOverviewSummary
  categories: BudgetCategoryUsage[]
  loading: boolean
  error: string | null
  hasBudgets: boolean
  refresh: () => Promise<void>
}

const EMPTY_SUMMARY: BudgetOverviewSummary = {
  totalPlanned: 0,
  totalRollover: 0,
  totalAvailable: 0,
  totalActual: 0,
  remaining: 0,
  usagePercent: 0,
  period: currentPeriodIso(),
}

function currentPeriodIso(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = (today.getMonth() + 1).toString().padStart(2, '0')
  return `${year}-${month}-01`
}

function normalizePeriod(period?: string): string {
  if (!period || period.trim() === '') return currentPeriodIso()
  const trimmed = period.trim()
  if (trimmed.length === 7) {
    return `${trimmed}-01`
  }
  if (trimmed.length >= 10) {
    return trimmed.slice(0, 10)
  }
  return currentPeriodIso()
}

function parseNumber(value: unknown): number {
  if (value == null) return 0
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

const ACTUAL_FIELD_CANDIDATES = [
  'actual',
  'spent',
  'amount',
  'realized',
  'realised',
  'realisasi',
  'total_spent',
  'total',
  'value',
]

async function fetchActualsMap(userId: string, periodIso: string): Promise<Record<string, number>> {
  const extractActual = (row: Record<string, any>): number => {
    for (const key of ACTUAL_FIELD_CANDIDATES) {
      if (key in row) {
        const parsed = parseNumber(row[key])
        if (row[key] != null || parsed !== 0) {
          return parsed
        }
      }
    }
    return 0
  }

  const map: Record<string, number> = {}

  try {
    const { data, error } = await supabase
      .from('budget_actuals_v')
      .select('*')
      .eq('user_id', userId)
      .eq('period_month', periodIso)

    if (error) throw error

    for (const row of data ?? []) {
      const categoryId = (row as any)?.category_id ?? null
      const budgetId = (row as any)?.budget_id ?? null
      const key = categoryId ?? budgetId
      if (!key) continue
      map[key as string] = extractActual(row as Record<string, any>)
    }
    return map
  } catch (error) {
    const message = (error as Error)?.message ?? ''
    const missingView = message.toLowerCase().includes('budget_actuals_v') || message.includes('42P01')
    if (!missingView) {
      throw error
    }
    // Fallback to legacy budget_activity view when budget_actuals_v is unavailable
    const { data, error: activityError } = await supabase
      .from('budget_activity')
      .select('*')
      .eq('period_month', periodIso)

    if (activityError) throw activityError

    for (const row of data ?? []) {
      const categoryId = (row as any)?.category_id
      if (!categoryId) continue
      map[categoryId as string] = extractActual(row as Record<string, any>)
    }
    return map
  }
}

interface HookOptions {
  period?: string
}

export function useBudgetOverview(options?: HookOptions): UseBudgetOverviewResult {
  const periodIso = useMemo(() => normalizePeriod(options?.period), [options?.period])
  const [summary, setSummary] = useState<BudgetOverviewSummary>(EMPTY_SUMMARY)
  const [categories, setCategories] = useState<BudgetCategoryUsage[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [hasBudgets, setHasBudgets] = useState<boolean>(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const userId = await getCurrentUserId()
      if (!userId) {
        throw new Error('Kamu perlu login untuk melihat anggaran')
      }

      const [{ data: budgetRows, error: budgetError }, actuals] = await Promise.all([
        supabase
          .from('budgets')
          .select('id, planned, rollover_in, category_id, name, period_month, category:categories(id, name)')
          .eq('user_id', userId)
          .eq('period_month', periodIso),
        fetchActualsMap(userId, periodIso),
      ])

      if (budgetError) throw budgetError

      const mappedBudgets = (budgetRows ?? []).map((row: any) => {
        const planned = parseNumber(row.planned)
        const rolloverIn = parseNumber(row.rollover_in)
        const categoryId = row.category_id ?? null
        const key: string = categoryId ?? (row.id as string)
        const name: string = row.category?.name ?? row.name ?? 'Tanpa Kategori'
        const categoryActualKey = categoryId ? String(categoryId) : null
        const actualSource = actuals[key] ?? (categoryActualKey ? actuals[categoryActualKey] : undefined)
        const actual = parseNumber(actualSource)
        const available = planned + rolloverIn
        const remaining = available - actual
        const usagePercent = available > 0 ? (actual / available) * 100 : 0

        return {
          id: row.id as string,
          key,
          name,
          planned,
          rolloverIn,
          available,
          actual,
          remaining,
          usagePercent,
        }
      })

      const totalPlanned = mappedBudgets.reduce((sum, item) => sum + item.planned, 0)
      const totalRollover = mappedBudgets.reduce((sum, item) => sum + item.rolloverIn, 0)
      const totalActual = mappedBudgets.reduce((sum, item) => sum + item.actual, 0)
      const totalAvailable = totalPlanned + totalRollover
      const remaining = totalAvailable - totalActual
      const usagePercent = totalAvailable > 0 ? (totalActual / totalAvailable) * 100 : 0

      const breakdown = mappedBudgets
        .map((item) => ({
          id: item.key,
          name: item.name,
          planned: item.available,
          actual: item.actual,
          remaining: item.remaining,
          usagePercent: item.usagePercent,
        }))
        .sort((a, b) => b.actual - a.actual)

      setSummary({
        totalPlanned,
        totalRollover,
        totalAvailable,
        totalActual,
        remaining,
        usagePercent,
        period: periodIso,
      })
      setCategories(breakdown)
      setHasBudgets(mappedBudgets.length > 0)
    } catch (err: unknown) {
      setSummary({ ...EMPTY_SUMMARY, period: periodIso })
      setCategories([])
      setHasBudgets(false)
      setError(err instanceof Error ? err.message : 'Gagal memuat anggaran')
    } finally {
      setLoading(false)
    }
  }, [periodIso])

  useEffect(() => {
    load().catch(() => {
      /* handled in state */
    })
  }, [load])

  const refresh = useCallback(async () => {
    await load()
  }, [load])

  return {
    summary,
    categories,
    loading,
    error,
    hasBudgets,
    refresh,
  }
}

export default useBudgetOverview
