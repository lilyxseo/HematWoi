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
  previousIncome: number
  previousExpense: number
  previousTotalBalance: number
  dailyLabels: string[]
  dailyIncome: number[]
  dailyExpense: number[]
  dailyTotalBalance: number[]
}

const INITIAL_STATE: MetricsState = {
  income: 0,
  expense: 0,
  cashBalance: 0,
  nonCashBalance: 0,
  totalBalance: 0,
  previousIncome: 0,
  previousExpense: 0,
  previousTotalBalance: 0,
  dailyLabels: [],
  dailyIncome: [],
  dailyExpense: [],
  dailyTotalBalance: [],
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

type TimelineRecord = {
  date: string
  income: number
  expense: number
  cash: number
  nonCash: number
  total: number
}

function parseISODate(value: string | null | undefined): Date | null {
  if (!value || typeof value !== "string") return null
  const parts = value.split("-")
  if (parts.length !== 3) return null
  const [year, month, day] = parts.map((part) => Number.parseInt(part, 10))
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  return new Date(Date.UTC(year, month - 1, day))
}

function formatISODate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0")
  const day = `${date.getUTCDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

function addDays(date: Date, amount: number): Date {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + amount)
  return result
}

function addMonths(date: Date, amount: number): Date {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const day = date.getUTCDate()
  const totalMonths = month + amount
  const targetYear = year + Math.floor(totalMonths / 12)
  const targetMonth = ((totalMonths % 12) + 12) % 12
  const result = new Date(Date.UTC(targetYear, targetMonth, 1))
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  result.setUTCDate(Math.min(day, lastDay))
  return result
}

function enumerateDates(range: DashboardRange): string[] {
  const startDate = parseISODate(range.start)
  const endDate = parseISODate(range.end)
  if (!startDate || !endDate || startDate > endDate) return []
  const labels: string[] = []
  let current = startDate
  while (current <= endDate) {
    labels.push(formatISODate(current))
    current = addDays(current, 1)
  }
  return labels
}

function shiftRangeByMonths(range: DashboardRange, amount: number): DashboardRange {
  const startDate = parseISODate(range.start)
  const endDate = parseISODate(range.end)
  if (!startDate || !endDate) return range
  const shiftedStart = addMonths(startDate, amount)
  const shiftedEnd = addMonths(endDate, amount)
  return sanitizeRange({ start: formatISODate(shiftedStart), end: formatISODate(shiftedEnd) })
}

function findRecordBefore(records: TimelineRecord[], target: string): TimelineRecord | null {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    if (records[index].date < target) {
      return records[index]
    }
  }
  return null
}

function findRecordOnOrBefore(records: TimelineRecord[], target: string): TimelineRecord | null {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    if (records[index].date <= target) {
      return records[index]
    }
  }
  return null
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

  const normalized = txs
    .map((row) => {
      const rawDate =
        typeof row?.date === "string"
          ? row.date
          : typeof row?.created_at === "string"
            ? row.created_at
            : null
      const date = rawDate ? rawDate.slice(0, 10) : null
      const type = typeof row?.type === "string" ? row.type.toLowerCase() : ""
      if (!date || (type !== "income" && type !== "expense")) return null
      const amount = asNumber(row?.amount)
      if (!amount) return null
      return { date, type, amount }
    })
    .filter((item): item is { date: string; type: "income" | "expense"; amount: number } => item !== null)
    .sort((a, b) => a.date.localeCompare(b.date))

  const grouped = new Map<string, { income: number; expense: number }>()
  for (const tx of normalized) {
    const entry = grouped.get(tx.date) ?? { income: 0, expense: 0 }
    if (tx.type === "income") entry.income += tx.amount
    else entry.expense += tx.amount
    grouped.set(tx.date, entry)
  }

  const sortedDates = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b))
  let runningTotal = 0
  const timeline: TimelineRecord[] = []
  for (const date of sortedDates) {
    const entry = grouped.get(date) ?? { income: 0, expense: 0 }
    runningTotal += entry.income - entry.expense
    timeline.push({ date, income: entry.income, expense: entry.expense, cash: runningTotal, nonCash: 0, total: runningTotal })
  }

  const labels = enumerateDates(range)
  const recordMap = new Map(timeline.map((record) => [record.date, record]))
  const baseline = findRecordBefore(timeline, range.start)
  let lastTotal = baseline?.total ?? 0

  const dailyIncome = labels.map((label) => recordMap.get(label)?.income ?? 0)
  const dailyExpense = labels.map((label) => recordMap.get(label)?.expense ?? 0)
  const dailyTotalBalance = labels.map((label) => {
    const record = recordMap.get(label)
    if (record) {
      lastTotal = record.total
    }
    return lastTotal
  })

  const income = timeline
    .filter((record) => record.date >= range.start && record.date <= range.end)
    .reduce((sumIncome, record) => sumIncome + record.income, 0)
  const expense = timeline
    .filter((record) => record.date >= range.start && record.date <= range.end)
    .reduce((sumExpense, record) => sumExpense + record.expense, 0)

  const previousRange = shiftRangeByMonths(range, -1)
  const previousIncome = timeline
    .filter((record) => record.date >= previousRange.start && record.date <= previousRange.end)
    .reduce((sumIncome, record) => sumIncome + record.income, 0)
  const previousExpense = timeline
    .filter((record) => record.date >= previousRange.start && record.date <= previousRange.end)
    .reduce((sumExpense, record) => sumExpense + record.expense, 0)
  const previousTotalBalance = findRecordOnOrBefore(timeline, previousRange.end)?.total ?? 0

  const totalBalance = timeline.at(-1)?.total ?? 0
  const cashBalance = totalBalance
  const nonCashBalance = 0

  return {
    income,
    expense,
    cashBalance,
    nonCashBalance,
    totalBalance,
    previousIncome,
    previousExpense,
    previousTotalBalance,
    dailyLabels: labels,
    dailyIncome,
    dailyExpense,
    dailyTotalBalance,
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

        let income = 0
        let expense = 0
        for (const tx of rangeTransactions) {
          if (isTransfer(tx)) continue
          const amount = asNumber(tx.amount)
          if (!amount) continue
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

        const accountType = new Map(accounts.map((account) => [account.id, account.type]))
        const groupedByDate = new Map<string, TransactionRow[]>()
        for (const tx of transactions) {
          const dateKey = (tx.date ?? "").slice(0, 10)
          if (!dateKey) continue
          const existing = groupedByDate.get(dateKey)
          if (existing) existing.push(tx)
          else groupedByDate.set(dateKey, [tx])
        }

        const sortedDates = Array.from(groupedByDate.keys()).sort((a, b) => a.localeCompare(b))
        const runningPerAccount = new Map<string, number>()
        const timeline: TimelineRecord[] = []
        for (const date of sortedDates) {
          const txsForDate = groupedByDate.get(date) ?? []
          let dayIncome = 0
          let dayExpense = 0
          for (const tx of txsForDate) {
            const amount = asNumber(tx.amount)
            if (!amount) continue
            if (isTransfer(tx)) {
              const fromAccount = tx.account_id ?? undefined
              const toAccount = tx.to_account_id ?? undefined
              if (fromAccount) {
                runningPerAccount.set(fromAccount, (runningPerAccount.get(fromAccount) ?? 0) - amount)
              }
              if (toAccount) {
                runningPerAccount.set(toAccount, (runningPerAccount.get(toAccount) ?? 0) + amount)
              }
              continue
            }

            const accountId = tx.account_id ?? undefined
            if (accountId) {
              const delta = tx.type === "income" ? amount : -amount
              runningPerAccount.set(accountId, (runningPerAccount.get(accountId) ?? 0) + delta)
            }

            if (tx.type === "income") dayIncome += amount
            else if (tx.type === "expense") dayExpense += amount
          }

          let dayCash = 0
          let dayNonCash = 0
          for (const [accountId, balance] of runningPerAccount) {
            if (!Number.isFinite(balance)) continue
            const type = accountType.get(accountId) ?? "other"
            if (type === "cash") dayCash += balance
            else dayNonCash += balance
          }

          timeline.push({
            date,
            income: dayIncome,
            expense: dayExpense,
            cash: dayCash,
            nonCash: dayNonCash,
            total: dayCash + dayNonCash,
          })
        }

        const labels = enumerateDates(currentRange)
        const recordMap = new Map(timeline.map((record) => [record.date, record]))
        const baseline = findRecordBefore(timeline, currentRange.start)
        const firstRecord = labels.length > 0 ? recordMap.get(labels[0]) ?? null : null
        let lastCash = baseline?.cash ?? firstRecord?.cash ?? cashBalance
        let lastNonCash = baseline?.nonCash ?? firstRecord?.nonCash ?? nonCashBalance
        let lastTotal = baseline?.total ?? firstRecord?.total ?? totalBalance

        const dailyIncome = labels.map((label) => recordMap.get(label)?.income ?? 0)
        const dailyExpense = labels.map((label) => recordMap.get(label)?.expense ?? 0)
        const dailyTotalBalance = labels.map((label) => {
          const record = recordMap.get(label)
          if (record) {
            lastCash = record.cash
            lastNonCash = record.nonCash
            lastTotal = record.total
          }
          return lastTotal
        })

        const previousRange = shiftRangeByMonths(currentRange, -1)
        const previousIncome = timeline
          .filter((record) => record.date >= previousRange.start && record.date <= previousRange.end)
          .reduce((sumIncome, record) => sumIncome + record.income, 0)
        const previousExpense = timeline
          .filter((record) => record.date >= previousRange.start && record.date <= previousRange.end)
          .reduce((sumExpense, record) => sumExpense + record.expense, 0)
        const previousTotalBalance = findRecordOnOrBefore(timeline, previousRange.end)?.total ?? 0

        if (!mountedRef.current || requestId !== requestIdRef.current) return
        setMetrics({
          income,
          expense,
          cashBalance,
          nonCashBalance,
          totalBalance,
          previousIncome,
          previousExpense,
          previousTotalBalance,
          dailyLabels: labels,
          dailyIncome,
          dailyExpense,
          dailyTotalBalance,
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
