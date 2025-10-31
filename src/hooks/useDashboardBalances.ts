import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { PostgrestError } from "@supabase/supabase-js"
import type { PeriodPreset } from "../components/dashboard/PeriodPicker"
import { supabase } from "../lib/supabase.js"

export type DashboardRange = {
  start: string
  end: string
}

type AccountRow = {
  id: string
  type: "cash" | "bank" | "ewallet" | "other"
}

type TransactionRow = {
  id: string
  user_id: string
  account_id: string | null
  to_account_id: string | null
  type: "income" | "expense"
  amount: number
  date: string
  deleted_at: string | null
}

type TrendMetrics = {
  incomeTrend: number[]
  expenseTrend: number[]
  balanceTrend: number[]
  incomeMoM: number | null
  expenseMoM: number | null
  balanceMoM: number | null
}

type MetricsState = {
  income: number
  expense: number
  cashBalance: number
  nonCashBalance: number
  totalBalance: number
} & TrendMetrics

const INITIAL_STATE: MetricsState = {
  income: 0,
  expense: 0,
  cashBalance: 0,
  nonCashBalance: 0,
  totalBalance: 0,
  incomeTrend: [],
  expenseTrend: [],
  balanceTrend: [],
  incomeMoM: null,
  expenseMoM: null,
  balanceMoM: null,
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

function isAuthMissingError(error: unknown): boolean {
  if (!error) return false
  const message =
    typeof error === "string"
      ? error
      : typeof (error as { message?: unknown }).message === "string"
        ? String((error as { message: string }).message)
        : ""
  if (!message) return false
  const normalized = message.toLowerCase()
  return (
    normalized.includes("auth session missing") ||
    normalized.includes("auth session is missing") ||
    normalized.includes("missing auth session")
  )
}

type GuestStorage = {
  txs?: Array<Record<string, any>>
}

function loadGuestStorage(): GuestStorage | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage?.getItem("hematwoi:v3")
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return null
    return parsed as GuestStorage
  } catch {
    return null
  }
}

function computeGuestMetrics(range: DashboardRange, preset?: PeriodPreset): MetricsState {
  const storage = loadGuestStorage()
  const txs = Array.isArray(storage?.txs)
    ? (storage?.txs as Array<Record<string, any>>)
    : []
  const normalized: TransactionRow[] = []
  const accountIds = new Set<string>()

  const ensureAccount = (id: string | null) => {
    if (!id) return null
    accountIds.add(id)
    return id
  }

  txs.forEach((row, index) => {
    const type = typeof row?.type === "string" ? row.type.toLowerCase() : ""
    if (type !== "income" && type !== "expense") return
    const amount = asNumber(row?.amount)
    if (!amount) return
    const rawDate =
      typeof row?.date === "string"
        ? row.date
        : typeof row?.created_at === "string"
          ? row.created_at
          : null
    if (!rawDate) return
    const date = rawDate.slice(0, 10)
    const accountId = ensureAccount(
      typeof row?.account_id === "string" && row.account_id ? row.account_id : null,
    ) ?? "guest-cash"
    accountIds.add(accountId)
    const toAccountId = ensureAccount(
      typeof row?.to_account_id === "string" && row.to_account_id ? row.to_account_id : null,
    )

    normalized.push({
      id: String(row?.id ?? index),
      user_id: "guest",
      account_id: accountId,
      to_account_id: toAccountId,
      type: type === "income" ? "income" : "expense",
      amount,
      date,
      deleted_at: null,
    })
  })

  if (!normalized.length) {
    return { ...INITIAL_STATE }
  }

  if (!accountIds.size) {
    accountIds.add("guest-cash")
  }

  const accounts: AccountRow[] = Array.from(accountIds).map((id) => ({ id, type: "cash" as const }))

  return buildMetrics({ transactions: normalized, accounts, range, preset })
}

function sum(values: Iterable<number>): number {
  let total = 0
  for (const value of values) {
    if (!Number.isFinite(value)) continue
    total += value
  }
  return total
}

function sanitizeRange(range: DashboardRange): DashboardRange {
  const { start, end } = range
  if (start && end && start > end) {
    return { start: end, end: start }
  }
  return range
}

function isTransfer(tx: TransactionRow): boolean {
  return tx.to_account_id !== null && tx.to_account_id !== undefined
}

function withinRange(tx: TransactionRow, range: DashboardRange): boolean {
  const txDate = (tx.date ?? "").slice(0, 10)
  if (!txDate) return false
  return txDate >= range.start && txDate <= range.end
}

function toDate(value: string | undefined | null): Date | null {
  if (!value) return null
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10))
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  return new Date(Date.UTC(year, month - 1, day))
}

function formatDate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function clampRangeToToday(range: DashboardRange): DashboardRange {
  const today = formatDate(new Date())
  const end = range.end > today ? today : range.end
  if (range.start > end) {
    return { start: end, end }
  }
  return { start: range.start, end }
}

function getMonthRange(anchor: string | undefined): DashboardRange {
  const base = toDate(anchor) ?? new Date()
  const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1))
  const end = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0))
  return { start: formatDate(start), end: formatDate(end) }
}

function getPreviousMonthRange(current: DashboardRange): DashboardRange {
  const startDate = toDate(current.start) ?? new Date()
  const prevStart = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() - 1, 1))
  const prevEnd = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 0))
  return { start: formatDate(prevStart), end: formatDate(prevEnd) }
}

function listDays(range: DashboardRange): string[] {
  const start = toDate(range.start)
  const end = toDate(range.end)
  if (!start || !end) return []
  const days: string[] = []
  for (let time = start.getTime(); time <= end.getTime(); time += MS_PER_DAY) {
    days.push(formatDate(new Date(time)))
  }
  return days
}

function percentageChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null
  if (previous === 0) {
    return current === 0 ? 0 : null
  }
  return ((current - previous) / Math.abs(previous)) * 100
}

type BalanceSnapshot = {
  cashBalance: number
  nonCashBalance: number
  totalBalance: number
}

function computeAccountBalances(
  transactions: TransactionRow[],
  accounts: AccountRow[],
  upToDate?: string,
): BalanceSnapshot {
  const perAccount = new Map<string, number>()
  for (const tx of transactions) {
    const txDate = (tx.date ?? "").slice(0, 10)
    if (!txDate) continue
    if (upToDate && txDate > upToDate) continue
    const amount = asNumber(tx.amount)
    if (!amount) continue
    const accountId = tx.account_id ?? undefined
    const toAccountId = tx.to_account_id ?? undefined

    if (isTransfer(tx)) {
      if (accountId) {
        perAccount.set(accountId, (perAccount.get(accountId) ?? 0) - amount)
      }
      if (toAccountId) {
        perAccount.set(toAccountId, (perAccount.get(toAccountId) ?? 0) + amount)
      }
      continue
    }

    if (accountId) {
      const delta = tx.type === "income" ? amount : -amount
      perAccount.set(accountId, (perAccount.get(accountId) ?? 0) + delta)
    }
  }

  if (!accounts.length) {
    const total = sum(perAccount.values())
    return { cashBalance: total, nonCashBalance: 0, totalBalance: total }
  }

  const cashBalance = sum(
    accounts.filter((account) => account.type === "cash").map((account) => perAccount.get(account.id) ?? 0),
  )
  const nonCashBalance = sum(
    accounts.filter((account) => account.type !== "cash").map((account) => perAccount.get(account.id) ?? 0),
  )
  const totalBalance = cashBalance + nonCashBalance

  return { cashBalance, nonCashBalance, totalBalance }
}

type BuildMetricsArgs = {
  transactions: TransactionRow[]
  accounts: AccountRow[]
  range: DashboardRange
  preset?: PeriodPreset
}

function shiftRange(range: DashboardRange, days: number): DashboardRange {
  const startDate = toDate(range.start)
  const endDate = toDate(range.end)
  if (!startDate || !endDate || !Number.isFinite(days)) {
    return range
  }
  const delta = Math.trunc(days) * MS_PER_DAY
  const prevStart = new Date(startDate.getTime() - delta)
  const prevEnd = new Date(endDate.getTime() - delta)
  return { start: formatDate(prevStart), end: formatDate(prevEnd) }
}

function getComparisonRange(range: DashboardRange, preset?: PeriodPreset): DashboardRange {
  const safeRange = clampRangeToToday(range)
  const startDate = toDate(safeRange.start)
  const endDate = toDate(safeRange.end)
  if (!startDate || !endDate) {
    return safeRange
  }

  if (preset === "today") {
    return shiftRange(safeRange, 1)
  }

  if (preset === "week") {
    return shiftRange(safeRange, 7)
  }

  if (preset === "month") {
    const monthAnchor = safeRange.end || safeRange.start
    const rawMonthRange = getMonthRange(monthAnchor)
    return getPreviousMonthRange(rawMonthRange)
  }

  const span = Math.max(
    1,
    Math.round((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1,
  )
  return shiftRange(safeRange, span)
}

function buildMetrics({ transactions, accounts, range, preset }: BuildMetricsArgs): MetricsState {
  const safeTransactions = Array.isArray(transactions) ? transactions : []
  const safeAccounts = Array.isArray(accounts) ? accounts : []

  const normalizedRange = clampRangeToToday(range)
  const balanceRangeEnd =
    range.end && range.end.length ? range.end : normalizedRange.end
  const rangeTransactions = safeTransactions.filter((tx) => withinRange(tx, normalizedRange))
  let income = 0
  let expense = 0
  for (const tx of rangeTransactions) {
    if (isTransfer(tx)) continue
    const amount = asNumber(tx.amount)
    if (!amount) continue
    if (tx.type === "income") income += amount
    else if (tx.type === "expense") expense += amount
  }

  const comparisonRange = getComparisonRange(normalizedRange, preset)
  const comparisonTransactions = safeTransactions.filter((tx) => withinRange(tx, comparisonRange))

  let comparisonIncome = 0
  let comparisonExpense = 0
  for (const tx of comparisonTransactions) {
    if (isTransfer(tx)) continue
    const amount = asNumber(tx.amount)
    if (!amount) continue
    if (tx.type === "income") comparisonIncome += amount
    else if (tx.type === "expense") comparisonExpense += amount
  }

  const dailyIncome = new Map<string, number>()
  const dailyExpense = new Map<string, number>()
  for (const tx of rangeTransactions) {
    if (isTransfer(tx)) continue
    const txDate = (tx.date ?? "").slice(0, 10)
    if (!txDate) continue
    const amount = asNumber(tx.amount)
    if (!amount) continue
    if (tx.type === "income") {
      dailyIncome.set(txDate, (dailyIncome.get(txDate) ?? 0) + amount)
    } else if (tx.type === "expense") {
      dailyExpense.set(txDate, (dailyExpense.get(txDate) ?? 0) + amount)
    }
  }

  const daysInRange = listDays(normalizedRange)
  const activeDays = daysInRange.length
    ? daysInRange
    : [normalizedRange.end || normalizedRange.start].filter(Boolean)
  const incomeTrend = activeDays.map((day) => dailyIncome.get(day) ?? 0)
  const expenseTrend = activeDays.map((day) => dailyExpense.get(day) ?? 0)

  const startDate = toDate(normalizedRange.start)
  const baselineDate = startDate ? new Date(startDate.getTime() - MS_PER_DAY) : null
  const baselineSnapshot = computeAccountBalances(
    safeTransactions,
    safeAccounts,
    baselineDate ? formatDate(baselineDate) : undefined,
  )
  const currentSnapshot = computeAccountBalances(
    safeTransactions,
    safeAccounts,
    balanceRangeEnd || undefined,
  )
  const comparisonSnapshot = computeAccountBalances(
    safeTransactions,
    safeAccounts,
    comparisonRange.end || undefined,
  )
  const { cashBalance, nonCashBalance, totalBalance } = currentSnapshot

  let runningBalance = baselineSnapshot.totalBalance
  const balanceTrend = activeDays.map((day) => {
    const delta = (dailyIncome.get(day) ?? 0) - (dailyExpense.get(day) ?? 0)
    runningBalance += delta
    return runningBalance
  })

  const incomeMoM = percentageChange(income, comparisonIncome)
  const expenseMoM = percentageChange(expense, comparisonExpense)
  const balanceMoM = percentageChange(totalBalance, comparisonSnapshot.totalBalance)

  return {
    income,
    expense,
    cashBalance,
    nonCashBalance,
    totalBalance,
    incomeTrend,
    expenseTrend,
    balanceTrend,
    incomeMoM,
    expenseMoM,
    balanceMoM,
  }
}

function asNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function mapError(error: PostgrestError | Error): Error {
  if (error instanceof Error) return error
  return new Error(error.message)
}

export function useDashboardBalances({ start, end }: DashboardRange, preset?: PeriodPreset) {
  const [metrics, setMetrics] = useState<MetricsState>(INITIAL_STATE)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)
  const requestIdRef = useRef(0)
  const mountedRef = useRef(true)

  const range = useMemo(() => sanitizeRange({ start, end }), [start, end])

  const refresh = useCallback(
    async (overrideRange?: DashboardRange, overridePreset?: PeriodPreset) => {
      const currentRange = sanitizeRange(overrideRange ?? range)
      const currentPreset = overridePreset ?? preset
      const requestId = ++requestIdRef.current
      setLoading(true)
      setError(null)

      const applyGuestMetrics = () => {
        const fallback = computeGuestMetrics(currentRange, currentPreset)
        if (!mountedRef.current || requestId !== requestIdRef.current) return false
        setMetrics(fallback)
        setError(null)
        return true
      }

      try {
        const { data: authData, error: authError } = await supabase.auth.getUser()
        if (authError) {
          if (isAuthMissingError(authError)) {
            applyGuestMetrics()
            return
          }
          throw authError
        }
        const uid = authData.user?.id
        if (!uid) {
          if (applyGuestMetrics()) {
            return
          }
          if (mountedRef.current && requestId === requestIdRef.current) {
            setMetrics(INITIAL_STATE)
            setLoading(false)
          }
          return
        }

        const [{ data: accountsData, error: accountsError }, { data: transactionsData, error: transactionsError }] =
          await Promise.all([
            supabase
              .from("accounts")
              .select("id,type")
              .eq("user_id", uid),
            supabase
              .from("transactions")
              .select("id,user_id,account_id,to_account_id,type,amount,date,deleted_at")
              .eq("user_id", uid)
              .is("deleted_at", null),
          ])

        if (accountsError) throw accountsError
        if (transactionsError) throw transactionsError

        const accounts = (accountsData ?? []) as AccountRow[]
        const transactions = (transactionsData ?? []) as TransactionRow[]

        const computed = buildMetrics({
          transactions,
          accounts,
          range: currentRange,
          preset: currentPreset,
        })

        if (!mountedRef.current || requestId !== requestIdRef.current) return
        setMetrics(computed)
      } catch (err) {
        if (isAuthMissingError(err)) {
          applyGuestMetrics()
          return
        }
        if (!mountedRef.current || requestId !== requestIdRef.current) return
        setError(mapError(err as PostgrestError | Error))
        setMetrics(INITIAL_STATE)
      } finally {
        if (!mountedRef.current || requestId !== requestIdRef.current) return
        setLoading(false)
      }
    },
    [preset, range],
  )

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  return {
    ...metrics,
    loading,
    error,
    refresh,
  }
}

export default useDashboardBalances
