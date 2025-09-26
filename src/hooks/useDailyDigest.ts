import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { PostgrestError, PostgrestResponse } from "@supabase/supabase-js"
import { supabase } from "../lib/supabase"
import { formatCurrency } from "../lib/format.js"

const TIMEZONE = "Asia/Jakarta"
const CACHE_KEY = "hw:daily-digest:v1"
const CACHE_TTL_MS = 90_000
const ACTIVE_ACCOUNT_TYPES = new Set(["cash", "bank", "ewallet"])

const DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

interface CacheRecord {
  userId: string
  data: DailyDigestData
  expiresAt: number
}

let memoryCache: CacheRecord | null = null

type Nullable<T> = T | null | undefined

interface TransactionRow {
  id: string
  amount: Nullable<number | string>
  type: Nullable<string>
  date: Nullable<string>
  category_id: Nullable<string>
  category_name?: Nullable<string>
  deleted_at?: Nullable<string>
}

interface AccountRow {
  id: string
  type: Nullable<string>
  balance?: Nullable<number | string>
  current_balance?: Nullable<number | string>
  initial_balance?: Nullable<number | string>
  is_archived?: Nullable<boolean>
  archived_at?: Nullable<string>
}

interface BudgetRow {
  id: string
  name: Nullable<string>
  category_id: Nullable<string>
  planned: Nullable<number | string>
  rollover_in: Nullable<number | string>
  rollover_out: Nullable<number | string>
}

interface SubscriptionRow {
  id: string
  name: string
  amount: Nullable<number | string>
  next_due_date: Nullable<string>
  status?: Nullable<string>
}

interface DebtRow {
  id: string
  title: string
  amount: Nullable<number | string>
  due_date: Nullable<string>
  status?: Nullable<string>
  type?: Nullable<string>
}

export interface CategoryDigestItem {
  id: string | null
  name: string
  total: number
  pctOfMTD: number
}

export interface BudgetWarningItem {
  id: string
  name: string
  spent: number
  limit: number
  pct: number
  status: "near" | "over"
}

export interface DailyDigestData {
  balance: number
  balanceDelta: number
  balanceDirection: "up" | "down" | "flat"
  todayExpense: {
    total: number
    count: number
    vsAvgDailyMonthPct: number
  }
  wtd: {
    total: number
    vsAvgWeekly3mPct: number
  }
  mtd: {
    total: number
    vsBudgetPct?: number
    budgetAmount?: number
  }
  topCategories: CategoryDigestItem[]
  budgetWarnings: BudgetWarningItem[]
  upcoming: {
    subscriptions: Array<{
      id: string
      name: string
      dueDate: string
      amount: number
    }>
    debts: Array<{
      id: string
      name: string
      dueDate: string
      amount: number
    }>
  }
  insight: string
  range: {
    today: string
    weekStart: string
    monthStart: string
  }
}

export interface UseDailyDigestResult {
  data: DailyDigestData | null
  loading: boolean
  error: Error | null
  isRefreshing: boolean
  refresh: (options?: { skipCache?: boolean }) => Promise<void>
}

type WeekHistory = Map<string, number>

type CategoryNameMap = Map<string | null, string>

interface DigestComputationContext {
  today: string
  weekStart: string
  monthStart: string
  historyStart: string
}

function toNumber(value: Nullable<number | string>): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function formatDate(date: Date): string {
  return DATE_FORMATTER.format(date)
}

function parseParts(value: string): { year: number; month: number; day: number } | null {
  const [yearStr, monthStr, dayStr] = value.split("-")
  const year = Number.parseInt(yearStr, 10)
  const month = Number.parseInt(monthStr, 10)
  const day = Number.parseInt(dayStr, 10)
  if (!year || !month || !day) return null
  return { year, month, day }
}

function fromParts({ year, month, day }: { year: number; month: number; day: number }): string {
  const d = new Date(Date.UTC(year, month - 1, day))
  return formatDate(d)
}

function shiftDate(value: string, offsetDays: number): string {
  const parts = parseParts(value)
  if (!parts) return value
  const base = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  base.setUTCDate(base.getUTCDate() + offsetDays)
  return formatDate(base)
}

function startOfWeek(value: string): string {
  const parts = parseParts(value)
  if (!parts) return value
  const base = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  const day = base.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  base.setUTCDate(base.getUTCDate() + diff)
  return formatDate(base)
}

function startOfMonth(value: string): string {
  const parts = parseParts(value)
  if (!parts) return value
  return fromParts({ year: parts.year, month: parts.month, day: 1 })
}

function toIsoDate(value: string, endOfDay = false): string {
  const suffix = endOfDay ? "T23:59:59" : "T00:00:00"
  return `${value}${suffix}+07:00`
}

function loadCache(userId: string | null): DailyDigestData | null {
  if (!userId) return null
  const now = Date.now()
  if (memoryCache && memoryCache.userId === userId && memoryCache.expiresAt > now) {
    return memoryCache.data
  }
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheRecord
    if (!parsed || parsed.userId !== userId) return null
    if (parsed.expiresAt < now) return null
    memoryCache = parsed
    return parsed.data
  } catch {
    return null
  }
}

function saveCache(userId: string, data: DailyDigestData): void {
  const record: CacheRecord = {
    userId,
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  }
  memoryCache = record
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(record))
  } catch {
    /* ignore storage errors */
  }
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error
  if (typeof error === "string") return new Error(error)
  if (error && typeof error === "object" && "message" in error && typeof (error as any).message === "string") {
    return new Error((error as any).message)
  }
  return new Error("Gagal memuat Daily Digest. Coba lagi nanti.")
}

function isActiveAccount(row: AccountRow): boolean {
  const type = typeof row.type === "string" ? row.type.toLowerCase() : ""
  if (!ACTIVE_ACCOUNT_TYPES.has(type)) return false
  if (row.is_archived) return false
  if (row.archived_at) return false
  return true
}

function pickAccountBalance(row: AccountRow): number {
  const candidates: Array<Nullable<number | string>> = [row.balance, row.current_balance, row.initial_balance]
  for (const candidate of candidates) {
    const numeric = toNumber(candidate)
    if (numeric !== 0) return numeric
  }
  return toNumber(candidates[0])
}

function computeDigest(
  accounts: AccountRow[],
  transactions: TransactionRow[],
  budgets: BudgetRow[],
  subscriptions: SubscriptionRow[],
  debts: DebtRow[],
  context: DigestComputationContext,
): DailyDigestData {
  const { today, weekStart, monthStart, historyStart } = context
  const categoryTotals = new Map<string | null, number>()
  const categoryNames: CategoryNameMap = new Map()
  const weekTotals: WeekHistory = new Map()
  const categoryWeekTotals = new Map<string | null, WeekHistory>()
  const weekCategoryCounts = new Map<string | null, number>()

  let todayExpenseTotal = 0
  let todayExpenseCount = 0
  let todayIncomeTotal = 0
  let wtdTotal = 0
  let mtdTotal = 0

  const currentWeekKey = weekStart

  for (const tx of transactions) {
    const type = typeof tx.type === "string" ? tx.type.toLowerCase() : ""
    const rawDate = typeof tx.date === "string" ? tx.date.slice(0, 10) : ""
    if (!rawDate) continue

    const amount = Math.abs(toNumber(tx.amount))
    if (amount <= 0) continue

    if (type === "income") {
      if (rawDate === today) {
        todayIncomeTotal += amount
      }
      continue
    }

    if (type !== "expense") continue

    if (rawDate === today) {
      todayExpenseTotal += amount
      todayExpenseCount += 1
    }
    if (rawDate >= weekStart && rawDate <= today) {
      wtdTotal += amount
      const current = weekCategoryCounts.get(tx.category_id ?? null) ?? 0
      weekCategoryCounts.set(tx.category_id ?? null, current + 1)
    }
    if (rawDate >= monthStart && rawDate <= today) {
      mtdTotal += amount
      const prev = categoryTotals.get(tx.category_id ?? null) ?? 0
      categoryTotals.set(tx.category_id ?? null, prev + amount)
      if (!categoryNames.has(tx.category_id ?? null)) {
        const name = typeof tx.category_name === "string" && tx.category_name.trim().length
          ? tx.category_name.trim()
          : "Tanpa Kategori"
        categoryNames.set(tx.category_id ?? null, name)
      }
    }

    if (rawDate >= historyStart && rawDate <= today) {
      const weekKey = startOfWeek(rawDate)
      weekTotals.set(weekKey, (weekTotals.get(weekKey) ?? 0) + amount)
      if (!categoryWeekTotals.has(tx.category_id ?? null)) {
        categoryWeekTotals.set(tx.category_id ?? null, new Map())
      }
      const weekMap = categoryWeekTotals.get(tx.category_id ?? null)!
      weekMap.set(weekKey, (weekMap.get(weekKey) ?? 0) + amount)
    }

    if (!categoryNames.has(tx.category_id ?? null)) {
      const name = typeof tx.category_name === "string" && tx.category_name.trim().length
        ? tx.category_name.trim()
        : "Tanpa Kategori"
      categoryNames.set(tx.category_id ?? null, name)
    }
  }

  const avgDaily = Math.max(1, Number.parseInt(today.slice(8, 10), 10))
  const avgDailySpending = avgDaily > 0 ? mtdTotal / avgDaily : 0
  const vsAvgDailyMonthPct = avgDailySpending > 0 ? (todayExpenseTotal / avgDailySpending) * 100 : 0

  const pastWeekEntries = Array.from(weekTotals.entries()).filter(([key]) => key !== currentWeekKey)
  const pastWeekTotal = pastWeekEntries.reduce((sum, [, value]) => sum + value, 0)
  const avgWeekly = pastWeekEntries.length > 0 ? pastWeekTotal / pastWeekEntries.length : wtdTotal
  const vsAvgWeeklyPct = avgWeekly > 0 ? (wtdTotal / avgWeekly) * 100 : 0

  const topCategories = Array.from(categoryTotals.entries())
    .filter(([, total]) => total > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, total]) => {
      const name = categoryNames.get(id) ?? "Tanpa Kategori"
      const pct = mtdTotal > 0 ? (total / mtdTotal) * 100 : 0
      return {
        id,
        name,
        total,
        pctOfMTD: pct,
      }
    })

  const balanceTotal = accounts
    .filter(isActiveAccount)
    .reduce((sum, account) => sum + pickAccountBalance(account), 0)

  const balanceDelta = todayIncomeTotal - todayExpenseTotal
  const balanceDirection: DailyDigestData["balanceDirection"] =
    Math.abs(balanceDelta) < 1
      ? "flat"
      : balanceDelta > 0
        ? "up"
        : "down"

  const budgetTotals = budgets.map((row) => {
    const planned = toNumber(row.planned)
    const rolloverIn = toNumber(row.rollover_in)
    const rolloverOut = toNumber(row.rollover_out)
    const limit = Math.max(0, planned + rolloverIn - rolloverOut)
    const categoryId = row.category_id ?? null
    const spent = categoryTotals.get(categoryId) ?? 0
    const pct = limit > 0 ? (spent / limit) * 100 : 0
    const status: BudgetWarningItem["status"] = pct >= 100 ? "over" : "near"
    const name = typeof row.name === "string" && row.name.trim()
      ? row.name.trim()
      : categoryNames.get(categoryId) ?? "Tanpa Kategori"
    return {
      id: row.id,
      name,
      spent,
      limit,
      pct,
      status,
    }
  })

  const warnings = budgetTotals
    .filter((item) => item.limit > 0 && item.pct >= 90)
    .sort((a, b) => b.pct - a.pct)

  const totalBudgetPlanned = budgetTotals.reduce((sum, item) => sum + item.limit, 0)
  const vsBudgetPct = totalBudgetPlanned > 0 ? (mtdTotal / totalBudgetPlanned) * 100 : undefined

  const upcomingSubscriptions = subscriptions
    .filter((row) => row.next_due_date)
    .map((row) => ({
      id: row.id,
      name: row.name,
      dueDate: formatDate(new Date(`${String(row.next_due_date).slice(0, 10)}T00:00:00+07:00`)),
      amount: toNumber(row.amount),
    }))
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))

  const upcomingDebts = debts
    .filter((row) => row.due_date)
    .map((row) => ({
      id: row.id,
      name: row.title,
      dueDate: formatDate(new Date(String(row.due_date))),
      amount: toNumber(row.amount),
    }))
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))

  const insight = createInsight({
    todayExpenseTotal,
    topCategories,
    weekCategoryCounts,
    categoryWeekTotals,
    categoryNames,
    weekKey: currentWeekKey,
    wtdTotal,
  })

  return {
    balance: balanceTotal,
    balanceDelta,
    balanceDirection,
    todayExpense: {
      total: todayExpenseTotal,
      count: todayExpenseCount,
      vsAvgDailyMonthPct: vsAvgDailyMonthPct,
    },
    wtd: {
      total: wtdTotal,
      vsAvgWeekly3mPct: vsAvgWeeklyPct,
    },
    mtd: {
      total: mtdTotal,
      vsBudgetPct,
      budgetAmount: totalBudgetPlanned || undefined,
    },
    topCategories,
    budgetWarnings: warnings,
    upcoming: {
      subscriptions: upcomingSubscriptions,
      debts: upcomingDebts,
    },
    insight,
    range: {
      today,
      weekStart,
      monthStart,
    },
  }
}

interface InsightContext {
  todayExpenseTotal: number
  topCategories: CategoryDigestItem[]
  weekCategoryCounts: Map<string | null, number>
  categoryWeekTotals: Map<string | null, WeekHistory>
  categoryNames: CategoryNameMap
  weekKey: string
  wtdTotal: number
}

function createInsight(context: InsightContext): string {
  const { todayExpenseTotal, topCategories, weekCategoryCounts, categoryWeekTotals, categoryNames, weekKey, wtdTotal } = context

  if (topCategories.length === 0) {
    if (todayExpenseTotal > 0) {
      return `Hari ini kamu mengeluarkan ${formatCurrency(todayExpenseTotal, "IDR")} secara total.`
    }
    if (wtdTotal > 0) {
      return `Pengeluaran minggu ini total ${formatCurrency(wtdTotal, "IDR")}. Tetap pantau pengeluaranmu ya!`
    }
    return "Belum ada transaksi tercatat hari ini. Yuk catat transaksi pertamamu!"
  }

  const [top] = topCategories
  const categoryId = top.id
  const name = categoryNames.get(categoryId) ?? top.name
  const count = weekCategoryCounts.get(categoryId ?? null) ?? 0
  const history = categoryWeekTotals.get(categoryId ?? null)
  const totals = history ? Array.from(history.entries()) : []
  const otherWeeks = totals.filter(([key]) => key !== weekKey).map(([, total]) => total)
  const avg = otherWeeks.length ? otherWeeks.reduce((sum, value) => sum + value, 0) / otherWeeks.length : 0
  const tone = avg > 0 ? (top.total > avg ? "di atas" : "di bawah") : ""
  const comparison = avg > 0 ? `${tone} rata-rata mingguan kategori ‘${name}’.` : ""

  const countLabel = count > 0 ? `${count}x` : "beberapa kali"
  const base = `Minggu ini ${name} ${countLabel}, total ${formatCurrency(top.total, "IDR")}`
  return comparison ? `${base}; ${comparison}` : `${base}.`
}

function createEmptyDigest(context: DigestComputationContext): DailyDigestData {
  return {
    balance: 0,
    balanceDelta: 0,
    balanceDirection: "flat",
    todayExpense: {
      total: 0,
      count: 0,
      vsAvgDailyMonthPct: 0,
    },
    wtd: {
      total: 0,
      vsAvgWeekly3mPct: 0,
    },
    mtd: {
      total: 0,
      vsBudgetPct: undefined,
      budgetAmount: undefined,
    },
    topCategories: [],
    budgetWarnings: [],
    upcoming: {
      subscriptions: [],
      debts: [],
    },
    insight: "Belum ada transaksi tercatat hari ini. Yuk catat transaksi pertamamu!",
    range: {
      today: context.today,
      weekStart: context.weekStart,
      monthStart: context.monthStart,
    },
  }
}

async function fetchDigestData(userId: string): Promise<DailyDigestData> {
  const now = new Date()
  const today = formatDate(now)
  const weekStart = startOfWeek(today)
  const monthStart = startOfMonth(today)
  const historyStart = shiftDate(today, -84)

  const context = { today, weekStart, monthStart, historyStart }

  const [accountsRes, transactionsRes, budgetsRes, subscriptionsRes] = await Promise.all([
    supabase
      .from("accounts")
      .select("id,type,balance,current_balance,initial_balance,is_archived,archived_at"),
    supabase
      .from("transactions")
      .select("id,amount,type,date,category_id,category_name,deleted_at")
      .in("type", ["expense", "income"])
      .is("deleted_at", null)
      .gte("date", toIsoDate(historyStart))
      .lte("date", toIsoDate(today, true)),
    supabase
      .from("budgets")
      .select("id,name,category_id,planned,rollover_in,rollover_out")
      .eq("period_month", monthStart),
    supabase
      .from("subscriptions")
      .select("id,name,next_due_date,amount,status")
      .or("status.eq.active,status.is.null")
      .gte("next_due_date", today)
      .lte("next_due_date", shiftDate(today, 7)),
  ])

  const debtsRes = await supabase
    .from("debts")
    .select("id,title,due_date,amount,status,type")
    .eq("status", "ongoing")
    .eq("type", "debt")
    .gte("due_date", toIsoDate(today))
    .lte("due_date", toIsoDate(shiftDate(today, 7), true))

  const accounts = handleResponse<AccountRow>(accountsRes)
  const transactions = handleResponse<TransactionRow>(transactionsRes)
  const budgets = handleResponse<BudgetRow>(budgetsRes)
  const subscriptions = handleResponse<SubscriptionRow>(subscriptionsRes)
  const debts = handleResponse<DebtRow>(debtsRes)

  if (!transactions.length && !accounts.length) {
    return createEmptyDigest(context)
  }

  return computeDigest(accounts, transactions, budgets, subscriptions, debts, context)
}

function handleResponse<T>(response: PostgrestResponse<unknown>): T[] {
  if (response.error) {
    throw response.error as PostgrestError
  }
  const rows = Array.isArray(response.data) ? (response.data as T[]) : []
  return rows
}

export default function useDailyDigest(): UseDailyDigestResult {
  const [data, setData] = useState<DailyDigestData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const mountedRef = useRef<boolean>(false)

  const refresh = useCallback(async ({ skipCache = false } = {}) => {
    if (isRefreshing) return
    setIsRefreshing(true)
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      const uid = userData.user?.id ?? null

      if (!uid) {
        const now = new Date()
        const today = formatDate(now)
        const weekStart = startOfWeek(today)
        const monthStart = startOfMonth(today)
        const empty = createEmptyDigest({ today, weekStart, monthStart, historyStart: shiftDate(today, -84) })
        if (mountedRef.current) {
          setData(empty)
          setError(null)
          setLoading(false)
        }
        return
      }

      if (!skipCache) {
        const cached = loadCache(uid)
        if (cached && mountedRef.current) {
          setData(cached)
          setLoading(false)
        }
      }

      const digest = await fetchDigestData(uid)
      if (!mountedRef.current) return
      setData(digest)
      setError(null)
      setLoading(false)
      saveCache(uid, digest)
    } catch (err) {
      const normalized = normalizeError(err)
      if (mountedRef.current) {
        setError(normalized)
        setLoading(false)
        setData((prev) => {
          if (prev) return prev
          const now = new Date()
          const today = formatDate(now)
          const week = startOfWeek(today)
          const month = startOfMonth(today)
          return createEmptyDigest({ today, weekStart: week, monthStart: month, historyStart: shiftDate(today, -84) })
        })
      }
    } finally {
      if (mountedRef.current) {
        setIsRefreshing(false)
      }
    }
  }, [isRefreshing])

  useEffect(() => {
    mountedRef.current = true
    refresh()
    return () => {
      mountedRef.current = false
    }
  }, [refresh])

  const value = useMemo<UseDailyDigestResult>(() => ({ data, loading, error, isRefreshing, refresh }), [data, loading, error, isRefreshing, refresh])

  return value
}
