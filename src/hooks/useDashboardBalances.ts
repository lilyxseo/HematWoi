import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { PostgrestError } from "@supabase/supabase-js"
import { supabase } from "../lib/supabase.js"
import { LocalDriver } from "../lib/data-driver"

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
}

const INITIAL_STATE: MetricsState = {
  income: 0,
  expense: 0,
  cashBalance: 0,
  nonCashBalance: 0,
  totalBalance: 0,
}

const guestDriver = new LocalDriver()

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

function normalizeAccount(row: any): AccountRow | null {
  const id = row?.id ?? row?.client_id
  if (!id) return null
  const type = row?.type
  if (type === "cash" || type === "bank" || type === "ewallet" || type === "other") {
    return { id: String(id), type }
  }
  return { id: String(id), type: "other" }
}

function normalizeTransaction(row: any): TransactionRow | null {
  const id = row?.id ?? row?.client_id
  if (!id) return null
  const accountId = row?.account_id ?? row?.accountId ?? null
  const toAccountId = row?.to_account_id ?? row?.toAccountId ?? null
  const rawType = typeof row?.type === "string" ? row.type.toLowerCase() : ""
  const type = rawType === "income" ? "income" : "expense"
  const date =
    typeof row?.date === "string"
      ? row.date
      : typeof row?.created_at === "string"
        ? row.created_at
        : new Date().toISOString()
  const deletedAt = row?.deleted_at ?? row?.deletedAt ?? null
  return {
    id: String(id),
    user_id: row?.user_id ? String(row.user_id) : "",
    account_id: accountId ? String(accountId) : null,
    to_account_id: toAccountId ? String(toAccountId) : null,
    type,
    amount: asNumber(row?.amount),
    date,
    deleted_at: typeof deletedAt === "string" ? deletedAt : null,
  }
}

async function loadGuestData(): Promise<{ accounts: AccountRow[]; transactions: TransactionRow[] }> {
  try {
    const [accountsRaw, transactionsRaw] = await Promise.all([
      guestDriver.list("accounts"),
      guestDriver.list("transactions"),
    ])
    const accounts = (accountsRaw ?? []).map(normalizeAccount).filter((item): item is AccountRow => Boolean(item))
    const transactions = (transactionsRaw ?? [])
      .map(normalizeTransaction)
      .filter((item): item is TransactionRow => Boolean(item) && !item.deleted_at)
    return { accounts, transactions }
  } catch (err) {
    console.error("[useDashboardBalances] Failed to load guest data", err)
    throw mapError(err as PostgrestError | Error)
  }
}

function calculateMetrics({
  accounts,
  transactions,
  range,
}: {
  accounts: AccountRow[]
  transactions: TransactionRow[]
  range: DashboardRange
}): MetricsState {
  const rangeTransactions = transactions.filter((tx) => withinRange(tx, range))

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

  const cashBalance = sum(accounts.filter((account) => account.type === "cash").map((account) => perAccount.get(account.id) ?? 0))
  const nonCashBalance = sum(accounts.filter((account) => account.type !== "cash").map((account) => perAccount.get(account.id) ?? 0))
  const totalBalance = cashBalance + nonCashBalance

  return { income, expense, cashBalance, nonCashBalance, totalBalance }
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

      try {
        const { data: authData, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        const uid = authData.user?.id
        if (!uid) {
          const guestData = await loadGuestData()
          const metrics = calculateMetrics({ accounts: guestData.accounts, transactions: guestData.transactions, range: currentRange })
          if (!mountedRef.current || requestId !== requestIdRef.current) return
          setMetrics(metrics)
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

        if (!mountedRef.current || requestId !== requestIdRef.current) return
        const metrics = calculateMetrics({ accounts, transactions, range: currentRange })
        setMetrics(metrics)
      } catch (err) {
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
