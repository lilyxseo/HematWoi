import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatIDR } from '../lib/format'
import { firstDayOfThisMonthISO } from '../lib/date'
import { calculateBudgetUsage, normalizeNumeric } from './budgetProgressUtils'

type BudgetRow = {
  planned: number | string | null
  rollover_in: number | string | null
  current_spent: number | string | null
}

type BudgetProgressSnapshot = {
  effectiveBudget: number
  totalSpent: number
  remaining: number
  usedPct: number
  hasBudget: boolean
}

type FetchState = 'idle' | 'loading' | 'success' | 'error'

const DEFAULT_SNAPSHOT: BudgetProgressSnapshot = {
  effectiveBudget: 0,
  totalSpent: 0,
  remaining: 0,
  usedPct: 0,
  hasBudget: false,
}

const tooltipLabelClass = 'text-xs font-medium text-slate-400'
const tooltipValueClass = 'text-sm font-semibold text-slate-700'

function BudgetProgressWidget() {
  const [snapshot, setSnapshot] = useState<BudgetProgressSnapshot>(DEFAULT_SNAPSHOT)
  const [fetchState, setFetchState] = useState<FetchState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isTooltipVisible, setIsTooltipVisible] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsMounted(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    let isSubscribed = true

    async function loadBudget() {
      setFetchState('loading')
      setErrorMessage(null)

      const { data, error } = await supabase
        .from('budgets')
        .select('planned, rollover_in, current_spent')
        .eq('period_month', firstDayOfThisMonthISO())

      if (!isSubscribed) return

      if (error) {
        console.error('Failed to fetch budget progress', error)
        setFetchState('error')
        setErrorMessage('Gagal memuat')
        setSnapshot(DEFAULT_SNAPSHOT)
        return
      }

      const rows: BudgetRow[] = data ?? []

      const effectiveBudget = rows.reduce((acc, row) => {
        return acc + normalizeNumeric(row.planned) + normalizeNumeric(row.rollover_in)
      }, 0)

      const totalSpent = rows.reduce((acc, row) => acc + normalizeNumeric(row.current_spent), 0)

      const { usedPct, remaining } = calculateBudgetUsage(effectiveBudget, totalSpent)

      setSnapshot({
        effectiveBudget,
        totalSpent,
        remaining,
        usedPct,
        hasBudget: rows.length > 0 && effectiveBudget > 0,
      })
      setFetchState('success')
    }

    loadBudget()

    return () => {
      isSubscribed = false
    }
  }, [])

  const displaySnapshot = snapshot ?? DEFAULT_SNAPSHOT

  const progressColor = useMemo(() => {
    if (displaySnapshot.usedPct >= 90) return '#ef4444'
    if (displaySnapshot.usedPct >= 70) return '#f59e0b'
    return '#3898f8'
  }, [displaySnapshot.usedPct])

  const progressAngle = (displaySnapshot.usedPct / 100) * 360

  const donutBackground = useMemo(
    () =>
      `conic-gradient(${progressColor} ${progressAngle}deg, #e2e8f0 ${progressAngle}deg 360deg)`,
    [progressAngle, progressColor]
  )

  const percentLabel = Math.round(displaySnapshot.usedPct)

  const contentClass = `flex flex-col items-center gap-6 transition-all duration-200 ease-out ${
    isMounted ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
  }`

  if (fetchState === 'loading') {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-6">
          <p className="text-sm font-medium text-slate-500">Progress Anggaran</p>
          <div className="flex flex-col items-center gap-4">
            <div className="h-40 w-40 rounded-full bg-slate-200/70" />
            <div className="flex w-full flex-wrap justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="h-3 w-20 rounded-full bg-slate-200/70" />
                <div className="h-4 w-24 rounded-full bg-slate-200/70" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="h-3 w-20 rounded-full bg-slate-200/70" />
                <div className="h-4 w-24 rounded-full bg-slate-200/70" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="h-3 w-20 rounded-full bg-slate-200/70" />
                <div className="h-4 w-24 rounded-full bg-slate-200/70" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (fetchState === 'error') {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-500">Progress Anggaran</p>
          <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
            {errorMessage ?? 'Gagal memuat'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className={contentClass}>
        <p className="self-start text-sm font-medium text-slate-500">Progress Anggaran</p>
        <div
          className="relative flex h-40 w-40 items-center justify-center"
          role="img"
          aria-label={`Progress anggaran ${percentLabel} persen`}
          onMouseEnter={() => setIsTooltipVisible(true)}
          onMouseLeave={() => setIsTooltipVisible(false)}
          onFocus={() => setIsTooltipVisible(true)}
          onBlur={() => setIsTooltipVisible(false)}
          tabIndex={0}
        >
          <div
            className="h-full w-full rounded-full transition-[background] duration-[600ms] ease-in-out"
            style={{ background: donutBackground }}
          />
          <div className="absolute inset-5 rounded-full bg-white" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-semibold text-slate-800">{percentLabel}%</span>
          </div>

          {isTooltipVisible && (
            <div className="absolute -bottom-24 z-10 w-48 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-lg">
              <div className="flex flex-col gap-2">
                <div>
                  <p className={tooltipLabelClass}>Budget</p>
                  <p className={tooltipValueClass}>{formatIDR(displaySnapshot.effectiveBudget)}</p>
                </div>
                <div>
                  <p className={tooltipLabelClass}>Spent</p>
                  <p className={tooltipValueClass}>{formatIDR(displaySnapshot.totalSpent)}</p>
                </div>
                <div>
                  <p className={tooltipLabelClass}>Sisa</p>
                  <p className={tooltipValueClass}>{formatIDR(displaySnapshot.remaining)}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {!displaySnapshot.hasBudget && (
          <p className="text-sm font-medium text-slate-500">Belum ada anggaran bulan ini</p>
        )}

        <div className="flex w-full flex-wrap justify-between gap-4 text-left">
          <div className="flex min-w-[120px] flex-1 flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-400">Budget</span>
            <span className="text-sm font-semibold text-slate-800">
              {formatIDR(displaySnapshot.effectiveBudget)}
            </span>
          </div>
          <div className="flex min-w-[120px] flex-1 flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-400">Spent</span>
            <span className="text-sm font-semibold text-slate-800">
              {formatIDR(displaySnapshot.totalSpent)}
            </span>
          </div>
          <div className="flex min-w-[120px] flex-1 flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-400">Sisa</span>
            <span className="text-sm font-semibold text-slate-800">
              {formatIDR(displaySnapshot.remaining)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BudgetProgressWidget
