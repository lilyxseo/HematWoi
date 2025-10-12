import { supabase } from './supabase'
import { getCurrentUserId } from './session'

export interface TopSpendingItem {
  categoryId: string | null
  categoryName: string
  categoryColor?: string | null
  amount: number
  share: number
  transactionCount: number
  topMerchant?: {
    id: string | null
    name: string
    amount: number
  }
}

export interface BudgetProgressItem {
  id: string
  categoryId: string | null
  categoryName: string
  categoryColor?: string | null
  planned: number
  actual: number
  progress: number
}

export interface BudgetProgressResult {
  nearLimit: BudgetProgressItem[]
  overLimit: BudgetProgressItem[]
}

export interface DueReminderItem {
  id: string
  type: 'debt' | 'subscription'
  title: string
  counterparty?: string | null
  dueDate: string
  amount: number
  remaining: number
  daysLeft: number
}

export interface WeeklyTrendInsight {
  current: number
  previous: number
  changePct: number
}

function ensurePeriod(period: string | undefined | null): string {
  if (!period) {
    const now = new Date()
    const month = `${now.getUTCMonth() + 1}`.padStart(2, '0')
    return `${now.getUTCFullYear()}-${month}`
  }
  if (/^\d{4}-\d{2}$/.test(period)) return period
  throw new Error('Periode harus dalam format YYYY-MM')
}

function toMonthRange(period: string): { start: string; end: string } {
  const normalized = ensurePeriod(period)
  const [yearStr, monthStr] = normalized.split('-')
  const year = Number.parseInt(yearStr, 10)
  const month = Number.parseInt(monthStr, 10) - 1
  const startDate = new Date(Date.UTC(year, month, 1))
  const now = new Date()
  if (now.getUTCFullYear() === year && now.getUTCMonth() === month) {
    const endDate = new Date(now)
    const endIso = endDate.toISOString().slice(0, 10)
    return { start: startDate.toISOString().slice(0, 10), end: endIso }
  }
  const endDate = new Date(Date.UTC(year, month + 1, 0))
  return {
    start: startDate.toISOString().slice(0, 10),
    end: endDate.toISOString().slice(0, 10),
  }
}

function monthStartIso(period: string): string {
  const normalized = ensurePeriod(period)
  return `${normalized}-01`
}

function diffInDays(target: Date, base: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.ceil((target.getTime() - base.getTime()) / msPerDay)
}

function toNumber(value: unknown): number {
  if (value == null || value === '') return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const parsed = Number.parseFloat(String(value))
  return Number.isFinite(parsed) ? parsed : 0
}

export async function getTopSpendingMTD(
  period?: string,
  options: { limit?: number } = {}
): Promise<TopSpendingItem[]> {
  const normalized = ensurePeriod(period)
  const { start, end } = toMonthRange(normalized)
  const limit = options.limit ?? 3
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('Pengguna tidak ditemukan. Silakan masuk kembali.')
  }

  const { data, error } = await supabase
    .from('transactions')
    .select(
      'id, amount, category_id, merchant_id, date, category:categories(id,name,color), merchant:merchants(id,name)'
    )
    .eq('user_id', userId)
    .eq('type', 'expense')
    .is('deleted_at', null)
    .is('to_account_id', null)
    .gte('date', start)
    .lte('date', end)

  if (error) throw error

  const totals = new Map<
    string,
    {
      categoryId: string | null
      categoryName: string
      categoryColor?: string | null
      amount: number
      count: number
      merchants: Map<string, { id: string | null; name: string; amount: number }>
    }
  >()

  let grandTotal = 0

  for (const row of (data ?? []) as any[]) {
    const amount = toNumber(row?.amount)
    if (!amount) continue
    grandTotal += amount
    const categoryId = row?.category_id ?? row?.category?.id ?? null
    const categoryName =
      row?.category?.name ?? row?.category_name ?? (categoryId ? 'Tanpa nama' : 'Tanpa kategori')
    const categoryColor = row?.category?.color ?? null
    const key = categoryId ?? 'uncategorized'
    const entry = totals.get(key) ?? {
      categoryId,
      categoryName,
      categoryColor,
      amount: 0,
      count: 0,
      merchants: new Map<string, { id: string | null; name: string; amount: number }>(),
    }
    entry.amount += amount
    entry.count += 1
    const merchantId = row?.merchant_id ?? row?.merchant?.id ?? null
    const merchantName = row?.merchant?.name ?? row?.merchant_name ?? null
    if (merchantName) {
      const merchantKey = merchantId ?? merchantName
      const merchantEntry = entry.merchants.get(merchantKey) ?? {
        id: merchantId,
        name: merchantName,
        amount: 0,
      }
      merchantEntry.amount += amount
      entry.merchants.set(merchantKey, merchantEntry)
    }
    if (!entry.categoryColor && categoryColor) {
      entry.categoryColor = categoryColor
    }
    totals.set(key, entry)
  }

  const sorted = Array.from(totals.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
    .map((entry) => {
      const merchants = Array.from(entry.merchants.values()).sort((a, b) => b.amount - a.amount)
      return {
        categoryId: entry.categoryId,
        categoryName: entry.categoryName,
        categoryColor: entry.categoryColor,
        amount: entry.amount,
        share: grandTotal > 0 ? entry.amount / grandTotal : 0,
        transactionCount: entry.count,
        topMerchant: merchants.length > 0 ? merchants[0] : undefined,
      }
    })

  return sorted
}

export async function getBudgetProgressMTD(period?: string): Promise<BudgetProgressResult> {
  const normalized = ensurePeriod(period)
  const monthStart = monthStartIso(normalized)
  const { start, end } = toMonthRange(normalized)
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('Pengguna tidak ditemukan. Silakan masuk kembali.')
  }

  const budgetsPromise = supabase
    .from('budgets')
    .select('id, category_id, amount_planned, category:categories(id,name,color)')
    .eq('user_id', userId)
    .eq('period_month', monthStart)

  const transactionsPromise = supabase
    .from('transactions')
    .select('category_id, amount, to_account_id, date')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .is('deleted_at', null)
    .is('to_account_id', null)
    .gte('date', start)
    .lte('date', end)

  const [budgetsResponse, txResponse] = await Promise.all([budgetsPromise, transactionsPromise])

  if (budgetsResponse.error) throw budgetsResponse.error
  if (txResponse.error) throw txResponse.error

  const spentByCategory = new Map<string, number>()
  for (const row of (txResponse.data ?? []) as any[]) {
    const categoryId = row?.category_id as string | null
    if (!categoryId) continue
    const amount = toNumber(row?.amount)
    if (!amount) continue
    const current = spentByCategory.get(categoryId) ?? 0
    spentByCategory.set(categoryId, current + amount)
  }

  const items: BudgetProgressItem[] = []
  for (const row of (budgetsResponse.data ?? []) as any[]) {
    const budgetId = String(row?.id ?? '')
    if (!budgetId) continue
    const planned = toNumber(row?.amount_planned)
    if (!planned) continue
    const categoryId = row?.category_id ?? row?.category?.id ?? null
    const categoryName = row?.category?.name ?? 'Tanpa kategori'
    const categoryColor = row?.category?.color ?? null
    const actual = spentByCategory.get(categoryId ?? '') ?? 0
    const progress = planned > 0 ? actual / planned : 0
    items.push({
      id: budgetId,
      categoryId,
      categoryName,
      categoryColor,
      planned,
      actual,
      progress,
    })
  }

  const nearLimit = items
    .filter((item) => item.progress >= 0.8 && item.progress < 1)
    .sort((a, b) => b.progress - a.progress)

  const overLimit = items
    .filter((item) => item.progress >= 1)
    .sort((a, b) => b.progress - a.progress)

  return { nearLimit, overLimit }
}

export async function getDueDebtsIn7Days(options: { limit?: number } = {}): Promise<DueReminderItem[]> {
  const limit = options.limit ?? 5
  const today = new Date()
  const todayStart = new Date(today)
  todayStart.setUTCHours(0, 0, 0, 0)
  const todayIso = todayStart.toISOString()
  const upcoming = new Date(todayStart)
  upcoming.setUTCDate(upcoming.getUTCDate() + 7)
  const upcomingIso = upcoming.toISOString()

  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('Pengguna tidak ditemukan. Silakan masuk kembali.')
  }

  const debtsPromise = supabase
    .from('debts')
    .select('id,title,party_name,due_date,amount,paid_total,status')
    .eq('user_id', userId)
    .neq('status', 'paid')
    .not('due_date', 'is', null)
    .gte('due_date', todayIso)
    .lte('due_date', upcomingIso)
    .order('due_date', { ascending: true })

  const chargesPromise = supabase
    .from('subscription_charges')
    .select('id,subscription_id,due_date,amount,status,subscription:subscriptions(id,name,vendor)')
    .eq('user_id', userId)
    .in('status', ['due', 'overdue'])
    .gte('due_date', todayIso)
    .lte('due_date', upcomingIso)
    .order('due_date', { ascending: true })

  const [debtsResponse, chargesResponse] = await Promise.all([debtsPromise, chargesPromise])

  if (debtsResponse.error) throw debtsResponse.error
  if (chargesResponse.error) throw chargesResponse.error

  const reminders: DueReminderItem[] = []
  const base = new Date(todayIso)

  for (const row of (debtsResponse.data ?? []) as any[]) {
    const dueRaw = row?.due_date as string | null
    if (!dueRaw) continue
    const dueDate = new Date(dueRaw)
    if (Number.isNaN(dueDate.getTime())) continue
    const amount = toNumber(row?.amount)
    const paidTotal = toNumber(row?.paid_total)
    const remaining = Math.max(amount - paidTotal, 0)
    reminders.push({
      id: String(row?.id),
      type: 'debt',
      title: row?.title || 'Tagihan',
      counterparty: row?.party_name ?? null,
      dueDate: dueDate.toISOString(),
      amount,
      remaining,
      daysLeft: diffInDays(dueDate, base),
    })
  }

  for (const row of (chargesResponse.data ?? []) as any[]) {
    const dueRaw = row?.due_date as string | null
    if (!dueRaw) continue
    const dueDate = new Date(dueRaw)
    if (Number.isNaN(dueDate.getTime())) continue
    reminders.push({
      id: `sub-${row?.id}`,
      type: 'subscription',
      title: row?.subscription?.name ?? 'Langganan',
      counterparty: row?.subscription?.vendor ?? null,
      dueDate: dueDate.toISOString(),
      amount: toNumber(row?.amount),
      remaining: toNumber(row?.amount),
      daysLeft: diffInDays(dueDate, base),
    })
  }

  reminders.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())

  return reminders.slice(0, limit)
}

export async function getWeeklyTrend(period?: string): Promise<WeeklyTrendInsight | null> {
  const normalized = ensurePeriod(period)
  const { end } = toMonthRange(normalized)
  const endDate = new Date(`${end}T00:00:00Z`)
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('Pengguna tidak ditemukan. Silakan masuk kembali.')
  }

  const currentWeekStart = new Date(endDate)
  const day = currentWeekStart.getUTCDay() === 0 ? 7 : currentWeekStart.getUTCDay()
  currentWeekStart.setUTCDate(currentWeekStart.getUTCDate() - (day - 1))
  const previousWeekStart = new Date(currentWeekStart)
  previousWeekStart.setUTCDate(previousWeekStart.getUTCDate() - 7)

  const rangeStart = previousWeekStart.toISOString().slice(0, 10)
  const rangeEnd = endDate.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('transactions')
    .select('amount, date, to_account_id')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .is('deleted_at', null)
    .is('to_account_id', null)
    .gte('date', rangeStart)
    .lte('date', rangeEnd)

  if (error) throw error

  let current = 0
  let previous = 0
  for (const row of (data ?? []) as any[]) {
    const amount = toNumber(row?.amount)
    if (!amount) continue
    const dateValue = row?.date as string | null
    if (!dateValue) continue
    const date = new Date(`${dateValue}T00:00:00Z`)
    if (date >= currentWeekStart && date <= endDate) {
      current += amount
    } else if (date >= previousWeekStart && date < currentWeekStart) {
      previous += amount
    }
  }

  if (current === 0 && previous === 0) {
    return null
  }

  const changePct = previous === 0 ? 100 : ((current - previous) / previous) * 100

  return { current, previous, changePct }
}

export async function getUncategorizedCount(period?: string): Promise<number> {
  const normalized = ensurePeriod(period)
  const { start, end } = toMonthRange(normalized)
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('Pengguna tidak ditemukan. Silakan masuk kembali.')
  }

  const { count, error } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', 'expense')
    .is('deleted_at', null)
    .is('to_account_id', null)
    .is('category_id', null)
    .gte('date', start)
    .lte('date', end)

  if (error) throw error
  return count ?? 0
}
