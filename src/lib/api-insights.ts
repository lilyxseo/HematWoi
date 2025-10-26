import { supabase } from './supabase'
import { getCurrentUserId } from './session'
import { computeSpent, listBudgets, mergeBudgetsWithSpent, type BudgetWithSpent } from './budgetApi'
import { formatCurrency } from './format'

export interface TopSpendingInsight {
  categoryId: string | null
  categoryName: string
  categoryColor?: string | null
  amount: number
  share?: number
}

export interface BudgetProgressInsight {
  id: string
  categoryId: string | null
  categoryName: string
  planned: number
  actual: number
  progress: number
}

export interface BudgetProgressResult {
  nearLimit: BudgetProgressInsight[]
  overLimit: BudgetProgressInsight[]
  all: BudgetProgressInsight[]
  totalPlanned: number
  totalActual: number
}

export interface DueItemInsight {
  id: string
  title: string
  subtitle: string
  dueDate: string
  amount: number
  daysLeft: number
  kind: 'debt' | 'subscription'
}

export interface WeeklyTrendInsight {
  current: number
  previous: number
  changePct: number
}

function getJakartaNow(): Date {
  const now = new Date()
  const utc = now.getTime() + now.getTimezoneOffset() * 60000
  return new Date(utc + 7 * 60 * 60000)
}

function toMonthKey(value?: string | null): string {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    return value
  }
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value.slice(0, 7)
  }
  const jakarta = getJakartaNow()
  const year = jakarta.getUTCFullYear()
  const month = String(jakarta.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function formatDateUTC(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getMonthRange(periodMonth: string): { start: string; endExclusive: string } {
  const [yearStr, monthStr] = periodMonth.split('-')
  const year = Number.parseInt(yearStr, 10)
  const month = Number.parseInt(monthStr, 10)
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    throw new Error('Periode tidak valid')
  }
  const startDate = new Date(Date.UTC(year, month - 1, 1))
  const nextMonth = new Date(Date.UTC(year, month, 1))
  const jakarta = getJakartaNow()
  const jakartaKey = `${jakarta.getUTCFullYear()}-${String(jakarta.getUTCMonth() + 1).padStart(2, '0')}`
  let endExclusive = nextMonth
  if (jakartaKey === periodMonth) {
    const tomorrowJakarta = new Date(jakarta)
    tomorrowJakarta.setUTCDate(tomorrowJakarta.getUTCDate() + 1)
    tomorrowJakarta.setUTCHours(0, 0, 0, 0)
    const tomorrowUtc = new Date(Date.UTC(tomorrowJakarta.getUTCFullYear(), tomorrowJakarta.getUTCMonth(), tomorrowJakarta.getUTCDate()))
    if (tomorrowUtc < endExclusive) {
      endExclusive = tomorrowUtc
    }
  }
  return {
    start: formatDateUTC(startDate),
    endExclusive: formatDateUTC(endExclusive),
  }
}

function sanitizeNumber(value: unknown): number {
  if (value == null) return 0
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value))
  return Number.isFinite(parsed) ? parsed : 0
}

function computeProgress(row: BudgetWithSpent): BudgetProgressInsight {
  const planned = sanitizeNumber((row as any).amount_planned ?? row.planned ?? 0)
  const actual = sanitizeNumber((row as any).spent ?? 0)
  const progress = planned > 0 ? actual / planned : 0
  return {
    id: row.id,
    categoryId: row.category_id ?? null,
    categoryName: row.category?.name ?? row.category_id ?? 'Tanpa kategori',
    planned,
    actual,
    progress,
  }
}

export async function getTopSpendingMTD(period?: string | null): Promise<TopSpendingInsight | null> {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('Pengguna belum masuk')
  }
  const periodMonth = toMonthKey(period)
  const { start, endExclusive } = getMonthRange(periodMonth)

  const { data, error } = await supabase
    .from('transactions')
    .select('category_id, category:categories ( id, name, color ), amount', { count: 'exact' })
    .eq('user_id', userId)
    .eq('type', 'expense')
    .is('to_account_id', null)
    .is('deleted_at', null)
    .gte('date', start)
    .lt('date', endExclusive)

  if (error) {
    throw new Error(error.message || 'Gagal memuat pengeluaran terbesar')
  }

  const totals = new Map<string | null, { amount: number; color?: string | null; name?: string | null }>()
  let totalExpense = 0
  for (const row of data ?? []) {
    const categoryId = (row as any).category_id ?? null
    const amount = sanitizeNumber((row as any).amount)
    if (!amount) continue
    totalExpense += amount
    const entry = totals.get(categoryId) ?? { amount: 0 }
    entry.amount += amount
    const category = (row as any).category
    if (category && typeof category === 'object') {
      entry.name = (category as any).name ?? entry.name
      entry.color = (category as any).color ?? entry.color
    }
    totals.set(categoryId, entry)
  }

  if (!totals.size) {
    return null
  }

  let topId: string | null = null
  let topAmount = 0
  for (const [key, entry] of totals.entries()) {
    if (entry.amount > topAmount) {
      topAmount = entry.amount
      topId = key
    }
  }

  const top = totals.get(topId ?? null)
  if (!top) return null
  const share = totalExpense > 0 ? top.amount / totalExpense : undefined
  return {
    categoryId: topId ?? null,
    categoryName: top.name ?? (topId ? 'Kategori lain' : 'Tanpa kategori'),
    categoryColor: top.color ?? null,
    amount: top.amount,
    share,
  }
}

export async function getBudgetProgressMTD(period?: string | null): Promise<BudgetProgressResult> {
  const periodMonth = toMonthKey(period)
  const [budgets, spent] = await Promise.all([listBudgets(periodMonth), computeSpent(periodMonth)])
  const merged = mergeBudgetsWithSpent(budgets, spent)
  const rows = merged
    .filter((row) => (row.category?.type ?? 'expense') !== 'income')
    .map((row) => computeProgress(row))

  const nearLimit = rows
    .filter((row) => row.progress >= 0.8 && row.progress < 1)
    .sort((a, b) => b.progress - a.progress)
  const overLimit = rows
    .filter((row) => row.progress >= 1)
    .sort((a, b) => b.progress - a.progress)

  const totalPlanned = rows.reduce((sum, row) => sum + row.planned, 0)
  const totalActual = rows.reduce((sum, row) => sum + row.actual, 0)

  return {
    nearLimit,
    overLimit,
    all: rows,
    totalPlanned,
    totalActual,
  }
}

export async function getDueDebtsIn7Days(): Promise<DueItemInsight[]> {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('Pengguna belum masuk')
  }
  const nowJakarta = getJakartaNow()
  nowJakarta.setUTCHours(0, 0, 0, 0)
  const startDate = formatDateUTC(nowJakarta)
  const limit = new Date(nowJakarta)
  limit.setUTCDate(limit.getUTCDate() + 7)
  const endDate = formatDateUTC(limit)

  const debtsPromise = supabase
    .from('debts')
    .select('id,title,party_name,due_date,amount,paid_total,status,type')
    .eq('user_id', userId)
    .neq('status', 'paid')
    .not('due_date', 'is', null)
    .gte('due_date', startDate)
    .lte('due_date', endDate)
    .order('due_date', { ascending: true })
    .limit(5)

  const subscriptionsPromise = supabase
    .from('subscription_charges')
    .select('id,subscription:subscriptions ( name ),due_date,amount,status')
    .eq('user_id', userId)
    .in('status', ['due', 'overdue'])
    .not('due_date', 'is', null)
    .gte('due_date', startDate)
    .lte('due_date', endDate)
    .order('due_date', { ascending: true })
    .limit(5)

  const [debtsResponse, subscriptionsResponse] = await Promise.all([debtsPromise, subscriptionsPromise])

  if (debtsResponse.error) {
    throw new Error(debtsResponse.error.message || 'Gagal memuat hutang jatuh tempo')
  }
  if (subscriptionsResponse.error) {
    throw new Error(subscriptionsResponse.error.message || 'Gagal memuat tagihan jatuh tempo')
  }

  const items: DueItemInsight[] = []

  for (const row of debtsResponse.data ?? []) {
    if ((row as any)?.type === 'receivable') continue
    const dueDate = row?.due_date ? new Date(row.due_date as any) : null
    if (!dueDate || Number.isNaN(dueDate.getTime())) continue
    const daysLeft = Math.max(0, Math.ceil((dueDate.getTime() - nowJakarta.getTime()) / (24 * 60 * 60 * 1000)))
    const amount = sanitizeNumber(row?.amount) - sanitizeNumber(row?.paid_total)
    items.push({
      id: String(row.id),
      title: row.title ?? 'Hutang',
      subtitle: row.party_name ? `Dengan ${row.party_name}` : 'Pengingat hutang',
      dueDate: dueDate.toISOString(),
      amount: Math.max(amount, 0),
      daysLeft,
      kind: 'debt',
    })
  }

  for (const row of subscriptionsResponse.data ?? []) {
    const dueDate = row?.due_date ? new Date(row.due_date as any) : null
    if (!dueDate || Number.isNaN(dueDate.getTime())) continue
    const daysLeft = Math.max(0, Math.ceil((dueDate.getTime() - nowJakarta.getTime()) / (24 * 60 * 60 * 1000)))
    items.push({
      id: String(row.id),
      title: row.subscription?.name ?? 'Subscription',
      subtitle: 'Tagihan langganan',
      dueDate: dueDate.toISOString(),
      amount: sanitizeNumber(row?.amount),
      daysLeft,
      kind: 'subscription',
    })
  }

  items.sort((a, b) => a.daysLeft - b.daysLeft)

  return items
}

export async function getUncategorizedCount(period?: string | null): Promise<number> {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('Pengguna belum masuk')
  }
  const periodMonth = toMonthKey(period)
  const { start, endExclusive } = getMonthRange(periodMonth)

  const { count, error } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', 'expense')
    .is('category_id', null)
    .is('to_account_id', null)
    .is('deleted_at', null)
    .gte('date', start)
    .lt('date', endExclusive)

  if (error) {
    throw new Error(error.message || 'Gagal menghitung transaksi belum dikategorikan')
  }

  return count ?? 0
}

export async function getWeeklyTrend(period?: string | null): Promise<WeeklyTrendInsight | null> {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('Pengguna belum masuk')
  }
  const periodMonth = toMonthKey(period)
  const { start, endExclusive } = getMonthRange(periodMonth)
  const jakartaNow = getJakartaNow()
  const startOfWeek = new Date(jakartaNow)
  const day = startOfWeek.getUTCDay() === 0 ? 7 : startOfWeek.getUTCDay()
  startOfWeek.setUTCDate(startOfWeek.getUTCDate() - (day - 1))
  startOfWeek.setUTCHours(0, 0, 0, 0)
  const prevWeekStart = new Date(startOfWeek)
  prevWeekStart.setUTCDate(prevWeekStart.getUTCDate() - 7)

  const currentWeekStart = formatDateUTC(startOfWeek)
  const nextWeekStart = formatDateUTC(new Date(Date.UTC(startOfWeek.getUTCFullYear(), startOfWeek.getUTCMonth(), startOfWeek.getUTCDate() + 7)))
  const prevStart = formatDateUTC(prevWeekStart)
  const prevEnd = formatDateUTC(new Date(Date.UTC(prevWeekStart.getUTCFullYear(), prevWeekStart.getUTCMonth(), prevWeekStart.getUTCDate() + 7)))

  const currentRangeStart = currentWeekStart < start ? start : currentWeekStart
  const currentRangeEnd = nextWeekStart > endExclusive ? endExclusive : nextWeekStart

  const prevRangeStart = prevStart < start ? start : prevStart
  const prevRangeEnd = prevEnd > endExclusive ? endExclusive : prevEnd

  const [{ data: currentData, error: currentError }, { data: prevData, error: prevError }] = await Promise.all([
    supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('type', 'expense')
      .is('to_account_id', null)
      .is('deleted_at', null)
      .gte('date', currentRangeStart)
      .lt('date', currentRangeEnd),
    supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('type', 'expense')
      .is('to_account_id', null)
      .is('deleted_at', null)
      .gte('date', prevRangeStart)
      .lt('date', prevRangeEnd),
  ])

  if (currentError) {
    throw new Error(currentError.message || 'Gagal memuat tren mingguan')
  }
  if (prevError) {
    throw new Error(prevError.message || 'Gagal memuat tren mingguan')
  }

  const currentTotal = (currentData ?? []).reduce((sum, row) => sum + sanitizeNumber((row as any).amount), 0)
  const previousTotal = (prevData ?? []).reduce((sum, row) => sum + sanitizeNumber((row as any).amount), 0)

  if (currentTotal === 0 && previousTotal === 0) {
    return null
  }

  const changePct = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 100

  return {
    current: currentTotal,
    previous: previousTotal,
    changePct,
  }
}

export function formatAmount(amount: number): string {
  return formatCurrency(amount ?? 0, 'IDR')
}
