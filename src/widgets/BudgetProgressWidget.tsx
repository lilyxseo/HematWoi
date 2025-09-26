import { useEffect, useMemo, useState } from 'react'
import { firstDayOfThisMonthISO } from '../lib/date'
import { formatIDR } from '../lib/format'
import { supabase } from '../lib/supabase'

type BudgetRow = {
  planned: number | null
  rollover_in: number | null
  current_spent: number | null
}

export type BudgetProgressSummary = {
  effectiveBudget: number
  totalSpent: number
  remaining: number
  usedPct: number
  hasBudget: boolean
}

type WidgetState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; summary: BudgetProgressSummary }

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function aggregateBudgetProgress(rows: BudgetRow[]): BudgetProgressSummary {
  const totals = rows.reduce(
    (acc, row) => {
      const planned = row.planned ?? 0
      const rollover = row.rollover_in ?? 0
      const spent = row.current_spent ?? 0

      acc.effectiveBudget += planned + rollover
      acc.totalSpent += spent
      return acc
    },
    { effectiveBudget: 0, totalSpent: 0 }
  )

  const remaining = Math.max(totals.effectiveBudget - totals.totalSpent, 0)
  const usedPct = totals.effectiveBudget > 0
    ? clamp((totals.totalSpent / totals.effectiveBudget) * 100, 0, 100)
    : 0

  return {
    effectiveBudget: totals.effectiveBudget,
    totalSpent: totals.totalSpent,
    remaining,
    usedPct,
    hasBudget: totals.effectiveBudget > 0,
  }
}

function progressColor(pct: number): string {
  if (pct < 70) return '#3898f8'
  if (pct < 90) return '#fbbf24'
  return '#ef4444'
}

export function BudgetProgressWidget(): JSX.Element {
  const [state, setState] = useState<WidgetState>({ status: 'loading' })
  const [displayPct, setDisplayPct] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  const monthStart = useMemo(() => firstDayOfThisMonthISO(), [])

  useEffect(() => {
    let subscribed = true

    async function load() {
      setState({ status: 'loading' })
      const { data, error } = await supabase
        .from('budgets')
        .select('planned, rollover_in, current_spent')
        .eq('period_month', monthStart)

      if (!subscribed) return

      if (error) {
        setState({ status: 'error', message: error.message })
        return
      }

      const rows = Array.isArray(data) ? (data as BudgetRow[]) : []
      const summary = aggregateBudgetProgress(rows)
      setState({ status: 'success', summary })
    }

    load()

    return () => {
      subscribed = false
    }
  }, [monthStart])

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (state.status === 'success') {
      setDisplayPct(0)
      const frame = requestAnimationFrame(() => setDisplayPct(state.summary.usedPct))
      return () => cancelAnimationFrame(frame)
    }

    setDisplayPct(0)
    return () => {}
  }, [state])

  if (state.status === 'loading') {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col items-center gap-5">
          <div className="h-5 w-full rounded-full bg-slate-100" />
          <div className="animate-pulse space-y-4">
            <div className="mx-auto h-36 w-36 rounded-full bg-slate-100" />
            <div className="grid w-full grid-cols-3 gap-3 text-xs">
              <div className="h-4 rounded bg-slate-100" />
              <div className="h-4 rounded bg-slate-100" />
              <div className="h-4 rounded bg-slate-100" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">Progress Anggaran</p>
          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-600">Gagal memuat</span>
        </div>
      </div>
    )
  }

  const { summary } = state
  const pctText = Math.round(summary.usedPct)
  const showEmptyState = !summary.hasBudget
  const donutColor = progressColor(summary.usedPct)
  const circumference = 2 * Math.PI * 70
  const dashOffset = circumference * (1 - displayPct / 100)

  return (
    <div
      className={`rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all duration-200 ease-out ${
        isVisible ? 'opacity-100 [transform:scale(1)]' : 'opacity-0 [transform:scale(0.98)]'
      }`}
    >
      <div className="flex flex-col items-center gap-6">
        <div className="w-full text-left">
          <p className="text-sm font-medium text-slate-500">Progress Anggaran</p>
        </div>

        <div className="group relative flex flex-col items-center">
          <div
            role="img"
            aria-label={`Progress anggaran ${pctText} persen`}
            className="relative flex h-40 w-40 items-center justify-center"
          >
            <svg className="h-full w-full" viewBox="0 0 160 160">
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="transparent"
                stroke="#e2e8f0"
                strokeWidth="14"
              />
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="transparent"
                stroke={donutColor}
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                className="transition-[stroke-dashoffset] duration-700 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-semibold text-slate-800">{pctText}%</span>
              <span className="text-xs text-slate-500">digunakan</span>
            </div>
          </div>

          <div className="pointer-events-none absolute -top-3 left-1/2 z-10 w-max -translate-x-1/2 -translate-y-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 opacity-0 shadow-sm transition-opacity duration-200 group-hover:opacity-100">
            <p>Budget: {formatIDR(summary.effectiveBudget)}</p>
            <p>Spent: {formatIDR(summary.totalSpent)}</p>
            <p>Sisa: {formatIDR(summary.remaining)}</p>
          </div>
        </div>

        <div className="grid w-full grid-cols-2 gap-4 text-sm text-slate-500 sm:grid-cols-3">
          <div className="flex flex-col items-center sm:items-start">
            <span className="text-xs uppercase tracking-wide">Budget</span>
            <span className="font-semibold text-slate-800">{formatIDR(summary.effectiveBudget)}</span>
          </div>
          <div className="flex flex-col items-center sm:items-start">
            <span className="text-xs uppercase tracking-wide">Spent</span>
            <span className="font-semibold text-slate-800">{formatIDR(summary.totalSpent)}</span>
          </div>
          <div className="col-span-2 flex flex-col items-center sm:col-span-1 sm:items-start">
            <span className="text-xs uppercase tracking-wide">Sisa</span>
            <span className="font-semibold text-slate-800">{formatIDR(summary.remaining)}</span>
          </div>
        </div>

        {showEmptyState && (
          <p className="text-sm text-slate-500">Belum ada anggaran bulan ini</p>
        )}
      </div>
    </div>
  )
}

export default BudgetProgressWidget
