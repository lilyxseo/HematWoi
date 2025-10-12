import { supabase } from './supabase';
import { getCurrentUserId } from './session';

export interface MonthRange {
  start: string;
  end: string;
}

function logDev(error: unknown, scope: string) {
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.error(`[HW][api-insights] ${scope}`, error);
  }
}

function normalizePeriodMonth(period: string | undefined | null): string {
  if (!period) {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${now.getFullYear()}-${month}`;
  }
  const trimmed = period.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed.slice(0, 7);
  }
  throw new Error('Periode bulan tidak valid.');
}

function formatIsoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getMonthRange(period: string): MonthRange {
  const normalized = normalizePeriodMonth(period);
  const [yearStr, monthStr] = normalized.split('-');
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    throw new Error('Periode bulan tidak valid.');
  }
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const today = new Date();
  const lastDay = new Date(Date.UTC(year, month, 0));
  let endDate = lastDay;
  if (
    today.getUTCFullYear() === startDate.getUTCFullYear() &&
    today.getUTCMonth() === startDate.getUTCMonth()
  ) {
    endDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  }
  return {
    start: formatIsoDate(startDate),
    end: formatIsoDate(endDate),
  };
}

function parseNumber(value: unknown, fallback = 0): number {
  if (value == null) return fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export interface TopSpendingMTD {
  categoryId: string | null;
  categoryName: string;
  amount: number;
  share: number;
}

export async function getTopSpendingMTD(period?: string): Promise<TopSpendingMTD | null> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return null;
    const range = getMonthRange(normalizePeriodMonth(period ?? undefined));

    const baseQuery = supabase
      .from('transactions')
      .select(
        `
        category_id,
        total:amount.sum(),
        categories:category_id (id, name)
      `
      )
      .eq('user_id', userId)
      .eq('type', 'expense')
      .is('to_account_id', null)
      .is('deleted_at', null)
      .gte('date', range.start)
      .lte('date', range.end)
      .group('category_id, categories.id, categories.name')
      .order('total', { ascending: false })
      .limit(5);

    const { data, error } = await baseQuery;
    if (error) throw error;
    if (!data || data.length === 0) return null;

    const totals = data.map((row) => parseNumber((row as any)?.total));
    const grandTotal = totals.reduce((sum, value) => sum + value, 0);
    const [top] = data;
    const topAmount = parseNumber((top as any)?.total);
    const categoryName =
      (top as any)?.categories?.name ?? (top as any)?.category_name ?? 'Tanpa kategori';

    const categoryId = (top as any)?.category_id ?? (top as any)?.categories?.id ?? null;
    const share = grandTotal > 0 ? topAmount / grandTotal : 0;

    return {
      categoryId: categoryId ? String(categoryId) : null,
      categoryName: String(categoryName || 'Tanpa kategori'),
      amount: topAmount,
      share,
    };
  } catch (error) {
    logDev(error, 'getTopSpendingMTD');
    throw new Error('Gagal memuat pengeluaran terbesar.');
  }
}

export interface BudgetProgressInsight {
  budgetId: string;
  categoryId: string | null;
  categoryName: string;
  planned: number;
  actual: number;
  progress: number;
}

export interface BudgetProgressSummary {
  plannedTotal: number;
  actualTotal: number;
  remainingTotal: number;
  daysElapsed: number;
  daysInPeriod: number;
}

export interface BudgetProgressResult {
  entries: BudgetProgressInsight[];
  summary: BudgetProgressSummary;
}

export async function getBudgetProgressMTD(period?: string): Promise<BudgetProgressResult> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return { entries: [], summary: { plannedTotal: 0, actualTotal: 0, remainingTotal: 0, daysElapsed: 0, daysInPeriod: 0 } };
    }
    const normalized = normalizePeriodMonth(period ?? undefined);
    const range = getMonthRange(normalized);
    const periodIso = `${normalized}-01`;

    const budgetsPromise = supabase
      .from('budgets')
      .select('id, user_id, category_id, amount_planned, period_month, category:categories(id, name)')
      .eq('user_id', userId)
      .eq('period_month', periodIso)
      .order('created_at', { ascending: true });

    const spentPromise = supabase
      .from('transactions')
      .select('category_id, total:amount.sum()')
      .eq('user_id', userId)
      .eq('type', 'expense')
      .is('to_account_id', null)
      .is('deleted_at', null)
      .gte('date', range.start)
      .lte('date', range.end)
      .group('category_id');

    const [{ data: budgetRows, error: budgetError }, { data: spentRows, error: spentError }] = await Promise.all([
      budgetsPromise,
      spentPromise,
    ]);

    if (budgetError) throw budgetError;
    if (spentError) throw spentError;

    const spentMap = new Map<string, number>();
    for (const row of (spentRows ?? []) as any[]) {
      const key = row?.category_id ? String(row.category_id) : 'uncategorized';
      const amount = parseNumber(row?.total);
      spentMap.set(key, amount);
    }

    const entries: BudgetProgressInsight[] = [];
    let plannedTotal = 0;
    let actualTotal = 0;

    for (const row of (budgetRows ?? []) as any[]) {
      const budgetId = String(row.id);
      const categoryId = row?.category_id ? String(row.category_id) : null;
      const planned = parseNumber(row?.amount_planned);
      const actual = categoryId ? parseNumber(spentMap.get(categoryId)) : 0;
      const progress = planned > 0 ? actual / planned : 0;
      const categoryName = row?.category?.name ?? row?.category_name ?? 'Tanpa kategori';
      entries.push({
        budgetId,
        categoryId,
        categoryName: String(categoryName || 'Tanpa kategori'),
        planned,
        actual,
        progress,
      });
      plannedTotal += planned;
      actualTotal += actual;
    }

    const [yearStr, monthStr] = normalized.split('-');
    const year = Number.parseInt(yearStr, 10);
    const month = Number.parseInt(monthStr, 10);
    const totalDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const endDate = new Date(range.end);
    const daysElapsed = endDate.getUTCDate();

    return {
      entries,
      summary: {
        plannedTotal,
        actualTotal,
        remainingTotal: plannedTotal - actualTotal,
        daysElapsed,
        daysInPeriod: totalDays,
      },
    };
  } catch (error) {
    logDev(error, 'getBudgetProgressMTD');
    throw new Error('Gagal memuat progres anggaran.');
  }
}

export interface DueDebtReminder {
  id: string;
  title: string;
  amount: number;
  dueDate: string;
  daysLeft: number;
  source: 'debt' | 'subscription';
  note?: string | null;
}

function diffInDays(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function normalizeDateInput(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = trimmed.length === 10 ? new Date(`${trimmed}T00:00:00Z`) : new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export async function getDueDebtsIn7Days(): Promise<DueDebtReminder[]> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return [];
    const today = new Date();
    const todayIso = formatIsoDate(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())));
    const upcomingDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 7));
    const upcomingIso = formatIsoDate(upcomingDate);

    const debtsPromise = supabase
      .from('debts')
      .select('id, title, due_date, amount, paid_total, status, party_name')
      .eq('user_id', userId)
      .not('status', 'eq', 'paid')
      .not('status', 'eq', 'archived')
      .gte('due_date', todayIso)
      .lte('due_date', upcomingIso)
      .order('due_date', { ascending: true });

    const subscriptionsPromise = supabase
      .from('subscription_charges')
      .select('id, due_date, amount, status, subscription:subscription_id (name, vendor)')
      .eq('user_id', userId)
      .in('status', ['due', 'overdue'])
      .gte('due_date', todayIso)
      .lte('due_date', upcomingIso)
      .order('due_date', { ascending: true });

    const [{ data: debtRows, error: debtError }, { data: chargeRows, error: chargeError }] = await Promise.all([
      debtsPromise,
      subscriptionsPromise,
    ]);

    if (debtError) throw debtError;
    if (chargeError) throw chargeError;

    const base = new Date(`${todayIso}T00:00:00Z`);

    const reminders: DueDebtReminder[] = [];

    for (const row of (debtRows ?? []) as any[]) {
      const due = normalizeDateInput(row?.due_date);
      if (!due) continue;
      const daysLeft = diffInDays(base, due);
      const paidTotal = parseNumber(row?.paid_total);
      const amount = Math.max(parseNumber(row?.amount) - paidTotal, 0);
      reminders.push({
        id: String(row.id),
        title: row?.title || row?.party_name || 'Hutang',
        amount,
        dueDate: formatIsoDate(due),
        daysLeft,
        source: 'debt',
        note: row?.party_name ?? null,
      });
    }

    for (const row of (chargeRows ?? []) as any[]) {
      const due = normalizeDateInput(row?.due_date);
      if (!due) continue;
      const daysLeft = diffInDays(base, due);
      reminders.push({
        id: String(row.id),
        title: row?.subscription?.name || 'Langganan',
        amount: parseNumber(row?.amount),
        dueDate: formatIsoDate(due),
        daysLeft,
        source: 'subscription',
        note: row?.subscription?.vendor ?? null,
      });
    }

    return reminders.sort((a, b) => {
      if (a.dueDate === b.dueDate) return a.amount - b.amount;
      return a.dueDate.localeCompare(b.dueDate);
    });
  } catch (error) {
    logDev(error, 'getDueDebtsIn7Days');
    throw new Error('Gagal memuat pengingat hutang.');
  }
}

export interface WeeklyTrendInsight {
  current: number;
  previous: number;
  changePct: number | null;
}

export async function getWeeklyTrend(): Promise<WeeklyTrendInsight | null> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return null;
    const today = new Date();
    const baseToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const currentStart = new Date(baseToday);
    currentStart.setUTCDate(currentStart.getUTCDate() - 6);
    const previousStart = new Date(currentStart);
    previousStart.setUTCDate(previousStart.getUTCDate() - 7);
    const previousEnd = new Date(currentStart);
    previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);

    const { data, error } = await supabase
      .from('transactions')
      .select('amount, date')
      .eq('user_id', userId)
      .eq('type', 'expense')
      .is('to_account_id', null)
      .is('deleted_at', null)
      .gte('date', formatIsoDate(previousStart))
      .lte('date', formatIsoDate(baseToday));

    if (error) throw error;
    if (!data || data.length === 0) {
      return { current: 0, previous: 0, changePct: null };
    }

    let current = 0;
    let previous = 0;

    for (const row of data as any[]) {
      const rawDate = typeof row?.date === 'string' ? row.date : null;
      if (!rawDate) continue;
      const dateObj = normalizeDateInput(rawDate);
      if (!dateObj) continue;
      const amount = parseNumber(row?.amount);
      if (dateObj >= currentStart && dateObj <= baseToday) {
        current += amount;
      } else if (dateObj >= previousStart && dateObj <= previousEnd) {
        previous += amount;
      }
    }

    const changePct = previous > 0 ? (current - previous) / previous : null;
    return { current, previous, changePct };
  } catch (error) {
    logDev(error, 'getWeeklyTrend');
    throw new Error('Gagal memuat tren pengeluaran.');
  }
}

export async function getUncategorizedCount(period?: string): Promise<number> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return 0;
    const range = getMonthRange(normalizePeriodMonth(period ?? undefined));
    const { count, error } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('type', 'expense')
      .is('to_account_id', null)
      .is('deleted_at', null)
      .is('category_id', null)
      .gte('date', range.start)
      .lte('date', range.end);
    if (error) throw error;
    return count ?? 0;
  } catch (error) {
    logDev(error, 'getUncategorizedCount');
    throw new Error('Gagal menghitung transaksi belum dikategorikan.');
  }
}
