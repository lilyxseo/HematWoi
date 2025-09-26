import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import timezone from "dayjs/plugin/timezone"
import type { PostgrestError } from "@supabase/supabase-js"
import { supabase } from "../lib/supabase"
import useSupabaseUser from "./useSupabaseUser"

dayjs.extend(utc)
dayjs.extend(timezone)

const TIMEZONE = "Asia/Jakarta"

export type Direction = "up" | "down" | "flat"

type AccountRow = {
  id: string
  balance?: number | string | null
  is_archived?: boolean | null
}

type TransactionRow = {
  id: string
  type: "income" | "expense" | string
  amount: number | string | null
  date: string
  category_id?: string | null
  category?: { id?: string | null; name?: string | null }
}

type BudgetRow = {
  id: string
  category_id?: string | null
  name?: string | null
  planned?: number | string | null
  period_month?: string | null
  category?: { id?: string | null; name?: string | null }
}

type SubscriptionRow = {
  id: string
  name: string | null
  next_due_date: string | null
  amount: number | string | null
  currency?: string | null
}

type DebtRow = {
  id: string
  title: string | null
  due_date: string | null
  amount: number | string | null
  paid_total?: number | string | null
  status?: string | null
  type?: string | null
}

export interface DailyDigestBalance {
  total: number
  yesterday: number
  delta: number
  direction: Direction
}

export interface DailyDigestSpending {
  today: number
  averageDaily: number
  difference: number
  differencePercent: number
  direction: Direction
}

export type BudgetStatus = "safe" | "warning" | "over"

export interface DailyDigestBudgetCategory {
  id: string
  name: string
  planned: number
  spent: number
  percent: number
  status: BudgetStatus
}

export interface DailyDigestBudgetSummary {
  totalPlanned: number
  totalSpent: number
  percent: number
  status: BudgetStatus
  categories: DailyDigestBudgetCategory[]
}

export interface DailyDigestTopCategory {
  id: string
  name: string
  amount: number
  percent: number
}

export type UpcomingType = "subscription" | "debt"

export interface DailyDigestUpcomingItem {
  id: string
  name: string
  dueDate: string
  amount: number
  type: UpcomingType
}

export interface DailyDigestData {
  balance: DailyDigestBalance
  spending: DailyDigestSpending
  budget: DailyDigestBudgetSummary
  topCategories: DailyDigestTopCategory[]
  upcoming: DailyDigestUpcomingItem[]
  monthExpenseTotal: number
  monthExpenseDayCount: number
  generatedAt: string
}

export interface UseDailyDigestOptions {
  enabled?: boolean
}

interface FetchResult {
  accounts: AccountRow[]
  transactions: TransactionRow[]
  budgets: BudgetRow[]
  upcoming: DailyDigestUpcomingItem[]
}

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function toLocalDateKey(value: string): string {
  if (!value) return ""
  const parsed = dayjs(value)
  if (!parsed.isValid()) return ""
  return parsed.tz(TIMEZONE).format("YYYY-MM-DD")
}

function determineDirection(value: number, tolerance = 1): Direction {
  if (Math.abs(value) <= tolerance) return "flat"
  return value > 0 ? "up" : "down"
}

function determineBudgetStatus(percent: number): BudgetStatus {
  if (!Number.isFinite(percent) || percent <= 0.89) return "safe"
  if (percent <= 1) return "warning"
  return "over"
}

async function handleError(error: PostgrestError | null | undefined, scope: string): Promise<void> {
  if (!error) return
  throw new Error(error.message || `Gagal memuat ${scope}`)
}

async function fetchAccounts(userId: string): Promise<AccountRow[]> {
  const { data, error } = await supabase
    .from<AccountRow>("accounts")
    .select("id,balance,is_archived")
    .eq("user_id", userId)
  await handleError(error, "akun")
  return data ?? []
}

async function fetchMonthTransactions(userId: string, startUtc: string, endUtc: string): Promise<TransactionRow[]> {
  const { data, error } = await supabase
    .from<TransactionRow>("transactions")
    .select("id,type,amount,date,category_id,category:categories(id,name)")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .gte("date", startUtc)
    .lte("date", endUtc)
  await handleError(error, "transaksi")
  return data ?? []
}

async function fetchBudgets(userId: string, period: string): Promise<BudgetRow[]> {
  const { data, error } = await supabase
    .from<BudgetRow>("budgets")
    .select("id,category_id,name,planned,period_month,category:categories(id,name)")
    .eq("user_id", userId)
    .eq("period_month", period)
  await handleError(error, "anggaran")
  return data ?? []
}

async function fetchUpcoming(userId: string, startUtc: string, endUtc: string): Promise<DailyDigestUpcomingItem[]> {
  const items: DailyDigestUpcomingItem[] = []

  const { data: subs, error: subsError } = await supabase
    .from<SubscriptionRow>("subscriptions")
    .select("id,name,next_due_date,amount,currency")
    .eq("user_id", userId)
    .eq("status", "active")
    .not("next_due_date", "is", null)
    .gte("next_due_date", startUtc.slice(0, 10))
    .lte("next_due_date", endUtc.slice(0, 10))
    .order("next_due_date", { ascending: true })
    .limit(10)
  await handleError(subsError, "langganan")

  for (const row of subs ?? []) {
    const amount = toNumber(row.amount)
    if (!row.next_due_date) continue
    items.push({
      id: row.id,
      name: row.name ?? "Langganan",
      dueDate: dayjs(row.next_due_date).tz(TIMEZONE).format("YYYY-MM-DD"),
      amount,
      type: "subscription",
    })
  }

  const { data: debts, error: debtsError } = await supabase
    .from<DebtRow>("debts")
    .select("id,title,due_date,amount,paid_total,status,type")
    .eq("user_id", userId)
    .neq("status", "paid")
    .not("due_date", "is", null)
    .gte("due_date", startUtc)
    .lte("due_date", endUtc)
    .order("due_date", { ascending: true })
    .limit(10)
  await handleError(debtsError, "hutang")

  for (const row of debts ?? []) {
    const remaining = Math.max(toNumber(row.amount) - toNumber(row.paid_total), 0)
    if (remaining <= 0) continue
    items.push({
      id: row.id,
      name: row.title ?? "Hutang",
      dueDate: dayjs(row.due_date as string).tz(TIMEZONE).format("YYYY-MM-DD"),
      amount: remaining,
      type: "debt",
    })
  }

  return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 6)
}

async function fetchDigest(userId: string): Promise<FetchResult> {
  const now = dayjs().tz(TIMEZONE)
  const monthStart = now.startOf("month").startOf("day")
  const monthEnd = now.endOf("month").endOf("day")
  const todayStart = now.startOf("day")
  const upcomingEnd = now.add(7, "day").endOf("day")

  const [accounts, transactions, budgets, upcoming] = await Promise.all([
    fetchAccounts(userId),
    fetchMonthTransactions(userId, monthStart.utc().format(), monthEnd.utc().format()),
    fetchBudgets(userId, monthStart.format("YYYY-MM-DD")),
    fetchUpcoming(userId, todayStart.utc().format(), upcomingEnd.utc().format()),
  ])

  return { accounts, transactions, budgets, upcoming }
}

function computeDigest(result: FetchResult): DailyDigestData {
  const now = dayjs().tz(TIMEZONE)
  const todayKey = now.format("YYYY-MM-DD")
  const dayIndex = Math.max(now.date(), 1)

  let totalBalance = 0
  for (const account of result.accounts) {
    if (account.is_archived) continue
    totalBalance += toNumber(account.balance)
  }

  let todayExpense = 0
  let todayIncome = 0
  let monthExpenseTotal = 0
  const categoryTotals = new Map<string, { id: string; name: string; amount: number }>()

  for (const tx of result.transactions) {
    const dateKey = toLocalDateKey(tx.date)
    const amount = toNumber(tx.amount)
    if (amount <= 0) continue
    const type = typeof tx.type === "string" ? tx.type.toLowerCase() : ""
    if (type === "expense") {
      monthExpenseTotal += amount
      if (dateKey === todayKey) todayExpense += amount
      const categoryId = tx.category_id ?? null
      const name = tx.category?.name ?? "Tanpa Kategori"
      const key = categoryId ?? `custom:${name.toLowerCase()}`
      const existing = categoryTotals.get(key) ?? {
        id: categoryId ?? key,
        name,
        amount: 0,
      }
      existing.amount += amount
      categoryTotals.set(key, existing)
    } else if (type === "income") {
      if (dateKey === todayKey) todayIncome += amount
    }
  }

  const netChangeToday = todayIncome - todayExpense
  const yesterdayBalance = totalBalance - netChangeToday
  const balanceDelta = totalBalance - yesterdayBalance
  const balanceDirection = determineDirection(balanceDelta)

  const averageDaily = monthExpenseTotal / dayIndex
  const difference = todayExpense - averageDaily
  const differencePercent = averageDaily > 0 ? (difference / averageDaily) * 100 : 0
  const spendingDirection = determineDirection(difference, 1000)

  const budgetCategories: DailyDigestBudgetCategory[] = []
  for (const budget of result.budgets) {
    const planned = toNumber(budget.planned)
    if (planned <= 0) continue
    const categoryId = budget.category_id ?? null
    const name = budget.category?.name ?? budget.name ?? "Anggaran"
    const key = categoryId ?? `custom:${name.toLowerCase()}`
    const spent = categoryTotals.get(key)?.amount ?? 0
    const percent = planned > 0 ? spent / planned : 0
    budgetCategories.push({
      id: budget.id,
      name,
      planned,
      spent,
      percent,
      status: determineBudgetStatus(percent),
    })
  }

  const totalPlanned = budgetCategories.reduce((acc, item) => acc + item.planned, 0)
  const totalSpent = budgetCategories.reduce((acc, item) => acc + item.spent, 0)
  const percent = totalPlanned > 0 ? totalSpent / totalPlanned : 0
  const budgetStatus = determineBudgetStatus(percent)

  const topCategories = Array.from(categoryTotals.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3)
    .map<DailyDigestTopCategory>((item) => ({
      id: item.id,
      name: item.name,
      amount: item.amount,
      percent: monthExpenseTotal > 0 ? item.amount / monthExpenseTotal : 0,
    }))

  return {
    balance: {
      total: totalBalance,
      yesterday: yesterdayBalance,
      delta: balanceDelta,
      direction: balanceDirection,
    },
    spending: {
      today: todayExpense,
      averageDaily,
      difference,
      differencePercent,
      direction: spendingDirection,
    },
    budget: {
      totalPlanned,
      totalSpent,
      percent,
      status: budgetStatus,
      categories: budgetCategories.sort((a, b) => b.percent - a.percent).slice(0, 4),
    },
    topCategories,
    upcoming: result.upcoming,
    monthExpenseTotal,
    monthExpenseDayCount: dayIndex,
    generatedAt: now.toISOString(),
  }
}

export default function useDailyDigest(options: UseDailyDigestOptions = {}) {
  const { user } = useSupabaseUser()
  const userId = user?.id ?? null

  const query = useQuery<DailyDigestData, Error>({
    queryKey: ["daily-digest", userId],
    queryFn: async () => {
      if (!userId) throw new Error("Pengguna belum masuk")
      const result = await fetchDigest(userId)
      return computeDigest(result)
    },
    enabled: Boolean(userId && (options.enabled ?? true)),
    staleTime: 90_000,
    gcTime: 5 * 60_000,
    retry: 1,
  })

  return useMemo(
    () => ({
      ...query,
      userId,
    }),
    [query, userId],
  )
}
