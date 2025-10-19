import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { PostgrestError } from "@supabase/supabase-js"
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

type MetricsState = {
  income: number
  expense: number
  cashBalance: number
  nonCashBalance: number
  totalBalance: number
  incomeTrend: number[]
  expenseTrend: number[]
  balanceTrend: number[]
  incomeMoM: number | null
  expenseMoM: number | null
  balanceMoM: number | null
}

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

function computeGuestMetrics(range: DashboardRange): MetricsState {
  const storage = loadGuestStorage()
  const txs = Array.isArray(storage?.txs)
    ? (storage?.txs as Array<Record<string, any>>)
    : []

  const startDate = parseISODate(range.start) ?? new Date()
  const endDate = parseISODate(range.end) ?? startDate
  const dayKeys = enumerateDates(startDate, endDate)

  const inRange = txs.filter((row) => {
    const rawDate =
      typeof row?.date === "string"
        ? row.date
        : typeof row?.created_at === "string"
          ? row.created_at
          : null
    if (!rawDate) return false
    const value = rawDate.slice(0, 10)
    return value >= range.start && value <= range.end
  })

  const dailyTotals = new Map<string, { income: number; expense: number }>()
  let income = 0
  let expense = 0
  for (const row of inRange) {
    const type = typeof row?.type === "string" ? row.type.toLowerCase() : ""
    if (type !== "income" && type !== "expense") continue
    const amount = asNumber(row?.amount)
    if (!amount) continue
    const key =
      typeof row?.date === "string"
        ? row.date.slice(0, 10)
        : typeof row?.created_at === "string"
          ? row.created_at.slice(0, 10)
          : ""
    if (key) {
      const entry = dailyTotals.get(key) ?? { income: 0, expense: 0 }
      if (type === "income") {
        entry.income += amount
      } else {
        entry.expense += amount
      }
      dailyTotals.set(key, entry)
    }
    if (type === "income") income += amount
    else expense += amount
  }

  let totalBalance = 0
  for (const row of txs) {
    const type = typeof row?.type === "string" ? row.type.toLowerCase() : ""
    if (type !== "income" && type !== "expense") continue
    const amount = asNumber(row?.amount)
    if (!amount) continue
    totalBalance += type === "income" ? amount : -amount
  }

  const cashBalance = totalBalance
  const nonCashBalance = 0

  const baseBalance = totalBalance - (income - expense)
  let runningBalance = baseBalance
  const incomeTrend = dayKeys.map((key) => dailyTotals.get(key)?.income ?? 0)
  const expenseTrend = dayKeys.map((key) => dailyTotals.get(key)?.expense ?? 0)
  const balanceTrend = dayKeys.map((key) => {
    const totals = dailyTotals.get(key)
    const delta = (totals?.income ?? 0) - (totals?.expense ?? 0)
    runningBalance += delta
    return runningBalance
  })

  const periodLength = Math.max(dayKeys.length, 1)
  const previousEndDate = addDays(startDate, -1)
  const previousStartDate = addDays(previousEndDate, -(periodLength - 1))
  const previousStart = formatISODate(previousStartDate)
  const previousEnd = formatISODate(previousEndDate)

  let previousIncome = 0
  let previousExpense = 0
  for (const row of txs) {
    const rawDate =
      typeof row?.date === "string"
        ? row.date
        : typeof row?.created_at === "string"
          ? row.created_at
          : null
    if (!rawDate) continue
    const value = rawDate.slice(0, 10)
    if (value < previousStart || value > previousEnd) continue
    const type = typeof row?.type === "string" ? row.type.toLowerCase() : ""
    if (type !== "income" && type !== "expense") continue
    const amount = asNumber(row?.amount)
    if (!amount) continue
    if (type === "income") previousIncome += amount
    else previousExpense += amount
  }

  const incomeMoM = previousIncome ? (income - previousIncome) / previousIncome : null
  const expenseMoM = previousExpense ? (expense - previousExpense) / previousExpense : null
  const balanceMoM = baseBalance ? (totalBalance - baseBalance) / Math.abs(baseBalance) : null

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

const MS_IN_DAY = 24 * 60 * 60 * 1000

function parseISODate(value: string): Date | null {
  if (!value) return null
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10))
  if (!year || !month || !day) return null
  return new Date(Date.UTC(year, month - 1, day))
}

function formatISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, amount: number): Date {
  return new Date(date.getTime() + amount * MS_IN_DAY)
}

function enumerateDates(start: Date, end: Date): string[] {
  const results: string[] = []
  let cursor = new Date(start.getTime())
  while (cursor <= end) {
    results.push(formatISODate(cursor))
    cursor = addDays(cursor, 1)
  }
  return results
}

function isTransfer(tx: TransactionRow): boolean {
  return tx.to_account_id !== null && tx.to_account_id !== undefined
}

function withinRange(tx: TransactionRow, range: DashboardRange): boolean {
  const txDate = (tx.date ?? "").slice(0, 10)
  if (!txDate) return false
  return txDate >= range.start && txDate <= range.end
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

export function useDashboardBalances({ start, end }: DashboardRange) {
  const [metrics, setMetrics] = useState<MetricsState>(INITIAL_STATE)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)
  const requestIdRef = useRef(0)
  const mountedRef = useRef(true)

  const range = useMemo(() => sanitizeRange({ start, end }), [start, end])

  const refresh = useCallback(
    async (override?: DashboardRange) => {
      const currentRange = sanitizeRange(override ?? range)
      const requestId = ++requestIdRef.current
      setLoading(true)
      setError(null)

      const applyGuestMetrics = () => {
        const fallback = computeGuestMetrics(currentRange)
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

        const rangeTransactions = transactions.filter((tx) => withinRange(tx, currentRange))

        const startDate = parseISODate(currentRange.start) ?? new Date()
        const endDate = parseISODate(currentRange.end) ?? startDate
        const dayKeys = enumerateDates(startDate, endDate)
        const dailyTotals = new Map<string, { income: number; expense: number }>()

        let income = 0
        let expense = 0
        for (const tx of rangeTransactions) {
          if (isTransfer(tx)) continue
          const amount = asNumber(tx.amount)
          if (!amount) continue
          const key = (tx.date ?? "").slice(0, 10)
          if (key) {
            const entry = dailyTotals.get(key) ?? { income: 0, expense: 0 }
            if (tx.type === "income") {
              entry.income += amount
            } else if (tx.type === "expense") {
              entry.expense += amount
            }
            dailyTotals.set(key, entry)
          }
          if (tx.type === "income") {
            income += amount
          } else if (tx.type === "expense") {
            expense += amount
          }
        }

        const perAccount = new Map<string, number>()
        for (const tx of transactions) {
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

        const cashBalance = sum(
          accounts.filter((account) => account.type === "cash").map((account) => perAccount.get(account.id) ?? 0),
        )
        const nonCashBalance = sum(
          accounts.filter((account) => account.type !== "cash").map((account) => perAccount.get(account.id) ?? 0),
        )
        const totalBalance = cashBalance + nonCashBalance

        const baseBalance = totalBalance - (income - expense)
        let runningBalance = baseBalance
        const incomeTrend = dayKeys.map((key) => (dailyTotals.get(key)?.income ?? 0))
        const expenseTrend = dayKeys.map((key) => (dailyTotals.get(key)?.expense ?? 0))
        const balanceTrend = dayKeys.map((key) => {
          const totals = dailyTotals.get(key)
          const delta = (totals?.income ?? 0) - (totals?.expense ?? 0)
          runningBalance += delta
          return runningBalance
        })

        const periodLength = Math.max(dayKeys.length, 1)
        const previousEndDate = addDays(startDate, -1)
        const previousStartDate = addDays(previousEndDate, -(periodLength - 1))
        const previousRange = {
          start: formatISODate(previousStartDate),
          end: formatISODate(previousEndDate),
        }
        const previousTransactions = transactions.filter((tx) => withinRange(tx, previousRange))
        let previousIncome = 0
        let previousExpense = 0
        for (const tx of previousTransactions) {
          if (isTransfer(tx)) continue
          const amount = asNumber(tx.amount)
          if (!amount) continue
          if (tx.type === "income") {
            previousIncome += amount
          } else if (tx.type === "expense") {
            previousExpense += amount
          }
        }

        const incomeMoM = previousIncome ? (income - previousIncome) / previousIncome : null
        const expenseMoM = previousExpense ? (expense - previousExpense) / previousExpense : null
        const balanceMoM = baseBalance
          ? (totalBalance - baseBalance) / Math.abs(baseBalance)
          : null

        if (!mountedRef.current || requestId !== requestIdRef.current) return
        setMetrics({
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
        })
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
    [range],
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
